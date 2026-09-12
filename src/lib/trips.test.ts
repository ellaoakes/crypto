import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: vi.fn(),
    },
    tripParticipant: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    availabilityWindow: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    preference: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  },
}));

import { prisma } from "@/lib/prisma";
import { joinTrip, submitParticipantOnboarding, TripError } from "@/lib/trips";

const findUnique = vi.mocked(prisma.trip.findUnique);
const upsert = vi.mocked(prisma.tripParticipant.upsert);
const participantFindUnique = vi.mocked(prisma.tripParticipant.findUnique);
const availabilityDeleteMany = vi.mocked(prisma.availabilityWindow.deleteMany);
const availabilityCreateMany = vi.mocked(prisma.availabilityWindow.createMany);
const preferenceUpsert = vi.mocked(prisma.preference.upsert);
const participantUpdate = vi.mocked(prisma.tripParticipant.update);

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

describe("submitParticipantOnboarding", () => {
  beforeEach(() => {
    participantFindUnique.mockReset();
    availabilityDeleteMany.mockReset();
    availabilityCreateMany.mockReset();
    preferenceUpsert.mockReset();
    participantUpdate.mockReset();
  });

  it("throws NOT_A_PARTICIPANT when the user hasn't joined the trip", async () => {
    participantFindUnique.mockResolvedValue(null);

    await expect(
      submitParticipantOnboarding({
        tripId: "trip-1",
        userId: "user-1",
        months: ["2026-06"],
        isFlexibleOnDates: false,
        budgetPerPerson: 650,
        tripLengthMinDays: 6,
        tripLengthMaxDays: 8,
        preferences: ["beach"],
      }),
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" });
  });

  it("replaces availability windows and upserts preferences for a real participant", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    availabilityDeleteMany.mockResolvedValue({} as never);
    availabilityCreateMany.mockResolvedValue({} as never);
    preferenceUpsert.mockResolvedValue({} as never);
    participantUpdate.mockResolvedValue({} as never);

    await submitParticipantOnboarding({
      tripId: "trip-1",
      userId: "user-1",
      months: ["2026-06", "2026-07"],
      isFlexibleOnDates: false,
      budgetPerPerson: 650,
      tripLengthMinDays: 6,
      tripLengthMaxDays: 8,
      preferences: ["beach", "food"],
    });

    expect(availabilityDeleteMany).toHaveBeenCalledWith({
      where: { participantId: "participant-1" },
    });
    expect(availabilityCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ participantId: "participant-1" }),
        ]),
      }),
    );
    expect(preferenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: "participant-1" },
      }),
    );
    expect(participantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-1" },
      data: { status: "SUBMITTED" },
    });
  });

  it("creates a single year-wide window when flexible on dates", async () => {
    participantFindUnique.mockResolvedValue({ id: "participant-1" } as never);
    availabilityDeleteMany.mockResolvedValue({} as never);
    availabilityCreateMany.mockResolvedValue({} as never);
    preferenceUpsert.mockResolvedValue({} as never);
    participantUpdate.mockResolvedValue({} as never);

    await submitParticipantOnboarding({
      tripId: "trip-1",
      userId: "user-1",
      months: [],
      isFlexibleOnDates: true,
      budgetPerPerson: 400,
      tripLengthMinDays: 2,
      tripLengthMaxDays: 21,
      preferences: [],
    });

    const call = availabilityCreateMany.mock.calls[0]?.[0] as {
      data: unknown[];
    };
    expect(call.data).toHaveLength(1);
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
