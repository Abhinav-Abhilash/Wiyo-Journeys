import rawData from './data/kerala_routes_stops.json';
import { Stop, Route, JourneyPlan, SupportedLanguage, DegradationStatus, TrackingProgress, StopMatchResult, QueryParseResult } from './types';
import { MultilingualStopMatcher } from './core/matcher';
import { TransitRouter } from './core/routing';
import { findNearestStops, JourneyTracker } from './core/geo';
import { VoiceInputManager } from './core/voice-in';
import { VoiceOutputManager } from './core/voice-out';
import { NotificationManager } from './core/notification';
import { StorageManager } from './core/storage';
import { checkDegradationStatus } from './core/degradation';

export * from './types';
export { JourneyTracker } from './core/geo';

// Load static dataset
const allStops: Stop[] = rawData.stops as Stop[];
const allRoutes: Route[] = (rawData.routes as unknown) as Route[];

// Initialize Singletons
const matcher = new MultilingualStopMatcher(allStops);
const router = new TransitRouter(allStops, allRoutes);
const voiceIn = new VoiceInputManager();
const voiceOut = new VoiceOutputManager();
const notification = new NotificationManager();

/**
 * 1. Initialize & Check Degradation State
 */
export function initAssistant(): DegradationStatus {
  return checkDegradationStatus();
}

export function getDegradationStatus(): DegradationStatus {
  return checkDegradationStatus();
}

/**
 * 2. Get All Stops / Nearest Stops
 */
export function getAllStops(): Stop[] {
  return allStops;
}

export function getNearestStops(
  userLat?: number,
  userLng?: number,
  limit = 3
): Promise<
  | { status: 'success'; stops: Array<{ stop: Stop; distanceMeters: number }> }
  | { status: 'permission_denied'; fallback: 'manual_selection'; stops: Array<{ stop: Stop; distanceMeters: number }> }
> {
  return new Promise((resolve) => {
    if (userLat !== undefined && userLng !== undefined) {
      const stops = findNearestStops(userLat, userLng, allStops, limit);
      resolve({ status: 'success', stops });
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({
        status: 'permission_denied',
        fallback: 'manual_selection',
        stops: allStops.slice(0, limit).map((s) => ({ stop: s, distanceMeters: 160 })),
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const stops = findNearestStops(pos.coords.latitude, pos.coords.longitude, allStops, limit);
        resolve({ status: 'success', stops });
      },
      () => {
        resolve({
          status: 'permission_denied',
          fallback: 'manual_selection',
          stops: allStops.slice(0, limit).map((s) => ({ stop: s, distanceMeters: 160 })),
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/**
 * 3. Search Stops & Parse Query (Tri-State)
 */
export function searchStop(query: string, limit = 5): StopMatchResult {
  return matcher.search(query, limit);
}

export function parseNaturalQuery(queryText: string, defaultOrigin?: Stop): QueryParseResult {
  return matcher.parseNaturalQuery(queryText, defaultOrigin);
}

/**
 * 4. Find Journeys & Fares
 */
export function findJourneys(originStopId: string, destStopId: string): JourneyPlan[] {
  return router.findJourneys(originStopId, destStopId);
}

/**
 * 5. Voice Input (Multilingual with command listener)
 */
export function startVoiceInput(callbacks: {
  lang?: SupportedLanguage;
  onTranscript: (text: string) => void;
  onCommand?: (command: 'repeat' | 'slower' | 'stop') => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}): () => void {
  return voiceIn.startListening({
    lang: callbacks.lang,
    onResult: callbacks.onTranscript,
    onCommand: callbacks.onCommand,
    onError: callbacks.onError,
    onEnd: callbacks.onEnd,
  });
}

/**
 * 6. Voice Output (Multilingual with cached Sarvam audio & strict voice enforcement)
 */
export function speakText(
  text: string,
  lang: SupportedLanguage = 'en',
  speechRate = 1.0,
  callbacks?: { phraseKey?: string; onStart?: () => void; onEnd?: () => void; onError?: (e: any) => void }
): Promise<void> {
  return voiceOut.speak(text, {
    lang,
    phraseKey: callbacks?.phraseKey,
    speechRate,
    onStart: callbacks?.onStart,
    onEnd: callbacks?.onEnd,
    onError: callbacks?.onError,
  });
}

export function repeatLastSpoken(): void {
  voiceOut.repeat();
}

export function speakSlower(): void {
  voiceOut.makeSlower();
}

/**
 * 7. Live Journey Tracker
 */
export function createJourneyTracker(journey: JourneyPlan): JourneyTracker {
  return new JourneyTracker(journey);
}

/**
 * 8. Stop Notifications
 */
export function triggerArrivalNotification(
  stop: Stop,
  lang: SupportedLanguage = 'en',
  onInAppBanner?: (msg: string) => void
): void {
  notification.triggerArrivalAlert(stop, lang, onInAppBanner);
}

/**
 * 9. Saved Journey Cards (Offline storage)
 */
export function saveJourneyCard(journey: JourneyPlan): void {
  StorageManager.saveJourney(journey);
}

export function getSavedJourneyCards(): JourneyPlan[] {
  return StorageManager.getSavedJourneys();
}

export function removeSavedJourneyCard(id: string): void {
  StorageManager.removeSavedJourney(id);
}
