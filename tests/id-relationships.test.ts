import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { createKitchen } from "../src/server/actions/kitchen-setup";
import { requireKitchenAccess, requireContractorAccess } from "../src/lib/auth/session";

// Mock session module
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
  };
});

import { requireFounder } from "../src/lib/auth/session";

describe("Audit & Harden ID-Based Relationships", () => {
  const testFounderId = "test-id-audit-founder-user";

  beforeEach(() => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: testFounderId,
        email: "founder@cookcue.test",
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  it("1. Invariant Integrity: Kitchen always has valid contractorId in database", async () => {
    // Check for any orphaned Kitchen rows where contractorId does not exist in Contractor table
    const orphanedKitchens = await prisma.$queryRawUnsafe<any[]>(
      `SELECT k.id, k.name, k."contractorId" 
       FROM "Kitchen" k 
       LEFT JOIN "Contractor" c ON k."contractorId" = c.id 
       WHERE c.id IS NULL OR k."contractorId" IS NULL`
    );
    expect(orphanedKitchens.length).toBe(0);

    // Every kitchen has non-empty contractorId
    const allKitchens = await prisma.kitchen.findMany({
      select: { id: true, contractorId: true },
    });
    for (const k of allKitchens) {
      expect(k.contractorId).toBeDefined();
      expect(typeof k.contractorId).toBe("string");
      expect(k.contractorId.length).toBeGreaterThan(0);
    }
  });

  it("2. Invariant Integrity: Observation always has valid kitchenId in database", async () => {
    // Check for any orphaned Observation rows where kitchenId does not exist in Kitchen table
    const orphanedObservations = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.id, o."kitchenId" 
       FROM "Observation" o 
       LEFT JOIN "Kitchen" k ON o."kitchenId" = k.id 
       WHERE k.id IS NULL OR o."kitchenId" IS NULL`
    );
    expect(orphanedObservations.length).toBe(0);

    // Every observation has non-empty kitchenId
    const allObservations = await prisma.observation.findMany({
      select: { id: true, kitchenId: true },
      take: 200,
    });
    for (const o of allObservations) {
      expect(o.kitchenId).toBeDefined();
      expect(typeof o.kitchenId).toBe("string");
      expect(o.kitchenId.length).toBeGreaterThan(0);
    }
  });

  it("3. Server Rule: createKitchen strictly rejects non-existent or inactive contractorId", async () => {
    // Non-existent contractorId
    const resNotFound = await createKitchen({
      contractorId: "non-existent-contractor-cuid",
      name: "Orphan Facility",
    });
    expect(resNotFound.success).toBe(false);
    if (!resNotFound.success) {
      expect(resNotFound.error).toContain("Contractor not found");
    }

    // Inactive (PENDING) contractorId
    const ctrCode = await generateNextContractorCode();
    const tempPendingCtr = await prisma.contractor.create({
      data: {
        name: `Pending Org ${Date.now()}`,
        code: ctrCode,
        status: "PENDING",
      },
    });

    const resPending = await createKitchen({
      contractorId: tempPendingCtr.id,
      name: "Pending Facility",
    });
    expect(resPending.success).toBe(false);
    if (!resPending.success) {
      expect(resPending.error).toContain("Contractor must be ACTIVE");
    }

    // Clean up
    await prisma.contractor.delete({ where: { id: tempPendingCtr.id } });
  });

  it("4. Relational Integrity: Database foreign key constraints block orphaned records", async () => {
    // Attempt to insert a kitchen with a fabricated contractorId directly into Prisma
    await expect(
      prisma.kitchen.create({
        data: {
          name: "Direct DB Orphan Kitchen",
          contractorId: "fabricated-contractor-id-that-does-not-exist",
          status: "ACTIVE",
        },
      })
    ).rejects.toThrow();

    // Attempt to insert an observation with a fabricated kitchenId directly into Prisma
    await expect(
      prisma.observation.create({
        data: {
          kitchenId: "fabricated-kitchen-id-that-does-not-exist",
          mealId: "fake-meal-id",
          dishId: "fake-dish-id",
          totalCookedKg: 10,
        },
      })
    ).rejects.toThrow();
  });
});
