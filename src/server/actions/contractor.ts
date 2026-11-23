"use server";

import { prisma } from "@/lib/prisma";
import type { CreateContractorInput, ContractorSummary, ContractorDetail } from "@/lib/domain/types";
import { requireFounder, requireAuth } from "@/lib/auth/session";
import { generateNextContractorCode } from "./contractor-code";
import { safeRevalidatePath } from "@/lib/cache/revalidate";
import { z } from "zod";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";

const createContractorSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  displayName: z.string().optional(),
  organizationType: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  primaryContactName: z.string().optional(),
});

export async function createContractor(
  input: CreateContractorInput
): Promise<{ success: true; data: ContractorSummary } | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  const parsed = createContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    const existing = await prisma.contractor.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" } },
    });

    if (existing) {
      return { success: false, error: "A contractor with this name already exists" };
    }

    const contractor = await prisma.$transaction(async (tx) => {
      const code = await generateNextContractorCode(tx);
      return tx.contractor.create({
        data: {
          name: data.name.trim(),
          status: "PENDING",
          code,
          primaryContactName: data.primaryContactName?.trim() || null,
          contactEmail: data.contactEmail?.trim() || null,
          contactPhone: data.contactPhone?.trim() || null,
          address: data.address?.trim() || null,
        },
      });
    });

    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath("/founder");

    return {
      success: true,
      data: {
        id: contractor.id,
        code: contractor.code,
        name: contractor.name,
        status: contractor.status,
        primaryContactName: contractor.primaryContactName,
        contactEmail: contractor.contactEmail,
        contactPhone: contractor.contactPhone,
        address: contractor.address,
        createdAt: contractor.createdAt,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to create contractor" };
  }
}

export async function listContractors(options?: {
  take?: number;
  skip?: number;
}): Promise<
  | { success: true; data: ContractorSummary[]; totalCount: number; take?: number; skip?: number }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const effectiveTake = typeof options?.take === "number" && options.take > 0 ? options.take : 50;
    const skip = options?.skip;

    const [totalCount, contractors] = await prisma.$transaction([
      prisma.contractor.count(),
      prisma.contractor.findMany({
        orderBy: { createdAt: "desc" },
        take: effectiveTake,
        ...(typeof skip === "number" && skip >= 0 ? { skip } : {}),
      }),
    ]);

    return {
      success: true,
      data: contractors.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        status: c.status,
        primaryContactName: c.primaryContactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        address: c.address,
        createdAt: c.createdAt,
      })),
      totalCount,
      take: effectiveTake,
      skip,
    };
  } catch (e) {
    return { success: false, error: "Failed to list contractors" };
  }
}

/**
 * Search contractor organizations as founder.
 * Matches code exactly (case-insensitive) OR name contains query (case-insensitive).
 * Defaults take to 50 when omitted.
 */
export async function searchContractorsAsFounder(
  query: string,
  options?: {
    take?: number;
    skip?: number;
  }
): Promise<{
  success: true;
  data: ContractorSummary[];
  totalCount?: number;
  take?: number;
  skip?: number;
} | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const trimmed = query.trim();
    const effectiveTake = typeof options?.take === "number" && options.take > 0 ? options.take : 50;
    const skip = options?.skip;

    if (!trimmed) {
      const [totalCount, contractors] = await prisma.$transaction([
        prisma.contractor.count(),
        prisma.contractor.findMany({
          orderBy: { createdAt: "desc" },
          take: effectiveTake,
          ...(typeof skip === "number" && skip >= 0 ? { skip } : {}),
        }),
      ]);
      return {
        success: true,
        data: contractors.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          status: c.status,
          primaryContactName: c.primaryContactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          address: c.address,
          createdAt: c.createdAt,
        })),
        totalCount,
        take: effectiveTake,
        skip,
      };
    }

    const where = {
      OR: [
        { code: { equals: trimmed, mode: "insensitive" as const } },
        { name: { contains: trimmed, mode: "insensitive" as const } },
      ],
    };

    const [totalCount, contractors] = await prisma.$transaction([
      prisma.contractor.count({ where }),
      prisma.contractor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: effectiveTake,
        ...(typeof skip === "number" && skip >= 0 ? { skip } : {}),
      }),
    ]);

    return {
      success: true,
      data: contractors.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        status: c.status,
        primaryContactName: c.primaryContactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        address: c.address,
        createdAt: c.createdAt,
      })),
      totalCount,
      take: effectiveTake,
      skip,
    };
  } catch (e) {
    return { success: false, error: "Failed to search contractors" };
  }
}

export async function getContractorById(idOrCode: string): Promise<
  | {
      success: true;
      data: ContractorDetail;
    }
  | { success: false; error: string }
