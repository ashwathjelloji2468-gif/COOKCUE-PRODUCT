"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";

export type EnvironmentDiagnostics = {
  database: {
    status: "CONNECTED" | "UNAVAILABLE";
    provider: string;
    latencyMs: number | null;
    error: string | null;
  };
  application: {
    nodeEnv: string;
    serverTime: string;
    uptimeSeconds: number;
    nodeVersion: string;
    framework: string;
    sessionSecurity: string;
  };
  notifications: {
    configured: boolean;
    hostName: string | null; // e.g. "smtp.gmail.com" - strictly non-sensitive host only, NO passwords or secrets
    secure: boolean;
  };
  metrics: {
    kitchens: number | null;
    contractors: number | null;
    users: number | null;
    observations: number | null;
    applications: number | null;
  };
};

export async function getEnvironmentDiagnostics(): Promise<
  { success: true; data: EnvironmentDiagnostics } | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  // 1. Database Health Check & Latency
  let dbStatus: "CONNECTED" | "UNAVAILABLE" = "UNAVAILABLE";
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;
  let kitchenCount: number | null = null;
  let contractorCount: number | null = null;
  let userCount: number | null = null;
  let observationCount: number | null = null;
  let applicationCount: number | null = null;

  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - start);
    dbStatus = "CONNECTED";

    // Safe aggregated counts
    const [kCount, cCount, uCount, oCount, aCount] = await Promise.all([
      prisma.kitchen.count(),
      prisma.contractor.count(),
      prisma.user.count(),
      prisma.observation.count(),
      prisma.onboardingApplication.count(),
    ]);

    kitchenCount = kCount;
    contractorCount = cCount;
    userCount = uCount;
    observationCount = oCount;
    applicationCount = aCount;
  } catch (err: any) {
    dbStatus = "UNAVAILABLE";
    dbError = "Database connectivity check failed. Verify PostgreSQL server is running and accessible.";
  }

  // 2. Non-Sensitive SMTP check
  const smtpHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : null;
  const isSmtpConfigured = Boolean(smtpHost && smtpHost.length > 0);

  return {
    success: true,
    data: {
      database: {
        status: dbStatus,
        provider: "PostgreSQL",
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      application: {
        nodeEnv: process.env.NODE_ENV || "development",
        serverTime: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        framework: "Next.js 15.5.28 (App Router)",
        sessionSecurity: "Web Crypto HMAC-SHA256 (fail-closed, httpOnly, sameSite)",
      },
      notifications: {
        configured: isSmtpConfigured,
        hostName: smtpHost,
        secure: process.env.SMTP_SECURE === "true",
      },
      metrics: {
        kitchens: kitchenCount,
        contractors: contractorCount,
        users: userCount,
        observations: observationCount,
        applications: applicationCount,
      },
    },
  };
}
