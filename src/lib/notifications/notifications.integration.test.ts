// @vitest-environment node
/**
 * The notification pipeline against the real database.
 *
 * The properties that matter here — an event notifies someone at most once, a
 * preference is honoured before a transport is touched, and an organizer's
 * reminder cannot change what anyone owes — are enforced by constraints and
 * by what the code is allowed to write, so they're tested against the real
 * thing rather than a mock.
 */
import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { NotificationTransport } from "@/lib/notifications/channels";
import { dispatchPaymentEvent, countUnread, getNotifications, markAllRead } from "@/lib/notifications/dispatch";
import type { PaymentEvent, PaymentEventContext } from "@/lib/notifications/events";
import { remindOutstandingInitialPayments } from "@/lib/notifications/organizerReminders";
import { scanTripForReminders } from "@/lib/notifications/scan";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { createPayment, setPaymentTerms } from "@/lib/payments/service";
import { processStripeEvent } from "@/lib/payments/webhook";

const TOTAL = 120_000;
const INITIAL = 20_000;
const NOW = new Date("2027-01-15T10:00:00Z");

const gateway: PaymentGateway = {
  async createCheckoutSession() {
    const id = `cs_${randomUUID()}`;
    return { id, url: `https://checkout.test/${id}`, paymentIntentId: `pi_${randomUUID()}`, status: "open" };
  },
  async retrieveCheckoutSession(id) {
    return { id, status: "open", paymentStatus: "unpaid", paymentIntentId: null };
  },
  async expireCheckoutSession() {},
  async cancelPaymentIntent() {},
  async createRefund() { return { id: `re_${randomUUID()}`, status: "pending" }; },
  constructWebhookEvent() { throw new Error("not used"); },
};

async function makeTrip({ participants = 3, deadlines = {} as { paymentDeadline?: Date; finalPaymentDeadline?: Date } } = {}) {
  const stamp = randomUUID().slice(0, 8);
  const users = [];
  for (let index = 0; index < participants; index++) {
    users.push(
      await prisma.user.create({
        data: { name: `Person ${index}`, email: `notif.${stamp}.${index}@notiftest.local` },
      }),
    );
  }

  const trip = await prisma.trip.create({
    data: {
      name: `Notify ${stamp}`,
      status: "CONFIRMED",
      organizerId: users[0].id,
      settlementMode: "CONNECTED_ACCOUNT",
      settlementAccountId: "acct_test",
      confirmedDestinationId: "marbella-spain",
      confirmedDateStart: new Date("2027-05-14"),
      confirmedDateEnd: new Date("2027-05-17"),
      confirmedAt: new Date(),
      participants: {
        create: users.map((user) => ({ userId: user.id, status: "SUBMITTED" as const, joinedAt: new Date() })),
      },
    },
  });

  await setPaymentTerms({
    tripId: trip.id,
    userId: users[0].id,
    totalAmountPerPerson: TOTAL,
    initialPaymentAmount: INITIAL,
    ...deadlines,
    now: new Date("2027-01-01"),
  });

  return { trip, organizer: users[0], users };
}

async function payAndSettle(tripId: string, userId: string, amount?: number) {
  const result = await createPayment({ tripId, userId, requestedAmount: amount }, gateway);
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
  return result;
}

function contextFor(tripId: string, userId: string, organizerUserId: string): PaymentEventContext {
  return {
    tripId,
    tripName: "Marbella",
    currency: "GBP",
    participant: { userId, name: "Sophie" },
    organizerUserId,
  };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@notiftest.local" } } });
  await prisma.$disconnect();
});

