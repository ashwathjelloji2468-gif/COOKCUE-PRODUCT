"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";

export type AuditDiffItem = {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};

export type AuditSnapshotItem = {
  field: string;
  value: string | number | boolean | null;
};

export type AuditActor = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export type AuditEvent = {
  id: string;
  timestamp: string; // ISO date string
  eventType:
    | "SERVICE_CLOSEOUT"
    | "OBSERVATION_ADJUSTMENT"
    | "PLAN_OVERRIDE"
    | "COOKING_PLAN_STATUS"
    | "ONBOARDING_APPLICATION"
    | "CONTRACTOR_STATUS";
  category: "Closeout" | "Adjustment" | "Planning" | "Onboarding" | "Governance";
  title: string;
  summary: string;
  kitchenName?: string | null;
  contractorName?: string | null;
  severity: "normal" | "warning" | "danger" | "success";
  actor?: AuditActor | null;
  diff?: AuditDiffItem[] | null;
  snapshot?: AuditSnapshotItem[] | null;
  reason?: string | null;
};

export async function getPlatformAuditEvents(limit: number = 200): Promise<
  { success: true; data: AuditEvent[] } | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const [observations, observationAudits, planOverrides, cookingPlans, applications, contractors] =
      await Promise.all([
        // 1. Service closeout observations (Snapshot point-in-time)
        prisma.observation.findMany({
          take: 100,
          orderBy: { createdAt: "desc" },
          include: {
            kitchen: { select: { name: true } },
            dish: { select: { name: true } },
            meal: { select: { date: true, mealType: true } },
          },
        }),

        // 2. Observation audit adjustments (Before / After Diff)
        prisma.observationAudit.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            observation: {
              include: {
                kitchen: { select: { name: true } },
                dish: { select: { name: true } },
                meal: { select: { date: true, mealType: true } },
              },
            },
          },
        }),

        // 3. Plan recommendation overrides (Before / After Diff)
        prisma.planOverrideAudit.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            planItem: {
              include: {
                dish: { select: { name: true } },
                plan: {
                  include: {
                    kitchen: { select: { name: true } },
                    meal: { select: { date: true, mealType: true } },
                  },
                },
              },
            },
          },
        }),

        // 4. Cooking plan milestones (Snapshot point-in-time)
        prisma.cookingPlan.findMany({
          take: 50,
          orderBy: { updatedAt: "desc" },
          include: {
            kitchen: { select: { name: true } },
            meal: { select: { date: true, mealType: true } },
            firstApprover: { select: { id: true, name: true, email: true, role: true } },
            secondApprover: { select: { id: true, name: true, email: true, role: true } },
          },
        }),

        // 5. Onboarding applications and founder reviews (Snapshot point-in-time)
        prisma.onboardingApplication.findMany({
          take: 50,
          orderBy: { updatedAt: "desc" },
        }),

        // 6. Contractor organization provisioning (Snapshot point-in-time)
        prisma.contractor.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // Batch query all referenced actors across audits and applications
    const actorUserIds = Array.from(
      new Set(
        [
          ...observationAudits.map((a) => a.changedByUserId),
          ...planOverrides.map((o) => o.approvedByUserId),
          ...applications.map((app) => app.reviewedByUserId),
        ].filter((id): id is string => Boolean(id))
      )
    );

    const actorUsers =
      actorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorUserIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
    const actorMap = new Map<string, AuditActor>(
      actorUsers.map((u) => [u.id, { id: u.id, name: u.name, email: u.email, role: u.role }])
    );

    const events: AuditEvent[] = [];

    // Map Plan Overrides (Feeds Before/After Diff)
    for (const ovr of planOverrides) {
      const dishName = ovr.planItem.dish.name;
      const kitchenName = ovr.planItem.plan.kitchen.name;
      const mealType = ovr.planItem.plan.meal.mealType;
      const actor = ovr.approvedByUserId ? actorMap.get(ovr.approvedByUserId) || { id: ovr.approvedByUserId, name: "Operator", email: null, role: "HEAD_COOK" } : null;

      const diff: AuditDiffItem[] = [];
      if (ovr.previousApprovedKg !== null || ovr.newApprovedKg !== null) {
        diff.push({
          field: "Approved Target Quantity",
          before: ovr.previousApprovedKg !== null ? `${ovr.previousApprovedKg} kg` : "None (Unapproved)",
          after: ovr.newApprovedKg !== null ? `${ovr.newApprovedKg} kg` : "None (Unapproved)",
        });
      }

      const snapshot: AuditSnapshotItem[] = [];
      if (ovr.recommendedKg !== null) {
        snapshot.push({
          field: "Baseline Recommendation (Pure Engine)",
          value: `${ovr.recommendedKg} kg`,
        });
      }

      events.push({
        id: `plan-override-${ovr.id}`,
        timestamp: ovr.createdAt.toISOString(),
        eventType: "PLAN_OVERRIDE",
        category: "Planning",
        title: `Recommendation Override: ${dishName}`,
        summary: `Production target modified for ${mealType} — Baseline: ${ovr.recommendedKg?.toFixed(1) ?? "0"}kg -> Approved: ${ovr.newApprovedKg?.toFixed(1) ?? "0"}kg.`,
        kitchenName,
        severity: "warning",
        actor,
        reason: ovr.reason || "Chef Operational Adjustment",
        diff,
        snapshot: snapshot.length > 0 ? snapshot : null,
      });
    }

    // Map Observation Audits (Feeds Before/After Diff)
    for (const audit of observationAudits) {
      const actor = audit.changedByUserId ? actorMap.get(audit.changedByUserId) || { id: audit.changedByUserId, name: "Operator", email: null, role: "HEAD_COOK" } : null;

      const diff: AuditDiffItem[] = [];

      if (audit.previousCookedKg !== null || audit.newCookedKg !== null) {
        diff.push({
          field: "Total Cooked Quantity",
          before: audit.previousCookedKg !== null ? `${audit.previousCookedKg} kg` : "Not recorded",
          after: audit.newCookedKg !== null ? `${audit.newCookedKg} kg` : "Not recorded",
        });
      }

      if (audit.previousLeftoverKg !== null || audit.newLeftoverKg !== null) {
        diff.push({
          field: "Unserved Leftover Quantity",
          before: audit.previousLeftoverKg !== null ? `${audit.previousLeftoverKg} kg` : "Not recorded",
          after: audit.newLeftoverKg !== null ? `${audit.newLeftoverKg} kg` : "Not recorded",
        });
      }

      if (audit.previousActualDiners !== null || audit.newActualDiners !== null) {
        diff.push({
          field: "Actual Diner Count",
          before: audit.previousActualDiners !== null ? `${audit.previousActualDiners} diners` : "Not recorded",
          after: audit.newActualDiners !== null ? `${audit.newActualDiners} diners` : "Not recorded",
        });
      }

      if (audit.previousStockout !== null || audit.newStockout !== null) {
        diff.push({
          field: "Stockout Incident",
          before: audit.previousStockout ? "Yes (Stockout Occurred)" : "No (Adequate Supply)",
          after: audit.newStockout ? "Yes (Stockout Occurred)" : "No (Adequate Supply)",
        });
      }

      if (audit.previousAbnormal !== null || audit.newAbnormal !== null) {
        diff.push({
          field: "Abnormal Attendance",
          before: audit.previousAbnormal ? "Yes (Abnormal Attendance)" : "No (Normal Attendance)",
          after: audit.newAbnormal ? "Yes (Abnormal Attendance)" : "No (Normal Attendance)",
        });
      }

      if (audit.previousExcluded !== null || audit.newExcluded !== null) {
        diff.push({
          field: "Engine Exclusion Status",
          before: audit.previousExcluded ? "Excluded from Baseline Calc" : "Eligible for Baseline Calc",
          after: audit.newExcluded ? "Excluded from Baseline Calc" : "Eligible for Baseline Calc",
        });
      }

      if (audit.previousExclusionReason || audit.newExclusionReason) {
        diff.push({
          field: "Exclusion Reason",
          before: audit.previousExclusionReason || "None",
          after: audit.newExclusionReason || "None",
        });
      }

      events.push({
        id: `obs-audit-${audit.id}`,
        timestamp: audit.createdAt.toISOString(),
        eventType: "OBSERVATION_ADJUSTMENT",
        category: "Adjustment",
        title: `Service Record Adjusted: ${audit.observation.dish.name}`,
        summary: `Closeout modified by operator. Reason: "${audit.reason}".`,
        kitchenName: audit.observation.kitchen.name,
        severity: "warning",
        actor,
        reason: audit.reason,
        diff,
        snapshot: null,
      });
    }

    // Map Observations (Single Point-in-Time Closeout Snapshot — NO fake "before" value)
    for (const obs of observations) {
      const mealDate = obs.meal.date.toISOString().slice(0, 10);
      let severity: AuditEvent["severity"] = "normal";
      if (obs.isStockout) severity = "warning";
      if (obs.isAbnormal) severity = "danger";

      const flags: string[] = [];
      if (obs.isStockout) flags.push("Stockout Incident");
      if (obs.isAbnormal) flags.push("Abnormal Attendance");
      if (obs.isExcluded) flags.push("Excluded");

      const flagText = flags.length > 0 ? ` [${flags.join(", ")}]` : "";

      const cooked = obs.totalCookedKg ?? 0;
      const leftovers = obs.unservedLeftoverKg ?? 0;
      const served = cooked - leftovers;

      const snapshot: AuditSnapshotItem[] = [
        { field: "Total Cooked", value: `${cooked} kg` },
        { field: "Unserved Leftovers", value: `${leftovers} kg` },
        { field: "Estimated Served", value: `${served >= 0 ? served.toFixed(2) : 0} kg` },
        { field: "Actual Diners", value: obs.actualDiners !== null ? `${obs.actualDiners}` : "Not recorded" },
        { field: "Stockout Flag", value: obs.isStockout ? "Yes (Depleted early)" : "No" },
        { field: "Abnormal Flag", value: obs.isAbnormal ? "Yes (Irregular demand)" : "No" },
        {
          field: "Baseline Calculation Status",
          value: obs.isExcluded ? `Excluded (${obs.exclusionReason || "Operator outlier"})` : "Eligible for baseline calculations",
        },
      ];

      events.push({
        id: `obs-${obs.id}`,
        timestamp: obs.createdAt.toISOString(),
        eventType: "SERVICE_CLOSEOUT",
        category: "Closeout",
        title: `Service Closeout: ${obs.dish.name}`,
        summary: `${obs.dish.name} logged for ${obs.meal.mealType} on ${mealDate} — ${cooked}kg cooked, ${leftovers}kg unserved leftover (${obs.actualDiners ?? 0} diners)${flagText}`,
        kitchenName: obs.kitchen.name,
        severity,
        actor: null,
        diff: null,
        snapshot,
      });
    }

    // Map Cooking Plans (Milestones Snapshot)
    for (const plan of cookingPlans) {
      const isApproved = plan.status === "APPROVED";

      const snapshot: AuditSnapshotItem[] = [
        { field: "Meal Service", value: plan.meal.mealType },
        { field: "Expected Diners", value: `${plan.expectedDiners}` },
        { field: "Approval Status", value: plan.status },
      ];

      if (plan.firstApprover) {
        snapshot.push({
          field: "1st Approver",
          value: `${plan.firstApprover.name || plan.firstApprover.email} (${plan.firstApprover.role})`,
        });
      }
      if (plan.secondApprover) {
        snapshot.push({
          field: "2nd Approver",
          value: `${plan.secondApprover.name || plan.secondApprover.email} (${plan.secondApprover.role})`,
        });
      }

      events.push({
        id: `plan-${plan.id}`,
        timestamp: plan.updatedAt.toISOString(),
        eventType: "COOKING_PLAN_STATUS",
        category: "Planning",
        title: `Cooking Plan ${plan.status}`,
        summary: `Plan updated to ${plan.status} for ${plan.meal.mealType} (${plan.expectedDiners} expected diners).`,
        kitchenName: plan.kitchen.name,
        severity: isApproved ? "success" : "normal",
        diff: null,
        snapshot,
      });
    }

    // Map Onboarding Applications (Snapshot)
    for (const app of applications) {
      let severity: AuditEvent["severity"] = "normal";
      if (app.status === "APPROVED" || app.status === "ACTIVE") severity = "success";
      if (app.status === "REJECTED") severity = "danger";

      const date = app.reviewedAt ? app.reviewedAt.toISOString() : app.updatedAt.toISOString();
      const orgOrName = app.contractorName || app.applicantName || app.applicantEmail;
      const reviewer = app.reviewedByUserId ? actorMap.get(app.reviewedByUserId) : null;

      const snapshot: AuditSnapshotItem[] = [
        { field: "Applicant Name", value: app.applicantName },
        { field: "Applicant Email", value: app.applicantEmail },
        { field: "Application Type", value: app.type },
        { field: "Status", value: app.status },
      ];

      if (app.contractorName) snapshot.push({ field: "Contractor Org", value: app.contractorName });
      if (app.kitchenName) snapshot.push({ field: "Kitchen Facility", value: app.kitchenName });
      if (app.rejectionReason) snapshot.push({ field: "Rejection Reason", value: app.rejectionReason });

      events.push({
        id: `app-${app.id}`,
        timestamp: date,
        eventType: "ONBOARDING_APPLICATION",
        category: "Onboarding",
        title: `${app.type.replace(/_/g, " ")} Application: ${app.status}`,
        summary: `Institutional application for ${orgOrName} (${app.type}) updated to ${app.status}${app.reviewedByUserId ? " (Founder reviewed)" : ""}`,
        contractorName: app.contractorName || null,
        kitchenName: app.kitchenName || null,
        severity,
        actor: reviewer,
        diff: null,
        snapshot,
      });
    }

    // Map Contractors (Governance Snapshot)
    for (const c of contractors) {
      events.push({
        id: `contractor-${c.id}`,
        timestamp: c.createdAt.toISOString(),
        eventType: "CONTRACTOR_STATUS",
        category: "Governance",
        title: `Contractor Registered: ${c.name}`,
        summary: `Catering organization ${c.name} registered with platform status ${c.status}`,
        contractorName: c.name,
        severity: c.status === "ACTIVE" ? "success" : "normal",
        diff: null,
        snapshot: [
          { field: "Contractor Organization", value: c.name },
          { field: "Registration Status", value: c.status },
        ],
      });
    }

    // Chronological order: newest first
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      data: events.slice(0, limit),
    };
  } catch (e) {
    return { success: false, error: "Failed to load audit events from database" };
  }
}
