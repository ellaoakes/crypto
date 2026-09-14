import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const checkPaymentAction = vi.fn();
vi.mock("@/app/(app)/trips/[tripId]/payments/actions", () => ({
  checkPaymentAction: (...args: unknown[]) => checkPaymentAction(...args),
  startPaymentAction: vi.fn(),
  cancelPaymentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { PaymentOutcomePanel } = await import("@/components/payments/PaymentOutcomePanel");

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    paymentId: "pay-1",
    outcome: "awaiting_confirmation" as const,
    amount: 20_000,
    platformFee: 500,
    totalCharged: 20_500,
    currency: "GBP",
    kind: "INITIAL",
    failureMessage: null,
    checkoutUrl: null,
    ...overrides,
  };
}

describe("PaymentOutcomePanel", () => {
  it("never claims success just because Stripe sent them back", () => {
    checkPaymentAction.mockResolvedValue({ status: attempt() });
    render(<PaymentOutcomePanel tripId="trip-1" initialStatus={attempt()} returnKind="returned" />);

    expect(screen.getByText("Confirming your payment…")).toBeInTheDocument();
    expect(screen.queryByText(/Payment confirmed/)).not.toBeInTheDocument();
    expect(screen.getByText(/only mark this paid once it's confirmed/)).toBeInTheDocument();
  });

  it("confirms only once the server says the payment succeeded", () => {
    render(
      <PaymentOutcomePanel
        tripId="trip-1"
        initialStatus={attempt({ outcome: "succeeded" })}
        returnKind="returned"
      />,
    );

    expect(screen.getByText(/Payment confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/£200\.00 towards your trip/)).toBeInTheDocument();
    expect(screen.getByText(/Charged: £205\.00/)).toBeInTheDocument();
  });

  it("reports a failure with the reason and nothing charged", () => {
    render(
      <PaymentOutcomePanel
        tripId="trip-1"
        initialStatus={attempt({ outcome: "failed", failureMessage: "Your card was declined." })}
        returnKind="returned"
      />,
    );

    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.getByText("Your card was declined.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports a cancellation as nothing charged", () => {
    render(<PaymentOutcomePanel tripId="trip-1" initialStatus={attempt()} returnKind="cancelled" />);

    expect(screen.getByText("Payment cancelled")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
  });

  it("still shows success if the webhook beat them back from a cancel URL", () => {
    render(
      <PaymentOutcomePanel
        tripId="trip-1"
        initialStatus={attempt({ outcome: "succeeded" })}
        returnKind="cancelled"
      />,
    );

    expect(screen.getByText(/Payment confirmed/)).toBeInTheDocument();
  });

  it("polls the server while the payment is unconfirmed", async () => {
    checkPaymentAction.mockResolvedValue({ status: attempt() });
    render(<PaymentOutcomePanel tripId="trip-1" initialStatus={attempt()} returnKind="returned" />);

    await waitFor(() => expect(checkPaymentAction).toHaveBeenCalled(), { timeout: 4000 });
    expect(checkPaymentAction).toHaveBeenCalledWith("trip-1", "pay-1", false);
  });

  it("switches to a confirmed state when a poll comes back succeeded", async () => {
    checkPaymentAction.mockResolvedValue({ status: attempt({ outcome: "succeeded" }) });
    render(<PaymentOutcomePanel tripId="trip-1" initialStatus={attempt()} returnKind="returned" />);

    await waitFor(() => expect(screen.getByText(/Payment confirmed/)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it("does not poll a payment that already settled", () => {
    render(
      <PaymentOutcomePanel
        tripId="trip-1"
        initialStatus={attempt({ outcome: "succeeded" })}
        returnKind="returned"
      />,
    );

    expect(checkPaymentAction).not.toHaveBeenCalled();
  });

  it("announces the waiting state to assistive technology", () => {
    checkPaymentAction.mockResolvedValue({ status: attempt() });
    const { container } = render(
      <PaymentOutcomePanel tripId="trip-1" initialStatus={attempt()} returnKind="returned" />,
    );

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
