import { describe, expect, it } from "vitest";

import { DESTINATIONS, findDestinationById } from "@/lib/matching/destinations";
import { deriveHorizon, deriveTripLengthDays, matchDestinations } from "@/lib/matching/engine";
import { makeParticipant } from "@/lib/matching/testFixtures";
import type { Destination } from "@/lib/matching/types";

const marbella = findDestinationById("marbella-spain")!;
const reykjavik = findDestinationById("reykjavik-iceland")!;

describe("deriveTripLengthDays", () => {
  it("picks the midpoint of the overlapping range when one exists", () => {
    const participants = [
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 4, max: 10 } } }),
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 6, max: 8 } } }),
    ];
    // overlap is [6,8], midpoint 7
    expect(deriveTripLengthDays(participants)).toBe(7);
  });

  it("falls back to a median midpoint when nobody's range overlaps", () => {
    const participants = [
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 2, max: 3 } } }),
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 14, max: 16 } } }),
    ];
    const length = deriveTripLengthDays(participants);
    expect(length).toBeGreaterThan(0);
    expect(Number.isFinite(length)).toBe(true);
  });
});

describe("deriveHorizon", () => {
  it("spans the earliest start to the latest end across all participants", () => {
    const participants = [
      makeParticipant({ availableRanges: [{ start: "2026-05-01", end: "2026-05-31" }] }),
      makeParticipant({ availableRanges: [{ start: "2026-07-01", end: "2026-07-15" }] }),
    ];
    expect(deriveHorizon(participants)).toEqual({ start: "2026-05-01", end: "2026-07-15" });
  });

  it("falls back to a year from today when nobody gave any availability", () => {
    const horizon = deriveHorizon([makeParticipant({ availableRanges: [] })]);
    expect(horizon.start <= horizon.end).toBe(true);
  });
});

