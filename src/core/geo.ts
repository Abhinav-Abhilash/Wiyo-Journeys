import { Stop, TrackingProgress, JourneyPlan, MultilingualText } from '../types';

/**
 * Computes Haversine distance in meters between two lat/lng points
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes Haversine distance in kilometers with 2 decimal precision
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round((calculateHaversineDistance(lat1, lon1, lat2, lon2) / 1000) * 100) / 100;
}

/**
 * Convenience helper to compute distance in meters between two Stop objects
 */
export function calculateStopDistance(stopA: Stop, stopB: Stop): number {
  return calculateHaversineDistance(stopA.lat, stopA.lng, stopB.lat, stopB.lng);
}

/**
 * Convenience helper to compute distance in kilometers between two Stop objects
 */
export function calculateStopDistanceKm(stopA: Stop, stopB: Stop): number {
  return calculateHaversineDistanceKm(stopA.lat, stopA.lng, stopB.lat, stopB.lng);
}

/**
 * Computes distances between consecutive stop pairs along a route
 */
export function computeRouteSegmentDistances(
  stopIds: string[],
  stopsMap: Map<string, Stop>
): number[] {
  const segments: number[] = [];
  for (let i = 0; i < stopIds.length - 1; i++) {
    const s1 = stopsMap.get(stopIds[i]);
    const s2 = stopsMap.get(stopIds[i + 1]);
    if (s1 && s2) {
      segments.push(calculateHaversineDistance(s1.lat, s1.lng, s2.lat, s2.lng));
    } else {
      segments.push(0);
    }
  }
  return segments;
}

/**
 * Calculates 8-point compass bearing from origin to destination
 */
export function calculateCompassDirection(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): MultilingualText {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  if (bearing >= 337.5 || bearing < 22.5) return { en: 'North', ml: 'വടക്ക്', ta: 'வடக்கு', hi: 'उत्तर' };
  if (bearing >= 22.5 && bearing < 67.5) return { en: 'North-East', ml: 'വടക്കുകിഴക്ക്', ta: 'வடகிழக்கு', hi: 'उत्तर-पूर्व' };
  if (bearing >= 67.5 && bearing < 112.5) return { en: 'East', ml: 'കിഴക്ക്', ta: 'கிழக்கு', hi: 'पूर्व' };
  if (bearing >= 112.5 && bearing < 157.5) return { en: 'South-East', ml: 'തെക്കുകിഴക്ക്', ta: 'தென்கிழக்கு', hi: 'दक्षिण-पूर्व' };
  if (bearing >= 157.5 && bearing < 202.5) return { en: 'South', ml: 'തെക്ക്', ta: 'தெற்கு', hi: 'दक्षिण' };
  if (bearing >= 202.5 && bearing < 247.5) return { en: 'South-West', ml: 'തെക്കുപടിഞ്ഞാറ്', ta: 'தென்மேற்கு', hi: 'दक्षिण-पश्चिम' };
  if (bearing >= 247.5 && bearing < 292.5) return { en: 'West', ml: 'പടിഞ്ഞാറ്', ta: 'மேற்கு', hi: 'पश्चिम' };
  return { en: 'North-West', ml: 'വടക്കുപടിഞ്ഞാറ്', ta: 'வடமேற்கு', hi: 'उत्तर-पश्चिम' };
}

export interface NearestStopResult {
  stop: Stop;
  distanceMeters: number;
}

/**
 * Returns the top N nearest stops to the given GPS coordinates
 */
export function findNearestStops(
  userLat: number,
  userLng: number,
  allStops: Stop[],
  limit = 3
): NearestStopResult[] {
  const stopsWithDistance = allStops.map((stop) => ({
    stop,
    distanceMeters: calculateHaversineDistance(userLat, userLng, stop.lat, stop.lng),
  }));

  stopsWithDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return stopsWithDistance.slice(0, limit);
}

export const MAX_ROAD_SNAP_DISTANCE_METERS = 75;

/**
 * Snaps a GPS coordinate to the closest point along a road polyline.
 * If raw GPS is within maxSnapDistanceMeters (default 75m), snaps to road to eliminate jitter.
 * If raw GPS is further than 75m (e.g. detour or drift), falls back to raw GPS.
 */
export function snapToRoadPolyline(
  lat: number,
  lng: number,
  roadCoords: [number, number][],
  maxSnapDistanceMeters = MAX_ROAD_SNAP_DISTANCE_METERS
): { snappedPoint: [number, number]; index: number; minDistanceMeters: number; isSnapped: boolean } {
  if (roadCoords.length === 0) {
    return { snappedPoint: [lat, lng], index: 0, minDistanceMeters: 0, isSnapped: false };
  }

  let minDistance = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < roadCoords.length; i++) {
    const dist = calculateHaversineDistance(lat, lng, roadCoords[i][0], roadCoords[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = i;
    }
  }

  const isSnapped = minDistance <= maxSnapDistanceMeters;

  return {
    snappedPoint: isSnapped ? roadCoords[bestIndex] : [lat, lng],
    index: bestIndex,
    minDistanceMeters: minDistance,
    isSnapped,
  };
}

/**
 * Computes remaining distance in meters along the road polyline from a road index to the end
 */