> {
  const auth = await requireAuth();
  if (!auth.success) return { success: false, error: auth.error };

  const trimmed = idOrCode.trim();
  const isCode = isContractorCode(trimmed);

  try {
    const contractor = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmed)! } : { id: trimmed },
      include: {
        kitchens: true,
        users: {
          select: {
            id: true,
            code: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!contractor) {
      return { success: false, error: "Contractor not found" };
    }

    // Founder has access, or Contractor Manager/Admin assigned to this contractor
    if (auth.user.role !== "FOUNDER" && auth.user.contractorId !== contractor.id) {
      return { success: false, error: "Forbidden: unauthorized access to contractor portfolio" };
    }

    return {
      success: true,
      data: {
        id: contractor.id,
        code: contractor.code,
        name: contractor.name,
        status: contractor.status,
        primaryContactName: contractor.primaryContactName,
        contactEmail: contractor.contactEmail,
        contactPhone: contractor.contactPhone,
        address: contractor.address,
        createdAt: contractor.createdAt,
        kitchens: contractor.kitchens.map((k) => ({
          id: k.id,
          name: k.name,
          location: k.location,
          status: k.status,
        })),
        users: contractor.users.map((u) => ({
          id: u.id,
          code: u.code,
          email: u.email,
          name: u.name,
          role: u.role,
        })),
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to get contractor" };
  }
}

const CONTRACTOR_STATUSES = ["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED"] as const;
const updateContractorStatusSchema = z.enum(CONTRACTOR_STATUSES, {
  errorMap: () => ({ message: "Invalid status. Allowed values: ACTIVE, PENDING, INACTIVE, SUSPENDED" }),
});

export async function updateContractor(
  idOrCode: string,
  input: {
    name?: string;
    status?: string;
    primaryContactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  }
): Promise<{ success: true; data: ContractorDetail } | { success: false; error: string }> {
  const auth = await requireAuth();
  if (!auth.success) return { success: false, error: auth.error };

  const trimmed = idOrCode.trim();
  const isCode = isContractorCode(trimmed);

  try {
    const existing = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmed)! } : { id: trimmed },
    });
    if (!existing) {
      return { success: false, error: "Contractor not found" };
    }

    if (auth.user.role !== "FOUNDER" && auth.user.contractorId !== existing.id) {
      return { success: false, error: "Forbidden: unauthorized access to contractor portfolio" };
    }

    if (input.status !== undefined) {
      const statusCheck = updateContractorStatusSchema.safeParse(input.status);
      if (!statusCheck.success) {
        return {
          success: false,
          error: statusCheck.error.errors[0]?.message || "Invalid status. Allowed values: ACTIVE, PENDING, INACTIVE, SUSPENDED",
        };
      }
    }

    if (input.name !== undefined && input.name.trim().length < 2) {
      return { success: false, error: "Organization name must be at least 2 characters" };
    }

    await prisma.contractor.update({
      where: { id: existing.id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.primaryContactName !== undefined
          ? { primaryContactName: input.primaryContactName?.trim() || null }
          : {}),
        ...(input.contactEmail !== undefined
          ? { contactEmail: input.contactEmail?.trim() || null }
          : {}),
        ...(input.contactPhone !== undefined
          ? { contactPhone: input.contactPhone?.trim() || null }
          : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      },
    });

    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath(`/founder/contractors/${existing.id}`);
    if (existing.code) safeRevalidatePath(`/founder/contractors/${existing.code}`);
    safeRevalidatePath(`/contractor/${existing.id}`);
    if (existing.code) safeRevalidatePath(`/contractor/${existing.code}`);
    safeRevalidatePath("/founder");

    return getContractorById(existing.id);
  } catch (e) {
    return { success: false, error: "Failed to update contractor" };
  }
}

export async function activateContractor(
  idOrCode: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  const trimmed = idOrCode.trim();
  const isCode = isContractorCode(trimmed);

  try {
    const existing = await prisma.contractor.findUnique({
      where: isCode ? { code: normalizeContractorCode(trimmed)! } : { id: trimmed },
      select: { id: true, code: true },
    });

    if (!existing) {
      return { success: false, error: "Contractor not found" };
    }

    await prisma.contractor.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" },
    });

    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath(`/founder/contractors/${existing.id}`);
    if (existing.code) safeRevalidatePath(`/founder/contractors/${existing.code}`);
    safeRevalidatePath(`/contractor/${existing.id}`);
    if (existing.code) safeRevalidatePath(`/contractor/${existing.code}`);
    safeRevalidatePath("/founder");

    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to activate contractor" };
  }
}
