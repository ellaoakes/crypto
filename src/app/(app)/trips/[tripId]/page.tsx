import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CopyInviteLink } from "@/components/trips/CopyInviteLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmedTripCard } from "@/components/voting/ConfirmedTripCard";
import { env } from "@/lib/env";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { getTripForParticipant } from "@/lib/trips";

const tripStatusLabel: Record<string, string> = {
  DRAFT: "Draft",
  COLLECTING: "Collecting availability",
  RECOMMENDING: "Voting on destinations",
  LOCKED: "Locked in",
  CANCELLED: "Cancelled",
};

const participantStatusLabel: Record<string, string> = {
  INVITED: "Invited",
  JOINED: "Joined",
  SUBMITTED: "Submitted preferences",
};

export default async function TripPage({
  params,
}: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const inviteUrl = `${env.APP_URL}/join/${trip.inviteCode}`;
  const isLocked =
    trip.status === "LOCKED" &&
    Boolean(trip.lockedDestinationId && trip.lockedDateStart && trip.lockedDateEnd);
  const hasSubmissions = trip.participants.some((p) => p.status === "SUBMITTED");
  const topMatch =
    hasSubmissions && !isLocked
      ? (await getGroupMatchesForTrip(trip.id, { maxResults: 1, minGroupCoveragePercent: 1 }))[0]
      : undefined;

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-teal-950">{trip.name}</h1>
        <p className="text-sm text-teal-950/60">
          {tripStatusLabel[trip.status] ?? trip.status}
        </p>
      </div>

      {isLocked ? (
        <ConfirmedTripCard
          destinationId={trip.lockedDestinationId!}
          dates={{
            start: trip.lockedDateStart!.toISOString().slice(0, 10),
            end: trip.lockedDateEnd!.toISOString().slice(0, 10),
          }}
        />
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium text-teal-950">Invite friends</h2>
        <p className="text-sm text-teal-950/60">
          Share this link — anyone who opens it can join the trip.
        </p>
        <CopyInviteLink url={inviteUrl} />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium text-teal-950">
          Participants ({trip.participants.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {trip.participants.map((participant) => (
            <li
              key={participant.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-teal-950">
                {participant.user.name ?? participant.user.email}
              </span>
              <span className="text-teal-950/50">
                {participant.userId === trip.organizerId ? "Organizer · " : ""}
                {participantStatusLabel[participant.status] ??
                  participant.status}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {isLocked ? (
        <Link href={`/trips/${tripId}/vote`}>
          <Button variant="secondary" className="w-full">
            See the confirmed trip
          </Button>
        </Link>
      ) : (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-teal-950">Suggested destinations</h2>
          {!hasSubmissions ? (
            <EmptyState
              title="Waiting on preferences"
              description="Once someone submits their dates, budget and travel preferences, we'll start suggesting destinations here."
            />
          ) : !topMatch ? (
            <EmptyState
              title="No strong matches yet"
              description="We couldn't find a destination and date that works well enough yet. Try inviting more people, or check back once everyone's submitted."
            />
          ) : (
            <>
              <p className="text-sm text-teal-950/70">
                Top match right now:{" "}
                <span className="font-medium text-teal-950">
                  {topMatch.destination.name}, {topMatch.destination.country}
                </span>{" "}
                at {topMatch.matchScore}% group match.
              </p>
              <Link href={`/trips/${tripId}/discover`}>
                <Button variant="secondary" className="w-full">
                  See all suggested destinations
                </Button>
              </Link>
              <Link href={`/trips/${tripId}/vote`}>
                <Button className="w-full">Go to the vote</Button>
              </Link>
            </>
          )}
        </Card>
      )}
    </Container>
  );
}
