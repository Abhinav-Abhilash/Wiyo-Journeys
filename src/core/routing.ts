import { Stop, Route, JourneyPlan, JourneyLeg, MultilingualText, FallbackStopInfo } from '../types';
import { calculateHaversineDistance, calculateCompassDirection } from './geo';
import { calculateAccurateKeralaFare, BusServiceClass } from './fare-calculator';

export class TransitRouter {
  private stopsMap: Map<string, Stop>;
  private routes: Route[];

  constructor(stops: Stop[], routes: Route[]) {
    this.stopsMap = new Map(stops.map((s) => [s.id, s]));
    this.routes = routes;
  }

  /**
   * Find journey plans between origin and destination stops.
   * 1. Returns direct routes if available.
   * 2. If no direct route exists, computes the nearest reachable fallback stop.
   */
  public findJourneys(originStopId: string, destStopId: string): JourneyPlan[] {
    if (originStopId === destStopId) return [];

    const originStop = this.stopsMap.get(originStopId);
    const destStop = this.stopsMap.get(destStopId);
    if (!originStop || !destStop) return [];

    // 1. Direct Routes Search
    const directPlans: JourneyPlan[] = [];
    for (const route of this.routes) {
      const plan = this.buildDirectPlan(originStop, destStop, route);
      if (plan) {
        directPlans.push(plan);
      }
    }

    if (directPlans.length > 0) {
      return directPlans;
    }

    // 2. Fallback: No direct route exists. Find the nearest reachable transit stop to destination
    const fallbackPlan = this.findNearestReachableFallback(originStop, destStop);
    if (fallbackPlan) {
      return [fallbackPlan];
    }

    return [];
  }

  /**
   * Builds a single direct journey plan along a specific route if valid
   */
  private buildDirectPlan(originStop: Stop, destStop: Stop, route: Route): JourneyPlan | null {
    const originIdx = route.stops.indexOf(originStop.id);
    const destIdx = route.stops.indexOf(destStop.id);

    if (originIdx === -1 || destIdx === -1 || originIdx >= destIdx) {
      return null;
    }

    const legStopsIds = route.stops.slice(originIdx, destIdx + 1);
    const intermediateStops = legStopsIds
      .slice(1, -1)
      .map((id) => this.stopsMap.get(id)!)
      .filter(Boolean);

    // Compute total distance along stops
    let distanceMeters = 0;
    for (let s = 0; s < legStopsIds.length - 1; s++) {
      const s1 = this.stopsMap.get(legStopsIds[s]);
      const s2 = this.stopsMap.get(legStopsIds[s + 1]);
      if (s1 && s2) {
        distanceMeters += calculateHaversineDistance(s1.lat, s1.lng, s2.lat, s2.lng);
      }
    }
    const distanceKm = Math.max(2.0, distanceMeters / 1000);

    // Accurate Kerala MVD fare calculation
    const fareDetails = calculateAccurateKeralaFare(
      (route.serviceType as BusServiceClass) || 'Ordinary',
      distanceKm
    );

    const estimatedRideMins = Math.max(8, Math.round(distanceKm * 2.2));

    const busBoardHeader: MultilingualText = {
      en: `Towards ${destStop.names.en} via ${route.name}`,
      ml: `${destStop.names.ml} ലേക്ക് (${route.name})`,
      ta: `${destStop.names.ta} நோக்கி (${route.name})`,
      hi: `${destStop.names.hi} की ओर (${route.name})`,
    };

    const leg: JourneyLeg = {
      routeId: route.id,
      routeNumber: route.routeNumber,
      routeName: route.name,
      serviceType: route.serviceType,
      fromStop: originStop,
      toStop: destStop,
      intermediateStops,
      stagesCount: fareDetails.stagesCount,
      fareEstimate: fareDetails.totalEstimatedFare,
      estimatedRideMins,
      departureTime: this.getNextDeparture(route),
      busBoardHeader,
      boardingLandmark: originStop.landmarkHint?.en,
      alightingLandmark: destStop.landmarkHint?.en,
    };

    return {
      id: `PLAN_DIR_${route.id}_${Date.now()}`,
      type: 'direct',
      origin: originStop,
      destination: destStop,
      legs: [leg],
      totalFare: {
        fare_estimate: true,
        amount: fareDetails.totalEstimatedFare,
        currency: 'INR',
        disclaimer: fareDetails.disclaimer,
        baseFare: fareDetails.baseFare,
        stageFare: fareDetails.additionalDistanceFare,
      },
      totalDurationMins: estimatedRideMins,
      departureTime: leg.departureTime,
    };
  }

