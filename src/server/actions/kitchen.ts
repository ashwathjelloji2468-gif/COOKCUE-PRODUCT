"use server";

import { prisma } from "@/lib/prisma";
import type { KitchenSearchResult } from "@/lib/domain/types";
import { requireFounder, requireKitchenAccess } from "@/lib/auth/session";

export async function getKitchenById(
  id: string
): Promise<
  | {
      success: true;
      data: {
        id: string;
        name: string;
        location: string | null;
        status: string;
        contractorId: string;
        contractorName: string;
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(id);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id },
      include: {
        contractor: {
          select: { name: true },
        },
      },
    });

    if (!kitchen) return { success: false, error: "Kitchen not found" };

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
    return { success: false, error: "Failed to fetch kitchen" };
  }
}

export async function searchKitchensAsFounder(
  query: string
): Promise<{ success: true; data: KitchenSearchResult[] } | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const kitchens = await prisma.kitchen.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { id: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        contractor: {
          select: { name: true },
        },
      },
      take: 20,
    });

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
    return { success: false, error: "Failed to search kitchens" };
  }
}

export async function getKitchenByIdAsFounder(
  id: string
): Promise<
  | {
      success: true;
      data: {
        id: string;
        name: string;
        location: string | null;
        status: string;
        contractorId: string;
        contractorName: string;
        contractorCode?: string | null;
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id },
      include: {
        contractor: {
          select: { name: true, code: true },
        },
      },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen not found" };
    }

    return {
      success: true,
      data: {
        id: kitchen.id,
        name: kitchen.name,
        location: kitchen.location,
        status: kitchen.status,
        contractorId: kitchen.contractorId,
        contractorName: kitchen.contractor.name,
        contractorCode: kitchen.contractor.code,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to get kitchen" };
  }
}
