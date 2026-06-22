// Even Lab — PDF report via pdfkit (pure JS). Page 1 = the one-pager image,
// page 2 = full worst-offender tables. No headless browser.
import PDFDocument from "pdfkit";
import type { ReportModel } from "./model";

const NAVY = "#1F3864", MUTED = "#6b7280", RED = "#C00000", INK = "#1f2430", LINE = "#e3e8ef";

export function buildPdf(m: ReportModel, png: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: `${m.title} — Lab TAT`, Author: "Even Hospital" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pw = doc.page.width - 72;

    // Page 1 — the visual one-pager
    doc.image(png, 36, 40, { fit: [pw, doc.page.height - 90] });

    // Page 2 — detail tables
    doc.addPage();
    doc.fillColor(NAVY).fontSize(18).font("Helvetica-Bold").text(m.title, { continued: false });
    doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(m.subtitle);
    doc.moveDown(0.5);
    doc.strokeColor(LINE).moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).stroke();
    doc.moveDown(0.8);

    const section = (title: string, rows: ReportModel["topTat1"]) => {
      doc.fillColor(NAVY).fontSize(13).font("Helvetica-Bold").text(title);
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      if (!rows.length) { doc.fillColor(MUTED).text("None."); doc.moveDown(0.6); return; }
      rows.forEach((r) => {
        const yy = doc.y;
        doc.fillColor(RED).font("Helvetica-Bold").text(r.dur, 36, yy, { width: 70 });
        doc.fillColor(INK).font("Helvetica").text(`${r.dept} · ${r.test}`, 110, yy, { width: 330 });
        doc.fillColor(MUTED).text(r.uhid, 450, yy, { width: 90 });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.8);
    };
    section("Slowest TAT 1 (collection → result entry)", m.topTat1);
    section("Slowest TAT 2 (result entry → verification)", m.topTat2);

    doc.moveDown(1);
    doc.strokeColor(LINE).moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor(MUTED).fontSize(8.5).text(m.footer, { width: pw });

    doc.end();
  });
}
