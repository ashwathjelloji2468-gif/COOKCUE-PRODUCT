"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";

export type KitchenResultsDashboardData = {
  summary: {
    totalServices: number;
    totalActualDiners: number;
    totalSuggestedKg: number;
    totalApprovedKg: number;
    totalCookedKg: number;
    totalLeftoverKg: number;
    leftoverPerDiner: number | null; // Safe calculation: null if totalActualDiners === 0
    stockoutCount: number;
    abnormalCount: number;
    excludedCount: number;
    missingCount: number;
  };
  filters: {
    kitchenId: string;
    startDate?: string;
    endDate?: string;
    mealType?: string;
    dishId?: string;
  };
  records: {
    id: string;
    date: string;
    mealType: string;
    dishId: string;
    dishName: string;
    suggestedKg: number | null;
    approvedKg: number | null;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    actualDiners: number | null;
    leftoverPerDiner: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
    isExcluded: boolean;
    exclusionReason: string | null;
    auditCount: number;
  }[];
  dishes: { id: string; name: string }[];
};

export async function getKitchenResultsDashboard(filterInput: {
  kitchenId: string;
  startDate?: string;
  endDate?: string;
  mealType?: string;
  dishId?: string;
}): Promise<
  | { success: true; data: KitchenResultsDashboardData }
  | { success: false; error: string }
> {
  const { kitchenId, startDate, endDate, mealType, dishId } = filterInput;

  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    // 1. Fetch available dishes for kitchen filter dropdown
    const dishes = await prisma.dish.findMany({
      where: { kitchenId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // 2. Build meal where clause
    const mealWhere: any = { kitchenId };

    if (mealType && mealType !== "ALL") {
      mealWhere.mealType = mealType;
    }

    if (startDate || endDate) {
      mealWhere.date = {};
      if (startDate) {
        mealWhere.date.gte = normalizeServiceDate(startDate);
      }
      if (endDate) {
        const end = normalizeServiceDate(endDate);
        end.setUTCHours(23, 59, 59, 999);
        mealWhere.date.lte = end;
      }
    }

    // 3. Fetch all matching meals with cooking plans and observations
    const meals = await prisma.meal.findMany({
      where: mealWhere,
      include: {
        cookingPlan: {
          include: {
            items: {
              include: { dish: true },
            },
          },
        },
        observations: {
          where: dishId && dishId !== "ALL" ? { dishId } : undefined,
          include: {
            dish: true,
            audits: { select: { id: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // 4. Aggregate metrics with safe zero handling
    let totalActualDiners = 0;
    let totalSuggestedKg = 0;
    let totalApprovedKg = 0;
    let totalCookedKg = 0;
    let totalLeftoverKg = 0;
    let stockoutCount = 0;
    let abnormalCount = 0;
    let excludedCount = 0;
    let missingCount = 0;

    const records: KitchenResultsDashboardData["records"] = [];
    const seenDinerMealIds = new Set<string>();

    for (const meal of meals) {
      // Map plan items for quick lookup
      const planItemMap = new Map<string, { recommendedKg: number | null; approvedKg: number | null }>();
      if (meal.cookingPlan) {
        for (const item of meal.cookingPlan.items) {
          planItemMap.set(item.dishId, {
            recommendedKg: item.recommendedKg,
            approvedKg: item.approvedKg,
          });
          if (!dishId || dishId === "ALL" || dishId === item.dishId) {
            if (item.recommendedKg !== null) totalSuggestedKg += item.recommendedKg;
            if (item.approvedKg !== null) totalApprovedKg += item.approvedKg;
          }
        }
      }

      for (const obs of meal.observations) {
        if (obs.isStockout) stockoutCount += 1;
        if (obs.isAbnormal) abnormalCount += 1;
        if (obs.isExcluded) excludedCount += 1;

        if (obs.totalCookedKg === null || obs.unservedLeftoverKg === null || obs.actualDiners === null) {
          missingCount += 1;
        }

        if (obs.totalCookedKg !== null) totalCookedKg += obs.totalCookedKg;
        if (obs.unservedLeftoverKg !== null) totalLeftoverKg += obs.unservedLeftoverKg;

        // Count meal actual diners once per meal to avoid duplicate summing
        if (obs.actualDiners !== null && !seenDinerMealIds.has(meal.id)) {
          totalActualDiners += obs.actualDiners;
          seenDinerMealIds.add(meal.id);
        }

        const planItem = planItemMap.get(obs.dishId);
        const itemLeftoverPerDiner =
          obs.actualDiners && obs.actualDiners > 0 && obs.unservedLeftoverKg !== null
            ? obs.unservedLeftoverKg / obs.actualDiners
            : null;

        records.push({
          id: obs.id,
          date: meal.date.toISOString().slice(0, 10),
          mealType: meal.mealType,
          dishId: obs.dishId,
          dishName: obs.dish.name,
          suggestedKg: planItem?.recommendedKg ?? null,
          approvedKg: planItem?.approvedKg ?? null,
          totalCookedKg: obs.totalCookedKg,
          unservedLeftoverKg: obs.unservedLeftoverKg,
          actualDiners: obs.actualDiners,
          leftoverPerDiner: itemLeftoverPerDiner,
          isStockout: obs.isStockout,
          isAbnormal: obs.isAbnormal,
          isExcluded: obs.isExcluded,
          exclusionReason: obs.exclusionReason,
          auditCount: obs.audits.length,
        });
      }

      if (meal.observations.length === 0 && meal.cookingPlan) {
        for (const item of meal.cookingPlan.items) {
          if (!dishId || dishId === "ALL" || dishId === item.dishId) {
            records.push({
              id: `${meal.id}-${item.id}`,
              date: meal.date.toISOString().slice(0, 10),
              mealType: meal.mealType,
              dishId: item.dishId,
              dishName: item.dish.name,
              suggestedKg: item.recommendedKg,
              approvedKg: item.approvedKg,
              totalCookedKg: null,
              unservedLeftoverKg: null,
              actualDiners: null,
              leftoverPerDiner: null,
              isStockout: false,
              isAbnormal: false,
              isExcluded: false,
              exclusionReason: null,
              auditCount: 0,
            });
          }
        }
      }
    }

    // Safe division: leftoverPerDiner is null if totalActualDiners is 0 or negative
    const leftoverPerDiner =
      totalActualDiners > 0 ? totalLeftoverKg / totalActualDiners : null;

    return {
      success: true,
      data: {
        summary: {
          totalServices: meals.length,
          totalActualDiners,
          totalSuggestedKg: Math.round(totalSuggestedKg * 100) / 100,
          totalApprovedKg: Math.round(totalApprovedKg * 100) / 100,
          totalCookedKg: Math.round(totalCookedKg * 100) / 100,
          totalLeftoverKg: Math.round(totalLeftoverKg * 100) / 100,
          leftoverPerDiner: leftoverPerDiner !== null ? Math.round(leftoverPerDiner * 1000) / 1000 : null,
          stockoutCount,
          abnormalCount,
          excludedCount,
          missingCount,
        },
        filters: filterInput,
        records,
        dishes,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load kitchen results dashboard" };
  }
}
