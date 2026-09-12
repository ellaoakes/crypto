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

  if (trip.status === "LOCKED") {
    throw new TripError(
      "TRIP_LOCKED",
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
