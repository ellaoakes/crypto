import type { ElementType } from "react";

import { CLIMATE_GRADIENT, pickHeroEmoji } from "@/components/discover/destinationVisual";
import { cn } from "@/lib/cn";
import type { Destination } from "@/lib/matching";

function matchBadgeClasses(score: number): string {
  if (score >= 85) return "bg-emerald-600";
  if (score >= 65) return "bg-teal-700";
  return "bg-amber-600";
}

export function DestinationBanner({
  destination,
  size = "compact",
  matchScore,
  headingTag: HeadingTag = "h3",
}: {
  destination: Destination;
  /** "hero" is the larger banner used on the detail page. */
  size?: "compact" | "hero";
  matchScore?: number;
  headingTag?: ElementType;
}) {
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        CLIMATE_GRADIENT[destination.climate] ?? CLIMATE_GRADIENT.mild,
        isHero ? "px-5 py-10" : "px-4 py-5",
      )}
    >
      {isHero ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-3 -top-3 text-8xl opacity-25"
        >
          {pickHeroEmoji(destination)}
        </span>
      ) : null}
      <div className="relative flex items-end justify-between gap-3">
        <div>
          <HeadingTag
            className={cn("font-bold text-white drop-shadow-sm", isHero ? "text-3xl" : "text-xl")}
          >
            {destination.name}
          </HeadingTag>
          <p className={cn("text-white/90", isHero ? "text-base" : "text-sm")}>
            {destination.country}
          </p>
        </div>
        {matchScore !== undefined ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-white shadow",
              matchBadgeClasses(matchScore),
            )}
          >
            {matchScore}% group match
          </span>
        ) : null}
      </div>
    </div>
  );
}
