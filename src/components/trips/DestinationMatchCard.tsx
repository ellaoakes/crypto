import type { MatchResult } from "@/lib/matching";

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const startMonth = startDate.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const endMonth = endDate.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

  if (startMonth === endMonth) {
    return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${endMonth}`;
  }
  return `${startDate.getUTCDate()} ${startMonth} – ${endDate.getUTCDate()} ${endMonth}`;
}

export function DestinationMatchCard({ result }: { result: MatchResult }) {
  const {
    destination,
    dates,
    matchScore,
    percentageMatched,
    estimatedCostPerPersonRange,
    keyMatchingFactors,
    compromises,
  } = result;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-teal-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-teal-950">{destination.name}</h3>
          <p className="text-sm text-teal-950/60">{destination.country}</p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
          {matchScore}% match
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-teal-950/70">
        <span>{formatDateRange(dates.start, dates.end)}</span>
        <span>
          £{estimatedCostPerPersonRange.min}–£{estimatedCostPerPersonRange.max} pp
        </span>
        <span>{percentageMatched}% of the group can make it</span>
      </div>

      {keyMatchingFactors.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-teal-800">
          {keyMatchingFactors.map((factor) => (
            <li key={factor}>✓ {factor}</li>
          ))}
        </ul>
      ) : null}

      {compromises.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-amber-700">
          {compromises.map((compromise) => (
            <li key={compromise}>⚠ {compromise}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
