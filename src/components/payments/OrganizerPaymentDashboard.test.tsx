import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizerPaymentDashboard } from "@/components/payments/OrganizerPaymentDashboard";
import { summariseTripPayments, type ParticipantPaymentRow } from "@/lib/payments/summary";

const TOTAL = 120_000;
const INITIAL = 20_000;

function row(name: string, paid: number, extra: Partial<ParticipantPaymentRow> = {}): ParticipantPaymentRow {
  return {
    participantId: `p-${name}`,
    userId: `u-${name}`,
    name,
    isOrganizer: false,
    totalTripAmount: TOTAL,
    requiredInitialPayment: INITIAL,
    totalAmountPaid: paid,
    remainingBalance: TOTAL - paid,
    initialPaymentPaid: paid >= INITIAL,
    status: paid >= INITIAL ? "INITIAL_PAYMENT_PAID" : "NO_PAYMENT",
    ...extra,
  };
}

// The brief's worked example.
const participants = [
  row("Ella", 20_000, { isOrganizer: true }),
  row("Sophie", 40_000, { status: "PARTIALLY_PAID" }),
  row("Charlotte", 20_000),
  row("Millie", 20_000),
  row("Amy", 0),
  row("Lucy", 0),
];

function renderDashboard(rows = participants) {
  return render(
    <OrganizerPaymentDashboard
      currency="GBP"
      totals={summariseTripPayments(rows)}
      participants={rows}
      paymentDeadline={null}
      finalPaymentDeadline={null}
    />,
  );
}

describe("OrganizerPaymentDashboard", () => {
  it("shows the trip's headline figures", () => {
    renderDashboard();

    expect(screen.getByText("Trip payments")).toBeInTheDocument();
    expect(screen.getByText("Total trip cost")).toBeInTheDocument();
    expect(screen.getByText("£7,200")).toBeInTheDocument();
    expect(screen.getByText("Required initial payments")).toBeInTheDocument();
    expect(screen.getByText("Initial payments collected")).toBeInTheDocument();
    expect(screen.getByText("£800")).toBeInTheDocument();
  });

  it("says how many have completed their initial payment", () => {
    renderDashboard();

    expect(
      screen.getByText("4 of 6 participants have completed their initial payment."),
    ).toBeInTheDocument();
  });

  it("shows deposit progress as a proportion of what's required", () => {
    renderDashboard();

    // £800 collected of £1,200 required.
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
  });

  it("lists every participant with their status and their paid-of-total", () => {
    renderDashboard();

    for (const name of ["Ella", "Sophie", "Charlotte", "Millie", "Amy", "Lucy"]) {
      expect(screen.getByText(new RegExp(name))).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Initial payment complete/)).toHaveLength(4);
    expect(screen.getAllByText(/Initial payment pending/)).toHaveLength(2);
    expect(screen.getAllByText("£200 / £1,200")).toHaveLength(3);
    expect(screen.getByText("£400 / £1,200")).toBeInTheDocument();
    expect(screen.getAllByText("£0 / £1,200")).toHaveLength(2);
  });

  it("marks the organizer", () => {
    renderDashboard();

    expect(screen.getByText(/Organizer/)).toBeInTheDocument();
  });

  it("flags how many people are overdue", () => {
    renderDashboard([
      row("Amy", 0, { status: "PAYMENT_OVERDUE" }),
      row("Lucy", 0, { status: "PAYMENT_OVERDUE" }),
      row("Ella", 20_000),
    ]);

    expect(screen.getByText("2 people are overdue.")).toBeInTheDocument();
  });

  it("says nothing about overdue payments when nobody is", () => {
    renderDashboard();

    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  it("shows no payment history, dates or fees for anyone", () => {
    const { container } = renderDashboard();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/platform fee/i);
    expect(text).not.toMatch(/history/i);
    expect(text).not.toMatch(/£5\.00/);
  });

  it("handles a trip where nobody has paid yet", () => {
    renderDashboard([row("Amy", 0), row("Lucy", 0)]);

    expect(
      screen.getByText("0 of 2 participants have completed their initial payment."),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
