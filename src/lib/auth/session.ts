import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain/types";
import { signSessionToken, verifySessionToken } from "./token";
import { isContractorCode, normalizeContractorCode } from "@/lib/domain/identifiers";

export type SessionUser = {
  id: string;
  code?: string | null;
  email: string;
  name: string;
  role: Role;
  contractorId: string | null;
  kitchenId: string | null;
  issuedAt: number;
  expiresAt: number;
};

export const SESSION_COOKIE_NAME = "cookcue_session";
export const LEGACY_SESSION_COOKIE_NAME = "messwise_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Get the currently authenticated session user with cryptographic signature
 * and live database state verification.
 * Supports transparent migration from legacy messwise_session -> cookcue_session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  // 1. Verify cryptographic HMAC signature via Web Crypto
  const session = await verifySessionToken<SessionUser>(token);
  if (!session) return null;

  // 2. Check expiration timestamp
  if (Date.now() > session.expiresAt) {
    return null;
  }

  // 3. Database State & Revocation Verification
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        code: true,
        email: true,
        name: true,
        role: true,
        status: true,
        contractorId: true,
        kitchenId: true,
      },
    });

    if (!dbUser || dbUser.status !== "ACTIVE") {
      return null;
    }

    // Ensure session role and assignments match current database authorization
    return {
      id: dbUser.id,
      code: dbUser.code || null,
      email: dbUser.email,
      name: dbUser.name || dbUser.email.split("@")[0],
      role: dbUser.role as Role,
      contractorId: dbUser.contractorId,
      kitchenId: dbUser.kitchenId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Set signed cryptographic session cookie for authenticated user
 */
export async function setSessionUser(user: {
  id: string;
  code?: string | null;
  email: string;
  name?: string | null;
  role: Role;
  contractorId?: string | null;
  kitchenId?: string | null;
}): Promise<void> {
  try {
    let cookieStore;
    try {
      cookieStore = await cookies();
    } catch {
      return;
    }
    const now = Date.now();
    const payload: SessionUser = {
      id: user.id,
      code: user.code || null,
      email: user.email,
      name: user.name || user.email.split("@")[0],
      role: user.role,
      contractorId: user.contractorId || null,
      kitchenId: user.kitchenId || null,
      issuedAt: now,
      expiresAt: now + SESSION_MAX_AGE_MS,
    };

    const signedToken = await signSessionToken(payload);

    const isHttps = process.env.APP_BASE_URL?.startsWith("https://") || process.env.COOKIE_SECURE === "true";
    const useSecureCookie = process.env.NODE_ENV === "production" && isHttps;

    cookieStore.set(SESSION_COOKIE_NAME, signedToken, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    });

    // Clean up legacy session cookie if present
    try {
      cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
    } catch {
      // Ignored if legacy cookie is not present or cannot be deleted
    }
  } catch (err: any) {
    console.error("[setSessionUser error]", err?.message || err);
  }
}

/**
 * Clear session cookie completely on sign out (clearing both primary and legacy cookies)
 */
export async function clearSessionUser(): Promise<void> {
  try {
    const isHttps = process.env.APP_BASE_URL?.startsWith("https://") || process.env.COOKIE_SECURE === "true";
    const useSecureCookie = process.env.NODE_ENV === "production" && isHttps;

    const cookieStore = await cookies();
    const expireOptions = {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    };

    cookieStore.set(SESSION_COOKIE_NAME, "", expireOptions);
    cookieStore.delete(SESSION_COOKIE_NAME);

    cookieStore.set(LEGACY_SESSION_COOKIE_NAME, "", expireOptions);
    cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
  } catch {
    return;
  }
}

/**
 * Authorization guard: Require authenticated user with optional role filtering
 */
export async function requireAuth(allowedRoles?: Role[]): Promise<
  { success: true; user: SessionUser } | { success: false; error: string; statusCode: 401 | 403 }
> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Authentication required", statusCode: 401 };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      success: false,
      error: `Forbidden: role ${user.role} does not have required permissions`,
      statusCode: 403,
    };
  }

  return { success: true, user };
}

/**
 * Authorization guard: Require FOUNDER role
 */
export async function requireFounder(): Promise<
  { success: true; user: SessionUser } | { success: false; error: string; statusCode: 401 | 403 }
> {
  return await requireAuth(["FOUNDER"]);
}

/**
 * Authorization guard: Ensure user has access to a specific kitchen
 */
export async function requireKitchenAccess(kitchenId: string): Promise<
  { success: true; user: SessionUser } | { success: false; error: string; statusCode: 401 | 403 }
> {
  const auth = await requireAuth();
  if (!auth.success) return auth;

  const { user } = auth;

  // FOUNDER has universal platform management privileges
  if (user.role === "FOUNDER") {
    return { success: true, user };
  }

  // Kitchen operator must match the assigned facility
  if (user.kitchenId === kitchenId) {
    return { success: true, user };
  }

  // Contractor manager or admin must match the contractor managing the facility
  if (
    (user.role === "CONTRACTOR_MANAGER" || user.role === "CONTRACTOR_ADMIN") &&
    user.contractorId
  ) {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { contractorId: true },
    });
    if (kitchen && kitchen.contractorId === user.contractorId) {
      return { success: true, user };
    }
  }

  return {
    success: false,
    error: "Forbidden: cross-kitchen access denied",
    statusCode: 403,
  };
}

/**
 * Authorization guard: Ensure user has access to a specific contractor organization
 */
export async function requireContractorAccess(contractorIdOrCode: string): Promise<
  { success: true; user: SessionUser } | { success: false; error: string; statusCode: 401 | 403 }
> {
  const auth = await requireAuth();
  if (!auth.success) return auth;

  const { user } = auth;

  // FOUNDER has universal platform management privileges
  if (user.role === "FOUNDER") {
    return { success: true, user };
  }

  const trimmed = contractorIdOrCode.trim();
  const isCode = isContractorCode(trimmed);

  if (isCode) {
    if (user.contractorId) {
      const contractor = await prisma.contractor.findUnique({
        where: { code: normalizeContractorCode(trimmed)! },
        select: { id: true },
      });
      if (contractor && contractor.id === user.contractorId) {
        return { success: true, user };
      }
    }
  } else {
    // User assigned to this contractor organization
    if (user.contractorId === trimmed) {
      return { success: true, user };
    }
  }

  return {
    success: false,
    error: "Forbidden: cross-contractor access denied",
    statusCode: 403,
  };
}
