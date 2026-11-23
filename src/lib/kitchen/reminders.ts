/**
 * Operational Reminders Domain Types and Content Formatter
 */

export type ReminderType = "PLAN_NOT_APPROVED" | "CLOSEOUT_MISSING";

export type ReminderCandidate = {
  kitchenId: string;
  kitchenName: string;
  type: ReminderType;
  mealType: string;
  date: string;
  href: string;
  fullUrl: string;
  recipientEmails: string[];
  recipientType: "HEAD_COOK" | "CONTRACTOR_CONTACT" | "FOUNDER_FALLBACK";
  isDeduplicated: boolean;
  skipReason?: string;
  summary: string;
};

export type OperationalReminderResult = {
  dryRun: boolean;
  timestamp: string;
  totalCandidates: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  channel: string;
  candidates: ReminderCandidate[];
};

export type ReminderLogSummary = {
  id: string;
  kitchenId: string;
  kitchenName: string;
  mealType: string;
  serviceDate: string;
  type: string;
  channel: string;
  recipient: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  sentAt: string;
};

export const DEDUP_WINDOW_HOURS = 6;

/**
 * Checks SMS and WhatsApp channel readiness.
 * Returns "email only" when external providers are not configured.
 */
export function getChannelReadiness(): {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  summary: string;
} {
  const sms = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
  const whatsapp = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_WHATSAPP_FROM
  );

  let summary = "email only";
  if (sms && whatsapp) {
    summary = "email, sms, whatsapp";
  } else if (sms) {
    summary = "email, sms";
  } else if (whatsapp) {
    summary = "email, whatsapp";
  }

  return { email: true, sms, whatsapp, summary };
}

/**
 * Builds email subject and body for a candidate following strict plain operational copy.
 * Subject: [CookCue] Action needed: {Kitchen} {MealType} {date}
 * Body: one issue, one link, no marketing fluff
 */
export function buildReminderEmailContent(candidate: ReminderCandidate): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `[CookCue] Action needed: ${candidate.kitchenName} ${candidate.mealType} ${candidate.date}`;

  let issueDescription = "";
  let actionCall = "";

  if (candidate.type === "PLAN_NOT_APPROVED") {
    issueDescription = `The ${candidate.mealType} cooking plan for ${candidate.kitchenName} on ${candidate.date} is in DRAFT and requires approval.`;
    actionCall = `Please review and approve the morning cooking plan:`;
  } else {
    issueDescription = `The approved ${candidate.mealType} cooking plan for ${candidate.kitchenName} on ${candidate.date} has not been closed out.`;
    actionCall = `Please record the service closeout actuals:`;
  }

  const text = `Hello,

${issueDescription}

${actionCall}
${candidate.fullUrl}

---
CookCue Operations
This is an automated operational notification. No auto-approval or auto-submission has occurred.
`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #193D32; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #193D32; margin: 0; font-size: 18px; font-weight: bold;">CookCue Operational Action Needed</h2>
  </div>

  <p style="font-size: 15px; margin: 16px 0;">Hello,</p>

  <div style="background-color: #f6f8f7; border-left: 4px solid #193D32; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-weight: 600; color: #0D221C; font-size: 14px;">${issueDescription}</p>
  </div>

  <p style="margin: 20px 0;">
    <a href="${candidate.fullUrl}" style="display: inline-block; background-color: #193D32; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
      Open CookCue to Complete Action &rarr;
    </a>
  </p>

  <p style="font-size: 12px; color: #666; margin-top: 16px;">
    Direct link: <a href="${candidate.fullUrl}" style="color: #193D32;">${candidate.fullUrl}</a>
  </p>

  <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 30px 0 16px;" />

  <p style="font-size: 11px; color: #888; margin: 0;">
    CookCue Operations &middot; Automated reminder &middot; No automated approval or submission has taken place.
  </p>
</body>
</html>`;

  return { subject, text, html };
}
