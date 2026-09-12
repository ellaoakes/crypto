import { OptionCard } from "@/components/onboarding/OptionCard";
import { StepHeading } from "@/components/onboarding/StepHeading";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TRAVEL_PREFERENCES, type TravelPreferenceKey } from "@/lib/onboarding-options";

export function PreferencesStep({
  selected,
  onToggle,
  onFinish,
  isPending,
  error,
}: {
  selected: TravelPreferenceKey[];
  onToggle: (key: TravelPreferenceKey) => void;
  onFinish: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <>
      <StepHeading
        eyebrow="Step 7 of 7"
        title="What matters most to you?"
        subtitle="Pick as many as you like — this helps us suggest the right kind of trip."
      />
      <div className="grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto content-start">
        {TRAVEL_PREFERENCES.map((option) => (
          <OptionCard
            key={option.key}
            emoji={option.emoji}
            label={option.label}
            selected={selected.includes(option.key)}
            onClick={() => onToggle(option.key)}
            compact
          />
        ))}
      </div>
      <div className="flex flex-col gap-3 pt-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          isLoading={isPending}
          onClick={onFinish}
        >
          Finish
        </Button>
      </div>
    </>
  );
}
