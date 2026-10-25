import {randomUUID} from 'node:crypto';
import {applyControlCommand,validateControl} from '../public/rit-control-model.mjs';
import {validate,empty} from './model.mjs';
export async function controlRequest(req,auth,user,token,send){
 const headers={apikey:auth.key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const endpoint=auth.url+'/rest/v1/tp_rit_control?id=eq.main';
 const request=async(url,options={})=>{const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Kontrol rit belum dapat disimpan. Coba muat ulang.');return r.json();};
 const rows=await request(endpoint+'&select=revision,state');if(rows.length!==1)return send(503,{error:'Database kontrol rit belum tersedia.'});
 const current=validateControl({...rows[0].state,revision:rows[0].revision});
 if(req.method==='GET')return send(200,current);
 if(req.method!=='PUT')return send(405,{error:'Metode tidak didukung.'});
 let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2500000)return send(413,{error:'Data terlalu besar.'});}body=JSON.parse(raw||'{}');}if(typeof body==='string')body=JSON.parse(body);
 if(Buffer.byteLength(JSON.stringify(body))>2500000)return send(413,{error:'Data terlalu besar.'});
 if(body.revision!==current.revision)return send(409,{error:'Tim sudah memperbarui kontrol ini. Muat ulang sebelum menyimpan.'});
 let next;try{
  // Financial data remains in its existing workspace. Only explicitly selected
  // source snapshots are persisted in the shared, authenticated control ledger.
  const transactions=body.transactions;if(!Array.isArray(transactions))throw Error('Sumber Accounting tidak valid.');validate({...empty(),transactions});
  next=applyControlCommand(current,body.command,{actor:user.email,id:randomUUID(),at:new Date().toISOString(),transactions});
 }catch(e){return send(422,{error:e.message});}
 const saved=await request(endpoint+'&revision=eq.'+current.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revision:next.revision,state:next})});
 if(saved.length!==1)return send(409,{error:'Tim sudah memperbarui kontrol ini. Muat ulang sebelum menyimpan.'});return send(200,next);
}
