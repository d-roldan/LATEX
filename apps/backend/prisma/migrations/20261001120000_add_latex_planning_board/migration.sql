CREATE TABLE "PlanningCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "manufacturingOrder" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlanningCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanningCard_plantId_tankId_position_idx"
ON "PlanningCard"("plantId", "tankId", "position");

CREATE INDEX "PlanningCard_companyId_manufacturingOrder_idx"
ON "PlanningCard"("companyId", "manufacturingOrder");

ALTER TABLE "PlanningCard"
ADD CONSTRAINT "PlanningCard_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCard"
ADD CONSTRAINT "PlanningCard_plantId_fkey"
FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanningCard"
ADD CONSTRAINT "PlanningCard_tankId_fkey"
FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanningCard"
ADD CONSTRAINT "PlanningCard_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
