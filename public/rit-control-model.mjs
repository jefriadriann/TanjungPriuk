import {plates,clientKey,today} from './domain.mjs';
export const emptyControl=()=>({version:1,revision:0,owners:['','',''],packages:[],audit:[]});
const fail=message=>{throw Error(message);};
const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const integer=(v,max=1e13)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function evidenceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=1500;}catch{return false;}}
export function sourceSignature(t){return JSON.stringify([t.id,t.plate,t.type,t.date,t.period,t.description,clientKey(t.customer),t.rit,t.income,t.expense,t.category]);}
export function packageSummary(p,state){
 const verified=p.proofs.filter(x=>x.status==='verified').length,pending=p.proofs.filter(x=>x.status==='pending').length;
 const cash=p.payments.reduce((n,x)=>n+x.amount,0),previous=state.packages.find(x=>x.id===p.carryFrom),carry=previous?.closed?.balance||0;
 const funded=cash+carry,accounted=verified*p.rate,balance=Math.max(0,funded-accounted),shortfall=Math.max(0,accounted-funded);
 const reported=p.reportedRit??null,claimGap=reported===null?0:Math.max(0,reported-verified);
 const stage=p.closed?'closed':funded<p.target*p.rate?'funding':verified>=p.target?'settlement':pending?'verification':'execution';
 return {reported,claimGap,verified,pending,cash,carry,funded,accounted,balance,shortfall,stage,topup:Math.max(0,p.target*p.rate-funded),remaining:Math.max(0,p.target-verified)};
}
export function allocatedRit(control,id){return control.packages.reduce((n,p)=>n+p.sources.filter(s=>s.row.id===id).reduce((a,s)=>a+s.rit,0),0);}
export function sourceConflicts(p,transactions){return p.sources.filter(s=>{const row=transactions.find(t=>t.id===s.row.id);return !row||sourceSignature(row)!==sourceSignature(s.row);});}
export function validateControl(s){
 if(!s||s.version!==1||!integer(s.revision)||!Array.isArray(s.owners)||s.owners.length!==3||s.owners.some(x=>typeof x!=='string'||x.length>100)||!Array.isArray(s.packages)||s.packages.length>2000||!Array.isArray(s.audit))fail('Format kontrol rit tidak valid.');
 const ids=new Set(),refs=new Set(),fundingRefs=new Set(),usedSources=new Map(),carryUsed=new Set();
 for(const p of s.packages){
  if(!text(p.id,100)||ids.has(p.id)||!text(p.name)||!plates.includes(p.plate)||!text(p.driver)||!text(p.customer)||!date(p.date)||!integer(p.target,100)||!p.target||!integer(p.rate,1e9)||!p.rate||!text(p.owner,100)||!Array.isArray(p.sources)||!Array.isArray(p.payments)||!Array.isArray(p.proofs)||p.sources.length>300||p.proofs.length>300||p.payments.length>100)fail('Paket rit tidak valid.');
  ids.add(p.id);
  for(const s of p.sources){const t=s.row;if(!t||!text(t.id,100)||t.plate!==p.plate||t.type!=='Pemasukan'||clientKey(t.customer)!==clientKey(p.customer)||!integer(t.rit,100000)||!integer(s.rit,t.rit)||!s.rit)fail('Sumber revenue tidak sesuai paket.');const old=usedSources.get(t.id)||{capacity:0,rit:0};old.capacity=Math.max(old.capacity,t.rit);old.rit+=s.rit;usedSources.set(t.id,old);}
  if(p.reportedRit!==undefined&&p.reportedRit!==null&&!integer(p.reportedRit,p.target))fail('Jumlah rit dilaporkan tidak valid.');
  if(p.sources.reduce((n,s)=>n+s.rit,0)>p.target)fail('Rit sumber melebihi target paket.');
  for(const pay of p.payments){if(!text(pay.id,100)||!integer(pay.amount)||!pay.amount||!date(pay.date)||!text(pay.reference,200))fail('Data transfer kasbon tidak valid.');const ref=pay.sourceId?'source:'+pay.sourceId:'ref:'+pay.reference.trim().toLowerCase();if(fundingRefs.has(ref))fail('Transfer kasbon sudah digunakan.');fundingRefs.add(ref);}
  const proofIds=new Set();for(const proof of p.proofs){const ref=proof.reference?.trim().toLowerCase();if(!text(proof.id,100)||proofIds.has(proof.id)||!text(proof.reference)||!date(proof.date)||!evidenceUrl(proof.url)||!['pending','verified','rejected'].includes(proof.status)||refs.has(ref)||proof.status==='verified'&&(!text(proof.reviewedBy)||!text(proof.reviewedAt)))fail('Surat jalan tidak valid atau nomor sudah digunakan.');refs.add(ref);proofIds.add(proof.id);}
  if(p.proofs.filter(x=>x.status!=='rejected').length>p.target)fail('Surat jalan melebihi target paket.');
  if(p.carryFrom){const previous=s.packages.find(x=>x.id===p.carryFrom);if(!previous?.closed||previous.closed.balance<=0||previous.plate!==p.plate||previous.driver.trim().toLowerCase()!==p.driver.trim().toLowerCase()||previous.id===p.id||carryUsed.has(previous.id))fail('Saldo kasbon sebelumnya belum tersedia atau sudah digunakan.');carryUsed.add(previous.id);}
  const m=packageSummary(p,s);if(p.closed&&(!text(p.closed.by)||p.closed.balance!==m.balance||m.shortfall||m.pending))fail('Penyelesaian kasbon tidak valid.');
 }
 for(const source of usedSources.values())if(source.rit>source.capacity)fail('Rit sumber sudah digunakan paket lain.');
 // Carry must be acyclic even when importing state outside the command API.
 for(const p of s.packages){const seen=new Set([p.id]);let prev=p.carryFrom;while(prev){if(seen.has(prev))fail('Rantai saldo kasbon tidak valid.');seen.add(prev);prev=s.packages.find(x=>x.id===prev)?.carryFrom;}}
 return s;
}
export function applyControlCommand(current,command,{actor,id,at,transactions}){
 validateControl(current);if(!text(actor)||!text(id)||!text(at)||!command||!text(command.type))fail('Permintaan kontrol tidak valid.');
 const next=structuredClone(current),c=command,p=next.packages.find(x=>x.id===c.packageId);
 const snapshot=key=>transactions.find(t=>t.id===key);
 const addSources=(packageItem,allocations)=>{if(!Array.isArray(allocations)||allocations.length>300)fail('Pilih sumber transaksi yang valid.');for(const a of allocations){const row=snapshot(a.id);if(!row)fail('Sumber transaksi tidak ditemukan. Muat ulang Accounting.');if(!integer(a.rit,row.rit)||allocatedRit(next,row.id)+(next.packages.includes(packageItem)?0:packageItem.sources.filter(s=>s.row.id===row.id).reduce((n,s)=>n+s.rit,0))+a.rit>row.rit)fail('Rit sumber sudah digunakan paket lain.');const existing=packageItem.sources.find(s=>s.row.id===row.id);if(existing){if(sourceSignature(existing.row)!==sourceSignature(row))fail('Cocokkan sumber yang berubah sebelum menambah alokasi.');existing.rit+=a.rit;}else packageItem.sources.push({row:structuredClone(row),rit:a.rit});}};
 if(c.type==='owners'){if(!Array.isArray(c.names)||c.names.length!==3||c.names.some(x=>!text(x,100)))fail('Isi nama ketiga owner.');if(new Set(c.names.map(x=>x.trim().toLowerCase())).size!==3)fail('Nama ketiga owner harus berbeda.');next.owners=c.names.map(x=>x.trim());}
 else if(c.type==='create'){
  if(!next.owners.includes(c.owner)||!c.owner)fail('Pilih owner penanggung jawab.');
  if(next.packages.some(x=>!x.closed&&x.plate===c.plate))fail('Selesaikan paket aktif armada ini sebelum membuat paket berikutnya.');
  const created={id,name:c.name,plate:c.plate,driver:c.driver?.trim(),customer:c.customer,date:c.date,target:c.target,rate:c.rate,owner:c.owner,sources:[],payments:[],proofs:[],carryFrom:c.carryFrom||'',createdBy:actor,createdAt:at,closed:null};addSources(created,c.sources||[]);next.packages.push(created);
 }else{
  if(!p)fail('Paket tidak ditemukan.');if(p.closed)fail('Paket sudah diselesaikan dan dikunci.');
  if(c.type==='sources')addSources(p,c.sources);
  else if(c.type==='fund'){
   let amount=c.amount,reference=c.reference,dateValue=c.date;
   if(c.sourceId){const row=snapshot(c.sourceId);if(!row||row.type!=='Pengeluaran'||row.category!=='Uang jalan'||row.plate!==p.plate||!row.expense)fail('Pilih transaksi Uang jalan pada armada yang sama.');amount=row.expense;reference='Accounting · '+row.id;dateValue=row.date;if(!dateValue)fail('Lengkapi tanggal transaksi di Accounting terlebih dahulu.');}
   if(dateValue>today())fail('Tanggal transfer belum terjadi. Periksa tanggal Accounting.');
   p.payments.push({id,amount,date:dateValue,reference,sourceId:c.sourceId||'',by:actor,at});
  }else if(c.type==='claim'){
   if(!integer(c.rit,p.target)||!text(c.note,1000))fail('Isi jumlah rit sesuai target dan catatan laporan driver.');
   p.reportedRit=c.rit;p.claims=[{rit:c.rit,note:c.note,by:actor,at},...(p.claims||[])].slice(0,50);
  }else if(c.type==='void-payment'){
   const payment=p.payments.find(x=>x.id===c.paymentId);if(!payment||!text(c.note,1000))fail('Pilih kasbon dan isi alasan pembatalan.');
   p.voidedPayments=[...(p.voidedPayments||[]),{...payment,voidedBy:actor,voidedAt:at,note:c.note}];p.payments=p.payments.filter(x=>x.id!==c.paymentId);
  }else if(c.type==='reconcile'){
   if(!Array.isArray(c.sources)||c.sources.length!==p.sources.length||new Set(c.sources.map(x=>x.id)).size!==c.sources.length)fail('Konfirmasi setiap sumber yang dicocokkan.');
   const old=structuredClone(p.sources),replacement=[];for(const source of p.sources){const allocation=c.sources.find(x=>x.id===source.row.id);if(!allocation||!integer(allocation.rit,100000))fail('Alokasi sumber tidak valid.');if(allocation.rit){const row=snapshot(allocation.id);if(!row)fail('Sumber sudah dihapus. Gunakan 0 untuk melepas sumber.');replacement.push({row:structuredClone(row),rit:allocation.rit});}}
   p.sources=replacement;for(const s of replacement)if(allocatedRit(next,s.row.id)>s.row.rit)fail('Rit sumber sudah digunakan paket lain.');p.reconciliations=[{by:actor,at,before:old},...(p.reconciliations||[])].slice(0,30);
  }else if(c.type==='edit-proof'){
   const proof=p.proofs.find(x=>x.id===c.proofId);if(!proof||proof.status==='verified')fail('Bukti terverifikasi dikunci.');
   if(c.date>today()||c.date<p.date)fail('Tanggal surat jalan tidak sesuai paket.');
   proof.history=[...(proof.history||[]),{reference:proof.reference,date:proof.date,url:proof.url,status:proof.status,by:actor,at}];
   Object.assign(proof,{reference:c.reference?.trim(),date:c.date,url:c.url,status:'pending',submittedBy:actor,submittedAt:at});delete proof.reviewedBy;delete proof.reviewedAt;
  }else if(c.type==='proof'){
   if(c.date>today()||c.date<p.date)fail('Tanggal surat jalan harus berada antara awal paket dan hari ini.');
   p.proofs.push({id,reference:c.reference?.trim(),date:c.date,url:c.url,status:'pending',submittedBy:actor,submittedAt:at});
  }else if(c.type==='review'){
   const proof=p.proofs.find(x=>x.id===c.proofId);if(!proof||proof.status!=='pending'||!['verified','rejected'].includes(c.status))fail('Surat jalan ini sudah ditinjau atau tidak ditemukan.');
   proof.status=c.status;proof.reviewedBy=actor;proof.reviewedAt=at;
  }else if(c.type==='close'){
   const summary=packageSummary(p,next);if(summary.pending)fail('Tinjau seluruh surat jalan sebelum penyelesaian.');if(summary.shortfall)fail('Uang jalan terverifikasi melebihi dana. Lengkapi pendanaan sebelum penyelesaian.');if(!text(c.note,1000))fail('Isi catatan penyelesaian, terutama jika target belum tercapai.');
   if(sourceConflicts(p,transactions).length)fail('Sumber revenue berubah. Sesuaikan data Accounting dengan sumber paket sebelum penyelesaian.');
   for(const payment of p.payments.filter(x=>x.sourceId)){const t=snapshot(payment.sourceId);if(!t||t.plate!==p.plate||t.type!=='Pengeluaran'||t.category!=='Uang jalan'||t.expense!==payment.amount||t.date!==payment.date)fail('Sumber kasbon berubah. Periksa transaksi Accounting terlebih dahulu.');}
   p.closed={by:actor,at,note:c.note,balance:summary.balance};
  }else fail('Aksi kontrol tidak dikenal.');
 }
 next.revision=current.revision+1;next.updatedAt=at;next.audit=[{id,at,by:actor,type:c.type,packageId:p?.id||(c.type==='create'?id:'')},...next.audit].slice(0,300);
 return validateControl(next);
}
