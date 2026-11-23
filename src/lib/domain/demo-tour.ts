export type TourStep = {
  id: number;
  title: string;
  badge: string;
  coach: string;
  getPath: (kitchenId?: string) => string;
};

export const DEMO_TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "Platform Operations Overview",
    badge: "Founder Home",
    coach:
      "Monitor multi-tenant telemetry, live active kitchens, qualifying baseline observations, and service incidents across catering organizations.",
    getPath: () => "/founder",
  },
  {
    id: 2,
    title: "Contractor Organizations",
    badge: "Contractors",
    coach:
      "Review partner institutional caterers, inspect human-readable CTR codes, manage kitchen allocations, and track contractor status.",
    getPath: () => "/founder/contractors",
  },
  {
    id: 3,
    title: "Morning Cooking Plan",
    badge: "Morning Plan",
    coach:
      "Experience morning setup: apply reusable service templates, compute baseline production recommendations, and sign with single Head Cook approval.",
    getPath: (kitchenId) => `/kitchen/${kitchenId || "seed-kitchen-1"}/morning`,
  },
  {
    id: 4,
    title: "Operational Staff Board",
    badge: "Staff Board",
    coach:
      "Station view for kitchen personnel: view official approved batch targets, head cook instructions, assigned personnel, and task reports.",
    getPath: (kitchenId) => `/kitchen/${kitchenId || "seed-kitchen-1"}/staff-board`,
  },
  {
    id: 5,
    title: "Evening Closeout",
    badge: "Evening Closeout",
    coach:
      "Rapid evening logging: use 'As planned', 'Ran out', or 'Prefill from last service' to record actuals and unserved leftovers without manual typing.",
    getPath: (kitchenId) => `/kitchen/${kitchenId || "seed-kitchen-1"}/closeout`,
  },
  {
    id: 6,
    title: "Telemetry & Data Hygiene",
    badge: "Platform Monitoring",
    coach:
      "Inspect closed-loop learning health: verify eligible versus excluded observations, anomaly flags, and multi-day baseline readiness per facility.",
    getPath: () => "/founder/monitoring",
  },
];
