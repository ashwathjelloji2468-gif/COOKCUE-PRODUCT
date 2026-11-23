import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { createContractor, listContractors, getContractorById } from "../src/server/actions/contractor";
import { generateNextContractorCode, backfillContractorCodes } from "../src/server/actions/contractor-code";
import { createKitchen } from "../src/server/actions/kitchen-setup";

// Mock session user to FOUNDER for founder-level execution
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    requireAuth: vi.fn(),
  };
});

import { requireFounder, requireAuth } from "../src/lib/auth/session";

describe("Permanent Human-Readable Contractor Codes (CTR-######)", () => {
  const founderUserId = "test-founder-contractor-code-user";

  beforeEach(() => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: founderUserId,
        email: "founder@cookcue.test",
        name: "Founder Admin",
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
        id: founderUserId,
        email: "founder@cookcue.test",
        name: "Founder Admin",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  it("1. createContractor auto-generates sequential zero-padded 6-digit codes (CTR-000001 format)", async () => {
    const timestamp = Date.now();
    const name1 = `Org Alpha ${timestamp}`;
    const name2 = `Org Beta ${timestamp}`;

    const res1 = await createContractor({ name: name1 });
    expect(res1.success).toBe(true);
    if (!res1.success) return;

    expect(res1.data.code).toBeDefined();
    expect(res1.data.code).toMatch(/^CTR-\d{6}$/);

    const res2 = await createContractor({ name: name2 });
    expect(res2.success).toBe(true);
    if (!res2.success) return;

    expect(res2.data.code).toBeDefined();
    expect(res2.data.code).toMatch(/^CTR-\d{6}$/);

    const num1 = parseInt(res1.data.code!.replace("CTR-", ""), 10);
    const num2 = parseInt(res2.data.code!.replace("CTR-", ""), 10);
    expect(num2).toBe(num1 + 1);

    // Verify DB persistence
    const saved = await prisma.contractor.findUnique({
      where: { id: res1.data.id },
    });
    expect(saved?.code).toBe(res1.data.code);

    // Clean up
    await prisma.contractor.deleteMany({ where: { id: { in: [res1.data.id, res2.data.id] } } });
  });

  it("2. generateNextContractorCode computes max existing numeric suffix + 1 and never reuses codes", async () => {
    const tempId1 = `temp-ctr-test-${Date.now()}-1`;
    const tempId2 = `temp-ctr-test-${Date.now()}-2`;

    const code1 = await generateNextContractorCode();
    const num1 = parseInt(code1.replace("CTR-", ""), 10);
    const expectedCode2 = `CTR-${String(num1 + 1).padStart(6, "0")}`;
    const expectedCode3 = `CTR-${String(num1 + 2).padStart(6, "0")}`;

    try {
      await prisma.contractor.create({
        data: {
          id: tempId1,
          name: `High Range Org 1 ${Date.now()}`,
          code: code1,
          status: "ACTIVE",
        },
      });

      const nextCode = await generateNextContractorCode();
      expect(nextCode).toBe(expectedCode2);

      await prisma.contractor.create({
        data: {
          id: tempId2,
          name: `High Range Org 2 ${Date.now()}`,
          code: nextCode,
          status: "ACTIVE",
        },
      });

      const nextCode2 = await generateNextContractorCode();
      expect(nextCode2).toBe(expectedCode3);
    } finally {
      await prisma.contractor.deleteMany({ where: { id: { in: [tempId1, tempId2] } } });
    }
  });

  it("3. Contractor code is strictly required (non-null) and backfill handles clean state", async () => {
    // Attempting to create without a code should fail at DB constraint level
    await expect(
      (prisma.contractor.create as any)({
        data: {
          name: `Null Code Contractor ${Date.now()}`,
          code: null,
        },
      })
    ).rejects.toThrow();

    const backfillRes = await backfillContractorCodes();
    expect(backfillRes.backfilledCount).toBe(0);
  });

  it("4. Kitchen foreign keys remain intact: kitchens still link to contractor cuid primary key", async () => {
    const ts = Date.now();
    const createRes = await createContractor({ name: `Kitchen Link Org ${ts}` });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const contractorCuid = createRes.data.id;
    const contractorCode = createRes.data.code;

    // Activate contractor so kitchen creation succeeds
    await prisma.contractor.update({
      where: { id: contractorCuid },
      data: { status: "ACTIVE" },
    });

    // Create a kitchen using the cuid
    const kitchenRes = await createKitchen({
      contractorId: contractorCuid,
      name: `Facility Alpha ${ts}`,
      location: "Tower 1",
    });
    expect(kitchenRes.success).toBe(true);
    if (!kitchenRes.success) return;

    // Verify kitchen in DB references the cuid, while contractor retains code
    const kitchenInDb = await prisma.kitchen.findUnique({
      where: { id: kitchenRes.data.id },
      include: { contractor: true },
    });

    expect(kitchenInDb?.contractorId).toBe(contractorCuid);
    expect(kitchenInDb?.contractor.code).toBe(contractorCode);

    // Verify detail action exposes both cuid and code
    const detailRes = await getContractorById(contractorCuid);
    expect(detailRes.success).toBe(true);
    if (detailRes.success) {
      expect(detailRes.data.id).toBe(contractorCuid);
      expect(detailRes.data.code).toBe(contractorCode);
      expect(detailRes.data.kitchens.length).toBe(1);
    }

    // Clean up
    await prisma.kitchen.deleteMany({ where: { id: kitchenRes.data.id } });
    await prisma.contractor.deleteMany({ where: { id: contractorCuid } });
  });
});
