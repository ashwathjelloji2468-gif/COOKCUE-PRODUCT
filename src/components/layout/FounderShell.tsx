"use client";

import React, { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { EditorialPageHeader } from "@/components/ui/EditorialPageHeader";
import { InAppNotificationBanner } from "@/components/ui/InAppNotificationBanner";
import { AmbientBackground, FadeIn } from "@/components/motion";

interface FounderShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function FounderShell({
  children,
  title,
  subtitle,
  action,
}: FounderShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="min-h-screen text-[var(--foreground)] flex flex-row transition-colors"
      style={{ background: "var(--background)" }}
    >
      {/* Admin Desktop Sidebar */}
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 relative">
        <AmbientBackground variant="surface" showGrid={false} />
        <AdminTopbar title={title} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 relative z-10">
          <FadeIn direction="up" distance={10} duration={0.35}>
            <InAppNotificationBanner />
            {(title || subtitle) && (
              <EditorialPageHeader
                eyebrow="PORTFOLIO OVERSIGHT & GOVERNANCE"
                title={title || "Platform Operations"}
                subtitle={subtitle}
                actions={action}
              />
            )}

            {children}
          </FadeIn>
        </main>
      </div>
    </div>
  );
}
