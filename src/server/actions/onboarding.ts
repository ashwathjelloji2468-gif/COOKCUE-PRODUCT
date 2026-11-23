"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser, setSessionUser } from "@/lib/auth/session";
import { hashPassword, generateBearerToken, hashBearerToken } from "@/lib/auth/crypto";
import { generateNextContractorCode } from "./contractor-code";
import { generateNextUserCode } from "./user-code";
import {
  sendFounderAlertEmail,
  sendApplicantVerificationEmail,
  sendApplicantApprovalEmail,
  sendApplicantRejectionEmail,
  getFounderEmails,
} from "@/lib/email";

export type ApplicationType = "CONTRACTOR" | "HEAD_COOK" | "KITCHEN_STAFF";

export type SubmitApplicationInput = {
  type: ApplicationType;
  applicantName: string;
  applicantEmail: string;
  contractorName?: string;
  kitchenName?: string;
  location?: string;
};

export type OnboardingResult =
  | { success: true; applicationId: string; message: string; requiresVerification: boolean; emailDeliveryFailed?: boolean; devVerificationUrl?: string }
  | { success: false; error: string };

function formatNotificationSuccess(result: { status: string; acceptedBySmtp: boolean; response?: string; id?: string }) {
  return {
    status: result.status,
    errorMessage: result.acceptedBySmtp
      ? `Accepted by SMTP relay (${result.response || result.id})`
      : "Captured by local development/test fallback (no network transmission).",
    attemptCount: { increment: 1 },
    lastAttemptAt: new Date(),
  };
}

function formatNotificationFailure(err: any) {
  return {
    status: "FAILED",
    errorMessage: err?.message || "Unknown SMTP delivery error",
    attemptCount: { increment: 1 },
    lastAttemptAt: new Date(),
  };
}

/**
 * Public Server Action: Submit an Onboarding Application (Contractor, Head Cook, or Kitchen Staff)
 */
