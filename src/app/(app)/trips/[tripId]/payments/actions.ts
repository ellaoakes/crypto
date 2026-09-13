"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { MoneyError, parseMajorToMinor } from "@/lib/payments/money";
import { cancelPayment } from "@/lib/payments/refunds";
import { createPayment, PaymentError, setPaymentTerms } from "@/lib/payments/service";

export interface PaymentActionResult {
  error?: string;
  clientSecret?: string | null;
  paymentId?: string;
  charge?: { amount: number; platformFee: number; totalCharged: number };
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
 * Starts a payment and hands the browser a client secret. Note what it does
 * NOT do: mark anything paid. Only a signature-verified webhook does that.
 */
export async function startPaymentAction(
  tripId: string,
  amountInput?: string,
): Promise<PaymentActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  try {
    const requestedAmount =
      amountInput && amountInput.trim() !== "" ? parseMajorToMinor(amountInput) : undefined;

    const result = await createPayment({ tripId, userId: session.user.id, requestedAmount });
    revalidatePath(`/trips/${tripId}`);
    return { clientSecret: result.clientSecret, paymentId: result.paymentId, charge: result.charge };
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
