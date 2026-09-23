import { Stop, Route, JourneyPlan, JourneyLeg, MultilingualText } from '../types';

import { calculateHaversineDistance } from './geo';
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
   * Evaluates Direct Routes first, then 1-Transfer routes.
   */
  public findJourneys(originStopId: string, destStopId: string): JourneyPlan[] {
    if (originStopId === destStopId) return [];

    const originStop = this.stopsMap.get(originStopId);
    const destStop = this.stopsMap.get(destStopId);
    if (!originStop || !destStop) return [];

    const plans: JourneyPlan[] = [];

    // 1. Direct Routes Search
    for (const route of this.routes) {
      const originIdx = route.stops.indexOf(originStopId);
      const destIdx = route.stops.indexOf(destStopId);

      if (originIdx !== -1 && destIdx !== -1 && originIdx < destIdx) {
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

        plans.push({
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
        });
      }
    }

    // 3. Fallback: If no direct or transfer route found, find nearest reachable transit stop to destination
    if (plans.length === 0) {
      const nearestReachablePlan = this.findNearestReachableJourney(originStop, destStop);
      if (nearestReachablePlan) {
        plans.push(nearestReachablePlan);
      }
    }

    return plans;
  }

  /**
   * Finds the closest transit hub reachable from origin that is closest to target destination
   */
  private findNearestReachableJourney(originStop: Stop, destStop: Stop): JourneyPlan | null {
    // Find all reachable stops from origin
    const reachableStops = new Set<string>();
    for (const route of this.routes) {
      const oIdx = route.stops.indexOf(originStop.id);
      if (oIdx !== -1) {
        for (let i = oIdx + 1; i < route.stops.length; i++) {
          reachableStops.add(route.stops[i]);
        }
      }
    }

    if (reachableStops.size === 0) return null;

    // Pick reachable stop with shortest distance to destStop
    let bestStopId: string | null = null;
    let minDistance = Infinity;

    for (const stopId of reachableStops) {
      const stop = this.stopsMap.get(stopId);
      if (stop) {
        const d = calculateHaversineDistance(stop.lat, stop.lng, destStop.lat, destStop.lng);
        if (d < minDistance) {
          minDistance = d;
          bestStopId = stopId;
        }
      }
    }

    if (!bestStopId) return null;

    const bestStop = this.stopsMap.get(bestStopId)!;
    const subPlans = this.findJourneys(originStop.id, bestStopId);
    if (subPlans.length === 0) return null;

    const basePlan = subPlans[0];
    const distWalkKm = (minDistance / 1000).toFixed(1);

    // Annotate plan to inform user about nearest reachable stop
    return {
      ...basePlan,
      id: `PLAN_NEAREST_${basePlan.id}`,
      destination: bestStop,
      notes: {
        en: `Nearest direct stop to ${destStop.names.en} (${distWalkKm} km walk/auto transfer).`,
        ml: `${destStop.names.ml} ലേക്ക് ഏറ്റവും അടുത്ത സ്റ്റോപ്പ് (${distWalkKm} കി.മീ നടപ്പ്/ഓട്ടോ).`,
        ta: `${destStop.names.ta} அருகில் உள்ள பேருந்து நிறுத்தம் (${distWalkKm} கி.மீ).`,
        hi: `${destStop.names.hi} के सबसे नजदीकी स्टॉप (${distWalkKm} किमी).`,
      }
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
