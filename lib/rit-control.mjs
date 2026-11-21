import {randomUUID} from 'node:crypto';
import {applyControlCommand,fundingNeedsSync,validateControl} from '../public/rit-control-model.mjs';
import {validate,empty} from './model.mjs';
import {isTravelCashEntry,monthLabel} from '../public/domain.mjs';
import {removedTransactionIds} from '../public/transaction-lifecycle.mjs';

function saveCash(current,command,actor){
 const workspace=current.workspace;
 if(!workspace)throw Error('Muat ulang ruang kerja bersama sebelum mencatat uang jalan.');
 const {sourceId,date,amount,target,rate}=command;
 const previous=sourceId?workspace.transactions.find(t=>t.id===sourceId):null;
 if(sourceId&&(!previous||!isTravelCashEntry(previous)||removedTransactionIds(workspace).includes(sourceId)))throw Error('Rincian uang jalan sudah berubah. Muat ulang Kontrol Rit.');
 const id=randomUUID(),at=new Date().toISOString();
 const row={
  ...previous,id:previous?.id||id,plate:previous?.plate||command.plate,date,
  period:previous&&date===previous.date?previous.period:monthLabel(String(date).slice(0,7)),
  type:'Pengeluaran',category:previous?.category||'Uang jalan',income:0,expense:amount,
  description:typeof command.description==='string'?command.description.trim():'',
  rit:previous?.rit??0,customer:previous?.customer??'',
 };
 if(!row.description)throw Error('Isi uraian uang jalan.');
 const transactions=previous?workspace.transactions.map(t=>t.id===row.id?row:t):[...workspace.transactions,row];
 const updated={
  ...workspace,transactions,revision:workspace.revision+1,updatedAt:at,
  audit:[{id,at,by:actor,action:previous?'Koreksi uang jalan di Kontrol Rit':'Tambah uang jalan di Kontrol Rit',transactions:transactions.length,trips:workspace.trips.length},...(workspace.audit||[])].slice(0,100),
 };
 validate(updated);
 const next=applyControlCommand(current,{type:'save-cash',sourceId:row.id,target,rate},{
  actor,id,at,transactions,vehiclePlates:workspace.fleet.map(f=>f.plate),deletedTransactionIds:removedTransactionIds(workspace),
 });
 next.workspace=updated;
 return next;
}
export async function controlRequest(req,auth,user,token,send){
 const headers={apikey:auth.key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const endpoint=auth.url+'/rest/v1/tp_rit_control?id=eq.main';
 const request=async(url,options={})=>{const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Kontrol rit belum dapat disimpan. Coba muat ulang.');return r.json();};
 const rows=await request(endpoint+'&select=revision,state');if(rows.length!==1)return send(503,{error:'Database kontrol rit belum tersedia.'});
 const current=validateControl({...rows[0].state,revision:rows[0].revision});
 const save=async next=>{
  const saved=await request(endpoint+'&revision=eq.'+current.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revision:next.revision,state:next})});
  if(saved.length!==1)return send(409,{error:'Tim sudah memperbarui kontrol ini. Muat ulang sebelum menyimpan.'});
  return send(200,next);
 };
 const apply=(command,financial,deletedTransactionIds)=>applyControlCommand(current,command,{
  actor:user.email,id:randomUUID(),at:new Date().toISOString(),transactions:financial.transactions,
  vehiclePlates:(financial.fleet||empty().fleet).map(f=>f.plate),deletedTransactionIds,
 });
 if(req.method==='GET'){
  const financial=current.workspace;
  if(financial){
   const deletedIds=removedTransactionIds(financial);
   if(fundingNeedsSync(current,financial.transactions,deletedIds))return save(apply({type:'sync-funding'},financial,deletedIds));
  }
  return send(200,current);
 }
 if(req.method!=='PUT')return send(405,{error:'Metode tidak didukung.'});
 let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2500000)return send(413,{error:'Data terlalu besar.'});}body=JSON.parse(raw||'{}');}if(typeof body==='string')body=JSON.parse(body);
 if(Buffer.byteLength(JSON.stringify(body))>2500000)return send(413,{error:'Data terlalu besar.'});
 if(body.revision!==current.revision)return send(409,{error:'Tim sudah memperbarui kontrol ini. Muat ulang sebelum menyimpan.'});
 let next;try{
  if(body.command?.type==='save-cash')next=saveCash(current,body.command,user.email);
  else{
  // Once migrated, financial rows come from the shared workspace, including
  // requests from older clients still sending browser-local snapshots.
  const financial=current.workspace||body;
  const transactions=financial.transactions;if(!Array.isArray(transactions))throw Error('Sumber Accounting tidak valid.');const fleet=financial.fleet||empty().fleet;if(financial.deletedTransactionIds!==undefined&&(!Array.isArray(financial.deletedTransactionIds)||financial.deletedTransactionIds.length>15000||financial.deletedTransactionIds.some(id=>typeof id!=='string'||id.length>100)))throw Error('Daftar transaksi terhapus tidak valid.');validate({...empty(),fleet,transactions});
  next=apply(body.command,financial,current.workspace?removedTransactionIds(financial):financial.deletedTransactionIds||[]);
  }
 }catch(e){return send(422,{error:e.message});}
 return save(next);
}
