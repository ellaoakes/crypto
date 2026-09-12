import { describe, expect, it } from "vitest";

import {
  completeOnboardingSchema,
  createTripSchema,
  emailSchema,
  joinTripSchema,
} from "@/lib/validation";

describe("createTripSchema", () => {
  it("accepts a reasonable trip name", () => {
    const result = createTripSchema.safeParse({ name: "Portugal 2026" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace", () => {
    const result = createTripSchema.safeParse({ name: "  Portugal 2026  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Portugal 2026");
    }
  });

  it("rejects names that are too short", () => {
    const result = createTripSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects names over 80 characters", () => {
    const result = createTripSchema.safeParse({ name: "A".repeat(81) });
    expect(result.success).toBe(false);
  });
});

describe("joinTripSchema", () => {
  it("accepts a non-empty invite code", () => {
    expect(joinTripSchema.safeParse({ inviteCode: "abc123" }).success).toBe(
      true,
    );
  });

  it("rejects an empty invite code", () => {
    expect(joinTripSchema.safeParse({ inviteCode: "" }).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    expect(emailSchema.safeParse("friend@example.com").success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("completeOnboardingSchema", () => {
  const base = {
    tripId: "trip-1",
    tripLengthKey: "week",
    budgetKey: "mid",
    preferences: ["beach", "food"],
  };

  it("accepts specific months without requiring flexibility", () => {
    const result = completeOnboardingSchema.safeParse({
      ...base,
      months: ["2026-06"],
      isFlexibleOnDates: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts flexible with no months selected", () => {
    const result = completeOnboardingSchema.safeParse({
      ...base,
      months: [],
      isFlexibleOnDates: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects no months and not flexible", () => {
    const result = completeOnboardingSchema.safeParse({
      ...base,
      months: [],
      isFlexibleOnDates: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown trip length key", () => {
    const result = completeOnboardingSchema.safeParse({
      ...base,
      months: ["2026-06"],
      isFlexibleOnDates: false,
      tripLengthKey: "eternity",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown preference", () => {
    const result = completeOnboardingSchema.safeParse({
      ...base,
      months: ["2026-06"],
      isFlexibleOnDates: false,
      preferences: ["skiing"],
    });
    expect(result.success).toBe(false);
  });
});
