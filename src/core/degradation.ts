import { DegradationStatus } from '../types';

export function checkDegradationStatus(): DegradationStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const speechRecognitionAvailable =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const speechSynthesisAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const geolocationAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const notificationAvailable = typeof window !== 'undefined' && 'Notification' in window;

  let tier: 'full-online' | 'cached-offline' | 'text-only-fallback' = 'full-online';

  if (!isOnline) {
    tier = 'cached-offline';
  } else if (!speechRecognitionAvailable && !speechSynthesisAvailable) {
    tier = 'text-only-fallback';
  }

  return {
    tier,
    speechRecognitionAvailable,
    speechSynthesisAvailable,
    geolocationAvailable,
    notificationAvailable,
    isOnline,
  };
}
