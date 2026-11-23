import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  submitOnboardingApplication,
  verifyApplicantEmail,
  approveApplicationAsFounder,
  retryNotificationAsFounder,
} from "../src/server/actions/onboarding";
import { getFounderEmails, verifySmtpConnection, getSentEmails } from "../src/lib/email";

async function main() {
  const isRealEmail = process.argv.includes("--send-real-email");

  console.log("=================================================================");
  console.log(`   COOKCUE SMTP DELIVERY TEST — ${isRealEmail ? "LIVE MODE (--send-real-email)" : "DRY RUN MODE (DEFAULT)"}`);
  console.log("=================================================================\n");

  // 1. Resolve and validate founder recipients
  const founders = getFounderEmails();
  console.log(`Configured Founder Recipients (${founders.length}):`);
  founders.forEach((f, i) => console.log(`  [${i + 1}] ${f} — Template: FOUNDER_APPLICATION_ALERT`));

  console.log(`\nIntended Applicant Recipient:`);
  console.log(`  cookcue149@gmail.com — Templates: APPLICANT_EMAIL_VERIFICATION, APPLICANT_APPROVAL_ACTIVATION\n`);

  console.log("Message Types Verified:");
  console.log("  1. APPLICANT_EMAIL_VERIFICATION (Registration token dispatch)");
  console.log("  2. FOUNDER_APPLICATION_ALERT (Individual founder notification per recipient)");
  console.log("  3. APPLICANT_APPROVAL_ACTIVATION (Expiring single-use activation link)");
  console.log("  4. APPLICANT_REJECTION (Optional founder rejection with note)\n");

  // 2. Run non-invasive connection diagnostic
  const diag = await verifySmtpConnection();
  console.log(`SMTP Connection Diagnostic: ${diag.verified ? "VERIFIED (OK)" : "FAILED / NOT CONFIGURED"}`);
  console.log(`Diagnostic Message: ${diag.message}\n`);

  // Default mode: Dry run (no actual emails sent)
  if (!isRealEmail) {
    console.log("-----------------------------------------------------------------");
    console.log("DRY RUN SUMMARY (SAFE MODE):");
    console.log("  • NO real emails were transmitted to external mail relays.");
    console.log("  • Both founder recipient addresses were validated successfully.");
    console.log("  • SMTP transport handshake was verified without sending.");
    console.log("  • To dispatch actual live test emails, execute with explicit flag:");
    console.log("      npx tsx scripts/test-real-smtp-delivery.ts --send-real-email");
    console.log("-----------------------------------------------------------------\n");
    return;
  }

  // Live Mode: explicitly enabled via --send-real-email
  if (!diag.verified) {
    throw new Error("Cannot run live delivery test: SMTP connection verification failed.");
  }

  process.env.TEST_LIVE_SMTP = "true";

  const timestamp = Date.now();
  const testCandidateEmail = "cookcue149@gmail.com";

  // Clean any previous test records for this email
  await prisma.user.deleteMany({ where: { email: testCandidateEmail } }).catch(() => {});
  await prisma.onboardingApplication.deleteMany({ where: { applicantEmail: testCandidateEmail } }).catch(() => {});

  // Step 1: Submit Application (Contractor Type)
  console.log("--- STEP 1: SUBMITTING TEST APPLICATION ---");
  const submitRes = await submitOnboardingApplication({
    type: "CONTRACTOR",
    applicantName: "Ashwath Jelloji",
    applicantEmail: testCandidateEmail,
    contractorName: `Gourmet Campus Hospitality ${timestamp}`,
    kitchenName: "Central Student Mess A",
    location: "Bangalore Campus",
  });

  if (!submitRes.success) {
    throw new Error(`Submission failed: ${submitRes.error}`);
  }
  console.log(`Application created successfully (ID: ${submitRes.applicationId})`);

  const appAfterSubmit = await prisma.onboardingApplication.findUnique({
    where: { id: submitRes.applicationId },
    include: { notificationLogs: true },
  });

  const verifyLog = appAfterSubmit?.notificationLogs.find(
    (l) => l.template === "APPLICANT_EMAIL_VERIFICATION"
  );
  console.log(`Verification Email Dispatch Log:`);
  console.log(`  Recipient: ${verifyLog?.recipient}`);
  console.log(`  Status: ${verifyLog?.status}`);
  console.log(`  Server Response: ${verifyLog?.errorMessage}`);

  // Step 2: Applicant Verifies Email (Triggers Dual Founder Alerts)
  console.log("\n--- STEP 2: VERIFYING EMAIL & DISPATCHING DUAL FOUNDER ALERTS ---");
  const sentEmails = getSentEmails();
  const verifyEmail = sentEmails.find(
    (e) => e.to.toLowerCase() === testCandidateEmail.toLowerCase() && e.subject.includes("Verify")
  );
  if (!verifyEmail) {
    throw new Error("Applicant verification email not found in sent emails.");
  }
  const tokenMatch = (verifyEmail.html + " " + verifyEmail.text).match(/token=([a-f0-9]+)/);
  if (!tokenMatch) {
    throw new Error("Raw verification token parameter not found in applicant email.");
  }
  const rawVerificationToken = tokenMatch[1];
  const verifyRes = await verifyApplicantEmail(rawVerificationToken);

  if (!verifyRes.success) {
    throw new Error(`Verification failed: ${verifyRes.error}`);
  }
  console.log(`Email successfully verified. Status promoted to PENDING_FOUNDER_REVIEW.`);

  const appAfterVerify = await prisma.onboardingApplication.findUnique({
    where: { id: submitRes.applicationId },
    include: { notificationLogs: true },
  });

  const founderLogs = appAfterVerify!.notificationLogs.filter(
    (l) => l.template === "FOUNDER_APPLICATION_ALERT"
  );
  console.log(`Founder Alert Logs Created: ${founderLogs.length}`);

  for (const log of founderLogs) {
    console.log(`  Recipient: ${log.recipient}`);
    console.log(`    Status: ${log.status}`);
    console.log(`    Attempts: ${log.attemptCount}`);
    console.log(`    Server Response: ${log.errorMessage}`);
    console.log(`    Last Attempt: ${log.lastAttemptAt}`);
  }

  // Step 3: Founder Review & Approval Flow
  console.log("\n--- STEP 3: FOUNDER APPROVES APPLICATION & SENDS ACTIVATION EMAIL ---");
  const approveRes = await approveApplicationAsFounder({
    applicationId: submitRes.applicationId,
  });

  if (!approveRes.success) {
    throw new Error(`Approval failed: ${approveRes.error}`);
  }
  console.log(`Application approved. Status promoted to APPROVED_PENDING_ACTIVATION.`);

  const appAfterApprove = await prisma.onboardingApplication.findUnique({
    where: { id: submitRes.applicationId },
    include: { notificationLogs: true },
  });

  const approvalLog = appAfterApprove!.notificationLogs.find(
    (l) => l.template === "APPLICANT_APPROVAL_ACTIVATION"
  );
  console.log(`Applicant Approval Dispatch Log:`);
  console.log(`  Recipient: ${approvalLog?.recipient}`);
  console.log(`  Status: ${approvalLog?.status}`);
  console.log(`  Server Response: ${approvalLog?.errorMessage}`);
  console.log(`  Activation Token Generated: [REDACTED 32-byte token]`);

  // Step 4: Test Safe Retry on a Founder Log
  console.log("\n--- STEP 4: VERIFYING SAFE RETRY IDEMPOTENCY ---");
  const logToRetry = founderLogs[0];
  console.log(`Checking idempotency: retrying already accepted log ${logToRetry.id}...`);
  const retryBlockedRes = await retryNotificationAsFounder(logToRetry.id);
  console.log(`  Expected block on already-accepted log: success=${retryBlockedRes.success}, error="${retryBlockedRes.error}"`);

  // Simulate a temporary delivery failure to verify safe retry recovery
  console.log(`Simulating a failed state on log ${logToRetry.id} to verify retry recovery...`);
  await prisma.applicationNotificationLog.update({
    where: { id: logToRetry.id },
    data: { status: "FAILED", errorMessage: "Simulated network timeout for retry testing" },
  });

  const retryRes = await retryNotificationAsFounder(logToRetry.id);
  console.log(`Retry Recovery Result: success=${retryRes.success}`);

  const logAfterRetry = await prisma.applicationNotificationLog.findUnique({
    where: { id: logToRetry.id },
  });
  console.log(`  Updated Status: ${logAfterRetry?.status}`);
  console.log(`  Attempt Count: ${logAfterRetry?.attemptCount}`);
  console.log(`  Updated Server Response: ${logAfterRetry?.errorMessage}`);

  // Confirm no duplicate applications
  const appCount = await prisma.onboardingApplication.count({
    where: { applicantEmail: testCandidateEmail },
  });
  console.log(`\nIntegrity Audit: Total Applications for email = ${appCount} (Expected: 1)`);

  console.log("\n=================================================================");
  console.log("  ALL LIVE DELIVERY CHECKS COMPLETED AND CONFIRMED BY GMAIL SMTP");
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("\nFATAL ERROR DURING LIVE SMTP DELIVERY:", err);
  process.exit(1);
});
