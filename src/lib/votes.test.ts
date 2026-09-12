import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tripParticipant: { findUnique: vi.fn() },
    destinationSuggestion: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    vote: { upsert: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/matching-service", () => ({
  getGroupMatchesForTrip: vi.fn(),
}));

import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { prisma } from "@/lib/prisma";
import {
  getVoteSummaryForTrip,
  removeVoteForDestination,
  VoteError,
  voteForDestination,
} from "@/lib/votes";

const participantFindUnique = vi.mocked(prisma.tripParticipant.findUnique);
const suggestionUpsert = vi.mocked(prisma.destinationSuggestion.upsert);
const suggestionFindUnique = vi.mocked(prisma.destinationSuggestion.findUnique);
const suggestionFindMany = vi.mocked(prisma.destinationSuggestion.findMany);
const voteUpsert = vi.mocked(prisma.vote.upsert);
const voteCount = vi.mocked(prisma.vote.count);
const voteDeleteMany = vi.mocked(prisma.vote.deleteMany);
const mockedGetGroupMatches = vi.mocked(getGroupMatchesForTrip);

function resetAll() {
  participantFindUnique.mockReset();
  suggestionUpsert.mockReset();
  suggestionFindUnique.mockReset();
  suggestionFindMany.mockReset();
  voteUpsert.mockReset();
  voteCount.mockReset();
  voteDeleteMany.mockReset();
  mockedGetGroupMatches.mockReset();
}

describe("voteForDestination", () => {
  beforeEach(resetAll);

  it("throws NOT_A_PARTICIPANT when the user hasn't joined the trip", async () => {
    participantFindUnique.mockResolvedValue(null);

    await expect(
      voteForDestination({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" } satisfies Partial<VoteError>);
  });

  it("throws UNKNOWN_DESTINATION for an id not in the seeded dataset", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);

    await expect(
      voteForDestination({ tripId: "trip-1", userId: "user-1", destinationId: "narnia" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_DESTINATION" });
  });

  it("throws NO_MATCH_AVAILABLE when the engine has no result for that destination", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    mockedGetGroupMatches.mockResolvedValue([]);

    await expect(
      voteForDestination({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NO_MATCH_AVAILABLE" });
  });

  it("snapshots the fresh match and upserts a suggestion + vote", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    mockedGetGroupMatches.mockResolvedValue([
      {
        destination: { id: "marbella-spain" },
        dates: { start: "2026-05-14", end: "2026-05-17" },
        matchScore: 94,
        scoreBreakdown: { availability: 1 },
      } as never,
    ]);
    suggestionUpsert.mockResolvedValue({ id: "suggestion-1" } as never);
    voteUpsert.mockResolvedValue({} as never);
    voteCount.mockResolvedValue(3);

    const result = await voteForDestination({
      tripId: "trip-1",
      userId: "user-1",
      destinationId: "marbella-spain",
    });

    expect(suggestionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId_destinationId: { tripId: "trip-1", destinationId: "marbella-spain" } },
        update: expect.objectContaining({ score: 94 }),
        create: expect.objectContaining({ tripId: "trip-1", destinationId: "marbella-spain", score: 94 }),
      }),
    );
    expect(voteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { suggestionId_participantId: { suggestionId: "suggestion-1", participantId: "participant-1" } },
      }),
    );
    expect(result).toEqual({ count: 3, votedByMe: true });
  });
});

describe("removeVoteForDestination", () => {
  beforeEach(resetAll);

  it("throws NOT_A_PARTICIPANT when the user hasn't joined the trip", async () => {
    participantFindUnique.mockResolvedValue(null);

    await expect(
      removeVoteForDestination({ tripId: "trip-1", userId: "user-1", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" });
  });

  it("returns a zeroed summary when there's no suggestion to remove a vote from", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    suggestionFindUnique.mockResolvedValue(null);

    const result = await removeVoteForDestination({
      tripId: "trip-1",
      userId: "user-1",
      destinationId: "marbella-spain",
    });
    expect(result).toEqual({ count: 0, votedByMe: false });
    expect(voteDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the vote and returns the updated count", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    suggestionFindUnique.mockResolvedValue({ id: "suggestion-1" } as never);
    voteDeleteMany.mockResolvedValue({ count: 1 } as never);
    voteCount.mockResolvedValue(2);

    const result = await removeVoteForDestination({
      tripId: "trip-1",
      userId: "user-1",
      destinationId: "marbella-spain",
    });

    expect(voteDeleteMany).toHaveBeenCalledWith({
      where: { suggestionId: "suggestion-1", participantId: "participant-1" },
    });
    expect(result).toEqual({ count: 2, votedByMe: false });
  });
});

describe("getVoteSummaryForTrip", () => {
  beforeEach(resetAll);

  it("counts UP votes and flags whether the current user voted", async () => {
    suggestionFindMany.mockResolvedValue([
      {
        destinationId: "marbella-spain",
        votes: [
          { value: "UP", participant: { userId: "user-1" } },
          { value: "UP", participant: { userId: "user-2" } },
        ],
      },
      {
        destinationId: "ibiza-spain",
        votes: [{ value: "UP", participant: { userId: "user-2" } }],
      },
    ] as never);

    const summary = await getVoteSummaryForTrip("trip-1", "user-1");

    expect(summary["marbella-spain"]).toEqual({ count: 2, votedByMe: true });
    expect(summary["ibiza-spain"]).toEqual({ count: 1, votedByMe: false });
  });

  it("returns an empty object when there are no suggestions yet", async () => {
    suggestionFindMany.mockResolvedValue([]);
    expect(await getVoteSummaryForTrip("trip-1", "user-1")).toEqual({});
  });
});
