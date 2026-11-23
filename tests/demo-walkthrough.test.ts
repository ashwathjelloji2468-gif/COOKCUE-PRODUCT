import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getDemoKitchenIdAsFounder,
  runSeedDemoAsFounder,
  runPurgeDemoAsFounder,
} from "../src/server/actions/demo-walkthrough";
import { DEMO_TOUR_STEPS } from "../src/lib/domain/demo-tour";

// Mock session module to test role-based access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireFounder, getSessionUser } from "../src/lib/auth/session";

describe("Demo Walkthrough Feature (Founder-Only)", () => {
  let currentRole: string = "FOUNDER";

  beforeEach(() => {
    currentRole = "FOUNDER";

    vi.mocked(requireFounder).mockImplementation(async () => {
      if (currentRole !== "FOUNDER") {
        return { success: false, error: "Forbidden: Founder access required" };
      }
      return {
        success: true,
        user: {
          id: "test-founder-user",
          email: "cookcue149@gmail.com",
          name: "Platform Founder",
          role: "FOUNDER",
          contractorId: null,
          kitchenId: null,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      };
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      id: "test-founder-user",
      email: "cookcue149@gmail.com",
      name: "Platform Founder",
      role: "FOUNDER",
      contractorId: null,
      kitchenId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
  });

  afterAll(async () => {
    // Clean demo records if created during test
    await prisma.kitchenServiceTemplate.deleteMany({
      where: { kitchenId: { in: ["seed-kitchen-1", "seed-kitchen-2"] } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: ["seed-kitchen-1", "seed-kitchen-2"] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: "headcook@central-kitchen-a.com" },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: ["seed-kitchen-1", "seed-kitchen-2"] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: "seed-contractor-1" },
    }).catch(() => {});
  });

  it("1. requireFounder strictly blocks non-founder roles from triggering seed, purge, or detection", async () => {
    currentRole = "HEAD_COOK";

    const seedRes = await runSeedDemoAsFounder();
    expect(seedRes.success).toBe(false);
    if (!seedRes.success) {
      expect(seedRes.error).toContain("Founder access required");
    }

    const purgeRes = await runPurgeDemoAsFounder();
    expect(purgeRes.success).toBe(false);
    if (!purgeRes.success) {
      expect(purgeRes.error).toContain("Founder access required");
    }

    const detectRes = await getDemoKitchenIdAsFounder();
    expect(detectRes.success).toBe(false);
    if (!detectRes.success) {
      expect(detectRes.error).toContain("Founder access required");
    }
  });

  it("2. Founder can seed demo dataset and detect demo kitchen ID", async () => {
    currentRole = "FOUNDER";

    const seedRes = await runSeedDemoAsFounder();
    expect(seedRes.success).toBe(true);
    if (!seedRes.success) return;

    expect(seedRes.data.demoKitchenId).toBe("seed-kitchen-1");

    const detectRes = await getDemoKitchenIdAsFounder();
    expect(detectRes.success).toBe(true);
    if (!detectRes.success) return;

    expect(detectRes.data).not.toBeNull();
    expect(detectRes.data?.id).toBe("seed-kitchen-1");
  });

  it("3. Validates the 6 ordered tour steps and URL routing", () => {
    expect(DEMO_TOUR_STEPS).toHaveLength(6);

    const testKid = "k-demo-123";

    expect(DEMO_TOUR_STEPS[0].getPath(testKid)).toBe("/founder");
    expect(DEMO_TOUR_STEPS[1].getPath(testKid)).toBe("/founder/contractors");
    expect(DEMO_TOUR_STEPS[2].getPath(testKid)).toBe(`/kitchen/${testKid}/morning`);
    expect(DEMO_TOUR_STEPS[3].getPath(testKid)).toBe(`/kitchen/${testKid}/staff-board`);
    expect(DEMO_TOUR_STEPS[4].getPath(testKid)).toBe(`/kitchen/${testKid}/closeout`);
    expect(DEMO_TOUR_STEPS[5].getPath(testKid)).toBe("/founder/monitoring");

    // All steps have concise coach text
    DEMO_TOUR_STEPS.forEach((step) => {
      expect(step.coach.length).toBeGreaterThan(20);
      expect(step.title.length).toBeGreaterThan(3);
    });
  });

  it("4. Founder can safely purge demo data", async () => {
    currentRole = "FOUNDER";

    const purgeRes = await runPurgeDemoAsFounder();
    expect(purgeRes.success).toBe(true);

    const checkKitchen = await prisma.kitchen.findUnique({
      where: { id: "seed-kitchen-1" },
    });
    expect(checkKitchen).toBeNull();
  });
});
