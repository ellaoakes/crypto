import { estimateCostPerPersonRange } from "@/lib/matching/cost";
import { addDays, findCandidateWindows } from "@/lib/matching/dateRange";
import { DESTINATIONS } from "@/lib/matching/destinations";
import { computeGroupEligibility } from "@/lib/matching/eligibility";
import { explainMatch } from "@/lib/matching/explain";
import { combineScore, computeScoreBreakdown } from "@/lib/matching/scoring";
import type {
  DateRange,
  Destination,
  MatchOptions,
  MatchResult,
  ParticipantInput,
} from "@/lib/matching/types";

/**
 * A trip length (nights) that's compatible with as many participants as
 * possible: the intersection of everyone's [min, max] range, or — if no
 * single length satisfies everyone — the median of each participant's own
 * midpoint, so the search still runs and each participant's own soft
 * trip-length score reflects how much of a compromise it was for them.
 */
export function deriveTripLengthDays(participants: ParticipantInput[]): number {
  const ranges = participants.map((p) => p.softPreferences.preferredTripLengthDays);
  const lowerBound = Math.max(...ranges.map((r) => r.min));
  const upperBound = Math.min(...ranges.map((r) => r.max));

  if (lowerBound <= upperBound) {
    return Math.round((lowerBound + upperBound) / 2);
  }

  const midpoints = ranges.map((r) => (r.min + r.max) / 2).sort((a, b) => a - b);
  const median = midpoints[Math.floor(midpoints.length / 2)];
  return Math.max(1, Math.round(median));
}

/** The span covering every participant's stated availability. */
export function deriveHorizon(participants: ParticipantInput[]): DateRange {
  const allRanges = participants.flatMap((p) => p.availableRanges);

  if (allRanges.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: addDays(today, 365) };
  }

  return {
    start: allRanges.reduce((earliest, r) => (r.start < earliest ? r.start : earliest), allRanges[0].start),
    end: allRanges.reduce((latest, r) => (r.end > latest ? r.end : latest), allRanges[0].end),
  };
}

function scoreOneWindow(
  participants: ParticipantInput[],
  destination: Destination,
  window: DateRange,
  dateAvailableParticipantIds: ReadonlySet<string>,
): MatchResult {
  const eligibility = computeGroupEligibility(participants, destination, window, dateAvailableParticipantIds);
  const attendees = participants.filter(
    (p) => eligibility.find((e) => e.participantId === p.id)?.eligible,
  );
  const breakdown = computeScoreBreakdown(participants, eligibility, destination, window);
  const matchScore = combineScore(breakdown);
  const { positives, compromises } = explainMatch({
    allParticipants: participants,
    attendees,
    eligibility,
    destination,
    window,
    breakdown,
  });

  // Flight time is reported for whoever would actually go; if nobody can,
  // fall back to the whole group so the figure is still meaningful.
  const flightCohort = attendees.length > 0 ? attendees : participants;
  const flightHours = flightCohort.map((p) => destination.flightHoursByDeparture[p.departureCity]);

  return {
    destination,
    dates: window,
    matchScore,
    attendingParticipantIds: attendees.map((p) => p.id),
    attendingCount: attendees.length,
    totalParticipants: participants.length,
    percentageMatched:
      participants.length === 0 ? 0 : Math.round((attendees.length / participants.length) * 100),
    estimatedCostPerPersonRange: estimateCostPerPersonRange(destination, window),
    estimatedFlightHoursRange: { min: Math.min(...flightHours), max: Math.max(...flightHours) },
    scoreBreakdown: breakdown,
    keyMatchingFactors: positives,
    compromises,
  };
}

/**
 * Scores every destination against the group's combined constraints and
 * preferences, returning one best-fit result per destination, sorted by
 * match score descending.
 *
 * Pure and deterministic: the same participants, destinations and options
 * always produce the same output.
 */
export function matchDestinations(
  participants: ParticipantInput[],
  destinations: Destination[] = DESTINATIONS,
  options: MatchOptions = {},
): MatchResult[] {
  if (participants.length === 0 || destinations.length === 0) {
    return [];
  }

  const {
    horizon = deriveHorizon(participants),
    maxCandidateWindows = 3,
    minGroupCoveragePercent = 0,
    maxResults,
  } = options;

  const tripLengthDays = Math.max(1, deriveTripLengthDays(participants));
  const candidateWindows = findCandidateWindows(
    participants,
    tripLengthDays,
    horizon,
    maxCandidateWindows,
  );

  if (candidateWindows.length === 0) {
    return [];
  }

  const results: MatchResult[] = [];

  for (const destination of destinations) {
    let best: MatchResult | null = null;

    for (const candidate of candidateWindows) {
      const dateAvailableIds = new Set(candidate.availableParticipantIds);
      const result = scoreOneWindow(participants, destination, candidate.range, dateAvailableIds);
      if (best === null || result.matchScore > best.matchScore) {
        best = result;
      }
    }

    if (best && best.percentageMatched >= minGroupCoveragePercent) {
      results.push(best);
    }
  }

  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.destination.name.localeCompare(b.destination.name);
  });

  return maxResults !== undefined ? results.slice(0, maxResults) : results;
}
