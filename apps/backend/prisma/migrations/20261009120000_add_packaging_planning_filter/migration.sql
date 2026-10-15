ALTER TABLE "PackagingPlanningCard"
ADD COLUMN "filter" TEXT;

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_filter_check"
CHECK (
  "filter" IS NULL
  OR "filter" IN ('1', '2', '3', '4', '5', 'RECIRCULACION')
);
