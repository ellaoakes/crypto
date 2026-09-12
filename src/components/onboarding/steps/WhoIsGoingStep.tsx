import { OptionCard } from "@/components/onboarding/OptionCard";
import { StepHeading } from "@/components/onboarding/StepHeading";
import { Button } from "@/components/ui/Button";
import { GROUP_SIZE_OPTIONS, type GroupSizeKey } from "@/lib/onboarding-options";

export function WhoIsGoingStep({
  value,
  onChange,
  onContinue,
}: {
  value: GroupSizeKey | null;
  onChange: (value: GroupSizeKey) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <StepHeading
        eyebrow="Step 2 of 7"
        title="Who's going?"
        subtitle="Just a rough idea — you can invite as many as you like."
      />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {GROUP_SIZE_OPTIONS.map((option) => (
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
