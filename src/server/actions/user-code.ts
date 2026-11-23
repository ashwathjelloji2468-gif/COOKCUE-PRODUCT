import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential human-readable user code:
 * Format: USR-000001, USR-000002, ... (zero-padded 6 digits).
 * Transaction-safe and guarantees no code reuse.
 */
export async function generateNextUserCode(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const latest = await tx.user.findFirst({
    where: { code: { not: null, startsWith: "USR-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let maxNum = 0;
  if (latest?.code) {
    const match = latest.code.match(/^USR-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `USR-${String(nextNum).padStart(6, "0")}`;
}

/**
 * Backfills all users that currently have null codes.
 * Assigns sequential USR-###### in createdAt order.
 */
export async function backfillUserCodes(): Promise<{
  backfilledCount: number;
  assignedCodes: { id: string; email: string; code: string }[];
}> {
  return await prisma.$transaction(async (tx) => {
    // 1. Get all users with null code, ordered by createdAt asc
    const nullUsers = await tx.user.findMany({
      where: { code: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, createdAt: true },
    });

    if (nullUsers.length === 0) {
      return { backfilledCount: 0, assignedCodes: [] };
    }

    // 2. Find current max code
    const latest = await tx.user.findFirst({
      where: { code: { not: null, startsWith: "USR-" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let currentMax = 0;
    if (latest?.code) {
      const match = latest.code.match(/^USR-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          currentMax = num;
        }
      }
    }

    // 3. Sequentially assign codes
    const assigned: { id: string; email: string; code: string }[] = [];
    for (const user of nullUsers) {
      currentMax += 1;
      const code = `USR-${String(currentMax).padStart(6, "0")}`;
      const res = await tx.user.updateMany({
        where: { id: user.id },
        data: { code },
      });
      if (res.count > 0) {
        assigned.push({ id: user.id, email: user.email, code });
      }
    }

    return {
      backfilledCount: assigned.length,
      assignedCodes: assigned,
    };
  });
}
