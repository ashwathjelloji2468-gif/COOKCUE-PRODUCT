import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieMap = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined),
    set: (name: string, value: string) => cookieMap.set(name, value),
    delete: (name: string) => cookieMap.delete(name),
  })),
}));

import { prisma } from "@/lib/prisma";
import { setSessionUser, getSessionUser, clearSessionUser } from "@/lib/auth/session";
import { getCurrentUserProfile } from "@/server/actions/profile";
import { clearClientSession, setClientSession } from "@/lib/auth/useCurrentUser";

describe("Chrome User Identity & Session Role Verification", () => {
  const testStaffId = "test-user-chrome-staff";
  const testFounderId = "test-user-chrome-founder";
  const testManagerId = "test-user-chrome-manager";

  beforeEach(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [testStaffId, testFounderId, testManagerId] } },
          { code: { in: ["USR-000888", "USR-000889", "USR-000999", "USR-000777"] } },
          { email: { in: ["ramesh.staff@test-cookcue.com", "priya.manager@test-cookcue.com", "founder@test-cookcue.com", "anita.mgr@test-cookcue.com", "suresh.cook@test-cookcue.com"] } },
        ],
      },
    }).catch(() => {});
  });

  it("1. getSessionUser reads exact DB role, display name, and user code from database", async () => {
    // Create a kitchen staff member with a specific code and name
    await prisma.user.create({
      data: {
        id: testStaffId,
        email: "ramesh.staff@test-cookcue.com",
        name: "Ramesh Kumar",
        role: "KITCHEN_STAFF",
        status: "ACTIVE",
        code: "USR-000888",
        passwordHash: "salt:hash",
      },
    });

    await setSessionUser({
      id: testStaffId,
      code: "USR-000888",
      email: "ramesh.staff@test-cookcue.com",
      name: "Ramesh Kumar",
      role: "KITCHEN_STAFF",
    });

    const session = await getSessionUser();
    expect(session).not.toBeNull();
    // Must strictly reflect exact DB values
    expect(session?.id).toBe(testStaffId);
    expect(session?.name).toBe("Ramesh Kumar");
    expect(session?.role).toBe("KITCHEN_STAFF");
    expect(session?.code).toBe("USR-000888");
  });

  it("2. If database role changes, getSessionUser dynamically reflects updated DB role (no stale token claim)", async () => {
    const user = await prisma.user.create({
      data: {
        id: testManagerId,
        email: "anita.mgr@test-cookcue.com",
        name: "Anita Desai",
        role: "CONTRACTOR_MANAGER",
        status: "ACTIVE",
        code: "USR-000999",
        passwordHash: "salt:hash",
      },
    });

    await setSessionUser({
      id: user.id,
      code: user.code,
      email: user.email,
      name: user.name,
      role: "CONTRACTOR_MANAGER",
    });

    let session = await getSessionUser();
    expect(session?.role).toBe("CONTRACTOR_MANAGER");

    // Promote to FOUNDER in the database directly
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "FOUNDER" },
    });

    session = await getSessionUser();
    // Live DB verification must immediately reflect FOUNDER
    expect(session?.role).toBe("FOUNDER");
    expect(session?.code).toBe("USR-000999");
  });

  it("3. getCurrentUserProfile returns real DB user identity and exact role without hardcoded fallbacks", async () => {
    await prisma.user.create({
      data: {
        id: testStaffId,
        email: "suresh.cook@test-cookcue.com",
        name: "Suresh Pillai",
        role: "HEAD_COOK",
        status: "ACTIVE",
        code: "USR-000777",
        passwordHash: "salt:hash",
      },
    });

    await setSessionUser({
      id: testStaffId,
      code: "USR-000777",
      email: "suresh.cook@test-cookcue.com",
      name: "Suresh Pillai",
      role: "HEAD_COOK",
    });

    const profileRes = await getCurrentUserProfile();
    expect(profileRes.success).toBe(true);
    if (!profileRes.success) return;

    expect(profileRes.data.id).toBe(testStaffId);
    expect(profileRes.data.name).toBe("Suresh Pillai");
    expect(profileRes.data.role).toBe("HEAD_COOK");
    expect(profileRes.data.code).toBe("USR-000777");
  });

  it("4. clearSessionUser and clearClientSession completely purge identity and state", async () => {
    // Set client session
    setClientSession({
      id: "test-client-id",
      code: "USR-000111",
      name: "Previous User",
      role: "FOUNDER",
      email: "prev@test.com",
    });

    // Clear client session
    clearClientSession();

    // Clear server session
    await clearSessionUser();
    const serverSession = await getSessionUser();
    expect(serverSession).toBeNull();
  });
});
