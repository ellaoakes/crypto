"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { castVoteAction, retractVoteAction } from "@/app/(app)/trips/[tripId]/vote/actions";
import { Button } from "@/components/ui/Button";

/**
 * Casts the signed-in participant's single vote for this destination, or
 * withdraws it if this is already their pick. Counts shown here always come
 * from the server's response — nothing is tallied client-side.
 */
export function VoteButton({
  tripId,
  destinationId,
  votedForThis,
  voteCount,
  label = "Vote",
  className,
}: {
  tripId: string;
  destinationId: string;
  votedForThis: boolean;
  voteCount: number;
  /** CTA text while this isn't the participant's pick. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(votedForThis);
  const [count, setCount] = useState(voteCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const wasVoted = voted;
    setError(null);

    startTransition(async () => {
      const result = wasVoted
        ? await retractVoteAction(tripId)
        : await castVoteAction(tripId, destinationId);

      if (result.error || !result.state) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      setVoted(result.state.myVoteDestinationId === destinationId);
      setCount(result.state.tally[destinationId] ?? 0);
      // Other cards' counts may have changed too (a vote moved away from one),
      // so let the server re-render the rest of the page.
      router.refresh();
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
        className={className}
      >
        {voted ? "✓ Your vote" : label}
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
