// Even Lab — self-contained interactive HTML report (Chart.js via CDN).
import type { ReportModel } from "./model";

export function buildHtml(m: ReportModel): string {
  const data = {
    title: m.title, subtitle: m.subtitle,
    kpis: m.kpis,
    dept: { labels: m.deptRates.map((d) => d.dept), t1: m.deptRates.map((d) => d.t1), t2: m.deptRates.map((d) => d.t2) },
    mix: { labels: m.statusMix.map((s) => s.dept), normal: m.statusMix.map((s) => s.normal), warning: m.statusMix.map((s) => s.warning), critical: m.statusMix.map((s) => s.critical) },
    trend: m.trend ?? null,
    top1: m.topTat1, top2: m.topTat2, footer: m.footer,
  };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(m.title)} — Even Lab</title>
<style>
:root{--navy:#1F3864;--blue:#2E75B6;--green:#548235;--amber:#BF8F00;--red:#C00000;--ink:#1f2430;--muted:#6b7280;--line:#e3e8ef;--bg:#eef1f6;--card:#fff}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:var(--ink);background:var(--bg)}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:24px;color:var(--navy);margin:0}.sub{color:var(--muted);font-size:13px;margin:4px 0 0;border-bottom:3px solid var(--blue);padding-bottom:12px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px}
.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase}.kpi .v{font-size:24px;font-weight:700;color:var(--navy);margin-top:5px}.kpi .n{font-size:11px;color:var(--muted);margin-top:3px}
.kpi.red .v{color:var(--red)}.kpi.amber .v{color:var(--amber)}.kpi.green .v{color:var(--green)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:15px;margin-bottom:16px}
.card h3{margin:0 0 10px;font-size:15px;color:var(--navy)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.chartbox{position:relative;height:300px}table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:6px 8px;border-bottom:1px solid var(--line)}td.dur{font-weight:700;color:var(--red)}
.foot{color:var(--muted);font-size:12px;margin-top:24px;border-top:1px solid var(--line);padding-top:12px}
@media(max-width:820px){.kpis{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>${esc(m.title)}</h1><div class="sub">${esc(m.subtitle)}</div>
<div class="kpis" id="kpis"></div>
<div class="grid2">
<div class="card"><h3>Delayed-test rate by department</h3><div class="chartbox"><canvas id="dr"></canvas></div></div>
<div class="card"><h3>Status mix — collection → entry</h3><div class="chartbox"><canvas id="mx"></canvas></div></div>
</div>
${m.trend ? '<div class="card"><h3>Through the month — daily delayed rate &amp; volume</h3><div class="chartbox"><canvas id="tr"></canvas></div></div>' : ""}
<div class="grid2">
<div class="card"><h3>Slowest TAT 1 (collection → entry)</h3><div id="o1"></div></div>
<div class="card"><h3>Slowest TAT 2 (entry → verification)</h3><div id="o2"></div></div>
</div>
<div class="foot" id="foot"></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
var D=${JSON.stringify(data)};
var C={navy:"#1F3864",blue:"#2E75B6",lblue:"#9DC3E6",green:"#548235",amber:"#BF8F00",red:"#C00000"};
document.getElementById('kpis').innerHTML=D.kpis.map(function(k){return '<div class="kpi '+(k.sev||'')+'"><div class="l">'+k.label+'</div><div class="v">'+k.value+'</div><div class="n">'+k.note+'</div></div>'}).join('');
document.getElementById('foot').textContent=D.footer;
function tbl(id,rows){document.getElementById(id).innerHTML= rows.length? '<table><thead><tr><th>Duration</th><th>Dept</th><th>Test</th><th>UHID</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td class="dur">'+r.dur+'</td><td>'+r.dept+'</td><td>'+r.test+'</td><td>'+r.uhid+'</td></tr>'}).join('')+'</tbody></table>':'<p style="color:#6b7280;font-size:13px">None.</p>';}
tbl('o1',D.top1);tbl('o2',D.top2);
new Chart(document.getElementById('dr'),{type:'bar',data:{labels:D.dept.labels,datasets:[{label:'TAT 1',data:D.dept.t1,backgroundColor:C.blue},{label:'TAT 2',data:D.dept.t2,backgroundColor:C.navy}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,max:100,ticks:{callback:function(v){return v+'%'}}}},plugins:{legend:{position:'top'}}}});
new Chart(document.getElementById('mx'),{type:'bar',data:{labels:D.mix.labels,datasets:[{label:'On-time',data:D.mix.normal,backgroundColor:C.green},{label:'Borderline',data:D.mix.warning,backgroundColor:C.amber},{label:'Delayed',data:D.mix.critical,backgroundColor:C.red}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,max:100,ticks:{callback:function(v){return v+'%'}}},y:{stacked:true}},plugins:{legend:{position:'top'}}}});
if(D.trend){new Chart(document.getElementById('tr'),{data:{labels:D.trend.labels,datasets:[{type:'line',label:'TAT1 delayed %',data:D.trend.delayed,borderColor:C.red,borderDash:[5,3],yAxisID:'y',tension:.3,pointRadius:2},{type:'bar',label:'Tests/day',data:D.trend.volume,backgroundColor:'rgba(157,195,230,.5)',yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{position:'left',max:100,beginAtZero:true,ticks:{callback:function(v){return v+'%'}}},y1:{position:'right',beginAtZero:true,grid:{drawOnChartArea:false}}},plugins:{legend:{position:'top'}}}});}
</script></body></html>`;
}

function esc(s: string) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
