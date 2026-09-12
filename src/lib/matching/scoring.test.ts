import { describe, expect, it } from "vitest";

import {
  combineScore,
  computeScoreBreakdown,
  SCORE_WEIGHTS,
  scoreActivity,
  scoreAvailability,
  scoreBudget,
  scoreClimate,
  scoreDestinationExclusion,
  scoreDestinationPreference,
  scoreFlightTime,
  scoreTripLength,
} from "@/lib/matching/scoring";
import { makeParticipant } from "@/lib/matching/testFixtures";
import type { Destination, ParticipantEligibility } from "@/lib/matching/types";

const marbella: Destination = {
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

function eligible(participantIds: string[]): ParticipantEligibility[] {
  return participantIds.map((participantId) => ({ participantId, eligible: true, reasons: [] }));
}

describe("SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("scoreAvailability", () => {
  it("is 1 when everyone is eligible", () => {
    expect(scoreAvailability(5, 5)).toBe(1);
  });

  it("is 0 when nobody is eligible", () => {
    expect(scoreAvailability(5, 0)).toBe(0);
  });

  it("is proportional in between", () => {
    expect(scoreAvailability(4, 2)).toBe(0.5);
  });

  it("handles zero participants without dividing by zero", () => {
    expect(scoreAvailability(0, 0)).toBe(0);
  });
});

describe("scoreBudget", () => {
  it("scores 1 when the cost is at or under everyone's target", () => {
    const attendees = [makeParticipant({ softPreferences: { targetBudgetPerPerson: 100_000 } })];
    expect(scoreBudget(attendees, marbella, window)).toBe(1);
  });

  it("tapers down as cost exceeds the target", () => {
    const attendees = [makeParticipant({ softPreferences: { targetBudgetPerPerson: 10 } })];
    const score = scoreBudget(attendees, marbella, window);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("falls back to a neutral value with no attendees", () => {
    expect(scoreBudget([], marbella, window)).toBe(0.75);
  });
});

describe("scoreTripLength", () => {
  it("scores 1 when the window length is within everyone's preferred range", () => {
    const attendees = [
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 2, max: 10 } } }),
    ];
    expect(scoreTripLength(attendees, window)).toBe(1);
  });

  it("tapers when the window is shorter than preferred", () => {
    const attendees = [
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 10, max: 14 } } }),
    ];
    const score = scoreTripLength(attendees, window);
    expect(score).toBeLessThan(1);
  });

  it("tapers when the window is longer than preferred", () => {
    const attendees = [
      makeParticipant({ softPreferences: { preferredTripLengthDays: { min: 1, max: 2 } } }),
    ];
    const score = scoreTripLength(attendees, window);
    expect(score).toBeLessThan(1);
  });
});

describe("scoreClimate", () => {
  it("scores 1 for participants happy with any climate", () => {
    const attendees = [makeParticipant({ softPreferences: { preferredClimate: "any" } })];
    expect(scoreClimate(attendees, marbella, window)).toBe(1);
  });

  it("scores 1 when preference matches the in-season climate", () => {
    const attendees = [makeParticipant({ softPreferences: { preferredClimate: "hot" } })];
    expect(scoreClimate(attendees, marbella, window)).toBe(1);
  });

  it("scores lower the further the preference is from the seasonal climate", () => {
    const mildPref = [makeParticipant({ softPreferences: { preferredClimate: "mild" } })];
    const coolPref = [makeParticipant({ softPreferences: { preferredClimate: "cool" } })];
    const mildScore = scoreClimate(mildPref, marbella, window);
    const coolScore = scoreClimate(coolPref, marbella, window);
    expect(coolScore).toBeLessThan(mildScore);
    expect(mildScore).toBeLessThan(1);
  });

  it("uses a cooler effective climate outside the warm season", () => {
    const attendees = [makeParticipant({ softPreferences: { preferredClimate: "hot" } })];
    const winterWindow = { start: "2026-01-10", end: "2026-01-13" };
    const winterScore = scoreClimate(attendees, marbella, winterWindow);
    const summerScore = scoreClimate(attendees, marbella, window);
    expect(winterScore).toBeLessThan(summerScore);
  });
});

