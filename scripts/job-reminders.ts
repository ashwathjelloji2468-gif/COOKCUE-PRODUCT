/**
 * Standalone Operational Reminders Scheduled Job Script
 * Usage: npm run job:reminders [-- --dry-run] [-- --date=YYYY-MM-DD]
 *
 * Checks for PLAN_NOT_APPROVED and CLOSEOUT_MISSING operational exceptions,
 * deduplicates against the 6-hour log window, and dispatches honest email notifications.
 */
import { prisma } from "../src/lib/prisma";
import { executeOperationalRemindersInternal } from "../src/server/actions/reminders";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");

  let customDate: string | undefined;
  const dateArg = args.find((a) => a.startsWith("--date="));
  if (dateArg) {
    customDate = dateArg.split("=")[1]?.trim();
  }

  console.log(`=================================================`);
  console.log(`  COOKCUE OPERATIONAL REMINDERS JOB`);
  console.log(`  Mode: ${dryRun ? "DRY-RUN (Inspect candidates only)" : "LIVE DISPATCH"}`);
  if (customDate) {
    console.log(`  Evaluation Date: ${customDate}`);
  }
  console.log(`=================================================\n`);

  const startTime = Date.now();

  try {
    const result = await executeOperationalRemindersInternal({
      dryRun,
      date: customDate,
    });

    console.log(`[Reminders Job] Execution completed in ${Date.now() - startTime}ms`);
    console.log(`  - Total Candidates Identified: ${result.totalCandidates}`);
    console.log(`  - Reminders Dispatched (Sent): ${result.sentCount}`);
    console.log(`  - Reminders Skipped (Deduplicated < 6h): ${result.skippedCount}`);
    console.log(`  - Reminders Failed: ${result.failedCount}`);
    console.log(`  - Delivery Channels: ${result.channel}\n`);

    if (result.candidates.length > 0) {
      console.log(`Candidates breakdown:`);
      for (const c of result.candidates) {
        const statusTag = c.isDeduplicated ? `[SKIPPED: ${c.skipReason}]` : `[QUEUED: ${c.recipientEmails.join(", ")}]`;
        console.log(`  * ${c.kitchenName} | ${c.type} | ${c.mealType} ${c.date} -> ${statusTag}`);
      }
    } else {
      console.log(`No active operational exceptions requiring reminder.`);
    }

    process.exitCode = 0;
  } catch (error: any) {
    console.error(`[Reminders Job] Fatal error:`, error?.message || "Unknown error");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
