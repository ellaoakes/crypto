import { findDestinationById } from "@/lib/matching";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { prisma } from "@/lib/prisma";

export class VoteError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "VoteError";
    this.code = code;
  }
}

export interface VoteSummary {
  count: number;
  votedByMe: boolean;
}

/** Vote counts (and whether the current user has voted) for every destination in a trip. */
export async function getVoteSummaryForTrip(
  tripId: string,
  userId: string,
): Promise<Record<string, VoteSummary>> {
  const suggestions = await prisma.destinationSuggestion.findMany({
    where: { tripId },
    include: { votes: { include: { participant: { select: { userId: true } } } } },
  });

  const summary: Record<string, VoteSummary> = {};
  for (const suggestion of suggestions) {
    const upVotes = suggestion.votes.filter((vote) => vote.value === "UP");
    summary[suggestion.destinationId] = {
      count: upVotes.length,
      votedByMe: upVotes.some((vote) => vote.participant.userId === userId),
    };
  }
  return summary;
}

/**
 * Records the current user's vote for a destination, snapshotting the
 * engine's current best match for it (fresh dates/score computed
 * server-side, never trusted from the client). Safe to call again — voting
 * for the same destination just refreshes the snapshot.
 */
export async function voteForDestination({
  tripId,
  userId,
  destinationId,
}: {
  tripId: string;
  userId: string;
  destinationId: string;
}): Promise<VoteSummary> {
  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (!participant) {
    throw new VoteError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }

  const destination = findDestinationById(destinationId);
  if (!destination) {
    throw new VoteError("UNKNOWN_DESTINATION", "That destination isn't recognized.");
  }

  const matches = await getGroupMatchesForTrip(tripId);
  const match = matches.find((result) => result.destination.id === destinationId);
  if (!match) {
    throw new VoteError(
      "NO_MATCH_AVAILABLE",
      "We couldn't work out a match for this destination right now.",
    );
  }

  // Prisma's Json input type needs a plain object with a string index
  // signature — ScoreBreakdown is a fixed-shape interface, so spread it.
  const scoreBreakdown: Record<string, number> = { ...match.scoreBreakdown };

  const suggestion = await prisma.destinationSuggestion.upsert({
    where: { tripId_destinationId: { tripId, destinationId } },
    update: {
      suggestedDateStart: new Date(match.dates.start),
      suggestedDateEnd: new Date(match.dates.end),
      score: match.matchScore,
      scoreBreakdown,
    },
    create: {
      tripId,
      destinationId,
      suggestedDateStart: new Date(match.dates.start),
      suggestedDateEnd: new Date(match.dates.end),
      score: match.matchScore,
      scoreBreakdown,
    },
  });

  await prisma.vote.upsert({
    where: { suggestionId_participantId: { suggestionId: suggestion.id, participantId: participant.id } },
    update: { value: "UP" },
    create: { suggestionId: suggestion.id, participantId: participant.id, value: "UP" },
  });

  const count = await prisma.vote.count({ where: { suggestionId: suggestion.id, value: "UP" } });
  return { count, votedByMe: true };
}

/** Removes the current user's vote for a destination, if any. */
export async function removeVoteForDestination({
  tripId,
  userId,
  destinationId,
}: {
  tripId: string;
  userId: string;
  destinationId: string;
}): Promise<VoteSummary> {
  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (!participant) {
    throw new VoteError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }

  const suggestion = await prisma.destinationSuggestion.findUnique({
    where: { tripId_destinationId: { tripId, destinationId } },
  });
  if (!suggestion) {
    return { count: 0, votedByMe: false };
  }

  await prisma.vote.deleteMany({
    where: { suggestionId: suggestion.id, participantId: participant.id },
  });

  const count = await prisma.vote.count({ where: { suggestionId: suggestion.id, value: "UP" } });
  return { count, votedByMe: false };
}
