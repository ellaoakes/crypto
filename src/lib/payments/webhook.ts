import { prisma } from "@/lib/prisma";
import type { WebhookEventShape } from "@/lib/payments/gateway";
import { refreshParticipantProjection } from "@/lib/payments/service";

/**
 * Applies a Stripe event to the ledger. This is the *only* place a payment
 * becomes SUCCEEDED — the client is never believed about whether money moved.
 *
 * Every event is claimed in `WebhookEvent` before it is applied, so a
 * redelivery (Stripe retries, and will happily send the same event twice)
 * hits the primary key and becomes a no-op instead of a second transition.
 */

export type WebhookOutcome = "applied" | "duplicate" | "ignored";

const HANDLED_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "charge.refund.updated",
]);

export async function processStripeEvent(event: WebhookEventShape): Promise<WebhookOutcome> {
  // Claim the event id first. If the insert fails, we've seen this event
  // before — but "seen" isn't the same as "finished": an attempt that threw
  // left the row behind with no processedAt, and Stripe's retry of that same
  // event must be allowed to try again rather than being swallowed as a
  // duplicate.
  try {
    await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    const claimed = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (!claimed || claimed.processedAt) {
      return "duplicate";
    }
    // Fall through and re-apply. Every handler below is written to be safe to
    // run twice, so a half-finished attempt can be completed rather than
    // leaving the ledger stuck.
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { error: null } });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    return "ignored";
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await applyIntentSucceeded(event);
        break;
      case "payment_intent.payment_failed":
        await applyIntentFailed(event);
        break;
      case "payment_intent.canceled":
        await applyIntentCancelled(event);
        break;
      case "charge.refunded":
      case "charge.refund.updated":
        await applyRefundUpdate(event);
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    return "applied";
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }
}

function intentId(event: WebhookEventShape): string {
  const id = event.data.object.id;
  if (typeof id !== "string") {
    throw new Error("Stripe event carried no object id");
  }
  return id;
}

async function findPaymentByIntent(stripePaymentIntentId: string) {
  return prisma.payment.findUnique({ where: { stripePaymentIntentId } });
}

async function applyIntentSucceeded(event: WebhookEventShape) {
  const payment = await findPaymentByIntent(intentId(event));
  if (!payment) return;
  // Already settled: an out-of-order or replayed event must not re-apply.
  if (payment.status === "SUCCEEDED") return;

  const charge = event.data.object.latest_charge;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        stripeChargeId: typeof charge === "string" ? charge : undefined,
        events: {
          create: {
            fromStatus: payment.status,
            toStatus: "SUCCEEDED",
            stripeEventId: event.id,
          },
        },
      },
    }),
    // The fee is only really ours once the charge carrying it succeeded.
    prisma.platformFee.updateMany({
      where: { paymentId: payment.id, status: "PENDING" },
      data: { status: "CHARGED" },
    }),
  ]);

  await refreshParticipantProjection(payment.tripId, payment.userId);
}

async function applyIntentFailed(event: WebhookEventShape) {
  const payment = await findPaymentByIntent(intentId(event));
  if (!payment) return;
  if (payment.status === "SUCCEEDED" || payment.status === "FAILED") return;

  const error = event.data.object.last_payment_error as
    | { code?: string; message?: string }
    | undefined;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureCode: error?.code,
        failureMessage: error?.message,
        events: {
          create: { fromStatus: payment.status, toStatus: "FAILED", stripeEventId: event.id },
        },
      },
    }),
    // A fee that never got charged is released, so the participant's retry
    // can reserve it again rather than being blocked by a dead row.
    prisma.platformFee.deleteMany({ where: { paymentId: payment.id, status: "PENDING" } }),
  ]);

  await refreshParticipantProjection(payment.tripId, payment.userId);
}

async function applyIntentCancelled(event: WebhookEventShape) {
  const payment = await findPaymentByIntent(intentId(event));
  if (!payment) return;
  if (payment.status === "SUCCEEDED" || payment.status === "CANCELLED") return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        events: {
          create: { fromStatus: payment.status, toStatus: "CANCELLED", stripeEventId: event.id },
        },
      },
    }),
    prisma.platformFee.deleteMany({ where: { paymentId: payment.id, status: "PENDING" } }),
  ]);

  await refreshParticipantProjection(payment.tripId, payment.userId);
}

/**
 * Settles refunds. Stripe reports refunds against the charge, so the amounts
 * here are reconciled against our own Refund rows rather than recomputed —
 * we already recorded how the money was split between trip and fee.
 */
async function applyRefundUpdate(event: WebhookEventShape) {
  const object = event.data.object;
  const refundId = typeof object.id === "string" && object.id.startsWith("re_") ? object.id : null;

  if (refundId) {
    const refund = await prisma.refund.findUnique({
      where: { stripeRefundId: refundId },
      include: { payment: true },
    });
    if (!refund) return;

    const status = object.status === "succeeded" ? "SUCCEEDED" : object.status === "failed" ? "FAILED" : "PENDING";
    if (refund.status === status) return;

    await prisma.refund.update({ where: { id: refund.id }, data: { status } });
    if (status === "SUCCEEDED" && refund.platformFeeAmount > 0) {
      await prisma.platformFee.updateMany({
        where: { paymentId: refund.paymentId },
        data: { status: "REFUNDED" },
      });
    }
    await refreshParticipantProjection(refund.payment.tripId, refund.payment.userId);
    return;
  }

  // charge.refunded carries the charge; settle every pending refund we hold
  // against the payment it belongs to.
  const chargeId = typeof object.id === "string" ? object.id : null;
  if (!chargeId) return;

  const payment = await prisma.payment.findFirst({ where: { stripeChargeId: chargeId } });
  if (!payment) return;

  await prisma.refund.updateMany({
    where: { paymentId: payment.id, status: "PENDING" },
    data: { status: "SUCCEEDED" },
  });
  await refreshParticipantProjection(payment.tripId, payment.userId);
}
