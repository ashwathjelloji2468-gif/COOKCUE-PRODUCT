"use client";

import React from "react";
import { UtensilsCrossed, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface KitchenSwitcherProps {
  currentKitchenId: string;
  kitchenName?: string;
  collapsed?: boolean;
}

export function KitchenSwitcher({
  currentKitchenId,
  kitchenName = "Current Kitchen",
  collapsed = false,
}: KitchenSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-2 text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors outline-none focus:ring-1 focus:ring-sidebar-ring w-full",
            collapsed && "justify-center p-2"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-sidebar-foreground">
                {kitchenName}
              </span>
              <span className="truncate text-[10px] text-sidebar-foreground/70 font-mono">
                {currentKitchenId}
              </span>
            </div>
          )}
          {!collapsed && <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 p-1.5">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Current Kitchen
        </DropdownMenuLabel>
        <DropdownMenuItem className="flex items-center justify-between text-xs font-medium bg-muted/60">
          <div className="truncate pr-2">
            <p className="font-semibold text-foreground truncate">{kitchenName}</p>
            <p className="text-[10px] font-mono text-muted-foreground truncate">{currentKitchenId}</p>
          </div>
          <Check className="h-4 w-4 text-emerald-700 shrink-0" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-[11px] text-muted-foreground bg-muted/30 rounded-md border border-border/50">
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            Currently viewing this kitchen. Kitchen switching is unavailable until sign-in and authorized memberships are implemented.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
