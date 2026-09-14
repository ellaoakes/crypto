"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { remindOutstandingInitialPayments } from "@/lib/notifications/organizerReminders";
import { MoneyError, parseMajorToMinor } from "@/lib/payments/money";
import { cancelPayment } from "@/lib/payments/refunds";
import {
  createPayment,
  getPaymentAttemptStatus,
  PaymentError,
  reconcilePaymentWithStripe,
  setPaymentTerms,
  type PaymentAttemptStatus,
} from "@/lib/payments/service";

export interface StartPaymentResult {
  error?: string;
  /** Stripe's hosted page. The browser is sent here; we collect no card data. */
  checkoutUrl?: string | null;
  paymentId?: string;
  resumed?: boolean;
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof PaymentError || error instanceof MoneyError) return error.message;
  console.error(fallback, error);
  return fallback;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(`${value}T23:59:59Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function setPaymentTermsAction(
  tripId: string,
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    const totalAmountPerPerson = parseMajorToMinor(String(formData.get("totalAmountPerPerson") ?? ""));
    const initialPaymentAmount = parseMajorToMinor(String(formData.get("initialPaymentAmount") ?? ""));

    await setPaymentTerms({
      tripId,
      userId: session.user.id,
      totalAmountPerPerson,
      initialPaymentAmount,
      paymentDeadline: parseOptionalDate(formData.get("paymentDeadline")),
      finalPaymentDeadline: parseOptionalDate(formData.get("finalPaymentDeadline")),
    });

    revalidatePath(`/trips/${tripId}`);
    return { success: true };
  } catch (error) {
    return { error: toMessage(error, "Couldn't save those payment settings.") };
  }
}

/**
 * Opens a Stripe Checkout Session and hands back its URL.
 *
 * Note what it does NOT do: decide anything about money. The amount is
 * recalculated server-side (the initial payment ignores `amountInput`
 * entirely), the fee is calculated server-side, and the payment row it
 * creates is PENDING until a verified webhook says otherwise.
 */
export async function startPaymentAction(
  tripId: string,
  amountInput?: string,
): Promise<StartPaymentResult> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    const requestedAmount =
      amountInput && amountInput.trim() !== "" ? parseMajorToMinor(amountInput) : undefined;

    const result = await createPayment({ tripId, userId: session.user.id, requestedAmount });
    revalidatePath(`/trips/${tripId}`);
    return { checkoutUrl: result.checkoutUrl, paymentId: result.paymentId, resumed: result.resumed };
  } catch (error) {
    return { error: toMessage(error, "Couldn't start that payment.") };
  }
}

export async function cancelPaymentAction(
  tripId: string,
  paymentId: string,
): Promise<{ error?: string; success?: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    await cancelPayment({ paymentId, userId: session.user.id });
    revalidatePath(`/trips/${tripId}`);
    return { success: true };
  } catch (error) {
    return { error: toMessage(error, "Couldn't cancel that payment.") };
  }
}

/**
 * Polled by the return page while a payment is still unconfirmed.
 *
 * `reconcile` asks Stripe directly, as a safety net for a slow or lost
 * webhook. Either way the answer comes from the server — the browser is never
 * the thing that decides a payment worked.
 */
export async function checkPaymentAction(
  tripId: string,
  paymentId: string,
  reconcile = false,
): Promise<{ error?: string; status?: PaymentAttemptStatus }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    const status = reconcile
      ? await reconcilePaymentWithStripe({ tripId, userId: session.user.id, paymentId })
      : await getPaymentAttemptStatus({ tripId, userId: session.user.id, paymentId });

    if (status.outcome === "succeeded") {
      revalidatePath(`/trips/${tripId}`);
    }
    return { status };
  } catch (error) {
    return { error: toMessage(error, "Couldn't check that payment.") };
  }
}

export interface RemindActionResult {
  error?: string;
  reminded?: string[];
  skipped?: string[];
  nobodyOutstanding?: boolean;
}

/**
 * Nudges participants who haven't made their initial payment.
 *
 * Reminders are notifications and nothing else: this path reads the ledger
 * and writes to the notification tables. It has no way to mark anyone as
 * paid, waive a balance or move a deadline.
 */
export async function remindOutstandingAction(tripId: string): Promise<RemindActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    const outcome = await remindOutstandingInitialPayments({
      tripId,
      organizerId: session.user.id,
    });

    revalidatePath(`/trips/${tripId}`);
    return {
      reminded: outcome.reminded.map((person) => person.name),
      skipped: outcome.skippedRecentlyReminded.map((person) => person.name),
      nobodyOutstanding: outcome.nobodyOutstanding,
    };
  } catch (error) {
    return { error: toMessage(error, "Couldn't send those reminders.") };
  }
}
