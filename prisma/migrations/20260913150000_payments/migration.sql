-- Payment ledger. See PAYMENTS.md for the architecture.
-- Every money column is an integer in the currency's minor unit.

CREATE TYPE "SettlementMode" AS ENUM ('UNCONFIGURED', 'CONNECTED_ACCOUNT', 'PLATFORM_BALANCE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "ParticipantPaymentStatus" AS ENUM (
  'NO_PAYMENT', 'INITIAL_PAYMENT_PENDING', 'INITIAL_PAYMENT_PAID', 'PARTIALLY_PAID',
  'FULLY_PAID', 'PAYMENT_FAILED', 'PAYMENT_OVERDUE', 'REFUND_PENDING',
  'PARTIALLY_REFUNDED', 'REFUNDED'
);
CREATE TYPE "PaymentKind" AS ENUM ('INITIAL', 'ADDITIONAL');
CREATE TYPE "PlatformFeeStatus" AS ENUM ('PENDING', 'CHARGED', 'REFUNDED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "Trip"
  ADD COLUMN "totalAmountPerPerson" INTEGER,
  ADD COLUMN "initialPaymentAmount" INTEGER,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN "paymentDeadline" TIMESTAMP(3),
  ADD COLUMN "finalPaymentDeadline" TIMESTAMP(3),
  ADD COLUMN "settlementMode" "SettlementMode" NOT NULL DEFAULT 'UNCONFIGURED',
  ADD COLUMN "settlementAccountId" TEXT;

ALTER TABLE "TripParticipant"
  ADD COLUMN "requiredInitialPayment" INTEGER,
  ADD COLUMN "totalTripAmount" INTEGER,
  ADD COLUMN "initialPaymentPaid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totalAmountPaid" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remainingBalance" INTEGER,
  ADD COLUMN "platformFeePaid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paymentStatus" "ParticipantPaymentStatus" NOT NULL DEFAULT 'NO_PAYMENT';

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "platformFee" INTEGER NOT NULL DEFAULT 0,
  "totalCharged" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "kind" "PaymentKind" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "stripePaymentIntentId" TEXT,
  "stripeChargeId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_tripId_userId_idx" ON "Payment"("tripId", "userId");
CREATE INDEX "Payment_participantId_idx" ON "Payment"("participantId");

CREATE TABLE "PlatformFee" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" "PlatformFeeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformFee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformFee_paymentId_key" ON "PlatformFee"("paymentId");
-- The guarantee that our fee is charged at most once per participant per trip.
CREATE UNIQUE INDEX "PlatformFee_tripId_userId_key" ON "PlatformFee"("tripId", "userId");

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "tripAmount" INTEGER NOT NULL,
  "platformFeeAmount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "stripeRefundId" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "fromStatus" "PaymentStatus",
  "toStatus" "PaymentStatus" NOT NULL,
  "stripeEventId" TEXT,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TripParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformFee" ADD CONSTRAINT "PlatformFee_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformFee" ADD CONSTRAINT "PlatformFee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformFee" ADD CONSTRAINT "PlatformFee_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
