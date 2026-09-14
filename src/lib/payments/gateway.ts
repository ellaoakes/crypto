/**
 * The narrow slice of Stripe this app uses.
 *
 * Everything that talks to Stripe goes through this interface, so the
 * service layer can be tested without network access or API keys, and so
 * the set of Stripe operations we depend on stays small and visible.
 */

export interface CreateCheckoutArgs {
  /** What the card is charged: trip money plus any platform fee. */
  totalCharged: number;
  /** Our cut of that charge. Zero on every payment after the first. */
  applicationFee: number;
  currency: string;
  /** Deterministic, so a retried request can't create a second charge. */
  idempotencyKey: string;
  /**
   * Where the trip money settles. Undefined means the trip is configured to
   * leave funds in the platform balance — an explicit choice, never a default.
   */
  destinationAccountId?: string;
  /** What the participant sees on Stripe's page. */
  lineItemName: string;
  lineItemDescription?: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}

export interface CreatedCheckout {
  /** Checkout Session id (cs_...). */
  id: string;
  /** Stripe's hosted payment page. The participant is sent here. */
  url: string | null;
  /** Present once Stripe has created the underlying intent. */
  paymentIntentId: string | null;
  status: string;
}

export interface CreateRefundArgs {
  paymentIntentId: string;
  /** Trip money to return. */
  amount: number;
  /** Whether our platform fee comes back too. Always an explicit decision. */
  refundPlatformFee: boolean;
  idempotencyKey: string;
  reason?: string;
}

export interface CreatedRefund {
  id: string;
  status: string;
}

export interface WebhookEventShape {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface PaymentGateway {
  /**
   * Opens a Stripe-hosted Checkout Session. Card details are collected on
   * Stripe's own page and never reach this application.
   */
  createCheckoutSession(args: CreateCheckoutArgs): Promise<CreatedCheckout>;
  /** Reads a session back, to resolve a payment's true state on return. */
  retrieveCheckoutSession(sessionId: string): Promise<{
    id: string;
    status: string;
    paymentStatus: string;
    paymentIntentId: string | null;
  }>;
  expireCheckoutSession(sessionId: string): Promise<void>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;
  createRefund(args: CreateRefundArgs): Promise<CreatedRefund>;
  /**
   * Verifies Stripe's signature over the raw body and returns the event.
   * Throws if the signature doesn't check out — an unverified body is never
   * parsed as an event.
   */
  constructWebhookEvent(rawBody: string, signature: string): WebhookEventShape;
}

export class GatewayError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
  }
}
