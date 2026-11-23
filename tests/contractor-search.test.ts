import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock session guard to control requireFounder for testing authorization
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
  };
});

import { requireFounder } from "@/lib/auth/session";
import { searchContractorsAsFounder, createContractor } from "@/server/actions/contractor";

describe("Contractor Search as Founder (Problem 4)", () => {
  const ts = Date.now();
  const founderUserId = `founder-search-test-${ts}`;

  let contractorAId: string;
  let contractorACode: string;
  let contractorBId: string;
  let contractorBCode: string;

  beforeAll(async () => {
    // Default authorized as founder
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: founderUserId,
        email: `founder_${ts}@cookcue.test`,
        name: "Test Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Create two real contractors in live Postgres
    const resA = await createContractor({
      name: `Apex Catering ${ts}`,
    });
    expect(resA.success).toBe(true);
    if (!resA.success) throw new Error(resA.error);
    contractorAId = resA.data.id;
    contractorACode = resA.data.code!;

    const resB = await createContractor({
      name: `Blue Horizon Hospitality ${ts}`,
    });
    expect(resB.success).toBe(true);
    if (!resB.success) throw new Error(resB.error);
    contractorBId = resB.data.id;
    contractorBCode = resB.data.code!;
  });

  beforeEach(() => {
    // Reset requireFounder mock to authorized by default before each test
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: founderUserId,
        email: `founder_${ts}@cookcue.test`,
        name: "Test Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  it("1. Server action requires Founder authorization (rejects non-founders)", async () => {
    // Simulate non-founder rejection
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: false,
      error: "Forbidden: role HEAD_COOK does not have required permissions",
      statusCode: 403,
    });

    const res = await searchContractorsAsFounder("Apex");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Forbidden|Unauthorized/i);

    // Simulate unauthenticated rejection
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: false,
      error: "Authentication required",
      statusCode: 401,
    });

    const unauthRes = await searchContractorsAsFounder("Apex");
    expect(unauthRes.success).toBe(false);
  });

  it("2. Matches Contractor.code exactly (case-insensitive)", async () => {
    // Exact uppercase code match
    const matchRes = await searchContractorsAsFounder(contractorACode);
    expect(matchRes.success).toBe(true);
    if (!matchRes.success) return;

    expect(matchRes.data.length).toBeGreaterThanOrEqual(1);
    const found = matchRes.data.find((c) => c.id === contractorAId);
    expect(found).toBeDefined();
    expect(found?.code).toBe(contractorACode);
    expect(found?.name).toBe(`Apex Catering ${ts}`);
    expect(found?.status).toBe("PENDING");

    // Exact lowercase code match
    const lowerRes = await searchContractorsAsFounder(contractorACode.toLowerCase());
    expect(lowerRes.success).toBe(true);
    if (!lowerRes.success) return;
    expect(lowerRes.data.some((c) => c.id === contractorAId)).toBe(true);

    // Code that does not match should not find Contractor A
    const noMatchCodeRes = await searchContractorsAsFounder("CTR-99999999");
    expect(noMatchCodeRes.success).toBe(true);
    if (!noMatchCodeRes.success) return;
    expect(noMatchCodeRes.data.some((c) => c.id === contractorAId)).toBe(false);
  });

  it("3. Matches Contractor.name with case-insensitive partial substring match", async () => {
    // Substring match: 'horizon'
    const nameRes = await searchContractorsAsFounder("horizon");
    expect(nameRes.success).toBe(true);
    if (!nameRes.success) return;

    const foundB = nameRes.data.find((c) => c.id === contractorBId);
    expect(foundB).toBeDefined();
    expect(foundB?.code).toBe(contractorBCode);
    expect(foundB?.name).toBe(`Blue Horizon Hospitality ${ts}`);

    // Contractor A ('Apex') should not match query 'horizon'
    expect(nameRes.data.some((c) => c.id === contractorAId)).toBe(false);

    // Substring match: 'APEX' (uppercase)
    const apexRes = await searchContractorsAsFounder("APEX");
    expect(apexRes.success).toBe(true);
    if (!apexRes.success) return;
    expect(apexRes.data.some((c) => c.id === contractorAId)).toBe(true);
    expect(apexRes.data.some((c) => c.id === contractorBId)).toBe(false);
  });

  it("4. Empty state: returns empty array when query matches neither code nor name", async () => {
    const res = await searchContractorsAsFounder(`NonExistentContractorXYZ_${ts}`);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBe(0);
  });

  it("5. Results include code, name, status, and id (link to detail target)", async () => {
    const res = await searchContractorsAsFounder(`Apex Catering ${ts}`);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const found = res.data.find((c) => c.id === contractorAId);
    expect(found).toBeDefined();
    expect(found?.id).toBe(contractorAId);
    expect(found?.name).toBe(`Apex Catering ${ts}`);
    expect(found?.code).toMatch(/^CTR-\d{6}$/);
    expect(found?.status).toBeDefined();
  });
});
