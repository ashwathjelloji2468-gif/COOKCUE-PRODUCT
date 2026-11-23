import { describe, it, expect } from "vitest";
import { normalizeServiceDate, toServiceDateString } from "@/lib/domain/date";

describe("Service Identity & Calendar Date Normalization", () => {
  it("normalizes diverse string and date formats to identical UTC midnight timestamps", () => {
    const d1 = normalizeServiceDate("2026-10-22");
    const d2 = normalizeServiceDate("2026-10-22T00:00:00.000Z");
    const d3 = normalizeServiceDate("2026-10-22T14:30:00+05:30");
    const d4 = normalizeServiceDate("2026-10-22T23:59:59.999Z");
    const d5 = normalizeServiceDate(new Date(Date.UTC(2026, 9, 22, 0, 0, 0, 0)));

    expect(d1.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(d2.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(d3.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(d4.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(d5.toISOString()).toBe("2026-10-22T00:00:00.000Z");

    // All formats must resolve to the identical millisecond timestamp
    expect(d1.getTime()).toBe(d2.getTime());
    expect(d2.getTime()).toBe(d3.getTime());
    expect(d3.getTime()).toBe(d4.getTime());
    expect(d4.getTime()).toBe(d5.getTime());

    // Converts back to canonical YYYY-MM-DD
    expect(toServiceDateString(d3)).toBe("2026-10-22");
  });

  it("rejects invalid date formats and impossible calendar days", () => {
    expect(() => normalizeServiceDate("not-a-date")).toThrow(/Invalid service date format/);
    expect(() => normalizeServiceDate("2026-02-31")).toThrow(/Invalid calendar date/);
    expect(() => normalizeServiceDate("2026-13-01")).toThrow(/Invalid calendar date/);
  });

  it("guarantees distinct services are never merged", () => {
    const lunchService = {
      kitchenId: "k-1",
      mealType: "LUNCH",
      date: normalizeServiceDate("2026-10-22"),
    };
    const dinnerService = {
      kitchenId: "k-1",
      mealType: "DINNER",
      date: normalizeServiceDate("2026-10-22"),
    };
    const nextDayLunchService = {
      kitchenId: "k-1",
      mealType: "LUNCH",
      date: normalizeServiceDate("2026-10-23"),
    };

    // Stable canonical key generator
    const toServiceKey = (s: typeof lunchService) => `${s.kitchenId}:${s.mealType}:${s.date.toISOString()}`;

    expect(toServiceKey(lunchService)).not.toBe(toServiceKey(dinnerService));
    expect(toServiceKey(lunchService)).not.toBe(toServiceKey(nextDayLunchService));
  });
});
