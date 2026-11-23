"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { User, LogOut, Settings, ShieldCheck, LayoutDashboard, UtensilsCrossed, Building2 } from "lucide-react";
import { logout } from "@/server/actions/auth";
import { useCurrentUser, clearClientSession, type ClientUser } from "@/lib/auth/useCurrentUser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  collapsed?: boolean;
  role?: string;
  name?: string;
  userCode?: string;
  variant?: "dark" | "light";
  user?: ClientUser;
}

export function UserMenu({
  collapsed = false,
  role: propRole,
  name: propName,
  userCode: propUserCode,
  variant = "dark",
  user: propUser,
}: UserMenuProps) {
  const isDark = variant === "dark";
  const [isPending, startTransition] = useTransition();

  const { user: fetchedUser } = useCurrentUser(propUser);

  // Priority: propUser -> prop values if explicitly provided -> fetched DB session user
  const effectiveUser = propUser || fetchedUser;
  const displayName = propName || effectiveUser?.name || effectiveUser?.email?.split("@")[0] || "";
  const displayRole = propRole || effectiveUser?.role || "";
  const displayCode = propUserCode || effectiveUser?.code || null;
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "U";

  function handleSignOut() {
    startTransition(async () => {
      // 1. Immediately purge all client storage & cached memory state
      clearClientSession();
      // 2. Clear server session cookie and redirect to login
      await logout();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors outline-none w-full",
            isDark
              ? "text-[#F1F5F3] hover:bg-white/10 focus:ring-1 focus:ring-accent-soft"
              : "text-foreground hover:bg-muted focus:ring-1 focus:ring-ring",
            collapsed && "justify-center p-1.5"
          )}
        >
          <Avatar className="h-7 w-7 rounded-md border border-border/60 shrink-0">
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                isDark
                  ? "bg-primary text-accent-soft border border-accent-soft/30"
                  : "bg-muted text-foreground border border-border"
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden text-left min-w-0">
              <span
                className={cn(
                  "truncate text-xs font-semibold",
                  isDark ? "text-white" : "text-foreground"
                )}
              >
                {displayName || "..."}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-mono",
                  isDark ? "text-[#A3CFBB] font-medium" : "text-muted-foreground"
                )}
              >
                {displayRole}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 p-1.5 border border-border bg-card text-foreground shadow-lg rounded-xl"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2.5 py-1.5 space-y-1">
          <div className="truncate">
            Signed in as{" "}
            <strong className="text-foreground font-semibold">
              {displayName || "User"}
            </strong>
          </div>
          {displayRole && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                {displayRole}
              </span>
            </div>
          )}
          {displayCode && (
            <div className="font-mono text-[10px] text-accent font-semibold">
              User ID: {displayCode}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--card-border)] my-1" />

        {/* Primary Role Links */}
        {effectiveUser?.role === "FOUNDER" && (
          <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
            <Link href="/founder" className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
              <LayoutDashboard className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <span>Founder Console</span>
            </Link>
          </DropdownMenuItem>
        )}

        {effectiveUser?.kitchenId && (
          <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
            <Link href={`/kitchen/${effectiveUser.kitchenId}/morning`} className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
              <UtensilsCrossed className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <span>Kitchen Station</span>
            </Link>
          </DropdownMenuItem>
        )}

        {effectiveUser?.contractorId && (
          <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
            <Link href={`/contractor/${effectiveUser.contractorId}`} className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
              <Building2 className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <span>Contractor Portal</span>
            </Link>
          </DropdownMenuItem>
        )}

        {/* Account & Profile Links */}
        <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
          <Link href="/founder/profile" className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
            <User className="h-4 w-4 text-[var(--foreground)] shrink-0" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
          <Link href="/founder/permissions" className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
            <ShieldCheck className="h-4 w-4 text-[var(--foreground)] shrink-0" />
            <span>Permissions</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs flex items-center justify-between cursor-pointer rounded-md text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] focus:bg-[var(--accent-soft)] focus:text-[var(--foreground)]">
          <Link href="/founder/preferences" className="flex items-center gap-2.5 w-full px-2 py-1.5 font-medium text-[var(--foreground)]">
            <Settings className="h-4 w-4 text-[var(--foreground)] shrink-0" />
            <span>Preferences</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--card-border)] my-1" />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isPending}
          className="text-xs flex items-center justify-between cursor-pointer rounded-md px-2 py-1.5 font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-700 dark:focus:text-red-300"
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{isPending ? "Signing out..." : "Sign out"}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
