import React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  backAction,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-border/70",
        className
      )}
    >
      <div className="space-y-1">
        {backAction && <div className="mb-2">{backAction}</div>}
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
}