describe("matchDestinations", () => {
  it("returns [] for an empty participant list", () => {
    expect(matchDestinations([], DESTINATIONS)).toEqual([]);
  });

  it("returns [] for an empty destination list", () => {
    expect(matchDestinations([makeParticipant()], [])).toEqual([]);
  });

  it("scores a Marbella-like scenario highly when everything lines up", () => {
    const participants = [
      makeParticipant({
        id: "a",
        departureCity: "London",
        availableRanges: [{ start: "2026-05-01", end: "2026-05-31" }],
        softPreferences: {
          targetBudgetPerPerson: 900,
          preferredTripLengthDays: { min: 3, max: 5 },
          preferredClimate: "hot",
          beach: 5,
          nightlife: 4,
        },
      }),
      makeParticipant({
        id: "b",
        departureCity: "Manchester",
        availableRanges: [{ start: "2026-05-01", end: "2026-05-31" }],
        softPreferences: {
          targetBudgetPerPerson: 900,
          preferredTripLengthDays: { min: 3, max: 5 },
          preferredClimate: "hot",
          beach: 5,
          nightlife: 4,
        },
      }),
    ];

    const results = matchDestinations(participants, [marbella], { maxCandidateWindows: 5 });
    expect(results).toHaveLength(1);
    const [top] = results;
    expect(top.matchScore).toBeGreaterThanOrEqual(80);
    expect(top.percentageMatched).toBe(100);
    expect(top.keyMatchingFactors).toContain("Everyone's available");
    expect(top.compromises).toEqual([]);
  });

  it("is deterministic across repeated runs", () => {
    const participants = [makeParticipant({ id: "a" }), makeParticipant({ id: "b" })];
    const first = matchDestinations(participants, DESTINATIONS);
    const second = matchDestinations(participants, DESTINATIONS);
    expect(first).toEqual(second);
  });

  it("runs over the full seeded dataset without error and returns one result per destination", () => {
    const participants = [
      makeParticipant({ id: "a", availableRanges: [{ start: "2026-04-01", end: "2026-09-30" }] }),
      makeParticipant({
        id: "b",
        departureCity: "Edinburgh",
        availableRanges: [{ start: "2026-04-01", end: "2026-09-30" }],
      }),
    ];
    const results = matchDestinations(participants, DESTINATIONS);
    expect(results).toHaveLength(DESTINATIONS.length);
    for (const result of results) {
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(100);
      expect(Number.isFinite(result.estimatedFlightHoursRange.min)).toBe(true);
      expect(Number.isFinite(result.estimatedFlightHoursRange.max)).toBe(true);
      expect(Number.isFinite(result.estimatedCostPerPersonRange.min)).toBe(true);
    }
  });

  it("sorts by match score descending, then destination name", () => {
    const participants = [makeParticipant({ id: "a" }), makeParticipant({ id: "b" })];
    const results = matchDestinations(participants, DESTINATIONS);
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].matchScore).toBeGreaterThanOrEqual(results[i].matchScore);
      if (results[i - 1].matchScore === results[i].matchScore) {
        expect(
          results[i - 1].destination.name.localeCompare(results[i].destination.name),
        ).toBeLessThanOrEqual(0);
      }
    }
  });

  it("respects maxResults", () => {
    const participants = [makeParticipant()];
    const results = matchDestinations(participants, DESTINATIONS, { maxResults: 5 });
    expect(results).toHaveLength(5);
  });

  it("respects minGroupCoveragePercent by dropping low-coverage destinations", () => {
    const participants = [
      makeParticipant({ id: "a", availableRanges: [{ start: "2026-05-01", end: "2026-05-10" }] }),
      makeParticipant({ id: "b", availableRanges: [{ start: "2026-08-01", end: "2026-08-10" }] }),
    ];
    const results = matchDestinations(participants, [marbella], { minGroupCoveragePercent: 100 });
    // Nobody overlaps, so no window has 100% coverage — result should be filtered out.
    expect(results).toEqual([]);
  });

  it("returns 0% coverage (not a crash) when every participant excludes every destination", () => {
    const participants = [
      makeParticipant({ id: "a", hardConstraints: { excludedDestinationIds: [marbella.id] } }),
      makeParticipant({ id: "b", hardConstraints: { excludedDestinationIds: [marbella.id] } }),
    ];
    const results = matchDestinations(participants, [marbella]);
    expect(results).toHaveLength(1);
    expect(results[0].attendingCount).toBe(0);
    expect(results[0].percentageMatched).toBe(0);
    expect(results[0].compromises.some((c) => c.includes("avoid this destination"))).toBe(true);
  });

  it("handles everyone being priced out without crashing", () => {
    const participants = [
      makeParticipant({ id: "a", hardConstraints: { maxBudgetPerPerson: 1 } }),
      makeParticipant({ id: "b", hardConstraints: { maxBudgetPerPerson: 1 } }),
    ];
    const results = matchDestinations(participants, [marbella]);
    expect(results[0].attendingCount).toBe(0);
    expect(results[0].matchScore).toBeGreaterThanOrEqual(0);
    // Flight hours fall back to the whole group when nobody's actually attending.
    expect(Number.isFinite(results[0].estimatedFlightHoursRange.min)).toBe(true);
  });

  it("handles a single participant", () => {
    const results = matchDestinations([makeParticipant()], [marbella]);
    expect(results).toHaveLength(1);
    expect(results[0].totalParticipants).toBe(1);
  });

  it("still returns results when nobody's availability overlaps at all", () => {
    const participants = [
      makeParticipant({ id: "a", availableRanges: [{ start: "2026-05-01", end: "2026-05-05" }] }),
      makeParticipant({ id: "b", availableRanges: [{ start: "2026-09-01", end: "2026-09-05" }] }),
    ];
    const results = matchDestinations(participants, [marbella]);
    expect(results).toHaveLength(1);
    expect(results[0].percentageMatched).toBeLessThan(100);
  });

  it("returns [] when the horizon is shorter than the derived trip length", () => {
    const participants = [
      makeParticipant({
        availableRanges: [{ start: "2026-05-01", end: "2026-05-02" }],
        softPreferences: { preferredTripLengthDays: { min: 10, max: 14 } },
      }),
    ];
    expect(matchDestinations(participants, [marbella])).toEqual([]);
  });

  it("gives a cold-climate lover a better score in Reykjavik than a heat-seeker", () => {
    const coldLover = [
      makeParticipant({
        availableRanges: [{ start: "2026-06-01", end: "2026-08-31" }],
        softPreferences: { preferredClimate: "cool" },
      }),
    ];
    const heatSeeker = [
      makeParticipant({
        availableRanges: [{ start: "2026-06-01", end: "2026-08-31" }],
        softPreferences: { preferredClimate: "hot" },
      }),
    ];

    const coldResult = matchDestinations(coldLover, [reykjavik])[0];
    const heatResult = matchDestinations(heatSeeker, [reykjavik])[0];
    expect(coldResult.scoreBreakdown.climate).toBeGreaterThan(heatResult.scoreBreakdown.climate);
  });

  it("uses the caller-supplied horizon instead of deriving one", () => {
    const participants = [
      makeParticipant({ availableRanges: [{ start: "2026-01-01", end: "2026-12-31" }] }),
    ];
    const results = matchDestinations(participants, [marbella], {
      horizon: { start: "2026-06-01", end: "2026-06-30" },
      maxCandidateWindows: 1,
    });
    expect(results[0].dates.start >= "2026-06-01").toBe(true);
    expect(results[0].dates.end <= "2026-06-30").toBe(true);
  });
});

describe("matchDestinations with a synthetic destination", () => {
  it("favours the destination matching a strict destination preference list", () => {
    const wanted: Destination = {
      id: "wanted",
      name: "Wanted Place",
      country: "Nowhere",
      region: "Nowhere",
      climate: "warm",
      warmMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      flightHoursByDeparture: { London: 3, Manchester: 3, Birmingham: 3, Edinburgh: 3 },
      basePricePerPersonPerNight: 90,
      ratings: { beach: 3, nightlife: 3, food: 3, luxury: 3, culture: 3, adventure: 3 },
      tags: [],
    };
    const notWanted: Destination = { ...wanted, id: "not-wanted", name: "Other Place" };

    const participants = [
      makeParticipant({ softPreferences: { preferredDestinationIds: ["wanted"] } }),
    ];

    const results = matchDestinations(participants, [wanted, notWanted]);
    const wantedResult = results.find((r) => r.destination.id === "wanted")!;
    const notWantedResult = results.find((r) => r.destination.id === "not-wanted")!;
    expect(wantedResult.matchScore).toBeGreaterThan(notWantedResult.matchScore);
  });
});
