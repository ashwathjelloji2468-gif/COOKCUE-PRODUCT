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
  if (hex.length % 2 !== 0) return new ArrayBuffer(0);
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return buffer;
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64url");
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(b64url: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64url, "base64url").toString("utf-8");
  }
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
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
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [b64Payload, sigHex] = parts;
    if (!b64Payload || !sigHex) return null;

    const resolvedSecret = secret || getSessionSecret();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(resolvedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBuffer = hexToBuffer(sigHex);
    if (sigBuffer.byteLength === 0) return null;

    const isValid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      new TextEncoder().encode(b64Payload)
    );

    if (!isValid) return null;

    const json = base64UrlDecode(b64Payload);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
