import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findUnique: vi.fn() },
    tripParticipant: { findUnique: vi.fn(), findMany: vi.fn() },
    destinationSuggestion: { upsert: vi.fn() },
    vote: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/matching-service", () => ({
  getGroupMatchesForTrip: vi.fn(),
}));

import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { prisma } from "@/lib/prisma";
import { castVote, getVotingState, retractVote, VoteError } from "@/lib/votes";

const tripFindUnique = vi.mocked(prisma.trip.findUnique);
const participantFindUnique = vi.mocked(prisma.tripParticipant.findUnique);
const participantFindMany = vi.mocked(prisma.tripParticipant.findMany);
const suggestionUpsert = vi.mocked(prisma.destinationSuggestion.upsert);
const voteUpsert = vi.mocked(prisma.vote.upsert);
const voteFindMany = vi.mocked(prisma.vote.findMany);
const voteDeleteMany = vi.mocked(prisma.vote.deleteMany);
const mockedMatches = vi.mocked(getGroupMatchesForTrip);

/** A participant row, and the vote row shape `getVotingState` selects. */
function participant(id: string, userId: string) {
  return { id, userId };
}
function voteRow(userId: string, destinationId: string, score = 90) {
  return { participant: { userId }, suggestion: { destinationId, score } };
}

function matchFor(destinationId: string, matchScore = 94) {
  return {
    destination: { id: destinationId },
    dates: { start: "2027-05-14", end: "2027-05-17" },
    matchScore,
    scoreBreakdown: { availability: 1 },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  tripFindUnique.mockResolvedValue({ status: "COLLECTING" } as never);
  participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
  participantFindMany.mockResolvedValue([] as never);
  voteFindMany.mockResolvedValue([] as never);
  suggestionUpsert.mockResolvedValue({ id: "suggestion-1" } as never);
  voteUpsert.mockResolvedValue({} as never);
  voteDeleteMany.mockResolvedValue({ count: 1 } as never);
  mockedMatches.mockResolvedValue([matchFor("marbella-spain")] as never);
});

describe("getVotingState", () => {
  it("counts votes per destination and reports the current user's own vote", async () => {
    participantFindMany.mockResolvedValue([
      participant("p1", "user-1"),
      participant("p2", "user-2"),
      participant("p3", "user-3"),
    ] as never);
    voteFindMany.mockResolvedValue([
      voteRow("user-1", "marbella-spain"),
      voteRow("user-2", "marbella-spain"),
      voteRow("user-3", "ibiza-spain"),
    ] as never);

    const state = await getVotingState("trip-1", "user-3");

    expect(state.totalParticipants).toBe(3);
    expect(state.votedCount).toBe(3);
    expect(state.tally).toEqual({ "marbella-spain": 2, "ibiza-spain": 1 });
    expect(state.myVoteDestinationId).toBe("ibiza-spain");
    expect(state.leaderDestinationId).toBe("marbella-spain");
    expect(state.everyoneVoted).toBe(true);
  });

  it("reports no vote for a participant who hasn't voted", async () => {
    participantFindMany.mockResolvedValue([
      participant("p1", "user-1"),
      participant("p2", "user-2"),
    ] as never);
    voteFindMany.mockResolvedValue([voteRow("user-1", "marbella-spain")] as never);

    const state = await getVotingState("trip-1", "user-2");

    expect(state.myVoteDestinationId).toBeNull();
    expect(state.votedCount).toBe(1);
    expect(state.everyoneVoted).toBe(false);
  });

  it("has no leader and is not 'everyone voted' when nobody has voted", async () => {
    participantFindMany.mockResolvedValue([participant("p1", "user-1")] as never);

    const state = await getVotingState("trip-1", "user-1");

    expect(state.leaderDestinationId).toBeNull();
    expect(state.tally).toEqual({});
    expect(state.everyoneVoted).toBe(false);
  });

  it("breaks a tied leader on the higher match score, deterministically", async () => {
    participantFindMany.mockResolvedValue([
      participant("p1", "user-1"),
      participant("p2", "user-2"),
    ] as never);
    voteFindMany.mockResolvedValue([
      voteRow("user-1", "alpha-place", 70),
      voteRow("user-2", "beta-place", 95),
    ] as never);

    const state = await getVotingState("trip-1", "user-1");

    expect(state.tally).toEqual({ "alpha-place": 1, "beta-place": 1 });
    expect(state.leaderDestinationId).toBe("beta-place");
  });

  it("stays correct when someone joins after voting started", async () => {
    // Two participants, one vote — then a third joins and hasn't voted.
    participantFindMany.mockResolvedValue([
      participant("p1", "user-1"),
      participant("p2", "user-2"),
      participant("p3", "late-joiner"),
    ] as never);
    voteFindMany.mockResolvedValue([
      voteRow("user-1", "marbella-spain"),
      voteRow("user-2", "marbella-spain"),
    ] as never);

    const state = await getVotingState("trip-1", "late-joiner");

    expect(state.totalParticipants).toBe(3);
    expect(state.votedCount).toBe(2);
    expect(state.everyoneVoted).toBe(false);
    expect(state.myVoteDestinationId).toBeNull();
  });

  it("stays correct when a participant leaves (their vote cascades away)", async () => {
    // p2 has left: they're gone from participants, and the FK cascade removed
    // their vote, so the remaining group is fully voted.
    participantFindMany.mockResolvedValue([participant("p1", "user-1")] as never);
    voteFindMany.mockResolvedValue([voteRow("user-1", "marbella-spain")] as never);

    const state = await getVotingState("trip-1", "user-1");

    expect(state.totalParticipants).toBe(1);
    expect(state.votedCount).toBe(1);
    expect(state.everyoneVoted).toBe(true);
    expect(state.tally).toEqual({ "marbella-spain": 1 });
  });
});

