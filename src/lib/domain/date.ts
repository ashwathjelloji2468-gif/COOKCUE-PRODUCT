/**
 * Canonical service date normalization.
 * Establishes the explicit product invariant for identifying one service day:
 * A service date represents a calendar day normalized to UTC Midnight (00:00:00.000Z).
 */

export function normalizeServiceDate(input: string | Date): Date {
  if (!input) {
    throw new Error("Invalid service date: date input is required");
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    // Match YYYY-MM-DD regardless of whether it has time suffixes or timezone offsets
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      throw new Error(`Invalid service date format: "${input}". Expected YYYY-MM-DD.`);
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid calendar date: "${input}"`);
    }

    const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Verify valid date (e.g., February 31st rolling over)
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      throw new Error(`Invalid calendar date: "${input}"`);
    }
    return d;
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new Error("Invalid service date: Date object is NaN");
    }
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0)
    );
  }

  throw new Error("Invalid service date: unsupported input type");
}

export function toServiceDateString(date: Date | string): string {
  const normalized = normalizeServiceDate(date);
  return normalized.toISOString().slice(0, 10);
}
