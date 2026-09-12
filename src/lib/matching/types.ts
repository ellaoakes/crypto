/**
 * Types for the group destination-matching engine.
 *
 * This module is intentionally framework- and database-agnostic: no Prisma
 * imports, no Next.js imports. It consumes plain data and returns plain
 * data so it can be unit-tested in isolation and reused from anywhere
 * (a route handler, a script, a future mobile backend).
 *
 * Dates are ISO "YYYY-MM-DD" strings rather than `Date` objects, so results
 * are trivially serializable and comparisons are unaffected by timezones.
 */

export type IsoDate = string;

/** Inclusive date range. */
export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export const UK_DEPARTURE_CITIES = [
  "London",
  "Manchester",
  "Birmingham",
  "Edinburgh",
] as const;

export type UkDepartureCity = (typeof UK_DEPARTURE_CITIES)[number];

export type ClimateType = "hot" | "warm" | "mild" | "cool";
export type ClimatePreference = ClimateType | "any";

/**
 * Hard constraints rule a participant out of a destination/date combination
 * entirely — they are pass/fail, never partially satisfied.
 */
export interface HardConstraints {
  /** Dates the participant absolutely cannot travel, even within an available range. */
  blackoutRanges: DateRange[];
  /** Explicit hard cap in GBP. Undefined means no hard cap was given. */
  maxBudgetPerPerson?: number;
  /** Explicit hard cap in hours. Undefined means no hard cap was given. */
  maxFlightTimeHours?: number;
  /** Destinations this participant will not accept under any circumstances. */
  excludedDestinationIds: string[];
}

/**
 * Soft preferences influence the match score but never disqualify a
 * destination outright. Each 0-5 rating is "how much this matters to me";
 * 0 means the participant has no opinion and the dimension is excluded
 * from their contribution to the group score, rather than penalizing it.
 */
export interface SoftPreferences {
  /** A rough per-person target — not a hard ceiling. */
  targetBudgetPerPerson: number;
  preferredTripLengthDays: { min: number; max: number };
  preferredClimate: ClimatePreference;
  beach: number;
  nightlife: number;
  food: number;
  luxury: number;
  culture: number;
  adventure: number;
  /** Destination ids this participant has specifically asked for. */
  preferredDestinationIds: string[];
}

export interface ParticipantInput {
  id: string;
  name: string;
  departureCity: UkDepartureCity;
  /** Dates the participant is free to travel (positive availability). */
  availableRanges: DateRange[];
  hardConstraints: HardConstraints;
  softPreferences: SoftPreferences;
}

export interface DestinationRatings {
  beach: number;
  nightlife: number;
  food: number;
  luxury: number;
  culture: number;
  adventure: number;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  climate: ClimateType;
  /** 1-12: months this destination is in its warm/high season. */
  warmMonths: number[];
  flightHoursByDeparture: Record<UkDepartureCity, number>;
  /** Blended average cost per person per night — flights amortized, hotel, spending money. GBP. */
  basePricePerPersonPerNight: number;
  ratings: DestinationRatings;
  tags: string[];
}

export type EligibilityReason =
  | "UNAVAILABLE_DATES"
  | "OVER_BUDGET"
  | "FLIGHT_TOO_LONG"
  | "EXCLUDED_DESTINATION";

export interface ParticipantEligibility {
  participantId: string;
  eligible: boolean;
  /** Empty when eligible; otherwise every hard constraint that was violated. */
  reasons: EligibilityReason[];
}

export interface CandidateWindow {
  range: DateRange;
  /** Participant ids who are date-available for every day in this window. */
  availableParticipantIds: string[];
}

/** All component scores are 0-1 fractions; combined via fixed weights into the 0-100 total. */
export interface ScoreBreakdown {
  availability: number;
  budget: number;
  tripLength: number;
  climate: number;
  activity: number;
  flightTime: number;
  destinationPreference: number;
  destinationExclusion: number;
}

export interface MatchResult {
  destination: Destination;
  dates: DateRange;
  matchScore: number;
  attendingParticipantIds: string[];
  attendingCount: number;
  totalParticipants: number;
  percentageMatched: number;
  estimatedCostPerPersonRange: { min: number; max: number };
  estimatedFlightHoursRange: { min: number; max: number };
  scoreBreakdown: ScoreBreakdown;
  keyMatchingFactors: string[];
  compromises: string[];
}

export interface MatchOptions {
  /** Date horizon to search for candidate windows. Defaults to the span of participant availability. */
  horizon?: DateRange;
  /** How many distinct candidate date windows to evaluate per destination. Default 3. */
  maxCandidateWindows?: number;
  /** Drop results where fewer than this percentage of the group could attend. Default 0 (keep everything). */
  minGroupCoveragePercent?: number;
  /** Cap on the number of results returned, sorted by score descending. Default: all. */
  maxResults?: number;
}
