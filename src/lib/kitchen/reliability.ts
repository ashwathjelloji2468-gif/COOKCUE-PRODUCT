/**
 * Kitchen Reliability & Data Freshness Signals Utility
 *
 * Rules:
 * - Real timestamps/counts only; no fake SLAs or guaranteed uptime claims.
 * - Does not change recommendation math or operational rules.
 * - Stale heuristic: Amber indicator if a plan was approved >= 48 hours ago
 *   and either no closeout exists or the latest closeout was prior to that plan.
 * - Baseline ready: >= 3 eligible observations for kitchen overall.
 */

export const BASELINE_ELIGIBLE_THRESHOLD = 3;

/**
 * Formats a date into a clean relative time string ("Just now", "25m ago", "2h ago", "Yesterday", "3d ago").
 */
export function formatRelativeTime(
  date: string | Date | null | undefined,
  fallback = "None yet"
): string {
  if (!date) return fallback;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return fallback;

  const now = Date.now();
  const diffMs = now - d.getTime();

  // If in the future or within 60s
  if (diffMs < 60 * 1000) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Format e.g. "Nov 14"
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a date into an exact, localized ISO/time string suitable for hover tooltips.
 */
export function formatExactDateTime(
  date: string | Date | null | undefined
): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Evaluates whether closeout is stale.
 * Documented rule:
 * Stale (amber) if a cooking plan was approved >= 48 hours (2+ days) ago
 * and either no closeout has been logged or the last closeout was before that approval.
 */
export function isCloseoutStale(
  lastCloseoutAt: string | Date | null | undefined,
  lastPlanApprovedAt: string | Date | null | undefined,
  now = new Date()
): boolean {
  if (!lastPlanApprovedAt) return false;

  const planDate = typeof lastPlanApprovedAt === "string"
    ? new Date(lastPlanApprovedAt).getTime()
    : lastPlanApprovedAt.getTime();

  if (isNaN(planDate)) return false;

  const currentTime = now.getTime();
  const twoDaysMs = 48 * 60 * 60 * 1000;

  // Has it been >= 48 hours since the plan was approved?
  if (currentTime - planDate < twoDaysMs) {
    return false;
  }

  // If no closeout ever recorded: stale!
  if (!lastCloseoutAt) {
    return true;
  }

  const closeoutDate = typeof lastCloseoutAt === "string"
    ? new Date(lastCloseoutAt).getTime()
    : lastCloseoutAt.getTime();

  if (isNaN(closeoutDate)) {
    return true;
  }

  // If the last closeout occurred before the plan approval or is also >= 48 hours old
  if (closeoutDate < planDate && currentTime - closeoutDate >= twoDaysMs) {
    return true;
  }

  return false;
}

/**
 * Checks if kitchen has reached the baseline eligible threshold (>= 3).
 */
export function isBaselineReady(eligibleObservationCount: number): boolean {
  return eligibleObservationCount >= BASELINE_ELIGIBLE_THRESHOLD;
}
