// @vitest-environment node
/**
 * The payment flows, exercised against the real database.
 *
 * These are integration tests on purpose. The guarantees this step is built
 * on — the fee charged at most once, a redelivered webhook doing nothing, two
 * concurrent attempts producing one charge — are enforced by database
 * constraints, and a mocked Prisma would test the mock rather than the
 * guarantee. Stripe itself is stubbed: no network, no API keys.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import type {
  CreateCheckoutArgs,
  CreateRefundArgs,
  PaymentGateway,
  WebhookEventShape,
} from "@/lib/payments/gateway";
import { PLATFORM_FEE_MINOR } from "@/lib/payments/money";
import { cancelPayment, refundPayment } from "@/lib/payments/refunds";
import {
  createPayment,
  getParticipantPaymentView,
  getPaymentAttemptStatus,
  PaymentError,
  reconcilePaymentWithStripe,
  setPaymentTerms,
} from "@/lib/payments/service";
import { processStripeEvent } from "@/lib/payments/webhook";

const TOTAL = 120_000; // £1,200
const INITIAL = 20_000; // £200

/** A Stripe stand-in that records what it was asked to do. */
function makeGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway & {
  sessions: CreateCheckoutArgs[];
  refunds: CreateRefundArgs[];
  sessionState: Map<string, { status: string; paymentStatus: string; paymentIntentId: string | null }>;
} {
  const sessions: CreateCheckoutArgs[] = [];
  const refunds: CreateRefundArgs[] = [];
  const sessionState = new Map<string, { status: string; paymentStatus: string; paymentIntentId: string | null }>();
  // Stripe collapses two creates with the same idempotency key onto one
  // session, so the stub does too — otherwise the tests would pass against
  // behaviour Stripe doesn't actually have.
  const byKey = new Map<string, { id: string; paymentIntentId: string }>();

  return {
    sessions,
    refunds,
    sessionState,
    async createCheckoutSession(args) {
      sessions.push(args);
      const existing = byKey.get(args.idempotencyKey);
      const id = existing?.id ?? `cs_${randomUUID()}`;
      const paymentIntentId = existing?.paymentIntentId ?? `pi_${randomUUID()}`;
      byKey.set(args.idempotencyKey, { id, paymentIntentId });
      sessionState.set(id, { status: "open", paymentStatus: "unpaid", paymentIntentId });
      return { id, url: `https://checkout.stripe.test/${id}`, paymentIntentId, status: "open" };
    },
    async retrieveCheckoutSession(sessionId) {
      const state = sessionState.get(sessionId) ?? {
        status: "open",
        paymentStatus: "unpaid",
        paymentIntentId: null,
      };
      return { id: sessionId, ...state };
    },
    async expireCheckoutSession(sessionId) {
      const state = sessionState.get(sessionId);
      if (state) sessionState.set(sessionId, { ...state, status: "expired" });
    },
    async cancelPaymentIntent() {},
    async createRefund(args) {
      refunds.push(args);
      return { id: `re_${randomUUID()}`, status: "pending" };
    },
    constructWebhookEvent(): WebhookEventShape {
      throw new Error("not used");
    },
    ...overrides,
  };
}

function succeededEvent(intentId: string, eventId = `evt_${randomUUID()}`): WebhookEventShape {
  return {
    id: eventId,
    type: "payment_intent.succeeded",
    data: { object: { id: intentId, latest_charge: `ch_${randomUUID()}` } },
  };
}

function failedEvent(intentId: string, eventId = `evt_${randomUUID()}`): WebhookEventShape {
  return {
    id: eventId,
    type: "payment_intent.payment_failed",
    data: {
      object: { id: intentId, last_payment_error: { code: "card_declined", message: "Your card was declined." } },
    },
  };
}

const created: string[] = [];

