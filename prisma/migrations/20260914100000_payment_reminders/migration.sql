-- Records a reminder that has been sent, so it is never sent twice for the
-- same deadline. Nothing writes here yet: reminders are prepared, not
-- implemented. The table exists because idempotency is the part a sender
-- can't retrofit safely.
CREATE TABLE "PaymentReminder" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT,
  CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentReminder_participantId_reason_dueAt_key"
  ON "PaymentReminder"("participantId", "reason", "dueAt");
CREATE INDEX "PaymentReminder_participantId_idx" ON "PaymentReminder"("participantId");
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "TripParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
