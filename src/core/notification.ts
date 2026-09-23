import { Stop, SupportedLanguage } from '../types';

export class NotificationManager {
  private hasNotificationPermission = false;

  constructor() {
    this.checkPermission();
  }

  private async checkPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasNotificationPermission = true;
      }
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      this.hasNotificationPermission = permission === 'granted';
      return this.hasNotificationPermission;
    } catch (_) {
      return false;
    }
  }

  /**
   * Trigger in-app arrival alert with vibration and notification
   */
  public triggerArrivalAlert(stop: Stop, lang: SupportedLanguage = 'en', onInAppBanner?: (message: string) => void) {
    const titles: Record<SupportedLanguage, string> = {
      en: `Alighting Alert: ${stop.names.en}`,
      ml: `സ്റ്റോപ്പ് ഉടൻ എത്തും: ${stop.names.ml}`,
      ta: `இறங்கும் நேரம்: ${stop.names.ta}`,
      hi: `उतरने का समय: ${stop.names.hi}`,
    };

    const bodies: Record<SupportedLanguage, string> = {
      en: `Your bus stop is ~30 seconds away (250m). Please prepare to alight safely.`,
      ml: `ബസ് സ്റ്റോപ്പ് 30 സെക്കൻഡിൽ എത്തും. ഇറങ്ങാൻ തയ്യാറാകുക.`,
      ta: `உங்கள் பேருந்து நிறுத்தம் 30 வினாடிகளில் வரும்.`,
      hi: `आपका बस स्टॉप 30 सेकंड में आने वाला है।`,
    };

    const title = titles[lang] || titles.en;
    const body = bodies[lang] || bodies.en;

    // 1. Device Vibration (300ms pulse, 100ms pause, 300ms pulse, 100ms pause, 500ms ring)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([300, 100, 300, 100, 500]);
      } catch (_) {}
    }

    // 2. Browser Native Notification (if permission given)
    if (this.hasNotificationPermission && 'Notification' in window) {
      try {
        new Notification(title, {
          body,
          icon: 'https://lh3.googleusercontent.com/aida/AEtjO1WyN5GdYQ0yU4nPvPOh8ae1UT3RxV7cbb13JPLC7TGQvyJWt2DDACKcrIi-HP9-v3zWoKcur9pmnImppaWE5EYav3yaVFoKCmJuqg20pPckBrO_f1irWx-YXv9kLOo4jHOq2JfaoXI0cEQk02VXwidRlQpTVsvTsclWECFHfL9q9tXT4OWUMBa5_UfGmkvcIqQn-4zF2z5eH8jRbpG7eJEIgZjBUkC8d0OE0FNmQExSpoyVuGdEjPQiGQE',
          silent: false,
        });
      } catch (_) {}
    }

    // 3. In-App Banner callback (Failsafe for mobile browsers / denied permissions)
    onInAppBanner?.(`${title} — ${body}`);
  }
}
