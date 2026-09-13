import { NextResponse } from "next/server";

import { isStripeConfigured } from "@/lib/env";
import { GatewayError } from "@/lib/payments/gateway";
import { stripeGateway } from "@/lib/payments/stripeGateway";
import { processStripeEvent } from "@/lib/payments/webhook";

/**
 * Stripe's webhook endpoint — the only thing in this application that is
 * allowed to decide a payment succeeded.
 *
 * The body is read raw and verified before it is parsed: an unsigned or
 * badly-signed request is rejected without ever being treated as an event.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripeGateway.constructWebhookEvent(rawBody, signature);
  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    throw error;
  }

  try {
    const outcome = await processStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("Failed to process Stripe event", event.id, error);
    // A 500 tells Stripe to retry, which is what we want: the event id is
    // already recorded, so the retry will find the failure and re-apply.
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
