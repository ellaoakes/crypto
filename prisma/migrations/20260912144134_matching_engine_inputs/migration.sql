-- AlterTable
ALTER TABLE "Preference" ADD COLUMN     "departureCity" TEXT NOT NULL DEFAULT 'London',
ADD COLUMN     "excludedDestinationIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "maxBudgetPerPerson" INTEGER,
ADD COLUMN     "maxFlightTimeHours" DOUBLE PRECISION,
ADD COLUMN     "preferredClimate" TEXT NOT NULL DEFAULT 'any';

-- CreateTable
CREATE TABLE "BlackoutWindow" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackoutWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackoutWindow_participantId_idx" ON "BlackoutWindow"("participantId");

-- AddForeignKey
ALTER TABLE "BlackoutWindow" ADD CONSTRAINT "BlackoutWindow_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TripParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
