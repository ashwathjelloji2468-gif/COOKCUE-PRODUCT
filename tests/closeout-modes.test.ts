import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import {
  applyCloseoutMode,
  applyWholeMealAsPlanned,
  applyWholeMealRanOut,
  canApplyWholeMealCloseout,
  type CloseoutModeItemInput,
} from "../src/lib/domain/closeout-modes";
import { prisma } from "../src/lib/prisma";
import { submitCloseout } from "../src/server/actions/closeout";
import { normalizeServiceDate } from "../src/lib/domain/date";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

// Mock session module to grant kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Phase 3 UX: Closeout Modes (Custom / As planned / Ran out)", () => {
  const sampleItems: CloseoutModeItemInput[] = [
    {
      dishId: "dish-1",
      dishName: "Jeera Rice",
      approvedKg: 45.5,
      totalCookedKg: "",
      unservedLeftoverKg: "5.0",
      isStockout: false,
      isAbnormal: false,
    },
    {
      dishId: "dish-2",
      dishName: "Dal Tadka",
      approvedKg: 30.0,
      totalCookedKg: "28.0",
      unservedLeftoverKg: "2.0",
      isStockout: true,
      isAbnormal: false,
    },
    {
      dishId: "dish-3",
      dishName: "Chef Special (Unplanned)",
      approvedKg: null,
      totalCookedKg: "12.0",
      unservedLeftoverKg: "1.0",
      isStockout: false,
      isAbnormal: false,
    },
  ];

  it("1. As-planned mode sets cooked from plan targets, zeroes leftovers, and clears stockouts", () => {
    const result = applyCloseoutMode("AS_PLANNED", sampleItems);

    expect(result).toHaveLength(3);

    // Dish 1: target 45.5
    expect(result[0].totalCookedKg).toBe("45.5");
    expect(result[0].unservedLeftoverKg).toBe("0");
    expect(result[0].isStockout).toBe(false);

    // Dish 2: target 30.0 (cleared stockout)
    expect(result[1].totalCookedKg).toBe("30");
    expect(result[1].unservedLeftoverKg).toBe("0");
    expect(result[1].isStockout).toBe(false);

    // Dish 3: null target (leaves existing cookedKg)
    expect(result[2].totalCookedKg).toBe("12.0");
    expect(result[2].unservedLeftoverKg).toBe("0");
    expect(result[2].isStockout).toBe(false);
  });

  it("2. Ran-out mode zeroes leftovers, flags stockout = true, and sets cooked from plan if available", () => {
    const result = applyCloseoutMode("RAN_OUT", sampleItems);

    expect(result).toHaveLength(3);

    // Dish 1: stockout = true, leftover = 0, cooked from plan target
    expect(result[0].totalCookedKg).toBe("45.5");
    expect(result[0].unservedLeftoverKg).toBe("0");
    expect(result[0].isStockout).toBe(true);

    // Dish 2: stockout = true, leftover = 0, cooked from plan target
    expect(result[1].totalCookedKg).toBe("30");
    expect(result[1].unservedLeftoverKg).toBe("0");
    expect(result[1].isStockout).toBe(true);

    // Dish 3: null target (preserves cookedKg), stockout = true, leftover = 0
    expect(result[2].totalCookedKg).toBe("12.0");
    expect(result[2].unservedLeftoverKg).toBe("0");
    expect(result[2].isStockout).toBe(true);
  });

  it("3. Custom mode preserves manual user entries unchanged", () => {
    const result = applyCloseoutMode("CUSTOM", sampleItems);

    expect(result).toEqual(sampleItems);
  });

  it("4. User can freely edit fields after applying a mode (last edit wins)", () => {
    const asPlanned = applyCloseoutMode("AS_PLANNED", sampleItems);

    // User overrides leftovers on Dish 1 to 1.5 kg
    const modified = asPlanned.map((item) =>
      item.dishId === "dish-1" ? { ...item, unservedLeftoverKg: "1.5" } : item
    );

    expect(modified[0].totalCookedKg).toBe("45.5");
    expect(modified[0].unservedLeftoverKg).toBe("1.5");
    expect(modified[0].isStockout).toBe(false);
  });

  describe("5. End-to-end Closeout Submit remains strictly explicit (no auto-submit on mode change)", () => {
    const testKitchenId = "test-closeout-mode-kitchen";
    const testContractorId = "test-closeout-mode-contractor";
    let testMealId: string;
    let testDishId: string;

    beforeEach(async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValue({
        success: true,
        user: {
          id: "test-user-hc",
          email: "headcook@cookcue.com",
          name: "Head Cook",
          role: "HEAD_COOK",
          contractorId: testContractorId,
          kitchenId: testKitchenId,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      });

      vi.mocked(getSessionUser).mockResolvedValue({
        id: "test-user-hc",
        email: "headcook@cookcue.com",
        name: "Head Cook",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });

      // Cleanup
      await prisma.observationAudit.deleteMany({
        where: { observation: { kitchenId: testKitchenId } },
      }).catch(() => {});
      await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.planItem.deleteMany({
        where: { plan: { kitchenId: testKitchenId } },
      }).catch(() => {});
      await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
      await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

      const ctrCode = await generateNextContractorCode();
      await prisma.contractor.create({
        data: {
          id: testContractorId,
          code: ctrCode,
          name: "Closeout Mode Org",
          status: "ACTIVE",
        },
      });

      await prisma.kitchen.create({
        data: {
          id: testKitchenId,
          name: "Closeout Facility",
          contractorId: testContractorId,
        },
      });

      const dish = await prisma.dish.create({
        data: {
          name: "Mode Rice",
          kitchenId: testKitchenId,
          unit: "kg",
        },
      });
      testDishId = dish.id;

      const meal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenId,
          mealType: "LUNCH",
          date: normalizeServiceDate("2026-11-20"),
          expectedDiners: 100,
        },
      });
      testMealId = meal.id;

      // Create an APPROVED cooking plan
      const plan = await prisma.cookingPlan.create({
        data: {
          kitchenId: testKitchenId,
          mealId: testMealId,
          expectedDiners: 100,
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      });

      await prisma.planItem.create({
        data: {
          planId: plan.id,
          dishId: testDishId,
          recommendedKg: 25.0,
          approvedKg: 25.0,
        },
      });
    });

    afterAll(async () => {
      await prisma.observationAudit.deleteMany({
        where: { observation: { kitchenId: testKitchenId } },
      }).catch(() => {});
      await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.planItem.deleteMany({
        where: { plan: { kitchenId: testKitchenId } },
      }).catch(() => {});
      await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
      await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
      await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
    });

    it("Applying modes modifies client items only; database observation records remain 0 until submitCloseout", async () => {
      const itemsToCloseout: CloseoutModeItemInput[] = [
        {
          dishId: testDishId,
          dishName: "Mode Rice",
          approvedKg: 25.0,
          totalCookedKg: "",
          unservedLeftoverKg: "",
          isStockout: false,
          isAbnormal: false,
        },
      ];

      // 1. Apply "As planned" mode
      const asPlannedItems = applyCloseoutMode("AS_PLANNED", itemsToCloseout);
      expect(asPlannedItems[0].totalCookedKg).toBe("25");
      expect(asPlannedItems[0].unservedLeftoverKg).toBe("0");

      // Verify zero observations in DB
      let count = await prisma.observation.count({ where: { kitchenId: testKitchenId } });
      expect(count).toBe(0);

      // 2. Switch to "Ran out" mode
      const ranOutItems = applyCloseoutMode("RAN_OUT", asPlannedItems);
      expect(ranOutItems[0].isStockout).toBe(true);

      // Verify still zero observations in DB (no auto-submit)
      count = await prisma.observation.count({ where: { kitchenId: testKitchenId } });
      expect(count).toBe(0);

      // 3. Explicitly submit closeout
      const submitRes = await submitCloseout({
        kitchenId: testKitchenId,
        mealId: testMealId,
        actualDiners: 100,
        items: [
          {
            dishId: ranOutItems[0].dishId,
            totalCookedKg: parseFloat(ranOutItems[0].totalCookedKg),
            unservedLeftoverKg: parseFloat(ranOutItems[0].unservedLeftoverKg),
            isStockout: ranOutItems[0].isStockout,
            isAbnormal: ranOutItems[0].isAbnormal,
          },
        ],
      });

      expect(submitRes.success).toBe(true);

      // Now exactly 1 observation is committed
      count = await prisma.observation.count({ where: { kitchenId: testKitchenId } });
      expect(count).toBe(1);

      const savedObs = await prisma.observation.findFirst({
        where: { kitchenId: testKitchenId },
      });
      expect(savedObs?.totalCookedKg).toBe(25.0);
      expect(savedObs?.unservedLeftoverKg).toBe(0);
      expect(savedObs?.isStockout).toBe(true);
    });

    it("Rejects closeout when leftover > cooked, even if edited after mode preset", async () => {
      const submitRes = await submitCloseout({
        kitchenId: testKitchenId,
        mealId: testMealId,
        actualDiners: 100,
        items: [
          {
            dishId: testDishId,
            totalCookedKg: 20.0,
            unservedLeftoverKg: 25.0, // Invalid: leftover > cooked
            isStockout: false,
            isAbnormal: false,
          },
        ],
      });

      expect(submitRes.success).toBe(false);
      if (!submitRes.success) {
        expect(submitRes.error).toContain("Leftovers cannot exceed production");
      }
    });
  });

  describe("Phase B: 3-Tap Whole-Meal Closeout", () => {
    const multiDishPlanItems: CloseoutModeItemInput[] = [
      {
        dishId: "dish-101",
        dishName: "Sambar",
        approvedKg: 40.0,
        totalCookedKg: "",
        unservedLeftoverKg: "",
        isStockout: false,
        isAbnormal: false,
      },
      {
        dishId: "dish-102",
        dishName: "Curd Rice",
        approvedKg: 35.5,
        totalCookedKg: "",
        unservedLeftoverKg: "",
        isStockout: false,
        isAbnormal: false,
      },
      {
        dishId: "dish-103",
        dishName: "Poriyal",
        approvedKg: 15.0,
        totalCookedKg: "",
        unservedLeftoverKg: "",
        isStockout: true,
        isAbnormal: false,
      },
    ];

    it("1. Whole meal as planned fills ALL dish rows from approved targets, zeroes leftovers, and clears stockout", () => {
      const result = applyWholeMealAsPlanned(multiDishPlanItems, null, 175);

      expect(result.items).toHaveLength(3);
      expect(result.actualDiners).toBe(175);

      // Dish 1
      expect(result.items[0].totalCookedKg).toBe("40");
      expect(result.items[0].unservedLeftoverKg).toBe("0");
      expect(result.items[0].isStockout).toBe(false);

      // Dish 2
      expect(result.items[1].totalCookedKg).toBe("35.5");
      expect(result.items[1].unservedLeftoverKg).toBe("0");
      expect(result.items[1].isStockout).toBe(false);

      // Dish 3 (previously had stockout=true, now cleared to false)
      expect(result.items[2].totalCookedKg).toBe("15");
      expect(result.items[2].unservedLeftoverKg).toBe("0");
      expect(result.items[2].isStockout).toBe(false);
    });

    it("2. Whole meal as planned preserves user actualDiners if already populated (> 0)", () => {
      const result = applyWholeMealAsPlanned(multiDishPlanItems, 190, 175);
      expect(result.actualDiners).toBe(190);
    });

    it("3. Whole meal ran out sets cooked from plan targets, zeroes leftovers, and flags stockout=true on ALL rows", () => {
      const result = applyWholeMealRanOut(multiDishPlanItems, 120, 150);

      expect(result.items).toHaveLength(3);
      expect(result.actualDiners).toBe(120);

      expect(result.items[0].totalCookedKg).toBe("40");
      expect(result.items[0].unservedLeftoverKg).toBe("0");
      expect(result.items[0].isStockout).toBe(true);

      expect(result.items[1].totalCookedKg).toBe("35.5");
      expect(result.items[1].unservedLeftoverKg).toBe("0");
      expect(result.items[1].isStockout).toBe(true);

      expect(result.items[2].totalCookedKg).toBe("15");
      expect(result.items[2].unservedLeftoverKg).toBe("0");
      expect(result.items[2].isStockout).toBe(true);
    });

    it("4. canApplyWholeMealCloseout rejects safely when no approved plan exists or items have no targets", () => {
      // Unplanned service
      const checkUnplanned = canApplyWholeMealCloseout(true, null, multiDishPlanItems);
      expect(checkUnplanned.allowed).toBe(false);
      expect(checkUnplanned.reason).toContain("approved morning plan");

      // No mealId
      const checkNoMealId = canApplyWholeMealCloseout(false, null, multiDishPlanItems);
      expect(checkNoMealId.allowed).toBe(false);

      // No targets in items
      const checkNoTargets = canApplyWholeMealCloseout(false, "meal-1", [
        { approvedKg: null },
        { approvedKg: null },
      ]);
      expect(checkNoTargets.allowed).toBe(false);
      expect(checkNoTargets.reason).toContain("no target quantities");

      // Valid approved plan
      const checkValid = canApplyWholeMealCloseout(false, "meal-1", multiDishPlanItems);
      expect(checkValid.allowed).toBe(true);
    });

    it("5. Whole meal helper is strictly pure and does NOT automatically submit closeout to database", async () => {
      const beforeCount = await prisma.observation.count();

      // Running the domain helper
      const result = applyWholeMealAsPlanned(multiDishPlanItems, 100, 100);
      expect(result.items.length).toBe(3);

      // No observations created without explicit submitCloseout
      const afterCount = await prisma.observation.count();
      expect(afterCount).toBe(beforeCount);
    });
  });
});
