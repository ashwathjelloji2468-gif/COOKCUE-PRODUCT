import React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  children,
  footer,
  headerAction,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border bg-card shadow-xs", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground">
              {description}
            </CardDescription>
          )}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
      {footer && (
        <CardFooter className="border-t border-border/60 bg-muted/30 px-6 py-3">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
