import {normalize,validate,categoryLabel} from './domain.mjs';
export const REVENUE_MIGRATION='share-revenue-v2';
export const REVENUE_BACKUP_KEY='tanjung-priok-before-share-revenue-v2';
const key='tanjung-priok-workspace-v1';
const archive=(state,row,{at,by,reason})=>{state.deletedTransactions=[...(state.deletedTransactions||[]),{row:structuredClone(row),at,by,reason}];state.deletedTransactionIds=[...new Set([...(state.deletedTransactionIds||[]),row.id])];};
export function migrateRevenueState(input,{at=new Date().toISOString(),by='Migrasi pencatatan'}={}){
 const original=normalize(input);validate(original);if(original.migrations?.[REVENUE_MIGRATION])return original;
 const next=structuredClone(original);let removed=0,converted=0;
 next.transactions=next.transactions.filter(row=>{if(row.type==='Pemasukan'&&categoryLabel(row.category)!=='Bagi Hasil'){archive(next,row,{at,by,reason:REVENUE_MIGRATION});removed++;return false;}return true;}).map(row=>{if(row.type==='Pengeluaran'&&categoryLabel(row.category)==='Bagi Hasil'){converted++;const match=String(row.description).match(/(\d+)\s*rit\b/i),rit=row.rit||Number(match?.[1]||0);return {...row,type:'Pemasukan',category:'Bagi Hasil',income:row.expense,expense:0,rit:rit<=100000?rit:0};}return row;});
 next.migrations={...next.migrations,[REVENUE_MIGRATION]:{at,removed,converted}};validate(next);return next;
}
export function migrateRevenueStorage(storage){const raw=storage.getItem(key);if(!raw)return null;const current=normalize(JSON.parse(raw));if(current.migrations?.[REVENUE_MIGRATION])return current;const next=migrateRevenueState(current);if(!storage.getItem(REVENUE_BACKUP_KEY))storage.setItem(REVENUE_BACKUP_KEY,raw);next.revision=current.revision+1;next.updatedAt=new Date().toISOString();next.audit=[{id:REVENUE_MIGRATION,at:next.updatedAt,action:'Revenue lama diarsipkan; Bagi Hasil menjadi Revenue',...next.migrations[REVENUE_MIGRATION]},...(current.audit||[])].slice(0,100);storage.setItem(key,JSON.stringify(next));return next;}
export function deleteTransaction(input,id,{at=new Date().toISOString(),by='',reason='Dihapus pengguna'}={}){const next=structuredClone(input),row=next.transactions.find(t=>t.id===id);if(!row)throw Error('Transaksi tidak ditemukan atau sudah dihapus.');archive(next,row,{at,by,reason});next.transactions=next.transactions.filter(t=>t.id!==id);validate(next);return next;}

export function archiveRemovedTransactions(previous,input,options={}){const next=structuredClone(input),ids=new Set(next.transactions.map(t=>t.id)),deleted=new Set(next.deletedTransactionIds||[]);for(const row of previous.transactions)if(!ids.has(row.id)&&!deleted.has(row.id))archive(next,row,{at:options.at||new Date().toISOString(),by:options.by||'',reason:options.reason||'Dihapus dari rincian transaksi'});return next;}
