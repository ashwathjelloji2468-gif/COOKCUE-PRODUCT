"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShieldCheck, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountNavTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      title: "Profile",
      href: "/founder/profile",
      icon: User,
      active: pathname === "/founder/profile",
    },
    {
      title: "Permissions",
      href: "/founder/permissions",
      icon: ShieldCheck,
      active: pathname === "/founder/permissions",
    },
    {
      title: "Preferences",
      href: "/founder/preferences",
      icon: Settings,
      active: pathname === "/founder/preferences",
    },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-[var(--card-border)] mb-6 pb-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors",
              tab.active
                ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold border border-[var(--accent)]/30"
                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tab.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
