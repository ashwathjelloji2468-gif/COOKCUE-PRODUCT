import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";
import {
  createDish,
  getDishes,
  updateDish,
  deleteDish,
} from "../src/server/actions/dishes";
import {
  getStaffBoardData,
  getStaffBoardPrintData,
} from "../src/server/actions/staff-board";
import {
  AllergenTagsArraySchema,
  MenuCycleLabelSchema,
  formatAllergenLabel,
} from "../src/lib/kitchen/allergens";

// Mock session authentication
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
  };
});

import { requireKitchenAccess } from "../src/lib/auth/session";

describe("WAVE 3 / T3-C — Allergen Tags & Menu Cycle on Dishes", () => {
  const testContractorId = "test-allergen-contractor";
  const testKitchenIdA = "test-allergen-kitchen-a";
  const testKitchenIdB = "test-allergen-kitchen-b";
  let createdDishId: string;

  const todayStr = toServiceDateString(new Date());
  const todayMidnight = normalizeServiceDate(todayStr);

  beforeAll(async () => {
    const kIds = [testKitchenIdA, testKitchenIdB];
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    const code = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code,
        name: "Allergen Test Catering Org",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenIdA,
              name: "Allergen Kitchen Alpha",
              status: "ACTIVE",
            },
            {
              id: testKitchenIdB,
              name: "Allergen Kitchen Beta",
              status: "ACTIVE",
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const kIds = [testKitchenIdA, testKitchenIdB];
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
  });

  describe("1. Validation & Formatting Helpers", () => {
    it("parses, cleans, and deduplicates allergen tags", () => {
      const parsed = AllergenTagsArraySchema.parse(["gluten", "dairy", "GLUTEN", "tree nut"]);
      expect(parsed).toEqual(["GLUTEN", "DAIRY", "TREE_NUT"]);
    });

    it("formats allergen tags into human-friendly operational labels", () => {
      expect(formatAllergenLabel("TREE_NUT")).toBe("Tree Nut");
      expect(formatAllergenLabel("GLUTEN")).toBe("Gluten");
      expect(formatAllergenLabel("SHELLFISH")).toBe("Shellfish");
    });

    it("parses and trims menu cycle labels", () => {
      expect(MenuCycleLabelSchema.parse("  Week A - Mon  ")).toBe("Week A - Mon");
      expect(MenuCycleLabelSchema.parse("")).toBeNull();
      expect(MenuCycleLabelSchema.parse(null)).toBeNull();
    });
  });

  describe("2. Dish Mutations with Allergens & Menu Cycle", () => {
    it("creates a dish with allergen tags and menu cycle label", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", role: "HEAD_COOK", kitchenId: testKitchenIdA } as any,
        kitchenId: testKitchenIdA,
      });

      const res = await createDish(
        testKitchenIdA,
        "Nutty Brown Rice",
        "kg",
        ["GLUTEN", "TREE_NUT"],
        "Week A - Mon"
      );

      expect(res.success).toBe(true);
      if (!res.success) return;
      createdDishId = res.dishId;
      expect(createdDishId).toBeDefined();
    });

    it("getDishes returns allergenTags and menuCycleLabel", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", role: "HEAD_COOK", kitchenId: testKitchenIdA } as any,
        kitchenId: testKitchenIdA,
      });

      const res = await getDishes(testKitchenIdA);
      expect(res.success).toBe(true);
      if (!res.success) return;

      const dish = res.data.find((d) => d.id === createdDishId);
      expect(dish).toBeDefined();
      expect(dish?.name).toBe("Nutty Brown Rice");
      expect(dish?.allergenTags).toEqual(["GLUTEN", "TREE_NUT"]);
      expect(dish?.menuCycleLabel).toBe("Week A - Mon");
    });

    it("updates dish allergen tags and menu cycle label", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", role: "HEAD_COOK", kitchenId: testKitchenIdA } as any,
        kitchenId: testKitchenIdA,
      });

      const res = await updateDish(testKitchenIdA, createdDishId, {
        allergenTags: ["GLUTEN", "DAIRY", "SESAME"],
        menuCycleLabel: "Cycle B - Thu",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.dish.allergenTags).toEqual(["GLUTEN", "DAIRY", "SESAME"]);
      expect(res.dish.menuCycleLabel).toBe("Cycle B - Thu");
    });

    it("enforces tenant boundary: rejects mutation from unauthorized kitchen", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: false,
        error: "Access denied to kitchen facility",
        statusCode: 403,
      });

      const res = await updateDish(testKitchenIdB, createdDishId, {
        name: "Hacked Dish Name",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
      }
    });
  });

  describe("3. Staff Board and Print Views Integration", () => {
    beforeAll(async () => {
      // Create approved cooking plan referencing this dish
      const meal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: todayMidnight,
          mealType: "LUNCH",
          expectedDiners: 150,
        },
      });

      const plan = await prisma.cookingPlan.create({
        data: {
          kitchenId: testKitchenIdA,
          mealId: meal.id,
          expectedDiners: 150,
          status: "APPROVED",
          approvalStatus: "APPROVED",
          firstApprovedAt: new Date(),
        },
      });

      await prisma.planItem.create({
        data: {
          planId: plan.id,
          dishId: createdDishId,
          recommendedKg: 30,
          approvedKg: 32,
        },
      });
    });

    it("Staff Board payload includes allergen tags and menu cycle in item details", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-staff", role: "KITCHEN_STAFF", kitchenId: testKitchenIdA } as any,
        kitchenId: testKitchenIdA,
      });

      const res = await getStaffBoardData(testKitchenIdA, todayStr, "LUNCH");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const item = res.data.approvedPlan?.items.find((i) => i.dishId === createdDishId);
      expect(item).toBeDefined();
      expect(item?.allergenTags).toEqual(["GLUTEN", "DAIRY", "SESAME"]);
      expect(item?.menuCycleLabel).toBe("Cycle B - Thu");
    });

    it("Staff Board Print payload includes allergen tags and menu cycle", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-staff", role: "KITCHEN_STAFF", kitchenId: testKitchenIdA } as any,
        kitchenId: testKitchenIdA,
      });

      const res = await getStaffBoardPrintData(testKitchenIdA, todayStr, "LUNCH");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const item = res.data.items.find((i) => i.dishId === createdDishId);
      expect(item).toBeDefined();
      expect(item?.allergenTags).toEqual(["GLUTEN", "DAIRY", "SESAME"]);
      expect(item?.menuCycleLabel).toBe("Cycle B - Thu");
    });
  });
});
