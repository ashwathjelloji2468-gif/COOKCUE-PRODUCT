export type CookingPlanStatus = "DRAFT" | "APPROVED" | "PENDING_SECOND_APPROVAL";

export type CookingPlanDetail = {
  id: string;
  kitchenId: string;
  mealId: string;
  expectedDiners: number;
  status: CookingPlanStatus;
  approvalStatus: CookingPlanStatus;
  approverId?: string | null;
  approvedAt?: Date | null;
  approver?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  firstApproverId: string | null;
  firstApprovedAt: Date | null;
  firstApprover: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  secondApproverId: string | null;
  secondApprovedAt: Date | null;
  secondApprover: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  items: {
    id: string;
    dishId: string;
    dishName: string;
    recommendedKg: number | null;
    approvedKg: number | null;
    snapshotBasisJson: string | null;
    allergenTags?: string[];
    menuCycleLabel?: string | null;
  }[];
  currentUserId: string;
  currentUserRole: string;
  canApprove: boolean;
};

// Approval Policy: Only HEAD_COOK (and FOUNDER override) can approve cooking plans.
export const PLAN_APPROVER_ROLES = ["HEAD_COOK", "FOUNDER"];
