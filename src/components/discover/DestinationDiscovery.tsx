"use client";

import { useMemo, useState } from "react";

import { DestinationCard } from "@/components/discover/DestinationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { rangeLengthDays, type MatchResult } from "@/lib/matching";

type SortKey =
  | "match"
  | "budget"
  | "flight"
  | "tripLength"
  | "beach"
  | "nightlife"
  | "luxury"
  | "culture";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "match", label: "Best match" },
  { key: "budget", label: "Budget" },
  { key: "flight", label: "Flight time" },
  { key: "tripLength", label: "Trip length" },
  { key: "beach", label: "Beach" },
  { key: "nightlife", label: "Nightlife" },
  { key: "luxury", label: "Luxury" },
  { key: "culture", label: "Culture" },
];

const BUDGET_FILTER_OPTIONS = [
  { label: "Any budget", value: "" },
  { label: "Under £500pp", value: "500" },
  { label: "Under £800pp", value: "800" },
  { label: "Under £1,200pp", value: "1200" },
];

const FLIGHT_FILTER_OPTIONS = [
  { label: "Any flight time", value: "" },
  { label: "Under 3h", value: "3" },
  { label: "Under 6h", value: "6" },
  { label: "Under 10h", value: "10" },
];

function costMidpoint(result: MatchResult): number {
  return (result.estimatedCostPerPersonRange.min + result.estimatedCostPerPersonRange.max) / 2;
}

function flightMidpoint(result: MatchResult): number {
  return (result.estimatedFlightHoursRange.min + result.estimatedFlightHoursRange.max) / 2;
}

function nights(result: MatchResult): number {
  return rangeLengthDays(result.dates) - 1;
}

function compareBySortKey(sortBy: SortKey, a: MatchResult, b: MatchResult): number {
  switch (sortBy) {
    case "budget":
      return costMidpoint(a) - costMidpoint(b);
    case "flight":
      return flightMidpoint(a) - flightMidpoint(b);
    case "tripLength":
      return nights(a) - nights(b);
    case "beach":
    case "nightlife":
    case "luxury":
    case "culture":
      return b.destination.ratings[sortBy] - a.destination.ratings[sortBy];
    case "match":
    default:
      return b.matchScore - a.matchScore;
  }
}

interface VoteSummaryEntry {
  count: number;
  votedByMe: boolean;
}

export function DestinationDiscovery({
  tripId,
  matches,
  voteSummary,
}: {
  tripId: string;
  matches: MatchResult[];
  voteSummary: Record<string, VoteSummaryEntry>;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("match");
  const [maxBudget, setMaxBudget] = useState("");
  const [maxFlightHours, setMaxFlightHours] = useState("");

  const results = useMemo(() => {
    const budgetLimit = maxBudget ? Number(maxBudget) : null;
    const flightLimit = maxFlightHours ? Number(maxFlightHours) : null;

    const filtered = matches.filter((result) => {
      if (budgetLimit !== null && costMidpoint(result) > budgetLimit) return false;
      if (flightLimit !== null && flightMidpoint(result) > flightLimit) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const primary = compareBySortKey(sortBy, a, b);
      if (primary !== 0) return primary;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.destination.name.localeCompare(b.destination.name);
    });
  }, [matches, sortBy, maxBudget, maxFlightHours]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          role="group"
          aria-label="Sort destinations by"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSortBy(option.key)}
              aria-pressed={sortBy === option.key}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                sortBy === option.key
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            aria-label="Filter by maximum budget per person"
            value={maxBudget}
            onChange={(event) => setMaxBudget(event.target.value)}
            className="h-11 flex-1 rounded-lg border border-teal-200 bg-white px-2 text-sm text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {BUDGET_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by maximum flight time"
            value={maxFlightHours}
            onChange={(event) => setMaxFlightHours(event.target.value)}
            className="h-11 flex-1 rounded-lg border border-teal-200 bg-white px-2 text-sm text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {FLIGHT_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No destinations match your filters"
          description="Try widening your budget or flight time filter."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((result) => (
            <DestinationCard
              key={result.destination.id}
              tripId={tripId}
              result={result}
              voted={voteSummary[result.destination.id]?.votedByMe ?? false}
              voteCount={voteSummary[result.destination.id]?.count ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
