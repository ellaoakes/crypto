"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startPaymentAction } from "@/app/(app)/trips/[tripId]/payments/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * Sends the participant to Stripe's hosted payment page.
 *
 * The amount travels as a hint only — the server recalculates both the trip
 * money and the fee before anything is charged, and ignores this value
 * entirely for the initial payment.
 */
export function PayButton({
  tripId,
  label,
  amountInput,
  disabled,
  variant = "primary",
  className,
}: {
  tripId: string;
  label: string;
  /** Major-unit string for a voluntary payment. Omitted for the initial one. */
  amountInput?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await startPaymentAction(tripId, amountInput);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.checkoutUrl) {
        // A payment exists but Stripe gave us nowhere to send them. Better to
        // say so than to pretend something happened.
        setError("We couldn't open the payment page. Please try again.");
        return;
      }

      // Held true through the navigation so the button can't be pressed twice
      // while the browser is on its way to Stripe.
      setRedirecting(true);
      router.push(result.checkoutUrl);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button
        type="button"
        variant={variant}
        className={className ?? "w-full"}
        isLoading={isPending || redirecting}
        disabled={disabled || isPending || redirecting}
        onClick={handleClick}
      >
        {redirecting ? "Taking you to Stripe…" : label}
      </Button>
      <p className="text-center text-xs text-teal-950/50">
        Payments are handled by Stripe. Your card details never reach us.
      </p>
    </div>
  );
}
