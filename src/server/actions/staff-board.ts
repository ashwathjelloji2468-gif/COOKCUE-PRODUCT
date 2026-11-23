"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";
import { safeRevalidatePath } from "@/lib/cache/revalidate";

const ALLOWED_STAFF_BOARD_ROLES = ["HEAD_COOK", "KITCHEN_STAFF", "FOUNDER"];

export type StaffReportType = "PROGRESS" | "QUANTITY_REPORT" | "PROBLEM";

export type StaffBoardData = {
  kitchen: {
    id: string;
    name: string;
    location: string | null;
  };
  date: string;
  currentUser: {
    id: string;
    name: string | null;
    role: string;
    isHeadCook: boolean;
  };
  approvedPlan: {
    isApproved: boolean;
    mealId: string | null;
    mealType: string;
    expectedDiners: number;
    instructions: string | null;
    approverName: string | null;
    approverRole: string | null;
    approvedAt: Date | null;
    items: {
      dishId: string;
      dishName: string;
      unit: string;
      approvedKg: number | null;
      recommendedKg: number | null;
      allergenTags?: string[];
      menuCycleLabel?: string | null;
    }[];
  } | null;
  staffMembers: {
    id: string;
    code: string | null;
    name: string | null;
    email: string;
    role: string;
  }[];
  reports: {
    id: string;
    type: StaffReportType;
    title: string | null;
    content: string;
    dishId: string | null;
    quantityKg: number | null;
    flagged: boolean;
    resolved: boolean;
    createdAt: Date;
    createdBy: {
      id: string;
      code: string | null;
      name: string | null;
      role: string;
    };
  }[];
};

/**
 * Fetch staff operational board data for a given kitchen and date.
 * Enforces kitchen assignment and operator roles.
 */
