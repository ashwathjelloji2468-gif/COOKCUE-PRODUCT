import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  submitOnboardingApplication,
  verifyApplicantEmail,
  resendVerificationEmail,
  approveApplicationAsFounder,
  rejectApplicationAsFounder,
  retryNotificationAsFounder,
  activateApplicantAccount,
} from "@/server/actions/onboarding";
import {
  getSentEmails,
  clearSentEmails,
  setSimulateSmtpFailure,
  verifySmtpConnection,
  parseFounderEmails,
  getFounderEmails,
} from "@/lib/email";
import { sendViaSmtp } from "@/lib/email/transport";
import { verifyPassword, hashBearerToken } from "@/lib/auth/crypto";

function extractRawTokenFromEmail(recipient: string, type: "verify" | "activate" = "verify"): string {
  const sent = getSentEmails();
  const email = sent.find((e) =>
    e.to.toLowerCase() === recipient.toLowerCase() &&
    (type === "verify" ? e.subject.toLowerCase().includes("verify") : e.subject.toLowerCase().includes("approved"))
  );
  if (!email) {
    throw new Error(
      `Expected email for ${recipient} (${type}) not found. Captured emails: ${JSON.stringify(
        sent.map((s) => ({ to: s.to, subject: s.subject }))
      )}`
    );
  }
  const match = (email.html + " " + email.text).match(/token=([a-f0-9]+)/);
  if (!match) {
    throw new Error(`Token parameter not found in email for ${recipient}`);
  }
  return match[1];
}

