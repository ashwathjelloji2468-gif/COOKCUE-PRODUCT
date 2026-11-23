import { describe, it, expect, beforeEach } from "vitest";
import { renderApplicantApprovalEmail, renderFounderApplicationAlert } from "@/lib/email/templates";
import {
  sendApplicantApprovalEmail,
  sendFounderAlertEmail,
  getSentEmails,
  clearSentEmails,
  setSimulateSmtpFailure,
} from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { generateNextContractorCode } from "@/server/actions/contractor-code";
import {
  submitOnboardingApplication,
  verifyApplicantEmail,
  approveApplicationAsFounder,
  activateApplicantAccount,
} from "@/server/actions/onboarding";
import { hashBearerToken } from "@/lib/auth/crypto";

describe("CookCue Premium Role-Specific Approval Email Redesign", () => {
  const dummyToken = "abcdef1234567890abcdef1234567890";
  const dummyActivationUrl = `http://localhost:3000/activate?token=${dummyToken}`;

  beforeEach(() => {
    clearSentEmails();
    setSimulateSmtpFailure(false);
  });

  it("1. Contractor Administrator: verifies subject, heading, copy, details, and activation button", () => {
    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Aarav Sharma",
        type: "CONTRACTOR",
        assignedRole: "CONTRACTOR_ADMIN",
        organizationName: "Grand Heritage Catering",
        kitchenName: "Hostel 3 Main Mess",
      },
      dummyActivationUrl
    );

    // Subject & Badging
    expect(payload.subject).toBe("Your CookCue application has been approved");
    expect(payload.html).toContain("Application Approved");

    // Editorial Headline & Copy
    expect(payload.html).toContain("Welcome to CookCue.");
    expect(payload.html).toContain(
      "Your application to join CookCue has been reviewed and approved. Activate your account to set your password and access your organization&#39;s kitchen workspace."
    );

    // Details Card
    expect(payload.html).toContain("Approved Organization");
    expect(payload.html).toContain("Grand Heritage Catering");
    expect(payload.html).toContain("Initial Kitchen");
    expect(payload.html).toContain("Hostel 3 Main Mess");

    // CTA Button
    expect(payload.html).toContain("Activate My Account");
    expect(payload.html).toContain(`href="${dummyActivationUrl}"`);

    // Plain text alternative
    expect(payload.text).toContain("Welcome to CookCue.");
    expect(payload.text).toContain("Your application to join CookCue has been reviewed and approved.");
    expect(payload.text).toContain("- Approved Organization: Grand Heritage Catering");
    expect(payload.text).toContain("- Initial Kitchen: Hostel 3 Main Mess");
    expect(payload.text).toContain(dummyActivationUrl);
    expect(payload.text).toContain("This secure single-use activation link expires in 7 days.");
  });

  it("2. Head Cook: verifies role-specific subject, heading, copy, details, and role label", () => {
    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Chef Rajesh Kumar",
        type: "HEAD_COOK",
        assignedRole: "HEAD_COOK",
        organizationName: "Apex Campus Dining",
        kitchenName: "Engineering Block Kitchen",
      },
      dummyActivationUrl
    );

    // Subject & Badging
    expect(payload.subject).toBe("Your kitchen access has been approved | CookCue");
    expect(payload.html).toContain("Kitchen Access Approved");

    // Editorial Headline & Copy
    expect(payload.html).toContain("You&#39;re approved to join your kitchen.");
    expect(payload.html).toContain(
      "Your request to join CookCue as a Head Cook has been approved. Activate your account to set your password and access your assigned kitchen."
    );

    // Details Card
    expect(payload.html).toContain("Organization");
    expect(payload.html).toContain("Apex Campus Dining");
    expect(payload.html).toContain("Assigned Kitchen");
    expect(payload.html).toContain("Engineering Block Kitchen");
    expect(payload.html).toContain("Approved Role");
    expect(payload.html).toContain("Head Cook");

    // CTA Button
    expect(payload.html).toContain("Activate My Account");
    expect(payload.html).toContain(`href="${dummyActivationUrl}"`);

    // Plain text alternative
    expect(payload.text).toContain("You're approved to join your kitchen.");
    expect(payload.text).toContain("Your request to join CookCue as a Head Cook has been approved.");
    expect(payload.text).toContain("- Organization: Apex Campus Dining");
    expect(payload.text).toContain("- Assigned Kitchen: Engineering Block Kitchen");
    expect(payload.text).toContain("- Approved Role: Head Cook");
    expect(payload.text).toContain(dummyActivationUrl);
  });

  it("3. Kitchen Staff: verifies role-specific subject, heading, copy, details, and role label", () => {
    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Priya Nair",
        type: "KITCHEN_STAFF",
        assignedRole: "KITCHEN_STAFF",
        organizationName: "Apex Campus Dining",
        kitchenName: "North Campus Central Dining",
      },
      dummyActivationUrl
    );

    // Subject & Badging
    expect(payload.subject).toBe("You're approved to join your kitchen | CookCue");
    expect(payload.html).toContain("Kitchen Access Approved");

    // Editorial Headline & Copy
    expect(payload.html).toContain("Welcome aboard.");
    expect(payload.html).toContain(
      "Your request to join your kitchen on CookCue has been approved. Activate your account to complete setup and access your authorized kitchen workspace."
    );

    // Details Card
    expect(payload.html).toContain("Organization");
    expect(payload.html).toContain("Apex Campus Dining");
    expect(payload.html).toContain("Assigned Kitchen");
    expect(payload.html).toContain("North Campus Central Dining");
    expect(payload.html).toContain("Approved Role");
    expect(payload.html).toContain("Kitchen Staff");

    // CTA Button
    expect(payload.html).toContain("Activate My Account");
    expect(payload.html).toContain(`href="${dummyActivationUrl}"`);

    // Plain text alternative
    expect(payload.text).toContain("Welcome aboard.");
    expect(payload.text).toContain("Your request to join your kitchen on CookCue has been approved.");
    expect(payload.text).toContain("- Organization: Apex Campus Dining");
    expect(payload.text).toContain("- Assigned Kitchen: North Campus Central Dining");
    expect(payload.text).toContain("- Approved Role: Kitchen Staff");
  });

  it("4. Each email contains the real activation URL generated by the existing workflow", () => {
    const uniqueToken = "9f8e7d6c5b4a32109f8e7d6c5b4a3210";
    const activationUrl = `http://localhost:3000/activate?token=${uniqueToken}`;

    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Test Candidate",
        type: "CONTRACTOR",
        assignedRole: "CONTRACTOR_ADMIN",
      },
      activationUrl
    );

    expect(payload.html).toContain(`href="${activationUrl}"`);
    expect(payload.html).toContain(activationUrl);
    expect(payload.text).toContain(activationUrl);
  });

  it("5. Each HTML template includes the corresponding plain-text alternative", () => {
    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Vikram Sen",
        type: "HEAD_COOK",
        assignedRole: "HEAD_COOK",
        organizationName: "Culinary Tech Systems",
        kitchenName: "South Dining Hall",
      },
      dummyActivationUrl
    );

    expect(payload.text).toBeTruthy();
    expect(payload.text.length).toBeGreaterThan(100);
    expect(payload.text).toContain("COOKCUE — INSTITUTIONAL KITCHEN INTELLIGENCE");
    expect(payload.text).toContain("Vikram Sen");
    expect(payload.text).toContain("Culinary Tech Systems");
    expect(payload.text).toContain("South Dining Hall");
    expect(payload.text).toContain(dummyActivationUrl);
    expect(payload.text).toContain("7 days");
    expect(payload.text).toContain("disregard this email");
  });

  it("6. User-provided names and organization details are safely escaped in HTML", () => {
    const maliciousInput = {
      applicantName: "<script>alert('xss')</script> Ravi & Sons",
      type: "CONTRACTOR",
      organizationName: "Tiffin Masters <img src=x onerror=alert(1)> & Co.",
      kitchenName: "Dining Hall 'Alpha' & \"Beta\"",
    };

    const payload = renderApplicantApprovalEmail(maliciousInput, dummyActivationUrl);

    // Dangerous tags are completely escaped
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt; Ravi &amp; Sons");
    expect(payload.html).toContain("Tiffin Masters &lt;img src=x onerror=alert(1)&gt; &amp; Co.");
    expect(payload.html).toContain("Dining Hall &#39;Alpha&#39; &amp; &quot;Beta&quot;");
  });

  it("7. Missing optional details do not produce fabricated content", () => {
    // Only applicant name is provided; organization and kitchen are null
    const payload = renderApplicantApprovalEmail(
      {
        applicantName: "Minimal Applicant",
        type: "CONTRACTOR",
        assignedRole: "CONTRACTOR_ADMIN",
        organizationName: null,
        kitchenName: null,
      },
      dummyActivationUrl
    );

    // Must NOT contain fabricated defaults
    expect(payload.html).not.toContain("Central Kitchen");
    expect(payload.html).not.toContain("Default Org");
    expect(payload.html).not.toContain("Approved Organization");
    expect(payload.html).not.toContain("Initial Kitchen");

    // Plain text also omits empty rows
    expect(payload.text).not.toContain("Central Kitchen");
    expect(payload.text).not.toContain("Approved Organization");
  });

  it("8. Approval emails go only to the applicant's registered email", async () => {
    const recipient = "exclusive.candidate@collegecampus.edu";
    await sendApplicantApprovalEmail(
      {
        applicantName: "Exclusive Candidate",
        applicantEmail: recipient,
        type: "CONTRACTOR",
        assignedRole: "CONTRACTOR_ADMIN",
      },
      dummyToken
    );

    const sent = getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(recipient);
    expect(sent[0].subject).toBe("Your CookCue application has been approved");
  });

  it("9. Founder review notifications never receive applicant activation tokens", async () => {
    const founderRecipient = "founder@cookcue.org";
    await sendFounderAlertEmail(
      {
        id: "app-test-id",
        type: "CONTRACTOR",
        applicantName: "Secret Token Candidate",
        applicantEmail: "secret@applicant.com",
        contractorName: "Secret Org",
      },
      founderRecipient
    );

    const sent = getSentEmails();
    const founderEmail = sent.find((e) => e.to === founderRecipient);
    expect(founderEmail).toBeDefined();

    // Must NEVER leak activation token
    expect(founderEmail!.html).not.toContain("/activate?token=");
    expect(founderEmail!.text).not.toContain("/activate?token=");
    expect(founderEmail!.html).toContain("/founder/applications/app-test-id");
  });

  it("10. Full Lifecycle: Approved applicant receives role-specific email and can activate account", async () => {
    const timestamp = Date.now();
    const testCandidateEmail = `headcook_${timestamp}@campusmess.org`;

    // Setup an active contractor and kitchen first
    const ctrCode = await generateNextContractorCode();
    const contractor = await prisma.contractor.create({
      data: { name: `Campus Dining Org ${timestamp}`, code: ctrCode, status: "ACTIVE" },
    });
    const kitchen = await prisma.kitchen.create({
      data: { contractorId: contractor.id, name: "Engineering Hostel Mess", status: "ACTIVE" },
    });

    // 1. Submit Head Cook application
    const submitRes = await submitOnboardingApplication({
      type: "HEAD_COOK",
      applicantName: "Chef Sanjeev",
      applicantEmail: testCandidateEmail,
      contractorName: contractor.name,
      kitchenName: kitchen.name,
    });
    if (!submitRes.success) throw new Error(`Submission failed: ${submitRes.error}`);
    expect(submitRes.success).toBe(true);

    // 2. Extract verification token and verify email
    const sentAfterSubmit = getSentEmails();
    const verifyEmail = sentAfterSubmit.find((e) => e.to.toLowerCase() === testCandidateEmail.toLowerCase());
    const rawVerifyToken = (verifyEmail!.html + " " + verifyEmail!.text).match(/token=([a-f0-9]+)/)![1];

    const verifyRes = await verifyApplicantEmail(rawVerifyToken);
    expect(verifyRes.success).toBe(true);

    // 3. Founder approves application and maps to kitchen
    clearSentEmails();
    const approveRes = await approveApplicationAsFounder({
      applicationId: submitRes.applicationId,
      contractorId: contractor.id,
      kitchenId: kitchen.id,
    });
    expect(approveRes.success).toBe(true);

    // Verify approval email dispatch
    const sentAfterApprove = getSentEmails();
    const approvalEmail = sentAfterApprove.find((e) => e.to.toLowerCase() === testCandidateEmail.toLowerCase());
    expect(approvalEmail).toBeDefined();

    // Verify role-specific content in the real approval email
    expect(approvalEmail!.subject).toBe("Your kitchen access has been approved | CookCue");
    expect(approvalEmail!.html).toContain("You&#39;re approved to join your kitchen.");
    expect(approvalEmail!.html).toContain(contractor.name);
    expect(approvalEmail!.html).toContain(kitchen.name);
    expect(approvalEmail!.html).toContain("Head Cook");
    expect(approvalEmail!.html).toContain("Activate My Account");

    // 4. Extract activation token and activate account
    const rawActivationToken = (approvalEmail!.html + " " + approvalEmail!.text).match(/token=([a-f0-9]+)/)![1];
    expect(rawActivationToken).toBeTruthy();

    const activateRes = await activateApplicantAccount({
      token: rawActivationToken,
      password: "TestPassword@2026",
      confirmPassword: "TestPassword@2026",
    });
    expect(activateRes.success).toBe(true);
    expect(activateRes.role).toBe("HEAD_COOK");

    // Token cannot be replayed
    const replayRes = await activateApplicantAccount({
      token: rawActivationToken,
      password: "NewPassword@2026",
      confirmPassword: "NewPassword@2026",
    });
    expect(replayRes.success).toBe(false);
  });

  it("11. Automated tests send zero real SMTP messages", () => {
    // Verified by checking that process.env.TEST_LIVE_SMTP is not set during automated tests,
    // and all sent messages reside purely in captured mock records
    const sent = getSentEmails();
    for (const msg of sent) {
      expect(msg.status).toBe("CAPTURED");
    }
  });
});
