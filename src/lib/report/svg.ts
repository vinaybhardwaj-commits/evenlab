// Even Lab — one-page report as an SVG string (rasterized to PNG; embedded in PDF).
import type { ReportModel } from "./model";

const C = { navy: "#1F3864", blue: "#2E75B6", lblue: "#9DC3E6", green: "#548235", amber: "#BF8F00", red: "#C00000", ink: "#1f2430", muted: "#6b7280", line: "#e3e8ef", card: "#ffffff", bg: "#f5f7fb" };
const W = 1000;
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sevColor = (s?: string) => (s === "red" ? C.red : s === "amber" ? C.amber : s === "green" ? C.green : C.navy);

function txt(x: number, y: number, s: string, o: { size?: number; color?: string; weight?: number; anchor?: string } = {}) {
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${o.size ?? 13}" fill="${o.color ?? C.ink}" font-weight="${o.weight ?? 400}" text-anchor="${o.anchor ?? "start"}">${esc(s)}</text>`;
}
function rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; rx?: number } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 0}" fill="${o.fill ?? "none"}"${o.stroke ? ` stroke="${o.stroke}"` : ""}/>`;
}

export function buildReportSvg(m: ReportModel): string {
  const P = 28;            // page padding
  const cw = W - P * 2;    // content width
  let y = 0;
  const parts: string[] = [];

  // header
  parts.push(txt(P, 46, m.title, { size: 28, weight: 700, color: C.navy }));
  parts.push(txt(P, 68, m.subtitle, { size: 13, color: C.muted }));
  parts.push(`<line x1="${P}" y1="84" x2="${W - P}" y2="84" stroke="${C.blue}" stroke-width="2"/>`);
  y = 104;

  // KPI tiles
  const n = m.kpis.length, gap = 12, tw = (cw - gap * (n - 1)) / n, th = 78;
  m.kpis.forEach((k, i) => {
    const x = P + i * (tw + gap);
    parts.push(rect(x, y, tw, th, { fill: C.card, stroke: C.line, rx: 8 }));
    parts.push(txt(x + 12, y + 22, k.label.toUpperCase(), { size: 10, color: C.muted, weight: 700 }));
    parts.push(txt(x + 12, y + 50, k.value, { size: 24, weight: 700, color: sevColor(k.sev) }));
    parts.push(txt(x + 12, y + 68, k.note, { size: 10, color: C.muted }));
  });
  y += th + 28;

  // Delayed-rate by department (grouped vertical bars)
  parts.push(txt(P, y, "Delayed-test rate by department", { size: 15, weight: 700, color: C.navy }));
  parts.push(txt(P, y + 16, "% flagged Critical · dashed = 30% watch / 50% act", { size: 11, color: C.muted }));
  const chTop = y + 30, chH = 170, chBot = chTop + chH, chL = P + 30, chR = W - P;
  // gridlines + threshold
  [0, 25, 50, 75, 100].forEach((g) => {
    const gy = chBot - (g / 100) * chH;
    parts.push(`<line x1="${chL}" y1="${gy}" x2="${chR}" y2="${gy}" stroke="${C.line}" stroke-width="1"/>`);
    parts.push(txt(chL - 6, gy + 3, g + "%", { size: 9, color: C.muted, anchor: "end" }));
  });
  [[50, C.red], [30, C.amber]].forEach(([v, col]) => {
    const gy = chBot - ((v as number) / 100) * chH;
    parts.push(`<line x1="${chL}" y1="${gy}" x2="${chR}" y2="${gy}" stroke="${col}" stroke-width="1.3" stroke-dasharray="6 4"/>`);
  });
  const dr = m.deptRates.length ? m.deptRates : [{ dept: "—", t1: null, t2: null }];
  const slot = (chR - chL) / dr.length, bw = Math.min(26, slot / 3.2);
  dr.forEach((d, i) => {
    const cx = chL + slot * (i + 0.5);
    const bars: Array<[number | null, string]> = [[d.t1, C.blue], [d.t2, C.navy]];
    bars.forEach(([v, col], bi) => {
      const bx = cx - bw - 3 + bi * (bw + 6);
      if (v == null) { parts.push(txt(bx + bw / 2, chBot - 4, "—", { size: 9, color: C.muted, anchor: "middle" })); return; }
      const bh = (v / 100) * chH;
      parts.push(rect(bx, chBot - bh, bw, bh, { fill: col, rx: 2 }));
      if (v > 0) parts.push(txt(bx + bw / 2, chBot - bh - 4, v + "%", { size: 9, color: C.ink, anchor: "middle", weight: 700 }));
    });
    parts.push(txt(cx, chBot + 16, d.dept.length > 13 ? d.dept.slice(0, 12) + "…" : d.dept, { size: 10, color: C.muted, anchor: "middle" }));
  });
  // legend
  parts.push(rect(chL, chTop - 2, 9, 9, { fill: C.blue }));
  parts.push(txt(chL + 14, chTop + 6, "Collection → entry (TAT 1)", { size: 10, color: C.muted }));
  parts.push(rect(chL + 190, chTop - 2, 9, 9, { fill: C.navy }));
  parts.push(txt(chL + 204, chTop + 6, "Entry → verification (TAT 2)", { size: 10, color: C.muted }));
  y = chBot + 42;

  // Status mix (100% stacked horizontal)
  parts.push(txt(P, y, "Status mix — collection → entry", { size: 15, weight: 700, color: C.navy }));
  parts.push(txt(P, y + 16, "on-time / borderline / delayed", { size: 11, color: C.muted }));
  let sy = y + 30;
  const labW = 130, barX = P + labW, barW = cw - labW - 60;
  const mix = m.statusMix.length ? m.statusMix : [];
  mix.forEach((s) => {
    parts.push(txt(P, sy + 15, s.dept.length > 18 ? s.dept.slice(0, 17) + "…" : s.dept, { size: 11, color: C.ink }));
    let cx = barX;
    ([[s.normal, C.green], [s.warning, C.amber], [s.critical, C.red]] as Array<[number, string]>).forEach(([v, col]) => {
      const w = (v / 100) * barW;
      parts.push(rect(cx, sy, w, 20, { fill: col }));
      cx += w;
    });
    parts.push(txt(barX + barW + 8, sy + 15, Math.round(s.critical) + "% del.", { size: 10, color: C.red, weight: 700 }));
    sy += 28;
  });
  if (!mix.length) { parts.push(txt(P, sy + 12, "No flagged tests.", { size: 11, color: C.muted })); sy += 24; }
  y = sy + 16;

  // Trend (monthly)
  if (m.trend && m.trend.labels.length) {
    parts.push(txt(P, y, "Through the month — daily delayed rate (TAT 1)", { size: 15, weight: 700, color: C.navy }));
    const tTop = y + 14, tH = 120, tBot = tTop + tH, tL = chL, tR = W - P;
    [0, 50, 100].forEach((g) => { const gy = tBot - (g / 100) * tH; parts.push(`<line x1="${tL}" y1="${gy}" x2="${tR}" y2="${gy}" stroke="${C.line}"/>`); parts.push(txt(tL - 6, gy + 3, g + "%", { size: 9, color: C.muted, anchor: "end" })); });
    const pts = m.trend.delayed.map((v, i) => {
      const x = tL + (i / Math.max(1, m.trend!.labels.length - 1)) * (tR - tL);
      const yy = v == null ? tBot : tBot - (v / 100) * tH;
      return `${x.toFixed(1)},${yy.toFixed(1)}`;
    }).join(" ");
    parts.push(`<polyline points="${pts}" fill="none" stroke="${C.red}" stroke-width="2"/>`);
    y = tBot + 26;
  }

  // Worst offenders (two columns, top 5)
  const colW = (cw - 24) / 2;
  const offCol = (x: number, title: string, rows: ReportModel["topTat1"]) => {
    parts.push(txt(x, y, title, { size: 13, weight: 700, color: C.navy }));
    let ry = y + 20;
    (rows.slice(0, 5)).forEach((r) => {
      parts.push(txt(x, ry, r.dur, { size: 11, weight: 700, color: C.red }));
      parts.push(txt(x + 70, ry, `${r.dept} · ${r.test}`.slice(0, 46), { size: 10.5, color: C.ink }));
      ry += 17;
    });
    if (!rows.length) parts.push(txt(x, ry, "None.", { size: 10.5, color: C.muted }));
  };
  offCol(P, "Slowest TAT 1 (collection → entry)", m.topTat1);
  offCol(P + colW + 24, "Slowest TAT 2 (entry → verification)", m.topTat2);
  y += 20 + 5 * 17 + 18;

  // footer
  parts.push(`<line x1="${P}" y1="${y - 6}" x2="${W - P}" y2="${y - 6}" stroke="${C.line}"/>`);
  // wrap footer text
  const words = m.footer.split(" "); let lineStr = "", fy = y + 10;
  for (const w of words) { if ((lineStr + " " + w).length > 130) { parts.push(txt(P, fy, lineStr, { size: 9.5, color: C.muted })); lineStr = w; fy += 13; } else lineStr = lineStr ? lineStr + " " + w : w; }
  parts.push(txt(P, fy, lineStr, { size: 9.5, color: C.muted }));
  const H = fy + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${parts.join("")}</svg>`;
}
