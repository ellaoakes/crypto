import type { Destination, DestinationRatings } from "@/lib/matching";

/**
 * We have no real destination photography, and won't pretend to — these are
 * clearly-abstract placeholders (a gradient derived from the destination's
 * real climate, plus an emoji derived from its highest real rating), never
 * a fabricated photo of a specific place.
 */
export const CLIMATE_GRADIENT: Record<string, string> = {
  hot: "from-orange-400 to-pink-500",
  warm: "from-amber-300 to-orange-400",
  mild: "from-sky-400 to-blue-500",
  cool: "from-slate-400 to-slate-600",
};

const EMOJI_BY_DIMENSION: Record<keyof DestinationRatings, string> = {
  beach: "🏖️",
  nightlife: "🍸",
  food: "🍜",
  luxury: "💎",
  culture: "🏛️",
  adventure: "🥾",
};

/** The emoji for whichever real rating the destination scores highest on. */
export function pickHeroEmoji(destination: Destination): string {
  const [topDimension] = (Object.entries(destination.ratings) as [keyof DestinationRatings, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return EMOJI_BY_DIMENSION[topDimension];
}
