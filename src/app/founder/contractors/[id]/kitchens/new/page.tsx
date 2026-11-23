import { getContractorById } from "@/server/actions/contractor";
import { CreateKitchenForm } from "@/components/founder/CreateKitchenForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderShell } from "@/components/layout/FounderShell";
import {
  ArrowLeft,
  UtensilsCrossed,
  Clock,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewKitchenPage({ params }: Props) {
  const { id } = await params;
  const res = await getContractorById(id);

  if (!res.success) {
    notFound();
  }

  const contractor = res.data;

  return (
    <FounderShell title="Add Kitchen Facility" subtitle={`Provision station for ${contractor.name}`}>
      <div className="max-w-5xl">
        <Link
          href={`/founder/contractors/${contractor.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to contractor</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-7">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-base font-heading font-bold text-foreground">
                  Facility Specifications
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Register a production kitchen or dining hall station for this contractor.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <CreateKitchenForm contractorId={contractor.id} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Guidance Side Panel */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border shadow-xs bg-muted/30 dark:bg-muted/10">
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm font-heading font-bold text-foreground">
                    Facility Setup &amp; Eligibility
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Key operational principles for this facility
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4 text-xs">
                {/* Guidance 1: Meal Sessions */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-background border border-border text-foreground shrink-0 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground block">
                      Automated Meal Cutoffs
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Breakfast, Lunch, and Dinner planning forms lock based on facility timezone to prevent late batch modifications.
                    </p>
                  </div>
                </div>

                {/* Guidance 2: Closeout Auditing */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-background border border-border text-foreground shrink-0 shadow-2xs">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground block">
                      Daily Service Closeouts
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Head cooks record actual diners, cooked kg, and unserved leftovers each evening to populate facility telemetry.
                    </p>
                  </div>
                </div>

                {/* Guidance 3: Baseline Eligibility */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-background border border-border text-foreground shrink-0 shadow-2xs">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground block">
                      Continuous Learning Models
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Consecutive valid observations automatically mark dishes eligible for variance-weighted daily portion forecasting.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-border bg-card text-xs space-y-1.5">
              <span className="font-semibold text-foreground block">Next Steps After Provisioning</span>
              <p className="text-muted-foreground leading-relaxed">
                Once added, you can assign Head Cooks and staff members to this kitchen from the <strong className="text-foreground">Users Directory</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FounderShell>
  );
}
