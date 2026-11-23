import { getContractorById } from "@/server/actions/contractor";
import { listKitchensByContractor } from "@/server/actions/kitchen-setup";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivateButton } from "@/components/founder/ActivateButton";
import { EditContractorModal } from "@/components/founder/EditContractorModal";
import { FounderShell } from "@/components/layout/FounderShell";
import {
  ArrowLeft,
  Building2,
  Plus,
  MapPin,
  ChevronRight,
  UtensilsCrossed,
  ExternalLink,
  Users,
  Mail,
  Phone,
  User,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ContractorDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getContractorById(id);

  if (!res.success) {
    notFound();
  }

  const contractor = res.data;
  const kitchensRes = await listKitchensByContractor(id);
  const kitchens = kitchensRes.success ? kitchensRes.data : [];

  return (
    <FounderShell>
      <Link
        href="/founder/contractors"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to contractors</span>
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted border border-border/80 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              {contractor.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-muted text-foreground border border-border">
                Contractor ID: {contractor.code || "Not provided"}
              </span>
              <StatusBadge
                status={contractor.status === "ACTIVE" ? "active" : "inactive"}
                label={contractor.status}
              />
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                Onboarded {contractor.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2 shadow-xs border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--accent-soft)]">
            <a
              href={`/api/contractor/${contractor.id}/weekly-report.pdf`}
              download={`CookCue-Weekly-Report-${contractor.code || "CTR"}.pdf`}
              title="Download 7-day operational kitchen report as PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Download weekly PDF</span>
            </a>
          </Button>
          <EditContractorModal contractor={contractor} />
          <Button asChild variant="outline" size="sm" className="gap-2 shadow-xs border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--accent-soft)]">
            <Link href={`/contractor/${contractor.id}`}>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Open contractor portal</span>
            </Link>
          </Button>
          {contractor.status === "PENDING" && (
            <ActivateButton contractorId={contractor.id} />
          )}
        </div>
      </div>

      {/* Organization Record Details */}
      <Card className="border-border shadow-xs p-5 mb-8">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Contractor ID
            </span>
            <span className="font-mono text-foreground text-sm font-bold">
              {contractor.code || "Not provided"}
            </span>
            <span className="text-xs text-foreground/80 font-mono block mt-1">
              System ID: <code className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border select-all">{contractor.id}</code>
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Organization Status
            </span>
            <span className="font-semibold text-foreground text-sm">{contractor.status}</span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Primary Contact
            </span>
            <span className="text-foreground text-sm font-medium">
              {contractor.primaryContactName || "Not provided"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Official Email
            </span>
            <span className="font-mono text-foreground text-xs">
              {contractor.contactEmail || "Not provided"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Contact Phone
            </span>
            <span className="font-mono text-foreground text-xs">
              {contractor.contactPhone || "Not provided"}
            </span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">
              Official Address
            </span>
            <span className="text-foreground text-xs">
              {contractor.address || "Not provided"}
            </span>
          </div>
        </div>
      </Card>

      {/* Provisioned Kitchens */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            Provisioned Kitchens
          </h2>
          <p className="text-xs text-muted-foreground">
            Kitchen facilities operated by this contractor
          </p>
        </div>
        {contractor.status === "ACTIVE" && (
          <Button asChild size="sm" className="gap-2 shadow-xs">
            <Link href={`/founder/contractors/${contractor.id}/kitchens/new`}>
              <Plus className="w-4 h-4" />
              <span>Add Kitchen</span>
            </Link>
          </Button>
        )}
      </div>

      {kitchens.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="w-10 h-10 text-muted-foreground" />}
          title="No kitchens yet"
          description={
            contractor.status === "ACTIVE"
              ? "This contractor is active. Add their first kitchen facility to begin production tracking."
              : "Activate this contractor to begin adding kitchen facilities."
          }
          action={
            contractor.status === "ACTIVE" ? (
              <Button asChild size="sm">
                <Link href={`/founder/contractors/${contractor.id}/kitchens/new`}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add First Kitchen
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 mb-10">
          {kitchens.map((k) => (
            <Card key={k.id} className="border-border hover:border-foreground/30 transition-all p-0">
              <Link
                href={`/founder/kitchens/${k.id}`}
                className="flex items-center justify-between p-5 group"
              >
                <div>
                  <h3 className="font-heading font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                    {k.name}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{k.location || "Location: Not provided"}</span>
                    </span>
                    <StatusBadge
                      status={k.status === "ACTIVE" ? "active" : "inactive"}
                      label={k.status}
                    />
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Associated Organization Users */}
      <div className="mt-10">
        <div className="mb-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            Organization Team Members
          </h2>
          <p className="text-xs text-muted-foreground">
            Personnel assigned to {contractor.name}
          </p>
        </div>

        {contractor.users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10 text-muted-foreground" />}
            title="No assigned personnel"
            description="No users are currently assigned to this contractor organization."
          />
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {contractor.users.map((u) => (
              <Card key={u.id} className="border-border p-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-semibold text-foreground truncate">
                      {u.name || "Not provided"}
                    </div>
                    <div className="text-muted-foreground font-mono truncate">{u.email}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-border">
                        {u.role}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        User ID: {u.code || "Not provided"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </FounderShell>
  );
}
