"use server";

import { prisma } from "@/lib/prisma";
import { requireContractorAccess, requireFounder } from "@/lib/auth/session";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";
import { normalizeServiceDate, toServiceDateString } from "@/lib/domain/date";

export type OperationalExceptionType =
  | "PLAN_NOT_APPROVED"
  | "CLOSEOUT_MISSING"
  | "STOCKOUT"
  | "LOW_ELIGIBLE_HISTORY";

export type OperationalExceptionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type OperationalException = {
  kitchenId: string;
  kitchenName: string;
  type: OperationalExceptionType;
  mealType?: string;
  date?: string;
  severity: OperationalExceptionSeverity;
  href: string;
  summary: string;
};

const SEVERITY_RANK: Record<OperationalExceptionSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Helper to detect operational exceptions across an array of kitchens.
 * Keeps logic simple, transparent, and multi-tenant scoped.
 */
export async function detectOperationalExceptions(
  kitchens: { id: string; name: string }[],
  evaluationDate?: string
): Promise<OperationalException[]> {
  if (kitchens.length === 0) return [];

  const evalDateStr = evaluationDate || toServiceDateString(new Date());
  const todayMidnight = normalizeServiceDate(evalDateStr);
  const sevenDaysAgoMidnight = new Date(todayMidnight.getTime() - 7 * 24 * 60 * 60 * 1000);

  const kitchenIds = kitchens.map((k) => k.id);
  const kitchenMap = new Map(kitchens.map((k) => [k.id, k.name]));

  // 1. Query meals within the past 7 days up to evaluation date
  const recentMeals = await prisma.meal.findMany({
    where: {
      kitchenId: { in: kitchenIds },
      date: {
        gte: sevenDaysAgoMidnight,
        lte: todayMidnight,
      },
    },
    include: {
      cookingPlan: {
        select: {
          id: true,
          status: true,
          approvalStatus: true,
        },
      },
      observations: {
        select: {
          id: true,
          totalCookedKg: true,
          isStockout: true,
          dish: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  const exceptions: OperationalException[] = [];

  for (const meal of recentMeals) {
    const kName = kitchenMap.get(meal.kitchenId) || "Kitchen";
    const mealDateStr = toServiceDateString(meal.date);
    const isToday = meal.date.getTime() === todayMidnight.getTime();

    // EXCEPTION 1: PLAN_NOT_APPROVED
    // A meal for today exists where cooking plan is in DRAFT (or not approved).
    if (isToday && meal.cookingPlan) {
      const planStatus = meal.cookingPlan.approvalStatus || meal.cookingPlan.status;
      if (planStatus !== "APPROVED") {
        exceptions.push({
          kitchenId: meal.kitchenId,
          kitchenName: kName,
          type: "PLAN_NOT_APPROVED",
          mealType: meal.mealType,
          date: mealDateStr,
          severity: "HIGH",
          href: `/kitchen/${meal.kitchenId}/morning`,
          summary: `${kName}: ${meal.mealType} plan for today is in DRAFT — requires Head Cook approval.`,
        });
      }
    }

    // EXCEPTION 2: CLOSEOUT_MISSING
    // A plan was APPROVED, but no observations/actuals have been submitted.
    if (meal.cookingPlan) {
      const planStatus = meal.cookingPlan.approvalStatus || meal.cookingPlan.status;
      if (planStatus === "APPROVED") {
        const hasCompletedObservations = meal.observations.some(
          (o) => o.totalCookedKg !== null
        );

        if (!hasCompletedObservations) {
          const isPast = meal.date.getTime() < todayMidnight.getTime();
          exceptions.push({
            kitchenId: meal.kitchenId,
            kitchenName: kName,
            type: "CLOSEOUT_MISSING",
            mealType: meal.mealType,
            date: mealDateStr,
            severity: isPast ? "HIGH" : "MEDIUM",
            href: `/kitchen/${meal.kitchenId}/closeout`,
            summary: `${kName}: ${meal.mealType} closeout missing for ${mealDateStr} (plan was approved but no actuals submitted).`,
          });
        }
      }
    }

    // EXCEPTION 3: STOCKOUT
    // Any observation within the 7-day window where isStockout is true.
    for (const obs of meal.observations) {
      if (obs.isStockout) {
        const dishName = obs.dish?.name || "a dish";
        exceptions.push({
          kitchenId: meal.kitchenId,
          kitchenName: kName,
          type: "STOCKOUT",
          mealType: meal.mealType,
          date: mealDateStr,
          severity: "HIGH",
          href: `/kitchen/${meal.kitchenId}/closeout`,
          summary: `${kName}: Stockout recorded for ${dishName} on ${mealDateStr} (${meal.mealType}).`,
        });
      }
    }
  }

  // EXCEPTION 4: LOW_ELIGIBLE_HISTORY (optional check)
  // Kitchen has fewer than 3 eligible observations recorded.
  const eligibleGrouped = await prisma.observation.groupBy({
    by: ["kitchenId"],
    where: {
      kitchenId: { in: kitchenIds },
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
    _count: { _all: true },
  });

  const eligibleMap = new Map(eligibleGrouped.map((g) => [g.kitchenId, g._count._all]));

  for (const k of kitchens) {
    const count = eligibleMap.get(k.id) || 0;
    if (count < 3) {
      exceptions.push({
        kitchenId: k.id,
        kitchenName: k.name,
        type: "LOW_ELIGIBLE_HISTORY",
        date: evalDateStr,
        severity: "LOW",
        href: `/kitchen/${k.id}/forecast`,
        summary: `${k.name}: Low baseline history (${count} of 3 required eligible services recorded).`,
      });
    }
  }

  // Sort: severity descending, then date descending
  exceptions.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return exceptions;
}

/**
 * Returns operational exceptions for a specific contractor's assigned kitchens.
 * Multi-tenant safe: Enforces requireContractorAccess.
 */
export async function getContractorExceptions(
  contractorIdOrCode: string,
  date?: string
): Promise<
  | { success: true; data: OperationalException[] }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireContractorAccess(contractorIdOrCode);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  const trimmed = contractorIdOrCode.trim();
  const isCode = isContractorCode(trimmed);

  try {
    const contractor = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmed)! } : { id: trimmed },
      select: {
        id: true,
        kitchens: {
          select: { id: true, name: true, status: true },
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!contractor) {
      return { success: false, error: "Contractor organization not found", statusCode: 404 };
    }

    const exceptions = await detectOperationalExceptions(contractor.kitchens, date);
    return { success: true, data: exceptions };
  } catch (error) {
    console.error("Failed to fetch contractor exceptions:", error);
    return { success: false, error: "Failed to evaluate contractor exceptions", statusCode: 500 };
  }
}

/**
 * Returns platform-wide operational exceptions across all active kitchens.
 * Security: Enforces requireFounder.
 */
export async function getPlatformExceptions(
  date?: string
): Promise<
  | { success: true; data: OperationalException[] }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  try {
    const kitchens = await prisma.kitchen.findMany({
      select: { id: true, name: true, status: true },
      where: { status: "ACTIVE" },
    });

    const exceptions = await detectOperationalExceptions(kitchens, date);
    return { success: true, data: exceptions };
  } catch (error) {
    console.error("Failed to fetch platform exceptions:", error);
    return { success: false, error: "Failed to evaluate platform exceptions", statusCode: 500 };
  }
}
