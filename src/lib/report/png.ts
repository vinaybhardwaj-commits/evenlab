// Even Lab — rasterize the report SVG to PNG (serverless-friendly, no browser).
import { Resvg } from "@resvg/resvg-js";

export function svgToPng(svg: string, width = 1500): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true },
    background: "#f5f7fb",
  });
  return Buffer.from(r.render().asPng());
}
