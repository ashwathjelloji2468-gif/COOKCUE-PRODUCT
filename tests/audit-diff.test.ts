import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { getPlatformAuditEvents } from "../src/server/actions/audit";

// Mock requireFounder to allow founder execution in test environment
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
  };
});

import { requireFounder } from "../src/lib/auth/session";

describe("Visual Audit Diff Engine & Historical Verification", () => {
  const testKitchenId = "test-audit-diff-kitchen";
  const testContractorId = "test-audit-diff-contractor";
  let founderUserId: string;
  let testDishId: string;
  let testMealId: string;

  beforeEach(async () => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: "test-audit-founder-user",
        email: "founder@cookcue.com",
        name: "Founder Admin",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    founderUserId = "test-audit-founder-user";

    // Cleanup previous test data
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.planOverrideAudit.deleteMany({ where: { planItem: { plan: { kitchenId: testKitchenId } } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: founderUserId } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    const uniqueEmail = `audit-diff-founder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@cookcue.test`;

    // Provision test founder user, contractor, kitchen, dish, meal
    await prisma.user.create({
      data: {
        id: founderUserId,
        email: uniqueEmail,
        name: "Platform Founder",
        role: "FOUNDER",
        status: "ACTIVE",
      },
    });

    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: { id: testContractorId, code: ctrCode, name: "Audit Diff Catering Corp", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenId, contractorId: testContractorId, name: "Audit Central Kitchen", status: "ACTIVE" },
    });

    const dish = await prisma.dish.create({
      data: { kitchenId: testKitchenId, name: "Paneer Butter Masala", unit: "kg" },
    });
    testDishId = dish.id;

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenId,
        mealType: "DINNER",
        date: new Date("2026-11-20T00:00:00.000Z"),
        expectedDiners: 150,
      },
    });
    testMealId = meal.id;
  });

  it("1. PlanOverrideAudit generates a two-column diff with previous vs new quantity, actor, and reason", async () => {
    // Create cooking plan + plan item
    const plan = await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenId,
        mealId: testMealId,
        expectedDiners: 150,
        status: "APPROVED",
        items: {
          create: {
            dishId: testDishId,
            recommendedKg: 30.0,
            approvedKg: 35.0,
          },
        },
      },
      include: { items: true },
    });

    const planItem = plan.items[0];

    // Create a plan override audit record
    await prisma.planOverrideAudit.create({
      data: {
        planItemId: planItem.id,
        recommendedKg: 30.0,
        previousApprovedKg: 30.0,
        newApprovedKg: 35.0,
        reason: "VIP banquet reservation adjustment",
        approvedByUserId: founderUserId,
      },
    });

    const res = await getPlatformAuditEvents();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const overrideEvent = res.data.find(
      (e) => e.eventType === "PLAN_OVERRIDE" && e.reason === "VIP banquet reservation adjustment"
    );
    expect(overrideEvent).toBeDefined();
    expect(overrideEvent?.diff).toBeDefined();
    expect(overrideEvent?.diff?.length).toBeGreaterThan(0);

    const quantityDiff = overrideEvent?.diff?.find((d) => d.field.includes("Approved Target"));
    expect(quantityDiff).toBeDefined();
    expect(quantityDiff?.before).toBe("30 kg");
    expect(quantityDiff?.after).toBe("35 kg");

    expect(overrideEvent?.actor?.id).toBe(founderUserId);
    expect(overrideEvent?.actor?.name).toBe("Platform Founder");
    expect(overrideEvent?.reason).toBe("VIP banquet reservation adjustment");
  });

  it("2. ObservationAudit generates diffs for modified observation fields (quantities, diners, flags)", async () => {
    // Create initial observation
    const obs = await prisma.observation.create({
      data: {
        kitchenId: testKitchenId,
        mealId: testMealId,
        dishId: testDishId,
        totalCookedKg: 35.0,
        unservedLeftoverKg: 5.0,
        actualDiners: 140,
        isStockout: false,
        isAbnormal: false,
      },
    });

    // Create observation audit record (revision: cooked 35 -> 38, leftover 5 -> 2, stockout false -> true)
    await prisma.observationAudit.create({
      data: {
        observationId: obs.id,
        previousCookedKg: 35.0,
        newCookedKg: 38.0,
        previousLeftoverKg: 5.0,
        newLeftoverKg: 2.0,
        previousActualDiners: 140,
        newActualDiners: 155,
        previousStockout: false,
        newStockout: true,
        reason: "Cooked batch was under-reported during dinner service",
        changedByUserId: founderUserId,
      },
    });

    const res = await getPlatformAuditEvents();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const auditEvent = res.data.find(
      (e) =>
        e.eventType === "OBSERVATION_ADJUSTMENT" &&
        e.reason === "Cooked batch was under-reported during dinner service"
    );
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.diff).toBeDefined();

    const cookedDiff = auditEvent?.diff?.find((d) => d.field.includes("Total Cooked"));
    expect(cookedDiff?.before).toBe("35 kg");
    expect(cookedDiff?.after).toBe("38 kg");

    const leftoverDiff = auditEvent?.diff?.find((d) => d.field.includes("Unserved Leftover"));
    expect(leftoverDiff?.before).toBe("5 kg");
    expect(leftoverDiff?.after).toBe("2 kg");

    const dinersDiff = auditEvent?.diff?.find((d) => d.field.includes("Actual Diner Count"));
    expect(dinersDiff?.before).toBe("140 diners");
    expect(dinersDiff?.after).toBe("155 diners");

    const stockoutDiff = auditEvent?.diff?.find((d) => d.field.includes("Stockout Incident"));
    expect(stockoutDiff?.before).toContain("No");
    expect(stockoutDiff?.after).toContain("Yes");

    expect(auditEvent?.actor?.id).toBe(founderUserId);
    expect(auditEvent?.reason).toBe("Cooked batch was under-reported during dinner service");
  });

  it("3. Single snapshot events (SERVICE_CLOSEOUT) do NOT invent a fake 'before' value and populate snapshot", async () => {
    // Direct closeout observation without any revisions
    await prisma.observation.create({
      data: {
        kitchenId: testKitchenId,
        mealId: testMealId,
        dishId: testDishId,
        totalCookedKg: 40.0,
        unservedLeftoverKg: 4.0,
        actualDiners: 160,
        isStockout: false,
        isAbnormal: false,
      },
    });

    const res = await getPlatformAuditEvents();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const closeoutEvent = res.data.find((e) => e.eventType === "SERVICE_CLOSEOUT");
    expect(closeoutEvent).toBeDefined();
    // In accordance with Requirement 2: No fake diff or invented "before" value
    expect(closeoutEvent?.diff).toBeNull();
    expect(closeoutEvent?.snapshot).toBeDefined();

    const cookedSnap = closeoutEvent?.snapshot?.find((s) => s.field === "Total Cooked");
    expect(cookedSnap?.value).toBe("40 kg");

    const dinersSnap = closeoutEvent?.snapshot?.find((s) => s.field === "Actual Diners");
    expect(dinersSnap?.value).toBe("160");
  });

  it("4. Diffs strictly validate structure (field, before, after, timestamp, actor) across multiple audit models", async () => {
    // 1. Create a plan item override
    const plan = await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenId,
        mealId: testMealId,
        expectedDiners: 150,
        status: "APPROVED",
        items: {
          create: {
            dishId: testDishId,
            recommendedKg: 25.0,
            approvedKg: 28.0,
          },
        },
      },
      include: { items: true },
    });

    await prisma.planOverrideAudit.create({
      data: {
        planItemId: plan.items[0].id,
        recommendedKg: 25.0,
        previousApprovedKg: 25.0,
        newApprovedKg: 28.0,
        reason: "Chef increased batch for high walk-in expectation",
        approvedByUserId: founderUserId,
      },
    });

    // 2. Create an observation revision
    const obs = await prisma.observation.create({
      data: {
        kitchenId: testKitchenId,
        mealId: testMealId,
        dishId: testDishId,
        totalCookedKg: 28.0,
        unservedLeftoverKg: 3.0,
        actualDiners: 145,
        isStockout: false,
        isAbnormal: false,
      },
    });

    await prisma.observationAudit.create({
      data: {
        observationId: obs.id,
        previousCookedKg: 28.0,
        newCookedKg: 30.0,
        previousLeftoverKg: 3.0,
        newLeftoverKg: 1.0,
        previousActualDiners: 145,
        newActualDiners: 152,
        previousStockout: false,
        newStockout: true,
        previousAbnormal: false,
        newAbnormal: true,
        previousExcluded: false,
        newExcluded: true,
        previousExclusionReason: null,
        newExclusionReason: "Severe weather outlier",
        reason: "Evening inventory correction",
        changedByUserId: founderUserId,
      },
    });

    const res = await getPlatformAuditEvents();
    expect(res.success).toBe(true);
    if (!res.success) return;

    // Both diff events should be in the list
    const overrideEvt = res.data.find((e) => e.eventType === "PLAN_OVERRIDE");
    const obsAuditEvt = res.data.find((e) => e.eventType === "OBSERVATION_ADJUSTMENT");

    expect(overrideEvt).toBeDefined();
    expect(obsAuditEvt).toBeDefined();

    // Verify structure of every diff item: field (string), before (not undefined), after (not undefined)
    const allDiffs = [...(overrideEvt?.diff || []), ...(obsAuditEvt?.diff || [])];
    expect(allDiffs.length).toBeGreaterThanOrEqual(8);

    for (const diff of allDiffs) {
      expect(typeof diff.field).toBe("string");
      expect(diff.field.length).toBeGreaterThan(0);
      expect(diff.before).not.toBeUndefined();
      expect(diff.after).not.toBeUndefined();
      expect(diff.before).not.toBe(diff.after); // Asserts before and after are genuinely different
    }

    // Verify timestamp and actor are populated on diff events
    expect(new Date(overrideEvt!.timestamp).getTime()).not.toBeNaN();
    expect(overrideEvt!.actor?.id).toBe(founderUserId);
    expect(new Date(obsAuditEvt!.timestamp).getTime()).not.toBeNaN();
    expect(obsAuditEvt!.actor?.id).toBe(founderUserId);

    // Verify exclusion diff specifically
    const exclusionDiff = obsAuditEvt?.diff?.find((d) => d.field.includes("Exclusion"));
    expect(exclusionDiff).toBeDefined();
    expect(exclusionDiff?.before).toContain("Eligible");
    expect(exclusionDiff?.after).toContain("Excluded");
  });

  it("5. Visual audit payload enforces chronological ordering with newest events first", async () => {
    const res = await getPlatformAuditEvents();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const timestamps = res.data.map((e) => new Date(e.timestamp).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });
});
