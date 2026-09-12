import { describe, expect, it } from "vitest";

import { estimateCostPerPersonRange, estimateTypicalCostPerPerson } from "@/lib/matching/cost";
import type { Destination } from "@/lib/matching/types";

const destination: Destination = {
  id: "test-dest",
  name: "Test Destination",
  country: "Testland",
  region: "Test Region",
  climate: "hot",
  warmMonths: [6, 7, 8],
  flightHoursByDeparture: { London: 3, Manchester: 3.2, Birmingham: 3.1, Edinburgh: 3.4 },
  basePricePerPersonPerNight: 100,
  ratings: { beach: 5, nightlife: 3, food: 3, luxury: 3, culture: 2, adventure: 2 },
  tags: [],
};

describe("estimateCostPerPersonRange", () => {
  it("scales with the number of nights", () => {
    const threeNights = estimateCostPerPersonRange(destination, {
      start: "2026-07-01",
      end: "2026-07-04",
    });
    const sixNights = estimateCostPerPersonRange(destination, {
      start: "2026-07-01",
      end: "2026-07-07",
    });
    expect(sixNights.min).toBeGreaterThan(threeNights.min);
    expect(sixNights.max).toBeGreaterThan(threeNights.max);
  });

  it("returns a min lower than max", () => {
    const { min, max } = estimateCostPerPersonRange(destination, {
      start: "2026-07-01",
      end: "2026-07-04",
    });
    expect(min).toBeLessThan(max);
  });

  it("costs more in-season than out-of-season for the same length", () => {
    const inSeason = estimateCostPerPersonRange(destination, {
      start: "2026-07-01",
      end: "2026-07-04",
    });
    const outOfSeason = estimateCostPerPersonRange(destination, {
      start: "2026-01-01",
      end: "2026-01-04",
    });
    expect(inSeason.min).toBeGreaterThan(outOfSeason.min);
  });

  it("never returns a non-positive value even for a same-day window", () => {
    const { min } = estimateCostPerPersonRange(destination, {
      start: "2026-07-01",
      end: "2026-07-01",
    });
    expect(min).toBeGreaterThan(0);
  });
});

describe("estimateTypicalCostPerPerson", () => {
  it("is the midpoint of the range", () => {
    const window = { start: "2026-07-01", end: "2026-07-04" };
    const { min, max } = estimateCostPerPersonRange(destination, window);
    expect(estimateTypicalCostPerPerson(destination, window)).toBe(Math.round((min + max) / 2));
  });
});
