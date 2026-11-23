"use server";

import { prisma } from "@/lib/prisma";
import type { CreateKitchenInput, KitchenSummary } from "@/lib/domain/types";
import { requireFounder } from "@/lib/auth/session";
import { safeRevalidatePath } from "@/lib/cache/revalidate";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";

export async function createKitchen(
  input: CreateKitchenInput
): Promise<{ success: true; data: KitchenSummary } | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  const { contractorId, name, location } = input;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Kitchen name is required" };
  }

  try {
    const trimmedContractor = contractorId.trim();
    const isCode = isContractorCode(trimmedContractor);

    const contractor = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmedContractor)! } : { id: trimmedContractor },
    });

    if (!contractor) {
      return { success: false, error: "Contractor not found" };
    }

    if (contractor.status !== "ACTIVE") {
      return {
        success: false,
        error: "Contractor must be ACTIVE before adding a kitchen.",
      };
    }

    const kitchen = await prisma.kitchen.create({
      data: {
        contractorId: contractor.id,
        name: name.trim(),
        location: location?.trim() || null,
        status: "ACTIVE",
      },
      include: {
        contractor: {
          select: { name: true },
        },
      },
    });

    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath(`/founder/contractors/${contractor.id}`);
    if (contractor.code) safeRevalidatePath(`/founder/contractors/${contractor.code}`);
    safeRevalidatePath(`/contractor/${contractor.id}`);
    if (contractor.code) safeRevalidatePath(`/contractor/${contractor.code}`);
    safeRevalidatePath("/founder/kitchens");
    safeRevalidatePath("/founder");

    return {
      success: true,
      data: {
        id: kitchen.id,
        name: kitchen.name,
        location: kitchen.location,
        status: kitchen.status,
        contractorId: kitchen.contractorId,
        contractorName: kitchen.contractor.name,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to create kitchen" };
  }
}

export async function listKitchensByContractor(
  contractorId: string
): Promise<{ success: true; data: KitchenSummary[] } | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  const trimmed = contractorId.trim();
  const isCode = isContractorCode(trimmed);

  try {
    let targetId = trimmed;
    if (isCode) {
      const contractor = await prisma.contractor.findUnique({
        where: { code: normalizeContractorCode(trimmed)! },
        select: { id: true },
      });
      if (!contractor) {
        return { success: false, error: "Contractor not found" };
      }
      targetId = contractor.id;
    }

    const kitchens = await prisma.kitchen.findMany({
      where: { contractorId: targetId },
      include: {
        contractor: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath(`/founder/contractors/${contractorId}`);
    safeRevalidatePath(`/contractor/${contractorId}`);
    safeRevalidatePath("/founder/kitchens");
    safeRevalidatePath("/founder");

    return {
      success: true,
      data: kitchens.map((k) => ({
        id: k.id,
        name: k.name,
        location: k.location,
        status: k.status,
        contractorId: k.contractorId,
        contractorName: k.contractor.name,
      })),
    };
  } catch (e) {
    return { success: false, error: "Failed to list kitchens" };
  }
}
