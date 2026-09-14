"use client";

import { useState, useTransition } from "react";

import { remindOutstandingAction } from "@/app/(app)/trips/[tripId]/payments/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

function list(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The organizer's nudge. It sends notifications and changes nothing about
 * what anyone owes — and it's rate limited, so leaning on it does nothing.
 */
export function RemindOutstandingButton({
  tripId,
  outstandingCount,
}: {
  tripId: string;
  outstandingCount: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (outstandingCount === 0) return null;

  function handleClick() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await remindOutstandingAction(tripId);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.nobodyOutstanding) {
        setMessage("Everyone has made their initial payment — nobody to remind.");
        return;
      }

      const parts: string[] = [];
      if (result.reminded?.length) parts.push(`Reminded ${list(result.reminded)}.`);
      if (result.skipped?.length) {
        parts.push(
          `${list(result.skipped)} ${result.skipped.length === 1 ? "was" : "were"} reminded in the last day, so we left ${result.skipped.length === 1 ? "them" : "them"} alone.`,
        );
      }
      setMessage(parts.join(" "));
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-teal-100 pt-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        isLoading={isPending}
        onClick={handleClick}
      >
        Remind {outstandingCount} {outstandingCount === 1 ? "person" : "people"} who
        haven&apos;t paid
      </Button>
      <p className="text-xs text-teal-950/50">
        Sends a notification. It doesn&apos;t change what anyone owes, and each person is
        reminded at most once a day.
      </p>
    </div>
  );
}
