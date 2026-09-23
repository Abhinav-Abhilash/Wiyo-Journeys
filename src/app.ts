import {
  initAssistant,
  getAllStops,
  getNearestStops,
  searchStop,
  parseNaturalQuery,
  findJourneys,
  startVoiceInput,
  speakText,
  repeatLastSpoken,
  speakSlower,
  triggerArrivalNotification,
  saveJourneyCard,
  Stop,
  JourneyPlan,
  SupportedLanguage,
  JourneyTracker
} from './index';

import { getRoadSnappedPolyline, ROUTE_12A_ROAD_GEOMETRY } from './data/road_geometries';

// State variables
let currentLanguage: SupportedLanguage = 'en';
let selectedOriginStop: Stop | null = null;
let selectedDestStop: Stop | null = null;
let currentJourneyPlan: JourneyPlan | null = null;
let tracker: JourneyTracker | null = null;
let stopVoiceInputFn: (() => void) | null = null;

// Leaflet Map state
declare const L: any;
let leafletMap: any = null;
let busMarker: any = null;
let routePolyline: any = null;
let stopMarkers: any[] = [];
let activeRoadCoordinates: [number, number][] = ROUTE_12A_ROAD_GEOMETRY;
let simInterval: any = null;
let simIndex = 0;
let stopGpsWatchFn: (() => void) | null = null;

