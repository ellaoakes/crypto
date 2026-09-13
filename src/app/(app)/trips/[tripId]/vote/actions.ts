"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { lockTrip, reopenTrip, TripError } from "@/lib/trips";
import { castVote, retractVote, VoteError, type VotingState } from "@/lib/votes";

export interface VoteActionResult {
  state?: VotingState;
  error?: string;
}

export interface TripLockActionResult {
  success?: true;
  error?: string;
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/vote`);
  revalidatePath(`/trips/${tripId}/discover`);
}

export async function castVoteAction(
  tripId: string,
  destinationId: string,
): Promise<VoteActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in to vote." };
  }

  try {
    const state = await castVote({ tripId, userId: session.user.id, destinationId });
    revalidateTrip(tripId);
    return { state };
  } catch (error) {
    if (error instanceof VoteError) {
      return { error: error.message };
    }
    console.error("Failed to cast vote", error);
    return { error: "Something went wrong recording your vote." };
  }
}

export async function retractVoteAction(tripId: string): Promise<VoteActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in to vote." };
  }

  try {
    const state = await retractVote({ tripId, userId: session.user.id });
    revalidateTrip(tripId);
    return { state };
  } catch (error) {
    if (error instanceof VoteError) {
      return { error: error.message };
    }
    console.error("Failed to retract vote", error);
    return { error: "Something went wrong updating your vote." };
  }
}

export async function lockTripAction(
  tripId: string,
  destinationId: string,
): Promise<TripLockActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in first." };
  }

  try {
    await lockTrip({ tripId, userId: session.user.id, destinationId });
    revalidateTrip(tripId);
    return { success: true };
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    console.error("Failed to lock trip", error);
    return { error: "Something went wrong locking the trip." };
  }
}

export async function reopenTripAction(tripId: string): Promise<TripLockActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in first." };
  }

  try {
    await reopenTrip({ tripId, userId: session.user.id });
    revalidateTrip(tripId);
    return { success: true };
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    console.error("Failed to reopen trip", error);
    return { error: "Something went wrong reopening the trip." };
  }
}
