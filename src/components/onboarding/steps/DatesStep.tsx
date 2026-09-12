import { StepHeading } from "@/components/onboarding/StepHeading";
import { Button } from "@/components/ui/Button";
import { monthKeyLabel, nextMonthKeys } from "@/lib/dates";
import { cn } from "@/lib/cn";

const MONTH_OPTIONS = nextMonthKeys(12);

export function DatesStep({
  months,
  isFlexible,
  onToggleMonth,
  onToggleFlexible,
  onContinue,
}: {
  months: string[];
  isFlexible: boolean;
  onToggleMonth: (month: string) => void;
  onToggleFlexible: () => void;
  onContinue: () => void;
}) {
  const canContinue = isFlexible || months.length > 0;

  return (
    <>
      <StepHeading
        eyebrow="Step 5 of 7"
        title="When are you free?"
        subtitle="Pick every month that could work. We'll find the overlap with everyone else."
      />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <button
          type="button"
          onClick={onToggleFlexible}
          aria-pressed={isFlexible}
          className={cn(
            "w-full rounded-2xl border-2 bg-white px-4 py-3 text-left font-medium text-teal-950 shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2",
            isFlexible ? "border-teal-600 bg-teal-50" : "border-white/60",
          )}
        >
          ✨ I&apos;m flexible — anytime works
        </button>

        <div className="flex flex-wrap gap-2">
          {MONTH_OPTIONS.map((month) => {
            const selected = !isFlexible && months.includes(month);
            return (
              <button
                key={month}
                type="button"
                onClick={() => onToggleMonth(month)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  selected
                    ? "border-white bg-white text-teal-800"
                    : "border-white/40 bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {monthKeyLabel(month)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pt-6">
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
