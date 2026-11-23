"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";
import { safeRevalidatePath } from "@/lib/cache/revalidate";

export type ProcurementIndentStatus = "DRAFT" | "REQUESTED" | "CANCELLED";

export type ProcurementIndentLineDetail = {
  id: string;
  indentId: string;
  dishId: string | null;
  dishName: string;
  targetKg: number;
  unit: string;
  allergenTags: string[];
  menuCycleLabel: string | null;
  sortOrder: number;
};

export type ProcurementIndentDetail = {
  id: string;
  kitchenId: string;
  kitchenName: string;
  mealId: string;
  mealType: string;
  date: string;
  status: ProcurementIndentStatus;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  requestedAt: string | null;
  lines: ProcurementIndentLineDetail[];
};

/**
 * WAVE 3 / T3-D: Cooking Plan -> Procurement Indent
 * Generates a procurement request list directly from an APPROVED cooking plan.
 * Rejects draft or missing plans.
 */
export async function createIndentFromApprovedPlan(
  kitchenId: string,
  mealId: string
): Promise<{ success: true; indentId: string; status: ProcurementIndentStatus } | { success: false; error: string; indentId?: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const meal = await prisma.meal.findFirst({
      where: { id: mealId, kitchenId },
      include: {
        kitchen: { select: { id: true, name: true } },
        cookingPlan: {
          include: {
            items: {
              include: { dish: true },
              orderBy: { dish: { name: "asc" } },
            },
          },
        },
      },
    });

    if (!meal) {
      return { success: false, error: "Meal service record not found" };
    }

    if (!meal.cookingPlan) {
      return { success: false, error: "No cooking plan exists for this meal service" };
    }

    const isApproved =
      meal.cookingPlan.approvalStatus === "APPROVED" || meal.cookingPlan.status === "APPROVED";

    if (!isApproved) {
      return {
        success: false,
        error: "Cannot create procurement indent from an unapproved cooking plan (DRAFT)",
      };
    }

    if (meal.cookingPlan.items.length === 0) {
      return { success: false, error: "Cooking plan contains no items" };
    }

    // Lifecycle check for existing indent for this meal
    const existingIndent = await prisma.procurementIndent.findFirst({
      where: { mealId, kitchenId },
      orderBy: { createdAt: "desc" },
    });

    if (existingIndent && existingIndent.status === "REQUESTED") {
      return {
        success: false,
        error: "A procurement indent has already been marked as REQUESTED for this meal service",
        indentId: existingIndent.id,
      };
    }

    // If an active DRAFT exists, refresh its lines with the latest approved targets
    if (existingIndent && existingIndent.status === "DRAFT") {
      await prisma.$transaction(async (tx) => {
        await tx.procurementIndentLine.deleteMany({
          where: { indentId: existingIndent.id },
        });

        await tx.procurementIndentLine.createMany({
          data: meal.cookingPlan!.items.map((item, idx) => ({
            indentId: existingIndent.id,
            dishId: item.dishId,
            dishName: item.dish.name,
            targetKg: item.approvedKg ?? item.recommendedKg ?? 0,
            unit: item.dish.unit || "kg",
            allergenTags: item.dish.allergenTags || [],
            menuCycleLabel: item.dish.menuCycleLabel || null,
            sortOrder: idx,
          })),
        });

        await tx.procurementIndent.update({
          where: { id: existingIndent.id },
          data: {
            createdById: auth.user.id,
            updatedAt: new Date(),
          },
        });
      });

      safeRevalidatePath(`/kitchen/${kitchenId}/indents`);
      safeRevalidatePath(`/kitchen/${kitchenId}/indents/${existingIndent.id}`);
      return { success: true, indentId: existingIndent.id, status: "DRAFT" };
    }

    // Otherwise (no indent or previous indent was CANCELLED), create a new DRAFT indent
    const newIndent = await prisma.procurementIndent.create({
      data: {
        kitchenId,
        mealId,
        date: meal.date,
        mealType: meal.mealType,
        status: "DRAFT",
        createdById: auth.user.id,
        lines: {
          create: meal.cookingPlan.items.map((item, idx) => ({
            dishId: item.dishId,
            dishName: item.dish.name,
            targetKg: item.approvedKg ?? item.recommendedKg ?? 0,
            unit: item.dish.unit || "kg",
            allergenTags: item.dish.allergenTags || [],
            menuCycleLabel: item.dish.menuCycleLabel || null,
            sortOrder: idx,
          })),
        },
      },
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/indents`);
    safeRevalidatePath(`/kitchen/${kitchenId}/morning`);
    safeRevalidatePath(`/kitchen/${kitchenId}/staff-board`);

    return { success: true, indentId: newIndent.id, status: "DRAFT" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create procurement indent" };
  }
}

/**
 * Fetch a single procurement indent with its lines.
 */
export async function getIndent(
  kitchenId: string,
  indentId: string
): Promise<{ success: true; data: ProcurementIndentDetail } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const indent = await prisma.procurementIndent.findFirst({
      where: { id: indentId, kitchenId },
      include: {
        kitchen: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!indent) {
      return { success: false, error: "Procurement indent not found" };
    }

    const detail: ProcurementIndentDetail = {
      id: indent.id,
      kitchenId: indent.kitchenId,
      kitchenName: indent.kitchen.name,
      mealId: indent.mealId,
      mealType: indent.mealType,
      date: indent.date.toISOString().slice(0, 10),
      status: indent.status as ProcurementIndentStatus,
      createdById: indent.createdById,
      createdByName: indent.createdBy?.name || indent.createdBy?.email || "Kitchen Staff",
      createdByRole: indent.createdBy?.role || "STAFF",
      createdAt: indent.createdAt.toISOString(),
      requestedAt: indent.requestedAt ? indent.requestedAt.toISOString() : null,
      lines: indent.lines.map((l) => ({
        id: l.id,
        indentId: l.indentId,
        dishId: l.dishId,
        dishName: l.dishName,
        targetKg: l.targetKg,
        unit: l.unit,
        allergenTags: l.allergenTags || [],
        menuCycleLabel: l.menuCycleLabel,
        sortOrder: l.sortOrder,
      })),
    };

    return { success: true, data: detail };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch procurement indent" };
  }
}

/**
 * List procurement indents for a kitchen, optionally filtered by date.
 */
export async function listIndents(
  kitchenId: string,
  dateStr?: string
): Promise<
  | {
      success: true;
      data: Array<{
        id: string;
        mealId: string;
        mealType: string;
        date: string;
        status: ProcurementIndentStatus;
        lineCount: number;
        totalTargetKg: number;
        createdByName: string;
        createdAt: string;
        requestedAt: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const whereClause: any = { kitchenId };
    if (dateStr && dateStr.trim().length > 0) {
      whereClause.date = normalizeServiceDate(dateStr);
    }

    const indents = await prisma.procurementIndent.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { name: true, email: true } },
        lines: { select: { targetKg: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const data = indents.map((ind) => {
      const totalKg = ind.lines.reduce((acc, l) => acc + (l.targetKg || 0), 0);
      return {
        id: ind.id,
        mealId: ind.mealId,
        mealType: ind.mealType,
        date: ind.date.toISOString().slice(0, 10),
        status: ind.status as ProcurementIndentStatus,
        lineCount: ind.lines.length,
        totalTargetKg: Math.round(totalKg * 10) / 10,
        createdByName: ind.createdBy?.name || ind.createdBy?.email || "Kitchen Staff",
        createdAt: ind.createdAt.toISOString(),
        requestedAt: ind.requestedAt ? ind.requestedAt.toISOString() : null,
      };
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list procurement indents" };
  }
}

/**
 * Check if an indent already exists for a specific meal.
 */
export async function getIndentForMeal(
  kitchenId: string,
  mealId: string
): Promise<{ success: true; indent: { id: string; status: ProcurementIndentStatus } | null } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const indent = await prisma.procurementIndent.findFirst({
      where: { kitchenId, mealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });

    return {
      success: true,
      indent: indent ? { id: indent.id, status: indent.status as ProcurementIndentStatus } : null,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check indent for meal" };
  }
}

/**
 * Transition an indent from DRAFT to REQUESTED.
 * Sets requestedAt timestamp.
 */
export async function markIndentRequested(
  kitchenId: string,
  indentId: string
): Promise<{ success: true; indentId: string } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const indent = await prisma.procurementIndent.findFirst({
      where: { id: indentId, kitchenId },
    });

    if (!indent) {
      return { success: false, error: "Procurement indent not found" };
    }

    if (indent.status === "CANCELLED") {
      return { success: false, error: "Cannot mark a cancelled indent as requested" };
    }

    if (indent.status === "REQUESTED") {
      return { success: true, indentId: indent.id };
    }

    await prisma.procurementIndent.update({
      where: { id: indentId },
      data: {
        status: "REQUESTED",
        requestedAt: new Date(),
      },
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/indents`);
    safeRevalidatePath(`/kitchen/${kitchenId}/indents/${indentId}`);

    return { success: true, indentId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark indent as requested" };
  }
}

/**
 * Cancel an indent (transitions DRAFT or REQUESTED to CANCELLED).
 */
export async function cancelIndent(
  kitchenId: string,
  indentId: string
): Promise<{ success: true; indentId: string } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const indent = await prisma.procurementIndent.findFirst({
      where: { id: indentId, kitchenId },
    });

    if (!indent) {
      return { success: false, error: "Procurement indent not found" };
    }

    await prisma.procurementIndent.update({
      where: { id: indentId },
      data: {
        status: "CANCELLED",
      },
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/indents`);
    safeRevalidatePath(`/kitchen/${kitchenId}/indents/${indentId}`);

    return { success: true, indentId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel procurement indent" };
  }
}
