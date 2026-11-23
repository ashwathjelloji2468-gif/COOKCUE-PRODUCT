"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { isObservationEligible } from "@/lib/domain/scorecard";
import {
  KitchenOnboardingProgress,
  deriveKitchenOnboardingProgress,
} from "@/lib/domain/kitchen-onboarding";

export type { KitchenOnboardingProgress };

/**
 * Derives operational onboarding progress for a kitchen facility from real database records.
 * Guarded by requireKitchenAccess(kitchenId).
 */
export async function getKitchenOnboardingProgress(
  kitchenId: string
): Promise<
  | { success: true; data: KitchenOnboardingProgress }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen not found", statusCode: 404 };
    }

    // Parallel queries for all milestone indicators
    const [dishesCount, templatesCount, approvedPlansCount, observations] =
      await Promise.all([
        prisma.dish.count({
          where: { kitchenId },
        }),
        prisma.kitchenServiceTemplate.count({
          where: { kitchenId },
        }),
        prisma.cookingPlan.count({
          where: {
            kitchenId,
            OR: [
              { status: "APPROVED" },
              { approvalStatus: "APPROVED" },
            ],
          },
        }),
        prisma.observation.findMany({
          where: { kitchenId },
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
        }),
      ]);

    const closeoutObservationsCount = observations.length;
    const eligibleObservationsCount = observations.filter(isObservationEligible).length;

    const progress = deriveKitchenOnboardingProgress({
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
      dishesCount,
      templatesCount,
      approvedPlansCount,
      closeoutObservationsCount,
      eligibleObservationsCount,
    });

    return {
      success: true,
      data: progress,
    };
  } catch (error) {
    console.error("Error computing kitchen onboarding progress:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load onboarding progress",
      statusCode: 500,
    };
  }
}
