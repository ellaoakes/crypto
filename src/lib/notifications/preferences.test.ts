import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  CHANNELS,
  DEFAULT_PREFERENCES,
  isEnabled,
  resolvePreferences,
  type StoredPreference,
} from "@/lib/notifications/preferences";

describe("default preferences", () => {
  it("puts everything in the in-app list, which costs nobody anything", () => {
    for (const category of CATEGORIES) {
      expect(DEFAULT_PREFERENCES[category].IN_APP).toBe(true);
    }
  });

  it("emails only what needs acting on", () => {
    expect(DEFAULT_PREFERENCES.PAYMENT_PROBLEM.EMAIL).toBe(true);
    expect(DEFAULT_PREFERENCES.PAYMENT_REMINDER.EMAIL).toBe(true);
    // Routine receipts and other people's activity would be most of the mail.
    expect(DEFAULT_PREFERENCES.PAYMENT_RECEIPT.EMAIL).toBe(false);
    expect(DEFAULT_PREFERENCES.TRIP_PAYMENT_ACTIVITY.EMAIL).toBe(false);
  });

  it("never pushes until someone asks for it", () => {
    for (const category of CATEGORIES) {
      expect(DEFAULT_PREFERENCES[category].PUSH).toBe(false);
    }
  });

  it("has an answer for every category on every channel", () => {
    for (const category of CATEGORIES) {
      for (const channel of CHANNELS) {
        expect(typeof DEFAULT_PREFERENCES[category][channel]).toBe("boolean");
      }
    }
  });
});

describe("isEnabled", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(isEnabled("PAYMENT_RECEIPT", "IN_APP", [])).toBe(true);
    expect(isEnabled("PAYMENT_RECEIPT", "EMAIL", [])).toBe(false);
  });

  it("lets someone switch something off", () => {
    const stored: StoredPreference[] = [
      { category: "PAYMENT_RECEIPT", channel: "IN_APP", enabled: false },
    ];

    expect(isEnabled("PAYMENT_RECEIPT", "IN_APP", stored)).toBe(false);
  });

  it("lets someone switch something on", () => {
    const stored: StoredPreference[] = [
      { category: "PAYMENT_RECEIPT", channel: "EMAIL", enabled: true },
    ];

    expect(isEnabled("PAYMENT_RECEIPT", "EMAIL", stored)).toBe(true);
  });

  it("applies an override to that category and channel only", () => {
    const stored: StoredPreference[] = [
      { category: "PAYMENT_RECEIPT", channel: "EMAIL", enabled: true },
    ];

    expect(isEnabled("PAYMENT_REMINDER", "EMAIL", stored)).toBe(true); // default
    expect(isEnabled("PAYMENT_RECEIPT", "PUSH", stored)).toBe(false); // default
  });
});

describe("resolvePreferences", () => {
  it("returns the full grid", () => {
    const resolved = resolvePreferences([]);

    expect(Object.keys(resolved).sort()).toEqual([...CATEGORIES].sort());
    for (const category of CATEGORIES) {
      expect(Object.keys(resolved[category]).sort()).toEqual([...CHANNELS].sort());
    }
  });

  it("layers overrides on top of the defaults", () => {
    const resolved = resolvePreferences([
      { category: "PAYMENT_PROBLEM", channel: "EMAIL", enabled: false },
      { category: "PAYMENT_RECEIPT", channel: "PUSH", enabled: true },
    ]);

    expect(resolved.PAYMENT_PROBLEM.EMAIL).toBe(false);
    expect(resolved.PAYMENT_RECEIPT.PUSH).toBe(true);
    expect(resolved.PAYMENT_REMINDER.EMAIL).toBe(true);
  });

  it("ignores a stored preference for something that no longer exists", () => {
    const resolved = resolvePreferences([
      { category: "SOMETHING_RETIRED" as never, channel: "EMAIL", enabled: true },
    ]);

    expect(resolved.PAYMENT_RECEIPT.EMAIL).toBe(false);
  });
});
