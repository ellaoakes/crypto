"use client";

import { useState, useTransition } from "react";

import { toggleVoteAction } from "@/app/(app)/trips/[tripId]/discover/actions";
import { Button } from "@/components/ui/Button";

export function VoteButton({
  tripId,
  destinationId,
  initialVoted,
  initialCount,
}: {
  tripId: string;
  destinationId: string;
  initialVoted: boolean;
  initialCount: number;
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const previousVoted = voted;
    const previousCount = count;
    const nextVoted = !voted;

    setVoted(nextVoted);
    setCount((c) => c + (nextVoted ? 1 : -1));
    setError(null);

    startTransition(async () => {
      const result = await toggleVoteAction(tripId, destinationId, previousVoted);

      if (result.error) {
        setVoted(previousVoted);
        setCount(previousCount);
        setError(result.error);
        return;
      }

      if (typeof result.count === "number") setCount(result.count);
      if (typeof result.votedByMe === "boolean") setVoted(result.votedByMe);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={voted ? "primary" : "secondary"}
        isLoading={isPending}
        onClick={handleClick}
        aria-pressed={voted}
      >
        {voted ? "✓ Voted" : "Vote"}
        {count > 0 ? ` · ${count}` : ""}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
