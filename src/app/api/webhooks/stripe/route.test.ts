// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const constructWebhookEvent = vi.fn();
const processStripeEvent = vi.fn();
let stripeConfigured = true;

vi.mock("@/lib/env", () => ({
  get isStripeConfigured() {
    return stripeConfigured;
  },
  env: {},
}));
vi.mock("@/lib/payments/stripeGateway", () => ({
  stripeGateway: { constructWebhookEvent: (...args: unknown[]) => constructWebhookEvent(...args) },
}));
vi.mock("@/lib/payments/webhook", () => ({
  processStripeEvent: (...args: unknown[]) => processStripeEvent(...args),
}));

const { GatewayError } = await import("@/lib/payments/gateway");
const { POST } = await import("@/app/api/webhooks/stripe/route");

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeConfigured = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a request with no signature before reading it as an event", async () => {
    const response = await POST(request("{}"));

    expect(response.status).toBe(400);
    expect(constructWebhookEvent).not.toHaveBeenCalled();
    expect(processStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects a bad signature without processing anything", async () => {
    constructWebhookEvent.mockImplementation(() => {
      throw new GatewayError("INVALID_SIGNATURE", "Invalid webhook signature.");
    });

    const response = await POST(request("{}", { "stripe-signature": "t=1,v1=forged" }));

    expect(response.status).toBe(400);
    expect(processStripeEvent).not.toHaveBeenCalled();
  });

  it("verifies against the raw body, not a re-serialised one", async () => {
    const raw = '{"id":"evt_1","type":"payment_intent.succeeded","spacing":  "preserved"}';
    constructWebhookEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.succeeded", data: { object: {} } });
    processStripeEvent.mockResolvedValue("applied");

    await POST(request(raw, { "stripe-signature": "t=1,v1=good" }));

    expect(constructWebhookEvent).toHaveBeenCalledWith(raw, "t=1,v1=good");
  });

  it("processes a verified event and reports the outcome", async () => {
    constructWebhookEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.succeeded", data: { object: {} } });
    processStripeEvent.mockResolvedValue("applied");

    const response = await POST(request("{}", { "stripe-signature": "t=1,v1=good" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, outcome: "applied" });
  });

  it("reports a duplicate delivery as handled rather than failing", async () => {
    constructWebhookEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.succeeded", data: { object: {} } });
    processStripeEvent.mockResolvedValue("duplicate");

    const response = await POST(request("{}", { "stripe-signature": "t=1,v1=good" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, outcome: "duplicate" });
  });

  it("asks Stripe to retry when processing throws", async () => {
    constructWebhookEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.succeeded", data: { object: {} } });
    processStripeEvent.mockRejectedValue(new Error("database is down"));

    const response = await POST(request("{}", { "stripe-signature": "t=1,v1=good" }));

    expect(response.status).toBe(500);
  });

  it("says so plainly when payments aren't configured", async () => {
    stripeConfigured = false;

    const response = await POST(request("{}", { "stripe-signature": "t=1,v1=good" }));

    expect(response.status).toBe(503);
    expect(constructWebhookEvent).not.toHaveBeenCalled();
  });
});
