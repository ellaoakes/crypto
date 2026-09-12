import type { CandidateWindow, DateRange, IsoDate } from "@/lib/matching/types";

/** Epoch day number (days since 1970-01-01 UTC) — arithmetic without timezone footguns. */
function toEpochDay(iso: IsoDate): number {
  return Math.floor(Date.parse(`${iso}T00:00:00.000Z`) / 86_400_000);
}

function fromEpochDay(day: number): IsoDate {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(iso) + days);
}

/** Number of days in an inclusive range, e.g. Mon-Wed is 3. */
export function rangeLengthDays(range: DateRange): number {
  return toEpochDay(range.end) - toEpochDay(range.start) + 1;
}

export function isDateInRange(date: IsoDate, range: DateRange): boolean {
  const d = toEpochDay(date);
  return d >= toEpochDay(range.start) && d <= toEpochDay(range.end);
}

export function isDateInAnyRange(date: IsoDate, ranges: DateRange[]): boolean {
  return ranges.some((range) => isDateInRange(date, range));
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return toEpochDay(a.start) <= toEpochDay(b.end) && toEpochDay(b.start) <= toEpochDay(a.end);
}

/** A candidate window overlaps another if they share any day. */
export function windowsOverlap(a: DateRange, b: DateRange): boolean {
  return rangesOverlap(a, b);
}

/** The month (1-12) a date range is mostly in — used for seasonal climate lookups. */
export function midpointMonth(range: DateRange): number {
  const midDay = Math.round((toEpochDay(range.start) + toEpochDay(range.end)) / 2);
  return Number(fromEpochDay(midDay).slice(5, 7));
}

/**
 * Whether a participant is available on a given day: within at least one
 * available range, and not inside any blackout range.
 */
export function isAvailableOn(
  date: IsoDate,
  availableRanges: DateRange[],
  blackoutRanges: DateRange[],
): boolean {
  return isDateInAnyRange(date, availableRanges) && !isDateInAnyRange(date, blackoutRanges);
}

interface Participant {
  id: string;
  availableRanges: DateRange[];
  hardConstraints: { blackoutRanges: DateRange[] };
}

/**
 * Scans a date horizon for the best `windowCount` non-overlapping windows of
 * length `lengthDays`, ranked by how many participants are available for
 * every single day of the window. Ties break by earliest start date.
 *
 * Deliberately O(horizonDays × lengthDays × participants) — all three are
 * small in practice (a year, a couple of weeks, a handful of people) so the
 * straightforward approach stays fast and easy to verify.
 */
export function findCandidateWindows(
  participants: Participant[],
  lengthDays: number,
  horizon: DateRange,
  windowCount: number,
): CandidateWindow[] {
  if (lengthDays < 1) {
    throw new Error("lengthDays must be at least 1");
  }

  const horizonStart = toEpochDay(horizon.start);
  const horizonEnd = toEpochDay(horizon.end);
  const lastPossibleStart = horizonEnd - lengthDays + 1;

  if (lastPossibleStart < horizonStart) {
    return [];
  }

  const candidates: CandidateWindow[] = [];

  for (let startDay = horizonStart; startDay <= lastPossibleStart; startDay += 1) {
    const range: DateRange = {
      start: fromEpochDay(startDay),
      end: fromEpochDay(startDay + lengthDays - 1),
    };

    const availableParticipantIds = participants
      .filter((participant) => {
        for (let offset = 0; offset < lengthDays; offset += 1) {
          const day = fromEpochDay(startDay + offset);
          if (
            !isAvailableOn(
              day,
              participant.availableRanges,
              participant.hardConstraints.blackoutRanges,
            )
          ) {
            return false;
          }
        }
        return true;
      })
      .map((participant) => participant.id);

    candidates.push({ range, availableParticipantIds });
  }

  // Best coverage first, then earliest date, so results are deterministic.
  candidates.sort((a, b) => {
    if (b.availableParticipantIds.length !== a.availableParticipantIds.length) {
      return b.availableParticipantIds.length - a.availableParticipantIds.length;
    }
    return toEpochDay(a.range.start) - toEpochDay(b.range.start);
  });

  const selected: CandidateWindow[] = [];
  for (const candidate of candidates) {
    if (selected.length >= windowCount) break;
    if (selected.some((existing) => windowsOverlap(existing.range, candidate.range))) {
      continue;
    }
    selected.push(candidate);
  }

  return selected;
}
