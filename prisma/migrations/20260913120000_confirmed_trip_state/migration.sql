-- Renames the "locked" trip state to "confirmed" — the product concept is a
-- confirmed trip, and locking is just the action that gets it there — and
-- snapshots the agreed cost and attendee list alongside the dates so the
-- confirmed trip dashboard never has to recompute (or invent) them.

-- Postgres can't drop a value from an enum in use, so the enum is rebuilt.
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'COLLECTING', 'RECOMMENDING', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trip"
  ALTER COLUMN "status" TYPE "TripStatus"
  USING (CASE WHEN "status"::text = 'LOCKED' THEN 'CONFIRMED' ELSE "status"::text END)::"TripStatus";
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "TripStatus_old";

ALTER TABLE "Trip" RENAME COLUMN "lockedDestinationId" TO "confirmedDestinationId";
ALTER TABLE "Trip" RENAME COLUMN "lockedDateStart" TO "confirmedDateStart";
ALTER TABLE "Trip" RENAME COLUMN "lockedDateEnd" TO "confirmedDateEnd";
ALTER TABLE "Trip" RENAME COLUMN "lockedAt" TO "confirmedAt";

ALTER TABLE "Trip" ADD COLUMN "confirmedCostMin" INTEGER;
ALTER TABLE "Trip" ADD COLUMN "confirmedCostMax" INTEGER;
ALTER TABLE "Trip" ADD COLUMN "confirmedAttendingUserIds" JSONB NOT NULL DEFAULT '[]';