export async function getStaffBoardData(
  kitchenId: string,
  dateStr?: string,
  mealType: string = "LUNCH"
): Promise<{ success: true; data: StaffBoardData } | { success: false; error: string; statusCode?: number }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  if (!ALLOWED_STAFF_BOARD_ROLES.includes(auth.user.role)) {
    return {
      success: false,
      error: "Forbidden: Only kitchen staff, head cooks, or founders can access the staff board.",
      statusCode: 403,
    };
  }

  const queryDate = dateStr || new Date().toISOString().slice(0, 10);
  const normalizedDate = normalizeServiceDate(queryDate);
  const effectiveMealType = (mealType || "LUNCH").toUpperCase();

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true, location: true },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen facility not found", statusCode: 404 };
    }

    // 1. Fetch today's meal & cooking plan
    const meal = await prisma.meal.findFirst({
      where: {
        kitchenId,
        date: normalizedDate,
        mealType: effectiveMealType,
      },
      include: {
        cookingPlan: {
          include: {
            items: {
              include: { dish: true },
              orderBy: { dish: { name: "asc" } },
            },
            firstApprover: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    let approvedPlan: StaffBoardData["approvedPlan"] = null;

    if (meal?.cookingPlan) {
      const plan = meal.cookingPlan;
      const isApproved = plan.approvalStatus === "APPROVED" || plan.status === "APPROVED";

      approvedPlan = {
        isApproved,
        mealId: meal.id,
        mealType: meal.mealType,
        expectedDiners: plan.expectedDiners,
        instructions: plan.instructions,
        approverName: plan.firstApprover?.name || plan.firstApprover?.email || "Head Cook",
        approverRole: plan.firstApprover?.role || "HEAD_COOK",
        approvedAt: plan.firstApprovedAt,
        items: plan.items.map((i) => ({
          dishId: i.dishId,
          dishName: i.dish.name,
          unit: i.dish.unit || "kg",
          approvedKg: i.approvedKg,
          recommendedKg: i.recommendedKg,
          allergenTags: i.dish.allergenTags || [],
          menuCycleLabel: i.dish.menuCycleLabel || null,
        })),
      };
    }

    // 2. Fetch live staff assignments for this kitchen
    const staffMembers = await prisma.user.findMany({
      where: {
        kitchenId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    // 3. Fetch staff task/progress reports for this service date
    const reports = await prisma.staffReport.findMany({
      where: {
        kitchenId,
        date: normalizedDate,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            code: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: {
        kitchen: {
          id: kitchen.id,
          name: kitchen.name,
          location: kitchen.location,
        },
        date: queryDate,
        currentUser: {
          id: auth.user.id,
          name: auth.user.name,
          role: auth.user.role,
          isHeadCook: auth.user.role === "HEAD_COOK" || auth.user.role === "FOUNDER",
        },
        approvedPlan,
        staffMembers,
        reports: reports.map((r) => ({
          id: r.id,
          type: r.type as StaffReportType,
          title: r.title,
          content: r.content,
          dishId: r.dishId,
          quantityKg: r.quantityKg,
          flagged: r.flagged,
          resolved: r.resolved,
          createdAt: r.createdAt,
          createdBy: r.createdBy,
        })),
      },
    };
  } catch (error) {
    console.error("Failed to load staff board data:", error);
    return { success: false, error: "Failed to load staff board data" };
  }
}

/**
 * Submit a staff progress report, quantity log, or problem alert.
 * Staff cannot approve plans, but can submit live reports.
 */
export async function createStaffReport(input: {
  kitchenId: string;
  date: string;
  type: StaffReportType;
  content: string;
  title?: string;
  dishId?: string;
  quantityKg?: number;
}): Promise<{ success: true; reportId: string } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(input.kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  if (!ALLOWED_STAFF_BOARD_ROLES.includes(auth.user.role)) {
    return { success: false, error: "Unauthorized: only kitchen operators can submit staff reports." };
  }

  const content = input.content?.trim();
  if (!content || content.length < 2) {
    return { success: false, error: "Report message must contain at least 2 characters." };
  }

  try {
    const report = await prisma.staffReport.create({
      data: {
        kitchenId: input.kitchenId,
        date: normalizeServiceDate(input.date),
        type: input.type,
        title: input.title?.trim() || null,
        content,
        dishId: input.dishId || null,
        quantityKg: input.quantityKg !== undefined && !Number.isNaN(input.quantityKg) ? input.quantityKg : null,
        flagged: input.type === "PROBLEM",
        createdById: auth.user.id,
      },
    });

    safeRevalidatePath(`/kitchen/${input.kitchenId}/staff-board`);

    return { success: true, reportId: report.id };
  } catch (e) {
    return { success: false, error: "Failed to save staff report" };
  }
}

/**
 * Update Head Cook operational instructions on the cooking plan.
 * Strictly restricted to HEAD_COOK and FOUNDER.
 */
export async function updateHeadCookInstructions(
  kitchenId: string,
  mealId: string,
  instructions: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  if (auth.user.role !== "HEAD_COOK" && auth.user.role !== "FOUNDER") {
    return {
      success: false,
      error: "Unauthorized: Only Head Cooks (or Founder) can set operational instructions for kitchen staff.",
    };
  }

  const plan = await prisma.cookingPlan.findUnique({ where: { mealId } });
  if (!plan || plan.kitchenId !== kitchenId) {
    return {
      success: false,
      error: "Forbidden: Cooking plan does not belong to this facility",
    };
  }

  try {
    await prisma.cookingPlan.update({
      where: { mealId },
      data: { instructions: instructions.trim() || null },
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/staff-board`);
    safeRevalidatePath(`/kitchen/${kitchenId}/morning`);

    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to update instructions" };
  }
}

/**
 * Mark a flagged problem report as resolved.
 */
export async function resolveStaffReport(
  kitchenId: string,
  reportId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const report = await prisma.staffReport.findUnique({
      where: { id: reportId },
    });
    if (!report || report.kitchenId !== kitchenId) {
      return {
        success: false,
        error: "Forbidden: Staff report does not belong to this facility",
      };
    }

    await prisma.staffReport.update({
      where: { id: reportId },
      data: { resolved: true },
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/staff-board`);

    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to resolve staff report" };
  }
}

export type StaffBoardPrintData = {
  kitchenId: string;
  kitchenName: string;
  location: string | null;
  date: string;
  mealType: string;
  isApproved: boolean;
  expectedDiners: number | null;
  approverName: string | null;
  approverRole: string | null;
  approvedAt: string | null;
  instructions: string | null;
  items: {
    dishId: string;
    dishName: string;
    unit: string;
    approvedKg: number | null;
    recommendedKg: number | null;
    allergenTags?: string[];
    menuCycleLabel?: string | null;
  }[];
};

/**
 * Wave 2 / T2-C: Print-friendly staff board production targets.
 * Thin read-only wrapper ensuring kitchen access and only returning targets when plan is APPROVED.
 */
export async function getStaffBoardPrintData(
  kitchenId: string,
  dateStr?: string,
  mealType: string = "LUNCH"
): Promise<{ success: true; data: StaffBoardPrintData } | { success: false; error: string; statusCode?: number }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  const queryDate = dateStr || new Date().toISOString().slice(0, 10);
  const normalizedDate = normalizeServiceDate(queryDate);
  const effectiveMealType = (mealType || "LUNCH").toUpperCase();

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true, location: true },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen facility not found", statusCode: 404 };
    }

    const meal = await prisma.meal.findFirst({
      where: {
        kitchenId,
        date: normalizedDate,
        mealType: effectiveMealType,
      },
      include: {
        cookingPlan: {
          include: {
            items: {
              include: { dish: true },
              orderBy: { dish: { name: "asc" } },
            },
            firstApprover: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!meal || !meal.cookingPlan) {
      return {
        success: true,
        data: {
          kitchenId,
          kitchenName: kitchen.name,
          location: kitchen.location,
          date: queryDate,
          mealType: effectiveMealType,
          isApproved: false,
          expectedDiners: null,
          approverName: null,
          approverRole: null,
          approvedAt: null,
          instructions: null,
          items: [],
        },
      };
    }

    const plan = meal.cookingPlan;
    const isApproved = plan.approvalStatus === "APPROVED" || plan.status === "APPROVED";

    if (!isApproved) {
      return {
        success: true,
        data: {
          kitchenId,
          kitchenName: kitchen.name,
          location: kitchen.location,
          date: queryDate,
          mealType: effectiveMealType,
          isApproved: false,
          expectedDiners: plan.expectedDiners,
          approverName: null,
          approverRole: null,
          approvedAt: null,
          instructions: plan.instructions,
          items: [],
        },
      };
    }

    return {
      success: true,
      data: {
        kitchenId,
        kitchenName: kitchen.name,
        location: kitchen.location,
        date: queryDate,
        mealType: effectiveMealType,
        isApproved: true,
        expectedDiners: plan.expectedDiners,
        approverName: plan.firstApprover?.name || plan.firstApprover?.email || "Head Cook",
        approverRole: plan.firstApprover?.role || "HEAD_COOK",
        approvedAt: plan.firstApprovedAt ? plan.firstApprovedAt.toISOString() : null,
        instructions: plan.instructions,
        items: plan.items.map((i) => ({
          dishId: i.dishId,
          dishName: i.dish.name,
          unit: i.dish.unit || "kg",
          approvedKg: i.approvedKg,
          recommendedKg: i.recommendedKg,
          allergenTags: i.dish.allergenTags || [],
          menuCycleLabel: i.dish.menuCycleLabel || null,
        })),
      },
    };
  } catch (err) {
    console.error("Failed to load staff board print data:", err);
    return { success: false, error: "Failed to load staff board print targets", statusCode: 500 };
  }
}
