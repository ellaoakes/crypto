import { describe, expect, it } from "vitest";

import { monthKeyToRange, nextMonthKeys } from "@/lib/dates";

describe("monthKeyToRange", () => {
  it("returns the first and last day of the given month", () => {
    const { start, end } = monthKeyToRange("2026-02");
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("handles a leap year February", () => {
    const { end } = monthKeyToRange("2028-02");
    expect(end.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("handles December correctly (year rollover)", () => {
    const { start, end } = monthKeyToRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});

describe("nextMonthKeys", () => {
  it("returns the requested number of consecutive month keys starting this month", () => {
    const keys = nextMonthKeys(3, new Date(Date.UTC(2026, 10, 15)));
    expect(keys).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});
