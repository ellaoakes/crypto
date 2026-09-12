/**
 * Pure mapping from trip-participant DB rows to the matching engine's
 * input shape. No Prisma import here on purpose — this file (and its
 * tests) shouldn't need a database or environment variables to run.
 */
import {
  UK_DEPARTURE_CITIES,
  type ClimatePreference,
  type ParticipantInput,
  type UkDepartureCity,
} from "@/lib/matching";

const CLIMATE_VALUES: readonly string[] = ["hot", "warm", "mild", "cool", "any"];

/**
 * Onboarding today only collects a flat "did they pick this tag" signal
 * (no 0-5 intensity), so a selected tag maps to a fairly-important weight
 * rather than a maxed-out one. "Luxury" isn't one of onboarding's tags, so
 * it's always neutral until a future preferences screen asks about it.
 */
const SELECTED_TAG_WEIGHT = 4;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDepartureCity(value: string): UkDepartureCity {
  return (UK_DEPARTURE_CITIES as readonly string[]).includes(value)
    ? (value as UkDepartureCity)
    : "London";
}

function parseClimatePreference(value: string): ClimatePreference {
  return CLIMATE_VALUES.includes(value) ? (value as ClimatePreference) : "any";
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export interface ParticipantRow {
  userId: string;
  user: { name: string | null; email: string };
  availabilityWindows: { startDate: Date; endDate: Date }[];
  blackoutWindows: { startDate: Date; endDate: Date }[];
  preference: {
    budgetPerPerson: number;
    tripLengthMinDays: number;
    tripLengthMaxDays: number;
    destinationPrefs: unknown;
    priorities: unknown;
    departureCity: string;
    preferredClimate: string;
    maxBudgetPerPerson: number | null;
    maxFlightTimeHours: number | null;
    excludedDestinationIds: unknown;
  } | null;
}

/**
 * Maps one participant's DB rows to the engine's input shape. Returns null
 * if they haven't submitted their preferences yet — there's nothing
 * meaningful to match on.
 */
export function toParticipantInput(participant: ParticipantRow): ParticipantInput | null {
  if (!participant.preference) return null;
  const { preference } = participant;
  const selectedTags = parseStringArray(preference.priorities);
  const tagWeight = (tag: string) => (selectedTags.includes(tag) ? SELECTED_TAG_WEIGHT : 0);

  return {
    id: participant.userId,
    name: participant.user.name ?? participant.user.email,
    departureCity: parseDepartureCity(preference.departureCity),
    availableRanges: participant.availabilityWindows.map((window) => ({
      start: toIsoDate(window.startDate),
      end: toIsoDate(window.endDate),
    })),
    hardConstraints: {
      blackoutRanges: participant.blackoutWindows.map((window) => ({
        start: toIsoDate(window.startDate),
        end: toIsoDate(window.endDate),
      })),
      maxBudgetPerPerson: preference.maxBudgetPerPerson ?? undefined,
      maxFlightTimeHours: preference.maxFlightTimeHours ?? undefined,
      excludedDestinationIds: parseStringArray(preference.excludedDestinationIds),
    },
    softPreferences: {
      targetBudgetPerPerson: preference.budgetPerPerson,
      preferredTripLengthDays: {
        min: preference.tripLengthMinDays,
        max: preference.tripLengthMaxDays,
      },
      preferredClimate: parseClimatePreference(preference.preferredClimate),
      beach: tagWeight("beach"),
      nightlife: tagWeight("nightlife"),
      food: tagWeight("food"),
      culture: tagWeight("culture"),
      adventure: tagWeight("adventure"),
      luxury: 0,
      preferredDestinationIds: parseStringArray(preference.destinationPrefs),
    },
  };
}
