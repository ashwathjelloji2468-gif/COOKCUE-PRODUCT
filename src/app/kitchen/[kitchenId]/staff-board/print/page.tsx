import { getStaffBoardPrintData } from "@/server/actions/staff-board";
import { StaffBoardPrintClient } from "@/components/kitchen/StaffBoardPrintClient";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  params: Promise<{ kitchenId: string }>;
  searchParams?: Promise<{ date?: string; mealType?: string; autoprint?: string }>;
};

export default async function StaffBoardPrintPage({ params, searchParams }: Props) {
  const { kitchenId } = await params;
  const sParams = searchParams ? await searchParams : {};
  const res = await getStaffBoardPrintData(kitchenId, sParams.date, sParams.mealType);

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

  return (
    <StaffBoardPrintClient
      data={res.data}
      autoPrint={sParams.autoprint === "1"}
    />
  );
}
