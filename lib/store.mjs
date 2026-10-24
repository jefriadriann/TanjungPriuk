import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {empty} from './model.mjs';
const key='tp:workspace:v1';
const localDir=()=>process.env.LOCAL_DATA_DIR||'.local';
export const cloud=()=>Boolean(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
export async function redis(cmd){
 const r=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Penyimpanan tidak dapat dihubungi.');
 const b=await r.json();if(b.error)throw Error('Operasi penyimpanan gagal.');return b.result;
}
export async function load(){
 if(cloud()){const raw=await redis(['GET',key]);return raw?JSON.parse(raw):empty();}
 if(process.env.VERCEL)throw Error('Database belum terhubung.');
 try{return JSON.parse(await readFile(path.join(localDir(),'data.json'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return empty();throw e;}
}
let queue=Promise.resolve();
export async function save(state,expected){
 if(cloud()){
  const lua="local old=redis.call('GET',KEYS[1]); local rev=0; if old then rev=cjson.decode(old).revision end; if rev~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
  return Boolean(await redis(['EVAL',lua,'1',key,String(expected),JSON.stringify(state)]));
 }
 if(process.env.VERCEL)throw Error('Database belum terhubung.');
 const dir=localDir();
 const op=queue.then(async()=>{
  const prior=await load();if(prior.revision!==expected)return false;
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'data.previous.json'),JSON.stringify(prior));
  await writeFile(path.join(dir,'data.json'),JSON.stringify(state));return true;
 });queue=op.catch(()=>{});return op;
}
