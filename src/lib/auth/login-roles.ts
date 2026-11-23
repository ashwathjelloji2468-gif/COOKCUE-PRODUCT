import React from "react";
import { Building2, ChefHat, Users, ShieldCheck } from "lucide-react";

export type RoleOption = "FOUNDER" | "CONTRACTOR_MANAGER" | "HEAD_COOK" | "KITCHEN_STAFF";

export interface RoleMetadata {
  id: RoleOption;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeLabel: string;
  emailPlaceholder: string;
  onboardAction?: {
    label: string;
    description: string;
    href: string;
  };
}

// Visible role cards shown on the public role chooser (Founder card hidden from public view)
export const PUBLIC_ROLES: RoleMetadata[] = [
  {
    id: "CONTRACTOR_MANAGER",
    title: "Contractor Manager",
    subtitle: "Catering Organization Admin",
    description: "Oversee multi-kitchen contracts, facility performance, roster management, and contractor portal telemetry.",
    icon: Building2,
    accentColor: "text-amber-500",
    badgeLabel: "Contractor Manager",
    emailPlaceholder: "manager@catering.com",
    onboardAction: {
      label: "Register New Contractor",
      description: "Apply for a new institutional catering organization account",
      href: "/onboard?type=contractor",
    },
  },
  {
    id: "HEAD_COOK",
    title: "Head Cook",
    subtitle: "Chef Station & Recipe Operations",
    description: "Daily morning batch planning, single-signature plan approvals, recipe adjustments, and evening closeout logging.",
    icon: ChefHat,
    accentColor: "text-[#D9EF79]",
    badgeLabel: "Head Cook",
    emailPlaceholder: "headcook@kitchen.com",
    onboardAction: {
      label: "Apply as Head Cook",
      description: "Request lead cook credentials for an assigned kitchen",
      href: "/onboard?type=head_cook",
    },
  },
  {
    id: "KITCHEN_STAFF",
    title: "Head Kitchen Staff",
    subtitle: "Production & Floor Operations",
    description: "Diner count verification, batch cooked weight logging, leftover tracking, and stockout incident reporting.",
    icon: Users,
    accentColor: "text-sky-400",
    badgeLabel: "Kitchen Staff",
    emailPlaceholder: "staff@kitchen.com",
    onboardAction: {
      label: "Apply as Kitchen Staff",
      description: "Request staff credentials for your facility team",
      href: "/onboard?type=staff",
    },
  },
];

// Direct sign-in metadata for universal credentials
export const DIRECT_SIGN_IN_META: RoleMetadata = {
  id: "FOUNDER",
  title: "Direct Sign In",
  subtitle: "Universal Platform Credentials",
  description: "Sign in with authorized universal platform credentials.",
  icon: ShieldCheck,
  accentColor: "text-emerald-500",
  badgeLabel: "Universal Access",
  emailPlaceholder: "cookcue149@gmail.com",
};

export const ALL_ROLES: RoleMetadata[] = [...PUBLIC_ROLES, DIRECT_SIGN_IN_META];
