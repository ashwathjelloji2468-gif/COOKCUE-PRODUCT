import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import {
  getStaffBoardData,
  createStaffReport,
  updateHeadCookInstructions,
  resolveStaffReport,
} from "../src/server/actions/staff-board";
import { approveCookingPlan } from "../src/server/actions/morning-plan";

// Mock session module
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Staff Board Operational Interface (/kitchen/[kitchenId]/staff-board)", () => {
  const testKitchenId = "test-staff-board-kitchen-alpha";
  const otherKitchenId = "test-staff-board-kitchen-beta";
  const testContractorId = "test-staff-board-contractor";
  const testDate = "2026-11-28";

  let testMealId: string;
  let testDishId: string;
  let headCookUser: { id: string; email: string; name: string; role: "HEAD_COOK"; kitchenId: string };
  let staffUserAlpha: { id: string; email: string; name: string; role: "KITCHEN_STAFF"; kitchenId: string };
  let staffUserBeta: { id: string; email: string; name: string; role: "KITCHEN_STAFF"; kitchenId: string };
  let founderUser: { id: string; email: string; name: string; role: "FOUNDER" };

  beforeEach(async () => {
    // 1. Clean previous records
    await prisma.staffReport.deleteMany({ where: { kitchenId: { in: [testKitchenId, otherKitchenId] } } }).catch(() => {});
    await prisma.planOverrideAudit.deleteMany({ where: { planItem: { plan: { kitchenId: testKitchenId } } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: { in: ["sb-head-cook", "sb-staff-alpha", "sb-staff-beta", "sb-founder"] },
      },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: [testKitchenId, otherKitchenId] } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    // 2. Provision contractor & kitchens
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: { id: testContractorId, code: ctrCode, name: "Staff Board Catering Org", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenId, contractorId: testContractorId, name: "Station Alpha", location: "Block 1", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: otherKitchenId, contractorId: testContractorId, name: "Station Beta", location: "Block 2", status: "ACTIVE" },
    });

    // 3. Create Users
    const u1 = await prisma.user.create({
      data: {
        id: "sb-head-cook",
        email: "chef@staffboard.test",
        name: "Chef Rajesh",
        role: "HEAD_COOK",
        kitchenId: testKitchenId,
        code: "USR-000881",
      },
    });
    headCookUser = { id: u1.id, email: u1.email, name: u1.name!, role: "HEAD_COOK", kitchenId: testKitchenId };

    const u2 = await prisma.user.create({
      data: {
        id: "sb-staff-alpha",
        email: "staff_alpha@staffboard.test",
        name: "Staff Rohan",
        role: "KITCHEN_STAFF",
        kitchenId: testKitchenId,
        code: "USR-000882",
      },
    });
    staffUserAlpha = { id: u2.id, email: u2.email, name: u2.name!, role: "KITCHEN_STAFF", kitchenId: testKitchenId };

    const u3 = await prisma.user.create({
      data: {
        id: "sb-staff-beta",
        email: "staff_beta@staffboard.test",
        name: "Staff Sneha",
        role: "KITCHEN_STAFF",
        kitchenId: otherKitchenId,
        code: "USR-000883",
      },
    });
    staffUserBeta = { id: u3.id, email: u3.email, name: u3.name!, role: "KITCHEN_STAFF", kitchenId: otherKitchenId };

    const u4 = await prisma.user.create({
      data: {
        id: "sb-founder",
        email: "founder@staffboard.test",
        name: "Founder User",
        role: "FOUNDER",
        code: "USR-000884",
      },
    });
    founderUser = { id: u4.id, email: u4.email, name: u4.name!, role: "FOUNDER" };

    // 4. Provision Dish and Meal
    const dish = await prisma.dish.create({
      data: { kitchenId: testKitchenId, name: "Vegetable Biryani", unit: "kg" },
    });
    testDishId = dish.id;

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenId,
        mealType: "LUNCH",
        date: new Date(`${testDate}T00:00:00.000Z`),
        expectedDiners: 150,
      },
    });
    testMealId = meal.id;
  });

  it("1. Backend enforces kitchen assignment & allowed roles for Staff Board access", async () => {
    // A. Staff assigned to this kitchen can access
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const staffRes = await getStaffBoardData(testKitchenId, testDate);
    expect(staffRes.success).toBe(true);
    if (staffRes.success) {
      expect(staffRes.data.kitchen.id).toBe(testKitchenId);
      expect(staffRes.data.currentUser.id).toBe(staffUserAlpha.id);
      expect(staffRes.data.currentUser.role).toBe("KITCHEN_STAFF");
      expect(staffRes.data.currentUser.isHeadCook).toBe(false);
    }

    // B. Cross-kitchen staff access is rejected
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: false,
      error: "Forbidden: cross-kitchen access denied",
      statusCode: 403,
    });

    const crossRes = await getStaffBoardData(testKitchenId, testDate);
    expect(crossRes.success).toBe(false);
    expect(crossRes.statusCode).toBe(403);

    // C. Founder can access
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: founderUser.id,
        email: founderUser.email,
        name: founderUser.name,
        role: founderUser.role,
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const founderRes = await getStaffBoardData(testKitchenId, testDate);
    expect(founderRes.success).toBe(true);
  });

  it("2. Read-Only View of APPROVED cooking plan & Head Cook instructions", async () => {
    // 1. When plan is unapproved: approvedPlan reflects unapproved status
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const unapprovedBoard = await getStaffBoardData(testKitchenId, testDate);
    expect(unapprovedBoard.success).toBe(true);
    if (unapprovedBoard.success) {
      expect(unapprovedBoard.data.approvedPlan).toBeNull();
    }

    // 2. Approve plan as Head Cook
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    await approveCookingPlan(testKitchenId, testMealId, 150, [
      { dishId: testDishId, recommendedKg: 30, approvedKg: 32 },
    ]);

    // Post Head Cook instructions
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    await updateHeadCookInstructions(testKitchenId, testMealId, "Maintain 2:1 water ratio for Biryani rice");

    // 3. Staff reads approved plan
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const boardRes = await getStaffBoardData(testKitchenId, testDate);
    expect(boardRes.success).toBe(true);
    if (boardRes.success) {
      const plan = boardRes.data.approvedPlan;
      expect(plan).not.toBeNull();
      expect(plan?.isApproved).toBe(true);
      expect(plan?.expectedDiners).toBe(150);
      expect(plan?.instructions).toBe("Maintain 2:1 water ratio for Biryani rice");
      expect(plan?.items.length).toBe(1);
      expect(plan?.items[0].approvedKg).toBe(32);
      expect(plan?.items[0].dishName).toBe("Vegetable Biryani");
      expect(plan?.approverName).toBe(headCookUser.name);
    }
  });

  it("3. Live Staff Assignments: Returns users assigned to kitchenId from database", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await getStaffBoardData(testKitchenId, testDate);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.staffMembers.length).toBe(2);
      const roles = res.data.staffMembers.map((s) => s.role);
      expect(roles).toContain("HEAD_COOK");
      expect(roles).toContain("KITCHEN_STAFF");
      // Other kitchen staff (Sneha) must NOT appear
      const ids = res.data.staffMembers.map((s) => s.id);
      expect(ids).not.toContain(staffUserBeta.id);
    }
  });

  it("4. Task & Progress Reporting: Staff can add progress notes, quantity logs, and problem alerts", async () => {
    // A. Staff adds progress note
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const noteRes = await createStaffReport({
      kitchenId: testKitchenId,
      date: testDate,
      type: "PROGRESS",
      title: "Preparation started",
      content: "Vegetables cleaned and chopped for biryani",
    });
    expect(noteRes.success).toBe(true);

    // B. Staff logs intermediate quantity
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const qtyRes = await createStaffReport({
      kitchenId: testKitchenId,
      date: testDate,
      type: "QUANTITY_REPORT",
      title: "Batch 1 Cooked",
      content: "First batch of 16kg rice cooked and placed in warmer",
      dishId: testDishId,
      quantityKg: 16.0,
    });
    expect(qtyRes.success).toBe(true);

    // C. Staff reports problem (flagged for Head Cook)
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const problemRes = await createStaffReport({
      kitchenId: testKitchenId,
      date: testDate,
      type: "PROBLEM",
      title: "Burner 3 Flame Fluctuating",
      content: "Burner 3 gas pressure low, taking longer to boil",
    });
    expect(problemRes.success).toBe(true);
    if (!problemRes.success) return;

    // Verify reports on the board
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const boardRes = await getStaffBoardData(testKitchenId, testDate);
    expect(boardRes.success).toBe(true);
    if (boardRes.success) {
      expect(boardRes.data.reports.length).toBe(3);
      const problem = boardRes.data.reports.find((r) => r.type === "PROBLEM");
      expect(problem).toBeDefined();
      expect(problem?.flagged).toBe(true);
      expect(problem?.resolved).toBe(false);
      expect(problem?.createdBy.name).toBe("Staff Rohan");

      // Head Cook resolves problem
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: {
          id: headCookUser.id,
          email: headCookUser.email,
          name: headCookUser.name,
          role: headCookUser.role,
          contractorId: null,
          kitchenId: testKitchenId,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      });

      const resolveRes = await resolveStaffReport(testKitchenId, problem!.id);
      expect(resolveRes.success).toBe(true);

      const resolvedInDb = await prisma.staffReport.findUnique({
        where: { id: problem!.id },
      });
      expect(resolvedInDb?.resolved).toBe(true);
    }
  });

  it("5. Non-Head Cook cannot update plan instructions", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUserAlpha.id,
        email: staffUserAlpha.email,
        name: staffUserAlpha.name,
        role: staffUserAlpha.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await updateHeadCookInstructions(testKitchenId, testMealId, "Staff trying to set notes");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/Only Head Cooks/i);
    }
  });
});