// Helper to sanitize dynamic user and stop text against DOM XSS
function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Pure localization strings (zero mixed English in regional views)
const i18n = {
  en: {
    tagline: 'Your journey, made simple.',
    chooseLang: 'Choose your language',
    continue: 'Continue',
    noLogin: 'No login required • 100% Offline Ready',
    greeting: 'Good morning!',
    whereTo: 'Where do you want to go?',
    whereToSub: 'Enter stop or destination',
    destSelection: 'Destination Selection',
    boardingStop: 'Boarding Bus Stop',
    gpsActive: 'GPS Active',
    walkFromYou: (dist: number) => `${dist}m walk from you`,
    popularStops: 'Popular Bus Stops',
    searchPlaceholder: 'Enter stop or destination (e.g. Lulu Mall)...',
    findBus: 'Find My Bus',
    mvdFaresNotice: 'Official Kerala MVD Stage Fares',
    noStopFound: (q: string) => `No matching bus stop found for "${q}".`,
    busDetails: 'Bus Details & Fare',
    destination: 'Destination',
    boardingPoint: 'Boarding Point',
    walkSummary: '180m • 3 min walk',
    walkInstruction: 'Walk past the stadium arch and turn right at junction shelter. Boarding bay is immediately on your left.',
    recommendedBus: 'Recommended Bus',
    departsInMins: (m: number) => `Departs in ${m} mins`,
    departsBay: 'Departs bay',
    busBoardHeader: 'Bus Board Header',
    towardsVia: (dest: string, route: string) => `Towards ${dest} via ${route}`,
    rideDuration: (mins: number) => `~${mins} mins ride`,
    intermediateStops: (count: number) => `${count} intermediate stops`,
    routeProgression: 'Route Progression & Fare',
    directLine: 'Direct Line',
    estimatedFare: 'Estimated Fare',
    fareBreakdown: (base: number, stage: number) => `Base fare: ₹${base}.00 • Stages: ₹${stage}.00`,
    conductorDisclaimer: 'Official Estimate: Pay directly to conductor inside the bus via Cash or Chalo / UPI tap.',
    startJourney: 'Start Journey',
    savePass: 'Save Offline Bus Pass',
    passSaved: 'Pass Cached Offline ✓',
    journeyProgress: 'Bus Journey in Progress',
    superFast: 'Super Fast',
    fastPassenger: 'Fast Passenger',
    ordinary: 'Ordinary',
    nextStop: 'Next Stop',
    nextFinalStop: 'Next / Final Stop',
    estTime: 'Est. Time',
    distance: 'Distance',
    speedGps: (spd: number) => `${spd} km/h • GPS Active`,
    alightingAlert: 'Alighting Alert • Stop Approaching',
    secAway: '~30 sec away',
    alightReadyDesc: (stop: string) => `Your bus stop ${stop} is 250m away. Please get ready to alight safely.`,
    repeatAudio: 'Repeat Audio',
    speakSlower: 'Speak Slower',
    tripCompleteBtn: 'Trip Complete • Alighted from Bus',
    tripFinishedDone: 'Trip Finished ✓',
    tripCompleteBanner: '🎉 You have alighted safely at destination. Thank you for riding KSRTC!',
    boardNode: '(Board)',
    alightNode: '(Alight)',
    stopNode: 'Stop',
    nearestNotice: 'Showing closest direct stop to destination.',
    findingBus: 'Finding bus...',
    fallbackTitle: 'Closest Available Option • No Direct Bus',
    fallbackTag: 'Nearest Stop',
    fallbackExplanation: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string) =>
      `No direct bus to ${dest}. Take ${route} from ${origin} and alight at ${nearest}. Your destination is ${dist} km ${dir} from this stop (short walk / auto transfer).`,
    fallbackSpoken: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string, fare: number) =>
      `No direct bus to ${dest}. Please take Route ${route} from ${origin} and get off at ${nearest}, which is the closest reachable stop, ${dist} kilometers ${dir} from your destination. Estimated fare is ${fare} rupees.`
  },
  ml: {
    tagline: 'യാത്രകൾ ഇനി ലളിതം.',
    chooseLang: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക',
    continue: 'തുടരുക',
    noLogin: 'ലോഗിൻ ആവശ്യമില്ല • 100% ഓഫ്‌ലൈൻ തയ്യാറാണ്',
    greeting: 'സുപ്രഭാതം!',
    whereTo: 'എങ്ങോട്ടാണ് പോകേണ്ടത്?',
    whereToSub: 'ബസ് സ്റ്റോപ്പ് അല്ലെങ്കിൽ സ്ഥലം നൽകുക',
    destSelection: 'ലക്ഷ്യസ്ഥാനം തിരഞ്ഞെടുക്കുക',
    boardingStop: 'കയറേണ്ട സ്റ്റോപ്പ്',
    gpsActive: 'ജിപിഎസ് സജീവം',
    walkFromYou: (dist: number) => `നിങ്ങളിൽ നിന്ന് ${dist} മീറ്റർ നടപ്പ്`,
    popularStops: 'പ്രധാന ബസ് സ്റ്റോപ്പുകൾ',
    searchPlaceholder: 'സ്റ്റോപ്പ് അല്ലെങ്കിൽ ലക്ഷ്യസ്ഥാനം നൽകുക (ഉദാ: ലുലു മാൾ)...',
    findBus: 'ബസ് കണ്ടെത്തുക',
    mvdFaresNotice: 'ഔദ്യോഗിക കേരള എം.വി.ഡി നിരക്കുകൾ',
    noStopFound: (q: string) => `"${q}" എന്നതിന് അനുയോജ്യമായ ബസ് സ്റ്റോപ്പ് കണ്ടെത്താനായില്ല.`,
    busDetails: 'ബസ് വിവരങ്ങളും നിരക്കും',
    destination: 'ലക്ഷ്യസ്ഥാനം',
    boardingPoint: 'കയറേണ്ട സ്റ്റോപ്പ്',
    walkSummary: '180 മീ • 3 മിനിറ്റ് നടപ്പ്',
    walkInstruction: 'സ്റ്റേഡിയം കവാടം കഴിഞ്ഞ് ജംഗ്ഷൻ ഷെൽട്ടറിലേക്ക് തിരിയുക. ബസ് ബേ ഇടത് വശത്താണ്.',
    recommendedBus: 'നിർദ്ദേശിക്കുന്ന ബസ്',
    departsInMins: (m: number) => `${m} മിനിറ്റിൽ പുറപ്പെടും`,
    departsBay: 'പുറപ്പെടുന്ന സമയം',
    busBoardHeader: 'ബസ് ബോർഡ് വിവരണം',
    towardsVia: (dest: string, route: string) => `${dest} ലേക്ക് (റൂട്ട് ${route})`,
    rideDuration: (mins: number) => `~${mins} മിനിറ്റ് യാത്ര`,
    intermediateStops: (count: number) => `${count} ഇട സ്റ്റോപ്പുകൾ`,
    routeProgression: 'റൂട്ട് വിവരങ്ങളും നിരക്കും',
    directLine: 'നേരിട്ടുള്ള റൂട്ട്',
    estimatedFare: 'പ്രതീക്ഷിക്കുന്ന നിരക്ക്',
    fareBreakdown: (base: number, stage: number) => `അടിസ്ഥാന നിരക്ക്: ₹${base}.00 • സ്റ്റേജ് നിരക്ക്: ₹${stage}.00`,
    conductorDisclaimer: 'ഔദ്യോഗിക നിരക്ക്: ബസ്സിനുള്ളിൽ കണ്ടക്ടർക്ക് പണമായോ യുപിഐ വഴിയോ നേരിട്ട് നൽകുക.',
    startJourney: 'യാത്ര ആരംഭിക്കുക',
    savePass: 'ഓഫ്‌ലൈൻ പാസ് സേവ് ചെയ്യുക',
    passSaved: 'പാസ് സേവ് ചെയ്തു ✓',
    journeyProgress: 'യാത്ര പുരോഗമിക്കുന്നു',
    superFast: 'സൂപ്പർ ഫാസ്റ്റ്',
    fastPassenger: 'ഫാസ്റ്റ് പാസഞ്ചർ',
    ordinary: 'ഓർഡിനറി',
    nextStop: 'അടുത്ത സ്റ്റോപ്പ്',
    nextFinalStop: 'അടുത്ത സ്റ്റോപ്പ്',
    estTime: 'സമയം',
    distance: 'ദൂരം',
    speedGps: (spd: number) => `${spd} കി.മീ/മണിക്കൂർ • ജിപിഎസ് സജീവം`,
    alightingAlert: 'സ്റ്റോപ്പ് ഉടൻ എത്തും',
    secAway: '~30 സെക്കൻഡിൽ',
    alightReadyDesc: (stop: string) => `നിങ്ങളുടെ ബസ് സ്റ്റോപ്പ് ${stop} 250 മീറ്റർ അകലെയാണ്. ഇറങ്ങാൻ തയ്യാറാകുക.`,
    repeatAudio: 'ശബ്ദം വീണ്ടും കേൾക്കുക',
    speakSlower: 'പതുക്കെ കേൾക്കുക',
    tripCompleteBtn: 'യാത്ര പൂർത്തിയായി • ബസ്സിൽ നിന്ന് ഇറങ്ങി',
    tripFinishedDone: 'യാത്ര പൂർത്തിയായി ✓',
    tripCompleteBanner: '🎉 നിങ്ങൾ സുരക്ഷിതമായി എത്തിച്ചേർന്നു. കെ.എസ്.ആർ.ടി.സി യാത്രയ്ക്ക് നന്ദി!',
    boardNode: '(കയറുക)',
    alightNode: '(ഇറങ്ങുക)',
    stopNode: 'സ്റ്റോപ്പ്',
    nearestNotice: 'ലക്ഷ്യസ്ഥാനത്തേക്ക് ഏറ്റവും അടുത്തുള്ള സ്റ്റോപ്പ് കാണിക്കുന്നു.',
    findingBus: 'ബസ് കണ്ടെത്തുന്നു...',
    fallbackTitle: 'ഏറ്റവും അടുത്തുള്ള സ്റ്റോപ്പ് • നേരിട്ടുള്ള ബസ് ലഭ്യമല്ല',
    fallbackTag: 'അടുത്ത സ്റ്റോപ്പ്',
    fallbackExplanation: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string) =>
      `${dest}ലേക്ക് നേരിട്ട് ബസ്സില്ല. ${origin}ൽ നിന്ന് ${route} ബസ്സിൽ കയറി ${nearest}ൽ ഇറങ്ങുക. അവിടെ നിന്ന് നിങ്ങളുടെ ലക്ഷ്യസ്ഥാനത്തേക്ക് ${dist} കി.മീ ${dir} യാത്രയുണ്ട് (നടപ്പ് / ഓട്ടോ).`,
    fallbackSpoken: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string, fare: number) =>
      `${dest}ലേക്ക് നേരിട്ട് ബസ്സില്ല. ${origin}ൽ നിന്ന് റൂട്ട് ${route} ബസ്സിൽ കയറി ${nearest}ൽ ഇറങ്ങുക. ലക്ഷ്യസ്ഥാനം അവിടെ നിന്ന് ${dist} കി.മീ ${dir} അകലെയാണ്. പ്രതീക്ഷിക്കുന്ന നിരക്ക് ${fare} രൂപ.`
  },
  ta: {
    tagline: 'உங்கள் பயணம், எளிதாக்கப்பட்டது.',
    chooseLang: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
    continue: 'தொடரவும்',
    noLogin: 'உள்நுழைவு தேவையில்லை • 100% ஆஃப்லைன் தயார்',
    greeting: 'காலை வணக்கம்!',
    whereTo: 'எங்கு செல்ல வேண்டும்?',
    whereToSub: 'பேருந்து நிறுத்தம் உள்ளிடவும்',
    destSelection: 'இடத்தை தேர்வு செய்யவும்',
    boardingStop: 'ஏறும் இடம்',
    gpsActive: 'ஜிபிஎஸ் செயலில் உள்ளது',
    walkFromYou: (dist: number) => `உங்களிலிருந்து ${dist} மீ நடைபயணம்`,
    popularStops: 'முக்கிய பேருந்து நிறுத்தங்கள்',
    searchPlaceholder: 'நிறுத்தம் அல்லது இலக்கை உள்ளிடவும் (எ.கா: லுலு மால்)...',
    findBus: 'பேருந்தை கண்டறியவும்',
    mvdFaresNotice: 'அதிகாரப்பூர்வ கேரள எம்விடி கட்டணங்கள்',
    noStopFound: (q: string) => `"${q}" க்கான பேருந்து நிறுத்தம் எதுவும் கிடைக்கவில்லை.`,
    busDetails: 'பேருந்து விவரங்கள் மற்றும் கட்டணம்',
    destination: 'செல்லும் இடம்',
    boardingPoint: 'ஏறும் இடம்',
    walkSummary: '180 மீ • 3 நிமிட நடை',
    walkInstruction: 'ஸ்டேடியம் வளைவை கடந்து சந்திப்பு நிழற்குடை நோக்கி செல்லவும். பேருந்து நிறுத்தம் இடதுபுறம் உள்ளது.',
    recommendedBus: 'பரிந்துரைக்கப்பட்ட பேருந்து',
    departsInMins: (m: number) => `${m} நிமிடங்களில் புறப்படும்`,
    departsBay: 'புறப்படும் நேரம்',
    busBoardHeader: 'பேருந்து பலகை',
    towardsVia: (dest: string, route: string) => `${dest} நோக்கி (வழித்தடம் ${route})`,
    rideDuration: (mins: number) => `~${mins} நிமிட பயணம்`,
    intermediateStops: (count: number) => `${count} இடை நிறுத்தங்கள்`,
    routeProgression: 'வழித்தடம் மற்றும் கட்டணம்',
    directLine: 'நேரடி வழி',
    estimatedFare: 'மதிப்பிடப்பட்ட கட்டணம்',
    fareBreakdown: (base: number, stage: number) => `அடிப்படை கட்டணம்: ₹${base}.00 • நிலை கட்டணம்: ₹${stage}.00`,
    conductorDisclaimer: 'அதிகாரப்பூர்வ கட்டணம்: பேருந்தில் நடத்துனரிடம் பணம் அல்லது யுபிஐ மூலம் செலுத்தவும்.',
    startJourney: 'பயணத்தை தொடங்குங்கள்',
    savePass: 'ஆஃப்லைன் பாஸ் சேமிக்கவும்',
    passSaved: 'பாஸ் சேமிக்கப்பட்டது ✓',
    journeyProgress: 'பயணம் தொடர்கிறது',
    superFast: 'சூப்பர் பாஸ்ட்',
    fastPassenger: 'பாஸ்ட் பாссажиர்',
    ordinary: 'சாதாரண பேருந்து',
    nextStop: 'அடுத்த நிறுத்தம்',
    nextFinalStop: 'அடுத்த நிறுத்தம்',
    estTime: 'நேரம்',
    distance: 'தொலைவு',
    speedGps: (spd: number) => `${spd} கி.மீ/மணி • ஜிபிஎஸ் செயலில் உள்ளது`,
    alightingAlert: 'இறங்கும் நேரம் நெருங்குகிறது',
    secAway: '~30 வினாடிகளில்',
    alightReadyDesc: (stop: string) => `உங்கள் பேருந்து நிறுத்தம் ${stop} 250 மீ தொலைவில் உள்ளது. இறங்க தயாராகுங்கள்.`,
    repeatAudio: 'மீண்டும் கேட்கவும்',
    speakSlower: 'மெதுவாக கேட்கவும்',
    tripCompleteBtn: 'பயணம் முடிந்தது • இறங்கியாச்சு',
    tripFinishedDone: 'பயணம் முடிந்தது ✓',
    tripCompleteBanner: '🎉 நீங்கள் பாதுகாப்பாக வந்தடைந்துவிட்டீர்கள். கே.எஸ்.ஆர்.டி.சி பயணத்திற்கு நன்றி!',
    boardNode: '(ஏறவும்)',
    alightNode: '(இறங்கவும்)',
    stopNode: 'நிறுத்தம்',
    nearestNotice: 'இலக்குக்கு அருகிலுள்ள பேருந்து நிறுத்தம் காட்டப்படுகிறது.',
    findingBus: 'பேருந்து தேடுகிறது...',
    fallbackTitle: 'அருகிலுள்ள நிறுத்தம் • நேரடி பேருந்து இல்லை',
    fallbackTag: 'அருகிலுள்ள நிறுத்தம்',
    fallbackExplanation: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string) =>
      `${dest}க்கு நேரடி பேருந்து இல்லை. ${origin} முதல் ${route} பேருந்தில் சென்று ${nearest} இல் இறங்கவும். உங்கள் இலக்கு ${dist} கி.மீ ${dir} தொலைவில் உள்ளது.`,
    fallbackSpoken: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string, fare: number) =>
      `${dest}க்கு நேரடி பேருந்து இல்லை. ${origin} இல் இருந்து ரூட் ${route} பேருந்தில் ஏறி ${nearest} இல் இறங்கவும். கட்டணம் ${fare} ரூபாய்.`
  },
  hi: {
    tagline: 'आपकी यात्रा, अब हुई आसान।',
    chooseLang: 'अपनी भाषा चुनें',
    continue: 'आगे बढ़ें',
    noLogin: 'लॉगिन की आवश्यकता नहीं • 100% ऑफ़लाइन तैयार',
    greeting: 'शुभ प्रभात!',
    whereTo: 'आप कहाँ जाना चाहते हैं?',
    whereToSub: 'बस स्टॉप या गंतव्य दर्ज करें',
    destSelection: 'गंतव्य चुनें',
    boardingStop: 'बोर्डिंग पॉइंट',
    gpsActive: 'जीपीएस सक्रिय है',
    walkFromYou: (dist: number) => `आपसे ${dist} मीटर पैदल दूरी`,
    popularStops: 'प्रमुख बस स्टॉप',
    searchPlaceholder: 'स्टॉप या गंतव्य दर्ज करें (उदा. लुलु मॉल)...',
    findBus: 'मेरी बस खोजें',
    mvdFaresNotice: 'आधिकारिक केरल एमवीडी चरण किराया',
    noStopFound: (q: string) => `"${q}" के लिए कोई मेल खाता बस स्टॉप नहीं मिला।`,
    busDetails: 'बस विवरण और किराया',
    destination: 'गंतव्य',
    boardingPoint: 'बोर्डिंग पॉइंट',
    walkSummary: '180 मी • 3 मिनट पैदल',
    walkInstruction: 'स्टेडियम गेट पार करके जंक्शन शेल्टर की ओर मुड़ें। बस बे बाईं ओर है।',
    recommendedBus: 'सुझाई गई बस',
    departsInMins: (m: number) => `${m} मिनट में प्रस्थान`,
    departsBay: 'प्रस्थान समय',
    busBoardHeader: 'बस बोर्ड विवरण',
    towardsVia: (dest: string, route: string) => `${dest} की ओर (रूट ${route})`,
    rideDuration: (mins: number) => `~${mins} मिनट की यात्रा`,
    intermediateStops: (count: number) => `${count} मध्यवर्ती स्टॉप`,
    routeProgression: 'मार्ग विवरण और किराया',
    directLine: 'सीधा मार्ग',
    estimatedFare: 'अनुमानित किराया',
    fareBreakdown: (base: number, stage: number) => `मूल किराया: ₹${base}.00 • चरण किराया: ₹${stage}.00`,
    conductorDisclaimer: 'आधिकारिक अनुमान: बस में कंडक्टर को नकद या यूपीआई द्वारा सीधे भुगतान करें।',
    startJourney: 'यात्रा शुरू करें',
    savePass: 'ऑफ़लाइन पास सहेजें',
    passSaved: 'पास सुरक्षित हो गया ✓',
    journeyProgress: 'यात्रा जारी है',
    superFast: 'सुपर फास्ट',
    fastPassenger: 'फास्ट पैसेंजर',
    ordinary: 'साधारण बस',
    nextStop: 'अगला स्टॉप',
    nextFinalStop: 'अगला स्टॉप',
    estTime: 'समय',
    distance: 'दूरी',
    speedGps: (spd: number) => `${spd} किमी/घंटा • जीपीएस सक्रिय`,
    alightingAlert: 'उतरने का समय आ रहा है',
    secAway: '~30 सेकंड में',
    alightReadyDesc: (stop: string) => `आपका बस स्टॉप ${stop} 250 मीटर दूर है। कृपया सुरक्षित उतरने के लिए तैयार रहें।`,
    repeatAudio: 'पुनः सुनें',
    speakSlower: 'धीमी गति से सुनें',
    tripCompleteBtn: 'यात्रा पूर्ण • बस से उतरे',
    tripFinishedDone: 'यात्रा पूर्ण ✓',
    tripCompleteBanner: '🎉 आप सुरक्षित रूप से पहुंच गए हैं। केएसआरटीसी से यात्रा करने के लिए धन्यवाद!',
    boardNode: '(चढ़ें)',
    alightNode: '(उतरें)',
    stopNode: 'स्टॉप',
    nearestNotice: 'गंतव्य के सबसे नजदीकी स्टॉप दिखाया जा रहा है।',
    findingBus: 'बस खोजी जा रही है...',
    fallbackTitle: 'निकटतम उपलब्ध स्टॉप • कोई सीधी बस नहीं',
    fallbackTag: 'निकटतम स्टॉप',
    fallbackExplanation: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string) =>
      `${dest} के लिए सीधी बस नहीं है। ${origin} से ${route} बस लें और ${nearest} पर उतरें। आपका गंतव्य यहाँ से ${dist} किमी ${dir} दूर है।`,
    fallbackSpoken: (origin: string, dest: string, nearest: string, dist: string, dir: string, route: string, fare: number) =>
      `${dest} के लिए कोई सीधी बस नहीं है। ${origin} से रूट ${route} बस लें और ${nearest} पर उतरें। अनुमानित किराया ${fare} रुपये है।`
  }
};

