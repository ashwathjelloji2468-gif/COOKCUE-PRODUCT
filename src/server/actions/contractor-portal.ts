"use server";

import { prisma } from "@/lib/prisma";
import { requireContractorAccess } from "@/lib/auth/session";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";
import {
  formatRelativeTime,
  formatExactDateTime,
  isCloseoutStale,
  isBaselineReady,
} from "@/lib/kitchen/reliability";

export type ContractorPortalKitchen = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  observationCount: number;
  stockoutCount: number;
  eligibleCount: number;
  lastCloseoutAt: string | null;
  lastCloseoutRelative: string;
  lastCloseoutExact: string | null;
  lastPlanApprovedAt: string | null;
  lastPlanApprovedRelative: string;
  lastPlanApprovedExact: string | null;
  isBaselineReady: boolean;
  isStale: boolean;
};

export type ContractorPortalData = {
  contractor: {
    id: string;
    code?: string | null;
    name: string;
    status: string;
    primaryContactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  };
  counts: {
    kitchenCount: number;
    observationCount: number;
    stockoutCount: number;
  };
  kitchens: ContractorPortalKitchen[];
  isFounder: boolean;
};

export async function getContractorPortalData(contractorIdOrCode: string): Promise<
  | { success: true; data: ContractorPortalData }
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
      include: {
        kitchens: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
            observations: {
              select: {
                id: true,
                createdAt: true,
                totalCookedKg: true,
                unservedLeftoverKg: true,
                actualDiners: true,
                isStockout: true,
                isAbnormal: true,
                isExcluded: true,
                eligibilityStatus: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!contractor) {
      return { success: false, error: "Contractor organization not found", statusCode: 404 };
    }

    const kitchenIds = contractor.kitchens.map((k) => k.id);
    const approvedPlans = await prisma.cookingPlan.findMany({
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
    });

    const latestApprovedPlanMap = new Map<string, Date>();
    for (const p of approvedPlans) {
      if (!latestApprovedPlanMap.has(p.kitchenId)) {
        const approvalDate = p.firstApprovedAt || p.updatedAt;
        latestApprovedPlanMap.set(p.kitchenId, approvalDate);
      }
    }

    let totalObservations = 0;
    let totalStockouts = 0;

    const kitchens: ContractorPortalKitchen[] = contractor.kitchens.map((k) => {
      const obsCount = k.observations.length;
      const stockouts = k.observations.filter((o) => o.isStockout).length;
      totalObservations += obsCount;
      totalStockouts += stockouts;

      // Filter eligible observations
      const eligibleCount = k.observations.filter((o) => {
        if (o.eligibilityStatus === "ELIGIBLE") return true;
        if (
          o.eligibilityStatus === "" &&
          !o.isStockout &&
          !o.isAbnormal &&
          !o.isExcluded &&
          o.totalCookedKg !== null &&
          o.unservedLeftoverKg !== null &&
          (o.actualDiners ?? 0) > 0
        ) {
          return true;
        }
        return false;
      }).length;

      // Find latest completed observation (closeout)
      const latestCloseoutObs = k.observations.find((o) => o.totalCookedKg !== null);
      const lastCloseoutDate = latestCloseoutObs?.createdAt ?? null;
      const lastPlanDate = latestApprovedPlanMap.get(k.id) ?? null;

      const baselineReady = isBaselineReady(eligibleCount);
      const stale = isCloseoutStale(lastCloseoutDate, lastPlanDate);

      return {
        id: k.id,
        name: k.name,
        location: k.location,
        status: k.status,
        observationCount: obsCount,
        stockoutCount: stockouts,
        eligibleCount,
        lastCloseoutAt: lastCloseoutDate ? lastCloseoutDate.toISOString() : null,
        lastCloseoutRelative: formatRelativeTime(lastCloseoutDate, "No closeout yet"),
        lastCloseoutExact: formatExactDateTime(lastCloseoutDate),
        lastPlanApprovedAt: lastPlanDate ? lastPlanDate.toISOString() : null,
        lastPlanApprovedRelative: formatRelativeTime(lastPlanDate, "No approved plan yet"),
        lastPlanApprovedExact: formatExactDateTime(lastPlanDate),
        isBaselineReady: baselineReady,
        isStale: stale,
      };
    });

    return {
      success: true,
      data: {
        contractor: {
          id: contractor.id,
          code: contractor.code,
          name: contractor.name,
          status: contractor.status,
          primaryContactName: contractor.primaryContactName,
          contactEmail: contractor.contactEmail,
          contactPhone: contractor.contactPhone,
          address: contractor.address,
        },
        counts: {
          kitchenCount: kitchens.length,
          observationCount: totalObservations,
          stockoutCount: totalStockouts,
        },
        kitchens,
        isFounder: auth.user.role === "FOUNDER",
      },
    };
  } catch (error) {
    console.error("Failed to load contractor portal data:", error);
    return { success: false, error: "Failed to load contractor portal data" };
  }
}
