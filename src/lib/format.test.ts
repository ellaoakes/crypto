import { describe, expect, it } from "vitest";

import {
  formatCostPerPersonRange,
  formatDateRangeWithYear,
  formatFlightHoursRange,
} from "@/lib/format";

describe("formatDateRangeWithYear", () => {
  it("formats a range within the same month", () => {
    expect(formatDateRangeWithYear({ start: "2027-05-14", end: "2027-05-17" })).toBe(
      "14–17 May 2027",
    );
  });

  it("formats a range spanning two months", () => {
    expect(formatDateRangeWithYear({ start: "2027-04-30", end: "2027-05-03" })).toBe(
      "30 April – 3 May 2027",
    );
  });
});

describe("formatCostPerPersonRange", () => {
  it("formats with thousands separators", () => {
    expect(formatCostPerPersonRange({ min: 650, max: 820 })).toBe("£650–£820 pp");
    expect(formatCostPerPersonRange({ min: 1200, max: 1850 })).toBe("£1,200–£1,850 pp");
  });
});

describe("formatFlightHoursRange", () => {
  it("collapses a near-identical range to a single approximate value", () => {
    expect(formatFlightHoursRange({ min: 2.6, max: 2.61 })).toBe("~2.6h flight");
  });

  it("shows a range when departure cities differ meaningfully", () => {
    expect(formatFlightHoursRange({ min: 2.6, max: 3.1 })).toBe("2.6h–3.1h flight");
  });
});
