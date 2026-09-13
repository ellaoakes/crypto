/**
 * Turns a confirmed trip's database row into the structured shape the
 * confirmed-trip dashboard renders.
 *
 * Everything here comes from the snapshot written when the organizer locked
 * the trip in — the UI never recomputes or invents a destination, a date, a
 * headcount or a price. If any part of that snapshot is missing (or the trip
 * isn't confirmed at all), this returns null and the caller shows the
 * planning experience instead of a half-filled celebration.
 */
import { findDestinationById, rangeLengthDays, type DateRange, type Destination } from "@/lib/matching";

export interface ConfirmedTrip {
  destination: Destination;
  dates: DateRange;
  /** Nights away, derived from the confirmed dates. */
  nights: number;
  /** Participants whose availability covered these dates when it was confirmed. */
  attendingUserIds: string[];
  attendingCount: number;
  /** Null when the trip was confirmed before costs were snapshotted. */
  estimatedCostPerPersonRange: { min: number; max: number } | null;
  confirmedAt: Date | null;
}

export interface ConfirmableTripRow {
  status: string;
  confirmedDestinationId: string | null;
  confirmedDateStart: Date | null;
  confirmedDateEnd: Date | null;
  confirmedAt: Date | null;
  confirmedCostMin: number | null;
  confirmedCostMax: number | null;
  confirmedAttendingUserIds: unknown;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUserIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function toConfirmedTrip(trip: ConfirmableTripRow): ConfirmedTrip | null {
  if (trip.status !== "CONFIRMED") return null;
  if (!trip.confirmedDestinationId || !trip.confirmedDateStart || !trip.confirmedDateEnd) return null;

  const destination = findDestinationById(trip.confirmedDestinationId);
  if (!destination) return null;

  const dates: DateRange = {
    start: toIsoDate(trip.confirmedDateStart),
    end: toIsoDate(trip.confirmedDateEnd),
  };
  const attendingUserIds = parseUserIds(trip.confirmedAttendingUserIds);

  return {
    destination,
    dates,
    nights: Math.max(rangeLengthDays(dates) - 1, 0),
    attendingUserIds,
    attendingCount: attendingUserIds.length,
    estimatedCostPerPersonRange:
      trip.confirmedCostMin !== null && trip.confirmedCostMax !== null
        ? { min: trip.confirmedCostMin, max: trip.confirmedCostMax }
        : null,
    confirmedAt: trip.confirmedAt,
  };
}
