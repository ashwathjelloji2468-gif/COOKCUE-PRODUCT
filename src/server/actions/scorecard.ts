"use server";

import { prisma } from "@/lib/prisma";
import { requireContractorAccess, requireFounder } from "@/lib/auth/session";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";
import { normalizeServiceDate, toServiceDateString } from "@/lib/domain/date";
import { detectOperationalExceptions } from "./exceptions";
import {
  ContractorWeeklyScorecard,
  KitchenWeeklyScorecard,
  RawMealForScorecard,
  computeKitchenWeeklyMetrics,
  sortKitchenScorecards,
} from "@/lib/domain/scorecard";

export type { ContractorWeeklyScorecard, KitchenWeeklyScorecard };

/**
 * Calculates a weekly operational scorecard for a contractor's assigned kitchens.
 * Week window is the 7-day period ending on `weekEndingDate` (or today).
 * Multi-tenant safe: Enforces requireContractorAccess.
 */
export async function getContractorWeeklyScorecard(
  contractorIdOrCode: string,
  weekEndingDate?: string
): Promise<
  | { success: true; data: ContractorWeeklyScorecard }
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
      include: {
        kitchens: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!contractor) {
      return { success: false, error: "Contractor organization not found", statusCode: 404 };
    }

    // 7-day calendar window normalized to UTC Midnight
    const evalDateStr = weekEndingDate
      ? toServiceDateString(weekEndingDate)
      : toServiceDateString(new Date());
    const weekEndDate = normalizeServiceDate(evalDateStr);
    const weekStartDate = new Date(weekEndDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekStartStr = toServiceDateString(weekStartDate);
    const weekEndStr = evalDateStr;

    if (contractor.kitchens.length === 0) {
      return {
        success: true,
        data: {
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          contractor: {
            id: contractor.id,
            code: contractor.code,
            name: contractor.name,
          },
          kitchens: [],
        },
      };
    }

    const kitchenIds = contractor.kitchens.map((k) => k.id);

    // Fetch all meals and observations in 1 query for all kitchens in this 7-day window
    const [meals, exceptions] = await Promise.all([
      prisma.meal.findMany({
        where: {
          kitchenId: { in: kitchenIds },
          date: {
            gte: weekStartDate,
            lte: weekEndDate,
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
              isStockout: true,
              isAbnormal: true,
              isExcluded: true,
              totalCookedKg: true,
              unservedLeftoverKg: true,
              actualDiners: true,
              eligibilityStatus: true,
            },
          },
        },
      }),
      detectOperationalExceptions(
        contractor.kitchens.map((k) => ({ id: k.id, name: k.name })),
        weekEndStr
      ),
    ]);

    // Group meals by kitchenId
    const mealsByKitchen = new Map<string, RawMealForScorecard[]>();
    for (const m of meals) {
      const list = mealsByKitchen.get(m.kitchenId) || [];
      list.push(m as RawMealForScorecard);
      mealsByKitchen.set(m.kitchenId, list);
    }

    // Group exceptions by kitchenId
    const exceptionsByKitchen = new Map<string, number>();
    for (const exc of exceptions) {
      exceptionsByKitchen.set(exc.kitchenId, (exceptionsByKitchen.get(exc.kitchenId) || 0) + 1);
    }

    // Compute metrics per kitchen
    const scorecardKitchens: KitchenWeeklyScorecard[] = contractor.kitchens.map((k) => {
      const kitchenMeals = mealsByKitchen.get(k.id) || [];
      const openExceptionsCount = exceptionsByKitchen.get(k.id) || 0;
      return computeKitchenWeeklyMetrics({
        kitchen: k,
        meals: kitchenMeals,
        openExceptionsCount,
      });
    });

    // Sort: worst closeoutCompliance first, then most stockouts
    const sorted = sortKitchenScorecards(scorecardKitchens);

    return {
      success: true,
      data: {
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        contractor: {
          id: contractor.id,
          code: contractor.code,
          name: contractor.name,
        },
        kitchens: sorted,
      },
    };
  } catch (error) {
    console.error("Error computing contractor weekly scorecard:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load weekly scorecard",
      statusCode: 500,
    };
  }
}

