import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  createContractor,
  getContractorById,
  updateContractor,
  listContractors,
  searchContractorsAsFounder,
} from "../src/server/actions/contractor";
import { getContractorPortalData } from "../src/server/actions/contractor-portal";
import { getCurrentUserProfile } from "../src/server/actions/profile";

// Mock auth session to act as FOUNDER
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    requireAuth: vi.fn(),
    requireContractorAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import {
  requireFounder,
  requireAuth,
  requireContractorAccess,
  getSessionUser,
} from "../src/lib/auth/session";

describe("Contractor Saved Record Consistency Everywhere", () => {
  const ts = Date.now();
  const founderUserId = `founder-consistency-user-${ts}`;
  let contractorId: string;
  let contractorCode: string;

  beforeAll(async () => {
    // Setup Founder Auth mocks
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: founderUserId,
        email: `founder_${ts}@cookcue.test`,
        name: "Platform Founder",
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
        email: `founder_${ts}@cookcue.test`,
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  afterAll(async () => {
    if (contractorId) {
      await prisma.user.deleteMany({ where: { contractorId } });
      await prisma.kitchen.deleteMany({ where: { contractorId } });
      await prisma.contractor.deleteMany({ where: { id: contractorId } });
    }
  });

  it("1. createContractor saves contractor details and optional fields to the Prisma Contractor row", async () => {
    const res = await createContractor({
      name: `Integrity Catering ${ts}`,
      primaryContactName: "Aarav Sharma",
      contactEmail: "aarav@integritycatering.test",
      contactPhone: "+91 91234 56789",
      address: "Plot 42, HSR Layout, Bengaluru",
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);

    contractorId = res.data.id;
    contractorCode = res.data.code!;
    expect(contractorCode).toMatch(/^CTR-\d{6}$/);

    // Verify raw row in Prisma database
    const savedInDb = await prisma.contractor.findUnique({
      where: { id: contractorId },
    });

    expect(savedInDb).not.toBeNull();
    expect(savedInDb?.name).toBe(`Integrity Catering ${ts}`);
    expect(savedInDb?.code).toBe(contractorCode);
    expect(savedInDb?.primaryContactName).toBe("Aarav Sharma");
    expect(savedInDb?.contactEmail).toBe("aarav@integritycatering.test");
    expect(savedInDb?.contactPhone).toBe("+91 91234 56789");
    expect(savedInDb?.address).toBe("Plot 42, HSR Layout, Bengaluru");
  });

  it("2. Profile, Detail, Portal, and List all read from the same saved Prisma row", async () => {
    // A. Detail (getContractorById)
    const detailRes = await getContractorById(contractorId);
    expect(detailRes.success).toBe(true);
    if (!detailRes.success) throw new Error(detailRes.error);

    expect(detailRes.data.id).toBe(contractorId);
    expect(detailRes.data.code).toBe(contractorCode);
    expect(detailRes.data.name).toBe(`Integrity Catering ${ts}`);
    expect(detailRes.data.primaryContactName).toBe("Aarav Sharma");
    expect(detailRes.data.contactEmail).toBe("aarav@integritycatering.test");
    expect(detailRes.data.contactPhone).toBe("+91 91234 56789");
    expect(detailRes.data.address).toBe("Plot 42, HSR Layout, Bengaluru");

    // B. Portal (getContractorPortalData)
    vi.mocked(requireContractorAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: founderUserId,
        email: `founder_${ts}@cookcue.test`,
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const portalRes = await getContractorPortalData(contractorId);
    expect(portalRes.success).toBe(true);
    if (!portalRes.success) throw new Error(portalRes.error);

    expect(portalRes.data.contractor.id).toBe(contractorId);
    expect(portalRes.data.contractor.code).toBe(contractorCode);
    expect(portalRes.data.contractor.name).toBe(`Integrity Catering ${ts}`);
    expect(portalRes.data.contractor.primaryContactName).toBe("Aarav Sharma");
    expect(portalRes.data.contractor.contactEmail).toBe("aarav@integritycatering.test");

    // C. List & Search
    const searchRes = await searchContractorsAsFounder(contractorCode);
    expect(searchRes.success).toBe(true);
    if (!searchRes.success) throw new Error(searchRes.error);

    const foundInList = searchRes.data.find((c) => c.id === contractorId);
    expect(foundInList).toBeDefined();
    expect(foundInList?.code).toBe(contractorCode);
    expect(foundInList?.name).toBe(`Integrity Catering ${ts}`);
    expect(foundInList?.primaryContactName).toBe("Aarav Sharma");

    // D. Profile for contractor-assigned user
    const testContractorUserId = `contractor-mgr-${ts}`;
    await prisma.user.create({
      data: {
        id: testContractorUserId,
        email: `mgr_${ts}@integritycatering.test`,
        name: "Contractor Manager User",
        role: "CONTRACTOR_MANAGER",
        contractorId,
        code: `USR-999${String(ts).slice(-3)}`,
      },
    });

    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: testContractorUserId,
      email: `mgr_${ts}@integritycatering.test`,
      name: "Contractor Manager User",
      role: "CONTRACTOR_MANAGER",
      contractorId,
      kitchenId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const profileRes = await getCurrentUserProfile();
    expect(profileRes.success).toBe(true);
    if (!profileRes.success) throw new Error(profileRes.error);

    expect(profileRes.data.contractorId).toBe(contractorId);
    expect(profileRes.data.contractorCode).toBe(contractorCode);
    expect(profileRes.data.contractorName).toBe(`Integrity Catering ${ts}`);
  });

  it("3. Optional empty fields are stored as null (never inventing values)", async () => {
    const minimalRes = await createContractor({
      name: `Minimal Org ${ts}`,
      // optional fields omitted
    });

    expect(minimalRes.success).toBe(true);
    if (!minimalRes.success) throw new Error(minimalRes.error);

    const minimalId = minimalRes.data.id;

    const detailRes = await getContractorById(minimalId);
    expect(detailRes.success).toBe(true);
    if (!detailRes.success) throw new Error(detailRes.error);

    // Assert optional fields are null, not invented
    expect(detailRes.data.primaryContactName).toBeNull();
    expect(detailRes.data.contactEmail).toBeNull();
    expect(detailRes.data.contactPhone).toBeNull();
    expect(detailRes.data.address).toBeNull();

    // Clean up minimal contractor
    await prisma.contractor.delete({ where: { id: minimalId } });
  });

  it("4. updateContractor modifies the saved record and re-reads reflect updated fields", async () => {
    const updateRes = await updateContractor(contractorId, {
      name: `Updated Integrity Catering ${ts}`,
      primaryContactName: "Diya Patel",
      contactEmail: "diya@integritycatering.test",
      contactPhone: "+91 99999 88888",
      address: "Tech Park, Koramangala, Bengaluru",
    });

    expect(updateRes.success).toBe(true);
    if (!updateRes.success) throw new Error(updateRes.error);

    expect(updateRes.data.name).toBe(`Updated Integrity Catering ${ts}`);
    expect(updateRes.data.primaryContactName).toBe("Diya Patel");
    expect(updateRes.data.contactEmail).toBe("diya@integritycatering.test");
    expect(updateRes.data.contactPhone).toBe("+91 99999 88888");
    expect(updateRes.data.address).toBe("Tech Park, Koramangala, Bengaluru");

    // Verify detail immediately reads updated values
    const detailRes = await getContractorById(contractorId);
    expect(detailRes.success).toBe(true);
    if (!detailRes.success) throw new Error(detailRes.error);

    expect(detailRes.data.name).toBe(`Updated Integrity Catering ${ts}`);
    expect(detailRes.data.primaryContactName).toBe("Diya Patel");
  });
});
