"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { castVote, retractVote, VoteError, type VotingState } from "@/lib/votes";

export interface VoteActionResult {
  state?: VotingState;
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
