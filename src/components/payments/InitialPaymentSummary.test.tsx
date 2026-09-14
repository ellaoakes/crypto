import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The pay button imports the server actions, which reach for next-auth and a
// request context neither of which exist here. The tests below are about what
// the screens render, so the actions are stubbed out.
vi.mock("@/app/(app)/trips/[tripId]/payments/actions", () => ({
  startPaymentAction: vi.fn(),
  checkPaymentAction: vi.fn(),
  cancelPaymentAction: vi.fn(),
}));

// useRouter needs an app router mounted, which jsdom has no notion of.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { InitialPaymentComplete } from "@/components/payments/InitialPaymentComplete";
import { InitialPaymentSummary } from "@/components/payments/InitialPaymentSummary";

const base = {
  tripId: "trip-1",
  destinationName: "Marbella",
  dates: { start: "2027-05-14", end: "2027-05-17" },
  currency: "GBP",
  totalTripAmount: 120_000,
  requiredInitialPayment: 20_000,
  platformFee: 500,
  paymentsAvailable: true,
};

describe("InitialPaymentSummary", () => {
  it("shows the trip, the total, the initial payment and the fee", () => {
    render(<InitialPaymentSummary {...base} />);

    expect(screen.getByText("Your trip")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marbella" })).toBeInTheDocument();
    expect(screen.getByText("14–17 May 2027")).toBeInTheDocument();
    expect(screen.getByText("Total trip cost")).toBeInTheDocument();
    expect(screen.getByText("£1,200.00")).toBeInTheDocument();
    expect(screen.getByText("Initial payment required")).toBeInTheDocument();
    expect(screen.getByText("One-time platform fee")).toBeInTheDocument();
  });

  it("adds the fee to the initial payment for the total due today", () => {
    render(<InitialPaymentSummary {...base} />);

    expect(screen.getByText("Total today")).toBeInTheDocument();
    expect(screen.getByText("£205.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay £205\.00/ })).toBeInTheDocument();
  });

  it("offers no way at all to change the initial amount", () => {
    render(<InitialPaymentSummary {...base} />);

    // No inputs, no amount options: everyone pays the same, and the only
    // control is the button that pays exactly it.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("drops the fee from the total when it was already charged", () => {
    render(<InitialPaymentSummary {...base} platformFee={0} />);

    expect(screen.getByText("One-time platform fee (already paid)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay £200\.00/ })).toBeInTheDocument();
  });

  it("says so plainly when payments aren't switched on", () => {
    render(<InitialPaymentSummary {...base} paymentsAvailable={false} />);

    expect(screen.getByText(/aren't switched on for this trip/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells the participant their card details don't reach us", () => {
    render(<InitialPaymentSummary {...base} />);

    expect(screen.getByText(/handled by Stripe/)).toBeInTheDocument();
  });
});

describe("InitialPaymentComplete", () => {
  const complete = {
    tripId: "trip-1",
    currency: "GBP",
    paidTowardsTrip: 20_000,
    platformFeePaid: true,
    platformFeeAmount: 500,
    remainingBalance: 100_000,
    paymentsAvailable: true,
  };

  it("confirms the initial payment and the fee separately", () => {
    render(<InitialPaymentComplete {...complete} />);

    expect(screen.getByText(/Initial payment complete/)).toBeInTheDocument();
    expect(screen.getByText("£200.00 paid towards your trip")).toBeInTheDocument();
    expect(screen.getByText(/£5\.00 platform fee paid/)).toBeInTheDocument();
  });

  it("shows the remaining balance with the fee excluded from it", () => {
    render(<InitialPaymentComplete {...complete} />);

    expect(screen.getByText("Remaining trip balance")).toBeInTheDocument();
    // £1,200 less the £200 trip payment. The £5 fee doesn't touch this.
    expect(screen.getByText("£1,000.00")).toBeInTheDocument();
  });

  it("invites optional further payments", () => {
    render(<InitialPaymentComplete {...complete} />);

    expect(
      screen.getByText("You can make additional payments whenever you choose."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make a payment" })).toBeInTheDocument();
  });

  it("celebrates instead of asking for more once the balance is clear", () => {
    render(<InitialPaymentComplete {...complete} remainingBalance={0} />);

    expect(screen.getByText(/all paid up/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Make a payment" })).not.toBeInTheDocument();
  });
});
