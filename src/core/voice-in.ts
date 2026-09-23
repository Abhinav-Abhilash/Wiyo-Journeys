import { SupportedLanguage } from '../types';

export type VoiceCommand = 'repeat' | 'slower' | 'stop';

export interface VoiceInputOptions {
  lang?: SupportedLanguage;
  onResult: (transcript: string) => void;
  onCommand?: (command: VoiceCommand) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export class VoiceInputManager {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  public isAvailable(): boolean {
    return this.recognition !== null;
  }

  public startListening(options: VoiceInputOptions): () => void {
    if (!this.recognition) {
      options.onError?.('SpeechRecognition API is not supported in this browser.');
      return () => {};
    }

    if (this.isListening) {
      this.stopListening();
    }

    // Configure exact language for Speech Recognition based on active screen/app language
    const langTags: Record<SupportedLanguage, string> = {
      ml: 'ml-IN',
      ta: 'ta-IN',
      hi: 'hi-IN',
      en: 'en-IN'
    };

    const targetLang = options.lang || 'en';
    this.recognition.lang = langTags[targetLang] || 'en-IN';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (!transcript) return;

      const lower = transcript.toLowerCase();

      // Multilingual Voice commands interceptor
      const isRepeat =
        lower.includes('repeat') ||
        lower.includes('say again') ||
        lower.includes('once more') ||
        lower.includes('again') ||
        lower.includes('വീണ്ടും') ||
        lower.includes('ഒന്നുകൂടി') ||
        lower.includes('റിപ്പീറ്റ്') ||
        lower.includes('மீண்டும்') ||
        lower.includes('மறுபடியும்') ||
        lower.includes('दोबारा') ||
        lower.includes('फिर से');

      const isSlower =
        lower.includes('slower') ||
        lower.includes('slow') ||
        lower.includes('speak slow') ||
        lower.includes('slowly') ||
        lower.includes('പതുക്കെ') ||
        lower.includes('മെല്ലെ') ||
        lower.includes('മെதுவாக') ||
        lower.includes('மெல்ல') ||
        lower.includes('धीरे');

      const isStop =
        lower.includes('stop') ||
        lower.includes('cancel') ||
        lower.includes('quiet') ||
        lower.includes('നിർത്തുക') ||
        lower.includes('മതി') ||
        lower.includes('സ്റ്റോപ്പ്') ||
        lower.includes('நிறுத்து') ||
        lower.includes('போதும்') ||
        lower.includes('रुको') ||
        lower.includes('बंद') ||
        lower.includes('रोकें');

      if (isRepeat) {
        options.onCommand?.('repeat');
      } else if (isSlower) {
        options.onCommand?.('slower');
      } else if (isStop) {
        options.onCommand?.('stop');
      } else {
        options.onResult(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      options.onError?.(event.error || 'Speech recognition error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      options.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      options.onError?.(e.message || 'Failed to start microphone');
    }

    return () => this.stopListening();
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.isListening = false;
    }
  }
}
