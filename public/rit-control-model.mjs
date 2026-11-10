import {validPlate,plates,clientKey,today,isTravelCash} from './domain.mjs';
export const emptyControl=()=>({version:1,revision:0,owners:['','',''],packages:[],audit:[]});
const fail=message=>{throw Error(message);};
const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const integer=(v,max=1e13)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function evidenceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=1500;}catch{return false;}}
export function sourceSignature(t){return JSON.stringify([t.id,t.plate,t.type,t.date,t.period,t.description,clientKey(t.customer),t.rit,t.income,t.expense,t.category]);}
export function packageSummary(p,state){
 const verified=p.proofs.filter(x=>x.status==='verified').length+(p.actuals||[]).reduce((n,x)=>n+x.rit,0),pending=p.proofs.filter(x=>x.status==='pending').length;
 const cash=p.payments.reduce((n,x)=>n+x.amount,0),previous=state.packages.find(x=>x.id===p.carryFrom),carry=previous?.closed?.balance||0;
 const funded=cash+carry,accounted=verified*p.rate,balance=Math.max(0,funded-accounted),shortfall=Math.max(0,accounted-funded);
 const reported=p.reportedRit??null,claimGap=reported===null?0:Math.max(0,reported-verified);
 const stage=p.closed?'closed':funded<p.target*p.rate?'funding':verified>=p.target?'settlement':pending?'verification':'execution';
 return {reported,claimGap,verified,pending,cash,carry,funded,accounted,balance,shortfall,stage,topup:Math.max(0,p.target*p.rate-funded),excess:Math.max(0,verified-p.target),remaining:Math.max(0,p.target-verified)};
}
// Keep signed differences until after aggregation, so excess trips offset remaining trips.
export function controlTotals(packages,state){
 const included=new Set(packages.map(p=>p.id));
 return packages.reduce((total,p)=>{
  const m=packageSummary(p,state);
  // A carry within this selection is a transfer, not new funding.
  total.funded+=m.cash+(included.has(p.carryFrom)?0:m.carry);
  total.verified+=m.verified;
  total.target+=p.target;
  total.accounted+=m.accounted;
  total.netRit=total.target-total.verified;
  total.netFunds=total.funded-total.accounted;
  return total;
 },{funded:0,verified:0,target:0,accounted:0,netRit:0,netFunds:0});
}
export function allocatedRit(control,id){return control.packages.reduce((n,p)=>n+p.sources.filter(s=>s.row.id===id).reduce((a,s)=>a+s.rit,0),0);}
export function sourceConflicts(p,transactions){return p.sources.filter(s=>{const row=transactions.find(t=>t.id===s.row.id);return !row||sourceSignature(row)!==sourceSignature(s.row);});}
export function validateControl(s){
 if(!s||s.version!==1||!integer(s.revision)||!Array.isArray(s.owners)||s.owners.length!==3||s.owners.some(x=>typeof x!=='string'||x.length>100)||!Array.isArray(s.packages)||s.packages.length>2000||!Array.isArray(s.audit))fail('Format kontrol rit tidak valid.');
 if(s.vehiclePlates!==undefined&&(!Array.isArray(s.vehiclePlates)||s.vehiclePlates.length>1000||s.vehiclePlates.some(p=>!validPlate(p))))fail('Daftar armada kontrol tidak valid.');
 const ids=new Set(),refs=new Set(),fundingRefs=new Set(),usedSources=new Map(),carryUsed=new Set();
 for(const p of s.packages){
  if(!text(p.id,100)||ids.has(p.id)||!text(p.name)||![...plates,...(s.vehiclePlates||[])].includes(p.plate)||!(p.simple?typeof p.driver==='string':text(p.driver))||!(p.simple?typeof p.customer==='string':text(p.customer))||!date(p.date)||!integer(p.target,100)||!p.target||!integer(p.rate,1e9)||!p.rate||!(p.simple?typeof p.owner==='string':text(p.owner,100))||!Array.isArray(p.sources)||!Array.isArray(p.payments)||!Array.isArray(p.proofs)||p.sources.length>300||p.proofs.length>300||p.payments.length>100)fail('Paket rit tidak valid.');
  ids.add(p.id);
  if(p.actuals!==undefined&&(!Array.isArray(p.actuals)||p.actuals.length>300||p.actuals.some(x=>!text(x.id,100)||!integer(x.rit,100000)||!x.rit||!date(x.date)||!text(x.description,500)||!text(x.by)||!text(x.at))))fail('Catatan rit selesai tidak valid.');
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
export function applyControlCommand(current,command,{actor,id,at,transactions,vehiclePlates=[],deletedTransactionIds=[]}){
 validateControl(current);if(!text(actor)||!text(id)||!text(at)||!command||!text(command.type))fail('Permintaan kontrol tidak valid.');
 const next=structuredClone(current),c=command,p=next.packages.find(x=>x.id===c.packageId);
 next.vehiclePlates=[...new Set([...plates,...(current.vehiclePlates||[]),...vehiclePlates])];
 deletedTransactionIds=[...new Set([...(current.removedSourceIds||[]),...deletedTransactionIds])];next.removedSourceIds=deletedTransactionIds;
 const snapshot=key=>transactions.find(t=>t.id===key);
 const addSources=(packageItem,allocations)=>{if(!Array.isArray(allocations)||allocations.length>300)fail('Pilih sumber transaksi yang valid.');for(const a of allocations){const row=snapshot(a.id);if(!row)fail('Sumber transaksi tidak ditemukan. Muat ulang Accounting.');if(!integer(a.rit,row.rit)||allocatedRit(next,row.id)+(next.packages.includes(packageItem)?0:packageItem.sources.filter(s=>s.row.id===row.id).reduce((n,s)=>n+s.rit,0))+a.rit>row.rit)fail('Rit sumber sudah digunakan paket lain.');const existing=packageItem.sources.find(s=>s.row.id===row.id);if(existing){if(sourceSignature(existing.row)!==sourceSignature(row))fail('Cocokkan sumber yang berubah sebelum menambah alokasi.');existing.rit+=a.rit;}else packageItem.sources.push({row:structuredClone(row),rit:a.rit});}};
 if(c.type==='sync-funding'){
  const deletedCash=new Set(deletedTransactionIds);
  const removed=next.packages.filter(item=>item.payments.concat(item.voidedPayments||[]).some(pay=>deletedCash.has(pay.sourceId))||deletedCash.has(item.id.replace(/^cash-/,''))&&item.simple);
  if(removed.length){
   const removedIds=new Set(removed.map(item=>item.id));
   next.deletedPackages=[...(next.deletedPackages||[]),...removed.map(item=>({package:structuredClone(item),by:actor,at,note:'Transaksi uang jalan dihapus dari Buku transaksi'}))];
   next.packages=next.packages.filter(item=>!removedIds.has(item.id));
   // A surviving legacy control must no longer spend a deleted control's carry.
   for(const item of next.packages.filter(item=>removedIds.has(item.carryFrom))){
    item.carryHistory=[...(item.carryHistory||[]),{carryFrom:item.carryFrom,closed:structuredClone(item.closed),by:actor,at}];
    item.carryFrom='';
    if(item.closed){const summary=packageSummary(item,next);if(summary.shortfall)item.closed=null;else item.closed.balance=summary.balance;}
   }
  }
  for(const item of next.packages.filter(x=>!x.closed)){const removed=item.payments.filter(pay=>pay.sourceId&&(deletedTransactionIds.includes(pay.sourceId)||snapshot(pay.sourceId)&&(!isTravelCash(snapshot(pay.sourceId))||snapshot(pay.sourceId).plate!==item.plate)));if(removed.length){item.voidedPayments=[...(item.voidedPayments||[]),...removed.map(pay=>({...pay,voidedBy:actor,voidedAt:at,note:'Sumber transaksi dihapus atau berubah'}))];item.payments=item.payments.filter(pay=>!removed.includes(pay));}const oldSources=item.sources.filter(source=>deletedTransactionIds.includes(source.row.id));if(oldSources.length){item.reconciliations=[{by:actor,at,before:structuredClone(item.sources),note:'Revenue lama dihapus dari Buku transaksi'},...(item.reconciliations||[])];item.sources=item.sources.filter(source=>!deletedTransactionIds.includes(source.row.id));}}
  for(const t of transactions.filter(t=>isTravelCash(t)&&!(next.excludedFundingIds||[]).includes(t.id)&&!deletedTransactionIds.includes(t.id))){
   if(!date(t.date)||t.date>today())continue;
   const existing=next.packages.find(x=>x.payments.some(pay=>pay.sourceId===t.id));
   if(existing){if(!existing.closed){const pay=existing.payments.find(x=>x.sourceId===t.id);if(pay.amount!==t.expense||pay.date!==t.date){existing.paymentHistory=[...(existing.paymentHistory||[]),{...pay,changedAt:at,changedBy:actor}];pay.amount=t.expense;pay.date=t.date;}}continue;}
   const target=Math.min(100,Math.max(1,Number(t.description.match(/(\d+)\s*rit\b/i)?.[1])||5));
   const created={id:'cash-'+t.id,simple:true,name:t.description,plate:t.plate,driver:'',customer:'',owner:'',date:t.date,target,rate:Number.isSafeInteger(t.expense/target)?t.expense/target:200000,sources:[],payments:[{id:'payment-'+t.id,amount:t.expense,date:t.date,reference:'Buku transaksi · '+t.id,sourceId:t.id,by:actor,at}],proofs:[],actuals:[],carryFrom:'',createdBy:actor,createdAt:at,closed:null};
   const prior=next.packages.find(x=>x.id===created.id);if(prior){if(!prior.closed)prior.payments.push(created.payments[0]);continue;}next.packages.push(created);
  }
 }else if(c.type==='delete-package'){
  if(!p||!text(c.note,1000))fail('Pilih kontrol rit dan isi alasan penghapusan.');
  if(next.packages.some(x=>x.carryFrom===p.id))fail('Saldo kontrol ini masih digunakan kontrol lain. Periksa rantai saldo sebelum menghapus.');
  next.deletedPackages=[...(next.deletedPackages||[]),{package:structuredClone(p),by:actor,at,note:c.note}];
  next.excludedFundingIds=[...new Set([...(next.excludedFundingIds||[]),...p.payments.filter(x=>x.sourceId).map(x=>x.sourceId),...p.voidedPayments?.filter(x=>x.sourceId).map(x=>x.sourceId)||[]])];
  next.packages=next.packages.filter(x=>x.id!==p.id);
 }else if(c.type==='owners'){if(!Array.isArray(c.names)||c.names.length!==3||c.names.some(x=>!text(x,100)))fail('Isi nama ketiga owner.');if(new Set(c.names.map(x=>x.trim().toLowerCase())).size!==3)fail('Nama ketiga owner harus berbeda.');next.owners=c.names.map(x=>x.trim());}
 else if(c.type==='create'){
  if(!c.simple&&(!next.owners.includes(c.owner)||!c.owner))fail('Pilih owner penanggung jawab.');
  if(!c.simple&&next.packages.some(x=>!x.closed&&x.plate===c.plate))fail('Selesaikan paket aktif armada ini sebelum membuat paket berikutnya.');
  const created={id,simple:Boolean(c.simple),name:c.name,plate:c.plate,driver:c.driver?.trim()||'',customer:c.customer||'',date:c.date,target:c.target,rate:c.rate,owner:c.owner||'',sources:[],payments:[],proofs:[],carryFrom:c.carryFrom||'',createdBy:actor,createdAt:at,closed:null};addSources(created,c.sources||[]);next.packages.push(created);
 }else{
  if(!p)fail('Paket tidak ditemukan.');if(p.closed)fail('Paket sudah diselesaikan dan dikunci.');
  if(c.type==='record-rit'){
   if(c.plate!==undefined&&c.plate!==p.plate)fail('Pilih uang jalan pada armada yang sama.');
   if(!integer(c.rit,100000)||!c.rit||!date(c.date)||c.date<p.date||c.date>today()||!text(c.description,500))fail('Isi tanggal, uraian, dan jumlah rit selesai yang valid.');
   p.actuals=[...(p.actuals||[]),{id,rit:c.rit,date:c.date,description:c.description,by:actor,at}];
  }else if(c.type==='edit-rit'){
   const entry=(p.actuals||[]).find(x=>x.id===c.entryId);if(!entry)fail('Order tidak ditemukan atau sudah dihapus.');
   if(!integer(c.rit,100000)||!c.rit||!date(c.date)||c.date<p.date||c.date>today()||!text(c.description,500))fail('Isi tanggal, uraian, dan jumlah rit order yang valid.');
   entry.history=[...(entry.history||[]),{date:entry.date,description:entry.description,rit:entry.rit,by:entry.updatedBy||entry.by,at:entry.updatedAt||entry.at,editedBy:actor,editedAt:at}];
   Object.assign(entry,{date:c.date,description:c.description,rit:c.rit,updatedBy:actor,updatedAt:at});
  }else if(c.type==='void-rit'){
   const entry=(p.actuals||[]).find(x=>x.id===c.entryId);if(!entry||!text(c.note,1000))fail('Isi alasan koreksi rit.');
   p.voidedActuals=[...(p.voidedActuals||[]),{...entry,voidedBy:actor,voidedAt:at,note:c.note}];p.actuals=p.actuals.filter(x=>x.id!==c.entryId);
  }else if(c.type==='edit-simple'){
   if(!text(c.name)||!integer(c.target,100)||!c.target||!integer(c.rate,1e9)||!c.rate||c.target<packageSummary(p,next).verified)fail('Uraian, target, atau tarif rit tidak valid.');
   p.settingsHistory=[...(p.settingsHistory||[]),{name:p.name,target:p.target,rate:p.rate,by:actor,at}];Object.assign(p,{name:c.name,target:c.target,rate:c.rate});
  }else if(c.type==='sources')addSources(p,c.sources);
  else if(c.type==='fund'){
   let amount=c.amount,reference=c.reference,dateValue=c.date;
   if(c.sourceId){const row=snapshot(c.sourceId);if(!row||!isTravelCash(row)||row.plate!==p.plate||!row.expense)fail('Pilih transaksi Uang jalan pada armada yang sama.');amount=row.expense;reference='Accounting · '+row.id;dateValue=row.date;if(!dateValue)fail('Lengkapi tanggal transaksi di Accounting terlebih dahulu.');}
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
   for(const payment of p.payments.filter(x=>x.sourceId)){const t=snapshot(payment.sourceId);if(!t||t.plate!==p.plate||!isTravelCash(t)||t.expense!==payment.amount||t.date!==payment.date)fail('Sumber kasbon berubah. Periksa transaksi Accounting terlebih dahulu.');}
   p.closed={by:actor,at,note:c.note,balance:summary.balance};
  }else fail('Aksi kontrol tidak dikenal.');
 }
 next.revision=current.revision+1;next.updatedAt=at;next.audit=[{id,at,by:actor,type:c.type,packageId:p?.id||(c.type==='create'?id:'')},...next.audit].slice(0,300);
 return validateControl(next);
}

export function fundingNeedsSync(control,transactions,deletedTransactionIds=[]){
 deletedTransactionIds=[...new Set([...(control.removedSourceIds||[]),...deletedTransactionIds])];
 if(control.packages.some(p=>p.payments.concat(p.voidedPayments||[]).some(pay=>deletedTransactionIds.includes(pay.sourceId))||p.simple&&deletedTransactionIds.includes(p.id.replace(/^cash-/,''))))return true;
 if(control.packages.some(p=>!p.closed&&(p.sources.some(x=>deletedTransactionIds.includes(x.row.id))||p.payments.some(pay=>pay.sourceId&&(deletedTransactionIds.includes(pay.sourceId)||transactions.some(t=>t.id===pay.sourceId&&(!isTravelCash(t)||t.plate!==p.plate)))))))return true;
 return transactions.filter(t=>isTravelCash(t)&&!(control.excludedFundingIds||[]).includes(t.id)&&!deletedTransactionIds.includes(t.id)).some(t=>{if(!date(t.date)||t.date>today())return false;const p=control.packages.find(p=>p.payments.some(x=>x.sourceId===t.id));if(!p)return !control.packages.some(p=>p.id==='cash-'+t.id&&p.closed);const pay=p.payments.find(x=>x.sourceId===t.id);return !p.closed&&(pay.amount!==t.expense||pay.date!==t.date);});
}

export function completedOrderSummary(packages){
 const groups=new Map();
 for(const p of packages){
  for(const entry of [...(p.actuals||[]),...p.proofs.filter(x=>x.status==='verified').map(x=>({description:x.reference,rit:1}))]){
   const description=entry.description.trim().replace(/\s+/g,' '),key=description.toLocaleLowerCase('id-ID');
   const row=groups.get(key)||{description,rit:0};row.rit+=entry.rit;groups.set(key,row);
  }
 }
 return [...groups.values()].sort((a,b)=>b.rit-a.rit||a.description.localeCompare(b.description,'id'));
}
