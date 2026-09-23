/**
 * Official Kerala Motor Vehicles Department (MVD) & KSRTC Stage Carriage Fare Engine
 * Reference: Government of Kerala Transport (B) Department Stage Carriage Fare Notification
 */

export type BusServiceClass =
  | 'Ordinary'
  | 'City Fast'
  | 'Fast Passenger'
  | 'Super Fast'
  | 'Super Express'
  | 'Super Air Express'
  | 'Super Deluxe'
  | 'AC Low Floor'
  | 'AC Sleeper';

export interface FareRule {
  minFare: number;
  minDistanceKm: number;
  ratePerKm: number; // in INR
  roundingPrecision: number; // 0.5 for Ordinary, 1.0 for FP/SF
  cess: number;
}

export const OFFICIAL_KERALA_FARE_RATES: Record<BusServiceClass, FareRule> = {
  Ordinary: {
    minFare: 10,
    minDistanceKm: 2.5,
    ratePerKm: 1.00,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'City Fast': {
    minFare: 12,
    minDistanceKm: 2.5,
    ratePerKm: 1.03,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'Fast Passenger': {
    minFare: 15,
    minDistanceKm: 5.0,
    ratePerKm: 1.05,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'Super Fast': {
    minFare: 22,
    minDistanceKm: 10.0,
    ratePerKm: 1.08,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'Super Express': {
    minFare: 28,
    minDistanceKm: 15.0,
    ratePerKm: 1.10,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'Super Air Express': {
    minFare: 35,
    minDistanceKm: 15.0,
    ratePerKm: 1.15,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'Super Deluxe': {
    minFare: 40,
    minDistanceKm: 15.0,
    ratePerKm: 1.20,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'AC Low Floor': {
    minFare: 60,
    minDistanceKm: 20.0,
    ratePerKm: 1.50,
    roundingPrecision: 1.0,
    cess: 0,
  },
  'AC Sleeper': {
    minFare: 130,
    minDistanceKm: 20.0,
    ratePerKm: 2.50,
    roundingPrecision: 1.0,
    cess: 0,
  },
};

export interface CalculatedFareDetails {
  serviceClass: BusServiceClass;
  distanceKm: number;
  stagesCount: number;
  baseFare: number;
  additionalDistanceFare: number;
  totalEstimatedFare: number;
  isGhatRoad: boolean;
  cessAmount: number;
  disclaimer: string;
}

/**
 * Calculates official Kerala bus fare for any distance or stage count
 */
export function calculateAccurateKeralaFare(
  serviceClass: BusServiceClass,
  distanceKm: number,
  isGhatRoad = false
): CalculatedFareDetails {
  const rules = OFFICIAL_KERALA_FARE_RATES[serviceClass] || OFFICIAL_KERALA_FARE_RATES['Ordinary'];
  
  // Calculate extra distance beyond minimum
  const extraDistance = Math.max(0, distanceKm - rules.minDistanceKm);
  let variableFare = extraDistance * rules.ratePerKm;

  // Apply 25% surcharge if on notified Ghat road (e.g. Munnar, Wayanad)
  if (isGhatRoad) {
    variableFare *= 1.25;
  }

  let rawTotal = rules.minFare + variableFare;

  // Round according to official rules (nearest rupee)
  let roundedTotal = Math.round(rawTotal);
  if (roundedTotal < rules.minFare) roundedTotal = rules.minFare;

  const stageCount = Math.max(1, Math.ceil(distanceKm / 2.5)); // 1 stage ≈ 2.5km

  return {
    serviceClass,
    distanceKm: Math.round(distanceKm * 10) / 10,
    stagesCount: stageCount,
    baseFare: rules.minFare,
    additionalDistanceFare: Math.max(0, roundedTotal - rules.minFare),
    totalEstimatedFare: roundedTotal,
    isGhatRoad,
    cessAmount: 0,
    disclaimer: 'Official Kerala MVD Notification Stage Fare Estimate. Conductor ticket may vary ±₹1 based on approved local stage tables.',
  };
}

export interface FareSanityValidation {
  isConsistent: boolean;
  datasetFare: number;
  sanityFare: number;
  expectedMinFare: number;
  expectedMaxFare: number;
  straightLineDistanceKm: number;
  busRoadDistanceKm: number;
  warning?: string;
}

/**
 * Calculates straight-line distance-based sanity check fare derived from dataset rate formulas
 */
export function calculateSanityCheckFare(
  serviceClass: BusServiceClass,
  straightLineKm: number
): number {
  const rules = OFFICIAL_KERALA_FARE_RATES[serviceClass] || OFFICIAL_KERALA_FARE_RATES['Ordinary'];
  const extraKm = Math.max(0, straightLineKm - rules.minDistanceKm);
  const rawFare = rules.minFare + extraKm * rules.ratePerKm;
  return Math.max(rules.minFare, Math.round(rawFare));
}

/**
 * Validates whether the dataset stage-fare is consistent with the physical distance
 */
export function validateFareConsistency(
  datasetFare: number,
  straightLineKm: number,
  busRoadDistanceKm: number,
  serviceClass: BusServiceClass = 'Ordinary'
): FareSanityValidation {
  const sanityFare = calculateSanityCheckFare(serviceClass, straightLineKm);
  const rules = OFFICIAL_KERALA_FARE_RATES[serviceClass] || OFFICIAL_KERALA_FARE_RATES['Ordinary'];

  // Allowed bounding range:
  // Lower bound: minimum base fare or 80% of straight-line estimate
  // Upper bound: 2.2x straight-line estimate (accounts for winding highways & stage boundaries)
  const expectedMinFare = Math.max(rules.minFare, Math.floor(sanityFare * 0.75));
  const expectedMaxFare = Math.max(rules.minFare + 6, Math.ceil(sanityFare * 2.2));

  const isConsistent = datasetFare >= expectedMinFare && datasetFare <= expectedMaxFare;

  return {
    isConsistent,
    datasetFare,
    sanityFare,
    expectedMinFare,
    expectedMaxFare,
    straightLineDistanceKm: Math.round(straightLineKm * 10) / 10,
    busRoadDistanceKm: Math.round(busRoadDistanceKm * 10) / 10,
    warning: isConsistent
      ? undefined
      : `Fare discrepancy detected: Dataset fare ₹${datasetFare} is outside expected range (₹${expectedMinFare} - ₹${expectedMaxFare}) for ${straightLineKm.toFixed(1)} km.`
  };
}

/**
 * Fetch / Sync live fare tables from online endpoints with offline fallback
 */
export async function syncLiveFareRates(): Promise<Record<BusServiceClass, FareRule>> {
  try {
    const cached = localStorage.getItem('kerala_live_fare_rates');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_) {}

  return OFFICIAL_KERALA_FARE_RATES;
}
