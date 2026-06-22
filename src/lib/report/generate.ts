// Even Lab — generate report artifacts on demand and cache them in `files`.
import { getPool } from "../db/client";
import { buildDailyModel, buildMonthlyModel } from "./model";
import { buildReportSvg } from "./svg";
import { svgToPng } from "./png";
import { buildPdf } from "./pdf";
import { buildHtml } from "./html";
import { buildPptx } from "./pptx";

export interface Artifact { filename: string; mime: string; bytes: Buffer; inline?: boolean }

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  html: "text/html; charset=utf-8",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const KIND: Record<string, string> = {
  "daily:pdf": "daily_pdf", "daily:png": "daily_png", "daily:html": "daily_html",
  "monthly:pptx": "monthly_pptx", "monthly:pdf": "monthly_pdf", "monthly:png": "monthly_png",
};

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isMonth = (s: string) => /^\d{4}-\d{2}$/.test(s);

export async function getReport(scope: "daily" | "monthly", key: string, fmt: string): Promise<Artifact | null> {
  const kind = KIND[`${scope}:${fmt}`];
  if (!kind) return null;
  const pool = getPool();

  // cache lookup
  const where = scope === "daily" ? "report_date = $2::date" : "month = ($2 || '-01')::date";
  const cached = await pool.query<{ filename: string; bytes: Buffer }>(
    `SELECT filename, bytes FROM files WHERE kind = $1 AND ${where} ORDER BY id DESC LIMIT 1`,
    [kind, key],
  );
  if (cached.rows[0]) {
    return { filename: cached.rows[0].filename, mime: MIME[fmt], bytes: cached.rows[0].bytes, inline: fmt === "html" };
  }

  // build
  const model = scope === "daily" ? await buildDailyModel(key) : await buildMonthlyModel(key);
  if (!model) return null;

  let bytes: Buffer;
  if (fmt === "html") bytes = Buffer.from(buildHtml(model), "utf8");
  else if (fmt === "pptx") bytes = await buildPptx(model);
  else if (fmt === "png") bytes = svgToPng(buildReportSvg(model));
  else if (fmt === "pdf") bytes = await buildPdf(model, svgToPng(buildReportSvg(model)));
  else return null;

  const filename = `Lab-TAT-${key}.${fmt}`;
  const cols = scope === "daily"
    ? `(kind, filename, mime, bytes, size_bytes, report_date) VALUES ($1,$2,$3,$4,$5,$6::date)`
    : `(kind, filename, mime, bytes, size_bytes, month) VALUES ($1,$2,$3,$4,$5,($6 || '-01')::date)`;
  await pool.query(`INSERT INTO files ${cols}`, [kind, filename, MIME[fmt], bytes, bytes.length, key]).catch(() => {});

  return { filename, mime: MIME[fmt], bytes, inline: fmt === "html" };
}
