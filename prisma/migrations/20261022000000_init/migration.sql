-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kitchen" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kitchen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contractorId" TEXT,
    "kitchenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "expectedDiners" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "totalCookedKg" DOUBLE PRECISION,
    "unservedLeftoverKg" DOUBLE PRECISION,
    "actualDiners" INTEGER,
    "isStockout" BOOLEAN NOT NULL DEFAULT false,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationAudit" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "previousCookedKg" DOUBLE PRECISION,
    "newCookedKg" DOUBLE PRECISION,
    "previousLeftoverKg" DOUBLE PRECISION,
    "newLeftoverKg" DOUBLE PRECISION,
    "previousActualDiners" INTEGER,
    "newActualDiners" INTEGER,
    "previousStockout" BOOLEAN,
    "newStockout" BOOLEAN,
    "previousAbnormal" BOOLEAN,
    "newAbnormal" BOOLEAN,
    "previousExcluded" BOOLEAN,
    "newExcluded" BOOLEAN,
    "previousExclusionReason" TEXT,
    "newExclusionReason" TEXT,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingPlan" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "expectedDiners" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "recommendedKg" DOUBLE PRECISION,
    "approvedKg" DOUBLE PRECISION,
    "snapshotBasisJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanOverrideAudit" (
    "id" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "recommendedKg" DOUBLE PRECISION,
    "previousApprovedKg" DOUBLE PRECISION,
    "newApprovedKg" DOUBLE PRECISION,
    "reason" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanOverrideAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Meal_kitchenId_date_idx" ON "Meal"("kitchenId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_kitchenId_mealType_date_key" ON "Meal"("kitchenId", "mealType", "date");

-- CreateIndex
CREATE INDEX "Observation_kitchenId_mealId_dishId_idx" ON "Observation"("kitchenId", "mealId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_mealId_dishId_key" ON "Observation"("mealId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "CookingPlan_mealId_key" ON "CookingPlan"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planId_dishId_key" ON "PlanItem"("planId", "dishId");

-- AddForeignKey
ALTER TABLE "Kitchen" ADD CONSTRAINT "Kitchen_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationAudit" ADD CONSTRAINT "ObservationAudit_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingPlan" ADD CONSTRAINT "CookingPlan_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingPlan" ADD CONSTRAINT "CookingPlan_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CookingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOverrideAudit" ADD CONSTRAINT "PlanOverrideAudit_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