/**
 * Optional Platform-wide weekly scorecard for Founder monitoring.
 * Guarded by requireFounder.
 */
export async function getPlatformWeeklyScorecard(weekEndingDate?: string): Promise<
  | { success: true; data: { weekStart: string; weekEnd: string; kitchens: KitchenWeeklyScorecard[] } }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  try {
    const kitchens = await prisma.kitchen.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    const evalDateStr = weekEndingDate
      ? toServiceDateString(weekEndingDate)
      : toServiceDateString(new Date());
    const weekEndDate = normalizeServiceDate(evalDateStr);
    const weekStartDate = new Date(weekEndDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekStartStr = toServiceDateString(weekStartDate);
    const weekEndStr = evalDateStr;

    if (kitchens.length === 0) {
      return {
        success: true,
        data: {
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          kitchens: [],
        },
      };
    }

    const kitchenIds = kitchens.map((k) => k.id);
    const [meals, exceptions] = await Promise.all([
      prisma.meal.findMany({
        where: {
          kitchenId: { in: kitchenIds },
          date: {
            gte: weekStartDate,
            lte: weekEndDate,
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
              isStockout: true,
              isAbnormal: true,
              isExcluded: true,
              totalCookedKg: true,
              unservedLeftoverKg: true,
              actualDiners: true,
              eligibilityStatus: true,
            },
          },
        },
      }),
      detectOperationalExceptions(
        kitchens.map((k) => ({ id: k.id, name: k.name })),
        weekEndStr
      ),
    ]);

    const mealsByKitchen = new Map<string, RawMealForScorecard[]>();
    for (const m of meals) {
      const list = mealsByKitchen.get(m.kitchenId) || [];
      list.push(m as RawMealForScorecard);
      mealsByKitchen.set(m.kitchenId, list);
    }

    const exceptionsByKitchen = new Map<string, number>();
    for (const exc of exceptions) {
      exceptionsByKitchen.set(exc.kitchenId, (exceptionsByKitchen.get(exc.kitchenId) || 0) + 1);
    }

    const scorecardKitchens: KitchenWeeklyScorecard[] = kitchens.map((k) => {
      const kitchenMeals = mealsByKitchen.get(k.id) || [];
      const openExceptionsCount = exceptionsByKitchen.get(k.id) || 0;
      return computeKitchenWeeklyMetrics({
        kitchen: k,
        meals: kitchenMeals,
        openExceptionsCount,
      });
    });

    const sorted = sortKitchenScorecards(scorecardKitchens);

    return {
      success: true,
      data: {
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        kitchens: sorted,
      },
    };
  } catch (error) {
    console.error("Error computing platform weekly scorecard:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load platform weekly scorecard",
      statusCode: 500,
    };
  }
}

/**
 * Generates an operational PDF export of a contractor's weekly scorecard.
 * Returns base64 payload and filename for direct download.
 */
export async function getContractorWeeklyScorecardPdf(
  contractorIdOrCode: string,
  weekEndingDate?: string
): Promise<
  | { success: true; data: { base64: string; filename: string; contentType: string } }
  | { success: false; error: string; statusCode?: number }
> {
  const scorecardRes = await getContractorWeeklyScorecard(contractorIdOrCode, weekEndingDate);
  if (!scorecardRes.success) {
    return scorecardRes;
  }

  try {
    const { generateWeeklyScorecardPdfBuffer } = await import("@/lib/pdf/weekly-report");
    const buffer = await generateWeeklyScorecardPdfBuffer(scorecardRes.data);
    const safeCode = scorecardRes.data.contractor.code || "CTR";
    const filename = `CookCue-Weekly-Report-${safeCode}-${scorecardRes.data.weekEnd}.pdf`;

    return {
      success: true,
      data: {
        base64: buffer.toString("base64"),
        filename,
        contentType: "application/pdf",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to generate weekly scorecard PDF",
      statusCode: 500,
    };
  }
}