describe("scoreActivity", () => {
  it("scores highly when preferences closely match destination ratings", () => {
    const attendees = [makeParticipant({ softPreferences: { beach: 5, nightlife: 4 } })];
    expect(scoreActivity(attendees, marbella)).toBeGreaterThan(0.9);
  });

  it("scores lower when preferences are far from destination ratings", () => {
    const attendees = [makeParticipant({ softPreferences: { culture: 5 } })]; // marbella culture=2
    expect(scoreActivity(attendees, marbella)).toBeLessThan(0.6);
  });

  it("falls back to neutral when nobody expressed any activity preference", () => {
    const attendees = [makeParticipant()];
    expect(scoreActivity(attendees, marbella)).toBe(0.75);
  });
});

describe("scoreFlightTime", () => {
  it("scores higher for shorter flights", () => {
    const shortHaul = [makeParticipant({ departureCity: "London" })];
    const score = scoreFlightTime(shortHaul, marbella);
    expect(score).toBeGreaterThan(0.5);
  });

  it("uses the participant's own max as the ceiling when given", () => {
    const strict = [makeParticipant({ hardConstraints: { maxFlightTimeHours: 3 } })];
    const lenient = [makeParticipant({ hardConstraints: { maxFlightTimeHours: 10 } })];
    expect(scoreFlightTime(strict, marbella)).toBeLessThan(scoreFlightTime(lenient, marbella));
  });
});

describe("scoreDestinationPreference", () => {
  it("scores 1 when the destination is on the participant's wishlist", () => {
    const attendees = [
      makeParticipant({ softPreferences: { preferredDestinationIds: ["marbella-spain"] } }),
    ];
    expect(scoreDestinationPreference(attendees, marbella)).toBe(1);
  });

  it("scores lower when they wanted somewhere else specifically", () => {
    const attendees = [
      makeParticipant({ softPreferences: { preferredDestinationIds: ["some-other-place"] } }),
    ];
    expect(scoreDestinationPreference(attendees, marbella)).toBeLessThan(1);
  });

  it("falls back to neutral when nobody expressed a wishlist", () => {
    expect(scoreDestinationPreference([makeParticipant()], marbella)).toBe(0.75);
  });
});

describe("scoreDestinationExclusion", () => {
  it("scores 1 when nobody excluded the destination", () => {
    expect(
      scoreDestinationExclusion([makeParticipant({ id: "a" }), makeParticipant({ id: "b" })], marbella),
    ).toBe(1);
  });

  it("reflects the fraction of the whole group who excluded it, not just attendees", () => {
    const all = [
      makeParticipant({ id: "a", hardConstraints: { excludedDestinationIds: ["marbella-spain"] } }),
      makeParticipant({ id: "b" }),
    ];
    expect(scoreDestinationExclusion(all, marbella)).toBe(0.5);
  });
});

describe("computeScoreBreakdown + combineScore", () => {
  it("produces a full breakdown whose combined score is between 0 and 100", () => {
    const participants = [makeParticipant({ id: "a" }), makeParticipant({ id: "b" })];
    const breakdown = computeScoreBreakdown(participants, eligible(["a", "b"]), marbella, window);
    const score = combineScore(breakdown);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("is deterministic — the same inputs always produce the same score", () => {
    const participants = [makeParticipant({ id: "a" }), makeParticipant({ id: "b" })];
    const score1 = combineScore(computeScoreBreakdown(participants, eligible(["a", "b"]), marbella, window));
    const score2 = combineScore(computeScoreBreakdown(participants, eligible(["a", "b"]), marbella, window));
    expect(score1).toBe(score2);
  });

  it("scores 0 availability contribution when everyone is ineligible", () => {
    const participants = [makeParticipant({ id: "a" })];
    const breakdown = computeScoreBreakdown(
      participants,
      [{ participantId: "a", eligible: false, reasons: ["OVER_BUDGET"] }],
      marbella,
      window,
    );
    expect(breakdown.availability).toBe(0);
  });
});
