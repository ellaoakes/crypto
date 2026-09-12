import { describe, expect, it } from "vitest";

import { computeEligibility, computeGroupEligibility } from "@/lib/matching/eligibility";
import { makeParticipant } from "@/lib/matching/testFixtures";
import type { Destination } from "@/lib/matching/types";

const destination: Destination = {
  id: "marbella-spain",
  name: "Marbella",
  country: "Spain",
  region: "Costa del Sol",
  climate: "hot",
  warmMonths: [5, 6, 7, 8, 9],
  flightHoursByDeparture: { London: 2.6, Manchester: 2.9, Birmingham: 2.7, Edinburgh: 3.1 },
  basePricePerPersonPerNight: 95,
  ratings: { beach: 5, nightlife: 4, food: 4, luxury: 4, culture: 2, adventure: 2 },
  tags: [],
};

const window = { start: "2026-06-14", end: "2026-06-17" };

describe("computeEligibility", () => {
  it("is eligible when every hard constraint passes", () => {
    const participant = makeParticipant();
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result).toEqual({ participantId: "p1", eligible: true, reasons: [] });
  });

  it("flags UNAVAILABLE_DATES when the participant isn't in the date-available set", () => {
    const participant = makeParticipant();
    const result = computeEligibility(participant, destination, window, new Set());
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("UNAVAILABLE_DATES");
  });

  it("flags EXCLUDED_DESTINATION when the destination is on their exclusion list", () => {
    const participant = makeParticipant({
      hardConstraints: { blackoutRanges: [], excludedDestinationIds: ["marbella-spain"] },
    });
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("EXCLUDED_DESTINATION");
  });

  it("flags FLIGHT_TOO_LONG when the flight exceeds their explicit max", () => {
    const participant = makeParticipant({
      hardConstraints: { blackoutRanges: [], excludedDestinationIds: [], maxFlightTimeHours: 2 },
    });
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("FLIGHT_TOO_LONG");
  });

  it("does not flag flight time when no max was given", () => {
    const participant = makeParticipant();
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result.reasons).not.toContain("FLIGHT_TOO_LONG");
  });

  it("flags OVER_BUDGET when the typical cost exceeds their explicit max", () => {
    const participant = makeParticipant({
      hardConstraints: { blackoutRanges: [], excludedDestinationIds: [], maxBudgetPerPerson: 50 },
    });
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("OVER_BUDGET");
  });

  it("does not flag budget when no max was given, however expensive the destination", () => {
    const participant = makeParticipant();
    const result = computeEligibility(participant, destination, window, new Set(["p1"]));
    expect(result.reasons).not.toContain("OVER_BUDGET");
  });

  it("can report multiple simultaneous violations", () => {
    const participant = makeParticipant({
      hardConstraints: {
        blackoutRanges: [],
        excludedDestinationIds: ["marbella-spain"],
        maxBudgetPerPerson: 10,
        maxFlightTimeHours: 1,
      },
    });
    const result = computeEligibility(participant, destination, window, new Set());
    expect(result.reasons.sort()).toEqual(
      ["EXCLUDED_DESTINATION", "FLIGHT_TOO_LONG", "OVER_BUDGET", "UNAVAILABLE_DATES"].sort(),
    );
  });
});

describe("computeGroupEligibility", () => {
  it("computes eligibility for every participant independently", () => {
    const participants = [
      makeParticipant({ id: "a" }),
      makeParticipant({
        id: "b",
        hardConstraints: { blackoutRanges: [], excludedDestinationIds: ["marbella-spain"] },
      }),
    ];

    const results = computeGroupEligibility(participants, destination, window, new Set(["a", "b"]));

    expect(results.find((r) => r.participantId === "a")?.eligible).toBe(true);
    expect(results.find((r) => r.participantId === "b")?.eligible).toBe(false);
  });
});
