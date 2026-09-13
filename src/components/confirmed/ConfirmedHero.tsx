import { CLIMATE_GRADIENT, pickHeroEmoji } from "@/components/discover/destinationVisual";
import { cn } from "@/lib/cn";
import type { ConfirmedTrip } from "@/lib/confirmedTrip";
import { formatCostPerPersonRange, formatDateRangeWithYear } from "@/lib/format";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 text-center">
      <span className="text-lg font-bold leading-none text-white">{value}</span>
      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-white/70">
        {label}
      </span>
    </div>
  );
}

/**
 * The payoff at the end of planning → decision → confirmed. Deliberately the
 * loudest thing in the app: full-bleed, celebratory, and built entirely from
 * the snapshot taken when the organizer locked the trip in.
 */
export function ConfirmedHero({ trip }: { trip: ConfirmedTrip }) {
  const { destination, dates, nights, attendingCount, estimatedCostPerPersonRange } = trip;

  return (
    <section
      aria-labelledby="confirmed-destination"
      className={cn(
        "relative -mx-4 overflow-hidden bg-gradient-to-br px-6 py-10 text-center sm:mx-0 sm:rounded-3xl",
        CLIMATE_GRADIENT[destination.climate] ?? CLIMATE_GRADIENT.mild,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 text-[7rem] leading-none opacity-20"
      >
        {pickHeroEmoji(destination)}
      </span>
      <div className="relative flex flex-col items-center gap-4">
        <p className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
          🎉 It&apos;s happening
        </p>

        <div className="flex flex-col gap-1">
          <h1
            id="confirmed-destination"
            className="text-4xl font-black uppercase leading-tight tracking-tight text-white drop-shadow-sm sm:text-5xl"
          >
            {destination.name}
          </h1>
          <p className="text-base font-medium uppercase tracking-[0.2em] text-white/80">
            {destination.country}
          </p>
        </div>

        <p className="text-lg font-semibold text-white">{formatDateRangeWithYear(dates)}</p>

        <div className="flex flex-wrap items-center justify-center divide-x divide-white/25 rounded-2xl bg-white/15 px-2 py-3 backdrop-blur-sm">
          <Stat
            value={String(attendingCount)}
            label={attendingCount === 1 ? "person" : "people"}
          />
          <Stat value={String(nights)} label={nights === 1 ? "night" : "nights"} />
          {estimatedCostPerPersonRange ? (
            <Stat
              value={formatCostPerPersonRange(estimatedCostPerPersonRange).replace(" pp", "")}
              label="est. pp"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
