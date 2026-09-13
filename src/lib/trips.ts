import { monthKeyToRange } from "@/lib/dates";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { prisma } from "@/lib/prisma";

export class TripError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TripError";
    this.code = code;
  }
}

export async function createTrip({
  organizerId,
  name,
}: {
  organizerId: string;
  name: string;
}) {
  return prisma.trip.create({
    data: {
      name,
      organizerId,
      status: "COLLECTING",
      participants: {
        create: {
          userId: organizerId,
          status: "JOINED",
          joinedAt: new Date(),
        },
      },
    },
  });
}

export async function getTripsForUser(userId: string) {
  return prisma.trip.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true } } },
  });
}

/** Loads a trip only if the given user is one of its participants. */
export async function getTripForParticipant({
  tripId,
  userId,
}: {
  tripId: string;
  userId: string;
}) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      organizer: true,
      participants: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!trip) return null;

  const isParticipant = trip.participants.some((p) => p.userId === userId);
  if (!isParticipant) return null;

  return trip;
}

/**
 * Persists one participant's onboarding answers: available months (or a
 * year-wide window if they said they're flexible), a budget, a trip-length
 * band, and travel priorities. Safe to call again — it replaces whatever
 * that participant submitted before.
 */
export async function submitParticipantOnboarding({
  tripId,
  userId,
  months,
  isFlexibleOnDates,
  budgetPerPerson,
  tripLengthMinDays,
  tripLengthMaxDays,
  preferences,
}: {
  tripId: string;
  userId: string;
  months: string[];
  isFlexibleOnDates: boolean;
  budgetPerPerson: number;
  tripLengthMinDays: number;
  tripLengthMaxDays: number;
  preferences: string[];
}) {
  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });

  if (!participant) {
    throw new TripError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }

  const windows = isFlexibleOnDates
    ? [
        {
          start: new Date(),
          end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      ]
    : months.map((month) => monthKeyToRange(month));

  await prisma.$transaction([
    prisma.availabilityWindow.deleteMany({
      where: { participantId: participant.id },
    }),
    prisma.availabilityWindow.createMany({
      data: windows.map((window) => ({
        participantId: participant.id,
        startDate: window.start,
        endDate: window.end,
      })),
    }),
    prisma.preference.upsert({
      where: { participantId: participant.id },
      update: {
        budgetPerPerson,
        tripLengthMinDays,
        tripLengthMaxDays,
        priorities: preferences,
      },
      create: {
        participantId: participant.id,
        budgetPerPerson,
        tripLengthMinDays,
        tripLengthMaxDays,
        priorities: preferences,
        destinationPrefs: [],
      },
    }),
    prisma.tripParticipant.update({
      where: { id: participant.id },
      data: { status: "SUBMITTED" },
    }),
  ]);
}

export async function getTripPreviewByInviteCode(inviteCode: string) {
  return prisma.trip.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      name: true,
      status: true,
      organizer: { select: { name: true, email: true } },
      _count: { select: { participants: true } },
    },
  });
}

export async function joinTrip({
  inviteCode,
  userId,
}: {
  inviteCode: string;
  userId: string;
}) {
  const trip = await prisma.trip.findUnique({ where: { inviteCode } });

  if (!trip) {
    throw new TripError(
      "NOT_FOUND",
      "That invite link isn't valid. Ask the organizer to resend it.",
    );
  }

  if (trip.status === "CANCELLED") {
    throw new TripError("TRIP_CANCELLED", "This trip has been cancelled.");
  }

  if (trip.status === "CONFIRMED") {
    throw new TripError(
      "TRIP_CONFIRMED",
      "This trip is already locked in, so it's no longer accepting new participants.",
    );
  }

  await prisma.tripParticipant.upsert({
    where: { tripId_userId: { tripId: trip.id, userId } },
    update: { status: "JOINED", joinedAt: new Date() },
    create: {
      tripId: trip.id,
      userId,
      status: "JOINED",
      joinedAt: new Date(),
    },
  });

  return trip;
}

/**
 * Locks the trip in on a destination. Organizer-only, and the destination's
 * dates are recomputed server-side at lock time rather than taken from the
 * client. The status transition is a conditional update, so two simultaneous
 * lock attempts can't both succeed.
 */
export async function lockTrip({
  tripId,
  userId,
  destinationId,
}: {
  tripId: string;
  userId: string;
  destinationId: string;
}) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, organizerId: true, status: true },
  });

  if (!trip) {
    throw new TripError("NOT_FOUND", "That trip doesn't exist.");
  }
  if (trip.organizerId !== userId) {
    throw new TripError("NOT_ORGANIZER", "Only the trip organizer can lock the trip in.");
  }
  if (trip.status === "CONFIRMED") {
    throw new TripError("ALREADY_CONFIRMED", "This trip is already locked in.");
  }

  const matches = await getGroupMatchesForTrip(tripId);
  const match = matches.find((result) => result.destination.id === destinationId);
  if (!match) {
    throw new TripError(
      "NO_MATCH_AVAILABLE",
      "We couldn't work out dates for that destination right now.",
    );
  }

  // Conditional update rather than a read-then-write: if two organizer
  // requests race, only the one that still sees a non-confirmed trip wins.
  // Everything the confirmed trip shows is snapshotted here, from the
  // server's own freshly computed match.
  const confirmed = await prisma.trip.updateMany({
    where: { id: tripId, status: { not: "CONFIRMED" } },
    data: {
      status: "CONFIRMED",
      confirmedDestinationId: destinationId,
      confirmedDateStart: new Date(match.dates.start),
      confirmedDateEnd: new Date(match.dates.end),
      confirmedAt: new Date(),
      confirmedCostMin: match.estimatedCostPerPersonRange.min,
      confirmedCostMax: match.estimatedCostPerPersonRange.max,
      confirmedAttendingUserIds: match.attendingParticipantIds,
    },
  });

  if (confirmed.count === 0) {
    throw new TripError("ALREADY_CONFIRMED", "This trip is already locked in.");
  }

  return match;
}

/** Reopens a locked trip for changes. Organizer-only. */
export async function reopenTrip({ tripId, userId }: { tripId: string; userId: string }) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { organizerId: true, status: true },
  });

  if (!trip) {
    throw new TripError("NOT_FOUND", "That trip doesn't exist.");
  }
  if (trip.organizerId !== userId) {
    throw new TripError("NOT_ORGANIZER", "Only the trip organizer can reopen the trip.");
  }
  if (trip.status !== "CONFIRMED") {
    throw new TripError("NOT_CONFIRMED", "This trip isn't confirmed, so there's nothing to reopen.");
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: "COLLECTING",
      confirmedDestinationId: null,
      confirmedDateStart: null,
      confirmedDateEnd: null,
      confirmedAt: null,
      confirmedCostMin: null,
      confirmedCostMax: null,
      confirmedAttendingUserIds: [],
    },
  });
}
