import { midpointMonth, rangeLengthDays } from "@/lib/matching/dateRange";
import type { DateRange, Destination } from "@/lib/matching/types";

/**
 * Estimated per-person cost range for a destination over a given date
 * window: base nightly rate (flights amortized + hotel + spend), scaled by
 * trip length and a seasonal multiplier, then spread into a plausible
 * range rather than a single false-precision number.
 */
export function estimateCostPerPersonRange(
  destination: Destination,
  window: DateRange,
): { min: number; max: number } {
  const nights = Math.max(1, rangeLengthDays(window) - 1);
  const month = midpointMonth(window);
  const inSeason = destination.warmMonths.includes(month);
  const seasonalMultiplier = inSeason ? 1.15 : 0.9;
  const base = destination.basePricePerPersonPerNight * nights * seasonalMultiplier;

  return {
    min: Math.round(base * 0.9),
    max: Math.round(base * 1.15),
  };
}

export function estimateTypicalCostPerPerson(destination: Destination, window: DateRange): number {
  const { min, max } = estimateCostPerPersonRange(destination, window);
  return Math.round((min + max) / 2);
}
