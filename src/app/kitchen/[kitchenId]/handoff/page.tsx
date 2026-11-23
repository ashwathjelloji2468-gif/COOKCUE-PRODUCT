import { getKitchenById } from "@/server/actions/kitchen";
import { getShiftHandoffSummary } from "@/server/actions/shift-handoff";
import { ShiftHandoffClient } from "@/components/kitchen/ShiftHandoffClient";
import { notFound, redirect } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
  searchParams: Promise<{ date?: string; mealType?: string }>;
};

export default async function KitchenShiftHandoffPage({ params, searchParams }: Props) {
  const { kitchenId } = await params;
  const { date, mealType } = await searchParams;

  const kitchenRes = await getKitchenById(kitchenId);
  if (!kitchenRes.success) {
    notFound();
  }

  const handoffRes = await getShiftHandoffSummary(kitchenId, date, mealType);
  if (!handoffRes.success) {
    if (handoffRes.statusCode === 401) {
      redirect("/login");
    }
    return (
      <KitchenShell
        kitchenId={kitchenId}
        kitchenName={kitchenRes.data.name}
        title="Shift Handoff Summary"
        subtitle="Fast 30-second situational handoff for the incoming shift"
      >
        <div className="p-6 text-center text-muted-foreground border rounded-xl bg-card">
          <p className="font-semibold text-foreground">Access Denied</p>
          <p className="text-sm mt-1">{handoffRes.error}</p>
        </div>
      </KitchenShell>
    );
  }

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={kitchenRes.data.name}
      title="Shift Handoff Summary"
      subtitle="Fast 30-second situational handoff for the incoming shift"
    >
      <ShiftHandoffClient initialData={handoffRes.data} kitchenId={kitchenId} />
    </KitchenShell>
  );
}
