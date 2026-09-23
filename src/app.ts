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
    greeting: 'Good morning!',
    whereTo: 'Where do you want to go?',
    whereToSub: 'Enter stop or destination',
    findBus: 'Find My Bus',
    popularStops: 'Popular Bus Stops',
    continue: 'Continue',
    boarding: 'Boarding Point',
    recommended: 'Recommended Bus',
    estimatedFare: 'Estimated Fare',
    startJourney: 'Start Journey',
    savePass: 'Save Offline Bus Pass',
    passSaved: 'Pass Cached Offline ✓',
    alightingAlert: 'Alighting Alert • Stop Approaching',
    alightingSub: 'Your bus stop is ~30 seconds away. Please get ready to alight.',
    destSelection: 'Destination Selection',
    busDetails: 'Bus Details & Fare',
    journeyProgress: 'Bus Journey in Progress',
    gpsActive: 'GPS Active',
    offlineReady: '100% Offline Ready',
    repeatAudio: 'Repeat Audio',
    speakSlower: 'Speak Slower',
    nextStop: 'Next Stop',
    nearestNotice: 'Showing closest direct stop to destination.'
  },
  ml: {
    greeting: 'സുപ്രഭാതം!',
    whereTo: 'എങ്ങോട്ടാണ് പോകേണ്ടത്?',
    whereToSub: 'ബസ് സ്റ്റോപ്പ് അല്ലെങ്കിൽ സ്ഥലം നൽകുക',
    findBus: 'ബസ് കണ്ടെത്തുക',
    popularStops: 'പ്രധാന സ്റ്റോപ്പുകൾ',
    continue: 'തുടരുക',
    boarding: 'കയറേണ്ട സ്റ്റോപ്പ്',
    recommended: 'നിർദ്ദേശിക്കുന്ന ബസ്',
    estimatedFare: 'പ്രതീക്ഷിക്കുന്ന നിരക്ക്',
    startJourney: 'യാത്ര ആരംഭിക്കുക',
    savePass: 'ഓഫ്‌ലൈൻ പാസ് സേവ് ചെയ്യുക',
    passSaved: 'പാസ് സേവ് ചെയ്തു ✓',
    alightingAlert: 'സ്റ്റോപ്പ് ഉടൻ എത്തും',
    alightingSub: 'ബസ് സ്റ്റോപ്പ് 30 സെക്കൻഡിൽ എത്തും. ഇറങ്ങാൻ തയ്യാറാകുക.',
    destSelection: 'ലക്ഷ്യസ്ഥാനം തിരഞ്ഞെടുക്കുക',
    busDetails: 'ബസ് വിവരങ്ങളും നിരക്കും',
    journeyProgress: 'യാത്ര പുരോഗമിക്കുന്നു',
    gpsActive: 'ജിപിഎസ് സജീവം',
    offlineReady: 'ഓഫ്‌ലൈൻ തയ്യാറാണ്',
    repeatAudio: 'ശബ്ദം വീണ്ടും കേൾക്കുക',
    speakSlower: 'പതുക്കെ കേൾക്കുക',
    nextStop: 'അടുത്ത സ്റ്റോപ്പ്',
    nearestNotice: 'ലക്ഷ്യസ്ഥാനത്തേക്ക് ഏറ്റവും അടുത്തുള്ള സ്റ്റോപ്പ് കാണിക്കുന്നു.'
  },
  ta: {
    greeting: 'காலை வணக்கம்!',
    whereTo: 'எங்கு செல்ல வேண்டும்?',
    whereToSub: 'பேருந்து நிறுத்தம் உள்ளிடவும்',
    findBus: 'பேருந்தை கண்டறியவும்',
    popularStops: 'முக்கிய நிறுத்தங்கள்',
    continue: 'தொடரவும்',
    boarding: 'ஏறும் இடம்',
    recommended: 'பரிந்துரைக்கப்பட்ட பேருந்து',
    estimatedFare: 'மதிப்பிடப்பட்ட கட்டணம்',
    startJourney: 'பயணத்தை தொடங்குங்கள்',
    savePass: 'ஆஃப்லைன் பாஸ் சேமிக்கவும்',
    passSaved: 'பாஸ் சேமிக்கப்பட்டது ✓',
    alightingAlert: 'இறங்கும் நேரம் நெருங்குகிறது',
    alightingSub: 'பேருந்து நிறுத்தம் 30 வினாடிகளில் வரவுள்ளது.',
    destSelection: 'இடத்தை தேர்வு செய்யவும்',
    busDetails: 'பேருந்து விவரங்கள் மற்றும் கட்டணம்',
    journeyProgress: 'பயணம் தொடர்கிறது',
    gpsActive: 'ஜிபிஎஸ் செயலில் உள்ளது',
    offlineReady: 'ஆஃப்லைன் தயார்',
    repeatAudio: 'மீண்டும் கேட்கவும்',
    speakSlower: 'மெதுவாக கேட்கவும்',
    nextStop: 'அடுத்த நிறுத்தம்',
    nearestNotice: 'இலக்குக்கு அருகிலுள்ள பேருந்து நிறுத்தம் காட்டப்படுகிறது.'
  },
  hi: {
    greeting: 'शुभ प्रभात!',
    whereTo: 'आप कहाँ जाना चाहते हैं?',
    whereToSub: 'बस स्टॉप या गंतव्य दर्ज करें',
    findBus: 'मेरी बस खोजें',
    popularStops: 'प्रमुख बस स्टॉप',
    continue: 'आगे बढ़ें',
    boarding: 'बोर्डिंग पॉइंट',
    recommended: 'सुझाई गई बस',
    estimatedFare: 'अनुमानित किराया',
    startJourney: 'यात्रा शुरू करें',
    savePass: 'ऑफ़लाइन पास सहेजें',
    passSaved: 'पास सुरक्षित हो गया ✓',
    alightingAlert: 'उतरने का समय आ रहा है',
    alightingSub: 'आपका बस स्टॉप 30 सेकंड में आने वाला है।',
    destSelection: 'गंतव्य चुनें',
    busDetails: 'बस विवरण और किराया',
    journeyProgress: 'यात्रा जारी है',
    gpsActive: 'जीपीएस सक्रिय है',
    offlineReady: 'ऑफ़लाइन तैयार',
    repeatAudio: 'पुनः सुनें',
    speakSlower: 'धीमी गति से सुनें',
    nextStop: 'अगला स्टॉप',
    nearestNotice: 'गंतव्य के सबसे नजदीकी स्टॉप दिखाया जा रहा है।'
  }
};

