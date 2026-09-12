import { describe, expect, it } from "vitest";

import { DESTINATIONS, findDestinationById } from "@/lib/matching/destinations";
import { UK_DEPARTURE_CITIES } from "@/lib/matching/types";

describe("DESTINATIONS", () => {
  it("has approximately 50 destinations", () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(45);
    expect(DESTINATIONS.length).toBeLessThanOrEqual(55);
  });

  it("has unique ids", () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a flight time from every supported UK departure city", () => {
    for (const destination of DESTINATIONS) {
      for (const city of UK_DEPARTURE_CITIES) {
        const hours = destination.flightHoursByDeparture[city];
        expect(typeof hours).toBe("number");
        expect(hours).toBeGreaterThan(0);
        expect(hours).toBeLessThan(20);
      }
    }
  });

  it("has ratings within 0-5 for every dimension", () => {
    for (const destination of DESTINATIONS) {
      for (const value of Object.values(destination.ratings)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(5);
      }
    }
  });

  it("has warm months within 1-12", () => {
    for (const destination of DESTINATIONS) {
      for (const month of destination.warmMonths) {
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
      }
    }
  });

  it("has a positive base price", () => {
    for (const destination of DESTINATIONS) {
      expect(destination.basePricePerPersonPerNight).toBeGreaterThan(0);
    }
  });
});

describe("findDestinationById", () => {
  it("finds a known destination", () => {
    expect(findDestinationById("marbella-spain")?.name).toBe("Marbella");
  });

  it("returns undefined for an unknown id", () => {
    expect(findDestinationById("nowhere")).toBeUndefined();
  });
});
