import { describe, expect, it } from "vitest";

import { explainMatch } from "@/lib/matching/explain";
import { computeScoreBreakdown } from "@/lib/matching/scoring";
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

function run(allParticipants: ReturnType<typeof makeParticipant>[], eligibility: ParticipantEligibility[]) {
  const attendees = allParticipants.filter((p) =>
    eligibility.find((e) => e.participantId === p.id && e.eligible),
  );
  const breakdown = computeScoreBreakdown(allParticipants, eligibility, marbella, window);
  return explainMatch({ allParticipants, attendees, eligibility, destination: marbella, window, breakdown });
}

describe("explainMatch", () => {
  it("celebrates full availability and a comfortable budget", () => {
    const participants = [
      makeParticipant({ id: "a", softPreferences: { targetBudgetPerPerson: 100_000, beach: 5, nightlife: 4 } }),
      makeParticipant({ id: "b", softPreferences: { targetBudgetPerPerson: 100_000, beach: 5, nightlife: 4 } }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: true, reasons: [] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { positives, compromises } = run(participants, eligibility);

    expect(positives).toContain("Everyone's available");
    expect(positives).toContain("Within group budget");
    expect(compromises.some((c) => c.toLowerCase().includes("budget"))).toBe(false);
  });

  it("flags a partial group and explains why", () => {
    const participants = [makeParticipant({ id: "a" }), makeParticipant({ id: "b" })];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: true, reasons: [] },
      { participantId: "b", eligible: false, reasons: ["UNAVAILABLE_DATES"] },
    ];

    const { compromises } = run(participants, eligibility);
    expect(compromises).toContain("Only 1 of 2 can make these dates");
  });

  it("calls out participants who would be over budget", () => {
    const participants = [
      makeParticipant({ id: "a", hardConstraints: { maxBudgetPerPerson: 10 } }),
      makeParticipant({ id: "b" }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: false, reasons: ["OVER_BUDGET"] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { compromises } = run(participants, eligibility);
    expect(compromises.some((c) => c.includes("over budget"))).toBe(true);
  });

  it("calls out participants who excluded the destination", () => {
    const participants = [
      makeParticipant({ id: "a", hardConstraints: { excludedDestinationIds: ["marbella-spain"] } }),
      makeParticipant({ id: "b" }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: false, reasons: ["EXCLUDED_DESTINATION"] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { compromises } = run(participants, eligibility);
    expect(compromises.some((c) => c.includes("avoid this destination"))).toBe(true);
  });

  it("calls out a flight that's too long for someone", () => {
    const participants = [
      makeParticipant({ id: "a", hardConstraints: { maxFlightTimeHours: 1 } }),
      makeParticipant({ id: "b" }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: false, reasons: ["FLIGHT_TOO_LONG"] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { compromises } = run(participants, eligibility);
    expect(compromises.some((c) => c.includes("longer than they'd like"))).toBe(true);
  });

  it("praises a strong activity match when preferences align with the destination", () => {
    const participants = [
      makeParticipant({ id: "a", softPreferences: { nightlife: 5, beach: 5 } }),
      makeParticipant({ id: "b", softPreferences: { nightlife: 4, beach: 4 } }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: true, reasons: [] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { positives } = run(participants, eligibility);
    expect(positives.some((p) => p.includes("nightlife") || p.includes("beach"))).toBe(true);
  });

  it("notes when someone specifically requested the destination", () => {
    const participants = [
      makeParticipant({ id: "a", softPreferences: { preferredDestinationIds: ["marbella-spain"] } }),
      makeParticipant({ id: "b" }),
    ];
    const eligibility: ParticipantEligibility[] = [
      { participantId: "a", eligible: true, reasons: [] },
      { participantId: "b", eligible: true, reasons: [] },
    ];

    const { positives } = run(participants, eligibility);
    expect(positives.some((p) => p.includes("specifically wanted"))).toBe(true);
  });

  it("never crashes and returns arrays even with a single, fully-neutral participant", () => {
    const participants = [makeParticipant({ id: "a" })];
    const eligibility: ParticipantEligibility[] = [{ participantId: "a", eligible: true, reasons: [] }];
    const { positives, compromises } = run(participants, eligibility);
    expect(Array.isArray(positives)).toBe(true);
    expect(Array.isArray(compromises)).toBe(true);
  });
});
