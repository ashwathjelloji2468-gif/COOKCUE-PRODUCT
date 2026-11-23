import PDFDocument from "pdfkit";
import { ContractorWeeklyScorecard } from "@/lib/domain/scorecard";

/**
 * Generates an operational PDF report summarizing 7-day kitchen discipline
 * for a contractor's assigned facilities.
 *
 * Rules:
 * - Real data only; empty/unclosed facilities show honest zeros / "—".
 * - No fake benchmarks or guaranteed savings claims.
 * - Concise, thermal/print-friendly layout.
 */
export async function generateWeeklyScorecardPdfBuffer(
  scorecard: ContractorWeeklyScorecard
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Standard A4: 595.28 x 841.89 points, 40pt margins -> 515.28pt printable width
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `CookCue Weekly Kitchen Report - ${scorecard.contractor.name}`,
          Author: "CookCue Platform",
          Subject: "Weekly Kitchen Operational Discipline Scorecard",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2; // 515.28pt

      // ==========================================
      // HEADER SECTION
      // ==========================================
      doc.rect(margin, margin, contentWidth, 4).fill("#193D32");

      doc.y = margin + 14;

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#193D32")
        .text("CookCue Weekly Kitchen Report", margin, doc.y);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#556B64")
        .text("Operational Discipline & Data Hygiene Audit · Last 7 Days", margin, doc.y + 2);

      doc.moveDown(0.8);

      // Meta info bar
      const metaY = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#0D221C")
        .text("Contractor Organization:", margin, metaY);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#0D221C")
        .text(scorecard.contractor.name, margin + 130, metaY);

      const codeY = metaY + 14;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#0D221C")
        .text("Organization Code:", margin, codeY);

      doc
        .font("Courier-Bold")
        .fontSize(10)
        .fillColor("#193D32")
        .text(scorecard.contractor.code || "CTR-—", margin + 130, codeY);

      const rangeY = codeY + 14;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#0D221C")
        .text("Evaluation Window:", margin, rangeY);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#0D221C")
        .text(`${scorecard.weekStart} to ${scorecard.weekEnd} (7 days)`, margin + 130, rangeY);

      doc.y = rangeY + 22;

      // Divider line
      doc
        .strokeColor("#D0DCD7")
        .lineWidth(1)
        .moveTo(margin, doc.y)
        .lineTo(margin + contentWidth, doc.y)
        .stroke();

      doc.moveDown(0.8);

      // ==========================================
      // TABLE DEFINITIONS
      // ==========================================
      // Columns total: 125 + 65*6 = 515 pt
      const cols = [
        { label: "Kitchen Facility", width: 125, align: "left" as const },
        { label: "Closeout %", width: 65, align: "right" as const },
        { label: "Approved Plans", width: 65, align: "right" as const },
        { label: "Draft/Missing", width: 65, align: "right" as const },
        { label: "Stockout Days", width: 65, align: "right" as const },
        { label: "Eligible Obs", width: 65, align: "right" as const },
        { label: "Open Issues", width: 65, align: "right" as const },
      ];

      // Draw table header
      const tableStartY = doc.y;
      const headerHeight = 22;

      doc.rect(margin, tableStartY, contentWidth, headerHeight).fill("#E8F0EC");

      let currX = margin;
      for (const col of cols) {
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor("#193D32")
          .text(col.label, currX + 4, tableStartY + 6, {
            width: col.width - 8,
            align: col.align,
          });
        currX += col.width;
      }

      let currY = tableStartY + headerHeight;

      // Draw rows
      if (scorecard.kitchens.length === 0) {
        doc.rect(margin, currY, contentWidth, 30).fill("#FAFAFA");
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor("#666666")
          .text(
            "No operational kitchen facilities provisioned under this contractor organization.",
            margin,
            currY + 10,
            { width: contentWidth, align: "center" }
          );
        currY += 30;
      } else {
        scorecard.kitchens.forEach((k, idx) => {
          const rowHeight = 26;
          const isEven = idx % 2 === 0;

          if (isEven) {
            doc.rect(margin, currY, contentWidth, rowHeight).fill("#F9FBFA");
          }

          let x = margin;

          // 1. Kitchen Name & Location
          doc
            .font("Helvetica-Bold")
            .fontSize(8.5)
            .fillColor("#0D221C")
            .text(k.name, x + 4, currY + 4, {
              width: cols[0].width - 8,
              align: "left",
              ellipsis: true,
            });

          if (k.location) {
            doc
              .font("Helvetica")
              .fontSize(7)
              .fillColor("#666666")
              .text(k.location, x + 4, currY + 15, {
                width: cols[0].width - 8,
                align: "left",
                ellipsis: true,
              });
          }
          x += cols[0].width;

          // 2. Closeout %
          const closeoutText =
            k.closeoutCompliancePct !== null
              ? `${k.closeoutCompliancePct.toFixed(1)}%`
              : "—";
          doc
            .font(k.closeoutCompliancePct !== null && k.closeoutCompliancePct >= 80 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.5)
            .fillColor(
              k.closeoutCompliancePct === null
                ? "#888888"
                : k.closeoutCompliancePct < 60
                ? "#B45309"
                : "#0D221C"
            )
            .text(closeoutText, x + 4, currY + 8, {
              width: cols[1].width - 8,
              align: "right",
            });
          x += cols[1].width;

          // 3. Approved Plans
          doc
            .font("Helvetica")
            .fontSize(8.5)
            .fillColor("#0D221C")
            .text(k.approvedPlansCount.toString(), x + 4, currY + 8, {
              width: cols[2].width - 8,
              align: "right",
            });
          x += cols[2].width;

          // 4. Draft/Missing
          doc
            .font(k.plansDraftOrMissingCount > 0 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.5)
            .fillColor(k.plansDraftOrMissingCount > 0 ? "#B45309" : "#666666")
            .text(k.plansDraftOrMissingCount.toString(), x + 4, currY + 8, {
              width: cols[3].width - 8,
              align: "right",
            });
          x += cols[3].width;

          // 5. Stockout Days
          doc
            .font(k.stockoutDays > 0 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.5)
            .fillColor(k.stockoutDays > 0 ? "#DC2626" : "#666666")
            .text(k.stockoutDays.toString(), x + 4, currY + 8, {
              width: cols[4].width - 8,
              align: "right",
            });
          x += cols[4].width;

          // 6. Eligible Obs
          doc
            .font(k.eligibleObservationCount >= 3 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.5)
            .fillColor(k.eligibleObservationCount >= 3 ? "#047857" : "#0D221C")
            .text(k.eligibleObservationCount.toString(), x + 4, currY + 8, {
              width: cols[5].width - 8,
              align: "right",
            });
          x += cols[5].width;

          // 7. Open Issues
          doc
            .font(k.openExceptionsCount > 0 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.5)
            .fillColor(k.openExceptionsCount > 0 ? "#DC2626" : "#666666")
            .text(k.openExceptionsCount.toString(), x + 4, currY + 8, {
              width: cols[6].width - 8,
              align: "right",
            });

          // Row separator line
          currY += rowHeight;
          doc
            .strokeColor("#E5ECE9")
            .lineWidth(0.5)
            .moveTo(margin, currY)
            .lineTo(margin + contentWidth, currY)
            .stroke();
        });
      }

      // ==========================================
      // SUMMARY KPI TILES
      // ==========================================
      doc.y = currY + 16;

      const totalKitchens = scorecard.kitchens.length;
      const totalApprovedPlans = scorecard.kitchens.reduce((acc, k) => acc + k.approvedPlansCount, 0);
      const totalStockoutDays = scorecard.kitchens.reduce((acc, k) => acc + k.stockoutDays, 0);
      const totalEligibleObs = scorecard.kitchens.reduce((acc, k) => acc + k.eligibleObservationCount, 0);
      const totalOpenIssues = scorecard.kitchens.reduce((acc, k) => acc + k.openExceptionsCount, 0);

      const kpiTiles = [
        { label: "Active Kitchens", value: totalKitchens.toString() },
        { label: "Approved Plans", value: totalApprovedPlans.toString() },
        { label: "Stockout Incidents", value: totalStockoutDays.toString() },
        { label: "Verified Data Points", value: totalEligibleObs.toString() },
        { label: "Open Exceptions", value: totalOpenIssues.toString() },
      ];

      const tileGap = 8;
      const tileWidth = (contentWidth - tileGap * (kpiTiles.length - 1)) / kpiTiles.length;
      const tileHeight = 44;
      const tileY = doc.y;

      kpiTiles.forEach((tile, i) => {
        const tx = margin + i * (tileWidth + tileGap);
        doc.rect(tx, tileY, tileWidth, tileHeight).fill("#F4F7F5");

        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor("#556B64")
          .text(tile.label, tx + 4, tileY + 6, { width: tileWidth - 8, align: "center" });

        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#0D221C")
          .text(tile.value, tx + 4, tileY + 20, { width: tileWidth - 8, align: "center" });
      });

      doc.y = tileY + tileHeight + 20;

      // ==========================================
      // AUDIT NOTES & DISCLOSURE
      // ==========================================
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#193D32")
        .text("Audit & Telemetry Notes:", margin, doc.y);

      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#556B64")
        .text(
          "• Closeout % represents scheduled services with approved plans where physical vessel counts were logged.\n" +
          "• Eligible observations count verified services meeting baseline qualification criteria (no stockouts, unflagged, valid headcounts).\n" +
          "• Open exceptions indicate active operational alerts requiring operational attention (unapproved plans, missing closeouts).\n" +
          "• All figures derived from live operational service records. No synthetic projections or guaranteed savings claimed.",
          margin,
          doc.y,
          { width: contentWidth, lineGap: 2 }
        );

      // ==========================================
      // FOOTER
      // ==========================================
      const footerY = 841.89 - margin - 15;
      doc
        .strokeColor("#D0DCD7")
        .lineWidth(0.5)
        .moveTo(margin, footerY - 8)
        .lineTo(margin + contentWidth, footerY - 8)
        .stroke();

      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#888888")
        .text(
          `Generated at ${timestamp} · Contact: cookcue149@gmail.com · Internal operational review only · Not a financial audit`,
          margin,
          footerY,
          { width: contentWidth, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
