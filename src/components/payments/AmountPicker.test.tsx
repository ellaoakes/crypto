import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const startPaymentAction = vi.fn();
vi.mock("@/app/(app)/trips/[tripId]/payments/actions", () => ({
  startPaymentAction: (...args: unknown[]) => startPaymentAction(...args),
  checkPaymentAction: vi.fn(),
  cancelPaymentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { AmountPicker } = await import("@/components/payments/AmountPicker");

describe("AmountPicker", () => {
  it("shows the remaining balance and the preset amounts", () => {
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    expect(screen.getByText("Remaining balance")).toBeInTheDocument();
    expect(screen.getByText("£1,000.00")).toBeInTheDocument();
    expect(screen.getByText("How much would you like to pay?")).toBeInTheDocument();
    for (const label of ["£50", "£100", "£200", "£500"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Custom amount" })).toBeInTheDocument();
  });

  it("breaks a chosen amount into trip money and a zero fee", async () => {
    const user = userEvent.setup();
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    await user.click(screen.getByRole("button", { name: "£200" }));

    expect(screen.getByText("Trip payment")).toBeInTheDocument();
    expect(screen.getByText("Platform fee")).toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay £200\.00/ })).toBeInTheDocument();
  });

  it("won't let anything be paid until an amount is chosen", () => {
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    expect(screen.getByRole("button", { name: "Choose an amount" })).toBeDisabled();
  });

  it("never offers a preset larger than what's left to pay", () => {
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={12_000} />);

    expect(screen.getByRole("button", { name: "£50" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "£100" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "£200" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "£500" })).not.toBeInTheDocument();
  });

  it("always offers to clear the balance exactly", async () => {
    const user = userEvent.setup();
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={12_000} />);

    await user.click(screen.getByRole("button", { name: /Pay it off \(£120\)/ }));

    expect(screen.getByRole("button", { name: /^Pay £120\.00$/ })).toBeEnabled();
  });

  it("refuses a custom amount over the balance", async () => {
    const user = userEvent.setup();
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    await user.click(screen.getByRole("button", { name: "Custom amount" }));
    await user.type(screen.getByLabelText("Custom amount"), "1500");

    expect(screen.getByText(/more than your remaining balance/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose an amount" })).toBeDisabled();
  });

  it("refuses a custom amount that isn't a number", async () => {
    const user = userEvent.setup();
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    await user.click(screen.getByRole("button", { name: "Custom amount" }));
    await user.type(screen.getByLabelText("Custom amount"), "abc");

    expect(screen.getByRole("button", { name: "Choose an amount" })).toBeDisabled();
  });

  it("accepts a valid custom amount", async () => {
    const user = userEvent.setup();
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    await user.click(screen.getByRole("button", { name: "Custom amount" }));
    await user.type(screen.getByLabelText("Custom amount"), "250.50");

    expect(screen.getByRole("button", { name: /Pay £250\.50/ })).toBeEnabled();
  });

  it("sends the amount to the server rather than a computed fee or total", async () => {
    const user = userEvent.setup();
    startPaymentAction.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.test/x" });
    render(<AmountPicker tripId="trip-1" currency="GBP" remainingBalance={100_000} />);

    await user.click(screen.getByRole("button", { name: "£200" }));
    await user.click(screen.getByRole("button", { name: /Pay £200\.00/ }));

    // Only the trip amount travels. The fee is the server's to decide.
    expect(startPaymentAction).toHaveBeenCalledWith("trip-1", "200");
  });
});
