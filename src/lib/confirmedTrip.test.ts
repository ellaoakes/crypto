import { describe, expect, it } from "vitest";

import { toConfirmedTrip, type ConfirmableTripRow } from "@/lib/confirmedTrip";

const confirmedRow: ConfirmableTripRow = {
  status: "CONFIRMED",
  confirmedDestinationId: "marbella-spain",
  confirmedDateStart: new Date("2027-05-14T00:00:00Z"),
  confirmedDateEnd: new Date("2027-05-17T00:00:00Z"),
  confirmedAt: new Date("2026-09-13T10:00:00Z"),
  confirmedCostMin: 700,
  confirmedCostMax: 850,
  confirmedAttendingUserIds: ["a", "b", "c"],
};

describe("toConfirmedTrip", () => {
  it("builds the confirmed view from the snapshot", () => {
    const confirmed = toConfirmedTrip(confirmedRow);

    expect(confirmed).not.toBeNull();
    expect(confirmed?.destination.name).toBe("Marbella");
    expect(confirmed?.dates).toEqual({ start: "2027-05-14", end: "2027-05-17" });
    expect(confirmed?.attendingCount).toBe(3);
    expect(confirmed?.estimatedCostPerPersonRange).toEqual({ min: 700, max: 850 });
  });

  it("derives nights from the confirmed dates", () => {
    expect(toConfirmedTrip(confirmedRow)?.nights).toBe(3);
  });

  it("never reports negative nights for a same-day range", () => {
    const sameDay = toConfirmedTrip({
      ...confirmedRow,
      confirmedDateEnd: new Date("2027-05-14T00:00:00Z"),
    });

    expect(sameDay?.nights).toBe(0);
  });

  it("returns null while the trip is still being planned", () => {
    expect(toConfirmedTrip({ ...confirmedRow, status: "RECOMMENDING" })).toBeNull();
  });

  it("returns null rather than a half-filled celebration when dates are missing", () => {
    expect(toConfirmedTrip({ ...confirmedRow, confirmedDateStart: null })).toBeNull();
    expect(toConfirmedTrip({ ...confirmedRow, confirmedDateEnd: null })).toBeNull();
  });

  it("returns null when the snapshotted destination no longer exists", () => {
    expect(toConfirmedTrip({ ...confirmedRow, confirmedDestinationId: "atlantis" })).toBeNull();
  });

  it("omits the cost rather than inventing one when it wasn't snapshotted", () => {
    const confirmed = toConfirmedTrip({
      ...confirmedRow,
      confirmedCostMin: null,
      confirmedCostMax: null,
    });

    expect(confirmed?.estimatedCostPerPersonRange).toBeNull();
  });

  it("ignores non-string entries in the attendee snapshot", () => {
    const confirmed = toConfirmedTrip({
      ...confirmedRow,
      confirmedAttendingUserIds: ["a", 7, null, "b"],
    });

    expect(confirmed?.attendingUserIds).toEqual(["a", "b"]);
    expect(confirmed?.attendingCount).toBe(2);
  });

  it("treats a malformed attendee snapshot as nobody confirmed", () => {
    const confirmed = toConfirmedTrip({ ...confirmedRow, confirmedAttendingUserIds: "oops" });

    expect(confirmed?.attendingUserIds).toEqual([]);
  });
});
