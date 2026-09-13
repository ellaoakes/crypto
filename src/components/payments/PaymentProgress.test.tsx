import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaymentProgress } from "@/components/payments/PaymentProgress";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";

describe("PaymentProgress", () => {
  it("shows paid against total in the trip's currency", () => {
    render(<PaymentProgress totalAmountPaid={30_000} totalTripAmount={120_000} currency="GBP" />);

    expect(screen.getByText("£300 paid")).toBeInTheDocument();
    expect(screen.getByText("of £1,200")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("handles nothing paid", () => {
    render(<PaymentProgress totalAmountPaid={0} totalTripAmount={120_000} currency="GBP" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("never exceeds 100%", () => {
    render(<PaymentProgress totalAmountPaid={130_000} totalTripAmount={120_000} currency="GBP" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("doesn't divide by zero before the organizer sets a cost", () => {
    render(<PaymentProgress totalAmountPaid={0} totalTripAmount={0} currency="GBP" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("PaymentStatusBadge", () => {
  it("puts each state into plain words", () => {
    const { rerender } = render(<PaymentStatusBadge status="INITIAL_PAYMENT_PAID" />);
    expect(screen.getByText("Deposit paid")).toBeInTheDocument();

    rerender(<PaymentStatusBadge status="PAYMENT_OVERDUE" />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();

    rerender(<PaymentStatusBadge status="FULLY_PAID" />);
    expect(screen.getByText("Paid in full")).toBeInTheDocument();
  });

  it("falls back to the raw state rather than rendering nothing", () => {
    render(<PaymentStatusBadge status="SOMETHING_NEW" />);

    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument();
  });
});
