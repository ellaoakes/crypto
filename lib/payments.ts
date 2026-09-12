/**
 * Payment provider abstraction.
 *
 * The business plan is explicit that this must eventually run on UK open
 * banking payment initiation (TrueLayer / GoCardless / Yapily) rather than
 * cards, for the margin, and through a regulated partner's virtual
 * accounts rather than the business holding money itself, for the
 * regulatory reasons it sets out. Wiring up a real provider needs a
 * business account, API credentials, and specialist legal advice before a
 * single real payment — none of which this app can supply on its own.
 *
 * So this ships with a MockPaymentProvider that simulates the "confirm
 * payment" step of an open banking flow (the participant is shown exactly
 * what they're being asked to pay, then confirms) without moving real
 * money. Swap `getPaymentProvider()` for a real implementation of this
 * same interface once a provider and legal review are in place.
 */
export interface PaymentProvider {
  /** Human-readable name shown in the UI so the mock is never mistaken for the real thing. */
  name: string;
  /** Simulates confirming payment of the given amount. Always succeeds. */
  confirmPayment(input: { reference: string; totalPence: number }): Promise<{ success: true; confirmedAt: Date }>;
}

class MockPaymentProvider implements PaymentProvider {
  name = "Mock payment (test mode — no real money moves)";

  async confirmPayment(input: { reference: string; totalPence: number }) {
    // A real integration would redirect to the bank's own app/website here
    // and wait for a webhook. There is nothing to await in the mock.
    void input;
    return { success: true as const, confirmedAt: new Date() };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new MockPaymentProvider();
  }
  return provider;
}

export const PROCESSING_FEE_PENCE = 500; // £5 flat fee, per participant, per trip
