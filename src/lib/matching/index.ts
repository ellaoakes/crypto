export { estimateCostPerPersonRange, estimateTypicalCostPerPerson } from "@/lib/matching/cost";
export {
  addDays,
  findCandidateWindows,
  isAvailableOn,
  isDateInRange,
  midpointMonth,
  rangeLengthDays,
  rangesOverlap,
} from "@/lib/matching/dateRange";
export { DESTINATIONS, findDestinationById } from "@/lib/matching/destinations";
export { computeEligibility, computeGroupEligibility } from "@/lib/matching/eligibility";
export { explainMatch } from "@/lib/matching/explain";
export { deriveHorizon, deriveTripLengthDays, matchDestinations } from "@/lib/matching/engine";
export { combineScore, computeScoreBreakdown, SCORE_WEIGHTS } from "@/lib/matching/scoring";
export type {
  CandidateWindow,
  ClimatePreference,
  ClimateType,
  DateRange,
  Destination,
  DestinationRatings,
  EligibilityReason,
  HardConstraints,
  IsoDate,
  MatchOptions,
  MatchResult,
  ParticipantEligibility,
  ParticipantInput,
  ScoreBreakdown,
  SoftPreferences,
  UkDepartureCity,
} from "@/lib/matching/types";
export { UK_DEPARTURE_CITIES } from "@/lib/matching/types";