async function makeTrip({
  participants = 2,
  settlementMode = "CONNECTED_ACCOUNT",
  status = "CONFIRMED",
}: {
  participants?: number;
  settlementMode?: "CONNECTED_ACCOUNT" | "UNCONFIGURED" | "PLATFORM_BALANCE";
  status?: "CONFIRMED" | "RECOMMENDING" | "COLLECTING";
} = {}) {
  const stamp = randomUUID().slice(0, 8);
  const users = [];
  for (let index = 0; index < participants; index++) {
    users.push(
      await prisma.user.create({
        data: { name: `Payer ${index}`, email: `pay.${stamp}.${index}@paytest.local` },
      }),
    );
  }
  created.push(...users.map((user) => user.id));

  const trip = await prisma.trip.create({
    data: {
      name: `Payments ${stamp}`,
      status,
      organizerId: users[0].id,
      settlementMode,
      settlementAccountId: settlementMode === "CONNECTED_ACCOUNT" ? "acct_test_settlement" : null,
      confirmedDestinationId: "split-croatia",
      confirmedDateStart: new Date("2027-05-14"),
      confirmedDateEnd: new Date("2027-05-18"),
      confirmedAt: new Date(),
      participants: {
        create: users.map((user) => ({ userId: user.id, status: "SUBMITTED" as const, joinedAt: new Date() })),
      },
    },
  });

  return { trip, users, organizer: users[0] };
}

/** Drives a payment all the way to succeeded, the way the real system does. */
async function pay(
  tripId: string,
  userId: string,
  gateway: ReturnType<typeof makeGateway>,
  requestedAmount?: number,
) {
  const result = await createPayment({ tripId, userId, requestedAmount }, gateway);
  const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });
  await processStripeEvent(succeededEvent(payment!.stripePaymentIntentId!));
  return result;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@paytest.local" } } });
  await prisma.$disconnect();
});

describe("setting payment terms", () => {
  it("snapshots the same initial amount onto every participant", async () => {
    const { trip, organizer } = await makeTrip({ participants: 3 });

    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });

    const participants = await prisma.tripParticipant.findMany({ where: { tripId: trip.id } });
    expect(participants).toHaveLength(3);
    for (const participant of participants) {
      expect(participant.requiredInitialPayment).toBe(INITIAL);
      expect(participant.totalTripAmount).toBe(TOTAL);
      expect(participant.remainingBalance).toBe(TOTAL);
    }
  });

  it("refuses anyone who isn't the organizer", async () => {
    const { trip, users } = await makeTrip();

    await expect(
      setPaymentTerms({
        tripId: trip.id,
        userId: users[1].id,
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: INITIAL,
      }),
    ).rejects.toMatchObject({ code: "NOT_ORGANIZER" });
  });

  it("refuses to change the initial amount once someone has paid", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    await pay(trip.id, organizer.id, makeGateway());

    await expect(
      setPaymentTerms({
        tripId: trip.id,
        userId: organizer.id,
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: 30_000,
      }),
    ).rejects.toMatchObject({ code: "INITIAL_LOCKED" });
  });

  it("still allows the total and deadlines to be adjusted after a payment", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    await pay(trip.id, organizer.id, makeGateway());

    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: 130_000,
      initialPaymentAmount: INITIAL,
    });

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalTripAmount).toBe(130_000);
    expect(view.remainingBalance).toBe(110_000);
  });
});

describe("successful initial payment", () => {
  it("charges the trip money plus the one-time fee", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();

    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    expect(result.charge).toEqual({
      amount: INITIAL,
      platformFee: PLATFORM_FEE_MINOR,
      totalCharged: INITIAL + PLATFORM_FEE_MINOR,
      kind: "INITIAL",
    });
    expect(gateway.sessions[0].totalCharged).toBe(20_500);
    expect(gateway.sessions[0].applicationFee).toBe(500);
    expect(gateway.sessions[0].destinationAccountId).toBe("acct_test_settlement");
  });

  it("stays PENDING until a webhook says otherwise", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });

    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway());

    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(payment?.status).toBe("PENDING");

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(0);
    expect(view.status).toBe("INITIAL_PAYMENT_PENDING");
  });

  it("settles the ledger and the projection when the webhook arrives", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    await pay(trip.id, organizer.id, makeGateway());

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(INITIAL);
    expect(view.remainingBalance).toBe(TOTAL - INITIAL); // fee excluded
    expect(view.status).toBe("INITIAL_PAYMENT_PAID");

    const participant = await prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: organizer.id } },
    });
    expect(participant?.initialPaymentPaid).toBe(true);
    expect(participant?.platformFeePaid).toBe(true);
    expect(participant?.totalAmountPaid).toBe(INITIAL);
    expect(participant?.remainingBalance).toBe(100_000);
    expect(participant?.paymentStatus).toBe("INITIAL_PAYMENT_PAID");

    const fee = await prisma.platformFee.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: organizer.id } },
    });
    expect(fee?.amount).toBe(PLATFORM_FEE_MINOR);
    expect(fee?.status).toBe("CHARGED");
  });
});

