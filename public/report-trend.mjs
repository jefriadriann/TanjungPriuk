import {previousMonth,monthLabel,selectRows} from './domain.mjs';
const money=n=>'Rp '+n.toLocaleString('id-ID');
export function reportTrend(state,month,plate='all'){
 const prior=previousMonth(month);
 return [previousMonth(prior),prior,month].map(key=>{
  const rows=selectRows(state,{month:key,plate});
  const point={month:key,label:monthLabel(key),count:rows.length};
  for(const [field,type] of [['income','Pemasukan'],['expense','Pengeluaran']]){
   const entries=rows.filter(r=>r.type===type),known=entries.filter(r=>r[field]!==null);
   point[field]=!rows.length||(entries.length&&!known.length)?null:known.reduce((n,r)=>n+r[field],0);
   point[field+'Missing']=entries.some(r=>r[field]===null);
  }
  return point;
 });
}
export function trendNarrative(points){
 const current=points.at(-1),previous=points.at(-2);
 return [['income','Revenue'],['expense','Expense']].map(([field,label])=>{
  const value=current[field],before=previous[field];
  if(value===null)return `${label} ${current.label} belum dapat dibandingkan karena nominal tercatat belum tersedia.`;
  const opening=`${label} ${current.label} tercatat ${money(value)}`;
  if(current[field+'Missing']||previous[field+'Missing'])return `${opening}. Perbandingan dengan ${previous.label} belum lengkap karena masih ada nominal yang belum diisi.`;
  if(before===null)return `${opening}; data ${previous.label} belum tersedia sebagai pembanding.`;
  if(value===before)return `${opening}, sama dengan ${previous.label}.`;
  if(before===0)return `${opening}, dibandingkan Rp 0 yang tercatat pada ${previous.label}.`;
  const change=(Math.abs(value-before)/before*100).toLocaleString('id-ID',{maximumFractionDigits:1});
  return `${opening}, ${value>before?'meningkat':'menurun'} ${change}% dibandingkan ${previous.label} (${money(before)}).`;
 }).join(' ');
}
export function renderReportTrend(points){
 const max=Math.max(1,...points.flatMap(p=>[p.income??0,p.expense??0])),step=10**Math.floor(Math.log10(max)),ceiling=Math.ceil(max/step)*step;
 const xs=[94,424,754],y=v=>236-v/ceiling*200;
 const series=[['income','Revenue','#16866f'],['expense','Expense','#cb5058']];
 const grid=[0,.25,.5,.75,1].map(f=>`<line x1="94" y1="${y(f*ceiling)}" x2="754" y2="${y(f*ceiling)}" stroke="#dce7ee" stroke-dasharray="3 5"/><text x="78" y="${y(f*ceiling)+4}" text-anchor="end">${(f*ceiling/1e6).toLocaleString('id-ID',{maximumFractionDigits:2})}</text>`).join('');
 const lines=series.map(([field,label,color])=>{
  let path='',connected=false;
  points.forEach((p,i)=>{if(p[field]===null){connected=false;return;}path+=`${connected?'L':'M'}${xs[i]},${y(p[field])} `;connected=true;});
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`+points.map((p,i)=>p[field]===null?'':`<circle cx="${xs[i]}" cy="${y(p[field])}" r="5" fill="white" stroke="${color}" stroke-width="3"><title>${label} · ${p.label}: ${money(p[field])}${p[field+'Missing']?' (nominal tersedia)':''}</title></circle>`).join('');
 }).join('');
 return `<div class="report-trend"><div class="trend-heading"><span>Dalam juta Rupiah</span><div class="trend-legend"><span><i class="revenue-line"></i>Revenue</span><span><i class="expense-line"></i>Expense</span></div></div><svg class="report-trend-chart" viewBox="0 0 820 290" role="img" aria-labelledby="report-trend-title report-trend-desc"><title id="report-trend-title">Perbandingan Revenue dan Expense tiga bulan</title><desc id="report-trend-desc">${points[0].label} sampai ${points[2].label}. Nilai lengkap tersedia pada tabel di bawah grafik. Garis terputus menandakan data belum tersedia.</desc><rect x="714" y="28" width="80" height="220" rx="10" fill="#eef5fa"/>${grid}${lines}${points.map((p,i)=>`<text x="${xs[i]}" y="274" text-anchor="middle">${p.label}</text>`).join('')}</svg><div class="table-wrap"><table class="trend-values"><thead><tr><th>Periode</th><th class="number">Revenue</th><th class="number">Expense</th></tr></thead><tbody>${points.map((p,i)=>`<tr${i===2?' class="report-current"':''}><td>${p.label}</td>${['income','expense'].map(f=>`<td class="number">${p[f]===null?'—':money(p[f])}${p[f+'Missing']?' *':''}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="trend-narrative">${trendNarrative(points)}</p><p class="report-table-note">Berdasarkan nominal tersedia pada cakupan armada terpilih. Tanda (—): data belum tersedia; (*): nominal belum lengkap. Periode gabungan tidak dialokasikan.</p></div>`;
}
