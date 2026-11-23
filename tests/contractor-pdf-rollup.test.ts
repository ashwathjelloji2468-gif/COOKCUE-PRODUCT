import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";
import { generateWeeklyScorecardPdfBuffer } from "../src/lib/pdf/weekly-report";
import { getContractorWeeklyScorecardPdf } from "../src/server/actions/scorecard";
import { GET as weeklyReportRoute } from "../src/app/api/contractor/[contractorId]/weekly-report/route";
import { NextRequest } from "next/server";

// Mock authentication session
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireContractorAccess: vi.fn(),
    requireFounder: vi.fn(),
  };
});

import { requireContractorAccess, requireFounder } from "../src/lib/auth/session";

describe("WAVE 3 / T3-B — Contractor Weekly PDF Rollup", () => {
  const testContractorIdA = "test-pdf-ctr-a";
  const testContractorIdB = "test-pdf-ctr-b";
  const testKitchenIdA1 = "test-pdf-kitchen-a1";
  const testKitchenIdA2 = "test-pdf-kitchen-a2";
  const testKitchenIdB = "test-pdf-kitchen-b";
  const testDishId = "test-pdf-dish-1";

  const todayStr = toServiceDateString(new Date());
  const todayMidnight = normalizeServiceDate(todayStr);

  beforeAll(async () => {
    const kIds = [testKitchenIdA1, testKitchenIdA2, testKitchenIdB];
    const cIds = [testContractorIdA, testContractorIdB];

    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: { in: cIds } } }).catch(() => {});

    // Contractor A with 2 kitchens
    const codeA = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorIdA,
        code: codeA,
        name: "Apex Culinary Group",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenIdA1,
              name: "Apex Downtown Station",
              location: "Floor 2, Building A",
              status: "ACTIVE",
            },
            {
              id: testKitchenIdA2,
              name: "Apex Campus Hub",
              location: "West Wing Hub",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    // Contractor B with 1 kitchen
    const codeB = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorIdB,
        code: codeB,
        name: "Zenith Food Services",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenIdB,
              name: "Zenith Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    await prisma.dish.create({
      data: {
        id: testDishId,
        kitchenId: testKitchenIdA1,
        name: "Pilaf Rice",
        unit: "kg",
      },
    });

    // Create an approved meal with closeout observation for Kitchen A1
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA1,
        date: todayMidnight,
        mealType: "LUNCH",
        expectedDiners: 120,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA1,
        mealId: meal.id,
        expectedDiners: 120,
        status: "APPROVED",
        approvalStatus: "APPROVED",
      },
    });

    await prisma.observation.create({
      data: {
        kitchenId: testKitchenIdA1,
        mealId: meal.id,
        dishId: testDishId,
        totalCookedKg: 25,
        unservedLeftoverKg: 1.5,
        actualDiners: 115,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });
  });

  afterAll(async () => {
    const kIds = [testKitchenIdA1, testKitchenIdA2, testKitchenIdB];
    const cIds = [testContractorIdA, testContractorIdB];

    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: { in: cIds } } }).catch(() => {});
  });

  it("1. Generates a valid PDF binary buffer using PDFKit with standard fonts", async () => {
    const mockScorecard = {
      weekStart: "2026-11-10",
      weekEnd: "2026-11-16",
      contractor: {
        id: testContractorIdA,
        code: "CTR-000088",
        name: "Apex Culinary Group",
      },
      kitchens: [
        {
          kitchenId: testKitchenIdA1,
          name: "Apex Downtown Station",
          location: "Floor 2",
          status: "ACTIVE",
          closeoutCompliancePct: 100,
          approvedPlansCount: 5,
          approvedWithCloseoutCount: 5,
          plansApprovedOnTimeCount: 5,
          plansDraftOrMissingCount: 0,
          stockoutDays: 0,
          eligibleObservationCount: 4,
          openExceptionsCount: 0,
        },
        {
          kitchenId: testKitchenIdA2,
          name: "Apex Campus Hub",
          location: "West Wing",
          status: "ACTIVE",
          closeoutCompliancePct: null, // Unclosed honest "—"
          approvedPlansCount: 0,
          approvedWithCloseoutCount: 0,
          plansApprovedOnTimeCount: 0,
          plansDraftOrMissingCount: 2,
          stockoutDays: 1,
          eligibleObservationCount: 0,
          openExceptionsCount: 1,
        },
      ],
    };

    const pdfBuffer = await generateWeeklyScorecardPdfBuffer(mockScorecard);

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Standard PDF header signature check
    expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  it("2. Handles contractor with 0 kitchens honestly without throwing", async () => {
    const emptyScorecard = {
      weekStart: "2026-11-10",
      weekEnd: "2026-11-16",
      contractor: {
        id: "ctr-empty",
        code: "CTR-000000",
        name: "Empty Org",
      },
      kitchens: [],
    };

    const pdfBuffer = await generateWeeklyScorecardPdfBuffer(emptyScorecard);
    expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(500);
  });

  it("3. Server action getContractorWeeklyScorecardPdf returns base64 and filename for owner", async () => {
    vi.mocked(requireContractorAccess).mockResolvedValueOnce({
      success: true,
      user: { id: "u-a", role: "CONTRACTOR_ADMIN", contractorId: testContractorIdA } as any,
      contractorId: testContractorIdA,
    });

    const res = await getContractorWeeklyScorecardPdf(testContractorIdA);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.contentType).toBe("application/pdf");
    expect(res.data.filename).toMatch(/CookCue-Weekly-Report-CTR-\d{6}-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(typeof res.data.base64).toBe("string");

    const decoded = Buffer.from(res.data.base64, "base64");
    expect(decoded.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  it("4. API route /api/contractor/[id]/weekly-report returns application/pdf for authorized contractor", async () => {
    vi.mocked(requireContractorAccess).mockResolvedValue({
      success: true,
      user: { id: "u-a", role: "CONTRACTOR_ADMIN", contractorId: testContractorIdA } as any,
      contractorId: testContractorIdA,
    });

    const req = new NextRequest(`http://localhost:3000/api/contractor/${testContractorIdA}/weekly-report`);
    const response = await weeklyReportRoute(req, {
      params: Promise.resolve({ contractorId: testContractorIdA }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment; filename=");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  it("5. API route denies cross-tenant access to unauthorized contractor", async () => {
    vi.mocked(requireContractorAccess).mockResolvedValueOnce({
      success: false,
      error: "Access denied: Unauthorized contractor organization",
      statusCode: 403,
    });

    const req = new NextRequest(`http://localhost:3000/api/contractor/${testContractorIdB}/weekly-report`);
    const response = await weeklyReportRoute(req, {
      params: Promise.resolve({ contractorId: testContractorIdB }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Access denied");
  });

  it("6. Server action denies cross-tenant access when contractor access check fails", async () => {
    vi.mocked(requireContractorAccess).mockResolvedValueOnce({
      success: false,
      error: "Access denied: Unauthorized contractor organization",
      statusCode: 403,
    });

    const res = await getContractorWeeklyScorecardPdf("forbidden-contractor");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.statusCode).toBe(403);
    }
  });
});
