-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "allergenTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "menuCycleLabel" TEXT;

-- CreateTable
CREATE TABLE "OperationalReminderLog" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "serviceDate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "summary" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementIndent" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementIndent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementIndentLine" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "dishId" TEXT,
    "dishName" TEXT NOT NULL,
    "targetKg" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "allergenTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "menuCycleLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementIndentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalReminderLog_kitchenId_mealType_serviceDate_type__idx" ON "OperationalReminderLog"("kitchenId", "mealType", "serviceDate", "type", "sentAt");

-- CreateIndex
CREATE INDEX "ProcurementIndent_kitchenId_date_idx" ON "ProcurementIndent"("kitchenId", "date");

-- CreateIndex
CREATE INDEX "ProcurementIndent_mealId_idx" ON "ProcurementIndent"("mealId");

-- CreateIndex
CREATE INDEX "ProcurementIndent_kitchenId_status_idx" ON "ProcurementIndent"("kitchenId", "status");

-- CreateIndex
CREATE INDEX "ProcurementIndentLine_indentId_idx" ON "ProcurementIndentLine"("indentId");

-- CreateIndex
CREATE INDEX "ProcurementIndentLine_dishId_idx" ON "ProcurementIndentLine"("dishId");

-- AddForeignKey
ALTER TABLE "OperationalReminderLog" ADD CONSTRAINT "OperationalReminderLog_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementIndent" ADD CONSTRAINT "ProcurementIndent_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementIndent" ADD CONSTRAINT "ProcurementIndent_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementIndent" ADD CONSTRAINT "ProcurementIndent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementIndentLine" ADD CONSTRAINT "ProcurementIndentLine_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "ProcurementIndent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementIndentLine" ADD CONSTRAINT "ProcurementIndentLine_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;