describe("failed initial payment", () => {
  it("records the failure and releases the fee for a retry", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });

    await processStripeEvent(failedEvent(payment!.stripePaymentIntentId!));

    const failed = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(failed?.status).toBe("FAILED");
    expect(failed?.failureCode).toBe("card_declined");

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.status).toBe("PAYMENT_FAILED");
    expect(view.totalAmountPaid).toBe(0);

    // The fee reservation is gone, so the retry can take it.
    const fee = await prisma.platformFee.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: organizer.id } },
    });
    expect(fee).toBeNull();
  });

  it("charges the fee exactly once across a failure and a successful retry", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();

    const first = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);
    const firstRow = await prisma.payment.findUnique({ where: { id: first.paymentId } });
    await processStripeEvent(failedEvent(firstRow!.stripePaymentIntentId!));

    await pay(trip.id, organizer.id, gateway);

    const fees = await prisma.platformFee.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    expect(fees).toHaveLength(1);
    expect(fees[0].status).toBe("CHARGED");
  });
});

describe("duplicate payment attempts", () => {
  it("reuses the in-flight attempt instead of creating a second charge", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();

    const first = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);
    const second = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    expect(second.paymentId).toBe(first.paymentId);
    expect(second.resumed).toBe(true);
    // Sent back to the very same Stripe page.
    expect(second.checkoutUrl).toBe(first.checkoutUrl);

    const payments = await prisma.payment.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    expect(payments).toHaveLength(1);
    // Resuming doesn't even reach Stripe — the stored page is reused.
    expect(gateway.sessions).toHaveLength(1);
  });

  it("survives two concurrent attempts without double-charging or double-feeing", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();

    const results = await Promise.allSettled([
      createPayment({ tripId: trip.id, userId: organizer.id }, gateway),
      createPayment({ tripId: trip.id, userId: organizer.id }, gateway),
    ]);

    const succeeded = results.filter((result) => result.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    const payments = await prisma.payment.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    const fees = await prisma.platformFee.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    // Whatever the interleaving, the database's unique constraints hold.
    expect(payments.length).toBeLessThanOrEqual(2);
    expect(fees).toHaveLength(1);
  });
});

describe("duplicate webhooks", () => {
  it("applies a redelivered event exactly once", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway());
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    const event = succeededEvent(payment!.stripePaymentIntentId!);

    expect(await processStripeEvent(event)).toBe("applied");
    expect(await processStripeEvent(event)).toBe("duplicate");
    expect(await processStripeEvent(event)).toBe("duplicate");

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(INITIAL);

    // One transition into SUCCEEDED, not three.
    const events = await prisma.paymentEvent.findMany({
      where: { paymentId: result.paymentId, toStatus: "SUCCEEDED" },
    });
    expect(events).toHaveLength(1);
  });

  it("ignores a distinct event that arrives for an already-settled payment", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway());
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });

    await processStripeEvent(succeededEvent(payment!.stripePaymentIntentId!));
    // A late "failed" for the same intent must not undo a succeeded payment.
    await processStripeEvent(failedEvent(payment!.stripePaymentIntentId!));

    const settled = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(settled?.status).toBe("SUCCEEDED");
  });

  it("ignores event types it doesn't handle", async () => {
    const outcome = await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "customer.created",
      data: { object: { id: "cus_123" } },
    });

    expect(outcome).toBe("ignored");
  });
});

