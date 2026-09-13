import { describe, expect, it } from "vitest";

import { formatMinor, formatMinorCompact, parseMajorToMinor, PLATFORM_FEE_MINOR } from "@/lib/payments/money";

describe("money", () => {
  it("fixes the platform fee at £5", () => {
    expect(PLATFORM_FEE_MINOR).toBe(500);
    expect(formatMinor(PLATFORM_FEE_MINOR)).toBe("£5.00");
  });

  it("formats minor units for display", () => {
    expect(formatMinor(120_000)).toBe("£1,200.00");
    expect(formatMinor(20_050)).toBe("£200.50");
  });

  it("drops trailing zeroes in the compact form", () => {
    expect(formatMinorCompact(120_000)).toBe("£1,200");
    expect(formatMinorCompact(20_050)).toBe("£200.50");
  });

  it("parses amounts people actually type", () => {
    expect(parseMajorToMinor("1200")).toBe(120_000);
    expect(parseMajorToMinor("1,200")).toBe(120_000);
    expect(parseMajorToMinor("£1,200.50")).toBe(120_050);
    expect(parseMajorToMinor(" 200 ")).toBe(20_000);
    expect(parseMajorToMinor("200.5")).toBe(20_050);
  });

  it("adds money without floating-point drift", () => {
    expect(parseMajorToMinor("0.10") + parseMajorToMinor("0.20")).toBe(30);
  });

  it("rejects anything that isn't a plain amount", () => {
    for (const input of ["", "abc", "12.345", "-5", "1e3"]) {
      expect(() => parseMajorToMinor(input)).toThrowError(
        expect.objectContaining({ code: "INVALID_AMOUNT" }),
      );
    }
  });
});
