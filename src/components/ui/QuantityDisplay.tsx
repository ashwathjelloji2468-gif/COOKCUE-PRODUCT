import React from "react";
import { cn } from "@/lib/utils";

interface QuantityDisplayProps {
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showUnit?: boolean;
}

export function QuantityDisplay({
  value,
  unit = "kg",
  decimals = 2,
  fallback = "—",
  size = "md",
  className,
  showUnit = true,
}: QuantityDisplayProps) {
  if (value === null || value === undefined || isNaN(value)) {
    return (
      <span className={cn("text-muted-foreground tabular-nums", className)}>
        {fallback}
      </span>
    );
  }

  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg font-semibold",
    xl: "text-2xl sm:text-3xl font-bold font-heading",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-heading cc-num tabular-nums text-foreground",
        sizeClasses,
        className
      )}
    >
      <span>{formatted}</span>
      {showUnit && (
        <span className="text-xs font-sans font-normal text-muted-foreground">
          {unit}
        </span>
      )}
    </span>
  );
}
