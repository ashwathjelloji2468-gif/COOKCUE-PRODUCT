"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder, requireKitchenAccess } from "@/lib/auth/session";

export type FounderNotificationItem = {
  id: string;
  timestamp: string; // ISO string
  type:
    | "STOCKOUT"
    | "ABNORMAL"
    | "CLOSEOUT"
    | "CONTRACTOR"
    | "APPLICATION"
    | "ADJUSTMENT";
  title: string;
  summary: string;
  kitchenName?: string | null;
  contractorName?: string | null;
  href?: string | null;
  severity: "normal" | "warning" | "danger" | "success";
};

export async function getFounderNotifications(limit: number = 15): Promise<{
  success: boolean;
  notifications: FounderNotificationItem[];
  error?: string;
}> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, notifications: [], error: auth.error };
  }

  try {
    const [observations, observationAudits, contractors, applications] =
      await Promise.all([
        // 1. Observations (Stockouts, Abnormals, and recent Closeouts)
        prisma.observation.findMany({
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            kitchen: { select: { id: true, name: true } },
            dish: { select: { id: true, name: true } },
            meal: { select: { id: true, date: true, mealType: true } },
          },
        }),

        // 2. Observation Audits (Adjustments to service logs)
        prisma.observationAudit.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            observation: {
              include: {
                kitchen: { select: { id: true, name: true } },
                dish: { select: { id: true, name: true } },
              },
            },
          },
        }),

        // 3. Contractor status updates
        prisma.contractor.findMany({
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
            createdAt: true,
          },
        }),

        // 4. Onboarding application status updates
        prisma.onboardingApplication.findMany({
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            type: true,
            status: true,
            applicantName: true,
            applicantEmail: true,
            contractorName: true,
            kitchenName: true,
            updatedAt: true,
            createdAt: true,
          },
        }),
      ]);

    const items: FounderNotificationItem[] = [];

    // Map Observations
    for (const obs of observations) {
      if (obs.isStockout) {
        items.push({
          id: `notif-stockout-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "STOCKOUT",
          title: `Stockout: ${obs.dish.name}`,
          summary: `Stockout logged at ${obs.kitchen.name} during ${obs.meal.mealType}`,
          kitchenName: obs.kitchen.name,
          href: `/founder/kitchens/${obs.kitchen.id}`,
          severity: "danger",
        });
      } else if (obs.isAbnormal) {
        items.push({
          id: `notif-abnormal-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "ABNORMAL",
          title: `Abnormal Service: ${obs.dish.name}`,
          summary: `Abnormal attendance or consumption flag at ${obs.kitchen.name}`,
          kitchenName: obs.kitchen.name,
          href: "/founder/monitoring",
          severity: "warning",
        });
      } else {
        items.push({
          id: `notif-closeout-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "CLOSEOUT",
          title: `Closeout: ${obs.dish.name}`,
          summary: `${obs.totalCookedKg ?? 0}kg cooked at ${obs.kitchen.name} (${obs.meal.mealType})`,
          kitchenName: obs.kitchen.name,
          href: `/founder/kitchens/${obs.kitchen.id}`,
          severity: "normal",
        });
      }
    }

    // Map Observation Audits
    for (const audit of observationAudits) {
      items.push({
        id: `notif-audit-${audit.id}`,
        timestamp: audit.createdAt.toISOString(),
        type: "ADJUSTMENT",
        title: `Service Adjusted: ${audit.observation.dish.name}`,
        summary: `Adjusted at ${audit.observation.kitchen.name}: "${audit.reason}"`,
        kitchenName: audit.observation.kitchen.name,
        href: "/founder/audit-log",
        severity: "warning",
      });
    }

    // Map Contractor status changes
    for (const c of contractors) {
      const isRecent = c.updatedAt.toISOString();
      items.push({
        id: `notif-contractor-${c.id}-${c.status}`,
        timestamp: isRecent,
        type: "CONTRACTOR",
        title: `Contractor: ${c.name}`,
        summary: `Contractor organization status: ${c.status}`,
        contractorName: c.name,
        href: `/founder/contractors/${c.id}`,
        severity: c.status === "ACTIVE" ? "success" : "normal",
      });
    }

    // Map Onboarding Applications
    for (const app of applications) {
      const orgOrName = app.contractorName || app.applicantName || app.applicantEmail;
      let severity: FounderNotificationItem["severity"] = "normal";
      if (app.status === "APPROVED" || app.status === "ACTIVATED" || app.status === "ACTIVE") {
        severity = "success";
      } else if (app.status === "REJECTED") {
        severity = "danger";
      } else if (app.status === "PENDING_FOUNDER_REVIEW") {
        severity = "warning";
      }

      items.push({
        id: `notif-app-${app.id}-${app.status}`,
        timestamp: app.updatedAt.toISOString(),
        type: "APPLICATION",
        title: `${app.type.replace(/_/g, " ")} Application`,
        summary: `${orgOrName} — ${app.status.replace(/_/g, " ")}`,
        contractorName: app.contractorName,
        kitchenName: app.kitchenName,
        href: `/founder/applications/${app.id}`,
        severity,
      });
    }

    // Sort newest first
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      success: true,
      notifications: items.slice(0, Math.min(limit, 20)),
    };
  } catch (error) {
    console.error("Failed to fetch founder notifications:", error);
    return {
      success: false,
      notifications: [],
      error: "Failed to fetch notifications from database",
    };
  }
}

export type KitchenNotificationItem = {
  id: string;
  timestamp: string;
  type: "STOCKOUT" | "ABNORMAL" | "CLOSEOUT" | "PLAN";
  title: string;
  summary: string;
  href?: string | null;
  severity: "normal" | "warning" | "danger" | "success";
};

export async function getKitchenNotifications(
  kitchenId: string,
  limit: number = 10
): Promise<{
  success: boolean;
  notifications: KitchenNotificationItem[];
  error?: string;
}> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, notifications: [], error: auth.error };
  }

  try {
    const [observations, plans] = await Promise.all([
      prisma.observation.findMany({
        where: { kitchenId },
        take: 15,
        orderBy: { createdAt: "desc" },
        include: {
          dish: { select: { id: true, name: true } },
          meal: { select: { id: true, date: true, mealType: true } },
        },
      }),
      prisma.cookingPlan.findMany({
        where: { kitchenId },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          meal: { select: { id: true, date: true, mealType: true } },
        },
      }),
    ]);

    const items: KitchenNotificationItem[] = [];

    // Map Observations
    for (const obs of observations) {
      if (obs.isStockout) {
        items.push({
          id: `notif-stockout-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "STOCKOUT",
          title: `Stockout: ${obs.dish.name}`,
          summary: `Stockout logged for ${obs.meal.mealType} on ${obs.meal.date}`,
          href: `/kitchen/${kitchenId}/closeout`,
          severity: "danger",
        });
      } else if (obs.isAbnormal) {
        items.push({
          id: `notif-abnormal-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "ABNORMAL",
          title: `Abnormal Flag: ${obs.dish.name}`,
          summary: `Service disruption logged for ${obs.meal.mealType} on ${obs.meal.date}`,
          href: `/kitchen/${kitchenId}/results`,
          severity: "warning",
        });
      } else {
        items.push({
          id: `notif-closeout-${obs.id}`,
          timestamp: obs.createdAt.toISOString(),
          type: "CLOSEOUT",
          title: `Closeout: ${obs.dish.name}`,
          summary: `${obs.totalCookedKg ?? 0}kg cooked for ${obs.meal.mealType}`,
          href: `/kitchen/${kitchenId}/results`,
          severity: "normal",
        });
      }
    }

    // Map Plans
    for (const plan of plans) {
      items.push({
        id: `notif-plan-${plan.id}-${plan.status}`,
        timestamp: plan.updatedAt.toISOString(),
        type: "PLAN",
        title: `Plan ${plan.status}: ${plan.meal.mealType}`,
        summary: `${plan.meal.mealType} meal plan for ${plan.meal.date} (${plan.expectedDiners} diners)`,
        href: `/kitchen/${kitchenId}/morning`,
        severity: plan.status === "APPROVED" ? "success" : "normal",
      });
    }

    // Sort newest first
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      success: true,
      notifications: items.slice(0, Math.min(limit, 20)),
    };
  } catch (error) {
    console.error("Failed to fetch kitchen notifications:", error);
    return {
      success: false,
      notifications: [],
      error: "Failed to fetch notifications from database",
    };
  }
}