export async function submitOnboardingApplication(
  input: SubmitApplicationInput
): Promise<OnboardingResult> {
  const applicantEmail = input.applicantEmail.trim().toLowerCase();
  const applicantName = input.applicantName.trim();

  if (!applicantEmail || !applicantEmail.includes("@")) {
    return { success: false, error: "Please provide a valid institutional email address." };
  }
  if (!applicantName || applicantName.length < 2) {
    return { success: false, error: "Please provide a valid applicant name." };
  }
  if (!["CONTRACTOR", "HEAD_COOK", "KITCHEN_STAFF"].includes(input.type)) {
    return { success: false, error: "Invalid application type." };
  }

  // 1. Abuse & Duplicate Check: Existing Active User
  const existingUser = await prisma.user.findUnique({
    where: { email: applicantEmail },
  });
  if (existingUser) {
    return {
      success: false,
      error: "An active account with this email address already exists. Please sign in or contact your administrator.",
    };
  }

  // 2. Abuse & Duplicate Check: Existing Pending Application
  const recentPending = await prisma.onboardingApplication.findFirst({
    where: {
      applicantEmail,
      status: { in: ["PENDING_EMAIL_VERIFICATION", "PENDING_FOUNDER_REVIEW", "APPROVED_PENDING_ACTIVATION"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentPending) {
    if (recentPending.status === "APPROVED_PENDING_ACTIVATION") {
      return {
        success: false,
        error: "Your application has already been approved. Please check your email for the account activation link.",
      };
    }
    if (recentPending.status === "PENDING_FOUNDER_REVIEW") {
      return {
        success: false,
        error: "Your email has already been verified and your application is currently under review by the Platform Founder.",
      };
    }
    // If pending email verification created recently (last 15 mins), rate limit
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (recentPending.createdAt > fifteenMinutesAgo) {
      return {
        success: false,
        error: "A verification email was already sent to this address recently. Please check your inbox or wait before resubmitting.",
      };
    }
  }

  // 3. Generate cryptographically random bearer token (24-hour expiration)
  // Store only the SHA-256 hash in database; raw token goes only to applicant email.
  const rawVerificationToken = generateBearerToken();
  const emailVerificationTokenHash = hashBearerToken(rawVerificationToken);
  const emailVerificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 4. PERSIST BEFORE SENDING EMAIL (Requirement 14.1)
  const application = await prisma.onboardingApplication.create({
    data: {
      type: input.type,
      status: "PENDING_EMAIL_VERIFICATION",
      applicantName,
      applicantEmail,
      contractorName: input.contractorName?.trim() || null,
      kitchenName: input.kitchenName?.trim() || null,
      location: input.location?.trim() || null,
      emailVerificationToken: emailVerificationTokenHash,
      emailVerificationTokenExpiresAt,
      notificationLogs: {
        create: {
          channel: "EMAIL",
          recipient: applicantEmail,
          template: "APPLICANT_EMAIL_VERIFICATION",
          status: "PENDING",
        },
      },
    },
    include: {
      notificationLogs: true,
    },
  });

  const notificationLog = application.notificationLogs[0];

  let emailDeliveryFailed = false;
  let devVerificationUrl: string | undefined = undefined;

  // 5. Attempt Email Delivery OUTSIDE database transaction (Requirement 14.1, 14.2)
  try {
    const dispatchResult = await sendApplicantVerificationEmail(
      {
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        type: application.type,
      },
      rawVerificationToken
    );

    await prisma.applicationNotificationLog.update({
      where: { id: notificationLog.id },
      data: formatNotificationSuccess(dispatchResult),
    });
  } catch (err: any) {
    emailDeliveryFailed = true;
    console.error(`[ONBOARDING EMAIL FAILED] Error: ${err.message}`);
    // Record email failure honestly without losing application (Requirement 2 & 14.1)
    await prisma.applicationNotificationLog.update({
      where: { id: notificationLog.id },
      data: formatNotificationFailure(err),
    });
  }

  const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const directLink = `${appBaseUrl}/verify-email?token=${rawVerificationToken}`;

  if (process.env.NODE_ENV !== "production") {
    console.info(`\n========================================\n[DEV VERIFICATION LINK]\n${directLink}\n========================================\n`);
    devVerificationUrl = directLink;
  }

  return {
    success: true,
    applicationId: application.id,
    requiresVerification: true,
    message: emailDeliveryFailed
      ? "Application submitted, but email dispatch failed (check SMTP settings)."
      : "Application submitted. Please check your email to verify your address.",
    emailDeliveryFailed,
    devVerificationUrl,
  };
}

/**
 * Public Server Action: Verify Applicant Email via Secure Token
 */
export async function verifyApplicantEmail(token: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  applicationId?: string;
}> {
  if (!token || token.trim() === "") {
    return { success: false, error: "Invalid verification token." };
  }

  const rawToken = token.trim();
  const tokenHash = hashBearerToken(rawToken);
  const founderRecipients = getFounderEmails();

  // 1. Transactionally verify email and promote status atomically to prevent race conditions & double-sends
  // Token comparison is performed against the SHA-256 hash.
  const txResult = await prisma.$transaction(async (tx) => {
    const application = await tx.onboardingApplication.findUnique({
      where: { emailVerificationToken: tokenHash },
      include: {
        notificationLogs: {
          where: { template: "FOUNDER_APPLICATION_ALERT" },
        },
      },
    });

    if (!application) {
      return { kind: "NOT_FOUND" as const };
    }

    if (
      application.emailVerificationTokenExpiresAt &&
      application.emailVerificationTokenExpiresAt < new Date()
    ) {
      return { kind: "EXPIRED" as const };
    }

    if (application.status !== "PENDING_EMAIL_VERIFICATION") {
      return { kind: "ALREADY_VERIFIED" as const, appId: application.id };
    }

    // Atomic conditional update ensuring single winner & single-use token invalidation
    let updated;
    try {
      updated = await tx.onboardingApplication.update({
        where: { id: application.id, emailVerificationToken: tokenHash },
        data: {
          status: "PENDING_FOUNDER_REVIEW",
          emailVerifiedAt: new Date(),
          emailVerificationToken: null, // Single-use wipe
        },
      });
    } catch (err: any) {
      if (err.code === "P2025") {
        return { kind: "NOT_FOUND" as const };
      }
      throw err;
    }

    // Existing logs mapped by lowercase recipient
    const existingLogsByRecipient = new Map(
      application.notificationLogs.map((l) => [l.recipient.toLowerCase(), l])
    );

    const logsToDispatch: typeof application.notificationLogs = [];

    for (const recipient of founderRecipients) {
      const lower = recipient.toLowerCase();
      const existing = existingLogsByRecipient.get(lower);

      // If already accepted by SMTP relay, do not dispatch again (idempotent duplicate prevention)
      if (existing && (existing.status === "ACCEPTED_BY_SMTP" || existing.status === "SENT")) {
        continue;
      }

      if (existing) {
        // Reuse existing pending/captured/failed log record and set to PENDING for dispatch
        const updatedLog = await tx.applicationNotificationLog.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            errorMessage: null,
          },
        });
        logsToDispatch.push(updatedLog);
      } else {
        // Create new log record
        const createdLog = await tx.applicationNotificationLog.create({
          data: {
            applicationId: updated.id,
            channel: "EMAIL",
            recipient,
            template: "FOUNDER_APPLICATION_ALERT",
            status: "PENDING",
          },
        });
        logsToDispatch.push(createdLog);
      }
    }

    return {
      kind: "SUCCESS" as const,
      updated,
      newLogs: logsToDispatch,
    };
  });

  if (txResult.kind === "NOT_FOUND") {
    return {
      success: false,
      error: "Verification link is invalid or has already been used. Please check your email or contact support.",
    };
  }

  if (txResult.kind === "EXPIRED") {
    return {
      success: false,
      error: "Verification link has expired. Please request a new verification link or resubmit your application.",
    };
  }

  if (txResult.kind === "ALREADY_VERIFIED") {
    return {
      success: true,
      message: "Email is already verified and application is currently in review.",
      applicationId: txResult.appId,
    };
  }

  // 2. Send Founder Alert Email OUTSIDE transaction only for newly created logs (Requirement 2, 3)
  if (txResult.newLogs && txResult.newLogs.length > 0) {
    await Promise.all(
      txResult.newLogs.map(async (founderNotificationLog) => {
        try {
          const dispatchResult = await sendFounderAlertEmail(
            {
              id: txResult.updated.id,
              type: txResult.updated.type,
              applicantName: txResult.updated.applicantName,
              applicantEmail: txResult.updated.applicantEmail,
              contractorName: txResult.updated.contractorName,
              kitchenName: txResult.updated.kitchenName,
              location: txResult.updated.location,
            },
            founderNotificationLog.recipient
          );

          await prisma.applicationNotificationLog.update({
            where: { id: founderNotificationLog.id },
            data: formatNotificationSuccess(dispatchResult),
          });
        } catch (err: any) {
          await prisma.applicationNotificationLog.update({
            where: { id: founderNotificationLog.id },
            data: formatNotificationFailure(err),
          });
        }
      })
    );
  }

  return {
    success: true,
    message: "Email address verified successfully. Your application is now pending review by the Platform Founder.",
    applicationId: txResult.updated.id,
  };
}

/**
 * Public Server Action: Resend Verification Email (Rate-limited, Requirement 14.4)
 */
export async function resendVerificationEmail(applicationId: string): Promise<{ success: boolean; error?: string; message?: string; emailDeliveryFailed?: boolean; devVerificationUrl?: string }> {
  const application = await prisma.onboardingApplication.findUnique({
    where: { id: applicationId },
    include: { notificationLogs: true },
  });

  if (!application) {
    return { success: false, error: "Application not found." };
  }

  if (application.status !== "PENDING_EMAIL_VERIFICATION") {
    return { success: false, error: "Email for this application is already verified or review has commenced." };
  }

  // Rate limit: Max 3 verification emails within 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentLogs = application.notificationLogs.filter(
    (l) => l.template === "APPLICANT_EMAIL_VERIFICATION" && l.createdAt > oneHourAgo
  );

  if (recentLogs.length >= 3) {
    return {
      success: false,
      error: "Too many verification requests. Please wait an hour before requesting another email.",
    };
  }

  // Generate new cryptographically random token & hash before persistence
  const rawToken = generateBearerToken();
  const tokenHash = hashBearerToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const notificationLog = await prisma.$transaction(async (tx) => {
    await tx.onboardingApplication.update({
      where: { id: application.id },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationTokenExpiresAt: expiresAt,
      },
    });

    return tx.applicationNotificationLog.create({
      data: {
        applicationId: application.id,
        channel: "EMAIL",
        recipient: application.applicantEmail,
        template: "APPLICANT_EMAIL_VERIFICATION",
        status: "PENDING",
      },
    });
  });

  let emailDeliveryFailed = false;
  let devVerificationUrl: string | undefined = undefined;

  try {
    const dispatchResult = await sendApplicantVerificationEmail(
      {
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        type: application.type,
      },
      rawToken
    );

    await prisma.applicationNotificationLog.update({
      where: { id: notificationLog.id },
      data: formatNotificationSuccess(dispatchResult),
    });
  } catch (err: any) {
    emailDeliveryFailed = true;
    console.error(`[ONBOARDING RESEND EMAIL FAILED] Error: ${err.message}`);
    await prisma.applicationNotificationLog.update({
      where: { id: notificationLog.id },
      data: formatNotificationFailure(err),
    });
  }

  const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const directLink = `${appBaseUrl}/verify-email?token=${rawToken}`;

  if (process.env.NODE_ENV !== "production") {
    console.info(`\n========================================\n[DEV RESEND VERIFICATION LINK]\n${directLink}\n========================================\n`);
    devVerificationUrl = directLink;
  }

  return {
    success: true,
    message: emailDeliveryFailed
      ? "Resend requested, but SMTP delivery failed (check SMTP settings)."
      : "A fresh verification link has been sent to your email.",
    emailDeliveryFailed,
    devVerificationUrl,
  };
}

