import { midpointMonth } from "@/lib/matching/dateRange";
import type {
  DateRange,
  Destination,
  DestinationRatings,
  EligibilityReason,
  ParticipantEligibility,
  ParticipantInput,
  ScoreBreakdown,
} from "@/lib/matching/types";

function countWithReason(eligibility: ParticipantEligibility[], reason: EligibilityReason): number {
  return eligibility.filter((entry) => entry.reasons.includes(reason)).length;
}

function people(count: number): string {
  return count === 1 ? "1 participant" : `${count} participants`;
}

const ACTIVITY_LABELS: Record<keyof DestinationRatings, string> = {
  beach: "beach",
  nightlife: "nightlife",
  food: "food",
  luxury: "luxury",
  culture: "culture",
  adventure: "adventure",
};

/** Which activity dimensions the group most strongly cares about and would love here. */
function standoutActivityDimensions(
  attendees: ParticipantInput[],
  destination: Destination,
): string[] {
  const dimensions = Object.keys(ACTIVITY_LABELS) as (keyof DestinationRatings)[];
  const standouts: { dimension: keyof DestinationRatings; strength: number }[] = [];

  for (const dimension of dimensions) {
    const interested = attendees.filter((p) => p.softPreferences[dimension] >= 3);
    if (interested.length === 0) continue;

    const rating = destination.ratings[dimension];
    const avgFit =
      interested.reduce((sum, p) => sum + (1 - Math.abs(p.softPreferences[dimension] - rating) / 5), 0) /
      interested.length;

    if (avgFit >= 0.8 && rating >= 3) {
      standouts.push({ dimension, strength: avgFit * rating });
    }
  }

  return standouts
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map(({ dimension }) => ACTIVITY_LABELS[dimension]);
}

export interface ExplainInput {
  allParticipants: ParticipantInput[];
  attendees: ParticipantInput[];
  eligibility: ParticipantEligibility[];
  destination: Destination;
  window: DateRange;
  breakdown: ScoreBreakdown;
}

export function explainMatch({
  allParticipants,
  attendees,
  eligibility,
  destination,
  window,
  breakdown,
}: ExplainInput): { positives: string[]; compromises: string[] } {
  const positives: string[] = [];
  const compromises: string[] = [];
  const totalParticipants = allParticipants.length;
  const eligibleCount = eligibility.filter((e) => e.eligible).length;

  // 1. Availability
  if (breakdown.availability === 1) {
    positives.push("Everyone's available");
  } else {
    compromises.push(`Only ${eligibleCount} of ${totalParticipants} can make these dates`);
  }

  // 2. Budget
  const overBudgetCount = countWithReason(eligibility, "OVER_BUDGET");
  if (overBudgetCount > 0) {
    compromises.push(`${people(overBudgetCount)} would be over budget here`);
  } else if (breakdown.budget >= 0.85) {
    positives.push("Within group budget");
  } else if (breakdown.budget < 0.6) {
    compromises.push("A bit of a stretch for some budgets");
  }

  // 3. Trip length
  if (breakdown.tripLength < 0.6) {
    compromises.push("The trip length isn't ideal for everyone");
  }

  // 4. Climate
  const month = midpointMonth(window);
  const inSeason = destination.warmMonths.includes(month);
  if (breakdown.climate >= 0.85) {
    positives.push(inSeason && (destination.climate === "hot" || destination.climate === "warm")
      ? "Warm weather"
      : "Good climate match");
  } else if (breakdown.climate < 0.5) {
    compromises.push("The weather might not suit everyone");
  }

  // 5. Activities
  if (breakdown.activity >= 0.75) {
    for (const dimension of standoutActivityDimensions(attendees, destination)) {
      positives.push(`Strong ${dimension} match`);
    }
  } else if (breakdown.activity < 0.5) {
    compromises.push("May not match everyone's idea of a good time");
  }

  // 6. Flight time
  const flightTooLongCount = countWithReason(eligibility, "FLIGHT_TOO_LONG");
  if (flightTooLongCount > 0) {
    compromises.push(`${people(flightTooLongCount)} said this flight is longer than they'd like`);
  } else if (breakdown.flightTime >= 0.8) {
    positives.push("Short flight");
  } else if (breakdown.flightTime < 0.4) {
    compromises.push("It's a long flight for the group");
  }

  // 7. Destination preference
  const requestedCount = attendees.filter((p) =>
    p.softPreferences.preferredDestinationIds.includes(destination.id),
  ).length;
  if (requestedCount > 0) {
    positives.push(`${people(requestedCount)} specifically wanted to come here`);
  }

  // 8. Destination exclusion
  const excludedCount = countWithReason(eligibility, "EXCLUDED_DESTINATION");
  if (excludedCount > 0) {
    compromises.push(`${people(excludedCount)} asked to avoid this destination`);
  }

  return { positives, compromises };
}
