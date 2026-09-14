import { describe, expect, it } from "vitest";

import { planNotifications, type PaymentEvent, type PaymentEventContext } from "@/lib/notifications/events";

const NOW = new Date("2027-01-15T10:00:00Z");

const context: PaymentEventContext = {
  tripId: "trip-1",
  tripName: "Marbella",
  currency: "GBP",
  participant: { userId: "u-sophie", name: "Sophie" },
  organizerUserId: "u-ella",
};

/** The same event, but the participant is the organizer. */
const asOrganizer: PaymentEventContext = {
  ...context,
  participant: { userId: "u-ella", name: "Ella" },
};

describe("initial payment completed", () => {
  const event: PaymentEvent = {
    ...context,
    type: "INITIAL_PAYMENT_COMPLETED",
    amount: 20_000,
    remainingBalance: 100_000,
  };

  it("sends the payer a receipt with what's left", () => {
    const [receipt] = planNotifications(event, NOW);

    expect(receipt.userId).toBe("u-sophie");
    expect(receipt.category).toBe("PAYMENT_RECEIPT");
    expect(receipt.title).toBe("Initial payment complete");
    expect(receipt.body).toContain("£200");
    expect(receipt.body).toContain("£1,000 left to pay");
    expect(receipt.href).toBe("/trips/trip-1/pay");
  });

  it("tells the organizer, because deposits are what they chase", () => {
    const organizerNote = planNotifications(event, NOW).find((n) => n.userId === "u-ella");

    expect(organizerNote?.category).toBe("TRIP_PAYMENT_ACTIVITY");
    expect(organizerNote?.title).toBe("Sophie paid their initial payment");
    expect(organizerNote?.href).toBe("/trips/trip-1");
  });

  it("doesn't tell the organizer about their own payment twice", () => {
    const planned = planNotifications({ ...event, ...asOrganizer }, NOW);

    expect(planned).toHaveLength(1);
    expect(planned[0].category).toBe("PAYMENT_RECEIPT");
  });

  it("keys each recipient separately so neither blocks the other", () => {
    const keys = planNotifications(event, NOW).map((n) => n.dedupeKey);

    expect(new Set(keys).size).toBe(2);
  });
});

describe("additional payment completed", () => {
  const event: PaymentEvent = {
    ...context,
    type: "ADDITIONAL_PAYMENT_COMPLETED",
    amount: 30_000,
    remainingBalance: 70_000,
  };

  it("is a receipt for the payer and nothing else", () => {
    const planned = planNotifications(event, NOW);

    // Six people topping up would bury an organizer in notifications they
    // never act on.
    expect(planned).toHaveLength(1);
    expect(planned[0].userId).toBe("u-sophie");
    expect(planned[0].category).toBe("PAYMENT_RECEIPT");
    expect(planned[0].body).toContain("£300");
  });

  it("lets two different top-ups on the same day both be told", () => {
    const first = planNotifications(event, NOW)[0];
    const second = planNotifications({ ...event, amount: 10_000 }, NOW)[0];

    expect(first.dedupeKey).not.toBe(second.dedupeKey);
  });

  it("collapses a replayed event for the same amount and day", () => {
    const first = planNotifications(event, NOW)[0];
    const replay = planNotifications(event, new Date("2027-01-15T23:00:00Z"))[0];

    expect(first.dedupeKey).toBe(replay.dedupeKey);
  });
});

describe("trip balance fully paid", () => {
  const event: PaymentEvent = {
    ...context,
    type: "TRIP_BALANCE_FULLY_PAID",
    totalPaid: 120_000,
  };

  it("congratulates the payer", () => {
    const [receipt] = planNotifications(event, NOW);

    expect(receipt.title).toContain("all paid up");
    expect(receipt.body).toContain("£1,200");
  });

  it("tells the organizer somebody is settled", () => {
    const organizerNote = planNotifications(event, NOW).find((n) => n.userId === "u-ella");

    expect(organizerNote?.title).toBe("Sophie has paid in full");
  });

  it("doesn't double up when the organizer finishes paying", () => {
    expect(planNotifications({ ...event, ...asOrganizer }, NOW)).toHaveLength(1);
  });
});

describe("payment failed", () => {
  const event: PaymentEvent = {
    ...context,
    type: "PAYMENT_FAILED",
    amount: 20_500,
    reason: "Your card was declined.",
  };

  it("tells the payer and nobody else", () => {
    const planned = planNotifications(event, NOW);

    // A declined card is between them and their bank.
    expect(planned).toHaveLength(1);
    expect(planned[0].userId).toBe("u-sophie");
    expect(planned[0].category).toBe("PAYMENT_PROBLEM");
  });

  it("says what went wrong and that nothing was charged", () => {
    const [problem] = planNotifications(event, NOW);

    expect(problem.body).toContain("Your card was declined.");
    expect(problem.body).toContain("Nothing was charged");
  });

  it("copes with no reason given", () => {
    const [problem] = planNotifications({ ...event, reason: undefined }, NOW);

    expect(problem.body).toContain("failed.");
  });
});

