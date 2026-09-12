import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTripsForUser } from "@/lib/trips";

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  COLLECTING: "Collecting availability",
  RECOMMENDING: "Voting on destinations",
  LOCKED: "Locked in",
  CANCELLED: "Cancelled",
};

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Container className="flex flex-1 flex-col justify-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-teal-950">
            Plan the group trip without the group chat chaos
          </h1>
          <p className="text-teal-950/70">
            Everyone shares their dates, budget and preferences. We find the
            trip that works for the most people.
          </p>
        </div>
        <Link href="/onboarding" className="self-center">
          <Button>Get started</Button>
        </Link>
      </Container>
    );
  }

  const trips = await getTripsForUser(session.user.id);

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-teal-950">Your trips</h1>
        <Link href="/onboarding/trip">
          <Button size="md">New trip</Button>
        </Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Start one and invite your friends — everyone adds their own dates and budget, and we'll find what works."
          action={
            <Link href="/onboarding/trip">
              <Button variant="secondary">Create your first trip</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`}>
                <Card className="transition-colors hover:border-teal-300">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-teal-950">{trip.name}</p>
                      <p className="text-sm text-teal-950/60">
                        {statusLabel[trip.status] ?? trip.status} ·{" "}
                        {trip._count.participants} participant
                        {trip._count.participants === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
