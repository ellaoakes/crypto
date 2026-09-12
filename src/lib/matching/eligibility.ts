import { estimateTypicalCostPerPerson } from "@/lib/matching/cost";
import type {
  DateRange,
  Destination,
  EligibilityReason,
  ParticipantEligibility,
  ParticipantInput,
} from "@/lib/matching/types";

/**
 * Whether one participant could actually go on this destination/date
 * combination, checking every hard constraint. Date availability is passed
 * in (already computed once per candidate window by `findCandidateWindows`)
 * rather than recomputed here.
 */
export function computeEligibility(
  participant: ParticipantInput,
  destination: Destination,
  window: DateRange,
  dateAvailableParticipantIds: ReadonlySet<string>,
): ParticipantEligibility {
  const reasons: EligibilityReason[] = [];

  if (!dateAvailableParticipantIds.has(participant.id)) {
    reasons.push("UNAVAILABLE_DATES");
  }

  if (participant.hardConstraints.excludedDestinationIds.includes(destination.id)) {
    reasons.push("EXCLUDED_DESTINATION");
  }

  const { maxFlightTimeHours, maxBudgetPerPerson } = participant.hardConstraints;

  if (maxFlightTimeHours !== undefined) {
    const flightHours = destination.flightHoursByDeparture[participant.departureCity];
    if (flightHours > maxFlightTimeHours) {
      reasons.push("FLIGHT_TOO_LONG");
    }
  }

  if (maxBudgetPerPerson !== undefined) {
    const cost = estimateTypicalCostPerPerson(destination, window);
    if (cost > maxBudgetPerPerson) {
      reasons.push("OVER_BUDGET");
    }
  }

  return { participantId: participant.id, eligible: reasons.length === 0, reasons };
}

export function computeGroupEligibility(
  participants: ParticipantInput[],
  destination: Destination,
  window: DateRange,
  dateAvailableParticipantIds: ReadonlySet<string>,
): ParticipantEligibility[] {
  return participants.map((participant) =>
    computeEligibility(participant, destination, window, dateAvailableParticipantIds),
  );
}