export function calculateRemainingRoadDistance(
  roadCoords: [number, number][],
  fromIndex: number
): number {
  let totalMeters = 0;
  for (let i = fromIndex; i < roadCoords.length - 1; i++) {
    totalMeters += calculateHaversineDistance(
      roadCoords[i][0],
      roadCoords[i][1],
      roadCoords[i + 1][0],
      roadCoords[i + 1][1]
    );
  }
  return totalMeters;
}

/**
 * Real-time 1-Second GPS & Route Journey Tracker
 */
export class JourneyTracker {
  private journey: JourneyPlan;
  private roadCoords: [number, number][] = [];
  private currentRoadIndex = 0;
  private alertedStops = new Set<string>();
  private speedSamples: number[] = [28]; // km/h baseline
  private watchId: number | null = null;
  private timerInterval: any = null;

  constructor(journey: JourneyPlan, roadCoords?: [number, number][]) {
    this.journey = journey;
    if (roadCoords && roadCoords.length > 0) {
      this.roadCoords = roadCoords;
    }
  }

  public setRoadCoordinates(coords: [number, number][]) {
    this.roadCoords = coords;
  }

  public resetAlerts() {
    this.alertedStops.clear();
  }

  /**
   * Update tracker with a 1-second GPS location fix
   */
  public updatePosition(
    currentLat: number,
    currentLng: number,
    speedMps: number | null
  ): {
    progress: TrackingProgress;
    shouldAlert: boolean;
    approachingStop: Stop | null;
    snappedCoord: [number, number];
    isSnapped: boolean;
  } {
    const destStop = this.journey.destination;
    const originStop = this.journey.origin;

    if (speedMps && speedMps > 1) {
      const speedKmh = speedMps * 3.6;
      this.speedSamples.push(speedKmh);
      if (this.speedSamples.length > 5) this.speedSamples.shift();
    }

    const avgSpeedKmh =
      this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
    const avgSpeedMps = Math.max((avgSpeedKmh * 1000) / 3600, 5.0); // min 5 m/s

    // Snap to road with 75m threshold fallback
    let snapped = [currentLat, currentLng] as [number, number];
    let isSnapped = false;
    let remainingDistanceMeters = calculateHaversineDistance(currentLat, currentLng, destStop.lat, destStop.lng);

    if (this.roadCoords.length > 0) {
      const snapResult = snapToRoadPolyline(currentLat, currentLng, this.roadCoords);
      snapped = snapResult.snappedPoint;
      isSnapped = snapResult.isSnapped;
      if (isSnapped) {
        this.currentRoadIndex = Math.max(this.currentRoadIndex, snapResult.index);
        remainingDistanceMeters = calculateRemainingRoadDistance(this.roadCoords, this.currentRoadIndex);
      }
    }

    const totalTripDistance = Math.max(
      remainingDistanceMeters,
      calculateHaversineDistance(originStop.lat, originStop.lng, destStop.lat, destStop.lng)
    );

    const percentToNext = Math.min(
      100,
      Math.max(0, Math.round(((totalTripDistance - remainingDistanceMeters) / Math.max(totalTripDistance, 1)) * 100))
    );

    const etaSeconds = Math.round(remainingDistanceMeters / avgSpeedMps);

    // Rule: Whichever trigger is reached FIRST (Distance <= 250m OR ETA <= 30s)
    // Exactly-once per stop guaranteed by alertedStops check
    const isWithinAlertZone = (remainingDistanceMeters <= 250 || etaSeconds <= 30);
    const shouldAlert = isWithinAlertZone && !this.alertedStops.has(destStop.id);

    let approachingStop: Stop | null = null;
    if (shouldAlert) {
      this.alertedStops.add(destStop.id);
      approachingStop = destStop;
    }

    const isJourneyComplete = remainingDistanceMeters <= 60;

    const progress: TrackingProgress = {
      journeyId: this.journey.id,
      currentLegIndex: 0,
      currentSegment: {
        fromStop: originStop,
        toStop: destStop,
      },
      percentToNextStop: percentToNext,
      distanceToNextStopMeters: remainingDistanceMeters,
      etaSecondsToNextStop: etaSeconds,
      nextStop: destStop,
      destinationStop: destStop,
      speedKmh: Math.round(avgSpeedKmh),
      passedStops: isJourneyComplete ? [originStop, destStop] : [originStop],
      remainingStops: isJourneyComplete ? [] : [destStop],
      isApproachingStop: isWithinAlertZone,
      isJourneyComplete,
    };

    return {
      progress,
      shouldAlert,
      approachingStop,
      snappedCoord: snapped,
      isSnapped,
    };
  }

  /**
   * Start 1-second continuous GPS position watcher
   */
  public startLiveGpsTracking(
    onTick: (result: ReturnType<JourneyTracker['updatePosition']>) => void,
    onError?: (err: any) => void
  ): () => void {
    if (!('geolocation' in navigator)) {
      onError?.('Geolocation is not supported on this device.');
      return () => {};
    }

    // Use watchPosition for high-accuracy GPS
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const res = this.updatePosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed
        );
        onTick(res);
      },
      (err) => onError?.(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => this.stopTracking();
  }

  public stopTracking() {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
