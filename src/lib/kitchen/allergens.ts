import { z } from "zod";

/**
 * Standard institutional allergen list.
 * Note: These tags are for operational kitchen awareness only.
 * UI copy must display caution ("May contain") without medical claims.
 */
export const COMMON_ALLERGENS = [
  "GLUTEN",
  "DAIRY",
  "PEANUT",
  "TREE_NUT",
  "EGG",
  "SOY",
  "SESAME",
  "SHELLFISH",
  "FISH",
  "MUSTARD",
] as const;

export type CommonAllergen = typeof COMMON_ALLERGENS[number];

export const AllergenTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_ -]+$/, "Allergen tags may only contain letters, numbers, spaces, and hyphens/underscores")
  .transform((val) => val.toUpperCase().replace(/\s+/g, "_"));

export const AllergenTagsArraySchema = z
  .array(AllergenTagSchema)
  .max(12, "Maximum 12 allergen tags allowed per dish")
  .default([])
  .transform((tags) => Array.from(new Set(tags)));

export const MenuCycleLabelSchema = z
  .string()
  .trim()
  .max(50, "Menu cycle label must be 50 characters or less")
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

/**
 * Formats an allergen tag for plain, operational UI display.
 * E.g., "TREE_NUT" -> "Tree Nut", "GLUTEN" -> "Gluten"
 */
export function formatAllergenLabel(tag: string): string {
  if (!tag) return "";
  return tag
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
