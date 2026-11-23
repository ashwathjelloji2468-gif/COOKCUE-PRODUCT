import { CreateContractorForm } from "@/components/founder/CreateContractorForm";
import Link from "next/link";
import { FounderShell } from "@/components/layout/FounderShell";
import {
  ArrowLeft,
  IdCard,
  UserCheck,
  UtensilsCrossed,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewContractorPage() {
  return (
    <FounderShell
      title="Add New Contractor"
      subtitle="Register an institutional catering contractor organization"
    >
      <div className="max-w-5xl">
        <Link
          href="/founder/contractors"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to contractors</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-7">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-base font-heading font-bold text-foreground">
                  Organization Details
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Enter the commercial contractor information to initiate organization setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <CreateContractorForm />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: What happens next panel */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border shadow-xs bg-muted/30 dark:bg-muted/10">
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm font-heading font-bold text-foreground">
                    What happens next
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Lifecycle steps following organization creation
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5 text-xs">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border border-border font-mono font-bold text-[11px] text-foreground shadow-xs">
                    1
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <IdCard className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Unique Contractor ID Assigned</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      A human-readable permanent identifier (<code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted text-foreground border border-border">CTR-######</code>) is automatically generated.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border border-border font-mono font-bold text-[11px] text-foreground shadow-xs">
                    2
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Activate Contractor When Ready</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Review organization profile and toggle status from pending to active once initial service agreements are verified.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border border-border font-mono font-bold text-[11px] text-foreground shadow-xs">
                    3
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Add Kitchens and Staff</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Provision managed kitchen facilities, assign head cooks and kitchen staff, and configure service cutoff schedules.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assistance / Self-service callout */}
            <div className="p-4 rounded-xl border border-border bg-card text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Self-Service Contractor Application</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Need prospective caterers to apply directly? Send them to the public onboarding portal where they can submit verification documents.
              </p>
              <Link
                href="/onboard"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline pt-1"
              >
                <span>View Public Onboarding Portal</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </FounderShell>
  );
}
