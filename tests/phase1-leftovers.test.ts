import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  isContractorCode,
  isUserCode,
  normalizeContractorCode,
  normalizeUserCode,
} from "../src/lib/domain/identifiers";
import { listUsersAsFounder } from "../src/server/actions/user";
import { listContractors, searchContractorsAsFounder } from "../src/server/actions/contractor";
import { listApplicationsAsFounder } from "../src/server/actions/onboarding";
import { createKitchen } from "../src/server/actions/kitchen-setup";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    requireAuth: vi.fn(),
  };
});

import { requireFounder, requireAuth } from "../src/lib/auth/session";

describe("Phase 1 Architecture Leftovers", () => {
  const ts = Date.now();
  const testContractorCode = `CTR-99${String(ts).slice(-4)}`;

  beforeEach(() => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: "test-phase1-founder",
        email: "founder@cookcue.com",
        name: "Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      success: true,
      user: {
        id: "test-phase1-founder",
        email: "founder@cookcue.com",
        name: "Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  describe("1. Centralized Identifier Helpers (identifiers.ts)", () => {
    it("validates contractor codes correctly", () => {
      expect(isContractorCode("CTR-000001")).toBe(true);
      expect(isContractorCode("ctr-123456")).toBe(true);
      expect(isContractorCode("  CTR-999999  ")).toBe(true);
      expect(isContractorCode("CTR-")).toBe(false);
      expect(isContractorCode("CTR-ABC")).toBe(false);
      expect(isContractorCode("USR-000001")).toBe(false);
      expect(isContractorCode(null)).toBe(false);
      expect(isContractorCode(undefined)).toBe(false);
      expect(isContractorCode("")).toBe(false);
    });

    it("validates user codes correctly", () => {
      expect(isUserCode("USR-000001")).toBe(true);
      expect(isUserCode("usr-123456")).toBe(true);
      expect(isUserCode("  USR-999999  ")).toBe(true);
      expect(isUserCode("USR-")).toBe(false);
      expect(isUserCode("USR-XYZ")).toBe(false);
      expect(isUserCode("CTR-000001")).toBe(false);
      expect(isUserCode(null)).toBe(false);
      expect(isUserCode(undefined)).toBe(false);
    });

    it("normalizes codes to uppercase trimmed standard", () => {
      expect(normalizeContractorCode("  ctr-000123 ")).toBe("CTR-000123");
      expect(normalizeContractorCode("invalid")).toBeNull();
      expect(normalizeUserCode("  usr-000456 ")).toBe("USR-000456");
      expect(normalizeUserCode("invalid")).toBeNull();
    });
  });

  describe("2. Default Pagination (take=50 when omitted)", () => {
    it("listUsersAsFounder defaults take=50 when omitted and supports explicit take/skip", async () => {
      const defaultRes = await listUsersAsFounder();
      expect(defaultRes.success).toBe(true);
      if (defaultRes.success) {
        expect(defaultRes.take).toBe(50);
        expect(defaultRes.data.length).toBeLessThanOrEqual(50);
      }

      const explicitRes = await listUsersAsFounder({ take: 5, skip: 2 });
      expect(explicitRes.success).toBe(true);
      if (explicitRes.success) {
        expect(explicitRes.take).toBe(5);
        expect(explicitRes.skip).toBe(2);
        expect(explicitRes.data.length).toBeLessThanOrEqual(5);
      }
    });

    it("listContractors defaults take=50 when omitted and supports explicit take/skip", async () => {
      const defaultRes = await listContractors();
      expect(defaultRes.success).toBe(true);
      if (defaultRes.success) {
        expect(defaultRes.take).toBe(50);
        expect(defaultRes.data.length).toBeLessThanOrEqual(50);
      }

      const explicitRes = await listContractors({ take: 10, skip: 5 });
      expect(explicitRes.success).toBe(true);
      if (explicitRes.success) {
        expect(explicitRes.take).toBe(10);
        expect(explicitRes.skip).toBe(5);
        expect(explicitRes.data.length).toBeLessThanOrEqual(10);
      }
    });

    it("searchContractorsAsFounder defaults take=50 when omitted and supports explicit take/skip", async () => {
      const defaultRes = await searchContractorsAsFounder("");
      expect(defaultRes.success).toBe(true);
      if (defaultRes.success) {
        expect(defaultRes.take).toBe(50);
        expect(defaultRes.data.length).toBeLessThanOrEqual(50);
      }

      const explicitRes = await searchContractorsAsFounder("", { take: 3, skip: 1 });
      expect(explicitRes.success).toBe(true);
      if (explicitRes.success) {
        expect(explicitRes.take).toBe(3);
        expect(explicitRes.skip).toBe(1);
        expect(explicitRes.data.length).toBeLessThanOrEqual(3);
      }
    });

    it("listApplicationsAsFounder defaults take=50 when omitted and supports explicit take/skip", async () => {
      const defaultRes = await listApplicationsAsFounder();
      expect(defaultRes.success).toBe(true);
      if (defaultRes.success) {
        expect(defaultRes.take).toBe(50);
        expect(defaultRes.data.length).toBeLessThanOrEqual(50);
      }

      const explicitRes = await listApplicationsAsFounder({ take: 4, skip: 1 });
      expect(explicitRes.success).toBe(true);
      if (explicitRes.success) {
        expect(explicitRes.take).toBe(4);
        expect(explicitRes.skip).toBe(1);
        expect(explicitRes.data.length).toBeLessThanOrEqual(4);
      }
    });
  });

  describe("3. createKitchen CTR-###### Resolution", () => {
    const testCtrId = `ctr-create-kitchen-${ts}`;
    const testKitchenName = `Central Kitchen ${ts}`;

    it("accepts CTR-###### and resolves contractor before ACTIVE check", async () => {
      // Create test contractor with ACTIVE status
      const ctrCode = await generateNextContractorCode();
      const contractor = await prisma.contractor.create({
        data: {
          id: testCtrId,
          code: ctrCode,
          name: `Test Catering Organization ${ts}`,
          status: "ACTIVE",
        },
      });

      // Invoke createKitchen using the human-readable code
      const res = await createKitchen({
        contractorId: ctrCode.toLowerCase(), // test case-insensitivity
        name: testKitchenName,
        location: "Block B, Tech Park",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe(testKitchenName);
        expect(res.data.contractorId).toBe(contractor.id);
        expect(res.data.contractorName).toBe(contractor.name);

        // Cleanup
        await prisma.kitchen.delete({ where: { id: res.data.id } }).catch(() => {});
      }

      await prisma.contractor.delete({ where: { id: testCtrId } }).catch(() => {});
    });

    it("rejects kitchen creation if contractor resolved by CTR-###### is INACTIVE", async () => {
      const inactiveCtrId = `ctr-inactive-${ts}`;
      const ctrCode = await generateNextContractorCode();
      await prisma.contractor.create({
        data: {
          id: inactiveCtrId,
          code: ctrCode,
          name: `Inactive Catering ${ts}`,
          status: "INACTIVE",
        },
      });

      const res = await createKitchen({
        contractorId: ctrCode,
        name: `Kitchen for Inactive CTR ${ts}`,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Contractor must be ACTIVE before adding a kitchen.");
      }

      await prisma.contractor.delete({ where: { id: inactiveCtrId } }).catch(() => {});
    });
  });
});
