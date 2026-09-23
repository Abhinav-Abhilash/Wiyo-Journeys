import { Stop, TrackingProgress, JourneyPlan } from '../types';

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

/**
 * Snaps a GPS coordinate to the closest point along a road polyline
 */
export function snapToRoadPolyline(
  lat: number,
  lng: number,
  roadCoords: [number, number][]
): { snappedPoint: [number, number]; index: number; minDistanceMeters: number } {
  if (roadCoords.length === 0) return { snappedPoint: [lat, lng], index: 0, minDistanceMeters: 0 };

  let minDistance = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < roadCoords.length; i++) {
    const dist = calculateHaversineDistance(lat, lng, roadCoords[i][0], roadCoords[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = i;
    }
  }

  return {
    snappedPoint: roadCoords[bestIndex],
    index: bestIndex,
    minDistanceMeters: minDistance,
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

    // Snap to road
    let snapped = [currentLat, currentLng] as [number, number];
    let remainingDistanceMeters = calculateHaversineDistance(currentLat, currentLng, destStop.lat, destStop.lng);

    if (this.roadCoords.length > 0) {
      const snapResult = snapToRoadPolyline(currentLat, currentLng, this.roadCoords);
      snapped = snapResult.snappedPoint;
      this.currentRoadIndex = Math.max(this.currentRoadIndex, snapResult.index);
      remainingDistanceMeters = calculateRemainingRoadDistance(this.roadCoords, this.currentRoadIndex);
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

    // 30-second arrival alert trigger (<= 35s or <= 280m)
    const isApproaching = (etaSeconds <= 35 || remainingDistanceMeters <= 280) && !this.alertedStops.has(destStop.id);

    let approachingStop: Stop | null = null;
    if (isApproaching) {
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
      isApproachingStop: isApproaching,
      isJourneyComplete,
    };

    return {
      progress,
      shouldAlert: isApproaching,
      approachingStop,
      snappedCoord: snapped,
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
