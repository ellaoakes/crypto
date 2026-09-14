import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AmountPicker } from "@/components/payments/AmountPicker";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getParticipantPaymentView } from "@/lib/payments/service";
import { getTripForParticipant } from "@/lib/trips";

/** Choosing how much to pay towards what's left. */
export default async function PayAmountPage({
  params,
}: PageProps<"/trips/[tripId]/pay/amount">) {
  const { tripId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}/pay/amount`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const view = await getParticipantPaymentView(tripId, session.user.id);

  const header = (
    <div className="flex flex-col gap-1">
      <Link href={`/trips/${tripId}/pay`} className="text-sm text-teal-700 hover:underline">
        ← Back to payments
      </Link>
      <h1 className="text-xl font-semibold text-teal-950">Make a payment</h1>
    </div>
  );

  // The initial payment isn't a choice — it's a fixed amount everyone owes —
  // so this screen never applies before it's settled.
  if (!view.initialPaymentPaid) {
    redirect(`/trips/${tripId}/pay`);
  }

  if (view.remainingBalance === 0) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="You're all paid up"
          description="There's nothing left to pay on this trip. 🎉"
        />
      </Container>
    );
  }

  if (trip.settlementMode === "UNCONFIGURED") {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="Payments aren't available yet"
          description="Payments aren't switched on for this trip, so nothing can be charged."
        />
      </Container>
    );
  }

  return (
    <Container className="flex flex-1 flex-col gap-4">
      {header}
      <AmountPicker
        tripId={tripId}
        currency={view.currency}
        remainingBalance={view.remainingBalance}
      />
    </Container>
  );
}
