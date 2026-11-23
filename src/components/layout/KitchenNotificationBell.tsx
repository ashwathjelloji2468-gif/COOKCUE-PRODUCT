"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Utensils,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getKitchenNotifications,
  type KitchenNotificationItem,
} from "@/server/actions/notifications";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffInSeconds) || diffInSeconds < 0) return "Just now";
    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: KitchenNotificationItem["type"]) {
  switch (type) {
    case "STOCKOUT":
      return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case "ABNORMAL":
      return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
    case "PLAN":
      return <Calendar className="w-4 h-4 text-[var(--accent)] shrink-0" />;
    case "CLOSEOUT":
    default:
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
}

export function KitchenNotificationBell({ kitchenId }: { kitchenId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<KitchenNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getKitchenNotifications(kitchenId, 15);
        if (res.success && res.notifications) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        console.error("Failed to load kitchen notifications:", err);
      } finally {
        setLoading(false);
      }
    });
  }, [kitchenId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      loadNotifications();
    }
  };

  const count = notifications.length;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Operational Notifications (${count})`}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-colors outline-none focus:ring-1 focus:ring-primary"
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse"
              title={`${count} operational updates`}
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 border border-[var(--card-border)] bg-[var(--card)] shadow-xl rounded-xl overflow-hidden z-50 text-[var(--foreground)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--background)]/60">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--accent)]" />
            <span className="font-heading font-semibold text-xs text-[var(--foreground)]">
              Station Operational Feed
            </span>
            {count > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold">
                {count}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={loadNotifications}
            disabled={isPending}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)] transition-colors"
            title="Refresh feed"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5",
                (isPending || loading) && "animate-spin"
              )}
            />
          </button>
        </div>

        {/* Content list */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--card-border)]">
          {loading && notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Fetching station events...</span>
            </div>
          ) : count === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-[var(--foreground)]">
                No Operational Alerts
              </p>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-[240px] mx-auto">
                Station is running normally with no active stockouts or disruption flags.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href || `/kitchen/${kitchenId}/morning`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 p-3.5 hover:bg-[var(--accent-soft)] transition-colors text-left block"
              >
                <div className="p-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] mt-0.5 shrink-0">
                  {getNotificationIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-heading font-semibold text-xs text-[var(--foreground)] truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--muted)] shrink-0 font-mono">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2 leading-snug">
                    {item.summary}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
