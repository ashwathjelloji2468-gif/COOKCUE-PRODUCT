"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, Menu } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FounderNotificationBell } from "@/components/layout/FounderNotificationBell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { AdminMobileDrawer } from "@/components/layout/AdminMobileDrawer";

export function AdminTopbar({ title }: { title?: string }) {
  const { user } = useCurrentUser();
  const isFounder = !user || user.role === "FOUNDER";
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors">
        {/* Left: Mobile Hamburger Button & Organization Badge & Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open mobile navigation menu"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-foreground hover:bg-accent-soft hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring -ml-1.5"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
              title="Go to CookCue Dashboard"
            >
              <Image
                src="/cookcue-logo.png"
                alt="CookCue"
                width={24}
                height={24}
                className="h-6 w-auto object-contain"
                priority
              />
              <span className="font-heading font-bold text-sm tracking-tight text-accent">
                CookCue Platform
              </span>
            </Link>
            <span className="hidden sm:inline-block text-muted-foreground opacity-60 font-light">/</span>
            <span className="text-xs text-muted-foreground hidden sm:inline-block font-medium">
              {isFounder ? "Founder Console" : "Account Settings"}
            </span>
          </div>
        </div>

      {/* Right: Operational Status, Alerts, ThemeToggle & Admin User Menu */}
      <div className="flex items-center gap-3 shrink-0">
        {isFounder && (
          <div className="hidden lg:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent-soft text-accent border border-accent/30">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Operational Console</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-card text-foreground border border-border shadow-xs">
              <Building2 className="w-3 h-3 text-accent" />
              <span>Multi-Tenant Network</span>
            </span>
          </div>
        )}

        {isFounder && <FounderNotificationBell />}

        <ThemeToggle />

        <div className="w-auto sm:w-44">
          <div className="sm:hidden">
            <UserMenu collapsed variant="light" />
          </div>
          <div className="hidden sm:block">
            <UserMenu variant="light" />
          </div>
        </div>
      </div>
    </header>

    <AdminMobileDrawer
      open={mobileDrawerOpen}
      onOpenChange={setMobileDrawerOpen}
    />
  </>
  );
}
