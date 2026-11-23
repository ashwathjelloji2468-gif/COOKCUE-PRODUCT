"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  UtensilsCrossed,
  Activity,
  Users,
  Inbox,
  ScrollText,
  Server,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/layout/UserMenu";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: string;
}

export function useAdminNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isFounder = !user || user.role === "FOUNDER";

  const isExactOrChild = (targetPath: string) => {
    if (targetPath === "/founder") {
      return pathname === "/founder";
    }
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  };

  const nonFounderNav: NavItem[] = [
    ...(user?.kitchenId
      ? [
          {
            title: "Kitchen Station",
            href: `/kitchen/${user.kitchenId}/morning`,
            icon: UtensilsCrossed,
            active: pathname.startsWith(`/kitchen/${user.kitchenId}`),
          },
        ]
      : []),
    ...(user?.contractorId
      ? [
          {
            title: "Contractor Portal",
            href: `/contractor/${user.contractorId}`,
            icon: Building2,
            active: pathname.startsWith(`/contractor/${user.contractorId}`),
          },
        ]
      : []),
    {
      title: "Profile",
      href: "/founder/profile",
      icon: Users,
      active: pathname === "/founder/profile",
    },
    {
      title: "Permissions",
      href: "/founder/permissions",
      icon: ScrollText,
      active: pathname === "/founder/permissions",
    },
    {
      title: "Preferences",
      href: "/founder/preferences",
      icon: LifeBuoy,
      active: pathname === "/founder/preferences",
    },
  ];

  const mainNav: NavItem[] = isFounder
    ? [
        {
          title: "Overview",
          href: "/founder",
          icon: LayoutDashboard,
          active: isExactOrChild("/founder"),
        },
        {
          title: "Kitchens",
          href: "/founder/kitchens",
          icon: UtensilsCrossed,
          active: isExactOrChild("/founder/kitchens"),
        },
        {
          title: "Contractors",
          href: "/founder/contractors",
          icon: Building2,
          active: isExactOrChild("/founder/contractors"),
        },
        {
          title: "Monitoring & Data Quality",
          href: "/founder/monitoring",
          icon: Activity,
          active: isExactOrChild("/founder/monitoring"),
        },
        {
          title: "Applications",
          href: "/founder/applications",
          icon: Inbox,
          active: isExactOrChild("/founder/applications"),
        },
      ]
    : nonFounderNav;

  const governanceNav: NavItem[] = isFounder
    ? [
        {
          title: "Users",
          href: "/founder/users",
          icon: Users,
          active: isExactOrChild("/founder/users"),
        },
        {
          title: "Audit Log",
          href: "/founder/audit-log",
          icon: ScrollText,
          active: isExactOrChild("/founder/audit-log"),
        },
        {
          title: "Environment",
          href: "/founder/environment",
          icon: Server,
          active: isExactOrChild("/founder/environment"),
        },
        {
          title: "Support",
          href: "/founder/support",
          icon: LifeBuoy,
          active: isExactOrChild("/founder/support"),
        },
      ]
    : [];

  return { isFounder, user, mainNav, governanceNav };
}

export function AdminSidebar({
  collapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { isFounder, mainNav, governanceNav } = useAdminNav();

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "hidden md:flex flex-col bg-[#0D221C] text-[#F7F5EF] border-r border-[#193D32] transition-all duration-200 shrink-0 select-none z-30 sticky top-0 h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-[#193D32]">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 font-heading font-semibold text-[#F7F5EF] hover:opacity-95 transition-opacity",
              collapsed && "justify-center w-full"
            )}
            title="Go to CookCue Dashboard"
          >
            <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <Image
                src="/cookcue-logo.png"
                alt="CookCue Logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">CookCue</span>
                <span className="text-[10px] text-[#D9EF79] font-mono font-semibold tracking-wider uppercase -mt-0.5">
                  Platform Console
                </span>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-[#E0E7E3] hover:text-white hover:bg-[#193D32] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
          {/* Main System Section */}
          <div className="space-y-1">
            <div className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A3CFBB]", collapsed && "text-center")}>
              {collapsed ? "•••" : "Platform Management"}
            </div>
            {mainNav.map((item) => {
              const Icon = item.icon;
              const linkContent = (
                <Link
                  key={item.title}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group relative",
                    item.active
                      ? "bg-[#D9EF79] text-[#0A1A15] font-bold shadow-sm"
                      : "text-[#F1F5F3] hover:text-white hover:bg-[#193D32] font-medium",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0 transition-colors", item.active ? "text-[#0A1A15]" : "text-[#C2D8CD] group-hover:text-[#D9EF79]")} />
                  {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </div>

          {/* Governance & System Settings */}
          {governanceNav.length > 0 && (
            <div className="space-y-1">
              <div className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A3CFBB]", collapsed && "text-center")}>
                {collapsed ? "•••" : "Governance"}
              </div>
              {governanceNav.map((item) => {
                const Icon = item.icon;
                const linkContent = (
                  <Link
                    key={item.title}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group",
                      item.active
                        ? "bg-[#D9EF79] text-[#0A1A15] font-bold shadow-sm"
                        : "text-[#F1F5F3] hover:text-white hover:bg-[#193D32] font-medium",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0 transition-colors", item.active ? "text-[#0A1A15]" : "text-[#C2D8CD] group-hover:text-[#D9EF79]")} />
                    {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                    {!collapsed && item.badge && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#193D32] text-[#D9EF79] border border-[#D9EF79]/50 font-semibold tracking-wide">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.title}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.title} ({item.badge})
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
          )}
        </div>

        {/* Footer: User Menu & Expand Button */}
        <div className="border-t border-[#193D32] p-2.5 space-y-2 bg-[#091813]">
          {collapsed && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-1.5 rounded-md text-[#E0E7E3] hover:text-white hover:bg-[#193D32] transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <UserMenu collapsed={collapsed} variant="dark" />
        </div>
      </aside>
    </TooltipProvider>
  );
}
