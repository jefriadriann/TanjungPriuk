import {migrateRevenueState} from '../public/transaction-lifecycle.mjs';
import {gunzipSync} from 'node:zlib';
import {normalize,validate} from './model.mjs';
export async function publicImport(token){
 if(process.env.QUERY1_IMPORT_GZIP_BASE64){const state=normalize(JSON.parse(gunzipSync(Buffer.from(process.env.QUERY1_IMPORT_GZIP_BASE64,'base64')).toString('utf8')));validate(state);return migrateRevenueState(state);}
 const url=new URL('/rest/v1/tp_public_import?id=eq.initial&select=state',process.env.SUPABASE_URL);
 const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Data awal belum dapat dimuat. Coba lagi nanti.');
 const rows=await r.json();if(!Array.isArray(rows)||rows.length!==1)throw Error('Data awal belum tersedia.');
 const state=normalize(rows[0].state);validate(state);return migrateRevenueState(state);
}
