import { describe, expect, it } from "vitest";

import {
  addDays,
  findCandidateWindows,
  isAvailableOn,
  isDateInRange,
  midpointMonth,
  rangeLengthDays,
  rangesOverlap,
} from "@/lib/matching/dateRange";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-05-01", 5)).toBe("2026-05-06");
  });

  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("subtracts with negative values", () => {
    expect(addDays("2026-05-01", -1)).toBe("2026-04-30");
  });
});

describe("rangeLengthDays", () => {
  it("counts an inclusive range", () => {
    expect(rangeLengthDays({ start: "2026-05-14", end: "2026-05-17" })).toBe(4);
  });

  it("returns 1 for a single day", () => {
    expect(rangeLengthDays({ start: "2026-05-14", end: "2026-05-14" })).toBe(1);
  });
});

describe("isDateInRange", () => {
  it("includes both endpoints", () => {
    const range = { start: "2026-05-14", end: "2026-05-17" };
    expect(isDateInRange("2026-05-14", range)).toBe(true);
    expect(isDateInRange("2026-05-17", range)).toBe(true);
  });

  it("excludes dates outside the range", () => {
    const range = { start: "2026-05-14", end: "2026-05-17" };
    expect(isDateInRange("2026-05-13", range)).toBe(false);
    expect(isDateInRange("2026-05-18", range)).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(
      rangesOverlap(
        { start: "2026-05-01", end: "2026-05-10" },
        { start: "2026-05-10", end: "2026-05-20" },
      ),
    ).toBe(true);
  });

  it("detects non-overlapping ranges", () => {
    expect(
      rangesOverlap(
        { start: "2026-05-01", end: "2026-05-09" },
        { start: "2026-05-10", end: "2026-05-20" },
      ),
    ).toBe(false);
  });
});

describe("isAvailableOn", () => {
  it("is available inside an available range with no blackout", () => {
    expect(
      isAvailableOn(
        "2026-05-15",
        [{ start: "2026-05-01", end: "2026-05-31" }],
        [],
      ),
    ).toBe(true);
  });

  it("is unavailable outside every available range", () => {
    expect(
      isAvailableOn(
        "2026-06-01",
        [{ start: "2026-05-01", end: "2026-05-31" }],
        [],
      ),
    ).toBe(false);
  });

  it("a blackout range overrides an otherwise-available date", () => {
    expect(
      isAvailableOn(
        "2026-05-15",
        [{ start: "2026-05-01", end: "2026-05-31" }],
        [{ start: "2026-05-14", end: "2026-05-16" }],
      ),
    ).toBe(false);
  });
});

describe("midpointMonth", () => {
  it("returns the month a range mostly sits in", () => {
    expect(midpointMonth({ start: "2026-05-14", end: "2026-05-17" })).toBe(5);
  });

  it("handles a range spanning a month boundary", () => {
    // 4-day range (30, 31, 1, 2) — the rounded midpoint falls on June 1st.
    expect(midpointMonth({ start: "2026-05-30", end: "2026-06-02" })).toBe(6);
  });
});

describe("findCandidateWindows", () => {
  const horizon = { start: "2026-06-01", end: "2026-06-30" };

  it("finds the window where the most participants overlap", () => {
    const participants = [
      { id: "a", availableRanges: [{ start: "2026-06-10", end: "2026-06-20" }], hardConstraints: { blackoutRanges: [] } },
      { id: "b", availableRanges: [{ start: "2026-06-12", end: "2026-06-22" }], hardConstraints: { blackoutRanges: [] } },
      { id: "c", availableRanges: [{ start: "2026-06-01", end: "2026-06-05" }], hardConstraints: { blackoutRanges: [] } },
    ];

    const windows = findCandidateWindows(participants, 3, horizon, 1);

    expect(windows).toHaveLength(1);
    expect(windows[0].availableParticipantIds.sort()).toEqual(["a", "b"]);
    // The overlap of a & b is 12th-20th; any 3-day window inside it works.
    expect(windows[0].range.start >= "2026-06-12").toBe(true);
    expect(windows[0].range.end <= "2026-06-20").toBe(true);
  });

  it("respects blackout ranges even within an available range", () => {
    const participants = [
      {
        id: "a",
        availableRanges: [{ start: "2026-06-01", end: "2026-06-30" }],
        hardConstraints: { blackoutRanges: [{ start: "2026-06-01", end: "2026-06-27" }] },
      },
    ];

    // Only the 28th-30th are free; the earliest fully-available 2-day window
    // is 28th-29th (29th-30th also qualifies but loses the earliest-start tiebreak).
    const windows = findCandidateWindows(participants, 2, horizon, 1);
    expect(windows[0].range).toEqual({ start: "2026-06-28", end: "2026-06-29" });
    expect(windows[0].availableParticipantIds).toEqual(["a"]);
  });

  it("returns multiple non-overlapping windows when requested", () => {
    const participants = [
      { id: "a", availableRanges: [{ start: "2026-06-01", end: "2026-06-30" }], hardConstraints: { blackoutRanges: [] } },
      { id: "b", availableRanges: [{ start: "2026-06-01", end: "2026-06-30" }], hardConstraints: { blackoutRanges: [] } },
    ];

    const windows = findCandidateWindows(participants, 3, horizon, 3);
    expect(windows).toHaveLength(3);
    // No two windows should share a day.
    for (let i = 0; i < windows.length; i += 1) {
      for (let j = i + 1; j < windows.length; j += 1) {
        const overlap =
          windows[i].range.start <= windows[j].range.end &&
          windows[j].range.start <= windows[i].range.end;
        expect(overlap).toBe(false);
      }
    }
  });

  it("returns an empty array when the horizon is shorter than the trip length", () => {
    const windows = findCandidateWindows(
      [{ id: "a", availableRanges: [{ start: "2026-06-01", end: "2026-06-02" }], hardConstraints: { blackoutRanges: [] } }],
      10,
      { start: "2026-06-01", end: "2026-06-02" },
      1,
    );
    expect(windows).toEqual([]);
  });

  it("still returns a best-effort window when nobody is fully available", () => {
    // Neither participant's range is long enough to contain a full 5-day window.
    const participants = [
      { id: "a", availableRanges: [{ start: "2026-06-01", end: "2026-06-03" }], hardConstraints: { blackoutRanges: [] } },
      { id: "b", availableRanges: [{ start: "2026-06-20", end: "2026-06-22" }], hardConstraints: { blackoutRanges: [] } },
    ];

    const windows = findCandidateWindows(participants, 5, horizon, 1);
    expect(windows).toHaveLength(1);
    expect(windows[0].availableParticipantIds).toEqual([]);
  });

  it("rejects a non-positive length", () => {
    expect(() => findCandidateWindows([], 0, horizon, 1)).toThrow();
  });
});
