"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Building2,
  Inbox,
  CheckCircle2,
  FileEdit,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getFounderNotifications,
  type FounderNotificationItem,
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

function getNotificationIcon(
  type: FounderNotificationItem["type"],
  severity: FounderNotificationItem["severity"]
) {
  switch (type) {
    case "STOCKOUT":
      return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    case "ABNORMAL":
      return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
    case "APPLICATION":
      return <Inbox className="w-4 h-4 text-[var(--accent)] shrink-0" />;
    case "CONTRACTOR":
      return <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "ADJUSTMENT":
      return <FileEdit className="w-4 h-4 text-amber-500 shrink-0" />;
    case "CLOSEOUT":
    default:
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
}

export function FounderNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FounderNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getFounderNotifications(15);
        if (res.success && res.notifications) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

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
          aria-label={`Platform Health Alerts${count > 0 ? ` (${count} notifications)` : ""}`}
          className={cn(
            "relative p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
            open && "bg-[var(--accent-soft)] text-[var(--foreground)]"
          )}
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[#193D32] shadow-xs ring-2 ring-[var(--background)]"
              data-testid="notification-badge"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] shadow-xl rounded-xl overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--background)]">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-xs tracking-tight text-[var(--foreground)]">
              Platform Activity & Alerts
            </span>
            {count > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 font-mono">
                {count} recent
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              loadNotifications();
            }}
            disabled={isPending}
            title="Refresh notifications"
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
          </button>
        </div>

        {/* Notification list */}
        <div className="max-h-96 overflow-y-auto divide-y divide-[var(--card-border)]">
          {loading && notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--muted)]">
              Loading platform activity...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <Bell className="w-8 h-8 text-[var(--muted)] mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold text-[var(--foreground)]">
                No notifications yet.
              </p>
              <p className="text-[11px] text-[var(--muted)] mt-1 max-w-[240px] mx-auto leading-relaxed">
                Operational closeouts, stockout alerts, and contractor activities will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href || "/founder/audit-log"}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 p-3 text-left hover:bg-[var(--accent-soft)] transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-[var(--background)] border border-[var(--card-border)] mt-0.5 shrink-0">
                  {getNotificationIcon(item.type, item.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-[var(--foreground)] group-hover:text-[var(--accent)] truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--muted)] whitespace-nowrap shrink-0">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                  {item.kitchenName && (
                    <span className="inline-block mt-1 text-[10px] font-medium text-[var(--accent)] font-mono">
                      {item.kitchenName}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-[var(--card-border)] bg-[var(--background)] text-center">
          <Link
            href="/founder/audit-log"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline py-1"
          >
            <span>View full audit log</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