describe("castVote", () => {
  it("rejects someone who isn't a participant", async () => {
    participantFindUnique.mockResolvedValue(null);

    await expect(
      castVote({ tripId: "trip-1", userId: "outsider", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" } satisfies Partial<VoteError>);
  });

  it("rejects voting once the trip is locked", async () => {
    tripFindUnique.mockResolvedValue({ status: "CONFIRMED" } as never);

    await expect(
      castVote({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "TRIP_CONFIRMED" });
  });

  it("rejects an unknown destination id", async () => {
    await expect(
      castVote({ tripId: "trip-1", userId: "user-1", destinationId: "atlantis" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_DESTINATION" });
  });

  it("upserts keyed on the participant, so a repeat vote can't create a second row", async () => {
    await castVote({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" });

    expect(voteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { participantId: "participant-1" } }),
    );
  });

  it("moves an existing vote when the participant picks a different destination", async () => {
    await castVote({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" });

    mockedMatches.mockResolvedValue([matchFor("ibiza-spain")] as never);
    suggestionUpsert.mockResolvedValue({ id: "suggestion-2" } as never);
    await castVote({ tripId: "trip-1", userId: "user-1", destinationId: "ibiza-spain" });

    // Both calls target the same participant row — the second updates it.
    expect(voteUpsert).toHaveBeenCalledTimes(2);
    expect(voteUpsert.mock.calls[0][0]).toMatchObject({
      where: { participantId: "participant-1" },
      update: { suggestionId: "suggestion-1" },
    });
    expect(voteUpsert.mock.calls[1][0]).toMatchObject({
      where: { participantId: "participant-1" },
      update: { suggestionId: "suggestion-2" },
    });
  });

  it("snapshots the server-computed match, never a client-supplied score", async () => {
    mockedMatches.mockResolvedValue([matchFor("marbella-spain", 88)] as never);

    await castVote({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" });

    expect(suggestionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ score: 88, destinationId: "marbella-spain" }),
      }),
    );
  });
});

describe("retractVote", () => {
  it("removes the participant's vote", async () => {
    await retractVote({ tripId: "trip-1", userId: "user-1" });

    expect(voteDeleteMany).toHaveBeenCalledWith({ where: { participantId: "participant-1" } });
  });

  it("rejects a non-participant", async () => {
    participantFindUnique.mockResolvedValue(null);

    await expect(retractVote({ tripId: "trip-1", userId: "outsider" })).rejects.toMatchObject({
      code: "NOT_A_PARTICIPANT",
    });
  });

  it("rejects retracting once the trip is locked", async () => {
    tripFindUnique.mockResolvedValue({ status: "CONFIRMED" } as never);

    await expect(retractVote({ tripId: "trip-1", userId: "user-1" })).rejects.toMatchObject({
      code: "TRIP_CONFIRMED",
    });
  });
});
