/**
 * CookCue Default Database Seeder
 * Usage: npm run db:seed
 *
 * Ensures the platform has the real Founder user account in ACTIVE state.
 * Does NOT pollute the database with synthetic contractors, kitchens, or closeout history.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/crypto";

const prisma = new PrismaClient();

const FOUNDER_EMAIL = "cookcue149@gmail.com";
const FOUNDER_PASSWORD = "Aisha@Ashwath";

async function main() {
  console.log("Seeding platform founder account...");

  const founderPasswordHash = hashPassword(FOUNDER_PASSWORD);

  // Remove any legacy founder accounts with incorrect emails
  await prisma.user.deleteMany({
    where: {
      role: "FOUNDER",
      email: { not: FOUNDER_EMAIL },
    },
  });

  const existingFounder = await prisma.user.findUnique({
    where: { email: FOUNDER_EMAIL },
  });

  const codeFounder = existingFounder?.code || "USR-000001";

  const founder = await prisma.user.upsert({
    where: { email: FOUNDER_EMAIL },
    update: {
      passwordHash: founderPasswordHash,
      status: "ACTIVE",
      role: "FOUNDER",
      name: "Platform Founder",
      code: codeFounder,
      contractorId: null,
      kitchenId: null,
    },
    create: {
      email: FOUNDER_EMAIL,
      name: "Platform Founder",
      role: "FOUNDER",
      status: "ACTIVE",
      passwordHash: founderPasswordHash,
      code: codeFounder,
      contractorId: null,
      kitchenId: null,
    },
  });

  console.log(`Default seed completed. Founder active: ${founder.email} (${founder.code})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
