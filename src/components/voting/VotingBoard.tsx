"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  castVoteAction,
  lockTripAction,
  retractVoteAction,
} from "@/app/(app)/trips/[tripId]/vote/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { formatCostPerPersonRange, formatDateRangeWithYear } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import type { VotingState } from "@/lib/votes";

export function VotingBoard({
  tripId,
  options,
  initialState,
  isOrganizer,
}: {
  tripId: string;
  options: MatchResult[];
  initialState: VotingState;
  isOrganizer: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pendingDestinationId, setPendingDestinationId] = useState<string | null>(null);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const leader = options.find((option) => option.destination.id === state.leaderDestinationId);
  const progressPercent =
    state.totalParticipants === 0
      ? 0
      : Math.round((state.votedCount / state.totalParticipants) * 100);

  function handleSelect(destinationId: string) {
    const isCurrentVote = state.myVoteDestinationId === destinationId;
    setError(null);
    setPendingDestinationId(destinationId);

    startTransition(async () => {
      const result = isCurrentVote
        ? await retractVoteAction(tripId)
        : await castVoteAction(tripId, destinationId);

      setPendingDestinationId(null);

      if (result.error || !result.state) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // The server returns the authoritative tally — the client never counts.
      setState(result.state);
    });
  }

  function handleLock() {
    if (!state.leaderDestinationId) return;
    setError(null);

    startTransition(async () => {
      const result = await lockTripAction(tripId, state.leaderDestinationId!);
      setLockModalOpen(false);

      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl border border-teal-100 bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium text-teal-950">Voting progress</h2>
          <p className="text-sm text-teal-950/70">
            {state.votedCount} of {state.totalParticipants} voted
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Voting progress"
          className="h-2 overflow-hidden rounded-full bg-teal-100"
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {state.everyoneVoted ? (
          <p className="pt-1 text-sm font-medium text-emerald-700">Everyone has voted 🎉</p>
        ) : (
          <p className="pt-1 text-sm text-teal-950/60">
            {state.myVoteDestinationId
              ? "You've voted. You can change it until the trip is locked."
              : "You haven't voted yet."}
          </p>
        )}

        {leader ? (
          <p className="text-sm text-teal-950/70">
            Current leader:{" "}
            <span className="font-medium text-teal-950">{leader.destination.name}</span> with{" "}
            {state.tally[leader.destination.id]}{" "}
            {state.tally[leader.destination.id] === 1 ? "vote" : "votes"}
          </p>
        ) : null}
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <ul className="flex flex-col gap-3">
        {options.map((option) => {
          const destinationId = option.destination.id;
          const isMyVote = state.myVoteDestinationId === destinationId;
          const isLeader = state.leaderDestinationId === destinationId;
          const votes = state.tally[destinationId] ?? 0;

          return (
            <li key={destinationId}>
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 transition-colors",
                  isMyVote ? "border-teal-600 bg-teal-50" : "border-teal-100",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-teal-950">{option.destination.name}</p>
                    <p className="text-sm text-teal-950/60">{option.destination.country}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white">
                      {option.matchScore}% match
                    </span>
                    {isLeader && votes > 0 ? (
                      <span className="text-xs font-medium text-emerald-700">Leading</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 text-sm text-teal-950/70">
                  <span>{formatDateRangeWithYear(option.dates)}</span>
                  <span>{formatCostPerPersonRange(option.estimatedCostPerPersonRange)}</span>
                  <span className="font-medium text-teal-950">
                    {votes} {votes === 1 ? "vote" : "votes"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant={isMyVote ? "primary" : "secondary"}
                  className="w-full"
                  aria-pressed={isMyVote}
                  isLoading={isPending && pendingDestinationId === destinationId}
                  disabled={isPending && pendingDestinationId !== destinationId}
                  onClick={() => handleSelect(destinationId)}
                >
                  {isMyVote ? "✓ Your vote — tap to undo" : "Vote for this"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {isOrganizer ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-teal-100 bg-white p-4">
          <h2 className="font-medium text-teal-950">Organizer</h2>
          <p className="text-sm text-teal-950/60">
            {leader
              ? `Locking will confirm ${leader.destination.name} and close voting for everyone.`
              : "Once someone votes, you'll be able to lock the trip in."}
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={!leader || isPending}
            onClick={() => setLockModalOpen(true)}
          >
            Lock this trip
          </Button>
        </section>
      ) : null}

      <Modal
        open={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        title="Lock this trip in?"
        description={
          leader
            ? `${leader.destination.name}, ${leader.destination.country} on ${formatDateRangeWithYear(leader.dates)} will be confirmed for everyone. Voting closes, and only you can reopen it.`
            : undefined
        }
      >
        <Button type="button" isLoading={isPending} onClick={handleLock} className="w-full">
          Yes, lock it in
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setLockModalOpen(false)}
        >
          Cancel
        </Button>
      </Modal>
    </div>
  );
}