// Spoken greetings in each language
const languageGreetings: Record<SupportedLanguage, string> = {
  en: 'Welcome to Wiyo Journeys. Where would you like to travel today?',
  ml: 'നമസ്കാരം! വയ്യോ ജേർണീസിലേക്ക് സ്വാഗതം. എങ്ങോട്ടാണ് യാത്ര?',
  ta: 'வணக்கம்! வியோ ஜர்னீஸுக்கு வரவேற்கிறோம். எங்கு செல்ல வேண்டும்?',
  hi: 'नमस्ते! वियो जर्नीज़ में आपका स्वागत है। आप कहाँ जाना चाहते हैं?'
};

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', async () => {
  const status = initAssistant();
  const statusEl = document.getElementById('system-status-text');
  if (statusEl) {
    statusEl.textContent = status.tier === 'full-online' ? 'Online • Official MVD Fares' : '100% Offline Ready';
  }

  // Set default origin to Maharajas Ground / Ernakulam South
  const stops = getAllStops();
  selectedOriginStop = stops.find((s) => s.id === 'ST_MAHARAJAS') || stops[0];
  selectedDestStop = stops.find((s) => s.id === 'ST_EDAPPALLY') || stops[1];

  renderPopularStops();
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

  const continueText = document.getElementById('lang-continue-text');
  if (continueText) {
    continueText.textContent = i18n[lang].continue;
  }

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
  const greetingEl = document.getElementById('greeting-text');
  const whereTitle = document.getElementById('where-to-go-title');
  const whereSub = document.getElementById('where-to-go-sub');
  const findBtn = document.getElementById('find-bus-btn-text');
  const resultsTitle = document.getElementById('results-header-title');

  if (greetingEl) greetingEl.textContent = strings.greeting;
  if (whereTitle) whereTitle.textContent = strings.whereTo;
  if (whereSub) whereSub.textContent = strings.whereToSub;
  if (findBtn) findBtn.textContent = strings.findBus;
  if (resultsTitle) resultsTitle.textContent = strings.popularStops;

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
    if (distEl) distEl.textContent = `${nearest.distanceMeters}m walk from you`;
    if (hintEl && nearest.stop.landmarkHint) {
      hintEl.textContent = `${nearest.stop.landmarkHint[currentLanguage] || nearest.stop.landmarkHint.en}. Auto-matched from location.`;
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
    card.className = 'w-full text-left bg-white hover:bg-surface-container-low active:scale-[0.99] p-3 rounded-xl shadow-xs border border-outline-variant/30 flex items-center justify-between transition-all';
    card.onclick = () => {
      selectDestinationStop(stop);
    };

    const safeLocalName = escapeHtml(stop.names[currentLanguage] || stop.names.en);
    const safeEnName = escapeHtml(stop.names.en);
    const safeDistrict = escapeHtml(stop.district || 'Kerala');

    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-teal-50 text-primary flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[20px]">directions_bus</span>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-bold text-sm text-on-surface truncate">${safeLocalName}</span>
          <span class="text-xs text-on-surface-variant truncate">${safeEnName} • ${safeDistrict}</span>
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
      noMatch.className = 'p-4 bg-slate-50 text-center rounded-xl text-xs text-slate-500';
      noMatch.textContent = `No matching bus stop found for "${query}". Try searching in English, Malayalam, Tamil, or Hindi.`;
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
  showToast('Listening...', `Listening in ${currentLanguage.toUpperCase()}... Speak stop or say "repeat" / "slower"`);

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

/**
 * Execute Route Lookup & populate Screen 3
 */
function executeFindBus() {
  if (!selectedOriginStop || !selectedDestStop) {
    const stops = getAllStops();
    selectedOriginStop = selectedOriginStop || stops[0];
    selectedDestStop = selectedDestStop || stops[4]; // Lulu mall
  }

  const plans = findJourneys(selectedOriginStop.id, selectedDestStop.id);
  if (plans.length === 0) {
    showToast('Notice', i18n[currentLanguage].nearestNotice);
    return;
  }

  currentJourneyPlan = plans[0];
  if (currentJourneyPlan.notes) {
    showToast('Notice', currentJourneyPlan.notes[currentLanguage] || currentJourneyPlan.notes.en);
  }

  populateDetailsScreen(currentJourneyPlan);
  (window as any).goToScreen('screen-details');
}
(window as any).executeFindBus = executeFindBus;

function populateDetailsScreen(plan: JourneyPlan) {
  const leg = plan.legs[0];

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

  if (destTitle) destTitle.textContent = plan.destination.names[currentLanguage] || plan.destination.names.en;
  if (boardName) boardName.textContent = plan.origin.names[currentLanguage] || plan.origin.names.en;
  if (boardLandmark) boardLandmark.textContent = plan.origin.landmarkHint?.[currentLanguage] || plan.origin.landmarkHint?.en || 'Boarding platform';
  if (busDeparture) busDeparture.textContent = `${i18n[currentLanguage].recommended} • Departs in 6 mins`;
  if (serviceBadge) serviceBadge.textContent = leg.serviceType;
  if (routeNumber) routeNumber.textContent = `KSRTC ${leg.routeNumber}`;
  if (routeName) routeName.textContent = leg.routeName;
  if (timePill) timePill.textContent = plan.departureTime;
  if (boardHeader) boardHeader.textContent = leg.busBoardHeader[currentLanguage] || leg.busBoardHeader.en;
  if (durationPill) durationPill.textContent = `~${plan.totalDurationMins} mins`;
  if (stopsCount) stopsCount.textContent = `${leg.intermediateStops.length + 1} intermediate stops`;
  if (fareAmount) fareAmount.textContent = `₹${plan.totalFare.amount}.00`;
  if (fareBreakdown) {
    fareBreakdown.textContent = `Base fare: ₹${plan.totalFare.baseFare}.00 • Distance stages: ₹${plan.totalFare.stageFare}.00`;
  }

  // Render schematic nodes
  const schematicContainer = document.getElementById('schematic-nodes-container');
  if (schematicContainer) {
    const allStopNodes = [plan.origin, ...leg.intermediateStops.slice(0, 2), plan.destination];
    schematicContainer.innerHTML = `
      <div class="absolute left-4 right-4 top-4 h-1 bg-slate-200 -z-0"></div>
      <div class="absolute left-4 right-1/3 top-4 h-1 bg-primary -z-0"></div>
      ${allStopNodes.map((node, i) => {
      const isFirst = i === 0;
      const isLast = i === allStopNodes.length - 1;
      return `
          <div class="flex flex-col items-center z-10 text-center w-1/4">
            <div class="w-6 h-6 rounded-full ${isFirst ? 'bg-primary text-white' : isLast ? 'bg-amber-600 text-white' : 'bg-primary text-white'} flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[12px]">${isFirst ? 'departure_board' : isLast ? 'pin_drop' : 'circle'}</span>
            </div>
            <span class="text-[10px] font-bold text-on-surface mt-1 truncate max-w-[70px]">${escapeHtml(node.names[currentLanguage] || node.names.en)}</span>
            <span class="text-[9px] ${isFirst ? 'text-primary font-bold' : isLast ? 'text-amber-700 font-bold' : 'text-slate-400'}">${isFirst ? '(Board)' : isLast ? '(Alight)' : 'Stop'}</span>
          </div>
        `;
    }).join('')}
    `;
  }
}

/**
 * Speak Route Details
 */
(window as any).speakRouteDetails = () => {
  if (!currentJourneyPlan) return;
  const leg = currentJourneyPlan.legs[0];
  const originName = currentJourneyPlan.origin.names[currentLanguage] || currentJourneyPlan.origin.names.en;
  const destName = currentJourneyPlan.destination.names[currentLanguage] || currentJourneyPlan.destination.names.en;

  let phrase = `Please take bus Route ${leg.routeNumber} from ${originName} towards ${destName}. Estimated fare is ${currentJourneyPlan.totalFare.amount} rupees.`;
  if (currentLanguage === 'ml') {
    phrase = `${originName}ൽ നിന്ന് ${destName} ലേക്ക് റൂട്ട് ${leg.routeNumber} ബസ് കയറുക. പ്രതീക്ഷിക്കുന്ന നിരക്ക് ${currentJourneyPlan.totalFare.amount} രൂപ.`;
  } else if (currentLanguage === 'ta') {
    phrase = `${originName} முதல் ${destName} வரை செல்லும் பேருந்து ${leg.routeNumber} இல் செல்லவும். கட்டணம் ${currentJourneyPlan.totalFare.amount} ரூபாய்.`;
  } else if (currentLanguage === 'hi') {
    phrase = `${originName} से ${destName} के लिए बस रूट ${leg.routeNumber} लें। अनुमानित किराया ${currentJourneyPlan.totalFare.amount} रुपये है।`;
  }

  showToast('Voice Audio', phrase);
  speakText(phrase, currentLanguage, 1.0, {
    phraseKey: `${currentLanguage}_route_details`,
    onError: (err) => showToast('Voice Notice', typeof err === 'string' ? err : 'Speech playback error')
  });
};

/**
 * Screen 3: Start Live Journey
 */
(window as any).startLiveJourneyFromDetails = () => {
  if (!currentJourneyPlan) return;
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
  speakText(startMsg, currentLanguage, 1.0, {
    phraseKey: `${currentLanguage}_journey_start`,
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
    speedText.textContent = `${result.progress.speedKmh} km/h • GPS Active`;
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
    const announcement = currentLanguage === 'ml'
      ? `ശ്രദ്ധിക്കുക. നിങ്ങളുടെ സ്റ്റോപ്പ് ${stopName} 30 സെക്കൻഡിൽ എത്തും. ഇറങ്ങാൻ തയ്യാറാകുക.`
      : currentLanguage === 'ta'
        ? `கவனிக்கவும். உங்கள் நிறுத்தம் ${stopName} 30 வினாடிகளில் வரவுள்ளது.`
        : currentLanguage === 'hi'
          ? `ध्यान दें। आपका स्टॉप ${stopName} 30 सेकंड में आने वाला है।`
          : `Attention. Your stop ${stopName} is approaching in 30 seconds. Please get ready to alight.`;

    speakText(announcement, currentLanguage, 1.0, {
      phraseKey: `${currentLanguage}_stop_alert`,
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
    btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">check</span> Trip Finished';
  }
  if (banner) banner.classList.remove('hidden');

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
