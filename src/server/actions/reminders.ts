"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";
import { detectOperationalExceptions, type OperationalException } from "@/server/actions/exceptions";
import { sendEmail, getFounderEmails } from "@/lib/email";
import { toServiceDateString } from "@/lib/domain/date";
import {
  type ReminderType,
  type ReminderCandidate,
  type OperationalReminderResult,
  type ReminderLogSummary,
  DEDUP_WINDOW_HOURS,
  getChannelReadiness,
  buildReminderEmailContent,
} from "@/lib/kitchen/reminders";

export type {
  ReminderType,
  ReminderCandidate,
  OperationalReminderResult,
  ReminderLogSummary,
};

function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Builds the list of actionable reminder candidates across all active kitchens.
 * Reuses detectOperationalExceptions directly for PLAN_NOT_APPROVED and CLOSEOUT_MISSING.
 * Resolves recipients with strict tenant isolation (Head Cook -> Contractor Contact -> Founder).
 * Checks 6-hour deduplication window against OperationalReminderLog.
 */
export async function buildReminderCandidates(
  evaluationDate?: string
): Promise<ReminderCandidate[]> {
  const targetDate = evaluationDate || toServiceDateString(new Date());
  const appBaseUrl = getAppBaseUrl();
  const dedupThreshold = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

  // 1. Fetch active kitchens with contractor relations
  const kitchens = await prisma.kitchen.findMany({
    where: { status: "ACTIVE" },
    include: {
      contractor: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
        },
      },
      users: {
        where: {
          role: "HEAD_COOK",
          status: "ACTIVE",
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (kitchens.length === 0) return [];

  // 2. Reuse domain exception detector
  const exceptions = await detectOperationalExceptions(
    kitchens.map((k) => ({ id: k.id, name: k.name })),
    targetDate
  );

  // Filter only reminder types: PLAN_NOT_APPROVED and CLOSEOUT_MISSING
  const operationalExceptions = exceptions.filter(
    (e): e is OperationalException & { type: ReminderType } =>
      e.type === "PLAN_NOT_APPROVED" || e.type === "CLOSEOUT_MISSING"
  );

  if (operationalExceptions.length === 0) return [];

  // Index kitchens for recipient lookup
  const kitchenMap = new Map(kitchens.map((k) => [k.id, k]));

  // Query recent logs for deduplication
  const recentLogs = await prisma.operationalReminderLog.findMany({
    where: {
      status: "SENT",
      sentAt: { gte: dedupThreshold },
    },
    select: {
      kitchenId: true,
      mealType: true,
      serviceDate: true,
      type: true,
      sentAt: true,
    },
  });

  const dedupSet = new Set(
    recentLogs.map((l) => `${l.kitchenId}:${l.mealType}:${l.serviceDate}:${l.type}`)
  );

  const candidates: ReminderCandidate[] = [];

  for (const ex of operationalExceptions) {
    const kitchen = kitchenMap.get(ex.kitchenId);
    if (!kitchen) continue;

    const mealType = ex.mealType || "ALL";
    const date = ex.date || targetDate;

    // Recipient resolution with tenant boundary:
    // 1. Active Head Cook(s) of this specific kitchen
    // 2. Fallback: Contractor primary contact email
    // 3. Fallback: Platform Founder email
    let recipientEmails: string[] = [];
    let recipientType: ReminderCandidate["recipientType"] = "HEAD_COOK";

    const headCookEmails = kitchen.users
      .map((u) => u.email?.trim())
      .filter((e): e is string => Boolean(e && e.includes("@")));

    if (headCookEmails.length > 0) {
      recipientEmails = Array.from(new Set(headCookEmails));
      recipientType = "HEAD_COOK";
    } else if (kitchen.contractor?.contactEmail && kitchen.contractor.contactEmail.includes("@")) {
      recipientEmails = [kitchen.contractor.contactEmail.trim()];
      recipientType = "CONTRACTOR_CONTACT";
    } else {
      const founderEmails = getFounderEmails();
      recipientEmails = founderEmails.length > 0 ? founderEmails : ["cookcue149@gmail.com"];
      recipientType = "FOUNDER_FALLBACK";
    }

    // Deduplication check: same kitchen + mealType + date + type within 6 hours
    const dedupKey = `${ex.kitchenId}:${mealType}:${date}:${ex.type}`;
    const isDeduplicated = dedupSet.has(dedupKey);

    const fullUrl = `${appBaseUrl}${ex.href}`;

    candidates.push({
      kitchenId: ex.kitchenId,
      kitchenName: ex.kitchenName,
      type: ex.type,
      mealType,
      date,
      href: ex.href,
      fullUrl,
      recipientEmails,
      recipientType,
      isDeduplicated,
      skipReason: isDeduplicated ? `Already sent within the last ${DEDUP_WINDOW_HOURS} hours` : undefined,
      summary: ex.summary,
    });
  }

  return candidates;
}

/**
 * Internal core execution of operational reminders.
 * Can be called by the Founder server action or the standalone CLI script.
 */
export async function executeOperationalRemindersInternal(options?: {
  dryRun?: boolean;
  date?: string;
}): Promise<OperationalReminderResult> {
  const isDryRun = Boolean(options?.dryRun);
  const evaluationDate = options?.date;
  const channelReadiness = getChannelReadiness();

  const candidates = await buildReminderCandidates(evaluationDate);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    if (candidate.isDeduplicated) {
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      // In dry run, we do not send emails or write log entries
      continue;
    }

    // Live send
    const { subject, text, html } = buildReminderEmailContent(candidate);
    let candidateSuccess = true;
    let lastError: string | null = null;

    for (const recipient of candidate.recipientEmails) {
      try {
        const sendResult = await sendEmail({
          to: recipient,
          subject,
          text,
          html,
        });

        if (!sendResult || !sendResult.id) {
          candidateSuccess = false;
          lastError = sendResult?.response || "Email delivery failed";
        }
      } catch (err: any) {
        candidateSuccess = false;
        lastError = err?.message || "Email transport exception";
      }
    }

    // Write audit log
    try {
      await prisma.operationalReminderLog.create({
        data: {
          kitchenId: candidate.kitchenId,
          mealType: candidate.mealType,
          serviceDate: candidate.date,
          type: candidate.type,
          channel: "EMAIL",
          recipient: candidate.recipientEmails.join(", "),
          status: candidateSuccess ? "SENT" : "FAILED",
          summary: candidate.summary,
          errorMessage: lastError,
        },
      });
    } catch (logErr) {
      console.error("[Reminders] Failed to write OperationalReminderLog:", logErr);
    }

    if (candidateSuccess) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  return {
    dryRun: isDryRun,
    timestamp: new Date().toISOString(),
    totalCandidates: candidates.length,
    sentCount,
    skippedCount: isDryRun ? candidates.filter((c) => c.isDeduplicated).length : skippedCount,
    failedCount,
    channel: channelReadiness.summary,
    candidates,
  };
}

/**
 * Founder Server Action: Inspect or trigger operational reminders.
 * Strictly requires Founder authentication.
 */
export async function sendOperationalReminders(options?: {
  dryRun?: boolean;
  date?: string;
}): Promise<
  | { success: true; data: OperationalReminderResult }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: 403 };
  }

  try {
    const result = await executeOperationalRemindersInternal(options);
    return { success: true, data: result };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to execute operational reminders",
    };
  }
}

/**
 * Founder Server Action: Query recent operational reminder log history.
 */
export async function getRecentReminderLogs(
  limit = 20
): Promise<
  | { success: true; data: ReminderLogSummary[] }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  try {
    const logs = await prisma.operationalReminderLog.findMany({
      take: limit,
      orderBy: { sentAt: "desc" },
      include: {
        kitchen: {
          select: { name: true },
        },
      },
    });

    return {
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        kitchenId: l.kitchenId,
        kitchenName: l.kitchen.name,
        mealType: l.mealType,
        serviceDate: l.serviceDate,
        type: l.type,
        channel: l.channel,
        recipient: l.recipient,
        status: l.status,
        summary: l.summary,
        errorMessage: l.errorMessage,
        sentAt: l.sentAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, error: "Failed to load reminder history" };
  }
}
