-- CreateIndex
CREATE INDEX "Dish_kitchenId_idx" ON "Dish"("kitchenId");

-- CreateIndex
CREATE INDEX "Kitchen_contractorId_idx" ON "Kitchen"("contractorId");

-- CreateIndex
CREATE INDEX "ObservationAudit_observationId_idx" ON "ObservationAudit"("observationId");

-- CreateIndex
CREATE INDEX "PlanOverrideAudit_planItemId_idx" ON "PlanOverrideAudit"("planItemId");

-- CreateIndex
CREATE INDEX "User_contractorId_idx" ON "User"("contractorId");

-- CreateIndex
CREATE INDEX "User_kitchenId_idx" ON "User"("kitchenId");
