/**
 * Bridges real trip data to the standalone matching engine in
 * `src/lib/matching/`. This is the only file in the matching path that
 * talks to the database — the engine and the DB-row mapping in
 * `matching-adapter.ts` stay framework/DB-agnostic and independently
 * unit-testable.
 */
import { toParticipantInput } from "@/lib/matching-adapter";
import { matchDestinations, type MatchOptions, type MatchResult, type ParticipantInput } from "@/lib/matching";
import { prisma } from "@/lib/prisma";

/**
 * Runs the matching engine for a real trip: loads every participant who has
 * submitted their preferences, maps them to the engine's input shape, and
 * scores every seeded destination against the group.
 */
export async function getGroupMatchesForTrip(
  tripId: string,
  options?: MatchOptions,
): Promise<MatchResult[]> {
  const participants = await prisma.tripParticipant.findMany({
    where: { tripId },
    include: {
      user: { select: { name: true, email: true } },
      availabilityWindows: true,
      blackoutWindows: true,
      preference: true,
    },
  });

  const inputs = participants
    .map((participant) => toParticipantInput(participant))
    .filter((input): input is ParticipantInput => input !== null);

  return matchDestinations(inputs, undefined, options);
}
