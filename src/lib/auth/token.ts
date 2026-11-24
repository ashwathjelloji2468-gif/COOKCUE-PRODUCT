/**
 * Web Crypto API-based session signing and verification.
 * 100% compliant with standard Web Crypto (Edge Runtime, Node.js 18+, browsers).
 * Does NOT import Node's 'crypto' module, ensuring zero Edge Runtime build warnings or runtime faults.
 */

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

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.trim().toLowerCase();
  if (cleanHex.length % 2 !== 0) return new ArrayBuffer(0);
  const buffer = new ArrayBuffer(cleanHex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return buffer;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(str, "utf-8").toString("base64");
  return b64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf-8");
}

/**
 * Sign payload with HMAC-SHA256 using standard Web Crypto API.
 */
export async function signSessionToken(payload: object, secret?: string): Promise<string> {
  const resolvedSecret = secret || getSessionSecret();
  const serialized = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(serialized);

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(resolvedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );

  const sigHex = bufferToHex(signature);
  return `${encodedPayload}.${sigHex}`;
}

/**
 * Verify HMAC-SHA256 signed token using Web Crypto API.
 * Resistant to timing attacks via constant-time subtle.verify.
 */
export async function verifySessionToken<T = any>(token: string, secret?: string): Promise<T | null> {
  try {
    if (!token || typeof token !== "string") {
      console.error("[verifySessionToken] Empty or non-string token:", typeof token);
      return null;
    }
    const cleanToken = token.trim().replace(/^"+|"+$/g, "");
    const parts = cleanToken.split(".");
    if (parts.length !== 2) {
      console.error("[verifySessionToken] Invalid token parts:", parts.length);
      return null;
    }

    const [b64Payload, sigHex] = parts;
    if (!b64Payload || !sigHex) {
      console.error("[verifySessionToken] Missing payload or signature hex");
      return null;
    }

    const resolvedSecret = secret || getSessionSecret();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(resolvedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBuffer = hexToBuffer(sigHex);
    if (sigBuffer.byteLength === 0) {
      console.error("[verifySessionToken] Empty signature bytes");
      return null;
    }

    const isValid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      new TextEncoder().encode(b64Payload)
    );

    if (!isValid) {
      console.error("[verifySessionToken] subtle.verify returned false");
      return null;
    }

    const json = base64UrlDecode(b64Payload);
    return JSON.parse(json) as T;
  } catch (err: any) {
    console.error("[verifySessionToken] Error during verification:", err?.message || err);
    return null;
  }
}
