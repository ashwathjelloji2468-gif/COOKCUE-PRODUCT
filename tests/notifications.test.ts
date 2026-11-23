import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFounderNotifications } from "@/server/actions/notifications";
import * as sessionModule from "@/lib/auth/session";

describe("Founder Notifications Action & Data Mapping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Rejects unauthenticated or non-founder requests safely", async () => {
    vi.spyOn(sessionModule, "requireFounder").mockResolvedValue({
      success: false,
      error: "Authentication required",
      statusCode: 401,
    });

    const result = await getFounderNotifications();
    expect(result.success).toBe(false);
    expect(result.notifications).toEqual([]);
    expect(result.error).toContain("Authentication required");
  });

  it("2. Returns real live notifications sorted newest first for authenticated founder", async () => {
    vi.spyOn(sessionModule, "requireFounder").mockResolvedValue({
      success: true,
      user: {
        id: "founder-1",
        email: "founder@cookcue.test",
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 100000,
      },
    });

    const result = await getFounderNotifications(15);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.notifications)).toBe(true);

    if (result.notifications.length > 1) {
      // Confirm strict descending chronological order
      for (let i = 0; i < result.notifications.length - 1; i++) {
        const current = new Date(result.notifications[i].timestamp).getTime();
        const next = new Date(result.notifications[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    }

    // Confirm structure of each item
    for (const item of result.notifications) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.summary).toBeTruthy();
      expect(item.timestamp).toBeTruthy();
      expect(["STOCKOUT", "ABNORMAL", "CLOSEOUT", "CONTRACTOR", "APPLICATION", "ADJUSTMENT"]).toContain(
        item.type
      );
      expect(["normal", "warning", "danger", "success"]).toContain(item.severity);
      if (item.href) {
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("3. Enforces upper limit cap of 20 items", async () => {
    vi.spyOn(sessionModule, "requireFounder").mockResolvedValue({
      success: true,
      user: {
        id: "founder-1",
        email: "founder@cookcue.test",
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 100000,
      },
    });

    const result = await getFounderNotifications(50);
    expect(result.success).toBe(true);
    expect(result.notifications.length).toBeLessThanOrEqual(20);
  });
});
