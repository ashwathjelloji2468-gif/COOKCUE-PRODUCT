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

/**
 * Robust signature byte decoder for Web Crypto API.
 * Validates and decodes both hexadecimal (64-char) and Base64URL signatures into a genuine Uint8Array.
 * Rejects odd-length hex, non-hex/non-base64 characters, and malformed/empty signatures safely without throwing.
 */
export function decodeSignatureBytes(sigStr: string): Uint8Array | null {
  if (!sigStr || typeof sigStr !== "string") return null;
  const clean = sigStr.trim();
  if (clean.length === 0) return null;

  // 1. Hexadecimal format (standard token signature: 64 hex chars for SHA-256)
  if (clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean)) {
    const len = clean.length / 2;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const val = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(val)) return null;
      bytes[i] = val;
    }
    return bytes;
  }

  // 2. Base64URL format (standard JWT/JWS compact signature: 43 chars for SHA-256)
  if (/^[A-Za-z0-9_-]+=*$/.test(clean)) {
    try {
      let b64 = clean.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      if (typeof atob === "function") {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
      const buf = Buffer.from(b64, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }

  return null;
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

    const sigBytes = decodeSignatureBytes(sigHex);
    if (!sigBytes || sigBytes.byteLength === 0) {
      return null;
    }

    const isValid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
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
