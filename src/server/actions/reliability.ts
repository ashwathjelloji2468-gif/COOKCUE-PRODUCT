"use server";

import { prisma } from "@/lib/prisma";
import {
  requireFounder,
  requireContractorAccess,
  requireKitchenAccess,
} from "@/lib/auth/session";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";
import { detectOperationalExceptions } from "@/server/actions/exceptions";
import {
  formatRelativeTime,
  formatExactDateTime,
  isCloseoutStale,
  isBaselineReady,
} from "@/lib/kitchen/reliability";

export type KitchenReliabilitySignal = {
  kitchenId: string;
  kitchenName: string;
  status: string;
  lastCloseoutAt: string | null;
  lastCloseoutRelative: string;
  lastCloseoutExact: string | null;
  lastPlanApprovedAt: string | null;
  lastPlanApprovedRelative: string;
  lastPlanApprovedExact: string | null;
  openExceptionsCount: number;
  eligibleObservationCount: number;
  recentEligibleCount: number;
  isBaselineReady: boolean;
  isStale: boolean;
};

const ELIGIBLE_FILTER = {
  OR: [
    { eligibilityStatus: "ELIGIBLE" },
    {
      eligibilityStatus: "",
      isStockout: false,
      isAbnormal: false,
      isExcluded: false,
      totalCookedKg: { not: null },
      unservedLeftoverKg: { not: null },
      actualDiners: { not: null, gt: 0 },
    },
  ],
};

/**
 * Shared internal helper to compute reliability signals for a list of kitchens.
 */
