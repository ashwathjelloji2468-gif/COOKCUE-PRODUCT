import { FounderShell } from "@/components/layout/FounderShell";
import { AccountNavTabs } from "@/components/layout/AccountNavTabs";
import { ThemePreferencesClient } from "./ThemePreferencesClient";
import { Settings } from "lucide-react";

export default function FounderPreferencesPage() {
  return (
    <FounderShell
      title="User Preferences"
      subtitle="Interface personalization and display configuration for your workstation"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <Settings className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Workstation Settings</span>
        </div>
      }
    >
      <AccountNavTabs />

      <div className="max-w-3xl space-y-6">
        <ThemePreferencesClient />
      </div>
    </FounderShell>
  );
}
