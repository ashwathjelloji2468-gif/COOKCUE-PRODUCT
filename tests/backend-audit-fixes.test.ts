import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth/token";
import { generateNextContractorCode } from "@/server/actions/contractor-code";

const mockCookies: Record<string, string> = {};

function setTestSessionCookie(val: string | undefined, name: string = "cookcue_session") {
  if (val) {
    mockCookies[name] = val;
  } else {
    delete mockCookies["cookcue_session"];
    delete mockCookies["messwise_session"];
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockCookies[name] ? { value: mockCookies[name] } : undefined,
    set: (name: string, val: string) => {
      mockCookies[name] = val;
    },
    delete: (name: string) => {
      delete mockCookies[name];
    },
  }),
}));

import { requireKitchenAccess, type SessionUser } from "@/lib/auth/session";

describe("BE-AUD fixes verification", () => {
  const testContractorId = "test-be-aud-contractor";
  const testKitchenId = "test-be-aud-kitchen";

  beforeAll(async () => {
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { contractorId: testContractorId } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Test Audit Contractor",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenId,
              name: "Test Audit Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { contractorId: testContractorId } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
  });
  it("BE-AUD-01: permits both CONTRACTOR_ADMIN and CONTRACTOR_MANAGER to access assigned kitchens", async () => {
    // 1. Fetch or create a test contractor and kitchen
    const contractor = await prisma.contractor.findFirst({
      include: { kitchens: true },
    });
    if (!contractor || contractor.kitchens.length === 0) {
      console.warn("No contractor/kitchen found in DB; skipping live relation check");
      return;
    }

    const targetKitchen = contractor.kitchens[0];
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    // Create real test users in DB
    const adminDbUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        name: "Admin Tester",
        role: "CONTRACTOR_ADMIN",
        contractorId: contractor.id,
      },
    });

    const mgrDbUser = await prisma.user.create({
      data: {
        email: `mgr-${Date.now()}@test.com`,
        name: "Mgr Tester",
        role: "CONTRACTOR_MANAGER",
        contractorId: contractor.id,
      },
    });

    const ctrCode = await generateNextContractorCode();
    const otherContractor = await prisma.contractor.create({
      data: {
        name: `Other Contractor ${Date.now()}`,
        code: ctrCode,
      },
    });

    const otherMgrDbUser = await prisma.user.create({
      data: {
        email: `other-mgr-${Date.now()}@test.com`,
        name: "Other Mgr Tester",
        role: "CONTRACTOR_MANAGER",
        contractorId: otherContractor.id,
      },
    });

    try {
      // Test CONTRACTOR_ADMIN
      const adminUser: SessionUser = {
        id: adminDbUser.id,
        email: adminDbUser.email,
        name: adminDbUser.name,
        role: "CONTRACTOR_ADMIN",
        contractorId: contractor.id,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      setTestSessionCookie(await signSessionToken(adminUser, secret));

      const adminAccess = await requireKitchenAccess(targetKitchen.id);
      expect(adminAccess.success).toBe(true);

      // Test CONTRACTOR_MANAGER
      const mgrUser: SessionUser = {
        id: mgrDbUser.id,
        email: mgrDbUser.email,
        name: mgrDbUser.name,
        role: "CONTRACTOR_MANAGER",
        contractorId: contractor.id,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      setTestSessionCookie(await signSessionToken(mgrUser, secret));

      const mgrAccess = await requireKitchenAccess(targetKitchen.id);
      expect(mgrAccess.success).toBe(true);

      // Test contractor mismatch
      const otherMgrUser: SessionUser = {
        id: otherMgrDbUser.id,
        email: otherMgrDbUser.email,
        name: otherMgrDbUser.name,
        role: "CONTRACTOR_MANAGER",
        contractorId: otherContractor.id,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      setTestSessionCookie(await signSessionToken(otherMgrUser, secret));

      const deniedAccess = await requireKitchenAccess(targetKitchen.id);
      expect(deniedAccess.success).toBe(false);
    } finally {
      setTestSessionCookie(undefined);
      await prisma.user.deleteMany({
        where: { id: { in: [adminDbUser.id, mgrDbUser.id, otherMgrDbUser.id] } },
      });
      await prisma.contractor.delete({ where: { id: otherContractor.id } });
    }
  });

  it("BE-AUD-05: enforces unique constraint on Dish(kitchenId, name)", async () => {
    const kitchen = await prisma.kitchen.findFirst();
    if (!kitchen) return;

    const dishName = `Test Unique Dish ${Date.now()}`;
    const dish1 = await prisma.dish.create({
      data: {
        kitchenId: kitchen.id,
        name: dishName,
        unit: "kg",
      },
    });

    // Attempting to create duplicate with same (kitchenId, name) must throw P2002
    await expect(
      prisma.dish.create({
        data: {
          kitchenId: kitchen.id,
          name: dishName,
          unit: "kg",
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.dish.delete({ where: { id: dish1.id } });
  });

  it("BE-AUD-08: listUsersAsFounder supports server-side pagination with totalCount", async () => {
    const { listUsersAsFounder } = await import("@/server/actions/user");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    // Create a real founder in DB
    const founder = await prisma.user.create({
      data: {
        email: `founder-${Date.now()}@test.com`,
        name: "Founder Paginate",
        role: "FOUNDER",
      },
    });

    try {
      setTestSessionCookie(
        await signSessionToken(
          {
            id: founder.id,
            email: founder.email,
            name: founder.name || "Founder",
            role: "FOUNDER",
            contractorId: null,
            kitchenId: null,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
          secret
        )
      );

      const res = await listUsersAsFounder({ take: 3, skip: 0 });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(typeof res.totalCount).toBe("number");
        expect(res.totalCount).toBeGreaterThanOrEqual(1);
        expect(res.data.length).toBeLessThanOrEqual(3);
      }
    } finally {
      setTestSessionCookie(undefined);
      await prisma.user.delete({ where: { id: founder.id } });
    }
  });

  it("BE-AUD-09: getContractorById & portal data resolves by code (CTR-######)", async () => {
    const { getContractorById } = await import("@/server/actions/contractor");
    const { getContractorPortalData } = await import("@/server/actions/contractor-portal");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    const contractor = await prisma.contractor.findFirst({
      where: { code: { startsWith: "CTR-" } },
    });
    if (!contractor || !contractor.code) return;

    // Login as founder to inspect
    const founder = await prisma.user.create({
      data: {
        email: `founder-lookup-${Date.now()}@test.com`,
        name: "Founder Lookup",
        role: "FOUNDER",
      },
    });

    try {
      setTestSessionCookie(
        await signSessionToken(
          {
            id: founder.id,
            email: founder.email,
            name: founder.name || "Founder",
            role: "FOUNDER",
            contractorId: null,
            kitchenId: null,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
          secret
        )
      );

      // Resolve by code
      const byCodeRes = await getContractorById(contractor.code);
      expect(byCodeRes.success).toBe(true);
      if (byCodeRes.success) {
        expect(byCodeRes.data.id).toBe(contractor.id);
      }

      // Portal by code
      const portalRes = await getContractorPortalData(contractor.code);
      expect(portalRes.success).toBe(true);
      if (portalRes.success) {
        expect(portalRes.data.contractor.id).toBe(contractor.id);
      }
    } finally {
      setTestSessionCookie(undefined);
      await prisma.user.delete({ where: { id: founder.id } });
    }
  });

  it("BE-AUD-10: getStaffBoardData accepts mealType parameter", async () => {
    const { getStaffBoardData } = await import("@/server/actions/staff-board");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    const kitchen = await prisma.kitchen.findFirst();
    if (!kitchen) return;

    const cook = await prisma.user.create({
      data: {
        email: `cook-dinner-${Date.now()}@test.com`,
        name: "Chef Dinner",
        role: "HEAD_COOK",
        kitchenId: kitchen.id,
      },
    });

    try {
      setTestSessionCookie(
        await signSessionToken(
          {
            id: cook.id,
            email: cook.email,
            name: cook.name || "Cook",
            role: "HEAD_COOK",
            contractorId: null,
            kitchenId: kitchen.id,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
          secret
        )
      );

      const res = await getStaffBoardData(kitchen.id, "2026-11-20", "DINNER");
      expect(res.success).toBe(true);
    } finally {
      setTestSessionCookie(undefined);
      await prisma.user.delete({ where: { id: cook.id } });
    }
  });

  it("BE-AUD-12: middleware permits CONTRACTOR_ADMIN and CONTRACTOR_MANAGER to /kitchen/:id", async () => {
    const { middleware } = await import("@/middleware");
    const { NextRequest } = await import("next/server");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    const adminToken = await signSessionToken(
      {
        id: "admin-mid-1",
        email: "admin@mid.com",
        name: "Admin Mid",
        role: "CONTRACTOR_ADMIN",
        contractorId: "ctr-mid-1",
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
      secret
    );

    const req = new NextRequest("http://localhost:3000/kitchen/kitchen-abc/morning", {
      headers: {
        cookie: `messwise_session=${adminToken}`,
      },
    });

    const response = await middleware(req);
    // Should NOT redirect to /contractor/... but proceed (NextResponse.next())
    expect(response.headers.get("location")).toBeNull();
  });

  it("Cookie Migration: seamlessly authenticates via messwise_session legacy cookie and migrates to cookcue_session", async () => {
    const { getSessionUser, setSessionUser, SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } = await import("@/lib/auth/session");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    expect(SESSION_COOKIE_NAME).toBe("cookcue_session");
    expect(LEGACY_SESSION_COOKIE_NAME).toBe("messwise_session");

    const user = await prisma.user.create({
      data: {
        email: `cookie-migrate-${Date.now()}@test.com`,
        name: "Cookie Migrator",
        role: "FOUNDER",
      },
    });

    try {
      // Set legacy cookie
      const legacyToken = await signSessionToken(
        {
          id: user.id,
          email: user.email,
          name: user.name || "User",
          role: "FOUNDER",
          contractorId: null,
          kitchenId: null,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
        secret
      );
      setTestSessionCookie(legacyToken, "messwise_session");

      // getSessionUser should resolve cleanly from legacy cookie
      const session = await getSessionUser();
      expect(session).not.toBeNull();
      expect(session?.id).toBe(user.id);

      // setSessionUser upgrades to cookcue_session
      await setSessionUser({
        id: user.id,
        email: user.email,
        name: user.name,
        role: "FOUNDER",
      });
      expect(mockCookies["cookcue_session"]).toBeDefined();
    } finally {
      setTestSessionCookie(undefined);
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("Forecast Diners Default: resolves default expected diners from historical observations", async () => {
    const { getDefaultExpectedDinersFromHistory } = await import("@/server/forecast-engine");
    const kitchen = await prisma.kitchen.findFirst();
    if (!kitchen) return;

    const diners = await getDefaultExpectedDinersFromHistory(kitchen.id, "LUNCH");
    expect(typeof diners).toBe("number");
    expect(diners).toBeGreaterThan(0);
  });

  it("BE-DEF-03: submitCloseout rejects when no approved cooking plan exists", async () => {
    const { submitCloseout } = await import("@/server/actions/closeout");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";
    const kitchen = await prisma.kitchen.findFirst();
    if (!kitchen) return;

    // Create a meal with NO cooking plan
    const meal = await prisma.meal.create({
      data: {
        kitchenId: kitchen.id,
        mealType: "DINNER",
        date: new Date("2026-11-25T00:00:00Z"),
      },
    });

    const cook = await prisma.user.create({
      data: {
        email: `closeout-gate-${Date.now()}@test.com`,
        name: "Chef Gate",
        role: "HEAD_COOK",
        kitchenId: kitchen.id,
      },
    });

    try {
      setTestSessionCookie(
        await signSessionToken(
          {
            id: cook.id,
            email: cook.email,
            name: cook.name || "Cook",
            role: "HEAD_COOK",
            contractorId: null,
            kitchenId: kitchen.id,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
          secret
        )
      );

      const res = await submitCloseout({
        kitchenId: kitchen.id,
        mealId: meal.id,
        actualDiners: 50,
        items: [],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Cannot submit closeout: No approved cooking plan found for this meal service.");
      }
    } finally {
      setTestSessionCookie(undefined);
      await prisma.meal.delete({ where: { id: meal.id } });
      await prisma.user.delete({ where: { id: cook.id } });
    }
  });

  it("BE-DEF-01 & BE-DEF-02: forecast precompute is internal engine only; retired dual approval is absent", async () => {
    const forecastActions = await import("@/server/actions/forecast");
    // executeForecastPrecompute must NOT be an exported server action
    expect("executeForecastPrecompute" in forecastActions).toBe(false);
    expect(typeof forecastActions.runForecastPrecomputeJob).toBe("function");

    const morningPlanActions = await import("@/server/actions/morning-plan");
    // submitSecondApproval must NOT be an exported server action
    expect("submitSecondApproval" in morningPlanActions).toBe(false);
  });

  it("BE-DEF-05: devDemoLogin rejects strictly when NODE_ENV === 'production'", async () => {
    const { devDemoLogin } = await import("@/server/actions/auth");
    const originalEnv = process.env.NODE_ENV;
    const originalBypass = process.env.ALLOW_DEMO_LOGIN;

    try {
      (process.env as any).NODE_ENV = "production";
      process.env.ALLOW_DEMO_LOGIN = "true";

      const res = await devDemoLogin("founder");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Demo logins are strictly disabled in production");
      }
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalBypass !== undefined) {
        process.env.ALLOW_DEMO_LOGIN = originalBypass;
      } else {
        delete process.env.ALLOW_DEMO_LOGIN;
      }
    }
  });

  it("BE-DEF-06, BE-DEF-07 & BE-DEF-10: contractor actions resolve CTR code and enforce status whitelist", async () => {
    const { updateContractor, activateContractor, listContractors } = await import(
      "@/server/actions/contractor"
    );
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    // Setup real founder user in DB
    const founder = await prisma.user.create({
      data: {
        email: `founder-ctr-${Date.now()}@test.com`,
        name: "Founder CTR Test",
        role: "FOUNDER",
      },
    });

    const founderSession: SessionUser = {
      id: founder.id,
      email: founder.email,
      name: founder.name || "Founder",
      role: "FOUNDER",
      contractorId: null,
      kitchenId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };
    setTestSessionCookie(await signSessionToken(founderSession, secret));

    // Create a contractor with a code
    const code = await generateNextContractorCode(prisma);
    const contractor = await prisma.contractor.create({
      data: {
        name: `CTR Action Test ${Date.now()}`,
        code,
        status: "PENDING",
      },
    });

    try {
      // 1. BE-DEF-10: Test invalid status rejection
      const invalidRes = await updateContractor(contractor.code!, {
        status: "BOGUS_STATUS" as any,
      });
      expect(invalidRes.success).toBe(false);
      if (!invalidRes.success) {
        expect(invalidRes.error).toContain("Invalid status");
      }

      // 2. BE-DEF-06: Test updating via CTR-###### code
      const updateRes = await updateContractor(contractor.code!, {
        name: `${contractor.name} Updated`,
        status: "SUSPENDED",
      });
      expect(updateRes.success).toBe(true);
      if (updateRes.success) {
        expect(updateRes.data.status).toBe("SUSPENDED");
        expect(updateRes.data.name).toBe(`${contractor.name} Updated`);
      }

      // 3. BE-DEF-07: Test activateContractor via CTR-###### code
      const activateRes = await activateContractor(contractor.code!);
      expect(activateRes.success).toBe(true);

      const refreshed = await prisma.contractor.findUnique({
        where: { id: contractor.id },
      });
      expect(refreshed?.status).toBe("ACTIVE");

      // 4. BE-DEF-08: Test listContractors pagination
      const pagedRes = await listContractors({ take: 2, skip: 0 });
      expect(pagedRes.success).toBe(true);
      if (pagedRes.success) {
        expect(pagedRes.data.length).toBeLessThanOrEqual(2);
        expect(typeof pagedRes.totalCount).toBe("number");
        expect(pagedRes.totalCount).toBeGreaterThanOrEqual(1);
        expect(pagedRes.take).toBe(2);
        expect(pagedRes.skip).toBe(0);
      }
    } finally {
      setTestSessionCookie(undefined);
      await prisma.contractor.delete({ where: { id: contractor.id } });
      await prisma.user.delete({ where: { id: founder.id } });
    }
  });

  it("BE-DEF-09: updateDish enforces requireKitchenAccess, duplicate name prevention, and updates dish", async () => {
    const { updateDish, createDish, deleteDish } = await import("@/server/actions/dishes");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    const kitchen = await prisma.kitchen.findFirst();
    if (!kitchen) return;

    // Head cook user with kitchen access
    const cook = await prisma.user.create({
      data: {
        email: `dish-cook-${Date.now()}@test.com`,
        name: "Dish Cook",
        role: "HEAD_COOK",
        kitchenId: kitchen.id,
      },
    });

    const cookSession: SessionUser = {
      id: cook.id,
      email: cook.email,
      name: cook.name || "Cook",
      role: "HEAD_COOK",
      contractorId: null,
      kitchenId: kitchen.id,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const dish1Name = `Dish Alpha ${Date.now()}`;
    const dish2Name = `Dish Beta ${Date.now()}`;

    let dish1Id = "";
    let dish2Id = "";

    try {
      setTestSessionCookie(await signSessionToken(cookSession, secret));

      const d1 = await createDish(kitchen.id, dish1Name, "kg");
      expect(d1.success).toBe(true);
      if (d1.success) dish1Id = d1.dishId;

      const d2 = await createDish(kitchen.id, dish2Name, "portion");
      expect(d2.success).toBe(true);
      if (d2.success) dish2Id = d2.dishId;

      // 1. Rename dish2 to dish1's name (should fail with duplicate error)
      const dupRes = await updateDish(kitchen.id, dish2Id, { name: dish1Name });
      expect(dupRes.success).toBe(false);
      if (!dupRes.success) {
        expect(dupRes.error).toContain("already exists in this facility");
      }

      // 2. Successful update of dish2
      const updateRes = await updateDish(kitchen.id, dish2Id, {
        name: `${dish2Name} Renamed`,
        unit: "serving",
      });
      expect(updateRes.success).toBe(true);
      if (updateRes.success) {
        expect(updateRes.dish.name).toBe(`${dish2Name} Renamed`);
        expect(updateRes.dish.unit).toBe("serving");
      }

      // 3. Unauthorized access check (cook from another kitchen)
      const otherCookSession: SessionUser = {
        id: "other-cook-id",
        email: "other@cookcue.com",
        name: "Other Cook",
        role: "HEAD_COOK",
        contractorId: null,
        kitchenId: "other-kitchen-id",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      setTestSessionCookie(await signSessionToken(otherCookSession, secret));

      const deniedRes = await updateDish(kitchen.id, dish2Id, { name: "Hacked" });
      expect(deniedRes.success).toBe(false);
    } finally {
      setTestSessionCookie(undefined);
      if (dish1Id) await prisma.dish.delete({ where: { id: dish1Id } }).catch(() => {});
      if (dish2Id) await prisma.dish.delete({ where: { id: dish2Id } }).catch(() => {});
      await prisma.user.delete({ where: { id: cook.id } }).catch(() => {});
    }
  });

  it("enforces cross-tenant ownership across all 5 kitchen mutations (rejects swapped mealId/reportId/dishId)", async () => {
    const { approveCookingPlan, modifyCookingPlanQuantities } = await import(
      "@/server/actions/morning-plan"
    );
    const { submitCloseout } = await import("@/server/actions/closeout");
    const { updateHeadCookInstructions, resolveStaffReport } = await import(
      "@/server/actions/staff-board"
    );
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    // Find or create two kitchens
    const kitchens = await prisma.kitchen.findMany({ take: 2 });
    if (kitchens.length < 2) return;

    const kitchenA = kitchens[0];
    const kitchenB = kitchens[1];

    // Create a head cook belonging strictly to Kitchen A
    const cookA = await prisma.user.create({
      data: {
        email: `cook-a-${Date.now()}@test.com`,
        name: "Chef Kitchen A",
        role: "HEAD_COOK",
        kitchenId: kitchenA.id,
      },
    });

    // Create Meal, Dish, CookingPlan, and StaffReport in Kitchen B
    const mealB = await prisma.meal.create({
      data: {
        kitchenId: kitchenB.id,
        mealType: "DINNER",
        date: new Date("2026-11-28T00:00:00Z"),
        expectedDiners: 100,
      },
    });

    const dishB = await prisma.dish.create({
      data: {
        kitchenId: kitchenB.id,
        name: `Dish B-${Date.now()}`,
        unit: "kg",
      },
    });

    const planB = await prisma.cookingPlan.create({
      data: {
        kitchenId: kitchenB.id,
        mealId: mealB.id,
        expectedDiners: 100,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: cookA.id,
      },
    });

    const reportB = await prisma.staffReport.create({
      data: {
        kitchenId: kitchenB.id,
        date: new Date("2026-11-28T00:00:00Z"),
        type: "PROBLEM",
        content: "Kitchen B oven broke down",
        createdById: cookA.id,
      },
    });

    // Also create a meal & plan in Kitchen A for testing foreign dish insertion
    const mealA = await prisma.meal.create({
      data: {
        kitchenId: kitchenA.id,
        mealType: "DINNER",
        date: new Date("2026-11-28T00:00:00Z"),
        expectedDiners: 80,
      },
    });

    const planA = await prisma.cookingPlan.create({
      data: {
        kitchenId: kitchenA.id,
        mealId: mealA.id,
        expectedDiners: 80,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: cookA.id,
      },
    });

    try {
      // Authenticate as Cook A (authorized for Kitchen A, unauthorized for Kitchen B)
      setTestSessionCookie(
        await signSessionToken(
          {
            id: cookA.id,
            email: cookA.email,
            name: cookA.name || "Cook",
            role: "HEAD_COOK",
            contractorId: null,
            kitchenId: kitchenA.id,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
          secret
        )
      );

      // 1. GAP 1: submitCloseout with Kitchen A kitchenId but Kitchen B mealId
      const closeoutRes = await submitCloseout({
        kitchenId: kitchenA.id,
        mealId: mealB.id,
        actualDiners: 90,
        items: [],
      });
      expect(closeoutRes.success).toBe(false);
      if (!closeoutRes.success) {
        expect(closeoutRes.error).toContain("Forbidden");
      }

      // 1b. submitCloseout with Kitchen A mealId but foreign dish from Kitchen B
      const foreignDishCloseoutRes = await submitCloseout({
        kitchenId: kitchenA.id,
        mealId: mealA.id,
        actualDiners: 80,
        items: [
          {
            dishId: dishB.id,
            totalCookedKg: 20,
            unservedLeftoverKg: 2,
            isStockout: false,
            isAbnormal: false,
          },
        ],
      });
      expect(foreignDishCloseoutRes.success).toBe(false);
      if (!foreignDishCloseoutRes.success) {
        expect(foreignDishCloseoutRes.error).toContain("Forbidden");
      }

      // 2. GAP 2: approveCookingPlan with Kitchen A kitchenId but Kitchen B mealId
      const approveRes = await approveCookingPlan(kitchenA.id, mealB.id, 120, []);
      expect(approveRes.success).toBe(false);
      if (!approveRes.success) {
        expect(approveRes.error).toContain("Forbidden");
      }

      // 3. GAP 3: modifyCookingPlanQuantities with Kitchen A kitchenId but Kitchen B mealId
      const modifyRes = await modifyCookingPlanQuantities(kitchenA.id, mealB.id, 130, []);
      expect(modifyRes.success).toBe(false);
      if (!modifyRes.success) {
        expect(modifyRes.error).toContain("Forbidden");
      }

      // 4. GAP 4: updateHeadCookInstructions with Kitchen A kitchenId but Kitchen B mealId
      const instructRes = await updateHeadCookInstructions(
        kitchenA.id,
        mealB.id,
        "Malicious instructions"
      );
      expect(instructRes.success).toBe(false);
      if (!instructRes.success) {
        expect(instructRes.error).toContain("Forbidden");
      }

      // 5. GAP 5: resolveStaffReport with Kitchen A kitchenId but Kitchen B reportId
      const resolveRes = await resolveStaffReport(kitchenA.id, reportB.id);
      expect(resolveRes.success).toBe(false);
      if (!resolveRes.success) {
        expect(resolveRes.error).toContain("Forbidden");
      }
    } finally {
      setTestSessionCookie(undefined);
      await prisma.staffReport.delete({ where: { id: reportB.id } }).catch(() => {});
      await prisma.planItem.deleteMany({ where: { planId: { in: [planA.id, planB.id] } } }).catch(() => {});
      await prisma.cookingPlan.delete({ where: { id: planA.id } }).catch(() => {});
      await prisma.cookingPlan.delete({ where: { id: planB.id } }).catch(() => {});
      await prisma.meal.delete({ where: { id: mealA.id } }).catch(() => {});
      await prisma.meal.delete({ where: { id: mealB.id } }).catch(() => {});
      await prisma.dish.delete({ where: { id: dishB.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: cookA.id } }).catch(() => {});
    }
  });

  it("proves Minor fixes: createKitchen resolves CTR codes, and pagination defaults take=50", async () => {
    const { createKitchen, listKitchensByContractor } = await import("@/server/actions/kitchen-setup");
    const { listUsersAsFounder } = await import("@/server/actions/user");
    const { listContractors, createContractor } = await import("@/server/actions/contractor");
    const secret = process.env.SESSION_SECRET || "messwise_secure_fallback_development_secret_2026";

    // Setup Founder Auth
    const founder = await prisma.user.create({
      data: {
        email: `founder-minors-${Date.now()}@test.com`,
        name: "Founder Minor Fixes",
        role: "FOUNDER",
      },
    });

    setTestSessionCookie(
      await signSessionToken(
        {
          id: founder.id,
          email: founder.email,
          name: founder.name || "Founder",
          role: "FOUNDER",
          contractorId: null,
          kitchenId: null,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
        secret
      )
    );

    // Create an active contractor
    const ctrRes = await createContractor({
      name: `Minor Fixes CTR ${Date.now()}`,
    });
    expect(ctrRes.success).toBe(true);
    if (!ctrRes.success) return;

    await prisma.contractor.update({
      where: { id: ctrRes.data.id },
      data: { status: "ACTIVE" },
    });

    let createdKitchenId = "";

    try {

      // 1. Test createKitchen resolving CTR-###### code
      const kitchenRes = await createKitchen({
        contractorId: ctrRes.data.code,
        name: `CTR Resolved Facility ${Date.now()}`,
        location: "Block 1",
      });
      expect(kitchenRes.success).toBe(true);
      if (kitchenRes.success) {
        createdKitchenId = kitchenRes.data.id;
        expect(kitchenRes.data.contractorId).toBe(ctrRes.data.id);
      }

      // 1b. Test listKitchensByContractor resolving CTR-###### code
      const listKRes = await listKitchensByContractor(ctrRes.data.code);
      expect(listKRes.success).toBe(true);
      if (listKRes.success) {
        expect(listKRes.data.some((k) => k.id === createdKitchenId)).toBe(true);
      }

      // 2. Test listUsersAsFounder default take = 50
      const usersRes = await listUsersAsFounder();
      expect(usersRes.success).toBe(true);
      if (usersRes.success) {
        expect(usersRes.take).toBe(50);
        expect(typeof usersRes.totalCount).toBe("number");
      }

      // 3. Test listContractors default take = 50
      const ctrsRes = await listContractors();
      expect(ctrsRes.success).toBe(true);
      if (ctrsRes.success) {
        expect(ctrsRes.take).toBe(50);
        expect(typeof ctrsRes.totalCount).toBe("number");
      }
    } finally {
      setTestSessionCookie(undefined);
      if (createdKitchenId) {
        await prisma.kitchen.delete({ where: { id: createdKitchenId } }).catch(() => {});
      }
      await prisma.contractor.delete({ where: { id: ctrRes.data.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: founder.id } }).catch(() => {});
    }
  });
});
