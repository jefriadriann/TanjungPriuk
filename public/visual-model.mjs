import {clientKey} from './domain.mjs';
export function revenueDistribution(rows){
 const groups=new Map();let missing=0;
 for(const row of rows){if(row.type!=='Pemasukan')continue;if(row.income===null){missing++;continue;}if(!row.income)continue;const key=clientKey(row.customer);if(!groups.has(key))groups.set(key,{key,name:row.customer?.trim()||'Klien belum ditetapkan',value:0});groups.get(key).value+=row.income;}
 const parts=[...groups.values()].sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key));const total=parts.reduce((n,p)=>n+p.value,0);return {total,missing,parts:parts.map(p=>({...p,share:total?p.value/total:0}))};
}
