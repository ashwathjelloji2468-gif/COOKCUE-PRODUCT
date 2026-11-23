import { getStaffBoardData } from "@/server/actions/staff-board";
import { StaffBoardClient } from "@/components/kitchen/StaffBoardClient";
import { notFound, redirect } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  params: Promise<{ kitchenId: string }>;
  searchParams?: Promise<{ date?: string; mealType?: string }>;
};

export default async function StaffBoardPage({ params, searchParams }: Props) {
  const { kitchenId } = await params;
  const sParams = searchParams ? await searchParams : {};
  const res = await getStaffBoardData(kitchenId, sParams.date, sParams.mealType);

  if (!res.success) {
    if (res.statusCode === 404) {
      notFound();
    }
    if (res.statusCode === 401) {
      redirect("/login");
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <Card className="max-w-md w-full border-border p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="font-heading font-bold text-lg">Access Denied</h1>
          <p className="text-xs text-muted-foreground">{res.error}</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Return to Sign In</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const data = res.data;

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={data.kitchen.name}
      title="Staff Board"
      subtitle={`Operational station view: approved targets, personnel, and task reports for ${data.kitchen.name}`}
    >
      <StaffBoardClient initialData={data} kitchenId={kitchenId} />
    </KitchenShell>
  );
}
