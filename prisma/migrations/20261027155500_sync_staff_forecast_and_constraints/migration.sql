-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "address" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "primaryContactName" TEXT;

-- AlterTable
ALTER TABLE "CookingPlan" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "firstApprovedAt" TIMESTAMP(3),
ADD COLUMN     "firstApproverId" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "secondApprovedAt" TIMESTAMP(3),
ADD COLUMN     "secondApproverId" TEXT;

-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "eligibilityStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "recommendedKg" DOUBLE PRECISION,
    "eligibleCount" INTEGER NOT NULL,
    "expectedDiners" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReport" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'LUNCH',
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "dishId" TEXT,
    "quantityKg" DOUBLE PRECISION,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastSnapshot_kitchenId_mealType_dishId_idx" ON "ForecastSnapshot"("kitchenId", "mealType", "dishId");

-- CreateIndex
CREATE INDEX "ForecastSnapshot_computedAt_idx" ON "ForecastSnapshot"("computedAt");

-- CreateIndex
CREATE INDEX "StaffReport_kitchenId_date_idx" ON "StaffReport"("kitchenId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_code_key" ON "Contractor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Dish_kitchenId_name_key" ON "Dish"("kitchenId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- AddForeignKey
ALTER TABLE "CookingPlan" ADD CONSTRAINT "CookingPlan_firstApproverId_fkey" FOREIGN KEY ("firstApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingPlan" ADD CONSTRAINT "CookingPlan_secondApproverId_fkey" FOREIGN KEY ("secondApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastSnapshot" ADD CONSTRAINT "ForecastSnapshot_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastSnapshot" ADD CONSTRAINT "ForecastSnapshot_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReport" ADD CONSTRAINT "StaffReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReport" ADD CONSTRAINT "StaffReport_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
