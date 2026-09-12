import Link from "next/link";

import { VoteButton } from "@/components/discover/VoteButton";
import { formatCostPerPersonRange, formatDateRangeWithYear, formatFlightHoursRange } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import { cn } from "@/lib/cn";

const CLIMATE_GRADIENT: Record<string, string> = {
  hot: "from-orange-400 to-pink-500",
  warm: "from-amber-300 to-orange-400",
  mild: "from-sky-400 to-blue-500",
  cool: "from-slate-400 to-slate-600",
};

function matchBadgeClasses(score: number): string {
  if (score >= 85) return "bg-emerald-600";
  if (score >= 65) return "bg-teal-700";
  return "bg-amber-600";
}

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
      <div
        className={cn(
          "relative flex items-end justify-between gap-3 bg-gradient-to-br px-4 py-5",
          CLIMATE_GRADIENT[destination.climate] ?? CLIMATE_GRADIENT.mild,
        )}
      >
        <div>
          <h3 className="text-xl font-bold text-white drop-shadow-sm">{destination.name}</h3>
          <p className="text-sm text-white/90">{destination.country}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-white shadow",
            matchBadgeClasses(matchScore),
          )}
        >
          {matchScore}% group match
        </span>
      </div>

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
