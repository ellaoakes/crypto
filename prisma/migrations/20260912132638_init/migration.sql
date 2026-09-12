-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "adminToken" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organiserName" TEXT NOT NULL,
    "responseDeadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'collecting_responses',
    "processingFeePence" INTEGER NOT NULL DEFAULT 500,
    "depositAmountPence" INTEGER,
    "chosenOptionIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOrganiser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "unavailableDates" TEXT NOT NULL,
    "budgetPence" INTEGER NOT NULL,
    "destinationPreference" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suggestion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "contributionPence" INTEGER NOT NULL,
    "feePence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "participantId" TEXT,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_slug_key" ON "Trip"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_adminToken_key" ON "Trip"("adminToken");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_token_key" ON "Participant"("token");

-- CreateIndex
CREATE INDEX "Participant_tripId_idx" ON "Participant"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_participantId_key" ON "Response"("participantId");

-- CreateIndex
CREATE INDEX "Suggestion_tripId_idx" ON "Suggestion"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_participantId_key" ON "Payment"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Notification_tripId_idx" ON "Notification"("tripId");
