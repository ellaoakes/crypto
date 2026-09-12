import { StepHeading } from "@/components/onboarding/StepHeading";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TRIP_NAME_SUGGESTIONS } from "@/lib/onboarding-options";

export function TripNameStep({
  name,
  onChange,
  onContinue,
  isPending,
  error,
}: {
  name: string;
  onChange: (name: string) => void;
  onContinue: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const canContinue = name.trim().length >= 2 && !isPending;

  return (
    <>
      <StepHeading
        eyebrow="Step 1 of 7"
        title="What should we call this trip?"
        subtitle="You can always change this later."
      />
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-lg">
          <Input
            label="Trip name"
            name="tripName"
            value={name}
            onChange={(event) => onChange(event.target.value)}
            placeholder="e.g. Someone's 30th"
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TRIP_NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(suggestion)}
              className="rounded-full bg-white/20 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 pt-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          isLoading={isPending}
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
