-- Destinations now live in code (src/lib/matching/destinations.ts), seeded
-- for the Group Match engine, rather than in this database. Drop the
-- now-unused Destination table and repoint the two columns that referenced
-- it to plain strings holding the seeded dataset's ids.

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_lockedDestinationId_fkey";

-- DropForeignKey
ALTER TABLE "DestinationSuggestion" DROP CONSTRAINT "DestinationSuggestion_destinationId_fkey";

-- DropTable
DROP TABLE "Destination";

-- AlterTable
ALTER TABLE "DestinationSuggestion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "DestinationSuggestion_tripId_destinationId_key" ON "DestinationSuggestion"("tripId", "destinationId");
