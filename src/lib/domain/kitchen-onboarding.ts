/**
 * Domain types and pure logic for the New Kitchen Onboarding Wizard.
 * Real operational milestones only; zero fake completions or automatic plan modifications.
 */

import { isObservationEligible } from "./scorecard";

export type KitchenOnboardingStepId =
  | "ADD_DISHES"
  | "SAVE_TEMPLATE"
  | "APPROVE_PLAN"
  | "SUBMIT_CLOSEOUT"
  | "BUILD_BASELINE";

export type KitchenOnboardingStep = {
  id: KitchenOnboardingStepId;
  label: string;
  description: string;
  done: boolean;
  href: string;
  actionText: string;
  detail?: string;
  count?: number;
};

export type KitchenOnboardingProgress = {
  kitchenId: string;
  kitchenName: string;
  steps: KitchenOnboardingStep[];
  completedCount: number;
  total: number;
  isComplete: boolean;
  eligibleCount: number;
  neededEligibleCount: number;
  primaryCta: {
    label: string;
    href: string;
    stepId: KitchenOnboardingStepId;
  } | null;
};

export type RawKitchenOnboardingData = {
  kitchenId: string;
  kitchenName: string;
  dishesCount: number;
  templatesCount: number;
  approvedPlansCount: number;
  closeoutObservationsCount: number;
  eligibleObservationsCount: number;
};

/**
 * Derives the onboarding step checklist from real database counts.
 * Step 1: Add dishes — done if >= 1 dish registered.
 * Step 2: Save a service template — done if >= 1 template exists.
 * Step 3: Approve a morning plan — done if >= 1 APPROVED plan ever.
 * Step 4: Submit a closeout — done if >= 1 closeout with observations.
 * Step 5: Build baseline — done if eligible observations >= 3; else "Need N more eligible services".
 */
export function deriveKitchenOnboardingProgress(
  data: RawKitchenOnboardingData
): KitchenOnboardingProgress {
  const {
    kitchenId,
    kitchenName,
    dishesCount,
    templatesCount,
    approvedPlansCount,
    closeoutObservationsCount,
    eligibleObservationsCount,
  } = data;

  const step1Done = dishesCount >= 1;
  const step2Done = templatesCount >= 1;
  const step3Done = approvedPlansCount >= 1;
  const step4Done = closeoutObservationsCount >= 1;
  const step5Done = eligibleObservationsCount >= 3;

  const neededEligibleCount = Math.max(0, 3 - eligibleObservationsCount);

  const steps: KitchenOnboardingStep[] = [
    {
      id: "ADD_DISHES",
      label: "Add menu dishes",
      description: "Register recipe items in your kitchen catalog with default batch units.",
      done: step1Done,
      href: `/kitchen/${kitchenId}/dishes`,
      actionText: "Manage Dishes",
      detail: step1Done
        ? `${dishesCount} ${dishesCount === 1 ? "dish" : "dishes"} registered`
        : "No dishes registered yet",
      count: dishesCount,
    },
    {
      id: "SAVE_TEMPLATE",
      label: "Save a service template",
      description: "Create a recurring dish lineup for faster single-tap morning plan setup.",
      done: step2Done,
      href: `/kitchen/${kitchenId}/morning`,
      actionText: "Create Template",
      detail: step2Done
        ? `${templatesCount} ${templatesCount === 1 ? "template" : "templates"} saved`
        : "No template saved yet",
      count: templatesCount,
    },
    {
      id: "APPROVE_PLAN",
      label: "Approve a morning plan",
      description: "Head Cook reviews portion baselines and authorizes today's production quantities.",
      done: step3Done,
      href: `/kitchen/${kitchenId}/morning`,
      actionText: "Open Morning Plan",
      detail: step3Done
        ? `${approvedPlansCount} approved ${approvedPlansCount === 1 ? "plan" : "plans"} on record`
        : "No approved plan yet",
      count: approvedPlansCount,
    },
    {
      id: "SUBMIT_CLOSEOUT",
      label: "Submit first meal closeout",
      description: "Record actual cooked kg, unserved leftovers, and actual diners after service.",
      done: step4Done,
      href: `/kitchen/${kitchenId}/closeout`,
      actionText: "Open Closeout",
      detail: step4Done
        ? `${closeoutObservationsCount} observation ${closeoutObservationsCount === 1 ? "entry" : "entries"} logged`
        : "No closeout submitted yet",
      count: closeoutObservationsCount,
    },
    {
      id: "BUILD_BASELINE",
      label: "Build verified baseline intelligence",
      description: "Accumulate at least 3 clean services to activate automatic baseline portion suggestions.",
      done: step5Done,
      href: `/kitchen/${kitchenId}/forecast`,
      actionText: "View Baseline",
      detail: step5Done
        ? `${eligibleObservationsCount} eligible services logged (baseline active)`
        : `Need ${neededEligibleCount} more eligible ${neededEligibleCount === 1 ? "service" : "services"}`,
      count: eligibleObservationsCount,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const isComplete = completedCount === total;

  // Primary CTA is the first incomplete step
  const firstIncomplete = steps.find((s) => !s.done);
  const primaryCta = firstIncomplete
    ? {
        label: `Next: ${firstIncomplete.label}`,
        href: firstIncomplete.href,
        stepId: firstIncomplete.id,
      }
    : null;

  return {
    kitchenId,
    kitchenName,
    steps,
    completedCount,
    total,
    isComplete,
    eligibleCount: eligibleObservationsCount,
    neededEligibleCount,
    primaryCta,
  };
}
