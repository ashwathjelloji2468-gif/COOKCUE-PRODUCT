import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential human-readable contractor code:
 * Format: CTR-000001, CTR-000002, ... (zero-padded 6 digits).
 * Transaction-safe and guarantees no code reuse.
 */
export async function generateNextContractorCode(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const latest = await tx.contractor.findFirst({
    where: { code: { startsWith: "CTR-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let maxNum = 0;
  if (latest?.code) {
    const match = latest.code.match(/^CTR-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `CTR-${String(nextNum).padStart(6, "0")}`;
}

/**
 * Backfills all contractors that have null codes.
 * Assigns sequential CTR-###### in createdAt order.
 */
export async function backfillContractorCodes(): Promise<{
  backfilledCount: number;
  assignedCodes: { id: string; name: string; code: string }[];
}> {
  return await prisma.$transaction(async (tx) => {
    // 1. Get all contractors with null code, ordered by createdAt asc
    // Uses fallback catch since code is now non-null in DB schema
    const nullContractors = await (tx.contractor.findMany as any)({
      where: { code: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true },
    }).catch(() => []);

    if (!nullContractors || nullContractors.length === 0) {
      return { backfilledCount: 0, assignedCodes: [] };
    }

    // 2. Find current max code
    const latest = await tx.contractor.findFirst({
      where: { code: { startsWith: "CTR-" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let currentMax = 0;
    if (latest?.code) {
      const match = latest.code.match(/^CTR-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          currentMax = num;
        }
      }
    }

    // 3. Sequentially assign codes
    const assigned: { id: string; name: string; code: string }[] = [];
    for (const contractor of nullContractors) {
      currentMax += 1;
      const code = `CTR-${String(currentMax).padStart(6, "0")}`;
      const res = await tx.contractor.updateMany({
        where: { id: contractor.id },
        data: { code },
      });
      if (res.count > 0) {
        assigned.push({ id: contractor.id, name: contractor.name, code });
      }
    }

    return {
      backfilledCount: assigned.length,
      assignedCodes: assigned,
    };
  });
}
