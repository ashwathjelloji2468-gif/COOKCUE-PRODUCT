"use client";

import React, { useState, useMemo } from "react";
import type { FounderUserItem } from "@/server/actions/user";
import { Search, Shield, UserCheck, Utensils, Building2, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

interface UsersTableClientProps {
  initialUsers: FounderUserItem[];
}

export function UsersTableClient({ initialUsers }: UsersTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const filteredUsers = useMemo(() => {
    return initialUsers.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q) ||
        (u.contractorName && u.contractorName.toLowerCase().includes(q)) ||
        (u.kitchenName && u.kitchenName.toLowerCase().includes(q));

      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [initialUsers, searchQuery, roleFilter]);

  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, validCurrentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setCurrentPage(1);
  };

  if (initialUsers.length === 0) {
    return (
      <EmptyState
        icon={<User className="w-10 h-10 text-[var(--muted)]" />}
        title="No users in the system yet."
        description="As operators, staff, and contractors are onboarded into the platform, their verified user records and permissions will appear here."
      />
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent-soft text-accent border border-accent/30">
            <Shield className="w-3 h-3" />
            <span>FOUNDER</span>
          </span>
        );
      case "CONTRACTOR_ADMIN":
      case "CONTRACTOR_MANAGER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            <Building2 className="w-3 h-3" />
            <span>CONTRACTOR ADMIN</span>
          </span>
        );
      case "HEAD_COOK":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
            <Utensils className="w-3 h-3" />
            <span>HEAD COOK</span>
          </span>
        );
      case "KITCHEN_STAFF":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-500/10 text-stone-700 dark:text-stone-300 border border-stone-500/20">
            <UserCheck className="w-3 h-3" />
            <span>KITCHEN STAFF</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            <span>{role}</span>
          </span>
        );
    }
  };

  const startIndex = totalItems > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(validCurrentPage * pageSize, totalItems);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <Input
            type="text"
            placeholder="Search email, name, facility, or ID..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search users"
            className="pl-10 h-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => handleRoleChange(e.target.value)}
            aria-label="Filter users by role"
            className="h-10 px-3 text-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          >
            <option value="ALL">All Roles ({initialUsers.length})</option>
            <option value="FOUNDER">Founders</option>
            <option value="CONTRACTOR_ADMIN">Contractor Admins</option>
            <option value="HEAD_COOK">Head Cooks</option>
            <option value="KITCHEN_STAFF">Kitchen Staff</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)] overflow-hidden">
        <CardHeader className="pb-3 border-b border-[var(--card-border)] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
              Registered System Users
            </CardTitle>
            <CardDescription className="text-xs text-[var(--muted)]">
              Showing {startIndex}–{endIndex} of {totalItems} filtered users ({initialUsers.length} total database records).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden divide-y divide-[var(--card-border)]">
            {paginatedUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)] italic">
                No users match the search filter.
              </div>
            ) : (
              paginatedUsers.map((u) => (
                <div key={u.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)] flex items-center justify-center font-bold text-xs shrink-0">
                        {(u.name?.[0] || u.email[0] || "U").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-heading font-semibold text-xs text-[var(--foreground)] block truncate">
                          {u.name || "Unnamed Operator"}
                        </span>
                        <span className="text-[11px] text-[var(--muted)] block truncate font-mono">
                          {u.email}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getRoleBadge(u.role)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--card-border)]/50">
                    <div>
                      {u.contractorName || u.kitchenName ? (
                        <div className="text-[11px]">
                          {u.contractorName && (
                            <span className="text-[var(--foreground)] font-medium block truncate max-w-[180px]">
                              {u.contractorName}
                            </span>
                          )}
                          {u.kitchenName && (
                            <span className="text-[var(--muted)] block truncate text-[10px] max-w-[180px]">
                              {u.kitchenName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--muted)] italic">
                          Platform Level
                        </span>
                      )}
                    </div>
                    <div>
                      <StatusBadge
                        status={u.status === "ACTIVE" ? "active" : "inactive"}
                        label={u.status}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted)] pt-0.5">
                    <span>ID: {u.code || u.id}</span>
                    <span>
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop & Tablet Table (sm+) */}
          <div className="hidden sm:block overflow-auto max-h-[600px] cc-table">
            <table className="w-full min-w-[700px] text-xs text-left cc-table">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border font-semibold sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Organization / Facility</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)] italic">
                      No users match the search filter.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--accent-soft)] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)] flex items-center justify-center font-bold text-xs shrink-0">
                            {(u.name?.[0] || u.email[0] || "U").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-heading font-semibold text-xs text-[var(--foreground)] block truncate">
                              {u.name || "Unnamed Operator"}
                            </span>
                            <span className="text-[11px] text-[var(--muted)] block truncate font-mono">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getRoleBadge(u.role)}
                      </td>

                      <td className="py-3.5 px-4">
                        {u.contractorName || u.kitchenName ? (
                          <div className="text-[11px]">
                            {u.contractorName && (
                              <span className="text-[var(--foreground)] font-medium block truncate">
                                {u.contractorName}
                              </span>
                            )}
                            {u.kitchenName && (
                              <span className="text-[var(--muted)] block truncate text-[10px]">
                                {u.kitchenName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] italic">
                            Platform Level
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge
                          status={u.status === "ACTIVE" ? "active" : "inactive"}
                          label={u.status}
                        />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[var(--foreground)] block">
                          {u.code || u.id}
                        </span>
                        {u.code && (
                          <span className="text-[10px] text-[var(--muted)] font-mono block">
                            {u.id}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono text-[11px] text-[var(--muted)]">
                        {new Date(u.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-4 py-3 border-t border-[var(--card-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[var(--muted)]">
                Showing <strong className="text-[var(--foreground)] font-semibold">{startIndex}–{endIndex}</strong> of <strong className="text-[var(--foreground)] font-semibold">{totalItems}</strong>
              </span>
              <div className="flex items-center gap-1.5 text-[var(--muted)]">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-7 px-2 text-xs rounded-md border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  aria-label="Rows per page"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)] font-mono text-[11px]">
                Page {validCurrentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Prev</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
