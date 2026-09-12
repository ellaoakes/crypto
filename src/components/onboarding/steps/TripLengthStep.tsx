import { OptionCard } from "@/components/onboarding/OptionCard";
import { StepHeading } from "@/components/onboarding/StepHeading";
import { Button } from "@/components/ui/Button";
import { TRIP_LENGTH_OPTIONS, type TripLengthKey } from "@/lib/onboarding-options";

export function TripLengthStep({
  value,
  onChange,
  onContinue,
}: {
  value: TripLengthKey | null;
  onChange: (value: TripLengthKey) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <StepHeading
        eyebrow="Step 4 of 7"
        title="How long should the trip be?"
        subtitle="An approximate length is fine."
      />
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {TRIP_LENGTH_OPTIONS.map((option) => (
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