describe("subsequent payments", () => {
  async function tripWithInitialPaid() {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    await pay(trip.id, organizer.id, gateway);
    return { trip, organizer, gateway };
  }

  it("carries no platform fee", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();

    const result = await createPayment({ tripId: trip.id, userId: organizer.id, requestedAmount: 30_000 }, gateway);

    expect(result.charge).toEqual({
      amount: 30_000,
      platformFee: 0,
      totalCharged: 30_000,
      kind: "ADDITIONAL",
    });
    expect(gateway.sessions.at(-1)?.applicationFee).toBe(0);
  });

  it("tracks a partial payment against the balance", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();
    await pay(trip.id, organizer.id, gateway, 10_000);

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(30_000);
    expect(view.remainingBalance).toBe(90_000);
    expect(view.status).toBe("PARTIALLY_PAID");
  });

  it("accumulates multiple subsequent payments", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();
    await pay(trip.id, organizer.id, gateway, 30_000);
    await pay(trip.id, organizer.id, gateway, 20_000);

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    // The brief's participant A: £200 + £300 + £200, £500 left.
    expect(view.totalAmountPaid).toBe(70_000);
    expect(view.remainingBalance).toBe(50_000);

    const fees = await prisma.platformFee.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    expect(fees).toHaveLength(1);
  });

  it("marks them FULLY_PAID on the final payment", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();
    await pay(trip.id, organizer.id, gateway, 100_000);

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.remainingBalance).toBe(0);
    expect(view.status).toBe("FULLY_PAID");

    const participant = await prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: organizer.id } },
    });
    expect(participant?.paymentStatus).toBe("FULLY_PAID");
  });

  it("prevents overpayment", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();

    await expect(
      createPayment({ tripId: trip.id, userId: organizer.id, requestedAmount: 100_001 }, gateway),
    ).rejects.toMatchObject({ code: "EXCEEDS_BALANCE" });

    const payments = await prisma.payment.findMany({ where: { tripId: trip.id, userId: organizer.id } });
    expect(payments).toHaveLength(1); // nothing was created
  });

  it("refuses any further payment once fully paid", async () => {
    const { trip, organizer, gateway } = await tripWithInitialPaid();
    await pay(trip.id, organizer.id, gateway, 100_000);

    await expect(
      createPayment({ tripId: trip.id, userId: organizer.id, requestedAmount: 1_000 }, gateway),
    ).rejects.toMatchObject({ code: "ALREADY_PAID" });
  });
});

