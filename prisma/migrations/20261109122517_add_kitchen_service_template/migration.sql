-- CreateTable
CREATE TABLE "KitchenServiceTemplate" (
    "id" TEXT NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "defaultExpectedDiners" INTEGER,
    "dishIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitchenServiceTemplate_kitchenId_idx" ON "KitchenServiceTemplate"("kitchenId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenServiceTemplate_kitchenId_name_key" ON "KitchenServiceTemplate"("kitchenId", "name");

-- AddForeignKey
ALTER TABLE "KitchenServiceTemplate" ADD CONSTRAINT "KitchenServiceTemplate_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
