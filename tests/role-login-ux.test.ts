import { describe, it, expect } from "vitest";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { requireFounder, requireKitchenAccess, requireContractorAccess } from "@/lib/auth/session";
import { PUBLIC_ROLES } from "@/lib/auth/login-roles";

describe("Role-Based Login UX & Redirection Matrix", () => {
  describe("Public Role Chooser Visibility", () => {
    it("excludes Platform Founder from public visible role cards", () => {
      const publicRoleIds = PUBLIC_ROLES.map((r) => r.id);
      expect(publicRoleIds).not.toContain("FOUNDER");
      expect(PUBLIC_ROLES.some((r) => r.title.toLowerCase().includes("founder"))).toBe(false);
    });

    it("maintains visible cards for operational roles: Contractor Manager, Head Cook, Head Kitchen Staff", () => {
      const publicRoleIds = PUBLIC_ROLES.map((r) => r.id);
      expect(publicRoleIds).toEqual(["CONTRACTOR_MANAGER", "HEAD_COOK", "KITCHEN_STAFF"]);
      expect(PUBLIC_ROLES.map((r) => r.title)).toEqual([
        "Contractor Manager",
        "Head Cook",
        "Head Kitchen Staff",
      ]);
    });
  });
  describe("getPostLoginRedirect - Real DB Role Authority", () => {
    it("1. FOUNDER role always redirects to /founder regardless of chooser selection", () => {
      const redirect = getPostLoginRedirect({
        role: "FOUNDER",
        contractorId: "any-contractor",
        kitchenId: "any-kitchen",
      });
      expect(redirect).toBe("/founder");
    });

    it("2. CONTRACTOR_MANAGER redirects to /contractor/[contractorId] when assigned", () => {
      const redirect = getPostLoginRedirect({
        role: "CONTRACTOR_MANAGER",
        contractorId: "ctr-cuid-12345",
        kitchenId: null,
      });
      expect(redirect).toBe("/contractor/ctr-cuid-12345");
    });

    it("3. CONTRACTOR_MANAGER without assigned contractorId falls back to safe login prompt", () => {
      const redirect = getPostLoginRedirect({
        role: "CONTRACTOR_MANAGER",
        contractorId: null,
        kitchenId: null,
      });
      expect(redirect).toBe("/login?error=missing_assignment");
    });

    it("4. HEAD_COOK redirects to assigned kitchen morning plan /kitchen/[kitchenId]/morning", () => {
      const redirect = getPostLoginRedirect({
        role: "HEAD_COOK",
        contractorId: "ctr-cuid-12345",
        kitchenId: "ktc-cuid-67890",
      });
      expect(redirect).toBe("/kitchen/ktc-cuid-67890/morning");
    });

    it("5. HEAD_COOK without assigned kitchenId falls back to safe login prompt", () => {
      const redirect = getPostLoginRedirect({
        role: "HEAD_COOK",
        contractorId: null,
        kitchenId: null,
      });
      expect(redirect).toBe("/login?error=missing_assignment");
    });

    it("6. KITCHEN_STAFF redirects to assigned live staff board /kitchen/[kitchenId]/staff-board", () => {
      const redirect = getPostLoginRedirect({
        role: "KITCHEN_STAFF",
        contractorId: "ctr-cuid-12345",
        kitchenId: "ktc-cuid-67890",
      });
      expect(redirect).toBe("/kitchen/ktc-cuid-67890/staff-board");
    });

    it("7. KITCHEN_STAFF without assigned kitchen falls back to safe login prompt", () => {
      const redirect = getPostLoginRedirect({
        role: "KITCHEN_STAFF",
        contractorId: null,
        kitchenId: null,
      });
      expect(redirect).toBe("/login?error=missing_assignment");
    });
  });

  describe("Backend Guards - Require* Enforcement", () => {
    it("requireFounder rejects unauthenticated calls with 401", async () => {
      const res = await requireFounder();
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("requireKitchenAccess rejects unauthenticated calls with 401", async () => {
      const res = await requireKitchenAccess("kitchen-123");
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("requireContractorAccess rejects unauthenticated calls with 401", async () => {
      const res = await requireContractorAccess("contractor-123");
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(401);
    });
  });
});
