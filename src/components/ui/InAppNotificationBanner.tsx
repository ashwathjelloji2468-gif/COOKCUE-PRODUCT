"use client";

import React, { useEffect, useState } from "react";
import { getPendingInAppNotifications, acknowledgeInAppNotification } from "@/server/actions/onboarding";
import { CheckCircle2, X } from "lucide-react";

const STORAGE_KEY = "cookcue_dismissed_notification_ids";

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getDismissedIds();
    set.add(id);
    const arr = Array.from(set);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

export function InAppNotificationBanner() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPendingInAppNotifications().then((res) => {
      if (res.success && res.data) {
        const dismissed = getDismissedIds();
        setNotifications(res.data.filter((n: any) => !dismissed.has(n.id)));
      }
      setLoading(false);
    });
  }, []);

  async function handleDismiss(id: string) {
    saveDismissedId(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await acknowledgeInAppNotification(id);
  }

  if (loading || notifications.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="p-4 rounded-xl bg-primary text-primary-foreground border border-primary/20 shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-accent text-primary shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm text-accent">
                {n.title}
              </div>
              <p className="text-xs text-primary-foreground/90 mt-0.5 leading-relaxed">
                {n.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDismiss(n.id)}
            className="p-1.5 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors shrink-0"
            title="Acknowledge notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
