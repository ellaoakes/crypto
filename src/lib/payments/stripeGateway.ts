import "server-only";

import Stripe from "stripe";

import { env, isStripeConfigured } from "@/lib/env";
import {
  GatewayError,
  type CreateCheckoutArgs,
  type CreateRefundArgs,
  type CreatedCheckout,
  type CreatedRefund,
  type PaymentGateway,
  type WebhookEventShape,
} from "@/lib/payments/gateway";

/**
 * The Stripe-backed gateway. `server-only` above is a build-time guarantee
 * that this module — and therefore the secret key — can never be pulled into
 * a client bundle.
 *
 * Card details are collected by **Stripe Checkout**, Stripe's own hosted
 * payment page, so they never touch this application — the participant is
 * redirected to Stripe and comes back with nothing but a session id.
 *
 * Underneath, each session creates a **destination charge**: the full amount
 * moves to the trip's settlement account, with `application_fee_amount`
 * pulled back to us. See PAYMENTS.md for why this shape over direct charges
 * or separate charges and transfers.
 */

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!isStripeConfigured || !env.STRIPE_SECRET_KEY) {
    throw new GatewayError(
      "STRIPE_NOT_CONFIGURED",
      "Payments aren't set up on this environment yet.",
    );
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}

export const stripeGateway: PaymentGateway = {
  async createCheckoutSession(args: CreateCheckoutArgs): Promise<CreatedCheckout> {
    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      // Copied onto the PaymentIntent so every downstream webhook can resolve
      // our own payment row without depending on ids we may not have stored yet.
      metadata: args.metadata,
    };

    if (args.destinationAccountId) {
      // Destination charge: the money moves through to the settlement account
      // in the same operation, and `on_behalf_of` makes that account the
      // settlement merchant rather than leaving the funds resting with us.
      paymentIntentData.transfer_data = { destination: args.destinationAccountId };
      paymentIntentData.on_behalf_of = args.destinationAccountId;
      if (args.applicationFee > 0) {
        paymentIntentData.application_fee_amount = args.applicationFee;
      }
    }

    try {
      const session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          // One payment, initiated by the participant. Not a subscription:
          // nothing here saves a card or sets up a future off-session charge.
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: args.currency.toLowerCase(),
                unit_amount: args.totalCharged,
                product_data: {
                  name: args.lineItemName,
                  description: args.lineItemDescription,
                },
              },
            },
          ],
          payment_intent_data: paymentIntentData,
          success_url: args.successUrl,
          cancel_url: args.cancelUrl,
          customer_email: args.customerEmail,
          metadata: args.metadata,
        },
        { idempotencyKey: args.idempotencyKey },
      );

      return {
        id: session.id,
        url: session.url,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        status: session.status ?? "open",
      };
    } catch (error) {
      throw toGatewayError(error, "Couldn't start that payment.");
    }
  },

  async retrieveCheckoutSession(sessionId: string) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      return {
        id: session.id,
        status: session.status ?? "open",
        paymentStatus: session.payment_status ?? "unpaid",
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      };
    } catch (error) {
      throw toGatewayError(error, "Couldn't read that payment back.");
    }
  },

  async expireCheckoutSession(sessionId: string): Promise<void> {
    try {
      await stripe().checkout.sessions.expire(sessionId);
    } catch (error) {
      throw toGatewayError(error, "Couldn't cancel that payment.");
    }
  },

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      await stripe().paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      throw toGatewayError(error, "Couldn't cancel that payment.");
    }
  },

  async createRefund(args: CreateRefundArgs): Promise<CreatedRefund> {
    try {
      const refund = await stripe().refunds.create(
        {
          payment_intent: args.paymentIntentId,
          amount: args.amount,
          // Reverse the transfer so the trip money comes back out of the
          // settlement account, and only give our fee back when we've
          // decided to. These are separate knobs on purpose.
          reverse_transfer: true,
          refund_application_fee: args.refundPlatformFee,
          metadata: args.reason ? { reason: args.reason } : undefined,
        },
        { idempotencyKey: args.idempotencyKey },
      );
      return { id: refund.id, status: refund.status ?? "pending" };
    } catch (error) {
      throw toGatewayError(error, "Couldn't refund that payment.");
    }
  },

  constructWebhookEvent(rawBody: string, signature: string): WebhookEventShape {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new GatewayError("STRIPE_NOT_CONFIGURED", "No webhook secret configured.");
    }
    try {
      const event = stripe().webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
      return event as unknown as WebhookEventShape;
    } catch {
      // Deliberately opaque: a caller who failed signature verification
      // learns only that it failed.
      throw new GatewayError("INVALID_SIGNATURE", "Invalid webhook signature.");
    }
  },
};

function toGatewayError(error: unknown, fallback: string): GatewayError {
  if (error instanceof GatewayError) return error;
  if (error instanceof Stripe.errors.StripeError) {
    return new GatewayError(error.code ?? error.type ?? "STRIPE_ERROR", error.message);
  }
  return new GatewayError("STRIPE_ERROR", fallback);
}
