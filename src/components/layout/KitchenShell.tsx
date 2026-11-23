"use client";

import React, { useState } from "react";
import { KitchenSidebar } from "@/components/layout/KitchenSidebar";
import { KitchenTopbar } from "@/components/layout/KitchenTopbar";
import { KitchenMobileTabs } from "@/components/layout/KitchenMobileTabs";
import { EditorialPageHeader } from "@/components/ui/EditorialPageHeader";
import { cn } from "@/lib/utils";

import { InAppNotificationBanner } from "@/components/ui/InAppNotificationBanner";
import { KitchenTodayStrip } from "@/components/kitchen/KitchenTodayStrip";
import { AmbientBackground, FadeIn } from "@/components/motion";
import { FloorModeProvider } from "@/context/FloorModeContext";

interface KitchenShellProps {
  children: React.ReactNode;
  kitchenId: string;
  kitchenName?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function KitchenShell({
  children,
  kitchenId,
  kitchenName = "Institutional Facility",
  title,
  subtitle,
  action,
}: KitchenShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <FloorModeProvider>
      <div className="min-h-screen bg-background flex flex-row selection:bg-accent-soft selection:text-accent">
        {/* Desktop Collapsible Sidebar */}
        <KitchenSidebar
          kitchenId={kitchenId}
          kitchenName={kitchenName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-16 relative">
          <AmbientBackground variant="surface" showGrid={false} />
          <KitchenTopbar
            kitchenId={kitchenId}
            kitchenName={kitchenName}
            title={title}
          />

          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
            <FadeIn direction="up" distance={8} duration={0.3}>
              <InAppNotificationBanner />
              <KitchenTodayStrip kitchenId={kitchenId} />
              {title && (
                <EditorialPageHeader
                  eyebrow={`STATION OPERATIONS · ${kitchenName.toUpperCase()}`}
                  title={title}
                  subtitle={subtitle}
                  actions={action}
                />
              )}

              {children}
            </FadeIn>
          </main>
        </div>

        {/* Mobile Bottom Tab Navigation */}
        <KitchenMobileTabs kitchenId={kitchenId} />
      </div>
    </FloorModeProvider>
  );
}
