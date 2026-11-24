import {
  sendViaSmtp,
  EmailMessage,
  SendEmailResult,
  CapturedEmailRecord,
  getSentEmails,
  clearSentEmails,
  setSimulateSmtpFailure,
  verifySmtpConnection,
} from "./transport";
import {
  renderFounderApplicationAlert,
  renderApplicantVerificationEmail,
  renderApplicantApprovalEmail,
  renderApplicantRejectionEmail,
} from "./templates";

export {
  getSentEmails,
  clearSentEmails,
  setSimulateSmtpFailure,
  verifySmtpConnection,
};
export type { SendEmailResult, CapturedEmailRecord };

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Parses and strictly validates a comma-separated list of founder email addresses.
 * Trims whitespace, validates format, removes duplicates, and rejects invalid configurations.
 */
export function parseFounderEmails(raw?: string): string[] {
  const envVal =
    process.env.FOUNDER_NOTIFICATION_EMAIL &&
    process.env.FOUNDER_NOTIFICATION_EMAIL !== "undefined"
      ? process.env.FOUNDER_NOTIFICATION_EMAIL
      : process.env.FOUNDER_EMAIL && process.env.FOUNDER_EMAIL !== "undefined"
      ? process.env.FOUNDER_EMAIL
      : undefined;

  const config =
    (raw !== undefined ? raw : envVal) ?? "cookcue149@gmail.com";

  if (!config || !config.trim()) {
    throw new Error(
      "Invalid founder email configuration: FOUNDER_NOTIFICATION_EMAIL is empty. Please configure at least one valid founder email address."
    );
  }

  const parts = config
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(
      "Invalid founder email configuration: No valid email addresses found in FOUNDER_NOTIFICATION_EMAIL."
    );
  }

  const validSet = new Set<string>();
  for (const part of parts) {
    if (!EMAIL_REGEX.test(part)) {
      throw new Error(
        `Invalid founder email configuration: '${part}' is not a valid email address format.`
      );
    }
    validSet.add(part.toLowerCase());
  }

  return Array.from(validSet);
}

export function getFounderEmails(): string[] {
  return parseFounderEmails();
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "CookCue Platform <cookcue149@gmail.com>"
  );
}

function getAppUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  return sendViaSmtp({
    to: options.to,
    from: getFromAddress(),
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/**
 * Dispatches a founder notification email to a specific founder recipient,
 * or to the primary founder email if no explicit recipient is specified.
 */
export async function sendFounderAlertEmail(
  app: {
    id: string;
    type: string;
    applicantName: string;
    applicantEmail: string;
    contractorName?: string | null;
    kitchenName?: string | null;
    location?: string | null;
  },
  recipientEmail?: string
): Promise<SendEmailResult> {
  const targetRecipient = recipientEmail || getFounderEmails()[0];
  const reviewUrl = `${getAppUrl()}/founder/applications/${app.id}`;
  const payload = renderFounderApplicationAlert(app, reviewUrl);

  return sendEmail({
    to: targetRecipient,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

export async function sendApplicantVerificationEmail(
  app: { applicantName: string; type: string; applicantEmail: string },
  token: string
): Promise<SendEmailResult> {
  const verificationUrl = `${getAppUrl()}/verify-email?token=${token}`;
  const payload = renderApplicantVerificationEmail(app, verificationUrl);
  return sendEmail({
    to: app.applicantEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

export async function sendApplicantApprovalEmail(
  app: {
    applicantName: string;
    applicantEmail: string;
    assignedRole?: string | null;
    type?: string | null;
    organizationName?: string | null;
    kitchenName?: string | null;
  },
  token: string
): Promise<SendEmailResult> {
  const activationUrl = `${getAppUrl()}/activate?token=${token}`;
  const payload = renderApplicantApprovalEmail(app, activationUrl);
  return sendEmail({
    to: app.applicantEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

export async function sendApplicantRejectionEmail(
  app: { applicantName: string; applicantEmail: string },
  reason?: string | null
): Promise<SendEmailResult> {
  const payload = renderApplicantRejectionEmail(app, reason);
  return sendEmail({
    to: app.applicantEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}
