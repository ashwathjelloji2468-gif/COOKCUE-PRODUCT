import { FounderShell } from "@/components/layout/FounderShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SupportInquiryForm } from "@/components/founder/SupportInquiryForm";
import {
  LifeBuoy,
  Mail,
  Clock,
  ShieldAlert,
  Headphones,
  CheckCircle2,
  Send,
  Info,
} from "lucide-react";

export default async function FounderSupportPage() {
  return (
    <FounderShell
      title="Platform Support & Help Desk"
      subtitle="Operator assistance protocols, technical support channels, and facility issue tracking"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <LifeBuoy className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Support Desk Active</span>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Support Overview & Escalation Guidelines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          {/* Card 1: Operator Help Channels */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Operator Assistance Protocols
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Standard support procedures for head cooks, kitchen staff, and contractor admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs text-[var(--muted)]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--foreground)] block">Service Data Adjustments</span>
                  <span>Head cooks can adjust observation inputs with justification notes directly through the daily closeout review workflow.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--foreground)] block">Account &amp; Kitchen Provisioning</span>
                  <span>Contractor admins can provision new kitchens and assign team members via their dedicated organization console.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--foreground)] block">Credential Reissues</span>
                  <span>Platform founders manage credential re-activations and multi-tenant security verification in the User Directory.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Urgent Production Escalation */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Urgent Production Escalation
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Direct contact protocol for system engineering and active meal service downtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                  <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Platform Engineering Dispatch</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Contact platform engineering for urgent production needs, operational downtime, or telemetry relay failures.
                </p>
                <div className="font-mono text-xs text-[var(--accent)] font-semibold select-all">
                  cookcue149@gmail.com
                </div>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Service Window Coverage</span>
                <span className="font-mono text-[var(--foreground)]">Breakfast, Lunch, Dinner</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-[var(--muted)]">Telemetry Monitoring</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-3 h-3" />
                  <span>24/7 Automated Health Checks</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Inquiry Form */}
        <SupportInquiryForm />

        {/* Dispatch Protocol & SLA Information (Replaces unbacked tickets table) */}
        <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)] overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                Direct Dispatch &amp; Resolution SLAs
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[var(--muted)]">
              Real-time dispatch protocol and expected turnaround times for operator inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="p-4 rounded-xl border border-border bg-muted/40 dark:bg-muted/15 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Email-Dispatched Ticket Routing</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Support inquiries submitted through the form above or emailed directly to{" "}
                <span className="font-mono text-foreground font-medium">cookcue149@gmail.com</span> are immediately dispatched to our on-call operations and engineering dispatchers. An in-app persistent ticketing database is planned for upcoming multi-tenant management releases; in the interim, all responses and incident tracking are maintained directly via email correspondence.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-lg border border-border bg-background space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Service Downtime
                </span>
                <span className="text-base font-bold text-foreground font-heading">
                  &lt; 30 Minutes
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Immediate triage during active Breakfast, Lunch, or Dinner service windows.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-background space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Data Adjustments
                </span>
                <span className="text-base font-bold text-foreground font-heading">
                  &lt; 2 Hours
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Observation quantity corrections and historical audit reconciliations.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-background space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Facility Setup
                </span>
                <span className="text-base font-bold text-foreground font-heading">
                  &lt; 1 Business Day
                </span>
                <p className="text-[11px] text-muted-foreground">
                  New contractor organization onboarding and multi-kitchen configuration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FounderShell>
  );
}
