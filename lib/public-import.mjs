import {normalize,validate} from './model.mjs';
export async function publicImport(){
 const url=new URL('/rest/v1/tp_public_import?id=eq.initial&select=state',process.env.SUPABASE_URL);
 const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Data awal belum dapat dimuat. Coba lagi nanti.');
 const rows=await r.json();if(!Array.isArray(rows)||rows.length!==1)throw Error('Data awal belum tersedia.');
 const state=normalize(rows[0].state);validate(state);return state;
}
