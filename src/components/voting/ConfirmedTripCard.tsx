import { DestinationBanner } from "@/components/discover/DestinationBanner";
import { Card } from "@/components/ui/Card";
import { formatCostPerPersonRange, formatDateRangeWithYear } from "@/lib/format";
import { findDestinationById, type DateRange } from "@/lib/matching";

/**
 * The confirmed state everyone sees once the organizer has locked the trip.
 * Reads the dates stored on the trip at lock time, so it keeps showing what
 * was actually agreed even if preferences change afterwards.
 */
export function ConfirmedTripCard({
  destinationId,
  dates,
  estimatedCostPerPersonRange,
}: {
  destinationId: string;
  dates: DateRange;
  estimatedCostPerPersonRange?: { min: number; max: number };
}) {
  const destination = findDestinationById(destinationId);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-emerald-600 px-4 py-3 text-center">
        <p className="font-semibold text-white">🎉 This trip is confirmed</p>
      </div>

      {destination ? (
        <div className="overflow-hidden rounded-2xl">
          <DestinationBanner destination={destination} size="hero" headingTag="h2" />
        </div>
      ) : null}

      <Card className="flex flex-col gap-2">
        <p className="font-medium text-teal-950">{formatDateRangeWithYear(dates)}</p>
        {estimatedCostPerPersonRange ? (
          <p className="text-teal-950">
            {formatCostPerPersonRange(estimatedCostPerPersonRange)}
          </p>
        ) : null}
        <p className="text-sm text-teal-950/60">
          Voting is closed. Only the organizer can reopen the trip for changes.
        </p>
      </Card>
    </div>
  );
}
