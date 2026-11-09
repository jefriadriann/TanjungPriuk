import {randomUUID,createHash} from 'node:crypto';
import {normalize,validate,empty,monthLabel,clientKey,monthlyReportKey} from './model.mjs';
import {publicImport} from './public-import.mjs';
import {applyControlCommand,validateControl} from '../public/rit-control-model.mjs';
import {archiveRemovedTransactions} from '../public/transaction-lifecycle.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// Migration never chooses a conflicting browser copy over an edited shared record.
export function mergeBrowserWorkspace(current,incoming,baseline,{by,at}){
 const next=structuredClone(current),conflicts=[];
 const keyOf=(key,row)=>key==='fleet'?row.plate:key==='clients'?clientKey(row.name):key==='monthlyReports'?monthlyReportKey(row):row.id;
 for(const key of ['fleet','clients','transactions','trips','reports','monthlyReports']){
  const shared=new Map(next[key].map(row=>[keyOf(key,row),row])),original=new Map(baseline[key].map(row=>[keyOf(key,row),row]));
  for(const row of incoming[key]){
   const id=keyOf(key,row),old=shared.get(id),base=original.get(id);
   if(key==='transactions'&&(next.deletedTransactionIds||[]).includes(row.id))continue;
   if(equal(old,row))continue;
   if(!old){if(base)continue;next[key].push(structuredClone(row));shared.set(id,row);}
   else if(base&&equal(old,base)){Object.assign(old,structuredClone(row));}
   else if(!base||!equal(row,base))conflicts.push({collection:key,key:id,browser:row,shared:old,by,at});
  }
 }
 // Tombstones from a device are evidence to review, never permission to delete shared rows.
 for(const id of incoming.deletedTransactionIds||[]){const row=next.transactions.find(x=>x.id===id);if(row)conflicts.push({collection:'transactions',key:id,browserDeleted:true,shared:row,by,at});}
 next.migrationConflicts=[...(next.migrationConflicts||[]),...conflicts];validate(next);return next;
}
export function recoverTravelCash(workspace,control,{at,by}){
 const next=structuredClone(workspace),ids=new Set([...next.transactions.map(x=>x.id),...(next.deletedTransactionIds||[]),...(control.removedSourceIds||[]),...(control.excludedFundingIds||[])]);
 for(const p of control.packages){
  for(const pay of p.payments){if(!pay.sourceId||ids.has(pay.sourceId))continue;
   if(!next.fleet.some(x=>x.plate===p.plate))next.fleet.push({...empty().fleet[0],plate:p.plate});
   next.transactions.push({id:pay.sourceId,plate:p.plate,date:pay.date,period:monthLabel(pay.date.slice(0,7)),description:p.name,type:'Pengeluaran',category:'Uang jalan',income:0,expense:pay.amount,rit:0,customer:'',recoveredFromControl:{packageId:p.id,paymentId:pay.id,at,by}});ids.add(pay.sourceId);
  }
 }
 validate(next);return next;
}
export async function sharedWorkspaceRequest(req,auth,user,token,send){
 const headers={apikey:auth.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},endpoint=auth.url+'/rest/v1/tp_rit_control?id=eq.main';
 const request=async(url,options={})=>{const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Database bersama belum dapat dihubungi. Data browser tetap disimpan.');return r.json();};
 const rows=await request(endpoint+'&select=revision,state');if(rows.length!==1)return send(503,{error:'Database bersama belum tersedia.'});
 const envelope=validateControl({...rows[0].state,revision:rows[0].revision}),at=new Date().toISOString(),by=user.email;
 let current=envelope.workspace,changed=false;
 if(!current){const initial=process.env.PUBLIC_EXCEL_IMPORT==='1'?await publicImport(token):empty();current=recoverTravelCash({...initial,revision:0},envelope,{at,by});changed=true;}
 const recovered=recoverTravelCash(current,envelope,{at,by});if(recovered.transactions.length!==current.transactions.length){current=recovered;changed=true;}
 validate(current);
 const action=new URL(req.url,'http://localhost').searchParams.get('action');
 if(req.method==='PUT'){
  let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2500000)return send(413,{error:'Data terlalu besar.'});}body=JSON.parse(raw||'{}');}if(typeof body==='string')body=JSON.parse(body);if(Buffer.byteLength(JSON.stringify(body))>2500000)return send(413,{error:'Data terlalu besar.'});
  try{validate(body);}catch(e){return send(422,{error:e.message});}
  if(action==='migrate-browser'){
   const digest=createHash('sha256').update(JSON.stringify(body)).digest('hex');
   if(!current.browserMigrations?.[digest]){
    const baseline=process.env.PUBLIC_EXCEL_IMPORT==='1'?await publicImport(token):empty();
    current=mergeBrowserWorkspace(current,normalize(body),baseline,{at,by});current.browserMigrations={...current.browserMigrations,[digest]:{at,by}};changed=true;
   }
  }else{
   if(body.revision!==current.revision)return send(409,{error:'Ada pembaruan dari perangkat lain. Muat ulang data sebelum menyimpan; perubahan Anda belum ditimpa.'});
   const next=archiveRemovedTransactions(current,normalize(body),{by,at});
   // Migration evidence is server-owned, not editable by old browser copies.
   current={...next,browserMigrations:current.browserMigrations,migrationConflicts:current.migrationConflicts};changed=true;
  }
 }
 if(changed){
  current={...current,revision:current.revision+1,updatedAt:at,audit:[{id:randomUUID(),at,by,action:action==='migrate-browser'?'Sinkronisasi salinan browser':'Pembaruan workspace bersama',transactions:current.transactions.length},...(current.audit||[])].slice(0,100)};validate(current);
  const next=applyControlCommand(envelope,{type:'sync-funding'},{actor:by,id:randomUUID(),at,transactions:current.transactions,vehiclePlates:current.fleet.map(x=>x.plate),deletedTransactionIds:current.deletedTransactionIds||[]});next.workspace=current;
  const saved=await request(endpoint+'&revision=eq.'+envelope.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revision:next.revision,state:next})});
  if(saved.length!==1)return send(409,{error:'Data bersama baru diperbarui. Muat ulang dan coba lagi. Salinan browser tetap aman.'});
 }
 return send(200,current);
}
