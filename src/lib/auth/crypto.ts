import crypto from "crypto";

const DEV_FALLBACK_SECRET = "messwise_dev_session_hmac_sha256_super_secret_key_change_in_production";

/**
 * Returns the session signing secret.
 * Enforces strict fail-closed security in production:
 * - Throws if SESSION_SECRET is unset in production.
 * - Throws if SESSION_SECRET is shorter than 32 characters in production.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.trim() === "") {
      throw new Error("SECURITY FAULT: SESSION_SECRET environment variable is missing in production. Application fails closed.");
    }
    if (secret.length < 32) {
      throw new Error("SECURITY FAULT: SESSION_SECRET must be at least 32 characters in production. Application fails closed.");
    }
    return secret;
  }

  return secret || DEV_FALLBACK_SECRET;
}

/**
 * Hash a password using PBKDF2 with a cryptographically secure random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 10000;
  const keylen = 64;
  const digest = "sha512";
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
  return `${salt}:${iterations}:${hash}`;
}

/**
 * Verify a password against a stored PBKDF2 salt-iteration-hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;
    const [salt, iterationsStr, originalHash] = parts;
    const iterations = parseInt(iterationsStr, 10);
    const keylen = 64;
    const digest = "sha512";
    const testHash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(testHash, "hex"), Buffer.from(originalHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * Sign a payload with HMAC-SHA256, returning base64Payload.signature
 */
export function signSessionPayload(payload: object, secret?: string): string {
  const resolvedSecret = secret || getSessionSecret();
  const serialized = JSON.stringify(payload);
  const base64Payload = Buffer.from(serialized, "utf-8").toString("base64url");
  const hmac = crypto.createHmac("sha256", resolvedSecret);
  hmac.update(base64Payload);
  const signature = hmac.digest("hex");
  return `${base64Payload}.${signature}`;
}

/**
 * Verify HMAC-SHA256 signature and return decoded payload if valid
 */
export function verifySessionToken<T = any>(token: string, secret?: string): T | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    const resolvedSecret = secret || getSessionSecret();
    const hmac = crypto.createHmac("sha256", resolvedSecret);
    hmac.update(base64Payload);
    const expectedSignature = hmac.digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const json = Buffer.from(base64Payload, "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random, 256-bit secure bearer token.
 * Output is 64 hex characters (32 random bytes) from system CSPRNG.
 */
export function generateBearerToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Compute SHA-256 cryptographic hash of a bearer token for safe database persistence and comparison.
 * Bearer tokens must NEVER be stored in plaintext.
 */
export function hashBearerToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

