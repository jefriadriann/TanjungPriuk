import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedControls,ritExportData,ritPrintHtml,ritReportScope} from '../public/rit-export.mjs';
const mk=(id,{plate='B 9794 TM',date='2026-11-01',rit=6,closed=null,description='CCIS',...rest}={})=>({id,plate,date,name:'Uang Jalan 5 Rit',target:5,rate:200000,payments:[{amount:1000000}],proofs:[],actuals:[{description,rit,date}],closed,...rest});
test('PDF and print selection follows vehicle, funding period, status, and sorts without mutating stored records',()=>{
 const state={packages:[mk('older',{date:'2026-10-01'}),mk('closed',{closed:{balance:0}}),mk('other',{plate:'B 9322 UOM'}),mk('selected',{date:'2026-11-02'})]},before=structuredClone(state);
 const filters={plate:'B 9794 TM',period:'2026-11',status:'active'},packages=selectedControls(state,filters);
 assert.deepEqual(packages.map(p=>p.id),['selected']);assert.deepEqual(state,before);
 assert.equal(selectedControls(state,{status:'all'}).length,4);assert.deepEqual(selectedControls(state,{status:'closed'}).map(p=>p.id),['closed']);assert.equal(selectedControls(state,{period:'2027-01'}).length,0);
 assert.equal(ritReportScope(filters),'B 9794 TM · November 2026 · Aktif');
});
test('export uses the same signed summary and rates as Kontrol Rit',()=>{
 const state={packages:[mk('a'),mk('b',{rit:5}),mk('c')]},data=ritExportData({packages:state.packages,state,scope:'Test'});
 assert.deepEqual(data.summary,[['Uang jalan diterima','Rp 3.000.000'],['Rit selesai','17 rit'],['Rit lebih','2 rit'],['Kekurangan dana','Rp 400.000']]);assert.equal(data.orders[0].rit,17);assert.match(data.body[0][5],/200.000/);
});
test('reports contain all orders and all matching records, not the last three notes or the current page',()=>{
 const actuals=Array.from({length:8},(_,i)=>({description:'Order '+i,date:'2026-11-01',rit:1})),state={packages:Array.from({length:60},(_,i)=>mk('control-'+i,{actuals}))},data=ritExportData({packages:state.packages,state,scope:'All'});
 assert.equal(data.body.length,60);assert.match(data.body[0][1],/Order 0/);assert.match(data.body[0][1],/Order 7/);assert.equal(data.orders.length,8);assert.equal(data.orders[0].rit,60);
});
test('print includes company logo, scope, summary, verified proofs and safe text without operational buttons',()=>{
 const p=mk('test',{name:'<script>alert(1)</script>',description:'CCIS & Sinergi',proofs:[{date:'2026-11-02',reference:'Proof & test',status:'verified'}]}),state={packages:[p]},html=ritPrintHtml({packages:[p],state,scope:'Test <filter>'});
 assert.match(html,/src="\/brand\/logo-mark.png"/);assert.match(html,/PT JAYA BINTANG TERANG/);assert.match(html,/Test &lt;filter&gt;/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<button|data-rc-action/);assert.match(html,/Proof &amp; test/);assert.match(html,/Kekurangan dana/);
});
test('empty filters produce a valid report with zero totals and no unrelated records',()=>{
 const html=ritPrintHtml({packages:[],state:{packages:[mk('other')]},scope:'No results'});assert.match(html,/Tidak ada catatan sesuai filter/);assert.match(html,/Rp 0/);assert.doesNotMatch(html,/CCIS/);
});
