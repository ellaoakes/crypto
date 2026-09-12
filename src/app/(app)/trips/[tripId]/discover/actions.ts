"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { removeVoteForDestination, VoteError, voteForDestination } from "@/lib/votes";

export interface VoteActionResult {
  count?: number;
  votedByMe?: boolean;
  error?: string;
}

export async function toggleVoteAction(
  tripId: string,
  destinationId: string,
  currentlyVoted: boolean,
): Promise<VoteActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in to vote." };
  }

  try {
    const result = currentlyVoted
      ? await removeVoteForDestination({ tripId, userId: session.user.id, destinationId })
      : await voteForDestination({ tripId, userId: session.user.id, destinationId });

    revalidatePath(`/trips/${tripId}/discover`);
    return result;
  } catch (error) {
    if (error instanceof VoteError) {
      return { error: error.message };
    }
    console.error("Failed to toggle vote", error);
    return { error: "Something went wrong recording your vote." };
  }
}
