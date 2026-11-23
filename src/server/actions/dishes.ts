"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess } from "@/lib/auth/session";
import {
  AllergenTagsArraySchema,
  MenuCycleLabelSchema,
} from "@/lib/kitchen/allergens";

export type DishRecord = {
  id: string;
  name: string;
  unit: string;
  allergenTags: string[];
  menuCycleLabel: string | null;
  observationCount: number;
};

export async function getDishes(kitchenId: string): Promise<
  | { success: true; data: DishRecord[] }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error, statusCode: auth.statusCode };

  try {
    const dishes = await prisma.dish.findMany({
      where: { kitchenId },
      include: {
        observations: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        unit: d.unit,
        allergenTags: d.allergenTags || [],
        menuCycleLabel: d.menuCycleLabel || null,
        observationCount: d.observations.length,
      })),
    };
  } catch (e) {
    return { success: false, error: "Failed to load dishes" };
  }
}

export async function createDish(
  kitchenId: string,
  name: string,
  unit: string = "kg",
  allergenTags: string[] = [],
  menuCycleLabel?: string | null
): Promise<{ success: true; dishId: string } | { success: false; error: string; statusCode?: number }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error, statusCode: auth.statusCode };

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Dish name is required" };
  }

  // Zod validation
  const parsedAllergens = AllergenTagsArraySchema.safeParse(allergenTags);
  if (!parsedAllergens.success) {
    return { success: false, error: parsedAllergens.error.issues[0]?.message || "Invalid allergen tags" };
  }

  const parsedCycle = MenuCycleLabelSchema.safeParse(menuCycleLabel);
  if (!parsedCycle.success) {
    return { success: false, error: parsedCycle.error.issues[0]?.message || "Invalid menu cycle label" };
  }

  try {
    const existing = await prisma.dish.findFirst({
      where: {
        kitchenId,
        name: { equals: trimmed, mode: "insensitive" },
      },
    });

    if (existing) {
      return { success: false, error: "A dish with this name already exists in this facility" };
    }

    const dish = await prisma.dish.create({
      data: {
        kitchenId,
        name: trimmed,
        unit: unit.trim() || "kg",
        allergenTags: parsedAllergens.data,
        menuCycleLabel: parsedCycle.data,
      },
    });

    return { success: true, dishId: dish.id };
  } catch (e) {
    return { success: false, error: "Failed to create dish" };
  }
}

export async function deleteDish(
  kitchenId: string,
  dishId: string
): Promise<{ success: true } | { success: false; error: string; statusCode?: number }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error, statusCode: auth.statusCode };

  try {
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        observations: { select: { id: true }, take: 1 },
        planItems: { select: { id: true }, take: 1 },
      },
    });

    if (!dish || dish.kitchenId !== kitchenId) {
      return { success: false, error: "Dish not found", statusCode: 404 };
    }

    if (dish.observations.length > 0 || dish.planItems.length > 0) {
      return {
        success: false,
        error: "Cannot delete dish with historical service observations or plans. It is preserved for audit integrity.",
      };
    }

    await prisma.dish.delete({ where: { id: dishId } });
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to delete dish" };
  }
}

export async function updateDish(
  kitchenId: string,
  dishId: string,
  input: {
    name?: string;
    unit?: string;
    allergenTags?: string[];
    menuCycleLabel?: string | null;
  }
): Promise<
  | { success: true; dish: { id: string; name: string; unit: string; allergenTags: string[]; menuCycleLabel: string | null } }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error, statusCode: auth.statusCode };

  try {
    const existing = await prisma.dish.findUnique({
      where: { id: dishId },
    });

    if (!existing || existing.kitchenId !== kitchenId) {
      return { success: false, error: "Dish not found", statusCode: 404 };
    }

    const nextName = input.name !== undefined ? input.name.trim() : existing.name;
    const nextUnit = input.unit !== undefined ? input.unit.trim() || "kg" : existing.unit;

    if (!nextName) {
      return { success: false, error: "Dish name is required" };
    }

    if (input.name !== undefined && nextName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.dish.findFirst({
        where: {
          kitchenId,
          name: { equals: nextName, mode: "insensitive" },
          id: { not: dishId },
        },
      });

      if (duplicate) {
        return { success: false, error: "A dish with this name already exists in this facility" };
      }
    }

    let nextAllergens = existing.allergenTags;
    if (input.allergenTags !== undefined) {
      const parsed = AllergenTagsArraySchema.safeParse(input.allergenTags);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid allergen tags" };
      }
      nextAllergens = parsed.data;
    }

    let nextCycle = existing.menuCycleLabel;
    if (input.menuCycleLabel !== undefined) {
      const parsed = MenuCycleLabelSchema.safeParse(input.menuCycleLabel);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid menu cycle label" };
      }
      nextCycle = parsed.data;
    }

    const updated = await prisma.dish.update({
      where: { id: dishId },
      data: {
        name: nextName,
        unit: nextUnit,
        allergenTags: nextAllergens,
        menuCycleLabel: nextCycle,
      },
    });

    return {
      success: true,
      dish: {
        id: updated.id,
        name: updated.name,
        unit: updated.unit,
        allergenTags: updated.allergenTags,
        menuCycleLabel: updated.menuCycleLabel,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to update dish" };
  }
}
