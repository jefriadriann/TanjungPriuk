import {empty,normalize,validate,clientKey,monthlyReportKey} from './domain.mjs';
export const WORKSPACE_KEY='tanjung-priok-workspace-v1';
export const IMPORT_KEY='tanjung-priok-public-import-v1';
export function importInitialData(storage,incoming){
 validate(incoming);
 const raw=storage.getItem(WORKSPACE_KEY);
 const current=raw?normalize(JSON.parse(raw)):empty();validate(current);
 const next=structuredClone(current);
 const hadRecords=current.transactions.length||current.trips.length;
 for(const key of ['transactions','trips','reports','monthlyReports']){
  const ids=new Set(next[key].map(x=>x.id));
  for(const row of incoming[key]||[]){if(!ids.has(row.id)&&!(key==='monthlyReports'&&next[key].some(x=>monthlyReportKey(x)===monthlyReportKey(row)))){next[key].push(row);ids.add(row.id);}}
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
