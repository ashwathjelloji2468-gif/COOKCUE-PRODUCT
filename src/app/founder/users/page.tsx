import { FounderShell } from "@/components/layout/FounderShell";
import { listUsersAsFounder } from "@/server/actions/user";
import { UsersTableClient } from "./UsersTableClient";
import { Users } from "lucide-react";

export default async function FounderUsersPage() {
  const res = await listUsersAsFounder();
  const users = res.success ? res.data : [];
  const totalCount = res.success ? res.totalCount : users.length;

  return (
    <FounderShell
      title="User Management"
      subtitle="Multi-tenant user credentials, institutional role assignments, and account statuses"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{totalCount} {totalCount === 1 ? "User" : "Users"}</span>
        </div>
      }
    >
      <UsersTableClient initialUsers={users} />
    </FounderShell>
  );
}
