"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setPaymentTermsAction } from "@/app/(app)/trips/[tripId]/payments/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMinor } from "@/lib/payments/money";

/**
 * The organizer's payment terms. The initial amount applies to everyone
 * identically — there is no per-person field, by design — and the server
 * refuses to change it once anyone has paid.
 */
export function PaymentSetupForm({
  tripId,
  currency,
  platformFeeMinor,
  initialValues,
  locked,
}: {
  tripId: string;
  currency: string;
  platformFeeMinor: number;
  initialValues: {
    totalAmountPerPerson: string;
    initialPaymentAmount: string;
    paymentDeadline: string;
    finalPaymentDeadline: string;
  };
  /** True once someone has paid: the initial amount can no longer change. */
  locked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Controlled on purpose: React resets a form after its action runs, which
  // would throw away everything the organizer typed the moment a validation
  // error comes back. Holding the values here keeps them on screen to correct.
  const [values, setValues] = useState(initialValues);

  function update(field: keyof typeof initialValues) {
    return (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await setPaymentTermsAction(tripId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Total trip cost per person"
        name="totalAmountPerPerson"
        inputMode="decimal"
        required
        value={values.totalAmountPerPerson}
        onChange={update("totalAmountPerPerson")}
        hint={`In ${currency}, e.g. 1200`}
      />
      <Input
        label="Required initial payment per person"
        name="initialPaymentAmount"
        inputMode="decimal"
        required
        readOnly={locked}
        value={values.initialPaymentAmount}
        onChange={update("initialPaymentAmount")}
        hint={
          locked
            ? "Someone has already paid, so this can't change."
            : `Everyone pays the same. A one-time ${formatMinor(platformFeeMinor, currency)} platform fee is added to this first payment only.`
        }
      />
      <Input
        label="Payment deadline"
        name="paymentDeadline"
        type="date"
        value={values.paymentDeadline}
        onChange={update("paymentDeadline")}
        hint="When the initial payment is due. Optional."
      />
      <Input
        label="Final payment deadline"
        name="finalPaymentDeadline"
        type="date"
        value={values.finalPaymentDeadline}
        onChange={update("finalPaymentDeadline")}
        hint="When the balance is due. Optional."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">Payment settings saved.</Alert> : null}

      <Button type="submit" className="w-full" isLoading={isPending}>
        Save payment settings
      </Button>
    </form>
  );
}
