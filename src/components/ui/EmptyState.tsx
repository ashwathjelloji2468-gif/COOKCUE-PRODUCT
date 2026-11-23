import React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  steps?: string[];
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <Inbox className="w-10 h-10 text-muted-foreground" />,
  title,
  description,
  steps,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto",
        className
      )}
    >
      <div className="rounded-full bg-accent-soft p-4 text-accent mb-4">
        {icon}
      </div>
      <h3 className="font-heading font-semibold text-foreground text-lg mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {steps && steps.length > 0 && (
        <div className="w-full max-w-sm mb-6 text-left rounded-lg bg-muted/60 border border-border p-3.5 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Recommended Next Steps:
          </span>
          <ol className="text-xs text-foreground space-y-1.5 list-decimal list-inside">
            {steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}
