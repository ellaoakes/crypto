-- Payments are collected through Stripe's hosted Checkout, so a payment is
-- now identified by its Checkout Session until Stripe produces the intent.
ALTER TABLE "Payment" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "checkoutUrl" TEXT;
CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");
