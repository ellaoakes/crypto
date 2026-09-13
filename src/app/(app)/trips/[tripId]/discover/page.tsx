import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { DestinationDiscovery } from "@/components/discover/DestinationDiscovery";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { getTripForParticipant } from "@/lib/trips";
import { getVotingState } from "@/lib/votes";

export default async function DiscoverPage({
  params,
}: PageProps<"/trips/[tripId]/discover">) {
  const { tripId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}/discover`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const hasSubmissions = trip.participants.some((participant) => participant.status === "SUBMITTED");

  const header = (
    <div className="flex flex-col gap-1">
      <Link href={`/trips/${tripId}`} className="text-sm text-teal-700 hover:underline">
        ← Back to {trip.name}
      </Link>
      <h1 className="text-xl font-semibold text-teal-950">Suggested destinations</h1>
      <p className="text-sm text-teal-950/60">
        {trip.status === "LOCKED"
          ? "This trip is locked in — voting is closed."
          : "Based on everyone's actual dates, budget and preferences."}
      </p>
    </div>
  );

  if (!hasSubmissions) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="Waiting on preferences"
          description="Once someone submits their dates, budget and travel preferences, we'll start suggesting destinations here."
        />
      </Container>
    );
  }

  const [matches, votingState] = await Promise.all([
    getGroupMatchesForTrip(tripId),
    getVotingState(tripId, session.user.id),
  ]);

  return (
    <Container className="flex flex-1 flex-col gap-4">
      {header}
      {matches.length === 0 ? (
        <EmptyState
          title="No strong matches yet"
          description="We couldn't find a destination and date that works well enough yet. Try inviting more people, or check back once everyone's submitted."
        />
      ) : (
        <DestinationDiscovery
          tripId={tripId}
          matches={matches}
          votingState={votingState}
          votingClosed={trip.status === "LOCKED"}
        />
      )}
    </Container>
  );
}
