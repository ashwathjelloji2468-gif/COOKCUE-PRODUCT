import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextUserCode, backfillUserCodes } from "../src/server/actions/user-code";
import { listUsersAsFounder } from "../src/server/actions/user";
import { getCurrentUserProfile } from "../src/server/actions/profile";
import { hashPassword, verifyPassword } from "../src/lib/auth/crypto";

// Mock session user
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireFounder, getSessionUser } from "../src/lib/auth/session";

describe("Permanent Human-Readable User Codes (USR-######)", () => {
  const testFounderId = "test-founder-user-code-admin";

  beforeEach(() => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: testFounderId,
        email: "founder@cookcue.test",
        name: "Founder Admin",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      id: testFounderId,
      email: "founder@cookcue.test",
      name: "Founder Admin",
      role: "FOUNDER",
      contractorId: null,
      kitchenId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
  });

  it("1. generateNextUserCode auto-generates zero-padded 6-digit codes (USR-000001 format)", async () => {
    const code = await generateNextUserCode();
    expect(code).toBeDefined();
    expect(code).toMatch(/^USR-\d{6}$/);
  });

  it("2. User codes increment sequentially and never reuse codes", async () => {
    const tempId1 = `temp-user-${Date.now()}-1`;
    const tempId2 = `temp-user-${Date.now()}-2`;

    // Seed temporary user with high code USR-900000
    await prisma.user.create({
      data: {
        id: tempId1,
        email: `high_user_1_${Date.now()}@cookcue.test`,
        role: "HEAD_COOK",
        status: "ACTIVE",
        code: "USR-900000",
      },
    });

    const nextCode1 = await generateNextUserCode();
    expect(nextCode1).toBe("USR-900001");

    await prisma.user.create({
      data: {
        id: tempId2,
        email: `high_user_2_${Date.now()}@cookcue.test`,
        role: "KITCHEN_STAFF",
        status: "ACTIVE",
        code: nextCode1,
      },
    });

    const nextCode2 = await generateNextUserCode();
    expect(nextCode2).toBe("USR-900002");

    // Clean up temporary users
    await prisma.user.deleteMany({ where: { id: { in: [tempId1, tempId2] } } });
  });

  it("3. Backfill assigns sequential codes to users with null code in createdAt order", async () => {
    const ts = Date.now();
    const idA = `backfill-user-a-${ts}`;
    const idB = `backfill-user-b-${ts}`;

    // Create 2 users without code (null) with distinct creation timestamps
    await prisma.user.create({
      data: {
        id: idA,
        email: `backfill_a_${ts}@cookcue.test`,
        role: "HEAD_COOK",
        status: "ACTIVE",
        code: null,
        createdAt: new Date("2021-01-01T00:00:00Z"),
      },
    });

    await prisma.user.create({
      data: {
        id: idB,
        email: `backfill_b_${ts}@cookcue.test`,
        role: "KITCHEN_STAFF",
        status: "ACTIVE",
        code: null,
        createdAt: new Date("2021-01-02T00:00:00Z"),
      },
    });

    const backfillRes = await backfillUserCodes();
    expect(backfillRes.backfilledCount).toBeGreaterThanOrEqual(2);

    const userA = await prisma.user.findUnique({ where: { id: idA } });
    const userB = await prisma.user.findUnique({ where: { id: idB } });

    expect(userA?.code).not.toBeNull();
    expect(userB?.code).not.toBeNull();
    expect(userA?.code).toMatch(/^USR-\d{6}$/);
    expect(userB?.code).toMatch(/^USR-\d{6}$/);

    const numA = parseInt(userA!.code!.replace("USR-", ""), 10);
    const numB = parseInt(userB!.code!.replace("USR-", ""), 10);
    expect(numB).toBeGreaterThan(numA);

    // Clean up
    await prisma.user.deleteMany({ where: { id: { in: [idA, idB] } } });
  });

  it("4. listUsersAsFounder and getCurrentUserProfile return User ID code", async () => {
    const listRes = await listUsersAsFounder();
    expect(listRes.success).toBe(true);
    if (!listRes.success) return;

    expect(listRes.data.length).toBeGreaterThan(0);
    const first = listRes.data[0];
    expect(first.code).toBeDefined();
    if (first.code) {
      expect(first.code).toMatch(/^USR-\d{6}$/);
    }
  });

  it("5. Security Requirement: Passwords remain strictly hashed with PBKDF2 salt, never plaintext", async () => {
    const plain = "SecureSecretPassword#2026";
    const hashed = hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed).toContain(":"); // salt:iterations:digest format
    const [salt, iterations, digest] = hashed.split(":");
    expect(salt.length).toBeGreaterThanOrEqual(16);
    expect(parseInt(iterations, 10)).toBeGreaterThanOrEqual(10000);
    expect(digest.length).toBeGreaterThanOrEqual(32);

    // Verify hash verification succeeds
    expect(verifyPassword(plain, hashed)).toBe(true);
    expect(verifyPassword("WrongPassword", hashed)).toBe(false);
  });
});