const districtNames: Record<SupportedLanguage, Record<string, string>> = {
  en: { Ernakulam: 'Ernakulam', Thrissur: 'Thrissur', Alappuzha: 'Alappuzha', Kottayam: 'Kottayam', Thiruvananthapuram: 'Thiruvananthapuram', Kozhikode: 'Kozhikode' },
  ml: { Ernakulam: 'എറണാകുളം', Thrissur: 'തൃശ്ശൂർ', Alappuzha: 'ആലപ്പുഴ', Kottayam: 'കോട്ടയം', Thiruvananthapuram: 'തിരുവനന്തപുരം', Kozhikode: 'കോഴിക്കോട്' },
  ta: { Ernakulam: 'எர்ணாகுளம்', Thrissur: 'திருச்சூர்', Alappuzha: 'ஆலப்புழா', Kottayam: 'கோட்டயம்', Thiruvananthapuram: 'திருவனந்தபுரம்', Kozhikode: 'கோழிக்கோடு' },
  hi: { Ernakulam: 'एर्नाकुलम', Thrissur: 'त्रिशूर', Alappuzha: 'अलप्पुझा', Kottayam: 'कोट्टायम', Thiruvananthapuram: 'तिरुवनंतपुरम', Kozhikode: 'कोझिकोड' }
};

const serviceTypes: Record<SupportedLanguage, Record<string, string>> = {
  en: { 'Fast Passenger': 'Fast Passenger', 'Super Fast': 'Super Fast', Ordinary: 'Ordinary' },
  ml: { 'Fast Passenger': 'ഫാസ്റ്റ് പാസഞ്ചർ', 'Super Fast': 'സൂപ്പർ ഫാസ്റ്റ്', Ordinary: 'ഓർഡിനറി' },
  ta: { 'Fast Passenger': 'பாஸ்ட் பாссажиர்', 'Super Fast': 'சூப்பர் பாஸ்ட்', Ordinary: 'சாதாரண பேருந்து' },
  hi: { 'Fast Passenger': 'फास्ट पैसेंजर', 'Super Fast': 'सुपर फास्ट', Ordinary: 'साधारण बस' }
};

const ksrtcRouteLabel: Record<SupportedLanguage, (r: string) => string> = {
  en: (r) => `KSRTC Route ${r}`,
  ml: (r) => `കെ.എസ്.ആർ.ടി.സി റൂട്ട് ${r}`,
  ta: (r) => `கே.எஸ்.ஆர்.டி.சி வழித்தடம் ${r}`,
  hi: (r) => `केएसआरटीसी रूट ${r}`
};

