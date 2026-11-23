"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  ClipboardCheck,
  TrendingUp,
  FileBarChart2,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Building2,
  ClipboardList,
  BookOpen,
  Clock,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/UserMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KitchenSidebarProps {
  kitchenId: string;
  kitchenName?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function KitchenSidebar({
  kitchenId,
  kitchenName,
  collapsed,
  onToggleCollapse,
}: KitchenSidebarProps) {
  const pathname = usePathname();

  const isExactOrChild = (targetPath: string) => {
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  };

  const operationalNav = [
    {
      title: "Morning Plan",
      href: `/kitchen/${kitchenId}/morning`,
      icon: ChefHat,
      active: isExactOrChild(`/kitchen/${kitchenId}/morning`),
      badge: "Action",
    },
    {
      title: "Staff Board",
      href: `/kitchen/${kitchenId}/staff-board`,
      icon: ClipboardList,
      active: isExactOrChild(`/kitchen/${kitchenId}/staff-board`),
      badge: "Live",
    },
    {
      title: "Evening Closeout",
      href: `/kitchen/${kitchenId}/closeout`,
      icon: ClipboardCheck,
      active: isExactOrChild(`/kitchen/${kitchenId}/closeout`),
      badge: "Evening",
    },
    {
      title: "Results Dashboard",
      href: `/kitchen/${kitchenId}/results`,
      icon: FileBarChart2,
      active: isExactOrChild(`/kitchen/${kitchenId}/results`),
    },
    {
      title: "Service Diary",
      href: `/kitchen/${kitchenId}/diary`,
      icon: BookOpen,
      active: isExactOrChild(`/kitchen/${kitchenId}/diary`),
    },
    {
      title: "Shift Handoff",
      href: `/kitchen/${kitchenId}/handoff`,
      icon: Clock,
      active: isExactOrChild(`/kitchen/${kitchenId}/handoff`),
      badge: "Shift",
    },
    {
      title: "Forecast & Learning",
      href: `/kitchen/${kitchenId}/forecast`,
      icon: TrendingUp,
      active: isExactOrChild(`/kitchen/${kitchenId}/forecast`),
    },
    {
      title: "Purchase Indents",
      href: `/kitchen/${kitchenId}/indents`,
      icon: ShoppingBag,
      active: isExactOrChild(`/kitchen/${kitchenId}/indents`),
      badge: "Store",
    },
    {
      title: "Dishes Config",
      href: `/kitchen/${kitchenId}/dishes`,
      icon: Utensils,
      active: isExactOrChild(`/kitchen/${kitchenId}/dishes`),
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "hidden md:flex flex-col bg-[#102821] text-[#F7F5EF] border-r border-[#1A3B31] transition-all duration-200 shrink-0 select-none z-30 sticky top-0 h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-[#1A3B31]">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 font-heading font-semibold text-[#F7F5EF] hover:opacity-90 transition-opacity",
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
                <span className="text-sm font-bold tracking-tight text-[#F7F5EF]">CookCue</span>
                <span className="text-[10px] text-[#D9EF79] font-mono tracking-wider uppercase -mt-0.5">
                  Kitchen Station
                </span>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-[#F7F5EF]/60 hover:text-[#F7F5EF] hover:bg-[#193D32] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
          {/* Active Kitchen Workflows */}
          <div className="space-y-1">
            <div
              className={cn(
                "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#F7F5EF]/50",
                collapsed && "text-center"
              )}
            >
              {collapsed ? "•••" : "Station Workflows"}
            </div>

            {operationalNav.map((item) => {
              const Icon = item.icon;
              const linkContent = (
                <Link
                  key={item.title}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative",
                    item.active
                      ? "bg-[#D9EF79] text-[#102821] font-semibold shadow-xs"
                      : "text-[#F7F5EF]/80 hover:text-[#F7F5EF] hover:bg-[#193D32]/80",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      item.active ? "text-[#102821]" : "text-[#F7F5EF]/60 group-hover:text-[#F7F5EF]"
                    )}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                  {!collapsed && item.badge && (
                    <span
                      className={cn(
                        "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
                        item.active
                          ? "bg-[#102821]/15 text-[#102821]"
                          : "bg-[#D9EF79]/20 text-[#D9EF79] border border-[#D9EF79]/30"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs bg-[#102821] text-[#F7F5EF] border-[#1A3B31]">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </div>
        </div>

        {/* Footer Area: Facility Identifier & Operator Menu */}
        <div className="p-3 border-t border-[#1A3B31] space-y-2">
          {!collapsed && kitchenName && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[#193D32]/50 border border-[#1A3B31] text-[11px] text-[#F7F5EF]/70 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#D9EF79] shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-[#F7F5EF] truncate">{kitchenName}</div>
                <div className="text-[9px] font-mono text-[#F7F5EF]/50 truncate">{kitchenId}</div>
              </div>
            </div>
          )}

          <UserMenu collapsed={collapsed} variant="dark" />
        </div>
      </aside>
    </TooltipProvider>
  );
}
