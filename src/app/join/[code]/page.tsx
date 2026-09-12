import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { JoinTripForm } from "@/components/trips/JoinTripForm";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getTripPreviewByInviteCode } from "@/lib/trips";

export default async function JoinTripPage({
  params,
}: PageProps<"/join/[code]">) {
  const { code } = await params;
  const trip = await getTripPreviewByInviteCode(code);

  if (!trip) {
    notFound();
  }

  const session = await auth();
  const canJoin = trip.status !== "CANCELLED" && trip.status !== "LOCKED";

  return (
    <Container className="flex flex-1 flex-col justify-center gap-6">
      <Card className="flex flex-col gap-4 text-center">
        <div>
          <p className="text-sm text-teal-950/60">You&apos;re invited to</p>
          <h1 className="text-xl font-semibold text-teal-950">{trip.name}</h1>
          <p className="mt-1 text-sm text-teal-950/60">
            {trip._count.participants}{" "}
            {trip._count.participants === 1 ? "person has" : "people have"}{" "}
            joined so far
          </p>
        </div>

        {canJoin ? (
          session?.user ? (
            <JoinTripForm inviteCode={code} />
          ) : (
            <Link href={`/sign-in?callbackUrl=/join/${code}`}>
              <Button>Sign in to join</Button>
            </Link>
          )
        ) : (
          <Alert tone="info">
            This trip is no longer accepting new participants.
          </Alert>
        )}
      </Card>
    </Container>
  );
}