  /**
   * Deterministic fallback when NO direct bus exists:
   * Finds the stop reachable from origin that is closest to requested destination,
   * calculating exact walking distance and 8-point compass bearing.
   */
  private findNearestReachableFallback(originStop: Stop, requestedDest: Stop): JourneyPlan | null {
    // 1. Gather all forward reachable stops from originStop along all routes
    interface ReachableCandidate {
      stop: Stop;
      route: Route;
      distanceToDestMeters: number;
    }

    const candidates: ReachableCandidate[] = [];

    for (const route of this.routes) {
      const oIdx = route.stops.indexOf(originStop.id);
      if (oIdx !== -1) {
        for (let i = oIdx + 1; i < route.stops.length; i++) {
          const stop = this.stopsMap.get(route.stops[i]);
          if (stop && stop.id !== originStop.id) {
            const distanceToDestMeters = calculateHaversineDistance(
              stop.lat,
              stop.lng,
              requestedDest.lat,
              requestedDest.lng
            );
            candidates.push({ stop, route, distanceToDestMeters });
          }
        }
      }
    }

    // 2. If origin stop itself has no outgoing routes, check nearest boarding hub
    let resolvedOrigin = originStop;
    if (candidates.length === 0) {
      let nearestHubDistance = Infinity;
      let nearestHub: Stop | null = null;
      for (const [id, s] of this.stopsMap) {
        if (id !== originStop.id) {
          const hasRoutes = this.routes.some((r) => r.stops.includes(id));
          if (hasRoutes) {
            const d = calculateHaversineDistance(originStop.lat, originStop.lng, s.lat, s.lng);
            if (d < nearestHubDistance) {
              nearestHubDistance = d;
              nearestHub = s;
            }
          }
        }
      }

      if (nearestHub) {
        resolvedOrigin = nearestHub;
        for (const route of this.routes) {
          const oIdx = route.stops.indexOf(resolvedOrigin.id);
          if (oIdx !== -1) {
            for (let i = oIdx + 1; i < route.stops.length; i++) {
              const stop = this.stopsMap.get(route.stops[i]);
              if (stop && stop.id !== resolvedOrigin.id) {
                const distanceToDestMeters = calculateHaversineDistance(
                  stop.lat,
                  stop.lng,
                  requestedDest.lat,
                  requestedDest.lng
                );
                candidates.push({ stop, route, distanceToDestMeters });
              }
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // 3. Find candidate stop with the minimum distance to requestedDest
    candidates.sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);
    const best = candidates[0];

    // 4. Build direct plan to the best reachable stop
    const basePlan = this.buildDirectPlan(resolvedOrigin, best.stop, best.route);
    if (!basePlan) return null;

    const walkMeters = best.distanceToDestMeters;
    const walkKm = (walkMeters / 1000).toFixed(1);
    const compassDir = calculateCompassDirection(best.stop.lat, best.stop.lng, requestedDest.lat, requestedDest.lng);

    const fallbackInfo: FallbackStopInfo = {
      nearestReachableStop: best.stop,
      requestedDestination: requestedDest,
      walkDistanceMeters: walkMeters,
      walkDistanceKm: walkKm,
      compassDirection: compassDir,
    };

    const notes: MultilingualText = {
      en: `Closest available option (no direct bus). Alight at ${best.stop.names.en}. Your destination ${requestedDest.names.en} is ${walkKm} km ${compassDir.en} (short walk / auto).`,
      ml: `ഏറ്റവും അടുത്തുള്ള സ്റ്റോപ്പ് (നേരിട്ട് ബസ്സില്ല). ${best.stop.names.ml}ൽ ഇറങ്ങുക. ${requestedDest.names.ml}ലേക്ക് ${walkKm} കി.മീ ${compassDir.ml} യാത്രയുണ്ട് (നടപ്പ് / ഓട്ടോ).`,
      ta: `அருகிலுள்ள நிறுத்தம் (நேரடி பேருந்து இல்லை). ${best.stop.names.ta} இல் இறங்கவும். உங்கள் இலக்கு ${walkKm} கி.மீ ${compassDir.ta} தொலைவில் உள்ளது.`,
      hi: `निकटतम उपलब्ध स्टॉप (कोई सीधी बस नहीं)। ${best.stop.names.hi} पर उतरें। आपका गंतव्य ${walkKm} किमी ${compassDir.hi} दूर है।`,
    };

    return {
      ...basePlan,
      id: `PLAN_FALLBACK_${basePlan.id}`,
      type: 'fallback_nearest',
      destination: best.stop, // Alighting stop for the bus ride
      requestedDestination: requestedDest, // Original passenger requested stop
      fallbackInfo,
      notes,
    };
  }

  private getNextDeparture(route: Route, offsetMins = 0): string {
    const now = new Date();
    const currentMins = now.getMinutes() + offsetMins;
    const nextMin = (currentMins + (route.schedule.frequencyMins ?? 8)) % 60;
    const nextHour = (now.getHours() + Math.floor((currentMins + 8) / 60)) % 24;
    const hh = String(nextHour).padStart(2, '0');
    const mm = String(nextMin).padStart(2, '0');
    return `${hh}:${mm} ${nextHour >= 12 ? 'PM' : 'AM'}`;
  }
}
