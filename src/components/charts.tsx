"use client";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const NAVY = "#1F3864", BLUE = "#2E75B6", LBLUE = "#9DC3E6", GREEN = "#548235", AMBER = "#BF8F00", RED = "#C00000";

export function DelayRateChart({
  labels, tat1, tat2,
}: { labels: string[]; tat1: (number | null)[]; tat2: (number | null)[] }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: "Collection → entry (TAT 1)", data: tat1 as number[], backgroundColor: BLUE, borderRadius: 3 },
          { label: "Entry → verification (TAT 2)", data: tat2 as number[], backgroundColor: NAVY, borderRadius: 3 },
        ],
      }}
      options={{
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw == null ? "no flag" : c.raw + "%"}` } },
        },
      }}
    />
  );
}

export function StatusMixChart({
  labels, normal, warning, critical,
}: { labels: string[]; normal: number[]; warning: number[]; critical: number[] }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: "On-time", data: normal, backgroundColor: GREEN },
          { label: "Borderline", data: warning, backgroundColor: AMBER },
          { label: "Delayed", data: critical, backgroundColor: RED },
        ],
      }}
      options={{
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(Number(c.raw))}%` } },
        },
      }}
    />
  );
}

// Within-month daily trend: test volume (bars-as-area via fill line) + TAT1 delayed % (line), dual axis.
export function TrendChart({
  labels, volume, delayedPct,
}: { labels: string[]; volume: number[]; delayedPct: (number | null)[] }) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          { label: "Tests/day", data: volume, borderColor: LBLUE, backgroundColor: "rgba(157,195,230,0.25)",
            yAxisID: "yVol", fill: true, tension: 0.3, pointRadius: 2 },
          { label: "TAT 1 delayed %", data: delayedPct as number[], borderColor: RED, backgroundColor: RED,
            yAxisID: "yPct", tension: 0.3, pointRadius: 2, borderDash: [5, 3] },
        ],
      }}
      options={{
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          yVol: { type: "linear", position: "left", beginAtZero: true, title: { display: true, text: "tests" } },
          yPct: { type: "linear", position: "right", beginAtZero: true, max: 100,
            grid: { drawOnChartArea: false }, ticks: { callback: (v) => `${v}%` }, title: { display: true, text: "% delayed" } },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => c.dataset.label === "TAT 1 delayed %"
            ? `delayed: ${c.raw == null ? "–" : c.raw + "%"}` : `tests: ${c.raw}` } },
        },
      }}
    />
  );
}
