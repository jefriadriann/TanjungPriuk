import {displayPlate,monthLabel,today} from './domain.mjs';
import {packageSummary,controlTotals,completedOrderSummary} from './rit-control-model.mjs';
import {loadExportScript} from './ledger-export.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v).toLocaleString('id-ID'),money=v=>'Rp '+num(v);
const logoPath='/brand/logo-mark.png';
export function selectedControls(state,{plate='all',period='all',status='active'}={}){
 return state.packages.filter(p=>(plate==='all'||p.plate===plate)&&(period==='all'||p.date.slice(0,7)===period)&&(status==='all'||(status==='closed'?Boolean(p.closed):!p.closed))).sort((a,b)=>b.date.localeCompare(a.date)||a.plate.localeCompare(b.plate)||a.id.localeCompare(b.id));
}
export const ritReportScope=({plate='all',period='all',status='active'}={})=>`${plate==='all'?'Semua armada':displayPlate(plate)} · ${period==='all'?'Seluruh periode uang jalan':monthLabel(period)} · ${status==='all'?'Semua status':status==='closed'?'Selesai':'Aktif'}`;
export function ritExportData({packages,state,scope}){
 const totals=controlTotals(packages,state);
 return {scope,headers:['Tanggal / Armada','Uraian dan catatan rit','Uang jalan','Rit selesai / target','Sisa rit / lebih','Sisa / kekurangan dana','Status'],
 summary:[['Uang jalan diterima',money(totals.funded)],['Rit selesai',num(totals.verified)+' rit'],[totals.netRit<0?'Rit lebih':'Sisa rit',num(Math.abs(totals.netRit))+' rit'],[totals.netFunds<0?'Kekurangan dana':'Sisa dana',money(Math.abs(totals.netFunds))]],
 body:packages.map(p=>{const m=packageSummary(p,state),notes=[...(p.actuals||[]).map(x=>`${x.date} · ${x.description} · ${num(x.rit)} rit`),...p.proofs.filter(x=>x.status==='verified').map(x=>`${x.date} · ${x.reference} · 1 rit (terverifikasi)`)];return [p.date+'\n'+displayPlate(p.plate),[p.name,...notes].join('\n'),money(m.funded),`${num(m.verified)} / ${num(p.target)}`,m.excess?'Rit lebih '+num(m.excess):num(m.remaining),m.shortfall?'Kekurangan '+money(m.shortfall):money(m.balance),p.closed?'Selesai':'Aktif'];}),orders:completedOrderSummary(packages)};
}
export function ritPrintHtml(report){
 const d=ritExportData(report);
 return `<header class="rc-print-header"><img src="${logoPath}" alt="Logo PT Jaya Bintang Terang"><div><strong>PT JAYA BINTANG TERANG</strong><h1>Laporan Kontrol Rit</h1><p>${esc(d.scope)}</p><p>${d.body.length} catatan sesuai filter · Dicetak ${today()}</p></div></header><div class="rc-print-summary">${d.summary.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div><table><colgroup><col style="width:15%"><col style="width:30%"><col style="width:12%"><col style="width:10%"><col style="width:9%"><col style="width:16%"><col style="width:8%"></colgroup><thead><tr>${d.headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${d.body.map(row=>`<tr>${row.map((v,i)=>`<td class="${i>=2&&i<=5?'number':''}">${esc(v).replaceAll('\n','<br>')}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="7">Tidak ada catatan sesuai filter.</td></tr>'}</tbody></table><section class="rc-print-orders"><h2>Rekap rit selesai per uraian order</h2><table><thead><tr><th>Uraian order</th><th>Rit selesai</th></tr></thead><tbody>${d.orders.map(x=>`<tr><td>${esc(x.description)}</td><td class="number">${num(x.rit)} rit</td></tr>`).join('')||'<tr><td colspan="2">Belum ada rit selesai sesuai filter.</td></tr>'}</tbody></table></section><p>Periode mengikuti tanggal uang jalan. Sisa rit dan dana merupakan selisih bersih seluruh catatan sesuai filter.</p>`;
}
async function logoImage(){const img=new Image();img.src=logoPath;await img.decode();return img;}
export async function ritPdfDocument(report){
 const d=ritExportData(report),[logo]=await Promise.all([logoImage(),loadExportScript('/vendor/exports/jspdf.umd.min.js')]);await loadExportScript('/vendor/exports/jspdf.plugin.autotable.min.js');
 const doc=new globalThis.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),drawn=new Set();
 const header=()=>{const page=doc.getCurrentPageInfo().pageNumber;if(drawn.has(page))return;drawn.add(page);doc.addImage(logo,'PNG',14,10,20,20);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(23,54,93);doc.text('PT JAYA BINTANG TERANG',39,16);doc.setFontSize(12);doc.text('Laporan Kontrol Rit',39,23);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(doc.splitTextToSize(d.scope,250),39,29);doc.setFontSize(8);doc.text(`${d.body.length} catatan sesuai filter - Dicetak ${today()}`,14,42);};
 header();
 const styles={fontSize:8,cellPadding:2,overflow:'linebreak',textColor:[33,56,84]},headStyles={fillColor:[23,54,93],textColor:[255,255,255]};
 doc.autoTable({startY:47,head:[d.summary.map(x=>x[0])],body:[d.summary.map(x=>x[1])],styles:{...styles,fontSize:10,cellPadding:3},headStyles,margin:{left:14,right:14}});
 doc.autoTable({startY:doc.lastAutoTable.finalY+6,head:[d.headers],body:d.body.length?d.body:[['Tidak ada catatan sesuai filter.','','','','','','']],styles,headStyles,margin:{top:47,bottom:17,left:14,right:14},columnStyles:{0:{cellWidth:40},1:{cellWidth:82},2:{cellWidth:32,halign:'right'},3:{cellWidth:25,halign:'right'},4:{cellWidth:26,halign:'right'},5:{cellWidth:40,halign:'right'},6:{cellWidth:24}},didDrawPage:header});
 doc.autoTable({startY:doc.lastAutoTable.finalY+8,head:[['Rekap uraian order','Rit selesai']],body:d.orders.length?d.orders.map(x=>[x.description,num(x.rit)+' rit']):[['Belum ada rit selesai sesuai filter.','']],styles,headStyles,margin:{top:47,bottom:17,left:14,right:14},columnStyles:{1:{cellWidth:35,halign:'right'}},didDrawPage:header});
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(83,104,129);doc.text('Periode mengikuti tanggal uang jalan. Ringkasan memakai selisih bersih.',14,197);doc.text(`Kontrol Rit - Halaman ${i} / ${pages}`,14,202);}
 doc.setProperties({title:'Laporan Kontrol Rit - '+d.scope,author:'PT Jaya Bintang Terang'});return doc.output('arraybuffer');
}
export async function printRit(report){
 document.querySelector('.ledger-print-report')?.remove();const el=document.createElement('section');el.className='ledger-print-report rit-print-report';el.innerHTML=ritPrintHtml(report);document.body.append(el);
 const original=document.title;let clean;
 try{await Promise.all([...el.querySelectorAll('img')].map(img=>img.decode()));document.title='JBT-Kontrol-Rit-'+today();document.body.classList.add('ledger-printing');clean=()=>{el.remove();document.body.classList.remove('ledger-printing');document.title=original;window.removeEventListener('afterprint',clean);};window.addEventListener('afterprint',clean);window.print();}
 catch(e){if(clean)clean();else el.remove();throw Error('Laporan belum dapat dicetak. '+e.message);}
}
