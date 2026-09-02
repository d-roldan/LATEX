ALTER TABLE "User"
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isSystemOwner" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_companyId_isProtected_idx" ON "User"("companyId", "isProtected");
CREATE INDEX "User_companyId_isSystemOwner_idx" ON "User"("companyId", "isSystemOwner");
