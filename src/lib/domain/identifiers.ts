/**
 * Institutional Multi-Tenant Identifier Utilities
 * CookCue standard formats:
 * - Contractor Code: CTR-###### (e.g. CTR-000001)
 * - User Code: USR-###### (e.g. USR-000001)
 */

export const CONTRACTOR_CODE_REGEX = /^CTR-\d+$/i;
export const USER_CODE_REGEX = /^USR-\d+$/i;

/**
 * Checks whether an identifier string is a contractor human-readable code (CTR-######).
 */
export function isContractorCode(identifier: string | null | undefined): boolean {
  if (!identifier) return false;
  return CONTRACTOR_CODE_REGEX.test(identifier.trim());
}

/**
 * Checks whether an identifier string is a user human-readable code (USR-######).
 */
export function isUserCode(identifier: string | null | undefined): boolean {
  if (!identifier) return false;
  return USER_CODE_REGEX.test(identifier.trim());
}

/**
 * Normalizes a contractor code to uppercase standard formatting (CTR-######).
 * Returns null if the identifier is not a valid contractor code.
 */
export function normalizeContractorCode(identifier: string | null | undefined): string | null {
  if (!isContractorCode(identifier)) return null;
  return identifier!.trim().toUpperCase();
}

/**
 * Normalizes a user code to uppercase standard formatting (USR-######).
 * Returns null if the identifier is not a valid user code.
 */
export function normalizeUserCode(identifier: string | null | undefined): string | null {
  if (!isUserCode(identifier)) return null;
  return identifier!.trim().toUpperCase();
}