async function computeReliabilitySignalsForKitchens(
  kitchens: { id: string; name: string; status: string }[]
): Promise<KitchenReliabilitySignal[]> {
  if (kitchens.length === 0) return [];

  const kitchenIds = kitchens.map((k) => k.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    closeoutGrouped,
    approvedPlans,
    eligibleLifetimeGrouped,
    eligibleRecentGrouped,
    exceptions,
  ] = await Promise.all([
    // 1. Last closeout per kitchen (completed observations)
    prisma.observation.groupBy({
      by: ["kitchenId"],
      where: {
        kitchenId: { in: kitchenIds },
        totalCookedKg: { not: null },
      },
      _max: {
        createdAt: true,
      },
    }),
    // 2. Approved plans to find latest approved plan per kitchen
    prisma.cookingPlan.findMany({
      where: {
        kitchenId: { in: kitchenIds },
        OR: [{ status: "APPROVED" }, { approvalStatus: "APPROVED" }],
      },
      select: {
        kitchenId: true,
        firstApprovedAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    // 3. Eligible observations (lifetime)
    prisma.observation.groupBy({
      by: ["kitchenId"],
      where: {
        kitchenId: { in: kitchenIds },
        ...ELIGIBLE_FILTER,
      },
      _count: { _all: true },
    }),
    // 4. Eligible observations (last 7 days)
    prisma.observation.groupBy({
      by: ["kitchenId"],
      where: {
        kitchenId: { in: kitchenIds },
        createdAt: { gte: sevenDaysAgo },
        ...ELIGIBLE_FILTER,
      },
      _count: { _all: true },
    }),
    // 5. Open operational exceptions
    detectOperationalExceptions(kitchens.map((k) => ({ id: k.id, name: k.name }))).catch(
      () => []
    ),
  ]);

  // Index last closeouts
  const closeoutMap = new Map<string, Date>();
  for (const c of closeoutGrouped) {
    if (c._max.createdAt) {
      closeoutMap.set(c.kitchenId, c._max.createdAt);
    }
  }

  // Index latest approved plan per kitchen
  const latestApprovedPlanMap = new Map<string, Date>();
  for (const p of approvedPlans) {
    if (!latestApprovedPlanMap.has(p.kitchenId)) {
      const approvalDate = p.firstApprovedAt || p.updatedAt;
      latestApprovedPlanMap.set(p.kitchenId, approvalDate);
    }
  }

  // Index eligible counts
  const eligibleLifetimeMap = new Map(
    eligibleLifetimeGrouped.map((g) => [g.kitchenId, g._count._all])
  );
  const eligibleRecentMap = new Map(
    eligibleRecentGrouped.map((g) => [g.kitchenId, g._count._all])
  );

  // Index exceptions count
  const exceptionsMap = new Map<string, number>();
  for (const ex of exceptions) {
    exceptionsMap.set(ex.kitchenId, (exceptionsMap.get(ex.kitchenId) || 0) + 1);
  }

  return kitchens.map((k) => {
    const lastCloseoutDate = closeoutMap.get(k.id) ?? null;
    const lastPlanDate = latestApprovedPlanMap.get(k.id) ?? null;

    const lifetimeEligible = eligibleLifetimeMap.get(k.id) ?? 0;
    const recentEligible = eligibleRecentMap.get(k.id) ?? 0;
    const openExceptionsCount = exceptionsMap.get(k.id) ?? 0;

    const baselineReady = isBaselineReady(lifetimeEligible);
    const stale = isCloseoutStale(lastCloseoutDate, lastPlanDate);

    return {
      kitchenId: k.id,
      kitchenName: k.name,
      status: k.status || "ACTIVE",
      lastCloseoutAt: lastCloseoutDate ? lastCloseoutDate.toISOString() : null,
      lastCloseoutRelative: formatRelativeTime(lastCloseoutDate, "No closeout yet"),
      lastCloseoutExact: formatExactDateTime(lastCloseoutDate),
      lastPlanApprovedAt: lastPlanDate ? lastPlanDate.toISOString() : null,
      lastPlanApprovedRelative: formatRelativeTime(lastPlanDate, "No approved plan yet"),
      lastPlanApprovedExact: formatExactDateTime(lastPlanDate),
      openExceptionsCount,
      eligibleObservationCount: lifetimeEligible,
      recentEligibleCount: recentEligible,
      isBaselineReady: baselineReady,
      isStale: stale,
    };
  });
}

/**
 * Head Cook / Kitchen Staff: Get reliability signal for a single kitchen.
 * Requires kitchen access.
 */
export async function getKitchenReliabilitySignal(
  kitchenId: string
): Promise<
  | { success: true; data: KitchenReliabilitySignal }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, name: true, status: true },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen not found", statusCode: 404 };
    }

    const [signal] = await computeReliabilitySignalsForKitchens([kitchen]);
    return { success: true, data: signal };
  } catch (e) {
    return { success: false, error: "Failed to load kitchen reliability signal" };
  }
}

/**
 * Contractor Admin / Manager: Get reliability signals for all kitchens of a contractor.
 * Requires contractor access.
 */
export async function getContractorKitchenReliability(
  contractorIdOrCode: string
): Promise<
  | { success: true; data: KitchenReliabilitySignal[] }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireContractorAccess(contractorIdOrCode);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  const trimmed = contractorIdOrCode.trim();
  const isCode = isContractorCode(trimmed);

  try {
    const contractor = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmed)! } : { id: trimmed },
      select: {
        kitchens: {
          select: { id: true, name: true, status: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!contractor) {
      return { success: false, error: "Contractor organization not found", statusCode: 404 };
    }

    const signals = await computeReliabilitySignalsForKitchens(contractor.kitchens);
    return { success: true, data: signals };
  } catch (e) {
    return { success: false, error: "Failed to load contractor reliability signals" };
  }
}

/**
 * Founder: Get platform-wide reliability signals for all kitchens.
 * Requires founder access.
 */
export async function getFounderKitchenReliability(): Promise<
  | { success: true; data: KitchenReliabilitySignal[] }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  try {
    const kitchens = await prisma.kitchen.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });

    const signals = await computeReliabilitySignalsForKitchens(kitchens);
    return { success: true, data: signals };
  } catch (e) {
    return { success: false, error: "Failed to load founder reliability signals" };
  }
}