describe("initial payment outstanding", () => {
  const event: PaymentEvent = {
    ...context,
    type: "INITIAL_PAYMENT_OUTSTANDING",
    amountDue: 20_000,
    nudgedByOrganizer: false,
  };

  it("asks the participant for the amount that secures their place", () => {
    const [reminder] = planNotifications(event, NOW);

    expect(reminder.category).toBe("PAYMENT_REMINDER");
    expect(reminder.body).toContain("£200");
    expect(reminder.body).toContain("secure your place");
  });

  it("reads differently when an organizer sent it", () => {
    const [nudge] = planNotifications({ ...event, nudgedByOrganizer: true }, NOW);

    expect(nudge.title).toBe("A reminder about Marbella");
  });

  it("is one per person per day, however many times it's triggered", () => {
    const morning = planNotifications(event, new Date("2027-01-15T08:00:00Z"))[0];
    const evening = planNotifications(event, new Date("2027-01-15T20:00:00Z"))[0];
    const tomorrow = planNotifications(event, new Date("2027-01-16T08:00:00Z"))[0];

    expect(morning.dedupeKey).toBe(evening.dedupeKey);
    expect(morning.dedupeKey).not.toBe(tomorrow.dedupeKey);
  });

  it("never notifies the organizer that someone hasn't paid", () => {
    // They can see that on the dashboard; a notification adds nothing.
    expect(planNotifications(event, NOW)).toHaveLength(1);
  });
});

describe("deadline approaching and passed", () => {
  const deadline = new Date("2027-03-01T00:00:00Z");

  it("names the date and the amount", () => {
    const [reminder] = planNotifications(
      { ...context, type: "PAYMENT_DEADLINE_APPROACHING", amountDue: 20_000, deadline, scope: "INITIAL" },
      NOW,
    );

    expect(reminder.title).toBe("Your initial payment is due soon");
    expect(reminder.body).toContain("£200");
    expect(reminder.body).toContain("1 March 2027");
  });

  it("distinguishes the balance from the initial payment", () => {
    const [balance] = planNotifications(
      { ...context, type: "PAYMENT_DEADLINE_APPROACHING", amountDue: 100_000, deadline, scope: "BALANCE" },
      NOW,
    );

    expect(balance.title).toBe("Your trip balance is due soon");
  });

  it("escalates once the deadline has gone", () => {
    const [overdue] = planNotifications(
      { ...context, type: "PAYMENT_DEADLINE_PASSED", amountDue: 20_000, deadline, scope: "INITIAL" },
      NOW,
    );

    expect(overdue.title).toBe("Your initial payment is overdue");
    expect(overdue.body).toContain("was due on 1 March 2027");
  });

  it("is keyed on the deadline, so an hourly scan notifies once", () => {
    const args = {
      ...context,
      type: "PAYMENT_DEADLINE_APPROACHING" as const,
      amountDue: 20_000,
      deadline,
      scope: "INITIAL" as const,
    };

    const first = planNotifications(args, new Date("2027-02-25T01:00:00Z"))[0];
    const later = planNotifications(args, new Date("2027-02-26T13:00:00Z"))[0];
    expect(first.dedupeKey).toBe(later.dedupeKey);

    // But moving the deadline is genuinely new news.
    const moved = planNotifications(
      { ...args, deadline: new Date("2027-04-01T00:00:00Z") },
      NOW,
    )[0];
    expect(moved.dedupeKey).not.toBe(first.dedupeKey);
  });

  it("keeps the two scopes apart", () => {
    const initial = planNotifications(
      { ...context, type: "PAYMENT_DEADLINE_APPROACHING", amountDue: 20_000, deadline, scope: "INITIAL" },
      NOW,
    )[0];
    const balance = planNotifications(
      { ...context, type: "PAYMENT_DEADLINE_APPROACHING", amountDue: 20_000, deadline, scope: "BALANCE" },
      NOW,
    )[0];

    expect(initial.dedupeKey).not.toBe(balance.dedupeKey);
  });
});

describe("every event", () => {
  const all: PaymentEvent[] = [
    { ...context, type: "INITIAL_PAYMENT_COMPLETED", amount: 20_000, remainingBalance: 100_000 },
    { ...context, type: "INITIAL_PAYMENT_OUTSTANDING", amountDue: 20_000, nudgedByOrganizer: false },
    { ...context, type: "PAYMENT_DEADLINE_APPROACHING", amountDue: 20_000, deadline: NOW, scope: "INITIAL" },
    { ...context, type: "PAYMENT_DEADLINE_PASSED", amountDue: 20_000, deadline: NOW, scope: "INITIAL" },
    { ...context, type: "ADDITIONAL_PAYMENT_COMPLETED", amount: 10_000, remainingBalance: 90_000 },
    { ...context, type: "TRIP_BALANCE_FULLY_PAID", totalPaid: 120_000 },
    { ...context, type: "PAYMENT_FAILED", amount: 20_000 },
  ];

  it("covers all seven", () => {
    expect(new Set(all.map((event) => event.type)).size).toBe(7);
  });

  it("produces something for each, with the fields a channel needs", () => {
    for (const event of all) {
      const planned = planNotifications(event, NOW);
      expect(planned.length).toBeGreaterThan(0);

      for (const notification of planned) {
        expect(notification.userId).toBeTruthy();
        expect(notification.title).toBeTruthy();
        expect(notification.body).toBeTruthy();
        expect(notification.href).toMatch(/^\/trips\//);
        expect(notification.dedupeKey).toContain(event.type);
        expect(notification.tripId).toBe("trip-1");
      }
    }
  });

  it("never plans a notification twice for the same person in one event", () => {
    for (const event of all) {
      const recipients = planNotifications(event, NOW).map((n) => n.userId);
      expect(new Set(recipients).size).toBe(recipients.length);
    }
  });
});