// Spoken greetings in each language
const languageGreetings: Record<SupportedLanguage, string> = {
  en: 'Welcome to Wiyo Journeys. Where would you like to travel today?',
  ml: 'നമസ്കാരം! വയ്യോ ജേർണീസിലേക്ക് സ്വാഗതം. എങ്ങോട്ടാണ് യാത്ര?',
  ta: 'வணக்கம்! வியோ ஜர்னீஸுக்கு வரவேற்கிறோம். எங்கு செல்ல வேண்டும்?',
  hi: 'नमस्ते! वियो जर्नीज़ में आपका स्वागत है। आप कहाँ जाना चाहते हैं?'
};

/**
 * Theme Manager: Light / Dark Mode with smooth animation
 */
function initTheme() {
  const saved = localStorage.getItem('wiyo_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

(window as any).toggleTheme = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('wiyo_theme', isDark ? 'dark' : 'light');
};

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const status = initAssistant();
  const statusEl = document.getElementById('system-status-text');
  if (statusEl) {
    statusEl.textContent = status.tier === 'full-online' ? 'Online • Official MVD Fares' : '100% Offline Ready';
  }

  // Set default origin to Maharajas Ground / Ernakulam South
  const stops = getAllStops();
  selectedOriginStop = stops.find((s) => s.id === 'ST_MAHARAJAS') || stops[0];
  selectedDestStop = stops.find((s) => s.id === 'ST_EDAPPALLY') || stops[1];

  updateUILanguage();
  detectGPSLocation();
});

/**
 * Screen Navigation
 */
(window as any).goToScreen = (screenId: string) => {
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove('hidden');
    target.scrollTop = 0;
  }

  const topBar = document.getElementById('phone-top-bar');
  const brand = document.getElementById('mobile-top-brand');
  if (topBar) {
    if (screenId === 'screen-language') {
      topBar.classList.remove('bg-surface');
      if (brand) brand.className = 'text-[11px] font-extrabold text-white/90 tracking-wide drop-shadow-xs';
    } else {
      topBar.classList.add('bg-surface');
      if (brand) brand.className = 'text-[11px] font-extrabold text-slate-700 dark:text-slate-200 tracking-wide';
    }
  }

  if (screenId === 'screen-tracking') {
    setTimeout(() => initLiveLeafletMap(), 250);
  } else {
    // Clear live tracking when leaving screen 4
    if (simInterval) {
      clearInterval(simInterval);
      simInterval = null;
    }
    if (stopGpsWatchFn) {
      stopGpsWatchFn();
      stopGpsWatchFn = null;
    }
  }
};

/**
 * Screen 1: Language selection with voice audio preview
 */
(window as any).selectLanguage = (lang: SupportedLanguage, speakOnSelect = true) => {
  currentLanguage = lang;
  document.querySelectorAll('.lang-opt').forEach((btn) => {
    const isSelected = btn.getAttribute('data-lang') === lang;
    const check = btn.querySelector('.lang-check');
    const speaker = btn.querySelector('.lang-speaker-icon');
    if (isSelected) {
      btn.className = 'lang-opt w-full text-left p-4 rounded-2xl transition-all bg-primary text-on-primary shadow-md flex items-center justify-between border-2 border-primary group';
      check?.classList.remove('hidden');
      check?.classList.add('flex');
      speaker?.classList.add('text-white');
      speaker?.classList.remove('text-primary');
    } else {
      btn.className = 'lang-opt w-full text-left p-4 rounded-2xl transition-all bg-white text-on-surface shadow-sm hover:bg-surface-container-low flex items-center justify-between border border-outline-variant/40 group';
      check?.classList.add('hidden');
      check?.classList.remove('flex');
      speaker?.classList.remove('text-white');
      speaker?.classList.add('text-primary');
    }
  });

  updateUILanguage();

  if (speakOnSelect) {
    speakText(languageGreetings[lang], lang, 1.0, {
      phraseKey: `${lang}_welcome`,
      onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
    });
  }
};

(window as any).speakLanguagePreview = (lang: SupportedLanguage, event?: Event) => {
  if (event) event.stopPropagation();
  speakText(languageGreetings[lang], lang, 1.0, {
    phraseKey: `${lang}_welcome`,
    onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
  });
};

function updateUILanguage() {
  const strings = i18n[currentLanguage];

  // Screen 1: Language Selection elements
  const taglineEl = document.getElementById('lang-screen-tagline');
  const instructionEl = document.getElementById('lang-screen-instruction');
  const continueText = document.getElementById('lang-continue-text');
  const disclaimerText = document.getElementById('lang-disclaimer-text');

  if (taglineEl) taglineEl.textContent = 'Your journey, made simple.';
  if (instructionEl) instructionEl.textContent = strings.chooseLang;
  if (continueText) continueText.textContent = strings.continue;
  if (disclaimerText) disclaimerText.textContent = strings.noLogin;

  // Screen 2: Destination Selection elements
  const screen2Title = document.getElementById('screen2-header-title');
  const greetingEl = document.getElementById('greeting-text');
  const whereTitle = document.getElementById('where-to-go-title');
  const whereSub = document.getElementById('where-to-go-sub');
  const destInput = document.getElementById('destination-input') as HTMLInputElement;
  const boardingLabel = document.getElementById('boarding-stop-label');
  const gpsActiveBadge = document.getElementById('gps-active-badge-text');
  const resultsTitle = document.getElementById('results-header-title');
  const findBtn = document.getElementById('find-bus-btn-text');
  const mvdDisclaimer = document.getElementById('mvd-disclaimer-text');

  if (screen2Title) screen2Title.textContent = strings.destSelection;
  if (greetingEl) greetingEl.textContent = strings.greeting;
  if (whereTitle) whereTitle.textContent = strings.whereTo;
  if (whereSub) whereSub.textContent = strings.whereToSub;
  if (destInput) destInput.placeholder = strings.searchPlaceholder;
  if (boardingLabel) boardingLabel.textContent = strings.boardingStop;
  if (gpsActiveBadge) gpsActiveBadge.textContent = strings.gpsActive;
  if (resultsTitle) resultsTitle.textContent = strings.popularStops;
  if (findBtn) findBtn.textContent = strings.findBus;
  if (mvdDisclaimer) mvdDisclaimer.textContent = strings.mvdFaresNotice;

  // Screen 3: Bus Details & Fare elements
  const screen3Title = document.getElementById('screen3-header-title');
  const destBannerLabel = document.getElementById('dest-banner-label');
  const detailsBoardingLabel = document.getElementById('details-boarding-label');
  const detailsWalkPill = document.getElementById('details-walk-pill');
  const detailsWalkInstruction = document.getElementById('details-walk-instruction');
  const detailsDepartsBayLabel = document.getElementById('details-departs-bay-label');
  const detailsBoardHeaderLabel = document.getElementById('details-board-header-label');
  const detailsProgressionTitle = document.getElementById('details-progression-title');
  const detailsDirectLineBadge = document.getElementById('details-direct-line-badge');
  const detailsEstimatedFareLabel = document.getElementById('details-estimated-fare-label');
  const detailsConductorDisclaimer = document.getElementById('details-conductor-disclaimer');
  const startJourneyBtnText = document.getElementById('start-journey-btn-text');
  const savePassText = document.getElementById('save-pass-text');

  if (screen3Title) screen3Title.textContent = strings.busDetails;
  if (destBannerLabel) destBannerLabel.textContent = strings.destination;
  if (detailsBoardingLabel) detailsBoardingLabel.textContent = strings.boardingPoint;
  if (detailsWalkPill) detailsWalkPill.textContent = strings.walkSummary;
  if (detailsWalkInstruction) detailsWalkInstruction.textContent = strings.walkInstruction;
  if (detailsDepartsBayLabel) detailsDepartsBayLabel.textContent = strings.departsBay;
  if (detailsBoardHeaderLabel) detailsBoardHeaderLabel.textContent = strings.busBoardHeader;
  if (detailsProgressionTitle) detailsProgressionTitle.textContent = strings.routeProgression;
  if (detailsDirectLineBadge) detailsDirectLineBadge.textContent = strings.directLine;
  if (detailsEstimatedFareLabel) detailsEstimatedFareLabel.textContent = strings.estimatedFare;
  if (detailsConductorDisclaimer) detailsConductorDisclaimer.textContent = strings.conductorDisclaimer;
  if (startJourneyBtnText) startJourneyBtnText.textContent = strings.startJourney;
  if (savePassText) savePassText.textContent = strings.savePass;

  // Screen 4: Live Journey Tracking elements
  const trackTitle = document.getElementById('track-title');
  const trackGpsText = document.getElementById('track-gps-text');
  const nextStopBtnText = document.getElementById('next-stop-btn-text');
  const hudNextStopLabel = document.getElementById('hud-next-stop-label');
  const hudTimeLabel = document.getElementById('hud-time-label');
  const hudDistLabel = document.getElementById('hud-dist-label');
  const alightingAlertTitle = document.getElementById('alighting-alert-title');
  const alightingAlertPill = document.getElementById('alighting-alert-pill');
  const repeatAudioBtnText = document.getElementById('repeat-audio-btn-text');
  const speakSlowerBtnText = document.getElementById('speak-slower-btn-text');
  const tripFinishBtnText = document.getElementById('trip-finish-btn-text');
  const tripCompleteBanner = document.getElementById('trip-complete-banner');

  if (trackTitle) trackTitle.textContent = strings.journeyProgress;
  if (trackGpsText) trackGpsText.textContent = strings.gpsActive;
  if (nextStopBtnText) nextStopBtnText.textContent = strings.nextStop;
  if (hudNextStopLabel) hudNextStopLabel.textContent = strings.nextFinalStop;
  if (hudTimeLabel) hudTimeLabel.textContent = strings.estTime;
  if (hudDistLabel) hudDistLabel.textContent = strings.distance;
  if (alightingAlertTitle) alightingAlertTitle.textContent = strings.alightingAlert;
  if (alightingAlertPill) alightingAlertPill.textContent = strings.secAway;
  if (repeatAudioBtnText) repeatAudioBtnText.textContent = strings.repeatAudio;
  if (speakSlowerBtnText) speakSlowerBtnText.textContent = strings.speakSlower;
  if (tripFinishBtnText) tripFinishBtnText.textContent = strings.tripCompleteBtn;
  if (tripCompleteBanner) tripCompleteBanner.textContent = strings.tripCompleteBanner;

  // Update dynamic content if plan exists
  if (currentJourneyPlan) {
    populateDetailsScreen(currentJourneyPlan);
  }

  // Update detected boarding stop text if already set
  if (selectedOriginStop) {
    const nameEl = document.getElementById('detected-stop-name');
    const hintEl = document.getElementById('detected-stop-hint');
    if (nameEl) nameEl.textContent = selectedOriginStop.names[currentLanguage] || selectedOriginStop.names.en;
    if (hintEl && selectedOriginStop.landmarkHint) {
      hintEl.textContent = `${selectedOriginStop.landmarkHint[currentLanguage] || selectedOriginStop.landmarkHint.en}.`;
    }
  }

  renderPopularStops();
}