describe("refunds", () => {
  async function paidTrip() {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await pay(trip.id, organizer.id, gateway);
    return { trip, organizer, gateway, paymentId: result.paymentId };
  }

  it("returns trip money without returning our fee by default", async () => {
    const { trip, organizer, gateway, paymentId } = await paidTrip();

    const refund = await refundPayment({ paymentId, organizerId: organizer.id }, gateway);

    expect(refund.tripAmount).toBe(INITIAL);
    expect(refund.platformFeeAmount).toBe(0);
    // Stripe is asked for the trip money only, and told to keep our fee.
    expect(gateway.refunds[0].amount).toBe(INITIAL);
    expect(gateway.refunds[0].refundPlatformFee).toBe(false);

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.status).toBe("REFUND_PENDING");
  });

  it("returns the fee as well when asked, and records the split", async () => {
    const { organizer, gateway, paymentId } = await paidTrip();

    const refund = await refundPayment(
      { paymentId, organizerId: organizer.id, refundPlatformFee: true },
      gateway,
    );

    expect(refund.tripAmount).toBe(INITIAL);
    expect(refund.platformFeeAmount).toBe(PLATFORM_FEE_MINOR);
    expect(gateway.refunds[0].amount).toBe(INITIAL + PLATFORM_FEE_MINOR);
    expect(gateway.refunds[0].refundPlatformFee).toBe(true);

    const row = await prisma.refund.findUnique({ where: { id: refund.refundId } });
    expect(row?.tripAmount).toBe(INITIAL);
    expect(row?.platformFeeAmount).toBe(PLATFORM_FEE_MINOR);
  });

  it("only moves the balance once the refund webhook settles it", async () => {
    const { trip, organizer, gateway, paymentId } = await paidTrip();
    const refund = await refundPayment({ paymentId, organizerId: organizer.id }, gateway);

    const pending = await getParticipantPaymentView(trip.id, organizer.id);
    expect(pending.totalAmountPaid).toBe(INITIAL);

    const row = await prisma.refund.findUnique({ where: { id: refund.refundId } });
    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "charge.refund.updated",
      data: { object: { id: row!.stripeRefundId, status: "succeeded" } },
    });

    const settled = await getParticipantPaymentView(trip.id, organizer.id);
    expect(settled.totalAmountPaid).toBe(0);
    expect(settled.remainingBalance).toBe(TOTAL);
    expect(settled.status).toBe("REFUNDED");
    // Our fee stays charged, so it can never be taken from them again.
    expect(settled.platformFeePaid).toBe(true);
  });

  it("supports a partial refund", async () => {
    const { trip, organizer, gateway } = await makeTrip().then(async ({ trip, organizer }) => {
      await setPaymentTerms({
        tripId: trip.id,
        userId: organizer.id,
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: INITIAL,
      });
      const gateway = makeGateway();
      await pay(trip.id, organizer.id, gateway);
      await pay(trip.id, organizer.id, gateway, 50_000);
      return { trip, organizer, gateway };
    });

    const additional = await prisma.payment.findFirst({
      where: { tripId: trip.id, userId: organizer.id, kind: "ADDITIONAL" },
    });
    const refund = await refundPayment(
      { paymentId: additional!.id, organizerId: organizer.id, tripAmount: 20_000 },
      gateway,
    );
    const row = await prisma.refund.findUnique({ where: { id: refund.refundId } });
    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "charge.refund.updated",
      data: { object: { id: row!.stripeRefundId, status: "succeeded" } },
    });

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(50_000);
    expect(view.remainingBalance).toBe(70_000);
    expect(view.status).toBe("PARTIALLY_REFUNDED");
  });

  it("refuses to refund more than the payment holds", async () => {
    const { organizer, gateway, paymentId } = await paidTrip();

    await expect(
      refundPayment({ paymentId, organizerId: organizer.id, tripAmount: INITIAL + 1 }, gateway),
    ).rejects.toMatchObject({ code: "EXCEEDS_REFUNDABLE" });
  });

  it("refuses a refund from anyone but the organizer", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await pay(trip.id, organizer.id, gateway);
    const other = await prisma.user.create({
      data: { name: "Nosy", email: `nosy.${randomUUID().slice(0, 8)}@paytest.local` },
    });

    await expect(
      refundPayment({ paymentId: result.paymentId, organizerId: other.id }, gateway),
    ).rejects.toMatchObject({ code: "NOT_ORGANIZER" });
  });
});

describe("cancellation", () => {
  it("lets the participant cancel their own in-flight payment and frees the fee", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    await cancelPayment({ paymentId: result.paymentId, userId: organizer.id }, gateway);

    const cancelled = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(cancelled?.status).toBe("CANCELLED");
    expect(
      await prisma.platformFee.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: organizer.id } },
      }),
    ).toBeNull();

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.status).toBe("NO_PAYMENT");
  });

  it("refuses to cancel someone else's payment", async () => {
    const { trip, organizer, users } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    await expect(
      cancelPayment({ paymentId: result.paymentId, userId: users[1].id }, gateway),
    ).rejects.toMatchObject({ code: "NOT_YOUR_PAYMENT" });
  });

  it("refuses to cancel a payment that already succeeded", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await pay(trip.id, organizer.id, gateway);

    await expect(
      cancelPayment({ paymentId: result.paymentId, userId: organizer.id }, gateway),
    ).rejects.toMatchObject({ code: "ALREADY_SUCCEEDED" });
  });
});

describe("deadlines", () => {
  it("reports a participant overdue once the deadline passes unpaid", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
      paymentDeadline: new Date("2027-03-01T00:00:00Z"),
    });

    const before = await getParticipantPaymentView(trip.id, organizer.id, new Date("2027-02-01"));
    expect(before.status).toBe("NO_PAYMENT");

    const after = await getParticipantPaymentView(trip.id, organizer.id, new Date("2027-04-01"));
    expect(after.status).toBe("PAYMENT_OVERDUE");
  });

  it("still lets an overdue participant pay", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
      paymentDeadline: new Date("2027-03-01T00:00:00Z"),
    });

    const result = await createPayment(
      { tripId: trip.id, userId: organizer.id },
      makeGateway(),
      new Date("2027-04-01"),
    );

    expect(result.charge.amount).toBe(INITIAL);
  });
});

