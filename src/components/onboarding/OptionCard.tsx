import { CheckIcon } from "@/components/onboarding/icons";
import { cn } from "@/lib/cn";

interface OptionCardProps {
  emoji: string;
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
  /** Compact, centered layout for dense multi-column grids. */
  compact?: boolean;
}

export function OptionCard({
  emoji,
  label,
  sublabel,
  selected,
  onClick,
  compact = false,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl border-2 bg-white text-left shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2",
        selected ? "border-teal-600 bg-teal-50" : "border-white/60",
        compact
          ? "flex flex-col items-center gap-1.5 px-3 py-4 text-center"
          : "flex min-h-16 items-center gap-4 px-4 py-4",
      )}
    >
      <span className={cn("shrink-0", compact ? "text-2xl" : "text-3xl")} aria-hidden="true">
        {emoji}
      </span>
      <span className={cn("flex-1", compact && "flex-none")}>
        <span
          className={cn(
            "block font-medium text-teal-950",
            compact ? "text-sm" : "text-base",
          )}
        >
          {label}
        </span>
        {sublabel ? (
          <span className="block text-sm text-teal-950/60">{sublabel}</span>
        ) : null}
      </span>
      {selected && !compact ? (
        <CheckIcon className="size-5 shrink-0 text-teal-700" />
      ) : null}
    </button>
  );
}