async function detectGPSLocation() {
  const refreshBtn = document.getElementById('refresh-gps-btn');
  if (refreshBtn) refreshBtn.classList.add('animate-spin');

  const res = await getNearestStops();
  if (refreshBtn) refreshBtn.classList.remove('animate-spin');

  if (res.stops && res.stops.length > 0) {
    const nearest = res.stops[0];
    selectedOriginStop = nearest.stop;

    const nameEl = document.getElementById('detected-stop-name');
    const distEl = document.getElementById('detected-stop-dist');
    const hintEl = document.getElementById('detected-stop-hint');

    if (nameEl) nameEl.textContent = nearest.stop.names[currentLanguage] || nearest.stop.names.en;
    if (distEl) distEl.textContent = i18n[currentLanguage].walkFromYou(nearest.distanceMeters);
    if (hintEl && nearest.stop.landmarkHint) {
      hintEl.textContent = `${nearest.stop.landmarkHint[currentLanguage] || nearest.stop.landmarkHint.en}.`;
    }
  }
}
(window as any).detectGPSLocation = detectGPSLocation;

/**
 * Popular Stops List
 */
function renderPopularStops(candidates?: Stop[]) {
  const container = document.getElementById('stops-list-container');
  if (!container) return;

  const stops = candidates || getAllStops().filter((s) => s.id !== selectedOriginStop?.id).slice(0, 5);
  container.innerHTML = '';

  stops.forEach((stop) => {
    const card = document.createElement('button');
    card.className = 'w-full text-left bg-white dark:bg-slate-800 hover:bg-surface-container-low dark:hover:bg-slate-700/60 active:scale-[0.99] p-3 rounded-xl shadow-xs border border-outline-variant/30 dark:border-slate-700/50 flex items-center justify-between transition-all';
    card.onclick = () => {
      selectDestinationStop(stop);
    };

    const safeLocalName = escapeHtml(stop.names[currentLanguage] || stop.names.en);
    const localDistrict = districtNames[currentLanguage][stop.district] || stop.district || 'Kerala';
    const subline = currentLanguage === 'en'
      ? `${escapeHtml(stop.names.en)} • ${escapeHtml(localDistrict)}`
      : `${escapeHtml(localDistrict)}`;

    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-primary flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[20px]">directions_bus</span>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-bold text-sm text-on-surface truncate">${safeLocalName}</span>
          <span class="text-xs text-on-surface-variant truncate">${subline}</span>
        </div>
      </div>
      <span class="material-symbols-outlined text-slate-400 text-[18px]">north_east</span>
    `;
    container.appendChild(card);
  });
}

function selectDestinationStop(stop: Stop) {
  selectedDestStop = stop;
  const input = document.getElementById('destination-input') as HTMLInputElement;
  if (input) {
    input.value = stop.names[currentLanguage] || stop.names.en;
  }
  executeFindBus();
}

/**
 * Search input handler
 */
(window as any).handleSearchInput = (query: string) => {
  const clearBtn = document.getElementById('clear-input-btn');
  if (clearBtn) {
    if (query.trim()) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (!query.trim()) {
    renderPopularStops();
    return;
  }

  const match = searchStop(query);
  if (match.status === 'matched') {
    renderPopularStops([match.stop]);
  } else if (match.status === 'ambiguous') {
    renderPopularStops(match.candidates.map((c) => c.stop));
  } else {
    const container = document.getElementById('stops-list-container');
    if (container) {
      container.innerHTML = '';
      const noMatch = document.createElement('div');
      noMatch.className = 'p-4 bg-slate-50 dark:bg-slate-800 text-center rounded-xl text-xs text-slate-500 dark:text-slate-400';
      noMatch.textContent = i18n[currentLanguage].noStopFound(query);
      container.appendChild(noMatch);
    }
  }
};

(window as any).clearSearchInput = () => {
  const input = document.getElementById('destination-input') as HTMLInputElement;
  if (input) {
    input.value = '';
    (window as any).handleSearchInput('');
    input.focus();
  }
};

/**
 * Voice Input Search
 */
(window as any).toggleVoiceSearch = () => {
  const micBtn = document.getElementById('mic-search-btn');
  const input = document.getElementById('destination-input') as HTMLInputElement;

  if (stopVoiceInputFn) {
    stopVoiceInputFn();
    stopVoiceInputFn = null;
    micBtn?.classList.remove('bg-amber-500', 'text-white', 'animate-pulse');
    micBtn?.classList.add('bg-teal-50', 'text-primary');
    return;
  }

  micBtn?.classList.add('bg-amber-500', 'text-white', 'animate-pulse');
  micBtn?.classList.remove('bg-teal-50', 'text-primary');
  showToast('Listening...', `Listening in ${currentLanguage.toUpperCase()}...`);

  stopVoiceInputFn = startVoiceInput({
    lang: currentLanguage,
    onTranscript: (text) => {
      if (input) input.value = text;
      showToast('Voice Transcribed', text);
      const parsed = parseNaturalQuery(text, selectedOriginStop || undefined);
      if (parsed.destination.status === 'matched') {
        selectedDestStop = parsed.destination.stop;
        if (parsed.origin.status === 'matched') {
          selectedOriginStop = parsed.origin.stop;
        }
        executeFindBus();
      } else {
        (window as any).handleSearchInput(text);
      }
    },
    onCommand: (cmd) => {
      if (cmd === 'slower') speakSlower();
      else if (cmd === 'repeat') repeatLastSpoken();
      else if (cmd === 'stop') {
        if (stopVoiceInputFn) {
          stopVoiceInputFn();
          stopVoiceInputFn = null;
        }
        micBtn?.classList.remove('bg-amber-500', 'text-white', 'animate-pulse');
        micBtn?.classList.add('bg-teal-50', 'text-primary');
        showToast('Voice', 'Stopped listening');
      }
    },
    onError: (err) => {
      showToast('Voice Notice', err);
      micBtn?.classList.remove('bg-amber-500', 'text-white', 'animate-pulse');
      micBtn?.classList.add('bg-teal-50', 'text-primary');
    },
    onEnd: () => {
      micBtn?.classList.remove('bg-amber-500', 'text-white', 'animate-pulse');
      micBtn?.classList.add('bg-teal-50', 'text-primary');
      stopVoiceInputFn = null;
    }
  });
};

let isFindingBus = false;

/**
 * Execute Route Lookup & populate Screen 3
 */
async function executeFindBus() {
  if (isFindingBus) return;

  // Immediately cancel any active speech recognition or queued synthesis
  if (stopVoiceInputFn) {
    try { stopVoiceInputFn(); } catch (e) { /* ignore */ }
    stopVoiceInputFn = null;
  }
  const micBtn = document.getElementById('voice-input-btn');
  micBtn?.classList.remove('bg-amber-500', 'text-white', 'animate-pulse');
  micBtn?.classList.add('bg-teal-50', 'text-primary');

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }

  // Read current language synchronously at execution time
  const lang = currentLanguage;
  const strings = i18n[lang];

  // Inspect typed input in destination field if modified by user
  const destInput = document.getElementById('destination-input') as HTMLInputElement | null;
  const typedDest = destInput?.value?.trim();
  if (typedDest) {
    const parsed = parseNaturalQuery(typedDest, selectedOriginStop || undefined);
    if (parsed.destination.status === 'matched') {
      selectedDestStop = parsed.destination.stop;
      if (parsed.origin.status === 'matched') {
        selectedOriginStop = parsed.origin.stop;
      }
    } else {
      const stopMatch = findStopByName(typedDest, lang);
      if (stopMatch) {
        selectedDestStop = stopMatch;
      }
    }
  }

  if (!selectedOriginStop || !selectedDestStop) {
    const stops = getAllStops();
    selectedOriginStop = selectedOriginStop || stops[0];
    selectedDestStop = selectedDestStop || stops[4]; // Lulu mall
  }

  // Visible loading state and re-entrancy guard
  const findBtn = document.getElementById('find-bus-btn') as HTMLButtonElement | null;
  const findBtnIcon = document.getElementById('find-bus-btn-icon');
  const findBtnText = document.getElementById('find-bus-btn-text');

  isFindingBus = true;
  if (findBtn) findBtn.disabled = true;
  if (findBtnIcon) {
    findBtnIcon.innerHTML = `<svg class="animate-spin h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
  }
  if (findBtnText) findBtnText.textContent = strings.findingBus;

  try {
    const plans = await Promise.race([
      new Promise<JourneyPlan[]>((resolve) => {
        const res = findJourneys(selectedOriginStop!.id, selectedDestStop!.id);
        resolve(res);
      }),
      new Promise<JourneyPlan[]>((_, reject) =>
        setTimeout(() => reject(new Error('Search timed out. Please try again.')), 4500)
      )
    ]);

    if (plans.length === 0) {
      showToast('Notice', strings.nearestNotice);
      return;
    }

    currentJourneyPlan = plans[0];
    if (currentJourneyPlan.notes) {
      showToast('Notice', currentJourneyPlan.notes[lang] || currentJourneyPlan.notes.en);
    }

    populateDetailsScreen(currentJourneyPlan);
    (window as any).goToScreen('screen-details');
  } catch (err: any) {
    console.error('Error finding bus:', err);
    showToast('Search Error', err?.message || 'Failed to complete route search.');
  } finally {
    isFindingBus = false;
    if (findBtn) findBtn.disabled = false;
    if (findBtnIcon) {
      findBtnIcon.innerHTML = '<span class="material-symbols-outlined text-[22px]">directions_bus</span>';
    }
    if (findBtnText) findBtnText.textContent = i18n[currentLanguage].findBus;
  }
}
(window as any).executeFindBus = executeFindBus;

function populateDetailsScreen(plan: JourneyPlan) {
  const leg = plan.legs[0];
  const strings = i18n[currentLanguage];

  const destTitle = document.getElementById('details-dest-title');
  const boardName = document.getElementById('details-boarding-name');
  const boardLandmark = document.getElementById('details-boarding-landmark');
  const busDeparture = document.getElementById('details-bus-departure');
  const serviceBadge = document.getElementById('details-service-badge');
  const routeNumber = document.getElementById('details-route-number');
  const routeName = document.getElementById('details-route-name');
  const timePill = document.getElementById('details-time-pill');
  const boardHeader = document.getElementById('details-board-header');
  const durationPill = document.getElementById('details-duration-pill');
  const stopsCount = document.getElementById('details-stops-count');
  const fareAmount = document.getElementById('details-fare-amount');
  const fareBreakdown = document.getElementById('details-fare-breakdown');

  // Fallback banner elements
  const fallbackBanner = document.getElementById('details-fallback-banner');
  const fallbackBadgeTitle = document.getElementById('fallback-badge-title');
  const fallbackTag = document.getElementById('fallback-tag');
  const fallbackExplanation = document.getElementById('fallback-explanation-text');
  const detailsDirectLineBadge = document.getElementById('details-direct-line-badge');

  const destName = plan.destination.names[currentLanguage] || plan.destination.names.en;
  const originName = plan.origin.names[currentLanguage] || plan.origin.names.en;

  // Handle fallback nearest stop presentation
  if (plan.type === 'fallback_nearest' && plan.fallbackInfo) {
    const fb = plan.fallbackInfo;
    const targetName = fb.requestedDestination?.names[currentLanguage] || fb.requestedDestination?.names.en || destName;
    const alightName = fb.nearestReachableStop?.names[currentLanguage] || fb.nearestReachableStop?.names.en || destName;
    const distKm = fb.walkDistanceKm || (fb.walkDistanceMeters ? (fb.walkDistanceMeters / 1000).toFixed(1) : '0');
    const dirStr = fb.compassDirection?.[currentLanguage] || fb.compassDirection?.en || '';

    if (fallbackBanner) fallbackBanner.classList.remove('hidden');
    if (fallbackBadgeTitle) fallbackBadgeTitle.textContent = strings.fallbackTitle;
    if (fallbackTag) fallbackTag.textContent = strings.fallbackTag;
    if (fallbackExplanation) {
      fallbackExplanation.textContent = strings.fallbackExplanation(
        originName,
        targetName,
        alightName,
        distKm,
        dirStr,
        leg.routeNumber
      );
    }
    if (detailsDirectLineBadge) detailsDirectLineBadge.textContent = strings.fallbackTag;
  } else {
    if (fallbackBanner) fallbackBanner.classList.add('hidden');
    if (detailsDirectLineBadge) detailsDirectLineBadge.textContent = strings.directLine;
  }

  if (destTitle) destTitle.textContent = destName;
  if (boardName) boardName.textContent = originName;
  if (boardLandmark) boardLandmark.textContent = plan.origin.landmarkHint?.[currentLanguage] || plan.origin.landmarkHint?.en || strings.boardingPoint;
  if (busDeparture) busDeparture.textContent = `${strings.recommendedBus} • ${strings.departsInMins(6)}`;
  if (serviceBadge) serviceBadge.textContent = serviceTypes[currentLanguage][leg.serviceType] || leg.serviceType;
  if (routeNumber) routeNumber.textContent = ksrtcRouteLabel[currentLanguage](leg.routeNumber);
  if (routeName) routeName.textContent = leg.routeName;
  if (timePill) timePill.textContent = plan.departureTime;
  if (boardHeader) boardHeader.textContent = strings.towardsVia(destName, leg.routeNumber);
  if (durationPill) durationPill.textContent = strings.rideDuration(plan.totalDurationMins);
  if (stopsCount) stopsCount.textContent = strings.intermediateStops(leg.intermediateStops.length + 1);
  if (fareAmount) fareAmount.textContent = `₹${plan.totalFare.amount}.00`;
  if (fareBreakdown) {
    fareBreakdown.textContent = strings.fareBreakdown(plan.totalFare.baseFare, plan.totalFare.stageFare);
  }

  // Render schematic nodes
  const schematicContainer = document.getElementById('schematic-nodes-container');
  if (schematicContainer) {
    const allStopNodes = [plan.origin, ...leg.intermediateStops.slice(0, 2), plan.destination];
    schematicContainer.innerHTML = `
      <div class="absolute left-4 right-4 top-4 h-1 bg-slate-200 dark:bg-slate-700 -z-0"></div>
      <div class="absolute left-4 right-1/3 top-4 h-1 bg-primary -z-0"></div>
      ${allStopNodes.map((node, i) => {
      const isFirst = i === 0;
      const isLast = i === allStopNodes.length - 1;
      const nodeLabel = isFirst ? strings.boardNode : isLast ? strings.alightNode : strings.stopNode;
      return `
          <div class="flex flex-col items-center z-10 text-center w-1/4">
            <div class="w-6 h-6 rounded-full ${isFirst ? 'bg-primary text-white' : isLast ? 'bg-amber-600 text-white' : 'bg-primary text-white'} flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[12px]">${isFirst ? 'departure_board' : isLast ? 'pin_drop' : 'circle'}</span>
            </div>
            <span class="text-[10px] font-bold text-on-surface mt-1 truncate max-w-[70px]">${escapeHtml(node.names[currentLanguage] || node.names.en)}</span>
            <span class="text-[9px] ${isFirst ? 'text-primary font-bold' : isLast ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}">${nodeLabel}</span>
          </div>
        `;
    }).join('')}
    `;
  }
}

/**
 * Speak Route Details
 * FIX: If fallback plan, announce nearest reachable stop, remaining walking/transfer distance, and compass direction!
 * For standard direct routes, synthesize dynamically with the exact selected place and calculated fare.
 */
(window as any).speakRouteDetails = () => {
  if (!currentJourneyPlan) return;
  const leg = currentJourneyPlan.legs[0];
  const originName = currentJourneyPlan.origin.names[currentLanguage] || currentJourneyPlan.origin.names.en;
  const destName = currentJourneyPlan.destination.names[currentLanguage] || currentJourneyPlan.destination.names.en;
  const strings = i18n[currentLanguage];

  if (currentJourneyPlan.type === 'fallback_nearest' && currentJourneyPlan.fallbackInfo) {
    const fb = currentJourneyPlan.fallbackInfo;
    const targetName = fb.requestedDestination?.names[currentLanguage] || fb.requestedDestination?.names.en || destName;
    const alightName = fb.nearestReachableStop?.names[currentLanguage] || fb.nearestReachableStop?.names.en || destName;
    const distKm = fb.walkDistanceKm || (fb.walkDistanceMeters ? (fb.walkDistanceMeters / 1000).toFixed(1) : '0');
    const dirStr = fb.compassDirection?.[currentLanguage] || fb.compassDirection?.en || '';

    const phrase = strings.fallbackSpoken(
      originName,
      targetName,
      alightName,
      distKm,
      dirStr,
      leg.routeNumber,
      currentJourneyPlan.totalFare.amount
    );
    showToast('Voice Audio', phrase);
    speakText(phrase, currentLanguage, 1.0, {
      onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
    });
    return;
  }

  let phrase = `Please take bus Route ${leg.routeNumber} from ${originName} towards ${destName}. Estimated fare is ${currentJourneyPlan.totalFare.amount} rupees.`;
  if (currentLanguage === 'ml') {
    phrase = `${originName}ൽ നിന്ന് ${destName}ലേക്ക് റൂട്ട് ${leg.routeNumber} ബസ് കയറുക. പ്രതീക്ഷിക്കുന്ന നിരക്ക് ${currentJourneyPlan.totalFare.amount} രൂപ.`;
  } else if (currentLanguage === 'ta') {
    phrase = `${originName} முதல் ${destName} வரை செல்லும் பேருந்து ${leg.routeNumber} இல் செல்லவும். கட்டணம் ${currentJourneyPlan.totalFare.amount} ரூபாய்.`;
  } else if (currentLanguage === 'hi') {
    phrase = `${originName} से ${destName} के लिए बस रूट ${leg.routeNumber} लें। अनुमानित किराया ${currentJourneyPlan.totalFare.amount} रुपये है।`;
  }

  const isDefaultDemoRoute =
    currentJourneyPlan.origin.id === 'ST_MAHARAJAS' &&
    currentJourneyPlan.destination.id === 'ST_EDAPPALLY' &&
    leg.routeNumber === '12A' &&
    currentJourneyPlan.totalFare.amount === 22;

  showToast('Voice Audio', phrase);
  speakText(phrase, currentLanguage, 1.0, {
    phraseKey: isDefaultDemoRoute ? `${currentLanguage}_route_details` : undefined,
    onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
  });
};

/**
 * Screen 3: Start Live Journey
 */
(window as any).startLiveJourneyFromDetails = () => {
  if (!currentJourneyPlan) return;
  const leg = currentJourneyPlan.legs[0];
  const destName = currentJourneyPlan.destination.names[currentLanguage] || currentJourneyPlan.destination.names.en;
  const trackRouteBadge = document.getElementById('track-route-badge');
  const trackDestBadge = document.getElementById('track-dest-badge');
  const trackServicePill = document.getElementById('track-service-pill');

  if (trackRouteBadge) trackRouteBadge.textContent = ksrtcRouteLabel[currentLanguage](leg.routeNumber);
  if (trackDestBadge) {
    trackDestBadge.textContent = currentLanguage === 'ml'
      ? `${destName} ലേക്ക്`
      : currentLanguage === 'ta'
        ? `${destName} நோக்கி`
        : currentLanguage === 'hi'
          ? `${destName} की ओर`
          : `To ${destName}`;
  }
  if (trackServicePill) trackServicePill.textContent = serviceTypes[currentLanguage][leg.serviceType] || leg.serviceType;
  (window as any).goToScreen('screen-tracking');
};

(window as any).saveCurrentJourneyPass = () => {
  if (!currentJourneyPlan) return;
  saveJourneyCard(currentJourneyPlan);
  const passBtnText = document.getElementById('save-pass-text');
  if (passBtnText) {
    passBtnText.textContent = i18n[currentLanguage].passSaved;
    setTimeout(() => {
      passBtnText.textContent = i18n[currentLanguage].savePass;
    }, 2500);
  }
};

/**
 * Screen 4: Live Journey Tracking & Real-Time Road-Snapped Leaflet Map
 */
async function initLiveLeafletMap() {
  const mapContainer = document.getElementById('live-leaflet-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  if (!currentJourneyPlan) return;

  const leg = currentJourneyPlan.legs[0];
  const stops = [currentJourneyPlan.origin, ...leg.intermediateStops, currentJourneyPlan.destination];

  // Fetch actual road-snapped geometry
  activeRoadCoordinates = await getRoadSnappedPolyline(stops);

  // Initialize Journey Tracker with road coordinates
  tracker = new JourneyTracker(currentJourneyPlan, activeRoadCoordinates);

  const routeBadge = document.getElementById('track-route-badge');
  const destBadge = document.getElementById('track-dest-badge');
  if (routeBadge) routeBadge.textContent = `KSRTC Route ${leg.routeNumber}`;
  if (destBadge) destBadge.textContent = `To ${currentJourneyPlan.destination.names[currentLanguage] || currentJourneyPlan.destination.names.en}`;

  // Center on start of route
  const startCoord = activeRoadCoordinates[0];

  leafletMap = L.map('live-leaflet-map', {
    center: startCoord,
    zoom: 14,
    zoomControl: false,
    attributionControl: false
  });

  // OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true
  }).addTo(leafletMap);

  // Draw Exact Road Polyline (Emerald Teal)
  routePolyline = L.polyline(activeRoadCoordinates, {
    color: '#005c55',
    weight: 6,
    opacity: 0.9,
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(leafletMap);

  // Inner highlight glow for road tracing
  L.polyline(activeRoadCoordinates, {
    color: '#80d5cb',
    weight: 2.5,
    opacity: 0.8
  }).addTo(leafletMap);

  // Fit bounds to the route
  leafletMap.fitBounds(routePolyline.getBounds(), { padding: [25, 25] });

  // Add Stop Pins on Map
  stopMarkers = [];
  stops.forEach((stop, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === stops.length - 1;

    const iconHtml = isLast
      ? `<div style="background:#ba1a1a; width:26px; height:26px; border-radius:50%; border:3px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:white; font-size:13px; font-weight:bold;">★</div>`
      : `<div style="background:#0f766e; width:16px; height:16px; border-radius:50%; border:2.5px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.25);"></div>`;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'custom-stop-icon',
      iconSize: isLast ? [26, 26] : [16, 16],
      iconAnchor: isLast ? [13, 13] : [8, 8]
    });

    const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(leafletMap);
    const safeStopTitle = escapeHtml(stop.names[currentLanguage] || stop.names.en);
    const safeStopHint = escapeHtml(stop.landmarkHint?.[currentLanguage] || stop.landmarkHint?.en || 'Bus Stop');
    marker.bindPopup(`<b>${safeStopTitle}</b><br><small>${safeStopHint}</small>`);
    stopMarkers.push(marker);
  });

  // Add Live Animated Bus Marker
  const busIcon = L.divIcon({
    html: `<div style="background:#005c55; width:34px; height:34px; border-radius:50%; border:3px solid white; box-shadow:0 0 16px rgba(0,92,85,0.9); display:flex; align-items:center; justify-content:center; color:white; font-size:16px;" class="animate-bounce">🚍</div>`,
    className: 'live-bus-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  simIndex = 0;
  busMarker = L.marker(startCoord, { icon: busIcon }).addTo(leafletMap);

  // Compute and show initial distance & ETA HUD metrics
  const initialResult = tracker.updatePosition(startCoord[0], startCoord[1], 0);
  handleGpsUpdate(initialResult);

  // Announce journey start
  const startMsg = currentLanguage === 'ml'
    ? `റൂട്ട് ${leg.routeNumber} ലേക്ക് യാത്ര ആരംഭിച്ചു. ലൈവ് ട്രാക്കിംഗ് സജീവമാണ്.`
    : currentLanguage === 'ta'
      ? `பேருந்து ${leg.routeNumber} இல் பயணம் தொடங்கியது. லைவ் டிராக்கிங் செயலில் உள்ளது.`
      : currentLanguage === 'hi'
        ? `रूट ${leg.routeNumber} पर यात्रा शुरू हो गई है। लाइव ट्रैकिंग सक्रिय है।`
        : `Journey started on Route ${leg.routeNumber}. Live GPS tracking is active.`;

  showToast('Trip Started', startMsg);
  const isDefaultDemoStart = leg.routeNumber === '12A';
  speakText(startMsg, currentLanguage, 1.0, {
    phraseKey: isDefaultDemoStart ? `${currentLanguage}_journey_start` : undefined,
    onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
  });

  // Start continuous 1-second GPS tracking
  startContinuousGpsLoop();
}

/**
 * 1-Second GPS Tracker Loop
 */
function startContinuousGpsLoop() {
  if (stopGpsWatchFn) stopGpsWatchFn();

  if (tracker) {
    stopGpsWatchFn = tracker.startLiveGpsTracking(
      (result) => {
        handleGpsUpdate(result);
      },
      () => {
        // Fallback or permission notice
      }
    );
  }
}

function handleGpsUpdate(result: ReturnType<JourneyTracker['updatePosition']>) {
  const dest = currentJourneyPlan?.destination;
  if (!dest) return;

  const hudNext = document.getElementById('hud-next-stop-name');
  const hudEta = document.getElementById('hud-eta-text');
  const hudDist = document.getElementById('hud-dist-text');
  const speedText = document.getElementById('map-speed-text');

  if (hudNext) hudNext.textContent = dest.names[currentLanguage] || dest.names.en;

  const etaMins = Math.floor(result.progress.etaSecondsToNextStop / 60);
  const etaSecs = result.progress.etaSecondsToNextStop % 60;
  if (hudEta) {
    hudEta.textContent = etaMins > 0 ? `~${etaMins}m ${etaSecs}s` : `~${etaSecs}s`;
  }

  if (hudDist) {
    hudDist.textContent = result.progress.distanceToNextStopMeters > 1000
      ? `${(result.progress.distanceToNextStopMeters / 1000).toFixed(1)} km`
      : `${result.progress.distanceToNextStopMeters} m`;
  }

  if (speedText) {
    speedText.textContent = i18n[currentLanguage].speedGps(result.progress.speedKmh);
  }

  // Update Bus Marker Position on Map
  if (busMarker && leafletMap) {
    busMarker.setLatLng(result.snappedCoord);
  }

  // Trigger 30-second arrival alarm if threshold reached
  if (result.shouldAlert && result.approachingStop) {
    triggerArrivalNotification(result.approachingStop, currentLanguage, (msg) => {
      showToast('Arrival Alert', msg);
    });

    const stopName = result.approachingStop.names[currentLanguage] || result.approachingStop.names.en;
    const alertSubtext = document.getElementById('alert-stop-subtext');
    const alertStopHeading = document.getElementById('alert-stop-heading');
    if (alertStopHeading) alertStopHeading.textContent = stopName;
    if (alertSubtext) alertSubtext.textContent = i18n[currentLanguage].alightReadyDesc(stopName);

    const announcement = currentLanguage === 'ml'
      ? `ശ്രദ്ധിക്കുക. നിങ്ങളുടെ സ്റ്റോപ്പ് ${stopName} 30 സെക്കൻഡിൽ എത്തും. ഇറങ്ങാൻ തയ്യാറാകുക.`
      : currentLanguage === 'ta'
        ? `கவனிக்கவும். உங்கள் நிறுத்தம் ${stopName} 30 வினாடிகளில் வரவுள்ளது.`
        : currentLanguage === 'hi'
          ? `ध्यान दें। आपका स्टॉप ${stopName} 30 सेकंड में आने वाला है।`
          : `Attention. Your stop ${stopName} is approaching in 30 seconds. Please get ready to alight.`;

    const isDefaultDemoAlert = result.approachingStop.id === 'ST_EDAPPALLY';
    speakText(announcement, currentLanguage, 1.0, {
      phraseKey: isDefaultDemoAlert ? `${currentLanguage}_stop_alert` : undefined,
      onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
    });
  }
}

/**
 * Continuous Smooth Road Driving Simulation (Moves bus tick-by-tick every second)
 */
(window as any).simulateNextProgress = () => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
    showToast('Simulation Paused', 'Tap Next Stop to resume road driving simulation.');
    return;
  }

  if (!tracker || !activeRoadCoordinates || activeRoadCoordinates.length === 0) return;

  showToast('Live GPS Simulation', 'Driving along route curves tick-by-tick every second.');

  simInterval = setInterval(() => {
    if (simIndex >= activeRoadCoordinates.length - 1) {
      clearInterval(simInterval);
      simInterval = null;
      (window as any).finishTripAction();
      return;
    }

    simIndex++;
    const point = activeRoadCoordinates[simIndex];
    const simulatedSpeedMps = simIndex >= activeRoadCoordinates.length - 3 ? 4.5 : 8.8;

    const result = tracker!.updatePosition(point[0], point[1], simulatedSpeedMps);
    handleGpsUpdate(result);

    // Pan map along with the moving bus
    if (leafletMap && busMarker) {
      leafletMap.panTo(point, { animate: true, duration: 0.8 });
    }
  }, 1000); // 1-second tick updates!
};

