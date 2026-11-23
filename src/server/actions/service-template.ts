"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";

export type ServiceTemplate = {
  id: string;
  kitchenId: string;
  name: string;
  mealType: string;
  defaultExpectedDiners: number | null;
  dishIds: string[];
  dishes: { id: string; name: string; unit: string }[];
  createdAt: string;
  updatedAt: string;
};

export async function listTemplates(
  kitchenId: string
): Promise<
  | { success: true; data: ServiceTemplate[] }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const templates = await prisma.kitchenServiceTemplate.findMany({
      where: { kitchenId },
      orderBy: { name: "asc" },
    });

    if (templates.length === 0) {
      return { success: true, data: [] };
    }

    // Collect all referenced dish IDs across all templates to batch load dish details
    const allDishIds = new Set<string>();
    for (const t of templates) {
      try {
        const ids: string[] = JSON.parse(t.dishIds);
        if (Array.isArray(ids)) {
          ids.forEach((id) => allDishIds.add(id));
        }
      } catch {
        // Skip malformed JSON
      }
    }

    const dishes = await prisma.dish.findMany({
      where: {
        id: { in: Array.from(allDishIds) },
        kitchenId,
      },
      select: { id: true, name: true, unit: true },
    });
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    const result: ServiceTemplate[] = templates.map((t) => {
      let parsedIds: string[] = [];
      try {
        const parsed = JSON.parse(t.dishIds);
        if (Array.isArray(parsed)) parsedIds = parsed;
      } catch {
        parsedIds = [];
      }

      const templateDishes = parsedIds
        .map((id) => dishMap.get(id))
        .filter((d): d is { id: string; name: string; unit: string } => !!d);

      return {
        id: t.id,
        kitchenId: t.kitchenId,
        name: t.name,
        mealType: t.mealType,
        defaultExpectedDiners: t.defaultExpectedDiners,
        dishIds: parsedIds,
        dishes: templateDishes,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: "Failed to list service templates" };
  }
}

export async function createTemplate(
  kitchenId: string,
  input: {
    name: string;
    mealType: string;
    defaultExpectedDiners?: number | null;
    dishIds: string[];
  }
): Promise<
  | { success: true; data: ServiceTemplate }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const { name, mealType, defaultExpectedDiners, dishIds } = input;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Template name is required" };
  }

  if (!mealType || mealType.trim().length === 0) {
    return { success: false, error: "Meal service type is required" };
  }

  if (!Array.isArray(dishIds) || dishIds.length === 0) {
    return { success: false, error: "At least one dish must be selected for the template" };
  }

  if (
    defaultExpectedDiners !== undefined &&
    defaultExpectedDiners !== null &&
    (!Number.isInteger(defaultExpectedDiners) || defaultExpectedDiners <= 0)
  ) {
    return { success: false, error: "Default expected diners must be a positive integer" };
  }

  try {
    // Check duplicate name within this kitchen
    const existing = await prisma.kitchenServiceTemplate.findFirst({
      where: {
        kitchenId,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });

    if (existing) {
      return { success: false, error: "A template with this name already exists in this kitchen" };
    }

    // Verify all dishes belong to this kitchen (strict multi-tenant isolation)
    const validDishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        kitchenId,
      },
      select: { id: true, name: true, unit: true },
    });

    if (validDishes.length !== dishIds.length) {
      return {
        success: false,
        error: "One or more selected dishes do not belong to this facility",
      };
    }

    const created = await prisma.kitchenServiceTemplate.create({
      data: {
        kitchenId,
        name: name.trim(),
        mealType: mealType.trim().toUpperCase(),
        defaultExpectedDiners: defaultExpectedDiners ?? null,
        dishIds: JSON.stringify(dishIds),
      },
    });

    return {
      success: true,
      data: {
        id: created.id,
        kitchenId: created.kitchenId,
        name: created.name,
        mealType: created.mealType,
        defaultExpectedDiners: created.defaultExpectedDiners,
        dishIds,
        dishes: validDishes,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to create service template" };
  }
}

export async function deleteTemplate(
  kitchenId: string,
  templateId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const template = await prisma.kitchenServiceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.kitchenId !== kitchenId) {
      return { success: false, error: "Service template not found in this kitchen" };
    }

    await prisma.kitchenServiceTemplate.delete({
      where: { id: templateId },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to delete service template" };
  }
}
