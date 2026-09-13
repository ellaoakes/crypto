import "server-only";

import Stripe from "stripe";

import { env, isStripeConfigured } from "@/lib/env";
import {
  GatewayError,
  type CreateIntentArgs,
  type CreateRefundArgs,
  type CreatedIntent,
  type CreatedRefund,
  type PaymentGateway,
  type WebhookEventShape,
} from "@/lib/payments/gateway";

/**
 * The Stripe-backed gateway. `server-only` above is a build-time guarantee
 * that this module — and therefore the secret key — can never be pulled into
 * a client bundle.
 *
 * Charges are **destination charges**: one PaymentIntent whose full amount
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
  async createPaymentIntent(args: CreateIntentArgs): Promise<CreatedIntent> {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: args.totalCharged,
      currency: args.currency.toLowerCase(),
      // No saved cards, no off-session reuse: every payment after the first
      // is initiated by the participant. This is not a subscription.
      automatic_payment_methods: { enabled: true },
      setup_future_usage: undefined,
      metadata: args.metadata,
    };

    if (args.destinationAccountId) {
      // Destination charge: the money moves through to the settlement account
      // in the same operation, and `on_behalf_of` makes that account the
      // settlement merchant rather than leaving the funds resting with us.
      params.transfer_data = { destination: args.destinationAccountId };
      params.on_behalf_of = args.destinationAccountId;
      if (args.applicationFee > 0) {
        params.application_fee_amount = args.applicationFee;
      }
    }

    try {
      const intent = await stripe().paymentIntents.create(params, {
        idempotencyKey: args.idempotencyKey,
      });
      return { id: intent.id, clientSecret: intent.client_secret, status: intent.status };
    } catch (error) {
      throw toGatewayError(error, "Couldn't start that payment.");
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
