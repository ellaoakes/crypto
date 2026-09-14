import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YourPaymentSummary } from "@/components/payments/YourPaymentSummary";
import type { ParticipantPaymentRow } from "@/lib/payments/summary";

const you: ParticipantPaymentRow = {
  participantId: "p1",
  userId: "u1",
  name: "Sophie",
  isOrganizer: false,
  totalTripAmount: 120_000,
  requiredInitialPayment: 20_000,
  totalAmountPaid: 40_000,
  remainingBalance: 80_000,
  initialPaymentPaid: true,
  status: "PARTIALLY_PAID",
};

function renderSummary(overrides: Partial<ParticipantPaymentRow> = {}, props = {}) {
  return render(
    <YourPaymentSummary
      tripId="trip-1"
      currency="GBP"
      you={{ ...you, ...overrides }}
      paymentDeadline={null}
      finalPaymentDeadline={null}
      groupProgress={{ initialCompleteCount: 4, participantCount: 6 }}
      paymentsAvailable
      {...props}
    />,
  );
}

describe("YourPaymentSummary", () => {
  it("shows the brief's figures", () => {
    renderSummary();

    expect(screen.getByText("Your trip")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("£1,200")).toBeInTheDocument();
    expect(screen.getByText("Initial payment")).toBeInTheDocument();
    expect(screen.getByText("£200")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("£400")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("£800")).toBeInTheDocument();
  });

  it("confirms the initial payment and offers another", () => {
    renderSummary();

    expect(screen.getByText(/Initial payment complete/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make another payment" })).toBeInTheDocument();
  });

  it("shows a pending initial payment and asks for it by amount", () => {
    renderSummary({
      totalAmountPaid: 0,
      remainingBalance: 120_000,
      initialPaymentPaid: false,
      status: "NO_PAYMENT",
    });

    expect(screen.getByText(/Initial payment pending/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay £200 initial payment" })).toBeInTheDocument();
  });

  it("celebrates rather than asking for more once the balance is clear", () => {
    renderSummary({ totalAmountPaid: 120_000, remainingBalance: 0, status: "FULLY_PAID" });

    expect(screen.getByText(/all paid up/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the group's progress as a count and nothing more", () => {
    const { container } = renderSummary();

    expect(
      screen.getByText("4 of 6 on this trip have made their initial payment."),
    ).toBeInTheDocument();
    // No other participant is named, and no other figure is shown.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Ella|Charlotte|Millie|Amy|Lucy/);
  });

  it("shows deadlines when the trip has them", () => {
    renderSummary(
      { totalAmountPaid: 0, remainingBalance: 120_000, initialPaymentPaid: false },
      {
        paymentDeadline: new Date("2027-03-01T00:00:00Z"),
        finalPaymentDeadline: new Date("2027-04-01T00:00:00Z"),
      },
    );

    expect(screen.getByText("Initial payment due")).toBeInTheDocument();
    expect(screen.getByText(/1 March 2027/)).toBeInTheDocument();
    expect(screen.getByText("Balance due")).toBeInTheDocument();
    expect(screen.getByText(/1 April 2027/)).toBeInTheDocument();
  });

  it("says payments aren't available rather than offering a dead button", () => {
    renderSummary({}, { paymentsAvailable: false });

    expect(screen.getByText(/aren't switched on for this trip/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
