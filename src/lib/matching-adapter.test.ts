import { describe, expect, it } from "vitest";

import { toParticipantInput } from "@/lib/matching-adapter";

function baseRow(overrides: Partial<Parameters<typeof toParticipantInput>[0]> = {}) {
  return {
    userId: "user-1",
    user: { name: "Alex", email: "alex@example.com" },
    availabilityWindows: [{ startDate: new Date("2026-06-01"), endDate: new Date("2026-06-30") }],
    blackoutWindows: [],
    preference: {
      budgetPerPerson: 650,
      tripLengthMinDays: 6,
      tripLengthMaxDays: 8,
      destinationPrefs: [],
      priorities: ["beach", "nightlife"],
      departureCity: "London",
      preferredClimate: "any",
      maxBudgetPerPerson: null,
      maxFlightTimeHours: null,
      excludedDestinationIds: [],
    },
    ...overrides,
  };
}

describe("toParticipantInput", () => {
  it("returns null when the participant hasn't submitted preferences yet", () => {
    expect(toParticipantInput(baseRow({ preference: null }))).toBeNull();
  });

  it("maps availability windows to ISO date ranges", () => {
    const input = toParticipantInput(baseRow())!;
    expect(input.availableRanges).toEqual([{ start: "2026-06-01", end: "2026-06-30" }]);
  });

  it("maps selected onboarding tags to a fixed activity weight, and unselected ones to 0", () => {
    const input = toParticipantInput(baseRow())!;
    expect(input.softPreferences.beach).toBeGreaterThan(0);
    expect(input.softPreferences.nightlife).toBeGreaterThan(0);
    expect(input.softPreferences.food).toBe(0);
    expect(input.softPreferences.culture).toBe(0);
    expect(input.softPreferences.adventure).toBe(0);
  });

  it("always defaults luxury to 0 — onboarding never asks about it", () => {
    const input = toParticipantInput(baseRow())!;
    expect(input.softPreferences.luxury).toBe(0);
  });

  it("falls back to London for an unrecognized departure city", () => {
    const input = toParticipantInput(
      baseRow({ preference: { ...baseRow().preference!, departureCity: "Atlantis" } }),
    )!;
    expect(input.departureCity).toBe("London");
  });

  it("falls back to 'any' for an unrecognized climate value", () => {
    const input = toParticipantInput(
      baseRow({ preference: { ...baseRow().preference!, preferredClimate: "tropical-ish" } }),
    )!;
    expect(input.softPreferences.preferredClimate).toBe("any");
  });

  it("treats malformed JSON array fields as empty rather than throwing", () => {
    const input = toParticipantInput(
      baseRow({
        preference: {
          ...baseRow().preference!,
          priorities: { not: "an array" },
          destinationPrefs: "also not an array",
          excludedDestinationIds: null,
        },
      }),
    )!;
    expect(input.softPreferences.preferredDestinationIds).toEqual([]);
    expect(input.hardConstraints.excludedDestinationIds).toEqual([]);
  });

  it("passes through explicit hard caps when present", () => {
    const input = toParticipantInput(
      baseRow({
        preference: {
          ...baseRow().preference!,
          maxBudgetPerPerson: 500,
          maxFlightTimeHours: 4,
        },
      }),
    )!;
    expect(input.hardConstraints.maxBudgetPerPerson).toBe(500);
    expect(input.hardConstraints.maxFlightTimeHours).toBe(4);
  });

  it("leaves hard caps undefined (not null) when not set", () => {
    const input = toParticipantInput(baseRow())!;
    expect(input.hardConstraints.maxBudgetPerPerson).toBeUndefined();
    expect(input.hardConstraints.maxFlightTimeHours).toBeUndefined();
  });

  it("uses the user's name, falling back to their email", () => {
    const withName = toParticipantInput(baseRow())!;
    expect(withName.name).toBe("Alex");

    const withoutName = toParticipantInput(
      baseRow({ user: { name: null, email: "no-name@example.com" } }),
    )!;
    expect(withoutName.name).toBe("no-name@example.com");
  });

  it("maps blackout windows to ISO date ranges", () => {
    const input = toParticipantInput(
      baseRow({ blackoutWindows: [{ startDate: new Date("2026-06-10"), endDate: new Date("2026-06-12") }] }),
    )!;
    expect(input.hardConstraints.blackoutRanges).toEqual([{ start: "2026-06-10", end: "2026-06-12" }]);
  });
});
