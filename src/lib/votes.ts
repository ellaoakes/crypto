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

export interface VotingState {
  totalParticipants: number;
  /** How many participants have cast a vote. */
  votedCount: number;
  /** The destination the current user voted for, or null if they haven't voted. */
  myVoteDestinationId: string | null;
  /** Vote count per destination id. Destinations with no votes are absent. */
  tally: Record<string, number>;
  /** The destination currently winning, or null if nobody has voted. */
  leaderDestinationId: string | null;
  everyoneVoted: boolean;
}

/**
 * The whole voting picture for a trip, computed server-side from the
 * database. The client is never trusted to count anything — it only renders
 * what this returns.
 */
export async function getVotingState(tripId: string, userId: string): Promise<VotingState> {
  const [participants, votes] = await Promise.all([
    prisma.tripParticipant.findMany({
      where: { tripId },
      select: { id: true, userId: true },
    }),
    prisma.vote.findMany({
      where: { participant: { tripId } },
      select: {
        participant: { select: { userId: true } },
        suggestion: { select: { destinationId: true, score: true } },
      },
    }),
  ]);

  const tally: Record<string, number> = {};
  const bestScore: Record<string, number> = {};
  let myVoteDestinationId: string | null = null;

  for (const vote of votes) {
    const { destinationId, score } = vote.suggestion;
    tally[destinationId] = (tally[destinationId] ?? 0) + 1;
    bestScore[destinationId] = Math.max(bestScore[destinationId] ?? 0, score);
    if (vote.participant.userId === userId) {
      myVoteDestinationId = destinationId;
    }
  }

  // Most votes wins; ties break on the higher match score, then destination id,
  // so the "leader" is stable and never depends on row ordering.
  const leaderDestinationId =
    Object.keys(tally).sort((a, b) => {
      if (tally[b] !== tally[a]) return tally[b] - tally[a];
      if (bestScore[b] !== bestScore[a]) return bestScore[b] - bestScore[a];
      return a.localeCompare(b);
    })[0] ?? null;

  const totalParticipants = participants.length;
  const votedCount = votes.length;

  return {
    totalParticipants,
    votedCount,
    myVoteDestinationId,
    tally,
    leaderDestinationId,
    everyoneVoted: totalParticipants > 0 && votedCount === totalParticipants,
  };
}

async function requireVotableParticipant(tripId: string, userId: string) {
  const [participant, trip] = await Promise.all([
    prisma.tripParticipant.findUnique({ where: { tripId_userId: { tripId, userId } } }),
    prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } }),
  ]);

  if (!trip) {
    throw new VoteError("TRIP_NOT_FOUND", "That trip doesn't exist.");
  }
  if (!participant) {
    throw new VoteError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }
  if (trip.status === "LOCKED") {
    throw new VoteError("TRIP_LOCKED", "This trip is locked in, so voting is closed.");
  }

  return participant;
}

/**
 * Records (or moves) the current user's single vote to a destination. Calling
 * it again for the same destination is a harmless no-op; calling it for a
 * different one moves their existing vote rather than adding a second.
 */
export async function castVote({
  tripId,
  userId,
  destinationId,
}: {
  tripId: string;
  userId: string;
  destinationId: string;
}): Promise<VotingState> {
  const participant = await requireVotableParticipant(tripId, userId);

  if (!findDestinationById(destinationId)) {
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

  // Snapshot the engine's current result server-side — the dates and score
  // stored against a vote are never taken from the client.
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

  // Keyed on participantId, so this moves an existing vote instead of adding
  // one — the database's unique constraint makes a second vote impossible
  // even if two requests arrive at once.
  await prisma.vote.upsert({
    where: { participantId: participant.id },
    update: { suggestionId: suggestion.id },
    create: { participantId: participant.id, suggestionId: suggestion.id },
  });

  return getVotingState(tripId, userId);
}

/** Withdraws the current user's vote entirely, leaving them un-voted. */
export async function retractVote({
  tripId,
  userId,
}: {
  tripId: string;
  userId: string;
}): Promise<VotingState> {
  const participant = await requireVotableParticipant(tripId, userId);

  await prisma.vote.deleteMany({ where: { participantId: participant.id } });

  return getVotingState(tripId, userId);
}
