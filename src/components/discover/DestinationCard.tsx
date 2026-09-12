import Link from "next/link";

import { DestinationBanner } from "@/components/discover/DestinationBanner";
import { VoteButton } from "@/components/discover/VoteButton";
import { formatCostPerPersonRange, formatDateRangeWithYear, formatFlightHoursRange } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";

export function DestinationCard({
  tripId,
  result,
  voted,
  voteCount,
}: {
  tripId: string;
  result: MatchResult;
  voted: boolean;
  voteCount: number;
}) {
  const { destination, dates, matchScore, attendingCount, totalParticipants } = result;

  return (
    <article className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
      <DestinationBanner destination={destination} matchScore={matchScore} headingTag="h3" />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1 text-sm text-teal-950">
          <p className="font-medium">{formatDateRangeWithYear(dates)}</p>
          <p>{formatCostPerPersonRange(result.estimatedCostPerPersonRange)}</p>
          <p className="text-teal-950/60">
            {attendingCount} of {totalParticipants} can attend ·{" "}
            {formatFlightHoursRange(result.estimatedFlightHoursRange)}
          </p>
        </div>

        {result.keyMatchingFactors.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-teal-800">
            {result.keyMatchingFactors.map((factor) => (
              <li key={factor} className="flex gap-1.5">
                <span aria-hidden="true">✓</span>
                {factor}
              </li>
            ))}
          </ul>
        ) : null}

        {result.compromises.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-amber-700">
            {result.compromises.map((compromise) => (
              <li key={compromise} className="flex gap-1.5">
                <span aria-hidden="true">⚠</span>
                {compromise}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <Link href={`/trips/${tripId}/discover/${destination.id}`} className="sm:flex-1">
            <span className="flex h-11 w-full items-center justify-center rounded-lg border border-teal-200 px-4 text-sm font-medium text-teal-900 transition-colors hover:bg-teal-50">
              View destination
            </span>
          </Link>
          <VoteButton
            tripId={tripId}
            destinationId={destination.id}
            initialVoted={voted}
            initialCount={voteCount}
          />
        </div>
      </div>
    </article>
  );
}
