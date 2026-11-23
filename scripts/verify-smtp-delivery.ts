import "dotenv/config";
import { verifySmtpConnection } from "../src/lib/email/transport";
import { getFounderEmails } from "../src/lib/email";

async function main() {
  console.log("=== COOKCUE SMTP CONFIGURATION & CONNECTION DIAGNOSTIC ===");

  // 1. Check SMTP Environment Configuration (never print passwords or secret tokens)
  const hasHost = !!process.env.SMTP_HOST;
  const hasPort = !!process.env.SMTP_PORT;
  const hasUser = !!process.env.SMTP_USER;
  const hasPass = !!(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);

  console.log(`SMTP_HOST configured: ${hasHost}`);
  console.log(`SMTP_PORT configured: ${hasPort ? process.env.SMTP_PORT : "default (587)"}`);
  console.log(`SMTP_USER configured: ${hasUser}`);
  console.log(`SMTP_PASS configured: ${hasPass}`);

  // 2. Founder configuration
  const founders = getFounderEmails();
  console.log(`\nConfigured Founder Notification Recipients (${founders.length}):`);
  founders.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));

  // 3. Diagnostic Connection Test (non-invasive handshake only)
  console.log("\nRunning SMTP connection handshake test (no messages will be sent)...");
  const connResult = await verifySmtpConnection();
  console.log(`Connection diagnostic: configured=${connResult.configured}, verified=${connResult.verified}`);
  console.log(`Diagnostic message: ${connResult.message}`);

  if (connResult.configured && connResult.verified) {
    console.log("\n[STATUS] SMTP server handshake verified successfully.");
    console.log("[STATUS] Zero test emails were transmitted during this diagnostic.");
  } else {
    console.log("\n[STATUS] SMTP is not configured or connection failed.");
  }
}

main().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
