/**
 * CookCue Synthetic Data Purge Script
 * Usage: npx tsx scripts/purge-synthetic-data.ts
 *
 * Purges all synthetic/seed/test data from PostgreSQL so the database has
 * ONLY the real founder account (cookcue149@gmail.com) and zero fake operational history.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/crypto";

const prisma = new PrismaClient();

const FOUNDER_EMAIL = "cookcue149@gmail.com";
const FOUNDER_PASSWORD = "Aisha@Ashwath";

async function getModelCounts() {
  return {
    User: await prisma.user.count(),
    Contractor: await prisma.contractor.count(),
    Kitchen: await prisma.kitchen.count(),
    Dish: await prisma.dish.count(),
    Meal: await prisma.meal.count(),
    CookingPlan: await prisma.cookingPlan.count(),
    PlanItem: await prisma.planItem.count(),
    PlanOverrideAudit: await prisma.planOverrideAudit.count(),
    Observation: await prisma.observation.count(),
    ObservationAudit: await prisma.observationAudit.count(),
    ForecastSnapshot: await prisma.forecastSnapshot.count(),
    StaffReport: await prisma.staffReport.count(),
    KitchenServiceTemplate: await prisma.kitchenServiceTemplate.count(),
    OperationalReminderLog: await prisma.operationalReminderLog.count(),
    OnboardingApplication: await prisma.onboardingApplication.count(),
    ApplicationNotificationLog: await prisma.applicationNotificationLog.count(),
    InAppNotification: await prisma.inAppNotification.count(),
    ProcurementIndent: await prisma.procurementIndent.count(),
    ProcurementIndentLine: await prisma.procurementIndentLine.count(),
  };
}

export async function purgeSyntheticData() {
  console.log("=================================================");
  console.log("  COOKCUE PRODUCTION PURGE: SYNTHETIC DATA");
  console.log("=================================================");

  const beforeCounts = await getModelCounts();
  console.log("\n[1/4] Counts before purge:\n", JSON.stringify(beforeCounts, null, 2));

  console.log("\n[2/4] Executing foreign-key safe cascade purge...");

  // 1. Unlink founder from any contractor or kitchen
  await prisma.user.updateMany({
    where: { email: FOUNDER_EMAIL },
    data: { contractorId: null, kitchenId: null },
  });

  // 2. Delete child operational records in reverse dependency order
  console.log("  - Deleting PlanOverrideAudit records...");
  await prisma.planOverrideAudit.deleteMany({});

  console.log("  - Deleting ProcurementIndentLine records...");
  await prisma.procurementIndentLine.deleteMany({});

  console.log("  - Deleting ProcurementIndent records...");
  await prisma.procurementIndent.deleteMany({});

  console.log("  - Deleting PlanItem records...");
  await prisma.planItem.deleteMany({});

  console.log("  - Deleting CookingPlan records...");
  await prisma.cookingPlan.deleteMany({});

  console.log("  - Deleting ObservationAudit records...");
  await prisma.observationAudit.deleteMany({});

  console.log("  - Deleting Observation records...");
  await prisma.observation.deleteMany({});

  console.log("  - Deleting ForecastSnapshot records...");
  await prisma.forecastSnapshot.deleteMany({});

  console.log("  - Deleting StaffReport records...");
  await prisma.staffReport.deleteMany({});

  console.log("  - Deleting Meal records...");
  await prisma.meal.deleteMany({});

  console.log("  - Deleting Dish records...");
  await prisma.dish.deleteMany({});

  console.log("  - Deleting KitchenServiceTemplate records...");
  await prisma.kitchenServiceTemplate.deleteMany({});

  console.log("  - Deleting OperationalReminderLog records...");
  await prisma.operationalReminderLog.deleteMany({});

  console.log("  - Deleting InAppNotification records...");
  await prisma.inAppNotification.deleteMany({});

  console.log("  - Deleting ApplicationNotificationLog records...");
  await prisma.applicationNotificationLog.deleteMany({});

  console.log("  - Deleting OnboardingApplication records...");
  await prisma.onboardingApplication.deleteMany({});

  // 3. Delete all users except founder
  console.log("  - Deleting all non-founder users...");
  await prisma.user.deleteMany({
    where: { email: { not: FOUNDER_EMAIL } },
  });

  // 4. Delete kitchens and contractors
  console.log("  - Deleting Kitchen facilities...");
  await prisma.kitchen.deleteMany({});

  console.log("  - Deleting Contractor organizations...");
  await prisma.contractor.deleteMany({});

  // 5. Ensure Founder account is in pristine state
  console.log("\n[3/4] Ensuring founder account exists and is pristine...");
  const founderHash = hashPassword(FOUNDER_PASSWORD);

  await prisma.user.upsert({
    where: { email: FOUNDER_EMAIL },
    update: {
      name: "Platform Founder",
      role: "FOUNDER",
      status: "ACTIVE",
      code: "USR-000001",
      passwordHash: founderHash,
      contractorId: null,
      kitchenId: null,
    },
    create: {
      email: FOUNDER_EMAIL,
      name: "Platform Founder",
      role: "FOUNDER",
      status: "ACTIVE",
      code: "USR-000001",
      passwordHash: founderHash,
      contractorId: null,
      kitchenId: null,
    },
  });

  const afterCounts = await getModelCounts();
  console.log("\n[4/4] Counts after purge:\n", JSON.stringify(afterCounts, null, 2));

  // Verify Founder credentials
  const founderUser = await prisma.user.findUnique({
    where: { email: FOUNDER_EMAIL },
  });

  if (!founderUser || !founderUser.passwordHash) {
    throw new Error("FATAL: Founder user or password hash not found after purge!");
  }

  const isPasswordValid = verifyPassword(FOUNDER_PASSWORD, founderUser.passwordHash);
  if (!isPasswordValid) {
    throw new Error("FATAL: Founder password hash verification failed!");
  }

  const allRemainingUsers = await prisma.user.findMany({
    select: { id: true, code: true, email: true, name: true, role: true, status: true },
  });

  console.log("\nRemaining User accounts (must be exactly 1):");
  console.table(allRemainingUsers);

  if (allRemainingUsers.length !== 1 || allRemainingUsers[0].email !== FOUNDER_EMAIL) {
    throw new Error(`FATAL: Expected exactly 1 user (${FOUNDER_EMAIL}), found ${allRemainingUsers.length}!`);
  }

  console.log("\n>>> PURGE SUCCESSFUL: Platform is in clean production-ready state. <<<\n");

  return { beforeCounts, afterCounts, remainingUsers: allRemainingUsers };
}

if (require.main === module || process.argv[1]?.endsWith("purge-synthetic-data.ts")) {
  purgeSyntheticData()
    .catch((err) => {
      console.error("Purge failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
