import "dotenv/config";
import { backfillContractorCodes } from "../src/server/actions/contractor-code";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting contractor code backfill in createdAt order...");
  const result = await backfillContractorCodes();
  console.log(`Backfilled ${result.backfilledCount} contractor(s):`);
  for (const item of result.assignedCodes) {
    console.log(`- ${item.code}: ${item.name} (${item.id})`);
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
