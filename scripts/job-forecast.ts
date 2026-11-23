/**
 * Standalone Forecast Precompute Job Script
 * Usage: npm run job:forecast
 * 
 * Never displays secrets; logs only operational counts and execution timings.
 */
import { prisma } from "../src/lib/prisma";
import { executeForecastPrecompute } from "../src/server/forecast-engine";

async function main() {
  console.log(`[CookCue Job] Starting scheduled forecast precompute job...`);
  const startTime = Date.now();

  try {
    const result = await executeForecastPrecompute();

    console.log(`[CookCue Job] Forecast precompute completed successfully:`);
    console.log(`  - Active Kitchens Processed: ${result.kitchensProcessed}`);
    console.log(`  - Forecast Snapshots Created: ${result.snapshotsCreated}`);
    console.log(`  - Total Execution Duration: ${result.durationMs}ms`);

    if (result.errors && result.errors.length > 0) {
      console.warn(`[CookCue Job] Warnings encountered:`, result.errors);
    }

    process.exitCode = 0;
  } catch (error: any) {
    console.error(`[CookCue Job] Fatal error running forecast precompute:`, error?.message || "Unknown error");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
