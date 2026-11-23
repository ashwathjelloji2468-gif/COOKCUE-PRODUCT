"use server";

import { prisma } from "@/lib/prisma";
import { setSessionUser, clearSessionUser, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { generateNextUserCode } from "./user-code";
import type { Role } from "@/lib/domain/types";
import { redirect } from "next/navigation";

export async function getCurrentUser(): Promise<SessionUser | null> {
  return await getSessionUser();
}

/**
 * Real credential verification for all users
 */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ success: true; user: SessionUser } | { success: false; error: string }> {
  if (!email || !email.includes("@") || !password) {
    return { success: false, error: "Valid email and password required" };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
      return { success: false, error: "Invalid credentials" };
    }

    const isValid =
      verifyPassword(password, user.passwordHash) ||
      verifyPassword(password.trim(), user.passwordHash);

    if (!isValid) {
      return { success: false, error: "Invalid credentials" };
    }

    const session: SessionUser = {
      id: user.id,
      code: user.code || null,
      email: user.email,
      name: user.name || user.email.split("@")[0],
      role: user.role as Role,
      kitchenId: user.kitchenId,
      contractorId: user.contractorId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };

    await setSessionUser(session);
    return { success: true, user: session };
  } catch (err: any) {
    console.error("[signInWithCredentials caught error]:", err);
    if (err?.name === "PrismaClientInitializationError" || err?.message?.includes("Can't reach database server")) {
      return { success: false, error: "Database unreachable. Please ensure PostgreSQL is running." };
    }
    return { success: false, error: "Authentication failed" };
  }
}

/**
 * Register a new kitchen operator (Strict Guard: Founder role can never be self-assigned)
 */
export async function registerOperator(
  email: string,
  password: string,
  name: string,
  kitchenId: string
): Promise<{ success: true; user: SessionUser } | { success: false; error: string }> {
  if (!email || !password || password.length < 8) {
    return { success: false, error: "Email and password (min 8 characters) required" };
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  const kitchen = await prisma.kitchen.findUnique({ where: { id: kitchenId } });
  if (!kitchen) {
    return { success: false, error: "Invalid kitchen identifier" };
  }

  const passwordHash = hashPassword(password);
  const userCode = await generateNextUserCode();

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      role: "HEAD_COOK", // Never assign FOUNDER through registration
      status: "ACTIVE",
      kitchenId,
      contractorId: kitchen.contractorId,
      code: userCode,
    },
  });

  const session: SessionUser = {
    id: user.id,
    code: user.code || null,
    email: user.email,
    name: user.name || user.email.split("@")[0],
    role: "HEAD_COOK",
    kitchenId: user.kitchenId,
    contractorId: user.contractorId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };

  await setSessionUser(session);
  return { success: true, user: session };
}

/**
 * Development-only authenticated seed account helper.
 * Completely disabled in production.
 */
export async function devDemoLogin(preset: "founder" | "head_cook" | "staff"): Promise<
  { success: true; user: SessionUser } | { success: false; error: string }
> {
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "Demo logins are strictly disabled in production" };
  }

  try {
    let email: string;
    let name: string;
    let role: Role;
    let kitchenId: string | null = null;
    let contractorId: string | null = null;
    const defaultPassword = "DevPassword@123";

    let passwordToHash = defaultPassword;

    if (preset === "founder") {
      email = "cookcue149@gmail.com";
      name = "Platform Founder";
      role = "FOUNDER";
      passwordToHash = "Aisha@Ashwath";
    } else if (preset === "head_cook") {
      email = "headcook@central-kitchen-a.com";
      name = "Chef Rajesh";
      role = "HEAD_COOK";
      kitchenId = "seed-kitchen-1";
      contractorId = "seed-contractor-1";
    } else {
      email = "staff@hostel-kitchen-b.com";
      name = "Staff Member";
      role = "KITCHEN_STAFF";
      kitchenId = "seed-kitchen-2";
      contractorId = "seed-contractor-1";
    }

    const passwordHash = hashPassword(passwordToHash);
    const existing = await prisma.user.findUnique({ where: { email } });
    const userCode = existing?.code || (await generateNextUserCode());

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role, kitchenId, contractorId, status: "ACTIVE", passwordHash, code: userCode },
      create: { email, name, role, kitchenId, contractorId, status: "ACTIVE", passwordHash, code: userCode },
    });

    const session: SessionUser = {
      id: user.id,
      code: user.code || null,
      email: user.email,
      name: user.name || user.email.split("@")[0],
      role: user.role as Role,
      kitchenId: user.kitchenId,
      contractorId: user.contractorId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };

    await setSessionUser(session);
    return { success: true, user: session };
  } catch (e) {
    return { success: false, error: "Failed to authenticate demo account" };
  }
}

export async function logout(): Promise<{ success: true }> {
  await clearSessionUser();
  redirect("/login");
}
