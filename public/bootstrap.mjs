import {empty,normalize,validate,clientKey,monthlyReportKey} from './domain.mjs';
export const WORKSPACE_KEY='tanjung-priok-workspace-v1';
export const IMPORT_KEY='tanjung-priok-source-import-v2';
export function importInitialData(storage,incoming){
 validate(incoming);
 const raw=storage.getItem(WORKSPACE_KEY);
 const current=raw?normalize(JSON.parse(raw)):empty();validate(current);
 const next=structuredClone(current);
 const hadRecords=current.transactions.length||current.trips.length;
 const editable=['date','period','description','income','expense','rit','customer','category'];
 // Source corrections apply only while every corrected field still matches its old value.
 // Browser edits, locally added transactions and vehicle status remain untouched.
 for(const change of incoming.sourceUpdates?.corrections||[]){
  const row=next.transactions.find(t=>t.id===change.id);
  if(!row||!change.before||!change.after)continue;
  const fields=Object.keys(change.after);
  if(!fields.length||!fields.every(k=>editable.includes(k)&&Object.hasOwn(change.before,k))||!Object.entries(change.before).every(([k,v])=>editable.includes(k)&&row[k]===v))continue;
  for(const field of fields)row[field]=change.after[field];
 }

 const incomingIds=new Set(incoming.transactions.map(t=>t.id));
 const manual=incoming.sourceUpdates?next.transactions.filter(t=>!t.source&&!incomingIds.has(t.id)):[];
 const text=v=>String(v||'').trim().toLocaleLowerCase('id-ID').replace(/\s+/g,' ').replace(/^orderan\b/,'order');
 const same=(a,b)=>['plate','date','type','income','expense','rit'].every(k=>a[k]===b[k])&&text(a.description)===text(b.description)&&clientKey(a.customer)===clientKey(b.customer);
 for(const key of ['transactions','trips','reports','monthlyReports']){
  const ids=new Set(next[key].map(x=>x.id));
  for(const row of incoming[key]||[]){if(key==='transactions'&&!ids.has(row.id)){const i=manual.findIndex(t=>same(t,row));if(i>=0){manual.splice(i,1);continue;}}if(!ids.has(row.id)&&!(key==='monthlyReports'&&next[key].some(x=>monthlyReportKey(x)===monthlyReportKey(row)))){next[key].push(row);ids.add(row.id);}}
 }
 const clients=new Set(next.clients.map(x=>clientKey(x.name)));
 for(const row of incoming.clients||[]){if(!clients.has(clientKey(row.name))){next.clients.push(row);clients.add(clientKey(row.name));}}
 if(!hadRecords)next.fleet=incoming.fleet;
 next.revision=current.revision+1;next.updatedAt=new Date().toISOString();
 validate(next);
 // Keep the previous browser copy if validation or quota writes fail.
 storage.setItem(WORKSPACE_KEY,JSON.stringify(next));
 storage.setItem(IMPORT_KEY,'loaded');
 return next;
}

// Correct the source workbook's September year typo without replacing browser edits.
export function repairSeptemberYear(storage){
 const raw=storage.getItem(WORKSPACE_KEY);if(!raw)return;
 const current=normalize(JSON.parse(raw));validate(current);
 const next=structuredClone(current);let changed=0;
 for(const t of next.transactions){if(t.date?.startsWith('2027-09-')&&t.period==='September 2026'){t.date='2026'+t.date.slice(4);changed++;}}
 if(!changed)return;
 next.revision=current.revision+1;next.updatedAt=new Date().toISOString();
 validate(next);storage.setItem(WORKSPACE_KEY,JSON.stringify(next));
}

// Persist the owner-confirmed TAP 75 classification in existing browser copies.
export function repairCoordinationCategory(storage){
 const raw=storage.getItem(WORKSPACE_KEY);if(!raw)return;
 const current=JSON.parse(raw),next=normalize(current);
 if(!current.transactions.some((t,i)=>t.category!==next.transactions[i].category))return;
 next.revision=current.revision+1;next.updatedAt=new Date().toISOString();
 validate(next);storage.setItem(WORKSPACE_KEY,JSON.stringify(next));
}
