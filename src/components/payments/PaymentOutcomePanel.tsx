"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { checkPaymentAction } from "@/app/(app)/trips/[tripId]/payments/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatMinor } from "@/lib/payments/money";
import type { PaymentAttemptStatus } from "@/lib/payments/service";

/** How long to keep waiting on a webhook before offering a way out. */
const POLL_INTERVAL_MS = 2_000;
const POLLS_BEFORE_RECONCILING = 3;
const MAX_POLLS = 15;

/**
 * What the participant sees when they come back from Stripe.
 *
 * The critical rule: coming back through the success URL proves they finished
 * Stripe's form, not that any money moved. So this never says "paid" on the
 * strength of the URL — it shows the ledger's answer, which only a verified
 * webhook (or a server-side reconciliation against Stripe) can set.
 */
export function PaymentOutcomePanel({
  tripId,
  initialStatus,
  /** "returned" from Stripe's success URL, "cancelled" from its cancel URL. */
  returnKind,
}: {
  tripId: string;
  initialStatus: PaymentAttemptStatus;
  returnKind: "returned" | "cancelled";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [polls, setPolls] = useState(0);
  const settledRef = useRef(false);

  const waiting = status.outcome === "awaiting_confirmation" && returnKind === "returned";
  // Derived, not stored: setting this from inside the effect would schedule a
  // render from within a render pass.
  const gaveUp = polls >= MAX_POLLS;

  const poll = useCallback(async () => {
    // After a few quiet rounds, stop waiting on the webhook and ask Stripe
    // ourselves — still server-side, still not trusting the browser.
    const reconcile = polls >= POLLS_BEFORE_RECONCILING;
    const result = await checkPaymentAction(tripId, status.paymentId, reconcile);

    if (result.status) {
      setStatus(result.status);
      if (result.status.outcome === "succeeded" && !settledRef.current) {
        settledRef.current = true;
        router.refresh();
      }
    }
    setPolls((count) => count + 1);
  }, [polls, router, status.paymentId, tripId]);

  useEffect(() => {
    if (!waiting || gaveUp) return;

    const timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [gaveUp, poll, waiting]);

  const backToTrip = (
    <Link href={`/trips/${tripId}`} className="text-center text-sm text-teal-700 hover:underline">
      Back to the trip
    </Link>
  );

  if (returnKind === "cancelled" && status.outcome !== "succeeded") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-teal-950">Payment cancelled</h2>
          <p className="text-sm text-teal-950/70">
            Nothing was charged. You can pay whenever you&apos;re ready.
          </p>
        </Card>
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">Try again</Button>
        </Link>
        {backToTrip}
      </div>
    );
  }

  if (status.outcome === "succeeded") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-700">
            <span aria-hidden="true">✓</span> Payment confirmed
          </h2>
          <p className="text-sm text-teal-950">
            {formatMinor(status.amount, status.currency)} towards your trip
            {status.platformFee > 0
              ? `, plus the one-time ${formatMinor(status.platformFee, status.currency)} platform fee`
              : ""}
            .
          </p>
          <p className="text-sm text-teal-950/60">
            Charged: {formatMinor(status.totalCharged, status.currency)}
          </p>
        </Card>
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">See your payments</Button>
        </Link>
        {backToTrip}
      </div>
    );
  }

  if (status.outcome === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-red-700">Payment failed</h2>
          <p className="text-sm text-teal-950/70">
            {status.failureMessage ?? "Your payment didn't go through, and nothing was charged."}
          </p>
        </Card>
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">Try again</Button>
        </Link>
        {backToTrip}
      </div>
    );
  }

  if (status.outcome === "cancelled") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-teal-950">Payment cancelled</h2>
          <p className="text-sm text-teal-950/70">Nothing was charged.</p>
        </Card>
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">Try again</Button>
        </Link>
        {backToTrip}
      </div>
    );
  }

  // Still unconfirmed. Deliberately does not say "paid", "complete" or
  // "thank you" — we genuinely don't know yet.
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Card className="flex flex-col items-center gap-3 text-center">
        {gaveUp ? null : <Spinner />}
        <h2 className="font-semibold text-teal-950">
          {gaveUp ? "Still confirming your payment" : "Confirming your payment…"}
        </h2>
        <p className="text-sm text-teal-950/70">
          {gaveUp
            ? "Your bank is taking longer than usual to confirm. Nothing is lost — this page will show the payment as soon as it clears, and we won't charge you twice."
            : "We're waiting for confirmation from your bank. This usually takes a few seconds."}
        </p>
        <p className="text-xs text-teal-950/50">
          {formatMinor(status.totalCharged, status.currency)} · we&apos;ll only mark this paid once
          it&apos;s confirmed.
        </p>
      </Card>

      {gaveUp ? (
        <Alert tone="info">
          Refresh this page to check again, or come back later — your payment will be recorded
          either way.
        </Alert>
      ) : null}

      {backToTrip}
    </div>
  );
}
