-- Voting moves from "an independent like per destination" to "one changeable
-- vote per participant for the whole trip". Collapse any participant who has
-- more than one vote down to their most recent one before the new unique
-- constraint is applied.
DELETE FROM "Vote" v
USING "Vote" newer
WHERE v."participantId" = newer."participantId"
  AND (v."createdAt" < newer."createdAt"
       OR (v."createdAt" = newer."createdAt" AND v."id" < newer."id"));

-- DropIndex
DROP INDEX "Vote_suggestionId_participantId_key";

-- AlterTable
ALTER TABLE "Vote" DROP COLUMN "value";
ALTER TABLE "Vote" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Vote_participantId_key" ON "Vote"("participantId");

-- CreateIndex
CREATE INDEX "Vote_suggestionId_idx" ON "Vote"("suggestionId");

-- DropEnum
DROP TYPE "VoteValue";
