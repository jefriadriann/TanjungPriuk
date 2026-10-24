import {randomUUID} from 'node:crypto';
import {cloud,load,save} from '../lib/store.mjs';
import {validate,normalize} from '../lib/model.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,body)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 try{
  const action=new URL(req.url,'http://localhost').searchParams.get('action')||'state';
  const storage=cloud()?'cloud':process.env.VERCEL?'browser':'local';
  if(action==='status'&&req.method==='GET')return send(200,{configured:true,access:'open',storage,authenticated:true});
  if(!['GET','PUT'].includes(req.method))return send(405,{error:'Metode tidak didukung.'});
  if(storage==='browser')return send(503,{error:'Mode browser aktif. Data disimpan di browser perangkat Anda.'});
  if(req.method==='PUT'){
   const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
   if(origin&&new URL(origin).host!==host)return send(403,{error:'Asal permintaan tidak valid.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Gunakan JSON.'});
  }
  if(action==='state'&&req.method==='GET')return send(200,normalize(await load()));
  if(action==='state'&&req.method==='PUT'){
   let body=req.body;
   if(body===undefined){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>2500000)return send(413,{error:'Data terlalu besar.'});}body=JSON.parse(raw||'{}');}
   if(typeof body==='string')body=JSON.parse(body);
   if(Buffer.byteLength(JSON.stringify(body))>2500000)return send(413,{error:'Data terlalu besar.'});
   try{validate(body);}catch(e){return send(422,{error:e.message});}
   const current=await load();if(body.revision!==current.revision)return send(409,{error:'Ada perubahan baru. Muat ulang data sebelum menyimpan.'});
   const next={...normalize(body),revision:current.revision+1,updatedAt:new Date().toISOString(),audit:[{id:randomUUID(),at:new Date().toISOString(),action:'Pembaruan workspace',transactions:body.transactions.length,trips:body.trips.length},...(current.audit||[])].slice(0,100)};
   if(!await save(next,current.revision))return send(409,{error:'Ada perubahan baru. Muat ulang data sebelum menyimpan.'});return send(200,next);
  }
  return send(404,{error:'Tidak ditemukan.'});
 }catch(e){return send(e instanceof SyntaxError?400:500,{error:e.message||'Penyimpanan gagal dihubungi.'});}
}