(window as any).triggerAlertSpeech = (type: 'repeat' | 'slower') => {
  if (type === 'slower') {
    speakSlower();
    showToast('Voice Rate', 'Playing slower announcement...');
  } else {
    repeatLastSpoken();
    showToast('Voice Repeat', 'Repeating stop announcement...');
  }
};

(window as any).finishTripAction = () => {
  const btn = document.getElementById('trip-finish-btn');
  const banner = document.getElementById('trip-complete-banner');
  if (btn) {
    btn.classList.add('opacity-60', 'pointer-events-none');
    btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">check</span> ${i18n[currentLanguage].tripFinishedDone}`;
  }
  if (banner) {
    banner.textContent = i18n[currentLanguage].tripCompleteBanner;
    banner.classList.remove('hidden');
  }

  const finishMsg = currentLanguage === 'ml'
    ? 'നിങ്ങൾ സുരക്ഷിതമായി ലക്ഷ്യസ്ഥാനത്ത് എത്തിച്ചേർന്നു. നന്ദി.'
    : currentLanguage === 'ta'
      ? 'நீங்கள் பாதுகாப்பாக வந்தடைந்தீர்கள். நன்றி.'
      : currentLanguage === 'hi'
        ? 'आप सुरक्षित रूप से पहुंच गए हैं। धन्यवाद।'
        : 'You have arrived safely. Thank you for riding with us.';

  speakText(finishMsg, currentLanguage, 1.0, {
    phraseKey: `${currentLanguage}_trip_finished`,
    onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
  });
};

