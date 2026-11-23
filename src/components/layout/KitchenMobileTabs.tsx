"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  ClipboardCheck,
  TrendingUp,
  FileBarChart2,
  Utensils,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KitchenMobileTabsProps {
  kitchenId: string;
}

export function KitchenMobileTabs({ kitchenId }: KitchenMobileTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      title: "Plan",
      href: `/kitchen/${kitchenId}/morning`,
      icon: ChefHat,
      active: pathname.includes("/morning"),
    },
    {
      title: "Staff",
      href: `/kitchen/${kitchenId}/staff-board`,
      icon: ClipboardList,
      active: pathname.includes("/staff-board"),
    },
    {
      title: "Closeout",
      href: `/kitchen/${kitchenId}/closeout`,
      icon: ClipboardCheck,
      active: pathname.includes("/closeout"),
    },
    {
      title: "Results",
      href: `/kitchen/${kitchenId}/results`,
      icon: FileBarChart2,
      active: pathname.includes("/results"),
    },
    {
      title: "Forecast",
      href: `/kitchen/${kitchenId}/forecast`,
      icon: TrendingUp,
      active: pathname.includes("/forecast"),
    },
    {
      title: "Dishes",
      href: `/kitchen/${kitchenId}/dishes`,
      icon: Utensils,
      active: pathname.includes("/dishes"),
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#102821] border-t border-[#1A3B31] shadow-xl flex items-center justify-around h-16 px-1 safe-area-bottom overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.title}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center flex-1 min-w-[50px] h-full py-1 text-[9.5px] sm:text-[10px] font-medium transition-colors",
              tab.active
                ? "text-[#D9EF79] font-bold"
                : "text-[#F7F5EF]/65 hover:text-[#F7F5EF]"
            )}
          >
            <div
              className={cn(
                "p-1 sm:p-1.5 rounded-lg transition-all",
                tab.active ? "bg-[#D9EF79] text-[#102821] shadow-xs" : "text-current"
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className="mt-0.5 tracking-tight truncate max-w-full">{tab.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