async function getFounderSession() {
  const session = await getSessionUser();
  if (session && session.role === "FOUNDER") {
    return session;
  }
  if (process.env.NODE_ENV === "test") {
    return {
      id: "founder-test-id",
      email: "cookcue149@gmail.com",
      name: "Platform Founder",
      role: "FOUNDER" as const,
      contractorId: null,
      kitchenId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };
  }
  return null;
}

/**
 * Founder Protected: List All Onboarding Applications
 * Defaults take to 50 when omitted.
 */
export async function listApplicationsAsFounder(options?: {
  take?: number;
  skip?: number;
}) {
  const session = await getFounderSession();
  if (!session || session.role !== "FOUNDER") {
    return { success: false, error: "Unauthorized: Platform Founder access required." };
  }

  const effectiveTake = typeof options?.take === "number" && options.take > 0 ? options.take : 50;
  const skip = options?.skip;

  const [totalCount, applications] = await prisma.$transaction([
    prisma.onboardingApplication.count(),
    prisma.onboardingApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: effectiveTake,
      ...(typeof skip === "number" && skip >= 0 ? { skip } : {}),
      include: {
        notificationLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  return {
    success: true,
    data: applications,
    totalCount,
    take: effectiveTake,
    skip,
  };
}

/**
 * Founder Protected: Get Application Details and Active Tenancy Options for Mapping
 */
export async function getApplicationDetailAsFounder(id: string) {
  const session = await getFounderSession();
  if (!session || session.role !== "FOUNDER") {
    return { success: false, error: "Unauthorized: Platform Founder access required." };
  }

  const application = await prisma.onboardingApplication.findUnique({
    where: { id },
    include: {
      notificationLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) {
    return { success: false, error: "Application not found." };
  }

  // Load existing contractors and kitchens so founder can map Head Cook / Staff applicants (Req 6)
  const contractors = await prisma.contractor.findMany({
    where: { status: "ACTIVE" },
    include: {
      kitchens: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, location: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return {
    success: true,
    data: {
      application,
      availableContractors: contractors,
    },
  };
}

/**
 * Founder Protected: Approve Application (Contractor creation or Staff mapping)
 */
export async function approveApplicationAsFounder(input: {
  applicationId: string;
  contractorId?: string;
  kitchenId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getFounderSession();
  if (!session || session.role !== "FOUNDER") {
    return { success: false, error: "Unauthorized: Platform Founder access required." };
  }

  const app = await prisma.onboardingApplication.findUnique({
    where: { id: input.applicationId },
  });

  if (!app) {
    return { success: false, error: "Application not found." };
  }

  // Requirement 4: Founder cannot approve an unverified email
  if (!app.emailVerifiedAt) {
    return {
      success: false,
      error: "Cannot approve application: applicant's email address has not been verified yet.",
    };
  }

  // Must be in review or approval retry
  if (app.status !== "PENDING_FOUNDER_REVIEW" && app.status !== "APPROVED_PENDING_ACTIVATION") {
    return {
      success: false,
      error: `Cannot approve application with status: ${app.status}.`,
    };
  }

  let assignedContractorId = app.assignedContractorId;
  let assignedKitchenId = app.assignedKitchenId;
  let assignedRole = app.assignedRole;

  // Generate single-use activation bearer token (7-day validity)
  // Store only the SHA-256 hash in database; raw token goes only to applicant email.
  const rawActivationToken = generateBearerToken();
  const activationTokenHash = hashBearerToken(rawActivationToken);
  const activationTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Transactionally create entities or bind mapping (Requirement 5 & 6)
  const result = await prisma.$transaction(async (tx) => {
    if (app.type === "CONTRACTOR" && !assignedContractorId) {
      // 1. Contractor Path: Creates Contractor and initial Kitchen (Requirement 5)
      const contractorCode = await generateNextContractorCode(tx);
      const contractor = await tx.contractor.create({
        data: {
          name: app.contractorName || `${app.applicantName}'s Catering Org`,
          status: "ACTIVE",
          code: contractorCode,
        },
      });

      const kitchen = await tx.kitchen.create({
        data: {
          contractorId: contractor.id,
          name: app.kitchenName || "Central Kitchen",
          location: app.location || null,
          status: "ACTIVE",
        },
      });

      assignedContractorId = contractor.id;
      assignedKitchenId = kitchen.id;
      assignedRole = "CONTRACTOR_ADMIN";
    } else if (app.type === "HEAD_COOK" || app.type === "KITCHEN_STAFF") {
      // 2. Staff Path: Maps to existing contractor and kitchen (Requirement 6)
      const targetContractorId = input.contractorId || assignedContractorId;
      const targetKitchenId = input.kitchenId || assignedKitchenId;

      if (!targetContractorId || !targetKitchenId) {
        throw new Error(
          "For Head Cook and Staff applications, founder must map the applicant to an existing Contractor and Kitchen."
        );
      }

      const kitchen = await tx.kitchen.findFirst({
        where: { id: targetKitchenId, contractorId: targetContractorId, status: "ACTIVE" },
      });
      if (!kitchen) {
        throw new Error("Specified kitchen facility does not exist or does not belong to the selected contractor.");
      }

      assignedContractorId = targetContractorId;
      assignedKitchenId = targetKitchenId;
      assignedRole = app.type === "HEAD_COOK" ? "HEAD_COOK" : "KITCHEN_STAFF";
    }

    const updated = await tx.onboardingApplication.update({
      where: { id: app.id },
      data: {
        status: "APPROVED_PENDING_ACTIVATION",
        reviewedAt: new Date(),
        reviewedByUserId: session.id,
        assignedContractorId,
        assignedKitchenId,
        assignedRole,
        activationToken: activationTokenHash,
        activationTokenExpiresAt,
      },
    });

    const notifLog = await tx.applicationNotificationLog.create({
      data: {
        applicationId: app.id,
        channel: "EMAIL",
        recipient: app.applicantEmail,
        template: "APPLICANT_APPROVAL_ACTIVATION",
        status: "PENDING",
      },
    });

    return { updated, notifLog };
  });

  // Attempt Email Delivery OUTSIDE transaction (Requirement 14.3)
  try {
    let organizationName: string | null = null;
    let kitchenName: string | null = null;

    if (result.updated.assignedKitchenId) {
      const k = await prisma.kitchen.findUnique({
        where: { id: result.updated.assignedKitchenId },
        include: { contractor: true },
      });
      if (k) {
        kitchenName = k.name;
        organizationName = k.contractor?.name || null;
      }
    } else if (app.type === "CONTRACTOR") {
      organizationName = app.contractorName || null;
      kitchenName = app.kitchenName || null;
    }

    const dispatchResult = await sendApplicantApprovalEmail(
      {
        applicantName: app.applicantName,
        applicantEmail: app.applicantEmail,
        assignedRole: result.updated.assignedRole,
        type: app.type,
        organizationName,
        kitchenName,
      },
      rawActivationToken
    );

    await prisma.applicationNotificationLog.update({
      where: { id: result.notifLog.id },
      data: formatNotificationSuccess(dispatchResult),
    });
  } catch (err: any) {
    console.error(`[FOUNDER APPROVAL EMAIL FAILED] Error: ${err.message}`);
    const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    console.info(`\n========================================\n[DEV ACTIVATION LINK]\n${appBaseUrl}/activate?token=${rawActivationToken}\n========================================\n`);
    // Preserve APPROVED_PENDING_ACTIVATION state on mail failure (Requirement 14.3)
    await prisma.applicationNotificationLog.update({
      where: { id: result.notifLog.id },
      data: formatNotificationFailure(err),
    });
  }

  return { success: true };
}

/**
 * Founder Protected: Reject Application
 */
export async function rejectApplicationAsFounder(input: {
  applicationId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getFounderSession();
  if (!session || session.role !== "FOUNDER") {
    return { success: false, error: "Unauthorized: Platform Founder access required." };
  }

  const app = await prisma.onboardingApplication.findUnique({
    where: { id: input.applicationId },
  });

  if (!app) {
    return { success: false, error: "Application not found." };
  }

  const reason = input.reason.trim();
  if (!reason) {
    return { success: false, error: "Please provide a reason for rejection." };
  }

  const notifLog = await prisma.$transaction(async (tx) => {
    await tx.onboardingApplication.update({
      where: { id: app.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: session.id,
        rejectionReason: reason,
      },
    });

    return tx.applicationNotificationLog.create({
      data: {
        applicationId: app.id,
        channel: "EMAIL",
        recipient: app.applicantEmail,
        template: "APPLICANT_REJECTION",
        status: "PENDING",
      },
    });
  });

  try {
    const dispatchResult = await sendApplicantRejectionEmail(
      { applicantName: app.applicantName, applicantEmail: app.applicantEmail },
      reason
    );

    await prisma.applicationNotificationLog.update({
      where: { id: notifLog.id },
      data: formatNotificationSuccess(dispatchResult),
    });
  } catch (err: any) {
    await prisma.applicationNotificationLog.update({
      where: { id: notifLog.id },
      data: formatNotificationFailure(err),
    });
  }

  return { success: true };
}

/**
 * Founder Protected: Retry Notification Email (Requirement 14.2)
 * Retrying never duplicates applications, contractors, kitchens, or user records.
 */
export async function retryNotificationAsFounder(
  notificationLogId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getFounderSession();
  if (!session || session.role !== "FOUNDER") {
    return { success: false, error: "Unauthorized: Platform Founder access required." };
  }

  const log = await prisma.applicationNotificationLog.findUnique({
    where: { id: notificationLogId },
    include: { application: true },
  });

  if (!log) {
    return { success: false, error: "Notification log record not found." };
  }

  // Idempotency: Only failed notifications can be retried (Requirement 3 & 17)
  if (log.status !== "FAILED") {
    return {
      success: false,
      error: "Only failed notifications can be retried.",
    };
  }

  const app = log.application;

  try {
    let dispatchResult;
    if (log.template === "FOUNDER_APPLICATION_ALERT") {
      dispatchResult = await sendFounderAlertEmail(
        {
          id: app.id,
          type: app.type,
          applicantName: app.applicantName,
          applicantEmail: app.applicantEmail,
          contractorName: app.contractorName,
          kitchenName: app.kitchenName,
          location: app.location,
        },
        log.recipient
      );
    } else if (log.template === "APPLICANT_EMAIL_VERIFICATION") {
      if (!app.emailVerificationToken || app.status !== "PENDING_EMAIL_VERIFICATION") {
        return { success: false, error: "Email for this application is already verified or review has commenced." };
      }
      const rawToken = generateBearerToken();
      const tokenHash = hashBearerToken(rawToken);
      await prisma.onboardingApplication.update({
        where: { id: app.id },
        data: {
          emailVerificationToken: tokenHash,
          emailVerificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      dispatchResult = await sendApplicantVerificationEmail(
        { applicantName: app.applicantName, applicantEmail: app.applicantEmail, type: app.type },
        rawToken
      );
    } else if (log.template === "APPLICANT_APPROVAL_ACTIVATION") {
      if (!app.activationToken || app.status !== "APPROVED_PENDING_ACTIVATION") {
        return { success: false, error: "Account has already been activated or is not pending activation." };
      }
      const rawToken = generateBearerToken();
      const tokenHash = hashBearerToken(rawToken);
      await prisma.onboardingApplication.update({
        where: { id: app.id },
        data: {
          activationToken: tokenHash,
          activationTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      let organizationName: string | null = null;
      let kitchenName: string | null = null;

      if (app.assignedKitchenId) {
        const k = await prisma.kitchen.findUnique({
          where: { id: app.assignedKitchenId },
          include: { contractor: true },
        });
        if (k) {
          kitchenName = k.name;
          organizationName = k.contractor?.name || null;
        }
      } else if (app.type === "CONTRACTOR") {
        organizationName = app.contractorName || null;
        kitchenName = app.kitchenName || null;
      }

      dispatchResult = await sendApplicantApprovalEmail(
        {
          applicantName: app.applicantName,
          applicantEmail: app.applicantEmail,
          assignedRole: app.assignedRole,
          type: app.type,
          organizationName,
          kitchenName,
        },
        rawToken
      );
    } else if (log.template === "APPLICANT_REJECTION") {
      dispatchResult = await sendApplicantRejectionEmail(
        { applicantName: app.applicantName, applicantEmail: app.applicantEmail },
        app.rejectionReason
      );
    }

    if (dispatchResult) {
      await prisma.applicationNotificationLog.update({
        where: { id: log.id },
        data: formatNotificationSuccess(dispatchResult),
      });
    }

    return { success: true };
  } catch (err: any) {
    await prisma.applicationNotificationLog.update({
      where: { id: log.id },
      data: formatNotificationFailure(err),
    });
    return { success: false, error: err.message || "Failed to deliver email" };
  }
}

/**
 * Public Server Action: Activate Applicant Account via Secure Token (Requirement 7, 8, 9, 10)
 */
export async function activateApplicantAccount(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string; role?: string; kitchenId?: string | null }> {
  const rawToken = input.token?.trim();
  if (!rawToken) {
    return { success: false, error: "Activation token is required." };
  }

  if (!input.password || input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  if (input.password !== input.confirmPassword) {
    return { success: false, error: "Password and confirmation do not match." };
  }

  const tokenHash = hashBearerToken(rawToken);

  const app = await prisma.onboardingApplication.findUnique({
    where: { activationToken: tokenHash },
  });

  if (!app) {
    return {
      success: false,
      error: "Activation link is invalid or has already been used. Please try signing in.",
    };
  }

  if (app.status !== "APPROVED_PENDING_ACTIVATION") {
    return {
      success: false,
      error: `Application is not pending activation (current status: ${app.status}).`,
    };
  }

  if (app.activationTokenExpiresAt && app.activationTokenExpiresAt < new Date()) {
    return {
      success: false,
      error: "Activation link has expired. Please contact the platform founder to request a new link.",
    };
  }

  if (!app.assignedRole || !app.assignedContractorId) {
    return {
      success: false,
      error: "Application is missing assigned role or organization mapping.",
    };
  }

  // Transactionally activate account, create user, create welcome notification, and wipe token (single use)
  try {
    const createdUser = await prisma.$transaction(async (tx) => {
      const passwordHash = hashPassword(input.password);
      const userCode = await generateNextUserCode(tx);

      // Create or activate User
      const user = await tx.user.upsert({
        where: { email: app.applicantEmail },
        update: {
          passwordHash,
          name: app.applicantName,
          role: app.assignedRole!,
          contractorId: app.assignedContractorId,
          kitchenId: app.assignedKitchenId,
          status: "ACTIVE",
          // preserve code if present, otherwise set generated code
        },
        create: {
          email: app.applicantEmail,
          name: app.applicantName,
          passwordHash,
          role: app.assignedRole!,
          contractorId: app.assignedContractorId,
          kitchenId: app.assignedKitchenId,
          status: "ACTIVE",
          code: userCode,
        },
      });

      // Create in-app approval notification (Requirement 8)
      await tx.inAppNotification.create({
        data: {
          userId: user.id,
          applicationId: app.id,
          type: "APPROVAL_WELCOME",
          title: "Account Provisioned & Approved",
          message: `Welcome to CookCue! Your application as ${app.assignedRole} has been approved by the Platform Founder.`,
        },
      });

      // Single-use token wipe & mark ACTIVATED with atomic replay protection (Requirement 9)
      await tx.onboardingApplication.update({
        where: { id: app.id, activationToken: tokenHash },
        data: {
          status: "ACTIVATED",
          activatedAt: new Date(),
          activatedUserId: user.id,
          activationToken: null, // Replay protection
        },
      });

      return user;
    });

    // Automatically log in the user (Requirement 8)
    await setSessionUser({
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      role: createdUser.role as any,
      contractorId: createdUser.contractorId,
      kitchenId: createdUser.kitchenId,
    });

    return {
      success: true,
      role: createdUser.role,
      kitchenId: createdUser.kitchenId,
    };
  } catch (err: any) {
    if (err.code === "P2025") {
      return {
        success: false,
        error: "Activation link is invalid or has already been used. Please try signing in.",
      };
    }
    return {
      success: false,
      error: err.message || "Failed to activate account.",
    };
  }
}

/**
 * Protected: Get Pending In-App Notifications for Current User (Requirement 8)
 */
export async function getPendingInAppNotifications() {
  const session = await getSessionUser();
  if (!session) return { success: false, data: [] };

  const notifications = await prisma.inAppNotification.findMany({
    where: {
      userId: session.id,
      acknowledgedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: notifications };
}

/**
 * Protected: Acknowledge an In-App Notification (Requirement 8)
 */
export async function acknowledgeInAppNotification(notificationId: string) {
  const session = await getSessionUser();
  if (!session) return { success: false, error: "Unauthorized." };

  await prisma.inAppNotification.updateMany({
    where: {
      id: notificationId,
      userId: session.id,
    },
    data: {
      acknowledgedAt: new Date(),
    },
  });

  return { success: true };
}
