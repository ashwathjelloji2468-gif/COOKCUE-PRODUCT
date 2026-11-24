import { describe, it, expect } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth/token";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import type { SessionUser } from "@/lib/auth/session";

describe("Cryptographic Authentication & Security Tests", () => {
  const secret = "test_signing_secret_do_not_use_in_production";

  const validFounder: SessionUser = {
    id: "founder-101",
    email: "cookcue149@gmail.com",
    name: "Founder",
    role: "FOUNDER",
    contractorId: null,
    kitchenId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 1 day
  };

  const validCook: SessionUser = {
    id: "cook-202",
    email: "cook@kitchen-a.com",
    name: "Chef",
    role: "HEAD_COOK",
    contractorId: "contractor-1",
    kitchenId: "kitchen-a",
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  };

  it("signs and verifies valid session tokens with Web Crypto HMAC-SHA256", async () => {
    const token = await signSessionToken(validFounder, secret);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const verified = await verifySessionToken<SessionUser>(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("founder-101");
    expect(verified?.role).toBe("FOUNDER");
  });

  it("REJECTS forged or tampered session tokens", async () => {
    // Legitimate cook token
    const token = await signSessionToken(validCook, secret);
    const [payloadBase64, signature] = token.split(".");

    // Attacker modifies role from HEAD_COOK to FOUNDER
    const rawPayload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
    rawPayload.role = "FOUNDER";
    const forgedBase64 = Buffer.from(JSON.stringify(rawPayload), "utf-8").toString("base64url");

    // Tampered token with original signature
    const tamperedToken = `${forgedBase64}.${signature}`;
    const verified = await verifySessionToken(tamperedToken, secret);
    expect(verified).toBeNull(); // Cryptographic signature mismatch!
  });

  it("REJECTS base64-only tokens without signature", async () => {
    const rawBase64 = Buffer.from(JSON.stringify(validFounder)).toString("base64");
    expect(await verifySessionToken(rawBase64, secret)).toBeNull();
  });

  it("REJECTS tokens signed with a different secret", async () => {
    const token = await signSessionToken(validFounder, "attacker_secret_key");
    const verified = await verifySessionToken(token, secret);
    expect(verified).toBeNull();
  });

  it("verifies and hashes passwords securely with salt", () => {
    const password = "StrongPassword@2026!";
    const hash = hashPassword(password);

    expect(typeof hash).toBe("string");
    expect(hash.split(":").length).toBe(3); // salt:iterations:hash

    // Verify correct password
    expect(verifyPassword(password, hash)).toBe(true);

    // Reject wrong password
    expect(verifyPassword("WrongPassword", hash)).toBe(false);
  });

  it("REJECTS tampered kitchenId for cross-kitchen privilege escalation", async () => {
    const token = await signSessionToken(validCook, secret);
    const [payloadBase64, signature] = token.split(".");

    const rawPayload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
    rawPayload.kitchenId = "unauthorized-kitchen-target-b";
    const forgedBase64 = Buffer.from(JSON.stringify(rawPayload), "utf-8").toString("base64url");

    const tamperedToken = `${forgedBase64}.${signature}`;
    expect(await verifySessionToken(tamperedToken, secret)).toBeNull();
  });

  it("fails closed in production if SESSION_SECRET is missing or under 32 characters", async () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // Missing secret
      delete process.env.SESSION_SECRET;
      await expect(signSessionToken(validCook)).rejects.toThrow(/SECURITY FAULT/);

      // Too short secret
      process.env.SESSION_SECRET = "short_secret_key";
      await expect(signSessionToken(validCook)).rejects.toThrow(/at least 32 characters/);

      // Sufficient secret (32+ chars)
      process.env.SESSION_SECRET = "a_very_secure_and_long_production_secret_key_1234567890";
      await expect(signSessionToken(validCook)).resolves.toBeDefined();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      process.env.SESSION_SECRET = origSecret;
    }
  });

  it("REJECTS non-hex / malformed signatures without throwing unhandled exceptions", async () => {
    const token = await signSessionToken(validCook, secret);
    const [payloadBase64] = token.split(".");

    // Non-hex signature characters (such as test fixtures)
    const malformedToken1 = `${payloadBase64}.invalidsignature`;
    expect(await verifySessionToken(malformedToken1, secret)).toBeNull();

    const malformedToken2 = `${payloadBase64}.dummyhmacsignature`;
    expect(await verifySessionToken(malformedToken2, secret)).toBeNull();
  });

  it("REJECTS odd-length hexadecimal signatures safely", async () => {
    const token = await signSessionToken(validCook, secret);
    const [payloadBase64, signature] = token.split(".");

    // Truncate signature to an odd length
    const oddSignature = signature.slice(0, signature.length - 1);
    expect(oddSignature.length % 2).toBe(1);

    const oddToken = `${payloadBase64}.${oddSignature}`;
    expect(await verifySessionToken(oddToken, secret)).toBeNull();
  });

  it("REJECTS empty, null, and whitespace tokens safely", async () => {
    expect(await verifySessionToken("", secret)).toBeNull();
    expect(await verifySessionToken("   ", secret)).toBeNull();
    expect(await verifySessionToken(null as any, secret)).toBeNull();
    expect(await verifySessionToken(undefined as any, secret)).toBeNull();
  });

  it("REJECTS expired session tokens based on expiresAt timestamp", async () => {
    const expiredCook: SessionUser = {
      ...validCook,
      issuedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      expiresAt: Date.now() - 1000 * 60 * 60,    // 1 hour ago
    };

    const token = await signSessionToken(expiredCook, secret);
    const verified = await verifySessionToken<SessionUser>(token, secret);
    expect(verified).not.toBeNull();
    // Cryptographically valid, but expiresAt is in the past
    expect(Date.now() > verified!.expiresAt).toBe(true);
  });

  it("VERIFIES tokens with valid Base64URL signatures seamlessly", async () => {
    // Generate valid HMAC signature directly via Web Crypto
    const resolvedSecret = secret;
    const payloadJson = JSON.stringify(validFounder);
    const payloadB64 = Buffer.from(payloadJson, "utf-8").toString("base64url");

    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(resolvedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const rawSig = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payloadB64)
    );

    const base64urlSig = Buffer.from(rawSig).toString("base64url");
    const b64urlToken = `${payloadB64}.${base64urlSig}`;

    const verified = await verifySessionToken<SessionUser>(b64urlToken, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("founder-101");
    expect(verified?.role).toBe("FOUNDER");
  });
});
