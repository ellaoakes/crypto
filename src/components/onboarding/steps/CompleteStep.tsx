import { Button } from "@/components/ui/Button";

export function CompleteStep({
  tripName,
  onGoToTrip,
}: {
  tripName: string;
  onGoToTrip: () => void;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="text-6xl" aria-hidden="true">
          🎉
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">You&apos;re all set!</h1>
          <p className="max-w-xs text-white/80">
            <span className="font-medium text-white">{tripName}</span> is
            ready. We&apos;ll let you know as friends join and add their own
            dates and budget.
          </p>
        </div>
      </div>
      <div className="pt-6">
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={onGoToTrip}
        >
          Go to your trip
        </Button>
      </div>
    </>
  );
}
