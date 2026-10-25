import {monthKey,monthLabel,totals} from './domain.mjs';
export const financialPeriodLabel=key=>key==='unassigned'?'Periode gabungan / belum jelas':monthLabel(key);
export function financialChart(rows){
 const groups=new Map();
 for(const row of rows){const key=monthKey(row)||'unassigned';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const keys=[...groups.keys()].filter(k=>k!=='unassigned').sort();if(groups.has('unassigned'))keys.push('unassigned');
 return {summary:totals(rows),data:keys.map(key=>({key,...totals(groups.get(key))}))};
}