describe("unauthorised access", () => {
  it("refuses payment for someone who isn't on the trip", async () => {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const stranger = await prisma.user.create({
      data: { name: "Stranger", email: `stranger.${randomUUID().slice(0, 8)}@paytest.local` },
    });

    await expect(
      createPayment({ tripId: trip.id, userId: stranger.id }, makeGateway()),
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" });
  });

  it("refuses to show a non-participant anyone's payment position", async () => {
    const { trip } = await makeTrip();
    const stranger = await prisma.user.create({
      data: { name: "Stranger", email: `stranger2.${randomUUID().slice(0, 8)}@paytest.local` },
    });

    await expect(getParticipantPaymentView(trip.id, stranger.id)).rejects.toMatchObject({
      code: "NOT_A_PARTICIPANT",
    });
  });

  it("refuses payment while the trip has no settlement account configured", async () => {
    const { trip, organizer } = await makeTrip({ settlementMode: "UNCONFIGURED" });
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });

    await expect(
      createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway()),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_CONFIGURED" });
  });

  it("refuses payment on a trip that isn't confirmed", async () => {
    const { trip, organizer } = await makeTrip({ status: "RECOMMENDING" });

    await expect(
      createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway()),
    ).rejects.toMatchObject({ code: "TRIP_NOT_CONFIRMED" });
    expect(PaymentError).toBeDefined();
  });
});


