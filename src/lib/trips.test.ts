import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: vi.fn(),
    },
    tripParticipant: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { joinTrip, TripError } from "@/lib/trips";

const findUnique = vi.mocked(prisma.trip.findUnique);
const upsert = vi.mocked(prisma.tripParticipant.upsert);

describe("joinTrip", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("throws NOT_FOUND when the invite code doesn't match a trip", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      joinTrip({ inviteCode: "missing", userId: "user-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<TripError>);
  });

  it("throws TRIP_CANCELLED for a cancelled trip", async () => {
    findUnique.mockResolvedValue({
      id: "trip-1",
      status: "CANCELLED",
    } as never);

    await expect(
      joinTrip({ inviteCode: "abc", userId: "user-1" }),
    ).rejects.toMatchObject({ code: "TRIP_CANCELLED" });
  });

  it("throws TRIP_LOCKED for a locked trip", async () => {
    findUnique.mockResolvedValue({ id: "trip-1", status: "LOCKED" } as never);

    await expect(
      joinTrip({ inviteCode: "abc", userId: "user-1" }),
    ).rejects.toMatchObject({ code: "TRIP_LOCKED" });
  });

  it("upserts a participant and returns the trip when joinable", async () => {
    findUnique.mockResolvedValue({
      id: "trip-1",
      status: "COLLECTING",
    } as never);
    upsert.mockResolvedValue({} as never);

    const trip = await joinTrip({ inviteCode: "abc", userId: "user-1" });

    expect(trip).toMatchObject({ id: "trip-1" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId_userId: { tripId: "trip-1", userId: "user-1" } },
      }),
    );
  });
});

describe("TripError", () => {
  it("carries a code and message", () => {
    const error = new TripError("SOME_CODE", "Something happened");
    expect(error.code).toBe("SOME_CODE");
    expect(error.message).toBe("Something happened");
    expect(error).toBeInstanceOf(Error);
  });
});
