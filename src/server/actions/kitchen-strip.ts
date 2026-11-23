"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";
import {
  formatRelativeTime,
  formatExactDateTime,
  isBaselineReady,
} from "@/lib/kitchen/reliability";

export type KitchenTodayStripData = {
  date: string;
  mealType: string;
  expectedDiners: number | null;
  planStatus: "NO_PLAN" | "DRAFT" | "APPROVED";
  closeoutStatus: "NOT_STARTED" | "SUBMITTED";
  mealId: string | null;
  lastCloseoutAt: string | null;
  lastCloseoutRelative: string;
  lastCloseoutExact: string | null;
  isBaselineReady: boolean;
  nextAction: {
    label: string;
    href: string;
    type: "MORNING" | "APPROVE" | "CLOSEOUT" | "RESULTS";
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

export async function getKitchenTodayStrip(
  kitchenId: string,
  date?: string,
  mealType?: string
): Promise<
  | { success: true; data: KitchenTodayStripData }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const todayDateStr = date || getLocalCalendarDate();
    const serviceDate = normalizeServiceDate(todayDateStr);
    const resolvedMealType = (
      mealType || getDefaultMealTypeForHour(new Date().getHours())
    ).toUpperCase();

    // Query read-only meal, cooking plan, observation status, and reliability signals
    const [meal, lastCloseoutObs, eligibleCount] = await Promise.all([
      prisma.meal.findFirst({
        where: {
          kitchenId,
          mealType: resolvedMealType,
          date: serviceDate,
        },
        include: {
          cookingPlan: {
            select: {
              id: true,
              status: true,
              approvalStatus: true,
              expectedDiners: true,
            },
          },
          observations: {
            where: { totalCookedKg: { not: null } },
            select: { id: true },
          },
        },
      }),
      prisma.observation.findFirst({
        where: {
          kitchenId,
          totalCookedKg: { not: null },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.observation.count({
        where: {
          kitchenId,
          OR: [
            { eligibilityStatus: "ELIGIBLE" },
            {
              eligibilityStatus: "",
              isStockout: false,
              isAbnormal: false,
              isExcluded: false,
              totalCookedKg: { not: null },
              unservedLeftoverKg: { not: null },
              actualDiners: { not: null, gt: 0 },
            },
          ],
        },
      }),
    ]);

    // 1. Resolve Plan Status
    let planStatus: "NO_PLAN" | "DRAFT" | "APPROVED" = "NO_PLAN";
    if (meal?.cookingPlan) {
      const status = meal.cookingPlan.approvalStatus || meal.cookingPlan.status;
      planStatus = status === "APPROVED" ? "APPROVED" : "DRAFT";
    }

    // 2. Resolve Closeout Status
    let closeoutStatus: "NOT_STARTED" | "SUBMITTED" = "NOT_STARTED";
    if (meal && meal.observations && meal.observations.length > 0) {
      closeoutStatus = "SUBMITTED";
    }

    // 3. Resolve Expected Diners
    const expectedDiners =
      meal?.cookingPlan?.expectedDiners ?? meal?.expectedDiners ?? null;

    // 4. Resolve Freshness & Reliability Signals
    const lastCloseoutDate = lastCloseoutObs?.createdAt ?? null;
    const lastCloseoutRelative = formatRelativeTime(lastCloseoutDate, "No closeout yet");
    const lastCloseoutExact = formatExactDateTime(lastCloseoutDate);
    const baselineReady = isBaselineReady(eligibleCount);

    // 5. Determine Next Needed Action
    let nextAction: KitchenTodayStripData["nextAction"];
    if (planStatus === "NO_PLAN") {
      nextAction = {
        label: "Set Morning Plan",
        href: `/kitchen/${kitchenId}/morning`,
        type: "MORNING",
      };
    } else if (planStatus === "DRAFT") {
      nextAction = {
        label: "Review & Approve Plan",
        href: `/kitchen/${kitchenId}/morning`,
        type: "APPROVE",
      };
    } else if (planStatus === "APPROVED" && closeoutStatus === "NOT_STARTED") {
      nextAction = {
        label: "Record Evening Closeout",
        href: `/kitchen/${kitchenId}/closeout`,
        type: "CLOSEOUT",
      };
    } else {
      nextAction = {
        label: "View Service Results",
        href: `/kitchen/${kitchenId}/results`,
        type: "RESULTS",
      };
    }

    return {
      success: true,
      data: {
        date: todayDateStr,
        mealType: resolvedMealType,
        expectedDiners,
        planStatus,
        closeoutStatus,
        mealId: meal?.id ?? null,
        lastCloseoutAt: lastCloseoutDate ? lastCloseoutDate.toISOString() : null,
        lastCloseoutRelative,
        lastCloseoutExact,
        isBaselineReady: baselineReady,
        nextAction,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load kitchen today strip" };
  }
}
