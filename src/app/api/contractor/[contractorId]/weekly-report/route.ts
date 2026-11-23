import { NextRequest } from "next/server";
import { requireContractorAccess } from "@/lib/auth/session";
import { getContractorWeeklyScorecard } from "@/server/actions/scorecard";
import { generateWeeklyScorecardPdfBuffer } from "@/lib/pdf/weekly-report";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const { contractorId } = await params;

  // 1. Multi-tenant authorization check: must have contractor access or be founder
  const auth = await requireContractorAccess(contractorId);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.statusCode || 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Optional query parameter for weekEndingDate
  const searchParams = request.nextUrl.searchParams;
  const weekEndingDate = searchParams.get("date") || searchParams.get("weekEndingDate") || undefined;

  // 3. Load authoritative scorecard data
  const scorecardRes = await getContractorWeeklyScorecard(contractorId, weekEndingDate);
  if (!scorecardRes.success) {
    return new Response(JSON.stringify({ error: scorecardRes.error }), {
      status: scorecardRes.statusCode || 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const scorecard = scorecardRes.data;

  // 4. Generate PDF buffer
  try {
    const pdfBuffer = await generateWeeklyScorecardPdfBuffer(scorecard);

    const safeCode = scorecard.contractor.code || "CTR";
    const filename = `CookCue-Weekly-Report-${safeCode}-${scorecard.weekEnd}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[PDF Export Error]", err);
    return new Response(
      JSON.stringify({ error: "Failed to render PDF document" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