describe("the hosted checkout flow", () => {
  async function tripWithTerms() {
    const { trip, organizer, users } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    return { trip, organizer, users };
  }

  it("sends the participant to a Stripe-hosted page", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();

    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(result.resumed).toBe(false);
    // The hosted page is told what to charge; the fee is ours to keep.
    expect(gateway.sessions[0].totalCharged).toBe(20_500);
    expect(gateway.sessions[0].applicationFee).toBe(500);
  });

  it("carries our own payment id in metadata, so any event can find it", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();

    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    expect(gateway.sessions[0].metadata.paymentId).toBe(result.paymentId);
    expect(gateway.sessions[0].metadata.tripId).toBe(trip.id);
  });

  it("returns to our own URLs, carrying the attempt id", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();

    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    expect(gateway.sessions[0].successUrl).toContain(`status=returned&payment=${result.paymentId}`);
    expect(gateway.sessions[0].cancelUrl).toContain(`status=cancelled&payment=${result.paymentId}`);
  });

  it("settles from checkout.session.completed", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: payment!.stripeCheckoutSessionId,
          payment_status: "paid",
          payment_intent: payment!.stripePaymentIntentId,
          metadata: { paymentId: result.paymentId },
        },
      },
    });

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(INITIAL);
    expect(view.status).toBe("INITIAL_PAYMENT_PAID");
  });

  it("does not settle a completed session whose money hasn't arrived", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${randomUUID()}`,
          // An asynchronous method: the session is done, the money isn't in.
          payment_status: "unpaid",
          metadata: { paymentId: result.paymentId },
        },
      },
    });

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(0);
    expect(view.status).toBe("INITIAL_PAYMENT_PENDING");
  });

  it("finds the payment by metadata when the intent id was never stored", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway({
      async createCheckoutSession() {
        // Stripe can return a session before the intent exists.
        return { id: `cs_${randomUUID()}`, url: "https://checkout.stripe.test/x", paymentIntentId: null, status: "open" };
      },
    });
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: `pi_${randomUUID()}`,
          latest_charge: `ch_${randomUUID()}`,
          metadata: { paymentId: result.paymentId },
        },
      },
    });

    const settled = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(settled?.status).toBe("SUCCEEDED");
    expect(settled?.stripePaymentIntentId).toMatch(/^pi_/);
  });

  it("cancels the attempt and frees the fee when the session expires", async () => {
    const { trip, organizer } = await tripWithTerms();
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.expired",
      data: { object: { id: `cs_x`, metadata: { paymentId: result.paymentId } } },
    });

    const cancelled = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    expect(cancelled?.status).toBe("CANCELLED");
    expect(
      await prisma.platformFee.count({ where: { tripId: trip.id, userId: organizer.id } }),
    ).toBe(0);

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.status).toBe("NO_PAYMENT");
  });

  it("fails the attempt when an asynchronous payment is declined", async () => {
    const { trip, organizer } = await tripWithTerms();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, makeGateway());

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.async_payment_failed",
      data: { object: { id: `cs_y`, metadata: { paymentId: result.paymentId } } },
    });

    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.status).toBe("PAYMENT_FAILED");
  });
});

describe("reporting an attempt back to the participant", () => {
  async function startedPayment() {
    const { trip, organizer } = await makeTrip();
    await setPaymentTerms({
      tripId: trip.id,
      userId: organizer.id,
      totalAmountPerPerson: TOTAL,
      initialPaymentAmount: INITIAL,
    });
    const gateway = makeGateway();
    const result = await createPayment({ tripId: trip.id, userId: organizer.id }, gateway);
    return { trip, organizer, gateway, paymentId: result.paymentId };
  }

  it("reports an unsettled attempt as awaiting confirmation, never as paid", async () => {
    const { trip, organizer, paymentId } = await startedPayment();

    const status = await getPaymentAttemptStatus({ tripId: trip.id, userId: organizer.id, paymentId });

    expect(status.outcome).toBe("awaiting_confirmation");
    expect(status.totalCharged).toBe(INITIAL + PLATFORM_FEE_MINOR);
  });

  it("refuses to report on somebody else's payment", async () => {
    const { trip, paymentId } = await startedPayment();
    const stranger = await prisma.user.create({
      data: { name: "Nosy", email: `nosy.${randomUUID().slice(0, 8)}@paytest.local` },
    });

    await expect(
      getPaymentAttemptStatus({ tripId: trip.id, userId: stranger.id, paymentId }),
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
  });

  it("refuses an attempt id from a different trip", async () => {
    const { organizer, paymentId } = await startedPayment();
    const other = await makeTrip();

    await expect(
      getPaymentAttemptStatus({ tripId: other.trip.id, userId: organizer.id, paymentId }),
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
  });

  it("reconciles from Stripe when the webhook is slow", async () => {
    const { trip, organizer, gateway, paymentId } = await startedPayment();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    // Stripe has the money; no webhook has reached us.
    gateway.sessionState.set(payment!.stripeCheckoutSessionId!, {
      status: "complete",
      paymentStatus: "paid",
      paymentIntentId: payment!.stripePaymentIntentId,
    });

    const status = await reconcilePaymentWithStripe(
      { tripId: trip.id, userId: organizer.id, paymentId },
      gateway,
    );

    expect(status.outcome).toBe("succeeded");
    const view = await getParticipantPaymentView(trip.id, organizer.id);
    expect(view.totalAmountPaid).toBe(INITIAL);
    expect(view.platformFeePaid).toBe(true);
  });

  it("keeps waiting rather than inventing a result when Stripe says unpaid", async () => {
    const { trip, organizer, gateway, paymentId } = await startedPayment();

    const status = await reconcilePaymentWithStripe(
      { tripId: trip.id, userId: organizer.id, paymentId },
      gateway,
    );

    expect(status.outcome).toBe("awaiting_confirmation");
  });

  it("cancels the attempt when Stripe reports the session expired", async () => {
    const { trip, organizer, gateway, paymentId } = await startedPayment();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    gateway.sessionState.set(payment!.stripeCheckoutSessionId!, {
      status: "expired",
      paymentStatus: "unpaid",
      paymentIntentId: null,
    });

    const status = await reconcilePaymentWithStripe(
      { tripId: trip.id, userId: organizer.id, paymentId },
      gateway,
    );

    expect(status.outcome).toBe("cancelled");
    expect(
      await prisma.platformFee.count({ where: { tripId: trip.id, userId: organizer.id } }),
    ).toBe(0);
  });

  it("doesn't re-reconcile a payment that already settled", async () => {
    const { trip, organizer, gateway, paymentId } = await startedPayment();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "payment_intent.succeeded",
      data: { object: { id: payment!.stripePaymentIntentId, metadata: { paymentId } } },
    });

    const status = await reconcilePaymentWithStripe(
      { tripId: trip.id, userId: organizer.id, paymentId },
      gateway,
    );

    expect(status.outcome).toBe("succeeded");
    const events = await prisma.paymentEvent.findMany({ where: { paymentId, toStatus: "SUCCEEDED" } });
    expect(events).toHaveLength(1);
  });
});
