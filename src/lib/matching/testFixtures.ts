import type { HardConstraints, ParticipantInput, SoftPreferences } from "@/lib/matching/types";

type ParticipantOverrides = Omit<
  Partial<ParticipantInput>,
  "hardConstraints" | "softPreferences"
> & {
  hardConstraints?: Partial<HardConstraints>;
  softPreferences?: Partial<SoftPreferences>;
};

/** Builds a fully-specified participant with sensible neutral defaults, for tests. */
export function makeParticipant(overrides: ParticipantOverrides = {}): ParticipantInput {
  const { hardConstraints, softPreferences, ...rest } = overrides;

  return {
    id: "p1",
    name: "Test Participant",
    departureCity: "London",
    availableRanges: [{ start: "2026-06-01", end: "2026-06-30" }],
    ...rest,
    hardConstraints: {
      blackoutRanges: [],
      excludedDestinationIds: [],
      ...hardConstraints,
    },
    softPreferences: {
      targetBudgetPerPerson: 700,
      preferredTripLengthDays: { min: 4, max: 7 },
      preferredClimate: "any",
      beach: 0,
      nightlife: 0,
      food: 0,
      luxury: 0,
      culture: 0,
      adventure: 0,
      preferredDestinationIds: [],
      ...softPreferences,
    },
  };
}
