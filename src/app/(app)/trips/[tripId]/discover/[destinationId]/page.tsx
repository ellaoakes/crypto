import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { VoteButton } from "@/components/discover/VoteButton";
import { RatingBar } from "@/components/discover/RatingBar";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { formatCostPerPersonRange, formatDateRangeWithYear, formatFlightHoursRange } from "@/lib/format";
import { auth } from "@/auth";
import { getGroupMatchesForTrip } from "@/lib/matching-service";
import type { ScoreBreakdown } from "@/lib/matching";
import { getTripForParticipant } from "@/lib/trips";
import { getVoteSummaryForTrip } from "@/lib/votes";

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

  const [matches, voteSummary] = await Promise.all([
    getGroupMatchesForTrip(tripId),
    getVoteSummaryForTrip(tripId, session.user.id),
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
  const vote = voteSummary[destinationId] ?? { count: 0, votedByMe: false };

  return (
    <Container className="flex flex-1 flex-col gap-4">
      <Link href={`/trips/${tripId}/discover`} className="text-sm text-teal-700 hover:underline">
        ← Back to suggestions
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-teal-950">{destination.name}</h1>
        <p className="text-teal-950/60">
          {destination.region}, {destination.country}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-teal-950">{result.matchScore}% group match</p>
        <p className="text-teal-950">{formatDateRangeWithYear(result.dates)}</p>
        <p className="text-teal-950">{formatCostPerPersonRange(result.estimatedCostPerPersonRange)}</p>
        <p className="text-teal-950/70">{formatFlightHoursRange(result.estimatedFlightHoursRange)}</p>
        <p className="text-teal-950/70">
          {result.attendingCount} of {result.totalParticipants} can attend these dates
        </p>
      </Card>

      {result.keyMatchingFactors.length > 0 || result.compromises.length > 0 ? (
        <Card className="flex flex-col gap-1.5">
          {result.keyMatchingFactors.map((factor) => (
            <p key={factor} className="flex gap-1.5 text-sm text-teal-800">
              <span aria-hidden="true">✓</span> {factor}
            </p>
          ))}
          {result.compromises.map((compromise) => (
            <p key={compromise} className="flex gap-1.5 text-sm text-amber-700">
              <span aria-hidden="true">⚠</span> {compromise}
            </p>
          ))}
        </Card>
      ) : null}

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

      <VoteButton
        tripId={tripId}
        destinationId={destinationId}
        initialVoted={vote.votedByMe}
        initialCount={vote.count}
      />
    </Container>
  );
}
