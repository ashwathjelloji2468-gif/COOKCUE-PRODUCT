/**
 * Determines post-login redirection based strictly on the authenticated database user's role and facility assignments.
 * Wave 2 / T2-A: Role-specific post-login homes.
 *
 * Routing Rules:
 * 1. FOUNDER -> /founder
 * 2. CONTRACTOR_ADMIN / CONTRACTOR_MANAGER -> /contractor/{theirContractorId}
 * 3. HEAD_COOK -> /kitchen/{assignedKitchenId}/morning
 * 4. KITCHEN_STAFF -> /kitchen/{assignedKitchenId}/staff-board
 * 5. If kitchen/contractor missing on user -> safe fallback /login?error=missing_assignment (only founder goes to /founder)
 */
export function getPostLoginRedirect(user: {
  role: string;
  contractorId?: string | null;
  kitchenId?: string | null;
}): string {
  // 1. FOUNDER: always goes to founder platform console
  if (user.role === "FOUNDER") {
    return "/founder";
  }

  // 2. CONTRACTOR_MANAGER / CONTRACTOR_ADMIN: primary home is their contractor organization portal
  if (user.role === "CONTRACTOR_MANAGER" || user.role === "CONTRACTOR_ADMIN") {
    if (user.contractorId) {
      return `/contractor/${user.contractorId}`;
    }
    // Fallback if contractor assigned only via kitchen
    if (user.kitchenId) {
      return `/kitchen/${user.kitchenId}/morning`;
    }
    return "/login?error=missing_assignment";
  }

  // 3. HEAD_COOK: primary home is morning prep & batch approval
  if (user.role === "HEAD_COOK") {
    if (user.kitchenId) {
      return `/kitchen/${user.kitchenId}/morning`;
    }
    if (user.contractorId) {
      return `/contractor/${user.contractorId}`;
    }
    return "/login?error=missing_assignment";
  }

  // 4. KITCHEN_STAFF: primary home is live station staff board
  if (user.role === "KITCHEN_STAFF") {
    if (user.kitchenId) {
      return `/kitchen/${user.kitchenId}/staff-board`;
    }
    if (user.contractorId) {
      return `/contractor/${user.contractorId}`;
    }
    return "/login?error=missing_assignment";
  }

  // Safe fallback default for any unassigned operational account
  return "/login?error=missing_assignment";
}
