import { OptionCard } from "@/components/onboarding/OptionCard";
import { StepHeading } from "@/components/onboarding/StepHeading";
import { Button } from "@/components/ui/Button";
import { BUDGET_BANDS, type BudgetBandKey } from "@/lib/onboarding-options";

export function BudgetStep({
  value,
  onChange,
  onContinue,
}: {
  value: BudgetBandKey | null;
  onChange: (value: BudgetBandKey) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <StepHeading
        eyebrow="Step 6 of 7"
        title="What's your budget per person?"
        subtitle="Covers flights, stay and spending money — a ballpark is fine."
      />
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {BUDGET_BANDS.map((option) => (
          <OptionCard
            key={option.key}
            emoji={option.emoji}
            label={option.label}
            sublabel={option.sublabel}
            selected={value === option.key}
            onClick={() => onChange(option.key)}
          />
        ))}
      </div>
      <div className="pt-6">
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          disabled={!value}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
