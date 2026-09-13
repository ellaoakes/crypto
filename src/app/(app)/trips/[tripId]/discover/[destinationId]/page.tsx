import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { DestinationBanner } from "@/components/discover/DestinationBanner";
import { RatingBar } from "@/components/discover/RatingBar";
import { VoteButton } from "@/components/discover/VoteButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { formatCostPerPersonRange, formatDateRangeWithYear, formatFlightHoursRange } from "@/lib/format";
import type { ScoreBreakdown } from "@/lib/matching";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import { getTripForParticipant } from "@/lib/trips";
import { getVotingState } from "@/lib/votes";

const ACTIVITY_LABELS: Record<string, string> = {
  beach: "Beach",
  nightlife: "Nightlife",
  food: "Food & drink",
  luxury: "Luxury",
  culture: "Culture",
  adventure: "Adventure",
};

const SCORE_LABELS: Record<keyof ScoreBreakdown, string> = {
  availability: "Group availability",
  budget: "Budget fit",
  tripLength: "Trip length fit",
  climate: "Climate fit",
  activity: "Activity & vibe fit",
  flightTime: "Flight time",
  destinationPreference: "Destination wishlist",
  destinationExclusion: "Group sentiment",
};

export default async function DestinationDetailPage({
  params,
}: PageProps<"/trips/[tripId]/discover/[destinationId]">) {
  const { tripId, destinationId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}/discover/${destinationId}`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const [matches, votingState] = await Promise.all([
    getGroupMatchesForTrip(tripId),
    getVotingState(tripId, session.user.id),
  ]);

  const result = matches.find((match) => match.destination.id === destinationId);
  if (!result) {
    notFound();
  }

  const { destination } = result;
  const attendees = trip.participants.filter((participant) =>
    result.attendingParticipantIds.includes(participant.userId),
  );
  const notAttending = trip.participants.filter(
    (participant) => !result.attendingParticipantIds.includes(participant.userId),
  );


  return (
    <Container className="flex flex-1 flex-col gap-4">
      <Link href={`/trips/${tripId}/discover`} className="text-sm text-teal-700 hover:underline">
        ← Back to recommendations
      </Link>

      <div className="overflow-hidden rounded-2xl">
        <DestinationBanner
          destination={destination}
          size="hero"
          matchScore={result.matchScore}
          headingTag="h1"
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <p className="font-medium text-teal-950">{formatDateRangeWithYear(result.dates)}</p>
          <p className="text-teal-950">{formatCostPerPersonRange(result.estimatedCostPerPersonRange)}</p>
          <p className="text-teal-950/70">{formatFlightHoursRange(result.estimatedFlightHoursRange)}</p>
          <p className="text-teal-950/70">
            {result.attendingCount} of {result.totalParticipants} can attend these dates
          </p>
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-teal-950">Why your group matches</h2>
          <p className="text-sm font-medium text-emerald-700">{result.matchScore}% group match</p>
          {result.keyMatchingFactors.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm text-teal-800">
              {result.keyMatchingFactors.map((factor) => (
                <li key={factor} className="flex gap-2">
                  <span aria-hidden="true">✓</span>
                  {factor}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-teal-950/60">
              Nothing stood out as a clear win — this is a middle-of-the-road option for the group.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-teal-950">Things to consider</h2>
          {result.compromises.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm text-amber-700">
              {result.compromises.map((compromise) => (
                <li key={compromise} className="flex gap-2">
                  <span aria-hidden="true">⚠</span>
                  {compromise}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-teal-950/60">
              No real downsides here — this works well for everyone in the group.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-teal-950">What {destination.name} offers</h2>
          {Object.entries(destination.ratings).map(([key, value]) => (
            <RatingBar key={key} label={ACTIVITY_LABELS[key] ?? key} value={value} max={5} />
          ))}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-teal-950">How we scored it</h2>
          {(Object.keys(SCORE_LABELS) as (keyof ScoreBreakdown)[]).map((key) => (
            <RatingBar key={key} label={SCORE_LABELS[key]} value={result.scoreBreakdown[key]} max={1} />
          ))}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-teal-950">Who&apos;s in</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {attendees.map((participant) => (
              <li key={participant.id} className="text-teal-950">
                ✓ {participant.user.name ?? participant.user.email}
              </li>
            ))}
            {notAttending.map((participant) => (
              <li key={participant.id} className="text-teal-950/50">
                — {participant.user.name ?? participant.user.email}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-2 pb-2 sm:flex-row-reverse">
          {trip.status === "LOCKED" ? (
            <p className="flex h-11 items-center justify-center text-sm text-teal-950/60 sm:flex-1">
              Voting is closed — this trip is locked in.
            </p>
          ) : (
            <VoteButton
              tripId={tripId}
              destinationId={destinationId}
              votedForThis={votingState.myVoteDestinationId === destinationId}
              voteCount={votingState.tally[destinationId] ?? 0}
              label="Vote for this destination"
              className="sm:flex-1"
            />
          )}
          <Link href={`/trips/${tripId}/discover`} className="sm:flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Back to recommendations
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
