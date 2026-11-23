import "dotenv/config";
import { backfillUserCodes } from "../src/server/actions/user-code";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting user code backfill in createdAt order...");
  const result = await backfillUserCodes();
  console.log(`Backfilled ${result.backfilledCount} user(s):`);
  for (const item of result.assignedCodes) {
    console.log(`- ${item.code}: ${item.email} (${item.id})`);
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
