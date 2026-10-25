import test from 'node:test';
import assert from 'node:assert/strict';
import {reportTrend,trendNarrative,renderReportTrend} from '../public/report-trend.mjs';
const row=(date,type,value,plate='A')=>({date,period:'',plate,type,income:type==='Pemasukan'?value:0,expense:type==='Pengeluaran'?value:0});
test('report trend follows three calendar months across years and truck scope',()=>{
 const state={transactions:[row('2025-11-02','Pemasukan',100),row('2025-12-02','Pengeluaran',40),row('2026-01-02','Pemasukan',200),row('2026-01-03','Pemasukan',900,'B'),{...row(null,'Pemasukan',999),period:'November–Desember 2025'}]};
 const points=reportTrend(state,'2026-01','A');
 assert.deepEqual(points.map(p=>p.month),['2025-11','2025-12','2026-01']);assert.deepEqual(points.map(p=>p.income),[100,0,200]);assert.equal(points[1].expense,40);assert.equal(reportTrend(state,'2026-01')[2].income,1100);
});
test('missing periods and unknown nominal stay gaps; genuine zero remains zero',()=>{
 const points=reportTrend({transactions:[row('2026-09-02','Pemasukan',null),row('2026-10-02','Pemasukan',0)]},'2026-10');
 assert.equal(points[0].income,null);assert.equal(points[1].income,null);assert.equal(points[2].income,0);assert.match(trendNarrative(points),/belum lengkap/);assert.doesNotMatch(renderReportTrend(points),/NaN|Infinity/);
});
test('narrative compares actual changes without percentages from zero or incomplete totals',()=>{
 const state={transactions:[row('2026-09-02','Pemasukan',100),row('2026-10-02','Pemasukan',150),row('2026-09-02','Pengeluaran',80),row('2026-10-02','Pengeluaran',40)]};
 const points=reportTrend(state,'2026-10');assert.match(trendNarrative(points),/meningkat 50%/);assert.match(trendNarrative(points),/menurun 50%/);
 points[1].income=0;assert.doesNotMatch(trendNarrative(points),/Infinity|meningkat/);points[1].incomeMissing=true;assert.match(trendNarrative(points),/belum lengkap/);
});
