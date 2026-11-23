"use client";

import React from "react";
import {
  UtensilsCrossed,
  Calendar,
} from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { KitchenNotificationBell } from "@/components/layout/KitchenNotificationBell";
import { KitchenDishSearchModal } from "@/components/layout/KitchenDishSearchModal";
import { FloorModeToggle } from "@/components/layout/FloorModeToggle";

interface KitchenTopbarProps {
  kitchenId: string;
  kitchenName?: string;
  title?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function KitchenTopbar({
  kitchenId,
  kitchenName = "Kitchen Operations",
  title,
}: KitchenTopbarProps) {
  const todayStr = dateFormatter.format(new Date());

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border/80 bg-background/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Kitchen breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 truncate">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20 hidden sm:flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-sm text-foreground truncate">
                {kitchenName}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden lg:inline-block border border-border/60">
                ID: {kitchenId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Live Dish / Recipe Search Modal */}
      <div className="hidden lg:flex items-center flex-1 max-w-sm mx-4">
        <KitchenDishSearchModal kitchenId={kitchenId} />
      </div>

      {/* Right: Date badge, notifications, theme toggle, user menu */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground font-medium bg-card px-3 py-1.5 rounded-lg border border-border shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span className="tabular-nums" suppressHydrationWarning>
            {todayStr}
          </span>
        </div>

        <KitchenNotificationBell kitchenId={kitchenId} />

        <FloorModeToggle />

        <ThemeToggle />

        <div className="w-auto sm:w-40">
          <div className="sm:hidden">
            <UserMenu collapsed variant="light" />
          </div>
          <div className="hidden sm:block">
            <UserMenu variant="light" />
          </div>
        </div>
      </div>
    </header>
  );
}
