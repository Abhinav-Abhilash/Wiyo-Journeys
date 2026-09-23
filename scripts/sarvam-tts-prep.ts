import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'sk_essjckqv_dhNR0boGxQvK69QQFxA1j5h0';
const SARVAM_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';

export interface PhraseEntry {
  key: string;
  lang: 'en-IN' | 'ml-IN' | 'ta-IN' | 'hi-IN';
  text: string;
}

export const ESSENTIAL_PHRASES: PhraseEntry[] = [
  // English (en)
  { key: 'en_welcome', lang: 'en-IN', text: 'Welcome to Wiyo Journeys. Where would you like to travel today?' },
  { key: 'en_route_details', lang: 'en-IN', text: 'Please take bus Route 12A from Maharajas Ground towards Edappally Toll. Estimated fare is 22 rupees.' },
  { key: 'en_journey_start', lang: 'en-IN', text: 'Journey started on Route 12A. Live GPS tracking is active.' },
  { key: 'en_stop_alert', lang: 'en-IN', text: 'Attention. Your stop Edappally Toll is approaching in 30 seconds. Please get ready to alight.' },
  { key: 'en_trip_finished', lang: 'en-IN', text: 'You have arrived safely. Thank you for riding with us.' },

  // Malayalam (ml)
  { key: 'ml_welcome', lang: 'ml-IN', text: 'നമസ്കാരം! വയ്യോ ജേർണീസിലേക്ക് സ്വാഗതം. എങ്ങോട്ടാണ് യാത്ര?' },
  { key: 'ml_route_details', lang: 'ml-IN', text: 'മഹാരാജാസ് ഗ്രൗണ്ട്ൽ നിന്ന് ഇടപ്പള്ളി ടോൾ ലേക്ക് റൂട്ട് 12A ബസ് കയറുക. പ്രതീക്ഷിക്കുന്ന നിരക്ക് 22 രൂപ.' },
  { key: 'ml_journey_start', lang: 'ml-IN', text: 'റൂട്ട് 12A ലേക്ക് യാത്ര ആരംഭിച്ചു. ലൈവ് ട്രാക്കിംഗ് സജീവമാണ്.' },
  { key: 'ml_stop_alert', lang: 'ml-IN', text: 'ശ്രദ്ധിക്കുക. നിങ്ങളുടെ സ്റ്റോപ്പ് ഇടപ്പള്ളി ടോൾ 30 സെക്കൻഡിൽ എത്തും. ഇറങ്ങാൻ തയ്യാറാകുക.' },
  { key: 'ml_trip_finished', lang: 'ml-IN', text: 'നിങ്ങൾ സുരക്ഷിതമായി ലക്ഷ്യസ്ഥാനത്ത് എത്തിച്ചേർന്നു. നന്ദി.' },

  // Tamil (ta)
  { key: 'ta_welcome', lang: 'ta-IN', text: 'வணக்கம்! வியோ ஜர்னீஸுக்கு வரவேற்கிறோம். எங்கு செல்ல வேண்டும்?' },
  { key: 'ta_route_details', lang: 'ta-IN', text: 'மகாராஜாஸ் மைதானம் முதல் இடப்பள்ளி டோல் வரை செல்லும் பேருந்து 12A இல் செல்லவும். கட்டணம் 22 ரூபாய்.' },
  { key: 'ta_journey_start', lang: 'ta-IN', text: 'பேருந்து 12A இல் பயணம் தொடங்கியது. லைவ் டிராக்கிங் செயலில் உள்ளது.' },
  { key: 'ta_stop_alert', lang: 'ta-IN', text: 'கவனிக்கவும். உங்கள் நிறுத்தம் இடப்பள்ளி டோல் 30 வினாடிகளில் வரவுள்ளது.' },
  { key: 'ta_trip_finished', lang: 'ta-IN', text: 'நீங்கள் பாதுகாப்பாக வந்தடைந்தீர்கள். நன்றி.' },

  // Hindi (hi)
  { key: 'hi_welcome', lang: 'hi-IN', text: 'नमस्ते! वियो जर्नीज़ में आपका स्वागत है। आप कहाँ जाना चाहते हैं?' },
  { key: 'hi_route_details', lang: 'hi-IN', text: 'महाराजा ग्राउंड से एडपल्ली टोल के लिए बस रूट 12A लें। अनुमानित किराया 22 रुपये है।' },
  { key: 'hi_journey_start', lang: 'hi-IN', text: 'रूट 12A पर यात्रा शुरू हो गई है। लाइव ट्रैकिंग सक्रिय है।' },
  { key: 'hi_stop_alert', lang: 'hi-IN', text: 'ध्यान दें। आपका स्टॉप एडपल्ली टोल 30 सेकंड में आने वाला है।' },
  { key: 'hi_trip_finished', lang: 'hi-IN', text: 'आप सुरक्षित रूप से पहुंच गए हैं। धन्यवाद।' }
];

async function generateSpeech(phrase: PhraseEntry): Promise<string | null> {
  try {
    const res = await fetch(SARVAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY
      },
      body: JSON.stringify({
        inputs: [phrase.text],
        target_language_code: phrase.lang,
        speaker: 'kavya',
        model: 'bulbul:v3'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Sarvam Pre-gen] Failed for ${phrase.key} (${phrase.lang}): ${res.status} - ${errText}`);
      return null;
    }

    const data: any = await res.json();
    if (data.audios && data.audios[0]) {
      return `data:audio/wav;base64,${data.audios[0]}`;
    }
    return null;
  } catch (err) {
    console.warn(`[Sarvam Pre-gen] Network error for ${phrase.key}:`, err);
    return null;
  }
}

async function runPreGeneration() {
  console.log('🚀 Starting Offline Sarvam TTS Pre-Generation for PS-02 Assistant...');
  const audioMap: Record<string, string> = {};

  for (const phrase of ESSENTIAL_PHRASES) {
    console.log(`🎙️ Pre-generating audio: [${phrase.lang}] ${phrase.key}...`);
    const audioDataUrl = await generateSpeech(phrase);
    if (audioDataUrl) {
      audioMap[phrase.key] = audioDataUrl;
      // Also map simplified text keys for flexible lookups
      const textKey = `${phrase.lang.slice(0, 2)}_${phrase.text.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 45)}`;
      audioMap[textKey] = audioDataUrl;
      console.log(`✅ Cached ${phrase.key}`);
    } else {
      console.log(`⚠️ Skipped ${phrase.key} (Will use Web Speech fallback at runtime)`);
    }
  }

  // Save to public directory for runtime web fetch
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicOutputPath = path.join(publicDir, 'cached_audio_phrases.json');
  fs.writeFileSync(publicOutputPath, JSON.stringify(audioMap, null, 2), 'utf8');

  // Save to src/data for potential bundle imports
  const srcDataDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(srcDataDir)) {
    fs.mkdirSync(srcDataDir, { recursive: true });
  }
  const srcOutputPath = path.join(srcDataDir, 'cached_audio_phrases.json');
  fs.writeFileSync(srcOutputPath, JSON.stringify(audioMap, null, 2), 'utf8');

  console.log(`🎉 Finished! Saved ${Object.keys(audioMap).length} audio entries to public and src.`);
}

runPreGeneration();
