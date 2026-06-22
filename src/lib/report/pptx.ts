// Even Lab — monthly BRM deck via pptxgenjs (pure JS, native editable charts).
import pptxgen from "pptxgenjs";
import type { ReportModel } from "./model";

const NAVY = "1F3864", BLUE = "2E75B6", GREEN = "548235", AMBER = "BF8F00", RED = "C00000", MUTED = "6b7280", INK = "1f2430";

export async function buildPptx(m: ReportModel): Promise<Buffer> {
  const p = new pptxgen();
  p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
  p.layout = "W";
  p.author = "Even Hospital";

  // Slide 1 — title
  const s1 = p.addSlide();
  s1.background = { color: "F5F7FB" };
  s1.addText("Laboratory TAT — Monthly Review", { x: 0.6, y: 2.4, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY });
  s1.addText(m.title, { x: 0.6, y: 3.3, w: 12, h: 0.6, fontSize: 22, color: BLUE });
  s1.addText(m.subtitle, { x: 0.6, y: 3.95, w: 12, h: 0.4, fontSize: 13, color: MUTED });

  // Slide 2 — KPIs + delayed rate by dept
  const s2 = p.addSlide(); s2.background = { color: "FFFFFF" };
  s2.addText("Headline metrics", { x: 0.5, y: 0.35, w: 12, h: 0.5, fontSize: 22, bold: true, color: NAVY });
  m.kpis.forEach((k, i) => {
    const x = 0.5 + i * 2.5;
    s2.addShape(p.ShapeType.roundRect, { x, y: 1.05, w: 2.3, h: 1.4, fill: { color: "F2F5FA" }, line: { color: "E3E8EF" }, rectRadius: 0.08 });
    s2.addText(k.label.toUpperCase(), { x: x + 0.12, y: 1.15, w: 2.05, h: 0.3, fontSize: 9, color: MUTED });
    s2.addText(k.value, { x: x + 0.12, y: 1.45, w: 2.05, h: 0.55, fontSize: 24, bold: true, color: k.sev === "red" ? RED : k.sev === "amber" ? AMBER : NAVY });
    s2.addText(k.note, { x: x + 0.12, y: 2.05, w: 2.05, h: 0.3, fontSize: 9, color: MUTED });
  });
  s2.addText("Delayed-test rate by department (% Critical)", { x: 0.5, y: 2.7, w: 12, h: 0.4, fontSize: 14, bold: true, color: NAVY });
  if (m.deptRates.length) {
    s2.addChart(p.ChartType.bar, [
      { name: "TAT 1", labels: m.deptRates.map((d) => d.dept), values: m.deptRates.map((d) => d.t1 ?? 0) },
      { name: "TAT 2", labels: m.deptRates.map((d) => d.dept), values: m.deptRates.map((d) => d.t2 ?? 0) },
    ], { x: 0.5, y: 3.15, w: 12.3, h: 3.9, barDir: "col", chartColors: [BLUE, NAVY], showLegend: true, legendPos: "t", valAxisMaxVal: 100, valAxisMinVal: 0, showValue: false, catAxisLabelFontSize: 10 });
  }

  // Slide 3 — status mix + trend
  const s3 = p.addSlide(); s3.background = { color: "FFFFFF" };
  s3.addText("Status mix & monthly trend", { x: 0.5, y: 0.35, w: 12, h: 0.5, fontSize: 22, bold: true, color: NAVY });
  if (m.statusMix.length) {
    s3.addChart(p.ChartType.bar, [
      { name: "On-time", labels: m.statusMix.map((s) => s.dept), values: m.statusMix.map((s) => s.normal) },
      { name: "Borderline", labels: m.statusMix.map((s) => s.dept), values: m.statusMix.map((s) => s.warning) },
      { name: "Delayed", labels: m.statusMix.map((s) => s.dept), values: m.statusMix.map((s) => s.critical) },
    ], { x: 0.5, y: 1.0, w: 6.1, h: 5.6, barDir: "bar", barGrouping: "percentStacked", chartColors: [GREEN, AMBER, RED], showLegend: true, legendPos: "t", catAxisLabelFontSize: 9 });
  }
  if (m.trend && m.trend.labels.length) {
    s3.addChart(p.ChartType.line, [
      { name: "TAT 1 delayed %", labels: m.trend.labels, values: m.trend.delayed.map((v) => v ?? 0) },
    ], { x: 6.9, y: 1.0, w: 5.9, h: 5.6, chartColors: [RED], showLegend: true, legendPos: "t", valAxisMaxVal: 100, valAxisMinVal: 0, lineSmooth: true, catAxisLabelFontSize: 8 });
  }

  // Slide 4 — worst offenders
  const s4 = p.addSlide(); s4.background = { color: "FFFFFF" };
  s4.addText("Worst offenders", { x: 0.5, y: 0.35, w: 12, h: 0.5, fontSize: 22, bold: true, color: NAVY });
  const mkTable = (rows: ReportModel["topTat1"]): any[][] => {
    const out: any[][] = [
      ["Duration", "Dept", "Test", "UHID"].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 } })),
    ];
    if (!rows.length) { out.push([{ text: "None", options: { fontSize: 9, color: MUTED } }, { text: "" }, { text: "" }, { text: "" }]); return out; }
    for (const r of rows.slice(0, 8)) {
      out.push([
        { text: r.dur, options: { color: RED, bold: true, fontSize: 9 } },
        { text: r.dept, options: { color: INK, fontSize: 9 } },
        { text: r.test, options: { color: INK, fontSize: 9 } },
        { text: r.uhid, options: { color: MUTED, fontSize: 9 } },
      ]);
    }
    return out;
  };
  s4.addText("Slowest TAT 1 (collection → entry)", { x: 0.5, y: 1.0, w: 6, h: 0.3, fontSize: 12, bold: true, color: NAVY });
  s4.addTable(mkTable(m.topTat1) as any, { x: 0.5, y: 1.35, w: 6.1, colW: [1.0, 1.5, 2.5, 1.1], border: { type: "solid", color: "E3E8EF", pt: 0.5 } });
  s4.addText("Slowest TAT 2 (entry → verification)", { x: 6.9, y: 1.0, w: 6, h: 0.3, fontSize: 12, bold: true, color: NAVY });
  s4.addTable(mkTable(m.topTat2) as any, { x: 6.9, y: 1.35, w: 5.9, colW: [1.0, 1.4, 2.4, 1.1], border: { type: "solid", color: "E3E8EF", pt: 0.5 } });
  s4.addText(m.footer, { x: 0.5, y: 6.9, w: 12.3, h: 0.5, fontSize: 8, color: MUTED });

  const out = (await p.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