describe("dispatching an event", () => {
  it("stores a notification and records an attempt on every channel", async () => {
    const { trip, organizer, users } = await makeTrip();
    const event: PaymentEvent = {
      ...contextFor(trip.id, users[1].id, organizer.id),
      type: "INITIAL_PAYMENT_COMPLETED",
      amount: INITIAL,
      remainingBalance: 100_000,
    };

    const result = await dispatchPaymentEvent(event, NOW);

    expect(result.created).toBe(2); // payer and organizer
    const notifications = await prisma.notification.findMany({
      where: { tripId: trip.id },
      include: { deliveries: true },
    });
    expect(notifications).toHaveLength(2);
    for (const notification of notifications) {
      // Every channel is accounted for, even the ones that sent nothing.
      expect(notification.deliveries.map((d) => d.channel).sort()).toEqual(["EMAIL", "IN_APP", "PUSH"]);
    }
  });

  it("delivers in-app and reports email and push as unavailable", async () => {
    const { trip, organizer, users } = await makeTrip();
    await dispatchPaymentEvent(
      {
        ...contextFor(trip.id, users[1].id, organizer.id),
        type: "PAYMENT_FAILED",
        amount: INITIAL,
      },
      NOW,
    );

    const notification = await prisma.notification.findFirst({
      where: { userId: users[1].id },
      include: { deliveries: true },
    });
    const byChannel = Object.fromEntries(
      notification!.deliveries.map((d) => [d.channel, d.status]),
    );

    expect(byChannel.IN_APP).toBe("SENT");
    // Preference says yes, but no provider exists — recorded, not pretended.
    expect(byChannel.EMAIL).toBe("UNAVAILABLE");
    expect(byChannel.PUSH).toBe("SKIPPED"); // push is off by default
  });

  it("notifies at most once however many times an event is replayed", async () => {
    const { trip, organizer, users } = await makeTrip();
    const event: PaymentEvent = {
      ...contextFor(trip.id, users[1].id, organizer.id),
      type: "INITIAL_PAYMENT_COMPLETED",
      amount: INITIAL,
      remainingBalance: 100_000,
    };

    const first = await dispatchPaymentEvent(event, NOW);
    const second = await dispatchPaymentEvent(event, NOW);
    const third = await dispatchPaymentEvent(event, NOW);

    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    expect(second.duplicates).toBe(2);
    expect(third.duplicates).toBe(2);
    expect(await prisma.notification.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it("honours a preference before touching a transport", async () => {
    const { trip, organizer, users } = await makeTrip();
    await prisma.notificationPreference.create({
      data: { userId: users[1].id, category: "PAYMENT_RECEIPT", channel: "IN_APP", enabled: false },
    });

    let attempted = false;
    const watchful: NotificationTransport = {
      channel: "IN_APP",
      isAvailable: () => true,
      async send() {
        attempted = true;
        return { status: "SENT" };
      },
    };

    await dispatchPaymentEvent(
      {
        ...contextFor(trip.id, users[1].id, organizer.id),
        type: "ADDITIONAL_PAYMENT_COMPLETED",
        amount: 10_000,
        remainingBalance: 90_000,
      },
      NOW,
      [watchful],
    );

    expect(attempted).toBe(false);
    const delivery = await prisma.notificationDelivery.findFirst({
      where: { notification: { userId: users[1].id }, channel: "IN_APP" },
    });
    expect(delivery?.status).toBe("SKIPPED");
    expect(delivery?.detail).toContain("Turned off");
  });

  it("records a transport that throws as failed, without losing the notification", async () => {
    const { trip, organizer, users } = await makeTrip();
    const broken: NotificationTransport = {
      channel: "IN_APP",
      isAvailable: () => true,
      async send() {
        throw new Error("transport exploded");
      },
    };

    await dispatchPaymentEvent(
      { ...contextFor(trip.id, users[1].id, organizer.id), type: "PAYMENT_FAILED", amount: 100 },
      NOW,
      [broken],
    );

    const delivery = await prisma.notificationDelivery.findFirst({
      where: { notification: { userId: users[1].id }, channel: "IN_APP" },
    });
    expect(delivery?.status).toBe("FAILED");
    expect(delivery?.detail).toBe("transport exploded");
    // The decision to tell them survives the transport failing.
    expect(await prisma.notification.count({ where: { userId: users[1].id } })).toBe(1);
  });
});

describe("events emitted by the payment domain", () => {
  it("notifies the payer and the organizer when a deposit settles", async () => {
    const { trip, organizer, users } = await makeTrip();

    await payAndSettle(trip.id, users[1].id);

    const payerNote = await prisma.notification.findFirst({ where: { userId: users[1].id } });
    expect(payerNote?.type).toBe("INITIAL_PAYMENT_COMPLETED");
    expect(payerNote?.category).toBe("PAYMENT_RECEIPT");

    const organizerNote = await prisma.notification.findFirst({ where: { userId: organizer.id } });
    expect(organizerNote?.category).toBe("TRIP_PAYMENT_ACTIVITY");
  });

  it("sends a receipt only for a voluntary top-up", async () => {
    const { trip, organizer, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);
    await prisma.notification.deleteMany({ where: { tripId: trip.id } });

    await payAndSettle(trip.id, users[1].id, 10_000);

    expect(await prisma.notification.count({ where: { userId: users[1].id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: organizer.id } })).toBe(0);
  });

  it("announces a trip paid off in full instead of another receipt", async () => {
    const { trip, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);
    await payAndSettle(trip.id, users[1].id, 100_000);

    const latest = await prisma.notification.findFirst({
      where: { userId: users[1].id },
      orderBy: { createdAt: "desc" },
    });
    expect(latest?.type).toBe("TRIP_BALANCE_FULLY_PAID");
  });

  it("tells the payer when a payment fails, and nobody else", async () => {
    const { trip, organizer, users } = await makeTrip();
    const result = await createPayment({ tripId: trip.id, userId: users[1].id }, gateway);
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });

    await processStripeEvent({
      id: `evt_${randomUUID()}`,
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: payment!.stripePaymentIntentId,
          last_payment_error: { code: "card_declined", message: "Your card was declined." },
          metadata: { paymentId: result.paymentId },
        },
      },
    });

    const note = await prisma.notification.findFirst({ where: { userId: users[1].id } });
    expect(note?.type).toBe("PAYMENT_FAILED");
    expect(note?.body).toContain("Your card was declined.");
    expect(await prisma.notification.count({ where: { userId: organizer.id } })).toBe(0);
  });

  it("never lets a notification failure break a payment", async () => {
    const { trip, users } = await makeTrip();
    // A participant removed between settling and notifying: the emitter finds
    // no context and gives up quietly rather than throwing into the webhook.
    const result = await createPayment({ tripId: trip.id, userId: users[1].id }, gateway);
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    await prisma.tripParticipant.delete({
      where: { tripId_userId: { tripId: trip.id, userId: users[1].id } },
    });

    const outcome = await processStripeEvent({
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

    expect(outcome).toBe("applied");
  });
});

describe("the deadline scan", () => {
  it("reminds people whose deposit deadline is close", async () => {
    const { trip, users } = await makeTrip({
      deadlines: { paymentDeadline: new Date("2027-01-20T00:00:00Z") },
    });

    const emitted = await scanTripForReminders(trip.id, NOW);

    expect(emitted).toBe(3); // nobody has paid
    const note = await prisma.notification.findFirst({ where: { userId: users[1].id } });
    expect(note?.type).toBe("PAYMENT_DEADLINE_APPROACHING");
  });

  it("leaves alone anyone who has already paid their deposit", async () => {
    const { trip, users } = await makeTrip({
      deadlines: { paymentDeadline: new Date("2027-01-20T00:00:00Z") },
    });
    await payAndSettle(trip.id, users[1].id);
    await prisma.notification.deleteMany({ where: { tripId: trip.id } });

    await scanTripForReminders(trip.id, NOW);

    expect(
      await prisma.notification.count({
        where: { userId: users[1].id, type: "PAYMENT_DEADLINE_APPROACHING" },
      }),
    ).toBe(0);
  });

  it("escalates to overdue once the deadline has gone", async () => {
    const { trip, users } = await makeTrip({
      deadlines: { paymentDeadline: new Date("2027-01-10T00:00:00Z") },
    });

    await scanTripForReminders(trip.id, NOW);

    const note = await prisma.notification.findFirst({ where: { userId: users[1].id } });
    expect(note?.type).toBe("PAYMENT_DEADLINE_PASSED");
  });

  it("is safe to run repeatedly", async () => {
    const { trip } = await makeTrip({
      deadlines: { paymentDeadline: new Date("2027-01-20T00:00:00Z") },
    });

    const first = await scanTripForReminders(trip.id, NOW);
    const second = await scanTripForReminders(trip.id, new Date("2027-01-15T18:00:00Z"));
    const third = await scanTripForReminders(trip.id, new Date("2027-01-16T09:00:00Z"));

    expect(first).toBe(3);
    expect(second).toBe(0);
    expect(third).toBe(0); // keyed on the deadline, not the day it ran
  });

  it("says nothing about a trip with no deadlines", async () => {
    const { trip } = await makeTrip();

    expect(await scanTripForReminders(trip.id, NOW)).toBe(0);
  });
});

describe("the organizer's reminder", () => {
  it("nudges only the people who haven't made their initial payment", async () => {
    const { trip, organizer, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);
    await prisma.notification.deleteMany({ where: { tripId: trip.id } });

    const outcome = await remindOutstandingInitialPayments({
      tripId: trip.id,
      organizerId: organizer.id,
      now: NOW,
    });

    // The organizer hasn't paid either, so they and users[2] get nudged.
    expect(outcome.reminded.map((person) => person.userId).sort()).toEqual(
      [organizer.id, users[2].id].sort(),
    );
    expect(
      await prisma.notification.count({
        where: { userId: users[1].id, type: "INITIAL_PAYMENT_OUTSTANDING" },
      }),
    ).toBe(0);
  });

  it("cannot be used to change what anyone owes", async () => {
    const { trip, organizer, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);

    const before = {
      payments: await prisma.payment.findMany({ where: { tripId: trip.id }, orderBy: { id: "asc" } }),
      fees: await prisma.platformFee.findMany({ where: { tripId: trip.id }, orderBy: { id: "asc" } }),
      participants: await prisma.tripParticipant.findMany({
        where: { tripId: trip.id },
        orderBy: { id: "asc" },
      }),
      trip: await prisma.trip.findUnique({ where: { id: trip.id } }),
    };

    await remindOutstandingInitialPayments({ tripId: trip.id, organizerId: organizer.id, now: NOW });

    const after = {
      payments: await prisma.payment.findMany({ where: { tripId: trip.id }, orderBy: { id: "asc" } }),
      fees: await prisma.platformFee.findMany({ where: { tripId: trip.id }, orderBy: { id: "asc" } }),
      participants: await prisma.tripParticipant.findMany({
        where: { tripId: trip.id },
        orderBy: { id: "asc" },
      }),
      trip: await prisma.trip.findUnique({ where: { id: trip.id } }),
    };

    // Byte-for-byte: no balance moved, no deadline shifted, nobody marked paid.
    expect(after).toEqual(before);
  });

  it("refuses anyone who isn't the organizer", async () => {
    const { trip, users } = await makeTrip();

    await expect(
      remindOutstandingInitialPayments({ tripId: trip.id, organizerId: users[1].id, now: NOW }),
    ).rejects.toMatchObject({ code: "NOT_ORGANIZER" });
    expect(await prisma.notification.count({ where: { tripId: trip.id } })).toBe(0);
  });

  it("won't nudge the same person twice in a day", async () => {
    const { trip, organizer } = await makeTrip();

    const first = await remindOutstandingInitialPayments({
      tripId: trip.id,
      organizerId: organizer.id,
      now: NOW,
    });
    const second = await remindOutstandingInitialPayments({
      tripId: trip.id,
      organizerId: organizer.id,
      now: new Date("2027-01-15T14:00:00Z"),
    });

    expect(first.reminded).toHaveLength(3);
    expect(second.reminded).toHaveLength(0);
    expect(second.skippedRecentlyReminded).toHaveLength(3);
  });

  it("lets the organizer try again the next day", async () => {
    const { trip, organizer } = await makeTrip();
    await remindOutstandingInitialPayments({ tripId: trip.id, organizerId: organizer.id, now: NOW });

    const tomorrow = await remindOutstandingInitialPayments({
      tripId: trip.id,
      organizerId: organizer.id,
      now: new Date("2027-01-16T11:00:00Z"),
    });

    expect(tomorrow.reminded).toHaveLength(3);
  });

  it("says plainly when everyone has paid", async () => {
    const { trip, organizer, users } = await makeTrip({ participants: 2 });
    await payAndSettle(trip.id, organizer.id);
    await payAndSettle(trip.id, users[1].id);

    const outcome = await remindOutstandingInitialPayments({
      tripId: trip.id,
      organizerId: organizer.id,
      now: NOW,
    });

    expect(outcome.nobodyOutstanding).toBe(true);
    expect(outcome.reminded).toHaveLength(0);
  });
});

describe("reading notifications", () => {
  it("shows a user their own, newest first, and nobody else's", async () => {
    const { trip, organizer, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);

    const theirs = await getNotifications(users[1].id);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((notification) => notification.userId === users[1].id)).toBe(true);

    const organizerNotifications = await getNotifications(organizer.id);
    expect(organizerNotifications.every((n) => n.userId === organizer.id)).toBe(true);
  });

  it("counts and clears unread, scoped to the one user", async () => {
    const { trip, organizer, users } = await makeTrip();
    await payAndSettle(trip.id, users[1].id);

    expect(await countUnread(users[1].id)).toBe(1);
    expect(await countUnread(organizer.id)).toBe(1);

    await markAllRead(users[1].id);

    expect(await countUnread(users[1].id)).toBe(0);
    // Marking one person's read leaves everyone else's alone.
    expect(await countUnread(organizer.id)).toBe(1);
  });
});
