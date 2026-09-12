import { estimateTypicalCostPerPerson } from "@/lib/matching/cost";
import { midpointMonth, rangeLengthDays } from "@/lib/matching/dateRange";
import type {
  ClimateType,
  DateRange,
  Destination,
  ParticipantEligibility,
  ParticipantInput,
  ScoreBreakdown,
} from "@/lib/matching/types";

/** Relative weight of each component in the final 0-100 score. Sums to 1. */
export const SCORE_WEIGHTS: ScoreBreakdown = {
  availability: 0.3,
  budget: 0.15,
  tripLength: 0.1,
  climate: 0.1,
  activity: 0.15,
  flightTime: 0.1,
  destinationPreference: 0.05,
  destinationExclusion: 0.05,
};

/** A generic "long flight" ceiling used when a participant hasn't set a hard maximum. */
const DEFAULT_FLIGHT_CEILING_HOURS = 6;

/** Used when there's no one left with an opinion to average — a mild, non-committal default. */
const NEUTRAL_FALLBACK = 0.75;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Average of `values`, or `fallback` if the list is empty. Never NaN. */
function safeAverage(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const CLIMATE_ORDER: ClimateType[] = ["cool", "mild", "warm", "hot"];

/** The destination's effective climate for the given window — one notch cooler outside its warm season. */
function seasonalClimate(destination: Destination, window: DateRange): ClimateType {
  const month = midpointMonth(window);
  if (destination.warmMonths.includes(month)) {
    return destination.climate;
  }
  const index = CLIMATE_ORDER.indexOf(destination.climate);
  return CLIMATE_ORDER[Math.max(0, index - 1)];
}

function eligibleParticipants(
  participants: ParticipantInput[],
  eligibility: ParticipantEligibility[],
): ParticipantInput[] {
  const eligibleIds = new Set(
    eligibility.filter((entry) => entry.eligible).map((entry) => entry.participantId),
  );
  return participants.filter((participant) => eligibleIds.has(participant.id));
}

export function scoreAvailability(totalParticipants: number, eligibleCount: number): number {
  if (totalParticipants === 0) return 0;
  return clamp01(eligibleCount / totalParticipants);
}

export function scoreBudget(attendees: ParticipantInput[], destination: Destination, window: DateRange): number {
  const cost = estimateTypicalCostPerPerson(destination, window);
  const fits = attendees.map(({ softPreferences: { targetBudgetPerPerson } }) => {
    if (cost <= targetBudgetPerPerson) return 1;
    return clamp01(1 - (cost - targetBudgetPerPerson) / targetBudgetPerPerson);
  });
  return safeAverage(fits, NEUTRAL_FALLBACK);
}

export function scoreTripLength(attendees: ParticipantInput[], window: DateRange): number {
  const nights = Math.max(1, rangeLengthDays(window) - 1);
  const fits = attendees.map(({ softPreferences: { preferredTripLengthDays } }) => {
    const { min, max } = preferredTripLengthDays;
    if (nights >= min && nights <= max) return 1;
    if (nights < min) return clamp01(1 - (min - nights) / min);
    return clamp01(1 - (nights - max) / max);
  });
  return safeAverage(fits, NEUTRAL_FALLBACK);
}

export function scoreClimate(attendees: ParticipantInput[], destination: Destination, window: DateRange): number {
  const effective = seasonalClimate(destination, window);
  const effectiveIndex = CLIMATE_ORDER.indexOf(effective);

  const fits = attendees.map(({ softPreferences: { preferredClimate } }) => {
    if (preferredClimate === "any") return 1;
    const preferredIndex = CLIMATE_ORDER.indexOf(preferredClimate);
    const distance = Math.abs(preferredIndex - effectiveIndex);
    return clamp01(1 - distance / (CLIMATE_ORDER.length - 1));
  });
  return safeAverage(fits, NEUTRAL_FALLBACK);
}

const ACTIVITY_DIMENSIONS = ["beach", "nightlife", "food", "luxury", "culture", "adventure"] as const;

export function scoreActivity(attendees: ParticipantInput[], destination: Destination): number {
  const participantScores: number[] = [];

  for (const { softPreferences } of attendees) {
    let weightedSum = 0;
    let weightTotal = 0;

    for (const dimension of ACTIVITY_DIMENSIONS) {
      const preference = softPreferences[dimension];
      if (preference <= 0) continue;
      const rating = destination.ratings[dimension];
      const fit = 1 - Math.abs(preference - rating) / 5;
      const weight = preference / 5;
      weightedSum += fit * weight;
      weightTotal += weight;
    }

    if (weightTotal > 0) {
      participantScores.push(clamp01(weightedSum / weightTotal));
    }
  }

  return safeAverage(participantScores, NEUTRAL_FALLBACK);
}

export function scoreFlightTime(attendees: ParticipantInput[], destination: Destination): number {
  const fits = attendees.map((participant) => {
    const hours = destination.flightHoursByDeparture[participant.departureCity];
    const ceiling = participant.hardConstraints.maxFlightTimeHours ?? DEFAULT_FLIGHT_CEILING_HOURS;
    return clamp01(1 - hours / ceiling);
  });
  return safeAverage(fits, NEUTRAL_FALLBACK);
}

export function scoreDestinationPreference(attendees: ParticipantInput[], destination: Destination): number {
  const opinions = attendees
    .filter(({ softPreferences }) => softPreferences.preferredDestinationIds.length > 0)
    .map(({ softPreferences }) =>
      softPreferences.preferredDestinationIds.includes(destination.id) ? 1 : 0.4,
    );
  return safeAverage(opinions, NEUTRAL_FALLBACK);
}

/** Computed over the WHOLE group, not just attendees — this is what makes it distinct from availability. */
export function scoreDestinationExclusion(
  allParticipants: ParticipantInput[],
  destination: Destination,
): number {
  if (allParticipants.length === 0) return NEUTRAL_FALLBACK;
  const excludedCount = allParticipants.filter((participant) =>
    participant.hardConstraints.excludedDestinationIds.includes(destination.id),
  ).length;
  return clamp01(1 - excludedCount / allParticipants.length);
}

export function computeScoreBreakdown(
  allParticipants: ParticipantInput[],
  eligibility: ParticipantEligibility[],
  destination: Destination,
  window: DateRange,
): ScoreBreakdown {
  const attendees = eligibleParticipants(allParticipants, eligibility);
  const eligibleCount = eligibility.filter((entry) => entry.eligible).length;

  return {
    availability: scoreAvailability(allParticipants.length, eligibleCount),
    budget: scoreBudget(attendees, destination, window),
    tripLength: scoreTripLength(attendees, window),
    climate: scoreClimate(attendees, destination, window),
    activity: scoreActivity(attendees, destination),
    flightTime: scoreFlightTime(attendees, destination),
    destinationPreference: scoreDestinationPreference(attendees, destination),
    destinationExclusion: scoreDestinationExclusion(allParticipants, destination),
  };
}

/** Combines a score breakdown into the final 0-100 integer using `SCORE_WEIGHTS`. */
export function combineScore(breakdown: ScoreBreakdown): number {
  const total = (Object.keys(SCORE_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (sum, key) => sum + breakdown[key] * SCORE_WEIGHTS[key],
    0,
  );
  return Math.round(clamp01(total) * 100);
}
