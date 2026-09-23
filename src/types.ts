export type SupportedLanguage = 'en' | 'ml' | 'ta' | 'hi';

export interface MultilingualText {
  en: string;
  ml: string;
  ta: string;
  hi: string;
}

export interface Stop {
  id: string;
  names: MultilingualText;
  lat: number;
  lng: number;
  landmarkHint?: MultilingualText;
  district?: string;
  aliases?: string[];
}

export interface RouteSchedule {
  type: 'frequency' | 'timetable';
  firstBus: string;
  lastBus: string;
  frequencyMins?: number;
  departureTimes?: string[];
}

export interface Route {
  id: string;
  routeNumber: string;
  name: string;
  serviceType: 'Ordinary' | 'City Fast' | 'Fast Passenger' | 'Super Fast' | 'Swift' | 'Feeder';
  stops: string[]; // Ordered stop IDs
  stopStages: Record<string, number>; // stopId -> stageIndex
  fareTable: Record<number, number>; // stageCount -> fare in INR
  schedule: RouteSchedule;
}

export type StopMatchStatus = 'matched' | 'ambiguous' | 'not_found';

export type StopMatchResult =
  | { status: 'matched'; stop: Stop; confidence: number }
  | { status: 'ambiguous'; candidates: Array<{ stop: Stop; score: number }> }
  | { status: 'not_found'; query: string };

export interface QueryParseResult {
  origin: StopMatchResult;
  destination: StopMatchResult;
  rawText: string;
}

export interface JourneyLeg {
  routeId: string;
  routeNumber: string;
  routeName: string;
  serviceType: string;
  fromStop: Stop;
  toStop: Stop;
  intermediateStops: Stop[];
  stagesCount: number;
  fareEstimate: number;
  estimatedRideMins: number;
  departureTime: string;
  busBoardHeader: MultilingualText;
  boardingLandmark?: string;
  alightingLandmark?: string;
}

export interface FallbackStopInfo {
  nearestReachableStop: Stop;
  requestedDestination: Stop;
  walkDistanceMeters: number;
  walkDistanceKm: string;
  compassDirection: MultilingualText;
}

export interface JourneyPlan {
  id: string;
  type: 'direct' | 'transfer' | 'fallback_nearest';
  origin: Stop;
  destination: Stop;
  requestedDestination?: Stop;
  fallbackInfo?: FallbackStopInfo;
  legs: JourneyLeg[];
  totalFare: {
    fare_estimate: true;
    amount: number;
    currency: 'INR';
    disclaimer: string;
    baseFare: number;
    stageFare: number;
  };
  interchangeStop?: Stop;
  totalDurationMins: number;
  departureTime: string;
  notes?: MultilingualText;
}

export interface TrackingProgress {
  journeyId: string;
  currentLegIndex: number;
  currentSegment: {
    fromStop: Stop;
    toStop: Stop;
  };
  percentToNextStop: number; // 0 - 100
  distanceToNextStopMeters: number;
  etaSecondsToNextStop: number;
  nextStop: Stop;
  destinationStop: Stop;
  speedKmh: number;
  passedStops: Stop[];
  remainingStops: Stop[];
  isApproachingStop: boolean; // True within <= 30s or <= 250m
  isJourneyComplete: boolean;
}

export interface DegradationStatus {
  tier: 'full-online' | 'cached-offline' | 'text-only-fallback';
  speechRecognitionAvailable: boolean;
  speechSynthesisAvailable: boolean;
  geolocationAvailable: boolean;
  notificationAvailable: boolean;
  isOnline: boolean;
}
