import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matching-service", () => ({
  getGroupMatchesForTrip: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { prisma } from "@/lib/prisma";
import {
  joinTrip,
  lockTrip,
  reopenTrip,
  submitParticipantOnboarding,
  TripError,
} from "@/lib/trips";

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

describe("lockTrip", () => {
  const tripUpdateMany = vi.mocked(prisma.trip.updateMany);
  const mockedMatches = vi.mocked(getGroupMatchesForTrip);

  const match = {
    destination: { id: "marbella-spain" },
    dates: { start: "2027-05-14", end: "2027-05-17" },
    matchScore: 94,
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      id: "trip-1",
      organizerId: "organizer",
      status: "COLLECTING",
    } as never);
    mockedMatches.mockResolvedValue([match] as never);
    tripUpdateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("lets the organizer lock the trip in", async () => {
    await lockTrip({ tripId: "trip-1", userId: "organizer", destinationId: "marbella-spain" });

    expect(tripUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trip-1", status: { not: "LOCKED" } },
        data: expect.objectContaining({
          status: "LOCKED",
          lockedDestinationId: "marbella-spain",
        }),
      }),
    );
  });

  it("confirms the dates server-side rather than trusting the caller", async () => {
    await lockTrip({ tripId: "trip-1", userId: "organizer", destinationId: "marbella-spain" });

    const data = tripUpdateMany.mock.calls[0][0].data as {
      lockedDateStart: Date;
      lockedDateEnd: Date;
      lockedAt: Date;
    };
    expect(data.lockedDateStart.toISOString()).toContain("2027-05-14");
    expect(data.lockedDateEnd.toISOString()).toContain("2027-05-17");
    expect(data.lockedAt).toBeInstanceOf(Date);
  });

  it("refuses a participant who isn't the organizer", async () => {
    await expect(
      lockTrip({ tripId: "trip-1", userId: "someone-else", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NOT_ORGANIZER" } satisfies Partial<TripError>);
    expect(tripUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses to lock a trip that's already locked", async () => {
    findUnique.mockResolvedValue({
      id: "trip-1",
      organizerId: "organizer",
      status: "LOCKED",
    } as never);

    await expect(
      lockTrip({ tripId: "trip-1", userId: "organizer", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "ALREADY_LOCKED" });
  });

  it("loses the race safely when a simultaneous lock got there first", async () => {
    // The status check passed, but the conditional update matched no rows.
    tripUpdateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      lockTrip({ tripId: "trip-1", userId: "organizer", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "ALREADY_LOCKED" });
  });

  it("refuses when the engine has no match for that destination", async () => {
    mockedMatches.mockResolvedValue([] as never);

    await expect(
      lockTrip({ tripId: "trip-1", userId: "organizer", destinationId: "marbella-spain" }),
    ).rejects.toMatchObject({ code: "NO_MATCH_AVAILABLE" });
  });
});

describe("reopenTrip", () => {
  const tripUpdate = vi.mocked(prisma.trip.update);

  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ organizerId: "organizer", status: "LOCKED" } as never);
    tripUpdate.mockResolvedValue({} as never);
  });

  it("lets the organizer reopen and clears the locked details", async () => {
    await reopenTrip({ tripId: "trip-1", userId: "organizer" });

    expect(tripUpdate).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: {
        status: "COLLECTING",
        lockedDestinationId: null,
        lockedDateStart: null,
        lockedDateEnd: null,
        lockedAt: null,
      },
    });
  });

  it("refuses a non-organizer", async () => {
    await expect(
      reopenTrip({ tripId: "trip-1", userId: "someone-else" }),
    ).rejects.toMatchObject({ code: "NOT_ORGANIZER" });
    expect(tripUpdate).not.toHaveBeenCalled();
  });

  it("refuses when the trip isn't locked", async () => {
    findUnique.mockResolvedValue({ organizerId: "organizer", status: "COLLECTING" } as never);

    await expect(reopenTrip({ tripId: "trip-1", userId: "organizer" })).rejects.toMatchObject({
      code: "NOT_LOCKED",
    });
  });
});