describe("CookCue Institutional Onboarding & Lifecycle Verification", () => {
  const timestamp = Date.now();
  const testContractorEmail = `contractor_${timestamp}@testenterprise.org`;
  const testHeadCookEmail = `headcook_${timestamp}@testenterprise.org`;
  const testStaffEmail = `staff_${timestamp}@testenterprise.org`;
  const testContractorId = `test-onboard-ctr-${timestamp}`;
  const testKitchen1Id = `test-onboard-k1-${timestamp}`;
  const testKitchen2Id = `test-onboard-k2-${timestamp}`;

  beforeAll(async () => {
    await prisma.kitchen.deleteMany({ where: { id: { in: [testKitchen1Id, testKitchen2Id] } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: `CTR-${String(timestamp).slice(-6)}`,
        name: `Demo Contractor ${timestamp}`,
        status: "ACTIVE",
        kitchens: {
          create: [
            { id: testKitchen1Id, name: "Central Kitchen A", status: "ACTIVE" },
            { id: testKitchen2Id, name: "Hostel Kitchen B", status: "ACTIVE" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.onboardingApplication.deleteMany({
      where: {
        applicantEmail: {
          contains: String(timestamp),
        },
      },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: String(timestamp),
        },
      },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: [testKitchen1Id, testKitchen2Id] } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
  });

  beforeEach(() => {
    clearSentEmails();
    setSimulateSmtpFailure(false);
  });

  it("1. Contractor Onboarding Flow: submission, verification, founder approval, org creation, and activation", async () => {
    // 1. Submit Contractor application
    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Aarav Sharma",
      applicantEmail: testContractorEmail,
      contractorName: `Test Catering Corp ${timestamp}`,
      kitchenName: "Main University Mess",
      location: "Bangalore",
    });

    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({
      where: { id: appId },
      include: { notificationLogs: true },
    });

    expect(app).not.toBeNull();
    expect(app?.status).toBe("PENDING_EMAIL_VERIFICATION");
    expect(app?.emailVerificationToken).toBeTruthy();
    expect(app?.notificationLogs.length).toBe(1);
    expect(app?.notificationLogs[0].status).toBe("CAPTURED");
    expect(app?.notificationLogs[0].errorMessage).toContain("Captured by local development/test fallback");

    // Email dispatch check
    const sentEmails = getSentEmails();
    expect(sentEmails.some((e) => e.to === testContractorEmail)).toBe(true);

    const rawVerificationToken = extractRawTokenFromEmail(testContractorEmail, "verify");
    // Requirement 2: Confirm only cryptographic SHA-256 hash is in the database; raw token never stored
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawVerificationToken));
    expect(app?.emailVerificationToken).not.toBe(rawVerificationToken);

    // Requirement 4: Submitted tokens are hashed before comparison — attempting to verify with the DB hash fails
    const hashVerifyRes = await verifyApplicantEmail(app!.emailVerificationToken!);
    expect(hashVerifyRes.success).toBe(false);

    // 2. Email Verification with raw token from email
    const verifyRes = await verifyApplicantEmail(rawVerificationToken);
    expect(verifyRes.success).toBe(true);

    const verifiedApp = await prisma.onboardingApplication.findUnique({
      where: { id: appId },
      include: { notificationLogs: true },
    });
    expect(verifiedApp?.status).toBe("PENDING_FOUNDER_REVIEW");
    expect(verifiedApp?.emailVerifiedAt).not.toBeNull();
    expect(verifiedApp?.emailVerificationToken).toBeNull(); // Single-use wipe

    // Founder alert email was dispatched
    const emailsAfterVerify = getSentEmails();
    expect(emailsAfterVerify.some((e) => e.subject.includes("[CookCue Action Required]"))).toBe(true);

    // Replay protection: re-verifying same token fails
    const replayVerify = await verifyApplicantEmail(rawVerificationToken);
    expect(replayVerify.success).toBe(false);

    // 3. Founder Approval: Contractor creates Org + initial Kitchen + CONTRACTOR_ADMIN role
    const approveRes = await approveApplicationAsFounder({ applicationId: appId });
    expect(approveRes.success).toBe(true);

    const approvedApp = await prisma.onboardingApplication.findUnique({
      where: { id: appId },
    });
    expect(approvedApp?.status).toBe("APPROVED_PENDING_ACTIVATION");
    expect(approvedApp?.assignedRole).toBe("CONTRACTOR_ADMIN");
    expect(approvedApp?.assignedContractorId).toBeTruthy();
    expect(approvedApp?.assignedKitchenId).toBeTruthy();
    expect(approvedApp?.activationToken).toBeTruthy();

    // Verify Contractor and Kitchen were created in database
    const createdContractor = await prisma.contractor.findUnique({
      where: { id: approvedApp!.assignedContractorId! },
    });
    expect(createdContractor?.name).toBe(`Test Catering Corp ${timestamp}`);

    const createdKitchen = await prisma.kitchen.findUnique({
      where: { id: approvedApp!.assignedKitchenId! },
    });
    expect(createdKitchen?.name).toBe("Main University Mess");
    expect(createdKitchen?.contractorId).toBe(createdContractor?.id);

    // Approval activation email was dispatched
    const emailsAfterApprove = getSentEmails();
    expect(emailsAfterApprove.some((e) => e.subject === "Your CookCue application has been approved")).toBe(true);

    const rawActivationToken = extractRawTokenFromEmail(testContractorEmail, "activate");
    // Requirement 2: Confirm only cryptographic SHA-256 hash of activation token is persisted
    expect(approvedApp?.activationToken).toBe(hashBearerToken(rawActivationToken));
    expect(approvedApp?.activationToken).not.toBe(rawActivationToken);

    // Attempting activation with the direct DB hash fails (Requirement 4)
    const directHashActivate = await activateApplicantAccount({
      token: approvedApp!.activationToken!,
      password: "TestSecurePassword@123",
      confirmPassword: "TestSecurePassword@123",
    });
    expect(directHashActivate.success).toBe(false);

    // 4. Activation Flow with raw bearer token
    const activateRes = await activateApplicantAccount({
      token: rawActivationToken,
      password: "TestSecurePassword@123",
      confirmPassword: "TestSecurePassword@123",
    });

    expect(activateRes.success).toBe(true);
    expect(activateRes.role).toBe("CONTRACTOR_ADMIN");

    // Verify User in database
    const user = await prisma.user.findUnique({
      where: { email: testContractorEmail },
      include: { inAppNotifications: true },
    });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("CONTRACTOR_ADMIN");
    expect(user?.status).toBe("ACTIVE");
    expect(verifyPassword("TestSecurePassword@123", user!.passwordHash!)).toBe(true);

    // In-app welcome notification was generated
    expect(user?.inAppNotifications.length).toBe(1);
    expect(user?.inAppNotifications[0].acknowledgedAt).toBeNull();

    // Replay protection: re-activation fails
    const replayActivate = await activateApplicantAccount({
      token: rawActivationToken,
      password: "TestSecurePassword@123",
      confirmPassword: "TestSecurePassword@123",
    });
    expect(replayActivate.success).toBe(false);
  });

  it("2. Head Cook Application Flow: mapping to existing contractor and kitchen", async () => {
    // 1. Submit Head Cook application
    const submitRes = await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Chef Vikram",
      applicantEmail: testHeadCookEmail,
      contractorName: "Demo Contractor Pvt Ltd",
      kitchenName: "Central Kitchen A",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({ where: { id: appId } });

    // Verify email using raw token extracted from captured email
    const rawVerifyToken = extractRawTokenFromEmail(testHeadCookEmail, "verify");
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawVerifyToken));
    await verifyApplicantEmail(rawVerifyToken);

    // 2. Founder Approval mapping to existing Contractor A and Kitchen A
    const approveRes = await approveApplicationAsFounder({
      applicationId: appId,
      contractorId: testContractorId,
      kitchenId: testKitchen1Id,
    });
    expect(approveRes.success).toBe(true);

    const approvedApp = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    expect(approvedApp?.status).toBe("APPROVED_PENDING_ACTIVATION");
    expect(approvedApp?.assignedRole).toBe("HEAD_COOK");
    expect(approvedApp?.assignedContractorId).toBe(testContractorId);
    expect(approvedApp?.assignedKitchenId).toBe(testKitchen1Id);

    // 3. Activate account using raw activation token from captured email
    const rawActivationToken = extractRawTokenFromEmail(testHeadCookEmail, "activate");
    expect(approvedApp?.activationToken).toBe(hashBearerToken(rawActivationToken));

    const activateRes = await activateApplicantAccount({
      token: rawActivationToken,
      password: "ChefPassword@123",
      confirmPassword: "ChefPassword@123",
    });
    expect(activateRes.success).toBe(true);
    expect(activateRes.role).toBe("HEAD_COOK");
    expect(activateRes.kitchenId).toBe(testKitchen1Id);
  });

  it("3. Kitchen Staff Application Flow: mapping to existing facility", async () => {
    const submitRes = await submitOnboardingApplication({
      type: "KITCHEN_STAFF",
      applicantName: "Sanjay Prep",
      applicantEmail: testStaffEmail,
      contractorName: `Demo Contractor ${timestamp}`,
      kitchenName: "Hostel Kitchen B",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    const rawStaffToken = extractRawTokenFromEmail(testStaffEmail, "verify");
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawStaffToken));
    await verifyApplicantEmail(rawStaffToken);

    const approveRes = await approveApplicationAsFounder({
      applicationId: appId,
      contractorId: testContractorId,
      kitchenId: testKitchen2Id,
    });
    expect(approveRes.success).toBe(true);

    const approvedApp = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    expect(approvedApp?.assignedRole).toBe("KITCHEN_STAFF");
    expect(approvedApp?.assignedKitchenId).toBe(testKitchen2Id);
  });

  it("4. Founder cannot approve an application with unverified email", async () => {
    const unverifiedEmail = `unverified_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Unverified Applicant",
      applicantEmail: unverifiedEmail,
      contractorName: "Unverified Org",
      kitchenName: "Unverified Kitchen",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    // Attempt approval while email is still unverified
    const approveRes = await approveApplicationAsFounder({
      applicationId: submitRes.applicationId,
    });
    expect(approveRes.success).toBe(false);
    expect(approveRes.error).toContain("has not been verified yet");
  });

  it("5. Rejection Flow: founder records reason, status updates, rejection email sent", async () => {
    const rejectEmail = `reject_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Reject Candidate",
      applicantEmail: rejectEmail,
      contractorName: "Invalid Contractor",
      kitchenName: "Nonexistent Kitchen",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    const rawVerifyToken = extractRawTokenFromEmail(rejectEmail, "verify");
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawVerifyToken));
    await verifyApplicantEmail(rawVerifyToken);

    // Reject application
    const rejectRes = await rejectApplicationAsFounder({
      applicationId: appId,
      reason: "Could not verify institutional mess affiliation with university administration.",
    });
    expect(rejectRes.success).toBe(true);

    const rejectedApp = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    expect(rejectedApp?.status).toBe("REJECTED");
    expect(rejectedApp?.rejectionReason).toContain("Could not verify institutional mess affiliation");

    // Rejection email check
    const sent = getSentEmails();
    expect(sent.some((e) => e.to === rejectEmail && e.subject.includes("Update regarding your CookCue Application"))).toBe(true);
  });

  it("6. Failure Handling & Safe Retry: SMTP failure preserves application and allows safe retry", async () => {
    // Enable simulated SMTP failure
    setSimulateSmtpFailure(true);

    const failEmail = `smtp_fail_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Failover Candidate",
      applicantEmail: failEmail,
      contractorName: "Demo Contractor Pvt Ltd",
      kitchenName: "Central Kitchen A",
    });

    // Application was successfully persisted despite mail failure
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({
      where: { id: appId },
      include: { notificationLogs: true },
    });

    expect(app).not.toBeNull();
    expect(app?.status).toBe("PENDING_EMAIL_VERIFICATION");
    expect(app?.notificationLogs.length).toBe(1);
    expect(app?.notificationLogs[0].status).toBe("FAILED");
    expect(app?.notificationLogs[0].errorMessage).toContain("simulated transport failure");

    // Disable failure and perform safe retry
    setSimulateSmtpFailure(false);
    const retryRes = await retryNotificationAsFounder(app!.notificationLogs[0].id);
    expect(retryRes.success).toBe(true);

    const updatedLog = await prisma.applicationNotificationLog.findUnique({
      where: { id: app!.notificationLogs[0].id },
    });
    expect(updatedLog?.status).toBe("CAPTURED");
    expect(updatedLog?.errorMessage).toContain("Captured by local development/test fallback");
    expect(updatedLog?.attemptCount).toBe(2);

    // Verify retrying did not create duplicate applications
    const count = await prisma.onboardingApplication.count({
      where: { applicantEmail: failEmail },
    });
    expect(count).toBe(1);
  });

  it("7. Duplicate Protection & Resend Limits", async () => {
    const dupeEmail = `dupe_${timestamp}@testenterprise.org`;
    const res1 = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "First Submission",
      applicantEmail: dupeEmail,
      contractorName: "Dupe Org",
    });
    expect(res1.success).toBe(true);
    if (!res1.success) return;

    // Immediate second submission for same email is blocked
    const res2 = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Second Submission",
      applicantEmail: dupeEmail,
      contractorName: "Dupe Org",
    });
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error).toContain("Please check your inbox or wait before resubmitting");
    }

    // Resend limit test
    const appId = res1.applicationId;
    const resend1 = await resendVerificationEmail(appId);
    expect(resend1.success).toBe(true);

    const resend2 = await resendVerificationEmail(appId);
    expect(resend2.success).toBe(true);

    // 4th attempt exceeds max 3 in 1 hour
    const resend3 = await resendVerificationEmail(appId);
    expect(resend3.success).toBe(false);
    expect(resend3.error).toContain("Too many verification requests");
  });

  it("8. Expired Verification and Activation Tokens Fail Safely", async () => {
    const expiredEmail = `expired_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Expired Token User",
      applicantEmail: expiredEmail,
      contractorName: "Demo Contractor Pvt Ltd",
      kitchenName: "Central Kitchen A",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const rawVerifyToken = extractRawTokenFromEmail(expiredEmail, "verify");

    // Simulate token expiration (set to 1 hour ago)
    await prisma.onboardingApplication.update({
      where: { id: appId },
      data: {
        emailVerificationTokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    const verifyRes = await verifyApplicantEmail(rawVerifyToken);
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error).toContain("Verification link has expired");

    // Re-issue valid expiration and verify
    await prisma.onboardingApplication.update({
      where: { id: appId },
      data: {
        emailVerificationTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    const validVerify = await verifyApplicantEmail(rawVerifyToken);
    expect(validVerify.success).toBe(true);

    // Approve application
    await approveApplicationAsFounder({
      applicationId: appId,
      contractorId: testContractorId,
      kitchenId: testKitchen1Id,
    });

    const rawActivationToken = extractRawTokenFromEmail(expiredEmail, "activate");

    // Manually expire activation token
    await prisma.onboardingApplication.update({
      where: { id: appId },
      data: {
        activationTokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    const activateRes = await activateApplicantAccount({
      token: rawActivationToken,
      password: "ExpiredPassword@123",
      confirmPassword: "ExpiredPassword@123",
    });

    expect(activateRes.success).toBe(false);
    expect(activateRes.error).toContain("Activation link has expired");
  });

  it("9. Access Denial Before Activation: Unapproved applicants cannot authenticate", async () => {
    const unapprovedEmail = `unapproved_${timestamp}@testenterprise.org`;
    await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Unapproved Cook",
      applicantEmail: unapprovedEmail,
      contractorName: "Demo Contractor Pvt Ltd",
      kitchenName: "Central Kitchen A",
    });

    // Verify applicant has no User row in database
    const userInDb = await prisma.user.findUnique({
      where: { email: unapprovedEmail },
    });
    expect(userInDb).toBeNull();
  });

  it("10. Approval Email Failure Preserves APPROVED_PENDING_ACTIVATION State", async () => {
    const failApprovalEmail = `fail_approve_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Fail Approval Applicant",
      applicantEmail: failApprovalEmail,
      contractorName: `Failover Org ${timestamp}`,
      kitchenName: "Failover Kitchen",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const appId = submitRes.applicationId;
    const app = await prisma.onboardingApplication.findUnique({ where: { id: appId } });
    const rawVerifyToken = extractRawTokenFromEmail(failApprovalEmail, "verify");
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawVerifyToken));
    await verifyApplicantEmail(rawVerifyToken);

    // Enable failure before approval
    setSimulateSmtpFailure(true);

    const approveRes = await approveApplicationAsFounder({ applicationId: appId });
    expect(approveRes.success).toBe(true); // Action succeeds and preserves state

    const approvedApp = await prisma.onboardingApplication.findUnique({
      where: { id: appId },
      include: { notificationLogs: true },
    });

    // Status is preserved as APPROVED_PENDING_ACTIVATION (Requirement 14.3)
    expect(approvedApp?.status).toBe("APPROVED_PENDING_ACTIVATION");
    const approvalLog = approvedApp?.notificationLogs.find((l) => l.template === "APPLICANT_APPROVAL_ACTIVATION");
    expect(approvalLog?.status).toBe("FAILED");

    // Retrying sends email cleanly
    setSimulateSmtpFailure(false);
    const retryRes = await retryNotificationAsFounder(approvalLog!.id);
    expect(retryRes.success).toBe(true);

    const updatedLog = await prisma.applicationNotificationLog.findUnique({ where: { id: approvalLog!.id } });
    expect(updatedLog?.status).toBe("CAPTURED");
    expect(updatedLog?.errorMessage).toContain("Captured by local development/test fallback");
  });

  it("11. Production Fails Closed When SMTP Host Is Missing", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalHost = process.env.SMTP_HOST;
    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.SMTP_HOST;

      // Direct transport invocation in production throws and fails closed
      await expect(
        sendViaSmtp({
          to: "test@example.com",
          from: "noreply@cookcue.org",
          subject: "Prod Test",
          text: "Testing production fail closed",
          html: "<p>Testing production fail closed</p>",
        })
      ).rejects.toThrow("Production email delivery failed closed");

      // Server action handles production failure gracefully without dropping application
      const prodRes = await submitOnboardingApplication({
        type: "CONTRACTOR",
        applicantName: "Prod Applicant",
        applicantEmail: `prod_${timestamp}@testenterprise.org`,
        contractorName: "Prod Org",
      });

      expect(prodRes.success).toBe(true);
      if (prodRes.success) {
        const prodApp = await prisma.onboardingApplication.findUnique({
          where: { id: prodRes.applicationId },
          include: { notificationLogs: true },
        });
        expect(prodApp).not.toBeNull();
        expect(prodApp?.notificationLogs.length).toBe(1);
        expect(prodApp?.notificationLogs[0].status).toBe("FAILED");
        expect(prodApp?.notificationLogs[0].errorMessage).toContain("Production email delivery failed closed");
      }
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalHost) {
        process.env.SMTP_HOST = originalHost;
      }
    }
  });

  it("12. Diagnostic SMTP Connection Verification", async () => {
    // 1. When SMTP is configured with real credentials
    const diag = await verifySmtpConnection();
    expect(diag.configured).toBe(true);
    expect(diag.verified).toBe(true);
    expect(diag.message).toContain("SMTP connection established and verified");

    // 2. When SMTP host is missing
    const host = process.env.SMTP_HOST;
    try {
      delete process.env.SMTP_HOST;
      const unconfiguredDiag = await verifySmtpConnection();
      expect(unconfiguredDiag.configured).toBe(false);
      expect(unconfiguredDiag.verified).toBe(false);
      expect(unconfiguredDiag.message).toContain("SMTP is not configured");
    } finally {
      process.env.SMTP_HOST = host;
    }
  }, 15000);

  it("13. Notification Flow Across All Applicant Types With Safe Rejection", async () => {
    // Test Staff Rejection Flow with reason and email dispatch
    const staffRejectionEmail = `staff_reject_${timestamp}@testenterprise.org`;
    const submitStaff = await submitOnboardingApplication({
      type: "KITCHEN_STAFF",
      applicantName: "Staff Reject Candidate",
      applicantEmail: staffRejectionEmail,
      kitchenName: "South Dining Hall",
    });
    expect(submitStaff.success).toBe(true);
    if (!submitStaff.success) return;

    const staffApp = await prisma.onboardingApplication.findUnique({
      where: { id: submitStaff.applicationId },
    });
    // Verify email first using raw token from email
    const rawStaffToken = extractRawTokenFromEmail(staffRejectionEmail, "verify");
    await verifyApplicantEmail(rawStaffToken);

    // Reject application with reason
    const rejectRes = await rejectApplicationAsFounder({
      applicationId: staffApp!.id,
      reason: "Position for South Dining Hall staff has already been filled.",
    });
    expect(rejectRes.success).toBe(true);

    const rejectedApp = await prisma.onboardingApplication.findUnique({
      where: { id: staffApp!.id },
      include: { notificationLogs: true },
    });

    expect(rejectedApp?.status).toBe("REJECTED");
    expect(rejectedApp?.rejectionReason).toBe("Position for South Dining Hall staff has already been filled.");

    const rejectionLog = rejectedApp?.notificationLogs.find((l) => l.template === "APPLICANT_REJECTION");
    expect(rejectionLog).toBeDefined();
    expect(rejectionLog?.status).toBe("CAPTURED");

    // Email dispatch verification
    const sent = getSentEmails();
    const rejectionEmail = sent.find((e) => e.to === staffRejectionEmail && e.subject.includes("Update regarding your CookCue Application"));
    expect(rejectionEmail).toBeDefined();
    expect(rejectionEmail?.text).toContain("Position for South Dining Hall staff has already been filled.");
  });

  it("14. Multi-Founder Notification Configuration & Individual Recipient Tracking", async () => {
    // 1. Validation test of parseFounderEmails
    expect(parseFounderEmails("  founder1@example.com ,  founder2@example.com  ")).toEqual([
      "founder1@example.com",
      "founder2@example.com",
    ]);

    // Deduplication test (case-insensitive)
    expect(parseFounderEmails("admin@cookcue.org, ADMIN@COOKCUE.ORG, other@cookcue.org")).toEqual([
      "admin@cookcue.org",
      "other@cookcue.org",
    ]);

    // Invalid email rejection test
    expect(() => parseFounderEmails("not-an-email, founder@example.com")).toThrow(
      "is not a valid email address format"
    );

    // Empty configuration rejection test
    expect(() => parseFounderEmails("   ")).toThrow("is empty");

    // 2. Integration test: 2 founders configured
    const originalFounderConfig = process.env.FOUNDER_NOTIFICATION_EMAIL;
    const founderA = `founder_a_${timestamp}@example.com`;
    const founderB = `founder_b_${timestamp}@example.com`;
    process.env.FOUNDER_NOTIFICATION_EMAIL = `${founderA}, ${founderB}`;

    try {
      const applicantEmail = `multifounder_applicant_${timestamp}@testenterprise.org`;
      const submitRes = await submitOnboardingApplication({
        type: "HEAD_COOK",
        applicantName: "Chef Multi",
        applicantEmail,
        contractorName: "Campus Dining Ltd",
        kitchenName: "Dining Hall C",
      });
      expect(submitRes.success).toBe(true);
      if (!submitRes.success) return;

      const app = await prisma.onboardingApplication.findUnique({
        where: { id: submitRes.applicationId },
      });

      const rawMultiToken = extractRawTokenFromEmail(applicantEmail, "verify");
      clearSentEmails();

      // Verify email -> triggers dual founder alerts
      const verifyRes = await verifyApplicantEmail(rawMultiToken);
      expect(verifyRes.success).toBe(true);

      const verifiedApp = await prisma.onboardingApplication.findUnique({
        where: { id: app!.id },
        include: { notificationLogs: true },
      });

      // Individual notification logs created for each founder
      const alertLogs = verifiedApp!.notificationLogs.filter(
        (l) => l.template === "FOUNDER_APPLICATION_ALERT"
      );
      expect(alertLogs.length).toBe(2);

      const recipients = alertLogs.map((l) => l.recipient);
      expect(recipients).toContain(founderA);
      expect(recipients).toContain(founderB);

      // Both logs are captured locally (in test environment)
      expect(alertLogs.every((l) => l.status === "CAPTURED")).toBe(true);

      // Sent emails contain separate messages for each founder
      const sent = getSentEmails();
      const emailToFounderA = sent.find((e) => e.to === founderA);
      const emailToFounderB = sent.find((e) => e.to === founderB);

      expect(emailToFounderA).toBeDefined();
      expect(emailToFounderB).toBeDefined();
      expect(emailToFounderA?.subject).toContain("Chef Multi");
      expect(emailToFounderB?.subject).toContain("Chef Multi");

      // Verify applicant did NOT receive founder alert email
      const alertToApplicant = sent.find((e) => e.to === applicantEmail && e.subject.includes("[CookCue Action Required]"));
      expect(alertToApplicant).toBeUndefined();

      // Verify individual retry operates on single recipient
      const logToRetry = alertLogs.find((l) => l.recipient === founderA)!;
      await prisma.applicationNotificationLog.update({
        where: { id: logToRetry.id },
        data: { status: "FAILED", errorMessage: "simulated failure" },
      });
      clearSentEmails();
      const retryRes = await retryNotificationAsFounder(logToRetry.id);
      expect(retryRes.success).toBe(true);

      const retriedSent = getSentEmails();
      expect(retriedSent.length).toBe(1);
      expect(retriedSent[0].to).toBe(founderA);
    } finally {
      process.env.FOUNDER_NOTIFICATION_EMAIL = originalFounderConfig;
    }
  });

  it("15. Regression: Page visits, invalid tokens, resubmission, and resend trigger ZERO founder emails", async () => {
    clearSentEmails();

    // 1. Invalid or empty tokens send ZERO emails
    const resEmpty = await verifyApplicantEmail("");
    expect(resEmpty.success).toBe(false);
    expect(getSentEmails().length).toBe(0);

    const resFake = await verifyApplicantEmail("non-existent-token-12345");
    expect(resFake.success).toBe(false);
    expect(getSentEmails().length).toBe(0);

    // 2. Application submission only sends to applicant, NEVER to founders
    const regEmail = `anti_spam_applicant_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "KITCHEN_STAFF",
      applicantName: "Anti Spam Candidate",
      applicantEmail: regEmail,
      kitchenName: "Dining Hall D",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const emailsAfterSubmit = getSentEmails();
    // Only 1 email was sent, and it was to the applicant
    expect(emailsAfterSubmit.length).toBe(1);
    expect(emailsAfterSubmit[0].to).toBe(regEmail);
    expect(emailsAfterSubmit[0].subject).toContain("Verify your email address for CookCue");

    // Zero founder alerts were dispatched
    const founderAlerts = emailsAfterSubmit.filter((e) =>
      e.subject.includes("[CookCue Action Required]")
    );
    expect(founderAlerts.length).toBe(0);

    // 3. Resend verification only sends to applicant, NEVER to founders
    clearSentEmails();
    const resendRes = await resendVerificationEmail(submitRes.applicationId);
    expect(resendRes.success).toBe(true);

    const emailsAfterResend = getSentEmails();
    expect(emailsAfterResend.length).toBe(1);
    expect(emailsAfterResend[0].to).toBe(regEmail);
    expect(emailsAfterResend.filter((e) => e.subject.includes("[CookCue Action Required]")).length).toBe(0);
  });

  it("16. Regression: Verification produces exactly one founder notification per recipient; repeated verification/refreshes produce zero additional emails", async () => {
    clearSentEmails();
    const applicantEmail = `idempotent_verify_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Idempotent Applicant",
      applicantEmail,
      contractorName: "Safe Catering Corp",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const app = await prisma.onboardingApplication.findUnique({
      where: { id: submitRes.applicationId },
    });
    const token = extractRawTokenFromEmail(applicantEmail, "verify");

    clearSentEmails();

    // First verification: succeeds and dispatches to each founder recipient
    const verify1 = await verifyApplicantEmail(token);
    expect(verify1.success).toBe(true);

    const sentAfterFirst = getSentEmails();
    const founderEmailsFirst = sentAfterFirst.filter((e) =>
      e.subject.includes("[CookCue Action Required]")
    );
    const expectedFoundersCount = getFounderEmails().length;
    // Exactly one founder alert email per configured founder
    expect(founderEmailsFirst.length).toBe(expectedFoundersCount);

    const logsAfterFirst = await prisma.applicationNotificationLog.count({
      where: {
        applicationId: app!.id,
        template: "FOUNDER_APPLICATION_ALERT",
      },
    });
    expect(logsAfterFirst).toBe(expectedFoundersCount);

    // Simulated browser refresh or replayed request with same token
    clearSentEmails();
    const verify2 = await verifyApplicantEmail(token);
    expect(verify2.success).toBe(false);

    // ZERO emails sent on refresh / replay
    expect(getSentEmails().length).toBe(0);

    // Total logs in DB must remain exactly expectedFoundersCount
    const logsAfterSecond = await prisma.applicationNotificationLog.count({
      where: {
        applicationId: app!.id,
        template: "FOUNDER_APPLICATION_ALERT",
      },
    });
    expect(logsAfterSecond).toBe(expectedFoundersCount);

    // Third attempt (e.g. repeated user click)
    const verify3 = await verifyApplicantEmail(token);
    expect(verify3.success).toBe(false);
    expect(getSentEmails().length).toBe(0);

    const logsAfterThird = await prisma.applicationNotificationLog.count({
      where: {
        applicationId: app!.id,
        template: "FOUNDER_APPLICATION_ALERT",
      },
    });
    expect(logsAfterThird).toBe(expectedFoundersCount);
  });

  it("17. Regression: Failed deliveries remain retryable without duplicating applications, contractors, or kitchens", async () => {
    clearSentEmails();
    const failApplicantEmail = `retry_safety_${timestamp}@testenterprise.org`;
    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Retry Safety Candidate",
      applicantEmail: failApplicantEmail,
      contractorName: `Safe Retries Org ${timestamp}`,
      kitchenName: "Safe Kitchen Alpha",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const app = await prisma.onboardingApplication.findUnique({
      where: { id: submitRes.applicationId },
    });
    const rawRetryToken = extractRawTokenFromEmail(failApplicantEmail, "verify");

    // Simulate failure during email verification founder alerts
    setSimulateSmtpFailure(true);
    await verifyApplicantEmail(rawRetryToken);
    setSimulateSmtpFailure(false);

    const failedLogs = await prisma.applicationNotificationLog.findMany({
      where: {
        applicationId: app!.id,
        template: "FOUNDER_APPLICATION_ALERT",
      },
    });

    const expectedFoundersCount = getFounderEmails().length;
    expect(failedLogs.length).toBe(expectedFoundersCount);
    expect(failedLogs.every((l) => l.status === "FAILED")).toBe(true);

    // Retry first founder notification
    clearSentEmails();
    const retryRes = await retryNotificationAsFounder(failedLogs[0].id);
    expect(retryRes.success).toBe(true);

    const retriedLog = await prisma.applicationNotificationLog.findUnique({
      where: { id: failedLogs[0].id },
    });
    expect(retriedLog?.status).toBe("CAPTURED");
    expect(retriedLog?.attemptCount).toBe(2);

    // Retrying an already successful/captured notification is blocked from duplicate dispatch
    const dupRetry = await retryNotificationAsFounder(failedLogs[0].id);
    expect(dupRetry.success).toBe(false);
    expect(dupRetry.error).toContain("Only failed notifications can be retried");
    // Attempt count stays 2
    const logAfterDup = await prisma.applicationNotificationLog.findUnique({
      where: { id: failedLogs[0].id },
    });
    expect(logAfterDup?.attemptCount).toBe(2);

    // Ensure zero duplicate applications
    const countApps = await prisma.onboardingApplication.count({
      where: { applicantEmail: failApplicantEmail },
    });
    expect(countApps).toBe(1);
  });

  it("18. Security Audit: Bearer Token Cryptographic Entropy & Plaintext Token Absence", async () => {
    clearSentEmails();
    const entropyTestEmail = `entropy_${Date.now()}@testenterprise.org`;

    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Security Candidate",
      applicantEmail: entropyTestEmail,
      contractorName: "Entropy Test Org",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    // 1. Raw token in email is 256 bits (64 hex chars)
    const rawToken = extractRawTokenFromEmail(entropyTestEmail, "verify");
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    // 2. Database stores only the SHA-256 hash (never the raw token)
    const app = await prisma.onboardingApplication.findUnique({
      where: { id: submitRes.applicationId },
      include: { notificationLogs: true },
    });

    expect(app?.emailVerificationToken).not.toBe(rawToken);
    expect(app?.emailVerificationToken).toBe(hashBearerToken(rawToken));

    // 3. Raw token NEVER appears in notification logs or ordinary error logs
    for (const log of app?.notificationLogs || []) {
      expect(log.errorMessage || "").not.toContain(rawToken);
    }

    // 4. Verification consumes raw token; founder alert NEVER includes verification token
    clearSentEmails();
    const verifyRes = await verifyApplicantEmail(rawToken);
    expect(verifyRes.success).toBe(true);

    const founderEmails = getSentEmails();
    for (const founderEmail of founderEmails) {
      expect(founderEmail.html).not.toContain(rawToken);
      expect(founderEmail.text).not.toContain(rawToken);
      expect(founderEmail.subject).not.toContain(rawToken);
    }

    // 5. Activation token audit
    await approveApplicationAsFounder({ applicationId: app!.id });
    const rawActivationToken = extractRawTokenFromEmail(entropyTestEmail, "activate");
    expect(rawActivationToken).toMatch(/^[a-f0-9]{64}$/);

    const approvedApp = await prisma.onboardingApplication.findUnique({
      where: { id: app!.id },
    });
    expect(approvedApp?.activationToken).not.toBe(rawActivationToken);
    expect(approvedApp?.activationToken).toBe(hashBearerToken(rawActivationToken));
  });

  it("19. Security Audit: Replay Attack and Concurrent Request Single-Winner Guarantee", async () => {
    clearSentEmails();
    const concurrentEmail = `concurrent_${Date.now()}@testenterprise.org`;

    const submitRes = await submitOnboardingApplication({
      type: "CONTRACTOR",
      applicantName: "Concurrent Test User",
      applicantEmail: concurrentEmail,
      contractorName: "Concurrent Org",
    });
    expect(submitRes.success).toBe(true);
    if (!submitRes.success) return;

    const rawToken = extractRawTokenFromEmail(concurrentEmail, "verify");

    // Race 5 concurrent verification requests simultaneously
    const verifyPromises = [
      verifyApplicantEmail(rawToken),
      verifyApplicantEmail(rawToken),
      verifyApplicantEmail(rawToken),
      verifyApplicantEmail(rawToken),
      verifyApplicantEmail(rawToken),
    ];

    const verifyResults = await Promise.all(verifyPromises);
    const successfulVerifies = verifyResults.filter((r) => r.success);
    // Exactly one winner succeeds
    expect(successfulVerifies.length).toBe(1);

    // Verify token is wiped in DB
    const appAfterRace = await prisma.onboardingApplication.findUnique({
      where: { id: submitRes.applicationId },
    });
    expect(appAfterRace?.status).toBe("PENDING_FOUNDER_REVIEW");
    expect(appAfterRace?.emailVerificationToken).toBeNull();

    // Founder approves
    await approveApplicationAsFounder({ applicationId: submitRes.applicationId });
    const rawActivationToken = extractRawTokenFromEmail(concurrentEmail, "activate");

    // Race 5 concurrent account activations simultaneously
    const activatePromises = Array.from({ length: 5 }, () =>
      activateApplicantAccount({
        token: rawActivationToken,
        password: "ConcurrentPass@123",
        confirmPassword: "ConcurrentPass@123",
      })
    );

    const activateResults = await Promise.all(activatePromises);
    const successfulActivations = activateResults.filter((r) => r.success);
    // Exactly one winner succeeds in activation
    expect(successfulActivations.length).toBe(1);

    // User is created only once
    const userCount = await prisma.user.count({
      where: { email: concurrentEmail },
    });
    expect(userCount).toBe(1);

    // Token is wiped
    const appFinal = await prisma.onboardingApplication.findUnique({
      where: { id: submitRes.applicationId },
    });
    expect(appFinal?.status).toBe("ACTIVATED");
    expect(appFinal?.activationToken).toBeNull();
  });

  it("20. Security Audit: Synthetic Tokens in Automated Tests without Real SMTP Dispatches", async () => {
    clearSentEmails();
    const syntheticEmail = `synthetic_${Date.now()}@testenterprise.org`;
    const syntheticRawToken = "synthetic-secret-token-abcdef1234567890";
    const syntheticHash = hashBearerToken(syntheticRawToken);

    // Directly create test record with synthetic hashed token
    const testApp = await prisma.onboardingApplication.create({
      data: {
        type: "CONTRACTOR",
        status: "PENDING_EMAIL_VERIFICATION",
        applicantName: "Synthetic Test Candidate",
        applicantEmail: syntheticEmail,
        contractorName: "Synthetic Catering Ltd",
        emailVerificationToken: syntheticHash,
        emailVerificationTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    // Submitting wrong raw token fails
    const invalidVerify = await verifyApplicantEmail("wrong-raw-token");
    expect(invalidVerify.success).toBe(false);

    // Submitting synthetic raw token succeeds (because its hash matches DB)
    const validVerify = await verifyApplicantEmail(syntheticRawToken);
    expect(validVerify.success).toBe(true);

    // Zero real SMTP messages sent (mock transport captures locally)
    const captured = getSentEmails();
    expect(captured.every((c) => c.status === "CAPTURED")).toBe(true);
  });
});
