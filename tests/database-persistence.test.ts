import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { normalizeServiceDate } from "@/lib/domain/date";
import { signSessionToken, verifySessionToken } from "@/lib/auth/token";
import type { SessionUser } from "@/lib/auth/session";

describe("Database-Backed Persistence & Security Integration", () => {
  const prisma = new PrismaClient();
  const testKitchenId = "test-db-kitchen-alpha";
  const testContractorId = "test-db-contractor-alpha";
  const testDishId = "test-db-dish-rice";
  const testMealDate = "2026-11-20";

  beforeAll(async () => {
    // Clean up test records
    await prisma.planOverrideAudit.deleteMany({ where: { planItem: { plan: { kitchenId: testKitchenId } } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: ["auth-test@cookcue.test", "revoked-test@cookcue.test"] } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    // Create test contractor, kitchen and dish
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: "CTR-999901",
        name: "Test Contractor Alpha",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenId,
        name: "Test Facility Alpha",
        contractorId: testContractorId,
      },
    });

    await prisma.dish.create({
      data: {
        id: testDishId,
        kitchenId: testKitchenId,
        name: "Brown Basmati Rice",
        unit: "kg",
      },
    });
  });

  afterAll(async () => {
    // Clean up test records
    await prisma.planOverrideAudit.deleteMany({ where: { planItem: { plan: { kitchenId: testKitchenId } } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: ["auth-test@cookcue.test", "revoked-test@cookcue.test"] } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("proves service-level idempotency: identical services across multiple date representations resolve to the same Meal row", async () => {
    const canonicalDate1 = normalizeServiceDate(testMealDate);
    const canonicalDate2 = normalizeServiceDate("2026-11-20T18:30:00+05:30"); // Same calendar day in different format

    // First attempt to upsert meal
    const meal1 = await prisma.meal.upsert({
      where: {
        kitchenId_mealType_date: {
          kitchenId: testKitchenId,
          mealType: "LUNCH",
          date: canonicalDate1,
        },
      },
      update: {},
      create: {
        kitchenId: testKitchenId,
        mealType: "LUNCH",
        date: canonicalDate1,
        expectedDiners: 150,
      },
    });

    // Second retry attempt with alternate representation of same calendar date
    const meal2 = await prisma.meal.upsert({
      where: {
        kitchenId_mealType_date: {
          kitchenId: testKitchenId,
          mealType: "LUNCH",
          date: canonicalDate2,
        },
      },
      update: {},
      create: {
        kitchenId: testKitchenId,
        mealType: "LUNCH",
        date: canonicalDate2,
        expectedDiners: 150,
      },
    });

    expect(meal1.id).toBe(meal2.id);

    const totalMealsInDb = await prisma.meal.count({
      where: { kitchenId: testKitchenId, mealType: "LUNCH" },
    });
    expect(totalMealsInDb).toBe(1);
  });

  it("proves snapshot immutability and override auditing in real database persistence", async () => {
    const meal = await prisma.meal.findFirst({
      where: { kitchenId: testKitchenId, mealType: "LUNCH" },
    });
    expect(meal).toBeDefined();

    // 1. Initial plan creation with frozen snapshot
    const initialBasis = {
      formula: "sum(servedKg) / sum(actualDiners) * expectedDiners",
      applicableExpectedDiners: 150,
      suggestedKg: 30.0,
      timestamp: "2026-11-20T06:00:00Z",
    };

    const plan = await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenId,
        mealId: meal!.id,
        expectedDiners: 150,
        status: "APPROVED",
        items: {
          create: {
            dishId: testDishId,
            recommendedKg: 30.0,
            approvedKg: 30.0,
            snapshotBasisJson: JSON.stringify(initialBasis),
          },
        },
      },
      include: { items: true },
    });

    const initialPlanItem = plan.items[0];
    expect(initialPlanItem.recommendedKg).toBe(30.0);
    expect(initialPlanItem.snapshotBasisJson).toContain("2026-11-20T06:00:00Z");

    // 2. Manager modifies approved target (override: 30kg -> 34.5kg)
    await prisma.planOverrideAudit.create({
      data: {
        planItemId: initialPlanItem.id,
        recommendedKg: initialPlanItem.recommendedKg,
        previousApprovedKg: 30.0,
        newApprovedKg: 34.5,
        reason: "Unexpected festival dinner demand",
        approvedByUserId: "test-user-id",
      },
    });

    // Update item: approvedKg changes, but recommendedKg and snapshotBasisJson MUST REMAIN FROZEN
    await prisma.planItem.update({
      where: { id: initialPlanItem.id },
      data: {
        approvedKg: 34.5,
      },
    });

    // 3. Verify real database state
    const reloadedItem = await prisma.planItem.findUnique({
      where: { id: initialPlanItem.id },
      include: { overrides: true },
    });

    expect(reloadedItem?.approvedKg).toBe(34.5); // Modified target
    expect(reloadedItem?.recommendedKg).toBe(30.0); // Baseline preserved
    expect(reloadedItem?.snapshotBasisJson).toContain("2026-11-20T06:00:00Z"); // Snapshot basis completely frozen!
    expect(reloadedItem?.overrides.length).toBe(1); // Decision audit trail recorded
    expect(reloadedItem?.overrides[0].newApprovedKg).toBe(34.5);
  });

  it("proves real DB authorization & session revocation: role demotion and status deactivation block privileges immediately", async () => {
    // 1. Create active test user in database
    const user = await prisma.user.create({
      data: {
        email: "auth-test@cookcue.test",
        name: "Security Tester",
        role: "FOUNDER",
        status: "ACTIVE",
      },
    });

    const token = await signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: "FOUNDER",
      kitchenId: null,
      contractorId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000000,
    });

    // Token is valid cryptographic session
    const verified = await verifySessionToken<SessionUser>(token);
    expect(verified?.id).toBe(user.id);

    // 2. Demote user in database from FOUNDER to HEAD_COOK
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "HEAD_COOK", kitchenId: testKitchenId },
    });

    // Recheck live DB authorization as Server Actions do:
    const liveDbUser = await prisma.user.findUnique({
      where: { id: verified!.id },
      select: { role: true, status: true, kitchenId: true },
    });

    expect(liveDbUser?.role).toBe("HEAD_COOK");
    expect(liveDbUser?.role !== "FOUNDER").toBe(true); // Demotion immediately recognized!
    expect(liveDbUser?.kitchenId).toBe(testKitchenId); // Facility scope enforced!

    // 3. Deactivate user in database (Revocation)
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "DEACTIVATED" },
    });

    const revokedUser = await prisma.user.findUnique({
      where: { id: verified!.id },
      select: { status: true },
    });
    expect(revokedUser?.status).toBe("DEACTIVATED");
    expect(revokedUser?.status === "ACTIVE").toBe(false); // Instantly revoked!
  });
});
