"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate, toServiceDateString } from "@/lib/domain/date";

export type ServiceDiaryEventType =
  | "PLAN_CREATED"
  | "PLAN_APPROVED"
  | "CLOSEOUT_SUBMITTED"
  | "STOCKOUT"
  | "ELIGIBILITY_SUMMARY";

export type ServiceDiaryEvent = {
  id: string;
  type: ServiceDiaryEventType;
  title: string;
  detail: string;
  timestamp: string;
  actor?: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  href?: string;
};

export type ServiceDiaryData = {
  kitchenId: string;
  kitchenName: string;
  date: string;
  mealType: string;
  mealExists: boolean;
  planStatus: "NO_PLAN" | "DRAFT" | "APPROVED";
  closeoutStatus: "NOT_STARTED" | "SUBMITTED";
  events: ServiceDiaryEvent[];
};

function getLocalCalendarDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getServiceDiary(
  kitchenId: string,
  date?: string,
  mealType?: string
): Promise<
  | { success: true; data: ServiceDiaryData }
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

    const targetDateStr = date || getLocalCalendarDate();
    const serviceDate = normalizeServiceDate(targetDateStr);
    const resolvedMealType = (mealType || "LUNCH").toUpperCase();

    // Query meal with cooking plan, approver, plan items, observations, and dishes
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
          date: targetDateStr,
          mealType: resolvedMealType,
          mealExists: false,
          planStatus: "NO_PLAN",
          closeoutStatus: "NOT_STARTED",
          events: [],
        },
      };
    }

    const events: ServiceDiaryEvent[] = [];

    // 1. Resolve Plan Events
    let planStatus: "NO_PLAN" | "DRAFT" | "APPROVED" = "NO_PLAN";
    if (meal.cookingPlan) {
      const plan = meal.cookingPlan;
      const status = plan.approvalStatus || plan.status;
      planStatus = status === "APPROVED" ? "APPROVED" : "DRAFT";

      // Event 1: PLAN_CREATED / PLAN_DRAFT
      events.push({
        id: `event-plan-created-${plan.id}`,
        type: "PLAN_CREATED",
        title: "Morning Plan Drafted",
        detail: `${plan.items.length} dish items configured for ${plan.expectedDiners} expected diners.`,
        timestamp: plan.createdAt.toISOString(),
        actor: "Head Cook",
        severity: "INFO",
        href: `/kitchen/${kitchenId}/morning`,
      });

      // Event 2: PLAN_APPROVED
      if (status === "APPROVED") {
        const approverName =
          plan.firstApprover?.name || plan.firstApprover?.email || "Head Cook";
        const approvedAt = plan.firstApprovedAt || plan.updatedAt;

        events.push({
          id: `event-plan-approved-${plan.id}`,
          type: "PLAN_APPROVED",
          title: "Cooking Plan Approved",
          detail: `Production plan approved by ${approverName} for ${plan.expectedDiners} diners.`,
          timestamp: approvedAt.toISOString(),
          actor: approverName,
          severity: "SUCCESS",
          href: `/kitchen/${kitchenId}/staff-board`,
        });
      }
    }

    // 2. Resolve Closeout & Observation Events
    let closeoutStatus: "NOT_STARTED" | "SUBMITTED" = "NOT_STARTED";
    const completedObservations = meal.observations.filter(
      (o) => o.totalCookedKg !== null
    );

    if (completedObservations.length > 0) {
      closeoutStatus = "SUBMITTED";

      const actualDiners = completedObservations[0].actualDiners ?? "—";
      const totalCooked = completedObservations.reduce(
        (sum, o) => sum + (o.totalCookedKg ?? 0),
        0
      );
      const totalLeftover = completedObservations.reduce(
        (sum, o) => sum + (o.unservedLeftoverKg ?? 0),
        0
      );

      // Event 3: CLOSEOUT_SUBMITTED
      events.push({
        id: `event-closeout-${meal.id}`,
        type: "CLOSEOUT_SUBMITTED",
        title: "Service Closeout Submitted",
        detail: `Actual Diners: ${actualDiners} · ${completedObservations.length} dishes recorded (${totalCooked.toFixed(1)} kg cooked, ${totalLeftover.toFixed(1)} kg leftovers).`,
        timestamp: completedObservations[0].createdAt.toISOString(),
        actor: "Kitchen Operator",
        severity: "INFO",
        href: `/kitchen/${kitchenId}/closeout`,
      });

      // Event 4: STOCKOUT
      const stockouts = completedObservations.filter((o) => o.isStockout);
      if (stockouts.length > 0) {
        const dishNames = stockouts.map((o) => o.dish.name).join(", ");
        events.push({
          id: `event-stockout-${meal.id}`,
          type: "STOCKOUT",
          title: "Stockout Incident Recorded",
          detail: `Food ran out during service rush for: ${dishNames}.`,
          timestamp: stockouts[0].createdAt.toISOString(),
          severity: "WARNING",
          href: `/kitchen/${kitchenId}/closeout`,
        });
      }

      // Event 5: ELIGIBILITY_SUMMARY
      const eligibleCount = completedObservations.filter(
        (o) => o.eligibilityStatus === "ELIGIBLE"
      ).length;
      const excludedCount = completedObservations.length - eligibleCount;

      events.push({
        id: `event-eligibility-${meal.id}`,
        type: "ELIGIBILITY_SUMMARY",
        title: "Baseline Learning Classification",
        detail: `${eligibleCount} observations qualifying as clean training baseline (${excludedCount} excluded or review-flagged).`,
        timestamp: meal.updatedAt.toISOString(),
        severity: eligibleCount > 0 ? "SUCCESS" : "INFO",
        href: `/kitchen/${kitchenId}/results`,
      });
    }

    // Sort events in chronological order (earliest to latest)
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      success: true,
      data: {
        kitchenId,
        kitchenName: kitchen.name,
        date: targetDateStr,
        mealType: resolvedMealType,
        mealExists: true,
        planStatus,
        closeoutStatus,
        events,
      },
    };
  } catch (error) {
    console.error("Failed to generate service diary:", error);
    return { success: false, error: "Failed to generate service diary", statusCode: 500 };
  }
}
