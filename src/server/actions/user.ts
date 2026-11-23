"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";

export type FounderUserItem = {
  id: string;
  code?: string | null;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  contractorName: string | null;
  kitchenName: string | null;
};

export type ListUsersOptions = {
  skip?: number;
  take?: number;
};

export async function listUsersAsFounder(options?: ListUsersOptions): Promise<
  | {
      success: true;
      data: FounderUserItem[];
      totalCount: number;
      skip?: number;
      take?: number;
    }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const skip = options?.skip;
    const effectiveTake = typeof options?.take === "number" && options.take > 0 ? options.take : 50;

    const [totalCount, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: {
          id: true,
          code: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          contractor: {
            select: {
              name: true,
            },
          },
          kitchen: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...(typeof skip === "number" && skip >= 0 ? { skip } : {}),
        take: effectiveTake,
      }),
    ]);

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        code: u.code,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        contractorName: u.contractor?.name || null,
        kitchenName: u.kitchen?.name || null,
      })),
      totalCount,
      ...(typeof skip === "number" ? { skip } : {}),
      take: effectiveTake,
    };
  } catch (e) {
    return { success: false, error: "Failed to load users from database" };
  }
}
