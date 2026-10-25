import {plates} from './domain.mjs';
const number=n=>n.toLocaleString('id-ID');
export function ritSeries(rows,plate='all'){
 const units=(plate==='all'?plates:plates.filter(p=>p===plate)).map(p=>{
  const revenue=rows.filter(r=>r.plate===p&&r.type==='Pemasukan');
  return {plate:p,rit:revenue.reduce((n,r)=>n+(r.rit||0),0),transactions:revenue.length};
 });
 return {units,total:units.reduce((n,u)=>n+u.rit,0),leader:[...units].sort((a,b)=>b.rit-a.rit)[0]};
}
export function renderRitChart(rows,plate='all'){
 const {units,total,leader}=ritSeries(rows,plate),max=Math.max(4,Math.ceil(Math.max(0,...units.map(u=>u.rit))/4)*4),x=i=>units.length===1?380:80+i*592/(units.length-1),y=n=>100-n/max*70;
 return `<section class="rit-summary" aria-labelledby="rit-chart-title"><div class="rit-chart-heading"><div><h4 id="rit-chart-title">Total Rit per Armada</h4><span>${leader?.rit?`Tertinggi: ${leader.plate} · ${number(leader.rit)} rit`:'Belum ada rit tercatat pada filter ini'}</span></div><strong>${number(total)}<small> total rit</small></strong></div><div class="rit-chart-scroll"><svg class="rit-line-chart" viewBox="0 0 700 155" role="group" aria-label="Perbandingan total rit tercatat per armada"><path d="${[0,.5,1].map(f=>`M64 ${y(f*max)}H688`).join(' ')}" fill="none" stroke="#dbe4ef" stroke-dasharray="3 5"/>${[0,.5,1].map(f=>`<text x="44" y="${y(f*max)+4}" text-anchor="end" class="rit-axis-label">${number(f*max)}</text>`).join('')}<path d="${units.map((u,i)=>`${i?'L':'M'}${x(i)} ${y(u.rit)}`).join(' ')}" class="rit-line"/>${units.map((u,i)=>{const color=u.rit&&u.rit===leader.rit?'#c91920':'#17365d',parts=u.plate.split(' ');return `<g class="rit-chart-point" role="button" tabindex="0" data-rit-truck="${u.plate}" data-tooltip-label="${u.plate} · Rit tercatat" data-tooltip-value="${number(u.rit)} rit" data-tooltip-meta="${number(u.transactions)} transaksi Revenue" data-tooltip-tone="client" data-tooltip-color="${color}" aria-label="${u.plate}, ${number(u.rit)} rit. Tampilkan rincian."><circle cx="${x(i)}" cy="${y(u.rit)}" r="13" fill="transparent"/><circle cx="${x(i)}" cy="${y(u.rit)}" r="4.5" fill="white" stroke="${color}" stroke-width="2.5"/><text x="${x(i)}" y="${y(u.rit)-12}" text-anchor="middle" class="rit-point-value">${number(u.rit)}</text></g><text x="${x(i)}" y="125" text-anchor="middle" class="rit-plate-label"><tspan x="${x(i)}">${parts.slice(0,2).join(' ')}</tspan><tspan x="${x(i)}" dy="16">${parts.slice(2).join(' ')}</tspan></text>`;}).join('')}</svg></div></section>`;
}
