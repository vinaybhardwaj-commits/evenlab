"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const NAVY = "#1F3864", BLUE = "#2E75B6", GREEN = "#548235", AMBER = "#BF8F00", RED = "#C00000";

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
