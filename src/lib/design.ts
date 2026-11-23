/**
 * CookCue Design Tokens & Creative Constants
 * Premium Food-Tech SaaS Design System
 */

export const palette = {
  bone: "#F7F5EF",
  evergreen: "#193D32",
  evergreenLight: "#235345",
  evergreenDark: "#102821",
  citrus: "#D9EF79",
  citrusMuted: "#E9F6B5",
  terracotta: "#E47E63",
  terracottaLight: "#FDEAE5",
  ink: "#252C28",
  inkMuted: "#6B756E",
  border: "#E2DFD4",
  borderLight: "#ECE9DF",
  card: "#FFFFFF",
  cardWarm: "#FCFAF6",
} as const;

export const brand = {
  name: "CookCue",
  tagline: "The right amount. At the right time.",
  secondaryTagline: "Intelligence in every meal",
  versionBadge: "Production Ready · v1.0",
} as const;

export const ui = {
  focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#193D32] focus-visible:ring-offset-2",
  cardBase: "rounded-xl border border-[#E2DFD4] bg-white shadow-[0_1px_3px_rgba(25,61,50,0.05)]",
  editorialEyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#193D32]/80",
} as const;
