import React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Check,
  Edit3,
  Power,
  PowerOff,
} from "lucide-react";

export type StatusType =
  | "eligible"
  | "stockout"
  | "abnormal"
  | "missing"
  | "approved"
  | "overridden"
  | "active"
  | "inactive";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  {
    defaultLabel: string;
    icon: React.ReactNode;
    classes: string;
  }
> = {
  eligible: {
    defaultLabel: "Eligible",
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-success" />,
    classes: "bg-success-soft text-success border-success/30 font-semibold",
  },
  stockout: {
    defaultLabel: "Stockout",
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-destructive" />,
    classes: "bg-destructive-soft text-destructive border-destructive/30 font-medium",
  },
  abnormal: {
    defaultLabel: "Abnormal",
    icon: <AlertCircle className="w-3.5 h-3.5 shrink-0 text-warning" />,
    classes: "bg-warning-soft text-warning border-warning/30 font-medium",
  },
  missing: {
    defaultLabel: "Missing Data",
    icon: <HelpCircle className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />,
    classes: "bg-muted text-muted-foreground border-border font-normal",
  },
  approved: {
    defaultLabel: "Approved",
    icon: <Check className="w-3.5 h-3.5 shrink-0 text-success" />,
    classes: "bg-success-soft text-success border-success/40 font-semibold",
  },
  overridden: {
    defaultLabel: "Adjusted",
    icon: <Edit3 className="w-3.5 h-3.5 shrink-0 text-blue-700 dark:text-blue-300" />,
    classes: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold",
  },
  active: {
    defaultLabel: "Active",
    icon: <Power className="w-3.5 h-3.5 shrink-0 text-success" />,
    classes: "bg-success-soft text-success border-success/30 font-semibold",
  },
  inactive: {
    defaultLabel: "Inactive",
    icon: <PowerOff className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />,
    classes: "bg-muted text-muted-foreground border-border font-normal",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] tracking-tight transition-colors shadow-2xs",
        config.classes,
        className
      )}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}
