import { getKitchenByIdAsFounder } from "@/server/actions/kitchen";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderShell } from "@/components/layout/FounderShell";
import {
  ArrowLeft,
  MapPin,
  ChefHat,
  ClipboardList,
  TrendingUp,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function KitchenDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getKitchenByIdAsFounder(id);

  if (!res.success) {
    notFound();
  }

  const kitchen = res.data;

  const actions = [
    {
      href: `/kitchen/${id}/morning`,
      title: "Morning Cooking Plan",
      description: "Generate baseline recommendations and approve today’s kitchen cooking plan",
      icon: <ChefHat className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
      badge: "Morning Workflow",
    },
    {
      href: `/kitchen/${id}/closeout`,
      title: "Evening Meal Closeout",
      description: "Record actual cooked quantities, unserved leftovers, and stockouts",
      icon: <ClipboardList className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
      badge: "Evening Workflow",
    },
    {
      href: `/kitchen/${id}/forecast`,
      title: "Forecast & Learning",
      description: "Review historical observation stats and generate next-day pure baseline forecast",
      icon: <TrendingUp className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
      badge: "Model Health",
    },
    {
      href: `/founder/monitoring/${id}`,
      title: "Monitoring & Audit Log",
      description: "Granular chronological log of all historical observations and quality flags",
      icon: <Activity className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
      badge: "Audit Data",
    },
  ];

  return (
    <FounderShell
      title={kitchen.name}
      subtitle="Facility operational hub and station telemetry"
    >
      <Link
        href="/founder/kitchens"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to search</span>
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {kitchen.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{kitchen.location || "Location: Not provided"}</span>
          </span>
          <StatusBadge
            status={kitchen.status === "ACTIVE" ? "active" : "inactive"}
            label={kitchen.status}
          />
          <span>•</span>
          <span className="font-medium text-foreground">
            Contractor: {kitchen.contractorName}
          </span>
          {kitchen.contractorCode && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">
              Contractor ID: {kitchen.contractorCode}
            </span>
          )}
          <span>•</span>
          <span className="font-mono text-muted-foreground">ID: {kitchen.id}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {actions.map((a) => (
          <Card
            key={a.href}
            className="border-border hover:border-foreground/30 hover:shadow-sm transition-all p-0 overflow-hidden"
          >
            <Link href={a.href} className="p-6 flex flex-col justify-between h-full group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    {a.icon}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {a.badge}
                  </span>
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {a.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {a.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-medium text-primary">
                <span>Launch station</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </FounderShell>
  );
}
