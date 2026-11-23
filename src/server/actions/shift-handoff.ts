"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";
import { computeCloseoutVarianceInternal } from "@/server/actions/closeout";

export type ShiftHandoffSummary = {
  kitchenId: string;
  kitchenName: string;
  date: string;
  mealType: string;
  mealExists: boolean;
  mealId: string | null;
  // Morning / Plan details
  planStatus: "NO_PLAN" | "DRAFT" | "APPROVED";
  expectedDiners: number | null;
  planItemsCount: number;
  approvedBy?: string;
  approvedAt?: string;
  // Closeout / Actuals details
  closeoutStatus: "NOT_STARTED" | "SUBMITTED";
  actualDiners: number | null;
  totalCookedKg: number | null;
  totalLeftoverKg: number | null;
  totalServedKg: number | null;
  stockoutDishes: string[];
  // Reusable T1-A variance
  varianceText?: string;
  varianceLabel?: "higher" | "lower" | "similar";
  variancePct?: number;
  // Station quick links
  links: {
    diary: string;
    closeout: string;
    morning: string;
    staffBoard: string;
    results: string;
    handoff: string;
  };
};

function getDefaultMealTypeForHour(hour: number): "BREAKFAST" | "LUNCH" | "DINNER" {
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  return "DINNER";
}

function getLocalCalendarDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Server Action: Retrieves compact shift handoff summary for a kitchen, date, and mealType.
 * Read-only; guarded by requireKitchenAccess(kitchenId).
 */
export async function getShiftHandoffSummary(
  kitchenId: string,
  date?: string,
  mealType?: string
): Promise<
  | { success: true; data: ShiftHandoffSummary }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode ?? 403 };
  }

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen not found", statusCode: 404 };
    }

    const resolvedDateStr = date || getLocalCalendarDate();
    const serviceDate = normalizeServiceDate(resolvedDateStr);
    const resolvedMealType = (
      mealType || getDefaultMealTypeForHour(new Date().getHours())
    ).toUpperCase();

    const links = {
      diary: `/kitchen/${kitchenId}/diary?date=${resolvedDateStr}&mealType=${resolvedMealType}`,
      closeout: `/kitchen/${kitchenId}/closeout`,
      morning: `/kitchen/${kitchenId}/morning`,
      staffBoard: `/kitchen/${kitchenId}/staff-board`,
      results: `/kitchen/${kitchenId}/results`,
      handoff: `/kitchen/${kitchenId}/handoff?date=${resolvedDateStr}&mealType=${resolvedMealType}`,
    };

    // Query meal with plan, approver, plan items, observations, and dishes
    const meal = await prisma.meal.findFirst({
      where: {
        kitchenId,
        date: serviceDate,
        mealType: resolvedMealType,
      },
      include: {
        cookingPlan: {
          include: {
            firstApprover: {
              select: { id: true, name: true, email: true, role: true },
            },
            items: {
              include: {
                dish: { select: { id: true, name: true, unit: true } },
              },
            },
          },
        },
        observations: {
          include: {
            dish: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!meal) {
      return {
        success: true,
        data: {
          kitchenId,
          kitchenName: kitchen.name,
          date: resolvedDateStr,
          mealType: resolvedMealType,
          mealExists: false,
          mealId: null,
          planStatus: "NO_PLAN",
          expectedDiners: null,
          planItemsCount: 0,
          closeoutStatus: "NOT_STARTED",
          actualDiners: null,
          totalCookedKg: null,
          totalLeftoverKg: null,
          totalServedKg: null,
          stockoutDishes: [],
          links,
        },
      };
    }

    // 1. Plan Details
    let planStatus: "NO_PLAN" | "DRAFT" | "APPROVED" = "NO_PLAN";
    let expectedDiners: number | null = null;
    let planItemsCount = 0;
    let approvedBy: string | undefined;
    let approvedAt: string | undefined;

    if (meal.cookingPlan) {
      const plan = meal.cookingPlan;
      const status = plan.approvalStatus || plan.status;
      planStatus = status === "APPROVED" ? "APPROVED" : "DRAFT";
      expectedDiners = plan.expectedDiners;
      planItemsCount = plan.items.length;

      if (status === "APPROVED") {
        approvedBy = plan.firstApprover?.name || plan.firstApprover?.email || "Head Cook";
        const rawApprovedDate = plan.firstApprovedAt || plan.updatedAt;
        approvedAt = rawApprovedDate.toISOString();
      }
    }

    // 2. Closeout Details
    let closeoutStatus: "NOT_STARTED" | "SUBMITTED" = "NOT_STARTED";
    let actualDiners: number | null = null;
    let totalCookedKg: number | null = null;
    let totalLeftoverKg: number | null = null;
    let totalServedKg: number | null = null;
    const stockoutDishes: string[] = [];

    const completedObs = meal.observations.filter((o) => o.totalCookedKg !== null);
    if (completedObs.length > 0) {
      closeoutStatus = "SUBMITTED";
      actualDiners = completedObs.find((o) => o.actualDiners != null)?.actualDiners ?? null;

      totalCookedKg = Math.round(
        completedObs.reduce((sum, o) => sum + (o.totalCookedKg ?? 0), 0) * 10
      ) / 10;
      totalLeftoverKg = Math.round(
        completedObs.reduce((sum, o) => sum + (o.unservedLeftoverKg ?? 0), 0) * 10
      ) / 10;
      totalServedKg = Math.max(0, Math.round((totalCookedKg - totalLeftoverKg) * 10) / 10);

      completedObs.forEach((o) => {
        if (o.isStockout) {
          stockoutDishes.push(o.dish.name);
        }
      });
    }

    // 3. Optional Variance (reuse T1-A)
    let varianceText: string | undefined;
    let varianceLabel: "higher" | "lower" | "similar" | undefined;
    let variancePct: number | undefined;

    if (closeoutStatus === "SUBMITTED") {
      try {
        const varianceSummary = await computeCloseoutVarianceInternal(kitchenId, meal.id);
        if (varianceSummary?.hasEnoughHistory) {
          varianceText = varianceSummary.varianceText;
          varianceLabel = varianceSummary.varianceLabel;
          variancePct = varianceSummary.variancePct;
        } else if (varianceSummary?.message) {
          varianceText = varianceSummary.message;
        }
      } catch (err) {
        // Non-blocking optional enhancement
      }
    }

    return {
      success: true,
      data: {
        kitchenId,
        kitchenName: kitchen.name,
        date: resolvedDateStr,
        mealType: resolvedMealType,
        mealExists: true,
        mealId: meal.id,
        planStatus,
        expectedDiners,
        planItemsCount,
        approvedBy,
        approvedAt,
        closeoutStatus,
        actualDiners,
        totalCookedKg,
        totalLeftoverKg,
        totalServedKg,
        stockoutDishes,
        varianceText,
        varianceLabel,
        variancePct,
        links,
      },
    };
  } catch (error) {
    console.error("Failed to retrieve shift handoff summary:", error);
    return { success: false, error: "Failed to retrieve shift handoff summary", statusCode: 500 };
  }
}
