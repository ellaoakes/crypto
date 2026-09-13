import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConfirmedTripCard } from "@/components/voting/ConfirmedTripCard";
import { ReopenTripButton } from "@/components/voting/ReopenTripButton";
import { VotingBoard } from "@/components/voting/VotingBoard";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { getTripForParticipant } from "@/lib/trips";
import { getVotingState } from "@/lib/votes";

/** How many of the engine's top matches make it onto the ballot. */
const BALLOT_SIZE = 8;

export default async function VotePage({ params }: PageProps<"/trips/[tripId]/vote">) {
  const { tripId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}/vote`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const isOrganizer = trip.organizerId === session.user.id;
  const header = (
    <div className="flex flex-col gap-1">
      <Link href={`/trips/${tripId}`} className="text-sm text-teal-700 hover:underline">
        ← Back to {trip.name}
      </Link>
      <h1 className="text-xl font-semibold text-teal-950">
        {trip.status === "LOCKED" ? "Trip confirmed" : "Vote for your favourite"}
      </h1>
    </div>
  );

  // Locked: everyone sees the confirmed destination and dates, and only the
  // organizer gets the control to reopen it.
  if (trip.status === "LOCKED" && trip.lockedDestinationId && trip.lockedDateStart && trip.lockedDateEnd) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <ConfirmedTripCard
          destinationId={trip.lockedDestinationId}
          dates={{
            start: trip.lockedDateStart.toISOString().slice(0, 10),
            end: trip.lockedDateEnd.toISOString().slice(0, 10),
          }}
        />
        {isOrganizer ? <ReopenTripButton tripId={tripId} /> : null}
      </Container>
    );
  }

  const hasSubmissions = trip.participants.some((participant) => participant.status === "SUBMITTED");
  if (!hasSubmissions) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="Nothing to vote on yet"
          description="Once someone submits their dates, budget and travel preferences, we'll put the best matches up for a vote."
        />
      </Container>
    );
  }

  const [matches, votingState] = await Promise.all([
    getGroupMatchesForTrip(tripId),
    getVotingState(tripId, session.user.id),
  ]);

  if (matches.length === 0) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="No matches to vote on yet"
          description="We couldn't work out a destination and date that fits the group. Try inviting more people, or check back once everyone's submitted."
        />
      </Container>
    );
  }

  // The ballot is the engine's top matches, plus anything that already has a
  // vote so a previously-picked destination never disappears mid-vote.
  const votedIds = new Set(Object.keys(votingState.tally));
  const options = matches
    .filter((match, index) => index < BALLOT_SIZE || votedIds.has(match.destination.id))
    .sort((a, b) => {
      const aVotes = votingState.tally[a.destination.id] ?? 0;
      const bVotes = votingState.tally[b.destination.id] ?? 0;
      if (bVotes !== aVotes) return bVotes - aVotes;
      return b.matchScore - a.matchScore;
    });

  return (
    <Container className="flex flex-1 flex-col gap-4">
      {header}
      <VotingBoard
        tripId={tripId}
        options={options}
        initialState={votingState}
        isOrganizer={isOrganizer}
      />
    </Container>
  );
}
