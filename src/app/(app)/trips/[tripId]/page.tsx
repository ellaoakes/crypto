import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CopyInviteLink } from "@/components/trips/CopyInviteLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { env } from "@/lib/env";
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

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-teal-950">{trip.name}</h1>
        <p className="text-sm text-teal-950/60">
          {tripStatusLabel[trip.status] ?? trip.status}
        </p>
      </div>

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

      <Card className="text-sm text-teal-950/70">
        Next up: everyone adds their available dates, budget and trip
        preferences, then we&apos;ll suggest destinations for the group to
        vote on. That part is coming soon.
      </Card>
    </Container>
  );
}
