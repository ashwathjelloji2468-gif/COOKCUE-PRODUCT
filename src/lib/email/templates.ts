export interface EmailTemplatePayload {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderFounderApplicationAlert(
  app: { id: string; type: string; applicantName: string; applicantEmail: string; contractorName?: string | null; kitchenName?: string | null; location?: string | null },
  reviewUrl: string
): EmailTemplatePayload {
  const typeLabel =
    app.type === "CONTRACTOR"
      ? "New Contractor Organization Registration"
      : app.type === "HEAD_COOK"
      ? "Head Cook Station Application"
      : "Kitchen Staff Station Application";

  const subject = `[CookCue Action Required] ${typeLabel} — ${app.applicantName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5EF; color: #252C28; margin: 0; padding: 24px; }
    .card { background-color: #FFFFFF; border: 1px solid #E2DFD4; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: #193D32; color: #F7F5EF; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    h1 { color: #193D32; font-size: 22px; margin-top: 0; font-weight: 700; }
    p { line-height: 1.6; font-size: 14px; color: #525C56; }
    .field { margin-bottom: 12px; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6B756E; letter-spacing: 0.05em; }
    .val { font-size: 14px; font-weight: 600; color: #252C28; margin-top: 2px; }
    .btn { display: inline-block; background-color: #193D32; color: #F7F5EF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 24px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2DFD4; font-size: 12px; color: #8F9993; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Founder Alert</span>
    <h1>New Onboarding Application</h1>
    <p>A new applicant has submitted and verified their contact details for platform onboarding.</p>
    
    <div style="background-color: #F7F5EF; border: 1px solid #E2DFD4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div class="field">
        <div class="label">Application Type</div>
        <div class="val">${typeLabel}</div>
      </div>
      <div class="field">
        <div class="label">Applicant Name</div>
        <div class="val">${app.applicantName}</div>
      </div>
      <div class="field">
        <div class="label">Applicant Email</div>
        <div class="val">${app.applicantEmail}</div>
      </div>
      ${app.contractorName ? `<div class="field"><div class="label">Requested Organization</div><div class="val">${app.contractorName}</div></div>` : ""}
      ${app.kitchenName ? `<div class="field"><div class="label">Requested Kitchen Facility</div><div class="val">${app.kitchenName}</div></div>` : ""}
      ${app.location ? `<div class="field"><div class="label">Location</div><div class="val">${app.location}</div></div>` : ""}
    </div>

    <p>Please review organizational affiliation, assign appropriate kitchen tenancy, and approve or reject this application in the Founder Console.</p>
    
    <a href="${reviewUrl}" class="btn">Open Application in Founder Console</a>

    <div class="footer">
      CookCue Multi-Tenant Food Intelligence & Governance • Internal System Alert
    </div>
  </div>
</body>
</html>
  `;

  const text = `
New Onboarding Application — Founder Action Required
Type: ${typeLabel}
Applicant: ${app.applicantName} (${app.applicantEmail})
${app.contractorName ? `Requested Org: ${app.contractorName}\n` : ""}${app.kitchenName ? `Requested Kitchen: ${app.kitchenName}\n` : ""}
Review and take action at: ${reviewUrl}
  `.trim();

  return { subject, html, text };
}

export function renderApplicantVerificationEmail(
  app: { applicantName: string; type: string },
  verificationUrl: string
): EmailTemplatePayload {
  const subject = "Verify your email address for CookCue Onboarding";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5EF; color: #252C28; margin: 0; padding: 24px; }
    .card { background-color: #FFFFFF; border: 1px solid #E2DFD4; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    h1 { color: #193D32; font-size: 22px; margin-top: 0; font-weight: 700; }
    p { line-height: 1.6; font-size: 14px; color: #525C56; }
    .notice { background-color: #F7F5EF; border-left: 4px solid #193D32; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #252C28; margin: 20px 0; }
    .btn { display: inline-block; background-color: #193D32; color: #F7F5EF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2DFD4; font-size: 12px; color: #8F9993; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Verify Your Email Address</h1>
    <p>Hello <strong>${app.applicantName}</strong>,</p>
    <p>Thank you for submitting your application to join CookCue. Please verify that this is your legitimate email address by clicking the link below:</p>

    <a href="${verificationUrl}" class="btn">Verify Email Address</a>

    <div class="notice">
      <strong>Important Process Note:</strong> Email verification confirms your contact address. For security and tenant isolation, your application will then be reviewed by the Platform Founder before account activation is granted.
    </div>

    <p style="font-size: 12px; color: #8F9993;">This verification link will expire in 24 hours. If you did not apply for CookCue, you can safely ignore this email.</p>

    <div class="footer">
      CookCue Institutional Kitchen Intelligence • Zero Black Boxes
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${app.applicantName},
Please verify your email address for your CookCue application by clicking the link below:
${verificationUrl}

Note: Email verification is required before founder review. This link expires in 24 hours.
  `.trim();

  return { subject, html, text };
}

export interface ApplicantApprovalEmailInput {
  applicantName: string;
  assignedRole?: string | null;
  type?: string | null;
  organizationName?: string | null;
  kitchenName?: string | null;
}

export function renderApplicantApprovalEmail(
  app: ApplicantApprovalEmailInput,
  activationUrl: string
): EmailTemplatePayload {
  const isContractor =
    app.type === "CONTRACTOR" ||
    app.assignedRole === "CONTRACTOR_ADMIN" ||
    app.assignedRole === "CONTRACTOR";

  const isHeadCook =
    app.type === "HEAD_COOK" ||
    app.assignedRole === "HEAD_COOK";

  const isKitchenStaff =
    app.type === "KITCHEN_STAFF" ||
    app.assignedRole === "KITCHEN_STAFF";

  let subject: string;
  let headline: string;
  let message: string;
  let badgeText: string;
  const detailRows: { label: string; value: string }[] = [];

  if (isHeadCook) {
    subject = "Your kitchen access has been approved | CookCue";
    headline = "You're approved to join your kitchen.";
    badgeText = "Kitchen Access Approved";
    message =
      "Your request to join CookCue as a Head Cook has been approved. Activate your account to set your password and access your assigned kitchen.";

    if (app.organizationName?.trim()) {
      detailRows.push({ label: "Organization", value: app.organizationName.trim() });
    }
    if (app.kitchenName?.trim()) {
      detailRows.push({ label: "Assigned Kitchen", value: app.kitchenName.trim() });
    }
    detailRows.push({ label: "Approved Role", value: "Head Cook" });
  } else if (isKitchenStaff) {
    subject = "You're approved to join your kitchen | CookCue";
    headline = "Welcome aboard.";
    badgeText = "Kitchen Access Approved";
    message =
      "Your request to join your kitchen on CookCue has been approved. Activate your account to complete setup and access your authorized kitchen workspace.";

    if (app.organizationName?.trim()) {
      detailRows.push({ label: "Organization", value: app.organizationName.trim() });
    }
    if (app.kitchenName?.trim()) {
      detailRows.push({ label: "Assigned Kitchen", value: app.kitchenName.trim() });
    }
    detailRows.push({ label: "Approved Role", value: "Kitchen Staff" });
  } else {
    // Default to Contractor Administrator path
    subject = "Your CookCue application has been approved";
    headline = "Welcome to CookCue.";
    badgeText = "Application Approved";
    message =
      "Your application to join CookCue has been reviewed and approved. Activate your account to set your password and access your organization's kitchen workspace.";

    if (app.organizationName?.trim()) {
      detailRows.push({ label: "Approved Organization", value: app.organizationName.trim() });
    }
    if (app.kitchenName?.trim()) {
      detailRows.push({ label: "Initial Kitchen", value: app.kitchenName.trim() });
    }
  }

  let detailsCardHtml = "";
  if (detailRows.length > 0) {
    const rowHtml = detailRows
      .map(
        (r, idx) => `
    <tr>
      <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6C7771; letter-spacing: 0.05em; ${
        idx > 0 ? "border-top: 1px solid #ECE8DC;" : ""
      }">
        ${escapeHtml(r.label)}
      </td>
      <td align="right" style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #193D32; ${
        idx > 0 ? "border-top: 1px solid #ECE8DC;" : ""
      }">
        ${escapeHtml(r.value)}
      </td>
    </tr>`
      )
      .join("");

    detailsCardHtml = `
    <tr>
      <td style="padding-bottom: 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F7F5EF; border: 1px solid #E5E2D9; border-radius: 10px; overflow: hidden;">
          ${rowHtml}
        </table>
      </td>
    </tr>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #252C28; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F7F5EF; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #FFFFFF; border: 1px solid #E2DFD4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(25, 61, 50, 0.06);">
          
          <!-- Evergreen Brand Hero Header -->
          <tr>
            <td align="center" style="background-color: #193D32; padding: 36px 32px 30px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Brand Glyph & Wordmark -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding-bottom: 8px;">
                          <div style="width: 38px; height: 38px; background-color: #D9EF79; border-radius: 10px; display: inline-block; line-height: 38px; text-align: center; color: #193D32; font-size: 20px; font-weight: 900;">
                            ❖
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="color: #F7F5EF; font-size: 18px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;">
                          COOKCUE
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="color: #D9EF79; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; padding-top: 4px;">
                          Institutional Kitchen Intelligence
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 36px 32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                
                <!-- Status Badge -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <span style="display: inline-block; padding: 5px 14px; border-radius: 9999px; background-color: #F0F7EA; border: 1px solid #D2E7C4; color: #193D32; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">
                      <span style="color: #2E7D32; margin-right: 4px;">●</span> ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>

                <!-- Editorial Headline -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; color: #193D32; font-size: 26px; font-weight: 800; line-height: 1.25; letter-spacing: -0.02em;">
                      ${escapeHtml(headline)}
                    </h1>
                  </td>
                </tr>

                <!-- Salutation & Role-Specific Explanatory Copy -->
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #252C28;">
                      Hello <strong>${escapeHtml(app.applicantName)}</strong>,
                    </p>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #526058;">
                      ${escapeHtml(message)}
                    </p>
                  </td>
                </tr>

                <!-- Details Card (Omitted if no rows present) -->
                ${detailsCardHtml}

                <!-- Activation CTA Button -->
                <tr>
                  <td align="center" style="padding: 8px 0 8px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #D9EF79; border-radius: 8px; border: 1px solid #C5DB68; box-shadow: 0 2px 8px rgba(25, 61, 50, 0.12);">
                          <a href="${escapeHtml(activationUrl)}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #193D32; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 8px; letter-spacing: 0.01em;">
                            Activate My Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Expiration Notice -->
                <tr>
                  <td align="center" style="padding-top: 14px; padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #718277; line-height: 1.5;">
                      ⏰ <strong>Notice:</strong> This secure single-use activation link expires in 7 days.
                    </p>
                  </td>
                </tr>

                <!-- Divider & Fallback Plain-Text Link -->
                <tr>
                  <td style="border-top: 1px solid #ECE8DC; padding-top: 24px;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #718277; line-height: 1.5;">
                      If the button above does not work, copy and paste this link into your browser:
                    </p>
                    <div style="background-color: #F7F5EF; border: 1px solid #E5E2D9; border-radius: 6px; padding: 10px 12px; font-size: 11px; color: #193D32; word-break: break-all; font-family: monospace; line-height: 1.4;">
                      ${escapeHtml(activationUrl)}
                    </div>
                  </td>
                </tr>

                <!-- Security Advisory -->
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="margin: 0; font-size: 11px; color: #8C9991; line-height: 1.5;">
                      Security Note: If you did not request this CookCue account or believe this was sent in error, you can safely ignore this email. No account access will be granted without completing password setup.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Polished Brand Footer -->
          <tr>
            <td align="center" style="background-color: #FAF9F5; border-top: 1px solid #ECE8DC; padding: 24px 32px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #193D32; letter-spacing: 0.05em; text-transform: uppercase;">
                CookCue Multi-Tenant Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #8C9991; line-height: 1.5;">
                Zero Black Boxes • Predictable Portions • Safe Kitchen Governance
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const detailTextLines = detailRows.map((r) => `- ${r.label}: ${r.value}`).join("\n");

  const text = `
COOKCUE — INSTITUTIONAL KITCHEN INTELLIGENCE
=============================================

${headline}

Hello ${app.applicantName},

${message}

${detailRows.length > 0 ? `Approval Details:\n${detailTextLines}\n\n` : ""}ACTIVATE YOUR ACCOUNT:
${activationUrl}

Important Security & Expiration Information:
- This secure single-use activation link expires in 7 days.
- If you did not request this CookCue account or believe this was sent in error, please disregard this email. No account will be activated without password setup.

--
CookCue Multi-Tenant Food Intelligence & Governance
Zero Black Boxes • Predictable Portions • Safe Kitchen Workspaces
  `.trim();

  return { subject, html, text };
}

export function renderApplicantRejectionEmail(
  app: { applicantName: string },
  reason?: string | null
): EmailTemplatePayload {
  const subject = "Update regarding your CookCue Application";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5EF; color: #252C28; margin: 0; padding: 24px; }
    .card { background-color: #FFFFFF; border: 1px solid #E2DFD4; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    h1 { color: #252C28; font-size: 20px; margin-top: 0; font-weight: 700; }
    p { line-height: 1.6; font-size: 14px; color: #525C56; }
    .reason-box { background-color: #FDF3F1; border: 1px solid #F5C6BE; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #8F2B1B; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2DFD4; font-size: 12px; color: #8F9993; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Application Status Update</h1>
    <p>Hello <strong>${app.applicantName}</strong>,</p>
    <p>Thank you for your interest in CookCue. After careful review of your organizational affiliation, the Platform Founder was unable to approve your application at this time.</p>

    ${reason ? `<div class="reason-box"><strong>Founder Review Note:</strong><br>${reason}</div>` : ""}

    <p>If you believe this was in error or if your affiliation details have changed, please contact your institutional mess contractor or submit a new application with verified organization credentials.</p>

    <div class="footer">
      CookCue Multi-Tenant Food Intelligence & Governance
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${app.applicantName},
Thank you for your interest in CookCue.
Your application could not be approved at this time.
${reason ? `Reason: ${reason}\n` : ""}
If you believe this is in error, please contact your organization administrator.
  `.trim();

  return { subject, html, text };
}
