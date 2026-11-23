import { getKitchenById } from "@/server/actions/kitchen";
import { getServiceDiary } from "@/server/actions/service-diary";
import { ServiceDiaryTimeline } from "@/components/kitchen/ServiceDiaryTimeline";
import { notFound, redirect } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
  searchParams: Promise<{ date?: string; mealType?: string }>;
};

export default async function KitchenDiaryPage({ params, searchParams }: Props) {
  const { kitchenId } = await params;
  const { date, mealType } = await searchParams;

  const kitchenRes = await getKitchenById(kitchenId);
  if (!kitchenRes.success) {
    notFound();
  }

  const diaryRes = await getServiceDiary(kitchenId, date, mealType);
  if (!diaryRes.success) {
    if (diaryRes.statusCode === 401) {
      redirect("/login");
    }
    return (
      <KitchenShell
        kitchenId={kitchenId}
        kitchenName={kitchenRes.data.name}
        title="Service Diary"
        subtitle="Chronological operational timeline for meal planning, execution, closeout, and baseline learning"
      >
        <div className="p-6 text-center text-muted-foreground border rounded-xl bg-card">
          <p className="font-semibold text-foreground">Access Denied</p>
          <p className="text-sm mt-1">{diaryRes.error}</p>
        </div>
      </KitchenShell>
    );
  }

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={kitchenRes.data.name}
      title="Service Diary"
      subtitle="Chronological operational timeline for meal planning, execution, closeout, and baseline learning"
    >
      <ServiceDiaryTimeline initialData={diaryRes.data} kitchenId={kitchenId} />
    </KitchenShell>
  );
}
