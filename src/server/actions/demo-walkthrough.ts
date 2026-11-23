"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/crypto";
import { generateNextUserCode } from "@/server/actions/user-code";
import { purgeSyntheticData } from "../../../scripts/purge-synthetic-data";
import { safeRevalidatePath } from "@/lib/cache/revalidate";

export type DemoWalkthroughKitchen = {
  id: string;
  name: string;
};

export async function getDemoKitchenIdAsFounder(): Promise<
  | { success: true; data: DemoWalkthroughKitchen | null }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    // 1. Look for known seed demo kitchen
    const demoKitchen = await prisma.kitchen.findFirst({
      where: {
        OR: [
          { id: "seed-kitchen-1" },
          { name: { contains: "Central Kitchen A", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
    });

    if (demoKitchen) {
      return { success: true, data: demoKitchen };
    }

    // 2. Fallback to any active kitchen
    const activeKitchen = await prisma.kitchen.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });

    return { success: true, data: activeKitchen ?? null };
  } catch (e) {
    return { success: false, error: "Failed to detect demo kitchen" };
  }
}

export async function runSeedDemoAsFounder(): Promise<
  | { success: true; data: { demoKitchenId: string } }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    let contractor = await prisma.contractor.findFirst({
      where: {
        OR: [{ id: "seed-contractor-1" }, { code: "CTR-000001" }],
      },
    });

    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          id: "seed-contractor-1",
          code: "CTR-000001",
          name: "Demo Contractor Pvt Ltd",
          status: "ACTIVE",
        },
      });
    }

    const kitchen1 = await prisma.kitchen.upsert({
      where: { id: "seed-kitchen-1" },
      update: {},
      create: {
        id: "seed-kitchen-1",
        contractorId: contractor.id,
        name: "Central Kitchen A",
        location: "Bangalore",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.upsert({
      where: { id: "seed-kitchen-2" },
      update: {},
      create: {
        id: "seed-kitchen-2",
        contractorId: contractor.id,
        name: "Hostel Kitchen B",
        location: "Hyderabad",
        status: "ACTIVE",
      },
    });

    const dish1 = await prisma.dish.upsert({
      where: { id: "seed-dish-1" },
      update: {},
      create: {
        id: "seed-dish-1",
        kitchenId: kitchen1.id,
        name: "Rice",
        unit: "kg",
      },
    });

    const dish2 = await prisma.dish.upsert({
      where: { id: "seed-dish-2" },
      update: {},
      create: {
        id: "seed-dish-2",
        kitchenId: kitchen1.id,
        name: "Dal",
        unit: "kg",
      },
    });

    const staffPasswordHash = hashPassword("DevPassword@123");

    const u3 = await prisma.user.findUnique({
      where: { email: "headcook@central-kitchen-a.com" },
    });
    const code3 = u3?.code || (await generateNextUserCode());

    await prisma.user.upsert({
      where: { email: "headcook@central-kitchen-a.com" },
      update: {
        passwordHash: staffPasswordHash,
        status: "ACTIVE",
        kitchenId: "seed-kitchen-1",
        code: code3,
      },
      create: {
        email: "headcook@central-kitchen-a.com",
        name: "Chef Rajesh",
        role: "HEAD_COOK",
        status: "ACTIVE",
        kitchenId: kitchen1.id,
        contractorId: contractor.id,
        passwordHash: staffPasswordHash,
        code: code3,
      },
    });

    // Sample service template for demo kitchen
    await prisma.kitchenServiceTemplate.upsert({
      where: {
        kitchenId_name: {
          kitchenId: kitchen1.id,
          name: "Standard Daily Lunch",
        },
      },
      update: {},
      create: {
        kitchenId: kitchen1.id,
        name: "Standard Daily Lunch",
        mealType: "LUNCH",
        defaultExpectedDiners: 150,
        dishIds: JSON.stringify([dish1.id, dish2.id]),
      },
    });

    safeRevalidatePath("/founder");
    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath("/founder/monitoring");

    return { success: true, data: { demoKitchenId: kitchen1.id } };
  } catch (e) {
    console.error("runSeedDemoAsFounder error:", e);
    return { success: false, error: e instanceof Error ? e.message : "Failed to initialize demo data" };
  }
}

export async function runPurgeDemoAsFounder(): Promise<
  { success: true } | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    await purgeSyntheticData();
    safeRevalidatePath("/founder");
    safeRevalidatePath("/founder/contractors");
    safeRevalidatePath("/founder/monitoring");
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to purge demo data" };
  }
}
