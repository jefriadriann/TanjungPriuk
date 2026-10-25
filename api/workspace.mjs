import {controlRequest} from '../lib/rit-control.mjs';
import {randomUUID} from 'node:crypto';
import {publicImport} from '../lib/public-import.mjs';
import {config,identity,authAction,sameOrigin,sessionToken} from '../lib/auth.mjs';
import {cloud,load,save} from '../lib/store.mjs';
import {validate,normalize} from '../lib/model.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const send=(code,body)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 try{
  const action=new URL(req.url,'http://localhost').searchParams.get('action')||'state';
  const storage=cloud()?'cloud':process.env.VERCEL?'browser':'local';
  if(['login','google-login','logout','auth-callback'].includes(action))return await authAction(req,res,action,send);
  // Temporary open access is restricted to browser storage; server data stays protected.
  if(storage==='browser'&&process.env.REQUIRE_EMAIL_LOGIN==='0'){
   if(action==='status'&&req.method==='GET'){const c=config();const user=c?.googleEnabled?await identity(req,c):null;return send(200,{configured:true,access:'browser',storage,authenticated:true,publicImport:process.env.PUBLIC_EXCEL_IMPORT==='1',googleLogin:Boolean(c?.googleEnabled),sessionAuthenticated:Boolean(user),email:user?.email});}
   if(action==='initial-data'&&req.method==='GET'&&process.env.PUBLIC_EXCEL_IMPORT==='1')return send(200,await publicImport());
   return send(503,{error:'Mode browser aktif. Data disimpan di browser perangkat Anda.'});
  }
  const auth=config();
  const user=await identity(req,auth);
  if(action==='status'&&req.method==='GET')return send(200,{configured:Boolean(auth),access:'email',storage,authenticated:Boolean(user),email:user?.email,googleLogin:Boolean(auth?.googleEnabled),publicImport:process.env.PUBLIC_EXCEL_IMPORT==='1'});
  if(!auth)return send(503,{error:'Login belum dikonfigurasi. Hubungi administrator.'});
  if(!user)return send(401,{error:'Silakan masuk melalui link email.'});
  if(!['GET','PUT'].includes(req.method))return send(405,{error:'Metode tidak didukung.'});
  if(action==='initial-data'&&req.method==='GET'&&process.env.PUBLIC_EXCEL_IMPORT==='1')return send(200,await publicImport(sessionToken(req)));
  if(action==='rit-control'){
   if(req.method==='PUT'&&(!sameOrigin(req,auth)||!req.headers['content-type']?.startsWith('application/json')))return send(403,{error:'Permintaan tidak valid.'});
   return await controlRequest(req,auth,user,sessionToken(req),send);
  }
  if(storage==='browser')return send(503,{error:'Mode browser aktif. Data disimpan di browser perangkat Anda.'});
  if(req.method==='PUT'){
   if(!sameOrigin(req,auth))return send(403,{error:'Asal permintaan tidak valid.'});
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
