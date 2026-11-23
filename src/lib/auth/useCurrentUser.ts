"use client";

import { useEffect, useState, useCallback } from "react";
import { getCurrentUser } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/auth/session";

export type ClientUser = {
  id: string;
  code?: string | null;
  name: string;
  role: string;
  email: string;
  kitchenId?: string | null;
  contractorId?: string | null;
} | null;

let memoryUser: ClientUser | undefined = undefined;
const listeners = new Set<(user: ClientUser) => void>();

export function clearClientSession(): void {
  memoryUser = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("cookcue_user");
      sessionStorage.clear();
    } catch {}
  }
  listeners.forEach((listener) => listener(null));
}

export function setClientSession(user: ClientUser): void {
  memoryUser = user;
  listeners.forEach((listener) => listener(user));
}

export function useCurrentUser(initialUser?: ClientUser) {
  const [user, setUser] = useState<ClientUser>(() => {
    if (initialUser !== undefined) {
      memoryUser = initialUser;
      return initialUser;
    }
    return memoryUser !== undefined ? memoryUser : null;
  });

  const [loading, setLoading] = useState<boolean>(memoryUser === undefined && initialUser === undefined);

  const fetchUser = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      const clientUser: ClientUser = u
        ? {
            id: u.id,
            code: u.code || null,
            name: u.name || u.email.split("@")[0],
            role: u.role,
            email: u.email,
            kitchenId: u.kitchenId || null,
            contractorId: u.contractorId || null,
          }
        : null;

      memoryUser = clientUser;
      setUser(clientUser);
      listeners.forEach((listener) => listener(clientUser));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleUpdate = (updated: ClientUser) => {
      if (mounted) {
        setUser(updated);
        setLoading(false);
      }
    };

    listeners.add(handleUpdate);

    // If memoryUser is not populated, fetch from server action
    if (memoryUser === undefined && initialUser === undefined) {
      fetchUser();
    } else if (memoryUser !== undefined) {
      setUser(memoryUser);
      setLoading(false);
    }

    return () => {
      mounted = false;
      listeners.delete(handleUpdate);
    };
  }, [fetchUser, initialUser]);

  return { user, loading, refresh: fetchUser };
}
