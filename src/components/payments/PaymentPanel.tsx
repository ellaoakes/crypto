"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelPaymentAction,
  startPaymentAction,
} from "@/app/(app)/trips/[tripId]/payments/actions";
import { PaymentProgress } from "@/components/payments/PaymentProgress";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMinor, formatMinorCompact } from "@/lib/payments/money";
import type { ParticipantPaymentView } from "@/lib/payments/service";

function formatDeadline(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What one participant sees about their own money.
 *
 * Every figure here comes from the server's view of the ledger. Starting a
 * payment hands back a Stripe client secret; nothing in this component ever
 * decides that a payment succeeded — that's the webhook's job, and the panel
 * simply re-reads the server after Stripe hands control back.
 */
export function PaymentPanel({
  tripId,
  view,
  paymentsAvailable,
}: {
  tripId: string;
  view: ParticipantPaymentView;
  /** False when the trip has no settlement account configured yet. */
  paymentsAvailable: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inFlight = view.payments.find(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  const firstDeadline = formatDeadline(view.paymentDeadline);
  const finalDeadline = formatDeadline(view.finalPaymentDeadline);

  function handlePay() {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await startPaymentAction(
        tripId,
        view.initialPaymentPaid ? amount : undefined,
      );

      if (result.error) {
        setError(result.error);
        return;
      }
      // In a fully wired Stripe integration the client secret is handed to
      // Stripe.js to collect the card. Card details never reach this app.
      setNotice(
        result.clientSecret
          ? "Payment started — continue in the secure Stripe form to enter your card."
          : "Payment started.",
      );
      setAmount("");
      router.refresh();
    });
  }

  function handleCancel(paymentId: string) {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await cancelPaymentAction(tripId, paymentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice("Payment cancelled.");
      router.refresh();
    });
  }

  if (view.totalTripAmount === 0) {
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="font-medium text-teal-950">Your payments</h3>
        <p className="text-sm text-teal-950/60">
          The organizer hasn&apos;t set the trip cost yet. Nothing to pay for now.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-teal-950">Your payments</h3>
        <PaymentStatusBadge status={view.status} />
      </div>

      <PaymentProgress
        totalAmountPaid={view.totalAmountPaid}
        totalTripAmount={view.totalTripAmount}
        currency={view.currency}
      />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-teal-950/60">Still to pay</dt>
          <dd className="font-medium text-teal-950">
            {formatMinorCompact(view.remainingBalance, view.currency)}
          </dd>
        </div>
        {!view.initialPaymentPaid ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Required deposit</dt>
            <dd className="font-medium text-teal-950">
              {formatMinorCompact(view.requiredInitialPayment, view.currency)}
            </dd>
          </div>
        ) : null}
        {firstDeadline ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Deposit due by</dt>
            <dd className="text-teal-950">{firstDeadline}</dd>
          </div>
        ) : null}
        {finalDeadline ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Balance due by</dt>
            <dd className="text-teal-950">{finalDeadline}</dd>
          </div>
        ) : null}
      </dl>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {!paymentsAvailable ? (
        <Alert tone="info">
          Payments aren&apos;t switched on for this trip yet, so nothing can be charged.
        </Alert>
      ) : inFlight ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-teal-950/70">
            You have a payment of {formatMinor(inFlight.totalCharged, view.currency)} in
            progress.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="sm:flex-1" isLoading={isPending} onClick={handlePay}>
              Continue payment
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="sm:flex-1"
              disabled={isPending}
              onClick={() => handleCancel(inFlight.id)}
            >
              Cancel it
            </Button>
          </div>
        </div>
      ) : view.remainingBalance === 0 ? (
        <p className="text-sm font-medium text-emerald-700">
          You&apos;re all paid up for this trip. 🎉
        </p>
      ) : !view.initialPaymentPaid ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-teal-50 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-teal-950/70">Trip payment</span>
              <span className="text-teal-950">
                {formatMinor(view.requiredInitialPayment, view.currency)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-teal-950/70">
                One-time platform fee{view.platformFeePaid ? " (already paid)" : ""}
              </span>
              <span className="text-teal-950">
                {formatMinor(view.platformFeePaid ? 0 : view.platformFeeMinor, view.currency)}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-2 border-t border-teal-200 pt-1 font-semibold">
              <span className="text-teal-950">Total</span>
              <span className="text-teal-950">
                {formatMinor(
                  view.requiredInitialPayment + (view.platformFeePaid ? 0 : view.platformFeeMinor),
                  view.currency,
                )}
              </span>
            </div>
          </div>
          <Button type="button" className="w-full" isLoading={isPending} onClick={handlePay}>
            Pay {formatMinorCompact(view.requiredInitialPayment, view.currency)} deposit
          </Button>
          <p className="text-xs text-teal-950/50">
            The {formatMinor(view.platformFeeMinor, view.currency)} fee is charged once. Later
            payments have no fee.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            label="Pay some more"
            name="amount"
            inputMode="decimal"
            placeholder={String(view.remainingBalance / 100)}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            hint={`Anything up to ${formatMinorCompact(view.remainingBalance, view.currency)}. No fee on this one.`}
          />
          <Button
            type="button"
            className="w-full"
            isLoading={isPending}
            disabled={amount.trim() === ""}
            onClick={handlePay}
          >
            Pay {amount.trim() === "" ? "" : `£${amount}`}
          </Button>
        </div>
      )}

      {view.payments.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-teal-100 pt-3">
          <h4 className="text-sm font-medium text-teal-950">History</h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {view.payments.map((payment) => (
              <li key={payment.id} className="flex items-baseline justify-between gap-2">
                <span className="text-teal-950/70">
                  {new Date(payment.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  {payment.platformFee > 0 && payment.status === "SUCCEEDED"
                    ? ` · incl. ${formatMinor(payment.platformFee, view.currency)} fee`
                    : ""}
                  {payment.refundedAmount > 0
                    ? ` · ${formatMinor(payment.refundedAmount, view.currency)} refunded`
                    : ""}
                </span>
                <span
                  className={
                    payment.status === "SUCCEEDED"
                      ? "font-medium text-teal-950"
                      : "text-teal-950/50"
                  }
                >
                  {formatMinor(payment.amount, view.currency)}
                  {payment.status === "SUCCEEDED" ? "" : ` (${payment.status.toLowerCase()})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
