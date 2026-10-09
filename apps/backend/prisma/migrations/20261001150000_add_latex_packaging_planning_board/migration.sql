CREATE TABLE "PackagingPlanningCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "dispenser" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PackagingPlanningCard_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PackagingPlanningCard_dispenser_check" CHECK ("dispenser" IN ('A', 'B')),
    CONSTRAINT "PackagingPlanningCard_position_check" CHECK ("position" BETWEEN 0 AND 3)
);

CREATE UNIQUE INDEX "PackagingPlanningCard_plantId_tankId_key"
ON "PackagingPlanningCard"("plantId", "tankId");

CREATE INDEX "PackagingPlanningCard_plantId_dispenser_position_idx"
ON "PackagingPlanningCard"("plantId", "dispenser", "position");

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_plantId_fkey"
FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_tankId_fkey"
FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
