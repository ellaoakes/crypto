import { Button } from "@/components/ui/Button";

export function CreateTripIntroStep({
  userName,
  onContinue,
}: {
  userName?: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="text-6xl" aria-hidden="true">
          🗺️
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            {userName ? `Alright, ${userName} —` : "Alright —"} let&apos;s plan
            something unforgettable
          </h1>
          <p className="text-white/80">
            A few quick questions, then invite your friends. Takes about a
            minute.
          </p>
        </div>
      </div>
      <div className="pt-6">
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={onContinue}
        >
          Let&apos;s go
        </Button>
      </div>
    </>
  );
}
