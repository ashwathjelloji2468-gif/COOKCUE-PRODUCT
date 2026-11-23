/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveCloseoutDraft,
  loadCloseoutDraft,
  clearCloseoutDraft,
  hasCloseoutDraft,
  getCloseoutDraftKey,
  CloseoutDraftPayload,
} from "../src/lib/kitchen/closeout-draft";

describe("Wave 1 / T1-E: Offline Closeout Draft Utility", () => {
  const testKitchenId = "kitchen-draft-001";
  const testDate = "2026-11-20";
  const testMealType = "LUNCH";
  const key = getCloseoutDraftKey({
    kitchenId: testKitchenId,
    date: testDate,
    mealType: testMealType,
  });

  const mockPayload: CloseoutDraftPayload = {
    kitchenId: testKitchenId,
    date: testDate,
    mealType: testMealType,
    mealId: "meal-draft-123",
    actualDiners: 140,
    planExpectedDiners: 150,
    isUnplanned: false,
    selectedMode: "AS_PLANNED",
    items: [
      {
        dishId: "dish-1",
        dishName: "Steamed Rice",
        approvedKg: 30,
        totalCookedKg: "30",
        unservedLeftoverKg: "2.5",
        isStockout: false,
        isAbnormal: false,
        notes: "Slight surplus",
      },
      {
        dishId: "dish-2",
        dishName: "Curry",
        approvedKg: 20,
        totalCookedKg: "20",
        unservedLeftoverKg: "0",
        isStockout: true,
        isAbnormal: false,
      },
    ],
    savedAt: "2026-11-20T14:30:00.000Z",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe("Key Generation", () => {
    it("generates deterministic storage keys matching the specification", () => {
      const generated = getCloseoutDraftKey({
        kitchenId: "k-101",
        date: "2026-11-25",
        mealType: "dinner",
      });
      expect(generated).toBe("cookcue-closeout-draft:k-101:2026-11-25:DINNER");
    });
  });

  describe("Save, Load, and Clear Lifecycle", () => {
    it("saves a valid closeout draft to localStorage", () => {
      const success = saveCloseoutDraft(key, mockPayload);
      expect(success).toBe(true);

      const raw = localStorage.getItem(key);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.actualDiners).toBe(140);
      expect(parsed.items.length).toBe(2);
      expect(parsed.items[1].isStockout).toBe(true);
    });

    it("loads an existing closeout draft correctly", () => {
      saveCloseoutDraft(key, mockPayload);

      const loaded = loadCloseoutDraft(key);
      expect(loaded).not.toBeNull();
      expect(loaded?.kitchenId).toBe(testKitchenId);
      expect(loaded?.actualDiners).toBe(140);
      expect(loaded?.items[0].dishName).toBe("Steamed Rice");
      expect(loaded?.items[0].unservedLeftoverKg).toBe("2.5");
      expect(hasCloseoutDraft(key)).toBe(true);
    });

    it("clears the draft on demand (such as after successful submitCloseout)", () => {
      saveCloseoutDraft(key, mockPayload);
      expect(hasCloseoutDraft(key)).toBe(true);

      clearCloseoutDraft(key);
      expect(hasCloseoutDraft(key)).toBe(false);
      expect(loadCloseoutDraft(key)).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });

    it("safely handles non-existent or corrupted localStorage entries", () => {
      expect(loadCloseoutDraft("non-existent-key")).toBeNull();
      expect(hasCloseoutDraft("non-existent-key")).toBe(false);

      // Corrupted JSON
      localStorage.setItem("corrupted-key", "{ invalid: json }");
      expect(loadCloseoutDraft("corrupted-key")).toBeNull();

      // Missing required structure
      localStorage.setItem("incomplete-key", JSON.stringify({ wrong: true }));
      expect(loadCloseoutDraft("incomplete-key")).toBeNull();
    });

    it("does not store credentials, passwords, or session tokens in the draft", () => {
      saveCloseoutDraft(key, mockPayload);
      const raw = localStorage.getItem(key)!;
      expect(raw).not.toMatch(/password|token|secret|session/i);
    });

    it("handles storage exceptions gracefully when localStorage throws", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      const success = saveCloseoutDraft(key, mockPayload);
      expect(success).toBe(false);

      setItemSpy.mockRestore();
    });
  });
});