/**
 * Toast Helper
 */
function showToast(title: string, desc: string) {
  const toast = document.getElementById('inapp-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastDesc = document.getElementById('toast-desc');

  if (toast && toastTitle && toastDesc) {
    toastTitle.textContent = title;
    toastDesc.textContent = desc;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3800);
  }
}

/**
 * Layout Toggle: Mobile View vs Full Laptop View
 */
(window as any).setAppLayout = (layout: 'mobile' | 'desktop') => {
  const phoneContainer = document.getElementById('phone-container');
  const btnMobile = document.getElementById('btn-view-mobile');
  const btnDesktop = document.getElementById('btn-view-desktop');

  if (layout === 'desktop') {
    phoneContainer?.classList.remove('md:max-w-[420px]', 'md:rounded-[40px]', 'md:border-[8px]');
    phoneContainer?.classList.add('md:max-w-[1080px]', 'md:rounded-3xl', 'md:border-2');

    btnDesktop?.classList.add('bg-teal-600', 'text-white');
    btnDesktop?.classList.remove('text-slate-300');
    btnMobile?.classList.remove('bg-teal-600', 'text-white');
    btnMobile?.classList.add('text-slate-300');
  } else {
    phoneContainer?.classList.add('md:max-w-[420px]', 'md:rounded-[40px]', 'md:border-[8px]');
    phoneContainer?.classList.remove('md:max-w-[1080px]', 'md:rounded-3xl', 'md:border-2');

    btnMobile?.classList.add('bg-teal-600', 'text-white');
    btnMobile?.classList.remove('text-slate-300');
    btnDesktop?.classList.remove('bg-teal-600', 'text-white');
    btnDesktop?.classList.add('text-slate-300');
  }

  if (leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 300);
  }
};
