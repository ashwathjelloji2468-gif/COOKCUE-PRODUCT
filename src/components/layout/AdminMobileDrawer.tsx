"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAdminNav } from "@/components/layout/AdminSidebar";

interface AdminMobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminMobileDrawer({
  open,
  onOpenChange,
}: AdminMobileDrawerProps) {
  const { isFounder, mainNav, governanceNav } = useAdminNav();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 sm:w-80 p-0 flex flex-col bg-[var(--card)] text-[var(--foreground)] border-r border-[var(--card-border)] shadow-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Platform Navigation</SheetTitle>
          <SheetDescription>
            Main navigation and governance links for CookCue Platform
          </SheetDescription>
        </SheetHeader>

        {/* Brand Header */}
        <div className="flex h-16 items-center px-4 pr-12 border-b border-[var(--card-border)] shrink-0">
          <Link
            href="/"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2.5 font-heading font-semibold text-[var(--foreground)] hover:opacity-95 transition-opacity"
            title="Go to CookCue Dashboard"
          >
            <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20 p-1 shadow-xs">
              <Image
                src="/cookcue-logo.png"
                alt="CookCue Logo"
                width={32}
                height={32}
                className="h-6 w-auto object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">
                CookCue
              </span>
              <span className="text-[10px] text-[var(--accent)] font-mono font-semibold tracking-wider uppercase -mt-0.5">
                Platform Console
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main System Section */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {isFounder ? "Platform Management" : "Operations"}
            </div>
            {mainNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all group",
                    item.active
                      ? "bg-[var(--accent)] text-white dark:bg-[#D9EF79] dark:text-[#0A1A15] font-bold shadow-xs"
                      : "text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      item.active
                        ? "text-white dark:text-[#0A1A15]"
                        : "text-[var(--muted)] group-hover:text-[var(--accent)]"
                    )}
                  />
                  <span className="flex-1 truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>

          {/* Governance Section */}
          {governanceNav.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Governance
              </div>
              {governanceNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all group",
                      item.active
                        ? "bg-[var(--accent)] text-white dark:bg-[#D9EF79] dark:text-[#0A1A15] font-bold shadow-xs"
                        : "text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] font-medium"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        item.active
                          ? "text-white dark:text-[#0A1A15]"
                          : "text-[var(--muted)] group-hover:text-[var(--accent)]"
                      )}
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold tracking-wide ml-auto",
                          item.active
                            ? "bg-white/20 text-white dark:bg-[#0A1A15]/20 dark:text-[#0A1A15] border border-white/30 dark:border-[#0A1A15]/30"
                            : "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: User Menu */}
        <div className="border-t border-[var(--card-border)] p-3 bg-[var(--card)] shrink-0">
          <UserMenu variant="light" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
