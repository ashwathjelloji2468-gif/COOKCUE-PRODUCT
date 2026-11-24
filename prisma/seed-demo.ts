/**
 * CookCue Optional Demo Dataset Seeder
 * Usage: npm run db:seed-demo
 *
 * Populates a temporary development demo dataset with sample contractor,
 * kitchens, dishes, and staff accounts.
 * Can be wiped at any time with: npm run db:purge
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/crypto";
import { generateNextUserCode } from "../src/server/actions/user-code";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding optional demo dataset...");

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

  const kitchen2 = await prisma.kitchen.upsert({
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

  await prisma.dish.upsert({
    where: { id: "seed-dish-1" },
    update: {
      allergenTags: ["GLUTEN"],
      menuCycleLabel: "Week A - Mon",
    },
    create: {
      id: "seed-dish-1",
      kitchenId: kitchen1.id,
      name: "Rice",
      unit: "kg",
      allergenTags: ["GLUTEN"],
      menuCycleLabel: "Week A - Mon",
    },
  });

  await prisma.dish.upsert({
    where: { id: "seed-dish-2" },
    update: {
      allergenTags: ["DAIRY", "MUSTARD"],
      menuCycleLabel: "Daily Standard",
    },
    create: {
      id: "seed-dish-2",
      kitchenId: kitchen1.id,
      name: "Dal",
      unit: "kg",
      allergenTags: ["DAIRY", "MUSTARD"],
      menuCycleLabel: "Daily Standard",
    },
  });

  const staffPasswordHash = hashPassword("DevPassword@123");
  const founderPasswordHash = hashPassword(process.env.FOUNDER_DEMO_PASSWORD || "DevPassword@123");

  // Platform Founder account
  const uFounder = await prisma.user.findUnique({ where: { email: "cookcue149@gmail.com" } });
  const codeFounder = uFounder?.code || "USR-000001";

  await prisma.user.upsert({
    where: { email: "cookcue149@gmail.com" },
    update: { passwordHash: founderPasswordHash, status: "ACTIVE", role: "FOUNDER", code: codeFounder },
    create: {
      email: "cookcue149@gmail.com",
      name: "Platform Founder",
      role: "FOUNDER",
      status: "ACTIVE",
      passwordHash: founderPasswordHash,
      code: codeFounder,
    },
  });

  const u3 = await prisma.user.findUnique({ where: { email: "headcook@central-kitchen-a.com" } });
  const code3 = u3?.code || (await generateNextUserCode());

  await prisma.user.upsert({
    where: { email: "headcook@central-kitchen-a.com" },
    update: { passwordHash: staffPasswordHash, status: "ACTIVE", kitchenId: "seed-kitchen-1", code: code3 },
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

  const u4 = await prisma.user.findUnique({ where: { email: "staff@hostel-kitchen-b.com" } });
  const code4 = u4?.code || (await generateNextUserCode());

  await prisma.user.upsert({
    where: { email: "staff@hostel-kitchen-b.com" },
    update: { passwordHash: staffPasswordHash, status: "ACTIVE", kitchenId: kitchen2.id, code: code4 },
    create: {
      email: "staff@hostel-kitchen-b.com",
      name: "Staff Member",
      role: "KITCHEN_STAFF",
      status: "ACTIVE",
      kitchenId: kitchen2.id,
      contractorId: contractor.id,
      passwordHash: staffPasswordHash,
      code: code4,
    },
  });

  // Seed a sample service template for Demo Central Kitchen A
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
      dishIds: JSON.stringify(["seed-dish-1", "seed-dish-2"]),
    },
  });

  // Seed an approved lunch meal and sample procurement indent for Demo Central Kitchen A
  const headCookUser = await prisma.user.findUnique({ where: { email: "headcook@central-kitchen-a.com" } });
  if (headCookUser) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMidnight = new Date(`${todayStr}T00:00:00.000Z`);

    const demoMeal = await prisma.meal.upsert({
      where: {
        kitchenId_mealType_date: {
          kitchenId: kitchen1.id,
          mealType: "LUNCH",
          date: todayMidnight,
        },
      },
      update: {},
      create: {
        kitchenId: kitchen1.id,
        mealType: "LUNCH",
        date: todayMidnight,
        expectedDiners: 150,
      },
    });

    const existingPlan = await prisma.cookingPlan.findUnique({ where: { mealId: demoMeal.id } });
    if (!existingPlan) {
      await prisma.cookingPlan.create({
        data: {
          kitchenId: kitchen1.id,
          mealId: demoMeal.id,
          expectedDiners: 150,
          status: "APPROVED",
          approvalStatus: "APPROVED",
          firstApproverId: headCookUser.id,
          firstApprovedAt: new Date(),
          items: {
            create: [
              { dishId: "seed-dish-1", recommendedKg: 30.0, approvedKg: 30.0 },
              { dishId: "seed-dish-2", recommendedKg: 22.5, approvedKg: 22.5 },
            ],
          },
        },
      });
    }

    const existingIndent = await prisma.procurementIndent.findFirst({
      where: { kitchenId: kitchen1.id, mealId: demoMeal.id },
    });
    if (!existingIndent) {
      await prisma.procurementIndent.create({
        data: {
          kitchenId: kitchen1.id,
          mealId: demoMeal.id,
          date: todayMidnight,
          mealType: "LUNCH",
          status: "DRAFT",
          createdById: headCookUser.id,
          lines: {
            create: [
              {
                dishId: "seed-dish-1",
                dishName: "Rice",
                targetKg: 30.0,
                unit: "kg",
                allergenTags: ["GLUTEN"],
                menuCycleLabel: "Week A - Mon",
                sortOrder: 0,
              },
              {
                dishId: "seed-dish-2",
                dishName: "Dal",
                targetKg: 22.5,
                unit: "kg",
                allergenTags: ["DAIRY", "MUSTARD"],
                menuCycleLabel: "Daily Standard",
                sortOrder: 1,
              },
            ],
          },
        },
      });
    }
  }

  console.log("Demo seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
