"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export type CurrentUserProfile = {
  id: string;
  code?: string | null;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  contractorId?: string | null;
  contractorCode?: string | null;
  contractorName: string | null;
  contractorStatus?: string | null;
  kitchenId?: string | null;
  kitchenName: string | null;
};

export async function getCurrentUserProfile(): Promise<
  { success: true; data: CurrentUserProfile } | { success: false; error: string }
> {
  const session = await getSessionUser();
  if (!session) {
    return { success: false, error: "No active authenticated session found." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        code: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        contractorId: true,
        kitchenId: true,
        contractor: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        kitchen: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User record not found in database." };
    }

    return {
      success: true,
      data: {
        id: user.id,
        code: user.code,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        contractorId: user.contractor?.id || user.contractorId || null,
        contractorCode: user.contractor?.code || null,
        contractorName: user.contractor?.name || null,
        contractorStatus: user.contractor?.status || null,
        kitchenId: user.kitchen?.id || user.kitchenId || null,
        kitchenName: user.kitchen?.name || null,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load profile from database." };
  }
}
