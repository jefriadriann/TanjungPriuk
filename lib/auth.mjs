import {randomBytes,createHash} from 'node:crypto';
const SESSION='tp_session',VERIFIER='tp_login',REFRESH='tp_refresh';
const REMEMBER_SECONDS=30*24*60*60;
const tokenValue=v=>typeof v==='string'&&v.length>0&&v.length<=3800&&/^[A-Za-z0-9._-]+$/.test(v);
const allowed=()=>new Set((process.env.AUTH_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
export function config(){
 try{
  const origin=new URL(process.env.APP_ORIGIN),url=new URL(process.env.SUPABASE_URL);
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))return null;
  if(url.protocol!=='https:'||url.username||url.password||origin.username||origin.password)return null;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  return key&&allowed().size?{origin:origin.origin,url:url.origin,key,secure:origin.protocol==='https:',googleEnabled:process.env.AUTH_GOOGLE_ENABLED==='1'}:null;
 }catch{return null;}
}
function cookie(req,name){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return raw?.slice(name.length+1)||'';}
function setCookie(res,c,name,value,seconds){
 const next=`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${c.secure?'; Secure':''}`;
 const prior=res.getHeader?.('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(prior)?prior:prior?[prior]:[]),next]);
}
export const sessionToken=req=>cookie(req,SESSION);
export function sameOrigin(req,c){return req.headers.origin===c.origin;}
async function authFetch(c,path,options={}){
 return fetch(c.url+'/auth/v1/'+path,{...options,headers:{apikey:c.key,...options.headers},signal:AbortSignal.timeout(10000),redirect:'error'});
}
export async function identity(req,c=config()){
 if(!c)return null;
 const token=cookie(req,SESSION);if(!token||token.length>3800)return null;
 const r=await authFetch(c,'user',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok){if([401,403].includes(r.status))return null;throw Error('Login belum dapat diverifikasi. Coba lagi.');}
 const user=await r.json();
 return user.email_confirmed_at&&allowed().has(String(user.email).toLowerCase())?{id:user.id,email:user.email}:null;
}
function saveSession(res,c,session){
 if(!tokenValue(session.access_token)||!Number.isFinite(session.expires_in)||session.expires_in<=0||session.refresh_token!==undefined&&!tokenValue(session.refresh_token))throw Error('Sesi login tidak valid.');
 setCookie(res,c,SESSION,session.access_token,Math.floor(Math.min(session.expires_in,3600)));
 if(session.refresh_token)setCookie(res,c,REFRESH,session.refresh_token,REMEMBER_SECONDS);else setCookie(res,c,REFRESH,'',0);
}
export async function authenticate(req,res,c=config(),force=false){
 if(!c)return {user:null,token:''};
 const token=sessionToken(req),user=await identity(req,c);
 let exp=0;try{exp=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).exp||0;}catch{}
 const refresh=cookie(req,REFRESH);
 if(user&&!force&&(!exp||exp*1000>Date.now()+300000))return {user,token};
 if(!tokenValue(refresh))return {user,token};
 // Foreign-origin requests must never rotate or clear the session.
 if(req.headers.origin&&!sameOrigin(req,c))return {user,token};
 const r=await authFetch(c,'token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})});
 if(!r.ok){
  if([400,401,403].includes(r.status)){setCookie(res,c,REFRESH,'',0);if(!user)setCookie(res,c,SESSION,'',0);return {user,token};}
  throw Error('Sesi belum dapat diperpanjang. Coba lagi; isian Anda tetap terbuka.');
 }
 const session=await r.json();
 if(!tokenValue(session.access_token)||!tokenValue(session.refresh_token)||!Number.isFinite(session.expires_in)||session.expires_in<=0)throw Error('Sesi login tidak valid.');
 const verified=await identity({headers:{cookie:SESSION+'='+session.access_token}},c);
 if(!verified||user&&verified.id!==user.id){setCookie(res,c,SESSION,'',0);setCookie(res,c,REFRESH,'',0);return {user:null,token:''};}
 saveSession(res,c,session);return {user:verified,token:session.access_token};
}
async function jsonBody(req){
 if(req.body!==undefined){const text=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(text)>2048)throw Error('body');return JSON.parse(text);}
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048)throw Error('body');}return JSON.parse(raw||'{}');
}
export async function authAction(req,res,action,send){
 const c=config();
 if(!c)return send(503,{error:'Login belum dikonfigurasi. Hubungi administrator.'});
 if(action==='auth-callback'){
  if(req.method!=='GET')return send(405,{error:'Metode tidak didukung.'});
  const params=new URL(req.url,c.origin).searchParams;
  if(params.has('error')){setCookie(res,c,VERIFIER,'',0);res.statusCode=303;res.setHeader('Location',c.origin+'/?login_error=cancelled');return res.end();}
  const code=params.get('code'),verifier=cookie(req,VERIFIER);
  setCookie(res,c,VERIFIER,'',0);
  if(!code||code.length>2048||!/^[A-Za-z0-9_-]{43}$/.test(verifier))return send(400,{error:'Link login tidak valid atau sudah kedaluwarsa. Minta link baru dari browser yang sama.'});
  const r=await authFetch(c,'token?grant_type=pkce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:verifier})});
  if(!r.ok)return send(401,{error:'Link login tidak valid atau sudah digunakan. Minta link baru.'});
  const session=await r.json();
  const check=await authFetch(c,'user',{headers:{Authorization:'Bearer '+session.access_token}});
  const user=check.ok?await check.json():null;
  if(!user?.email_confirmed_at||!allowed().has(String(user.email).toLowerCase()))return send(403,{error:'Email tidak memiliki akses.'});
  try{saveSession(res,c,session);}catch{return send(502,{error:'Sesi login tidak valid.'});}
  res.statusCode=303;res.setHeader('Location',c.origin+'/');return res.end();
 }
 if(req.method!=='POST')return send(405,{error:'Metode tidak didukung.'});
 if(!sameOrigin(req,c))return send(403,{error:'Asal permintaan tidak valid.'});
 if(action==='google-login'){
  if(!c.googleEnabled)return send(503,{error:'Login Google belum diaktifkan. Hubungi administrator.'});
  const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  const url=new URL(c.url+'/auth/v1/authorize');
  url.searchParams.set('provider','google');url.searchParams.set('redirect_to',c.origin+'/api/index?action=auth-callback');url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');url.searchParams.set('prompt','select_account');
  setCookie(res,c,VERIFIER,verifier,600);return send(200,{url:url.toString()});
 }
 if(action==='refresh-session'){const result=await authenticate(req,res,c,true);return send(result.user?200:401,result.user?{authenticated:true}:{error:'Silakan masuk kembali. Isian yang belum disimpan tetap terbuka.'});}
 if(action==='logout'){setCookie(res,c,REFRESH,'',0);setCookie(res,c,SESSION,'',0);setCookie(res,c,VERIFIER,'',0);return send(200,{ok:true});}
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Gunakan JSON.'});
 let body;try{body=await jsonBody(req);}catch{return send(400,{error:'Permintaan tidak valid.'});}
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return send(400,{error:'Masukkan alamat email yang valid.'});
 // The same response avoids exposing the list of approved email addresses.
 const message='Jika email terdaftar, link login akan dikirim. Periksa inbox dan spam, lalu buka link di browser ini.';
 if(!allowed().has(email))return send(200,{message});
 const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const redirect=c.origin+'/api/index?action=auth-callback';
 const r=await authFetch(c,'otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,create_user:false,code_challenge:challenge,code_challenge_method:'s256'})});
 if(!r.ok)return send(r.status===429?429:502,{error:r.status===429?'Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba lagi.':'Email belum dapat dikirim. Hubungi administrator atau coba lagi nanti.'});
 setCookie(res,c,VERIFIER,verifier,600);
 return send(200,{message});
}
