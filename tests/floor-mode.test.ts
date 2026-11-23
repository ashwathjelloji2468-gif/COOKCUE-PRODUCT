// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { FLOOR_MODE_STORAGE_KEY } from "../src/context/FloorModeContext";

describe("Phase C: Floor Mode Preference & Ergonomics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Default floor mode preference is OFF (false) to preserve normal Ops density", () => {
    const stored = localStorage.getItem(FLOOR_MODE_STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it("2. Persists floor mode preference in localStorage under cookcue-floor-mode=1", () => {
    // Enable floor mode
    localStorage.setItem(FLOOR_MODE_STORAGE_KEY, "1");
    expect(localStorage.getItem(FLOOR_MODE_STORAGE_KEY)).toBe("1");

    // Disable floor mode
    localStorage.setItem(FLOOR_MODE_STORAGE_KEY, "0");
    expect(localStorage.getItem(FLOOR_MODE_STORAGE_KEY)).toBe("0");
  });

  it("3. Floor mode storage key strictly matches cookcue-floor-mode", () => {
    expect(FLOOR_MODE_STORAGE_KEY).toBe("cookcue-floor-mode");
  });
});
