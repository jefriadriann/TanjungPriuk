import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,validate} from '../lib/model.mjs';
import {emptyControl,applyControlCommand,unlinkedTravelCash,controlTotals,packageSummary} from '../public/rit-control-model.mjs';
import {mergeBrowserWorkspace,recoverTravelCash,sharedWorkspaceRequest} from '../lib/shared-workspace.mjs';
const cash={id:'cash-nov',plate:'B 9322 UOM',date:'2026-11-01',period:'November 2026',description:'Uang Jalan 5 Rit',type:'Pengeluaran',category:'Uang jalan',income:0,expense:1000000,rit:0,customer:''};
const stamp={by:'team@example.com',at:'2026-11-09T10:00:00Z'};
const workspace=(rows=[])=>({...empty(),transactions:rows});
const funded=()=>applyControlCommand(emptyControl(),{type:'sync-funding'},{actor:stamp.by,id:'fund',at:stamp.at,transactions:[cash]});
test('recovers November advance with original source ID and exact amount, without creating income or duplicates',()=>{
 const control=funded(),next=recoverTravelCash(workspace(),control,stamp);assert.equal(next.transactions.length,1);assert.equal(next.transactions[0].id,cash.id);assert.equal(next.transactions[0].expense,1000000);assert.equal(next.transactions[0].income,0);assert.ok(next.transactions[0].recoveredFromControl);validate(next);assert.equal(recoverTravelCash(next,control,stamp).transactions.length,1);
 for(const deleted of [{...workspace(),deletedTransactionIds:[cash.id]},{...workspace(),deletedTransactionIds:[]}]){const c=structuredClone(control);if(!deleted.deletedTransactionIds.length)c.excludedFundingIds=[cash.id];assert.equal(recoverTravelCash(deleted,c,stamp).transactions.length,0);}
});
test('browser migration adds missing manual entries but preserves newer shared edits and deletion tombstones',()=>{
 const baseline=workspace([cash]),current=workspace([{...cash,expense:1400000}]);current.deletedTransactionIds=['removed'];
 const browser=workspace([{...cash,expense:1200000},{...cash,id:'manual'},{...cash,id:'removed'}]);const next=mergeBrowserWorkspace(current,browser,baseline,stamp);
 assert.equal(next.transactions.find(x=>x.id===cash.id).expense,1400000);assert.equal(next.transactions.filter(x=>x.id==='manual').length,1);assert.ok(!next.transactions.some(x=>x.id==='removed'));assert.equal(next.migrationConflicts.length,1);assert.equal(next.migrationConflicts[0].browser.expense,1200000);assert.equal(current.transactions.length,1);
});
test('browser corrections apply only against an unchanged baseline and never resurrect missing source rows',()=>{
 const baseline=workspace([cash]),local=workspace([{...cash,description:'Updated description'}]);assert.equal(mergeBrowserWorkspace(baseline,local,baseline,stamp).transactions[0].description,'Updated description');assert.equal(mergeBrowserWorkspace(workspace(),local,baseline,stamp).transactions.length,0);
 const deleted={...workspace(),deletedTransactionIds:[cash.id]};const next=mergeBrowserWorkspace(baseline,deleted,baseline,stamp);assert.equal(next.transactions.length,1);assert.ok(next.migrationConflicts[0].browserDeleted);
});
test('two devices read the same saved workspace; stale revisions and concurrent control writes cannot overwrite it',async()=>{
 const oldFetch=globalThis.fetch,oldFlag=process.env.PUBLIC_EXCEL_IMPORT;delete process.env.PUBLIC_EXCEL_IMPORT;
 let db={revision:funded().revision,state:funded()},race=false;
 globalThis.fetch=async(url,options={})=>{if(options.method==='PATCH'){const b=JSON.parse(options.body);if(race||!String(url).includes('revision=eq.'+db.revision))return Response.json([]);db=b;return Response.json([db]);}return Response.json([structuredClone(db)]);};
 const call=async(method='GET',body,action='state')=>{let result;await sharedWorkspaceRequest({url:'/api/index?action='+action,method,body},{url:'https://db.example',key:'publishable'},{email:stamp.by},'session',(status,data)=>result={status,data});return result;};
 try{
  const a=await call(),b=await call();assert.equal(a.status,200);assert.deepEqual(a.data,b.data);assert.equal(a.data.transactions[0].id,cash.id);
  const save=await call('PUT',{...a.data,transactions:[{...a.data.transactions[0],expense:1200000}]});assert.equal(save.status,200);assert.equal(db.state.packages[0].payments[0].amount,1200000);
  assert.equal((await call('PUT',b.data)).status,409);assert.equal((await call()).data.transactions[0].expense,1200000);
  race=true;assert.equal((await call('PUT',save.data)).status,409);race=false;
  const browser=workspace([{...cash,id:'browser-added'}]);assert.equal((await call('PUT',browser,'migrate-browser')).status,200);const rev=db.revision;assert.equal((await call('PUT',browser,'migrate-browser')).status,200);assert.equal(db.revision,rev);assert.equal(db.state.workspace.transactions.length,2);
 }finally{globalThis.fetch=oldFetch;if(oldFlag===undefined)delete process.env.PUBLIC_EXCEL_IMPORT;else process.env.PUBLIC_EXCEL_IMPORT=oldFlag;}
});

test('shared control uses authoritative financial rows even when an old device submits stale cash',async()=>{
 const {controlRequest}=await import('../lib/rit-control.mjs'),oldFetch=globalThis.fetch;
 let control=funded();control.workspace=workspace([{...cash,expense:1500000}]);let patch;
 globalThis.fetch=async(url,options={})=>{if(options.method==='PATCH'){patch=JSON.parse(options.body);return Response.json([patch]);}return Response.json([{revision:control.revision,state:control}]);};
 try{let result;await controlRequest({method:'PUT',body:{revision:control.revision,command:{type:'sync-funding'},transactions:[cash]}},{url:'https://db.example',key:'publishable'},{email:stamp.by},'session',(status,data)=>result={status,data});assert.equal(result.status,200);assert.equal(patch.state.packages[0].payments[0].amount,1500000);assert.equal(patch.state.workspace.transactions[0].expense,1500000);}finally{globalThis.fetch=oldFetch;}
});

test('all editable menus share one database across two approved accounts and a stale device cannot overwrite them',async()=>{
 const {default:handler}=await import('../api/workspace.mjs');
 const names=['VERCEL','REQUIRE_EMAIL_LOGIN','APP_ORIGIN','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','AUTH_ALLOWED_EMAILS','PUBLIC_EXCEL_IMPORT','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 Object.assign(process.env,{VERCEL:'1',REQUIRE_EMAIL_LOGIN:'1',APP_ORIGIN:'https://fleet.example',SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public-test',AUTH_ALLOWED_EMAILS:'first@example.com,second@example.com'});
 for(const k of ['PUBLIC_EXCEL_IMPORT','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])delete process.env[k];
 let db={revision:0,state:emptyControl()};const destinations=new Set();
 globalThis.fetch=async(url,options={})=>{
  if(String(url).includes('/auth/v1/user'))return Response.json({id:options.headers.Authorization,email:options.headers.Authorization==='Bearer first'?'first@example.com':'second@example.com',email_confirmed_at:'2026-01-01'});
  destinations.add(new URL(url).pathname);
  if(options.method==='PATCH'){if(!String(url).includes('revision=eq.'+db.revision))return Response.json([]);db=JSON.parse(options.body);return Response.json([db]);}
  return Response.json([structuredClone(db)]);
 };
 const call=async(account,action='state',body)=>{const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await handler({url:'/api/index?action='+action,method:body?'PUT':'GET',body,headers:{cookie:'tp_session='+account,origin:'https://fleet.example','content-type':'application/json'}},res);return res;};
 try{
  for(const account of ['first','second']){const status=await call(account,'status');assert.equal(status.body.storage,'cloud');assert.equal(status.body.sharedWorkspace,true);assert.equal(status.body.authenticated,true);}
  const first=await call('first'),stale=await call('second'),input=structuredClone(first.body);
  // Buku transaksi and Accounting edit the same transaction collection.
  input.transactions=[cash];
  input.clients=[{id:'client-test',name:'Client test',contact:'PIC',notes:'Klien & Revenue'}];
  input.fleet[0].status='Beroperasi';
  input.trips=[{id:'trip-test',plate:cash.plate,date:cash.date,customer:'Client test',driver:'Driver',origin:'Priok',destination:'Gudang',status:'Terjadwal'}];
  input.reports=[{id:'weekly-test',week:'2026-11-02',notes:'Laporan mingguan',status:'Draft'}];
  input.monthlyReports=[{id:'monthly-test',month:'2026-11',plate:'all',notes:'Laporan bulanan',preparedBy:'Tim',status:'Draft'}];
  const saved=await call('first','state',input);assert.equal(saved.statusCode,200);
  const second=await call('second');for(const key of ['transactions','clients','fleet','trips','reports','monthlyReports'])assert.deepEqual(second.body[key],input[key]);
  const controls=await call('second','rit-control');assert.equal(controls.body.packages[0].payments[0].amount,cash.expense);
  const rit=await call('second','rit-control',{revision:controls.body.revision,command:{type:'record-rit',packageId:controls.body.packages[0].id,plate:cash.plate,date:cash.date,description:'Client test',rit:2},transactions:[]});assert.equal(rit.statusCode,200);
  assert.equal((await call('first','rit-control')).body.packages[0].actuals[0].rit,2);
  assert.equal((await call('second','state',stale.body)).statusCode,409);
  assert.equal((await call('first')).body.transactions.length,1);
  assert.deepEqual([...destinations],['/rest/v1/tp_rit_control']);
  const removal=await call('first');removal.body.transactions=[];
  assert.equal((await call('first','state',removal.body)).statusCode,200);
  assert.equal(db.state.packages.length,0);
  assert.equal(db.state.deletedPackages.at(-1).package.actuals[0].rit,2);
  assert.equal((await call('second','rit-control')).body.packages.length,0);
  globalThis.fetch=async()=>{throw Error('Database unavailable');};
  assert.equal((await call('first','state',saved.body)).statusCode,500);
  assert.equal(db.state.workspace.transactions.length,0);
 }finally{globalThis.fetch=oldFetch;for(const k of names){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});

test('opening Kontrol Rit archives a previously deleted cash control from all statuses and exports',async()=>{
 const {controlRequest}=await import('../lib/rit-control.mjs');
 const {selectedControls,ritExportData}=await import('../public/rit-export.mjs');
 const oldFetch=globalThis.fetch,control=funded();
 control.packages[0].closed={...stamp,balance:cash.expense,note:'Settled'};
 control.workspace={...workspace(),deletedTransactions:[{...stamp,row:cash,reason:'Deleted'}]};
 assert.equal(recoverTravelCash(control.workspace,control,stamp).transactions.length,0);
 let db={revision:control.revision,state:control},writes=0;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='PATCH'){
   assert.ok(url.endsWith('&revision=eq.'+db.revision));
   db=JSON.parse(options.body);writes++;
  }
  return Response.json([structuredClone(db)]);
 };
 const read=async()=>{
  let result;
  await controlRequest({method:'GET'},{url:'https://db.example',key:'publishable'},{email:stamp.by},'session',(status,data)=>result={status,data});
  assert.equal(result.status,200);
  return result.data;
 };
 try{
  const result=await read();
  for(const status of ['active','closed','all']){
   const packages=selectedControls(result,{status,plate:cash.plate,period:cash.date.slice(0,7)});
   assert.equal(packages.length,0);
   assert.equal(ritExportData({packages,state:result,scope:''}).body.length,0);
  }
  assert.equal(result.deletedPackages[0].package.id,control.packages[0].id);
  assert.deepEqual(await read(),result);
  assert.equal(writes,1);
 }finally{globalThis.fetch=oldFetch;}
});

test('cash migration preserves existing orders and direct entry updates the shared ledger exactly once',async()=>{
 const {controlRequest}=await import('../lib/rit-control.mjs');
 const oldFetch=globalThis.fetch;
 const missing={...cash,id:'pending',date:null,expense:null,customer:'Klien lama'};
 const control=applyControlCommand(funded(),{type:'record-rit',packageId:'cash-'+cash.id,plate:cash.plate,date:cash.date,description:'Order sebelumnya',rit:2},{actor:stamp.by,id:'previous-order',at:stamp.at,transactions:[cash]});
 control.workspace=workspace([cash,{...cash,id:'another-receipt'},missing]);
 let db={revision:control.revision,state:control},writes=0;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='PATCH'){
   assert.ok(url.endsWith('&revision=eq.'+db.revision));
   db=JSON.parse(options.body);writes++;
  }
  return Response.json([structuredClone(db)]);
 };
 const call=async body=>{
  let result;
  await controlRequest({method:body?'PUT':'GET',body},{url:'https://db.example',key:'publishable'},{email:stamp.by},'session',(status,data)=>result={status,data});
  return result;
 };
 try{
  const migrated=(await call()).data;
  assert.equal(migrated.packages.length,2);
  assert.deepEqual(migrated.packages[0],control.packages[0]);
  assert.deepEqual(unlinkedTravelCash(migrated,migrated.workspace.transactions),[missing]);
  assert.deepEqual((await call()).data,migrated);
  assert.equal(writes,1);

  const command={type:'save-cash',plate:cash.plate,date:cash.date,description:'Pendanaan baru',amount:600000,target:3,rate:200000};
  const first=await call({revision:migrated.revision,command});
  assert.equal(first.status,200);
  assert.equal(first.data.workspace.revision,migrated.workspace.revision+1);
  const row=first.data.workspace.transactions.at(-1),p=first.data.packages.at(-1);
  assert.equal(p.payments[0].sourceId,row.id);
  assert.equal(p.plate,row.plate);
  assert.equal(p.target,3);
  assert.equal((await call({revision:migrated.revision,command})).status,409);

  const restored=await call({revision:first.data.revision,command:{...command,sourceId:missing.id}});
  assert.equal(restored.status,200);
  assert.equal(restored.data.packages.length,4);
  assert.equal(restored.data.workspace.transactions.find(t=>t.id===missing.id).customer,missing.customer);
  assert.equal(unlinkedTravelCash(restored.data,restored.data.workspace.transactions).length,0);

  const correction=await call({revision:restored.data.revision,command:{...command,sourceId:cash.id,amount:900000}});
  assert.equal(correction.status,200);
  assert.deepEqual(correction.data.packages[0].actuals,control.packages[0].actuals);
  assert.equal(correction.data.packages[0].payments[0].amount,900000);
  assert.equal(correction.data.workspace.transactions.find(t=>t.id===cash.id).expense,900000);
  assert.deepEqual((await call()).data,correction.data);
  assert.equal(writes,4);
  const custom=await call({revision:correction.data.revision,command:{type:'save-cash',plate:cash.plate,date:cash.date,description:'Uang jalan tambahan',amount:750000}});
  assert.equal(custom.status,200);
  const unplanned=custom.data.packages.at(-1);
  assert.equal(unplanned.target,null);
  assert.equal(unplanned.rate,null);
  const recorded=await call({revision:custom.data.revision,command:{type:'record-rit',packageId:unplanned.id,date:cash.date,rit:2,description:'Order tambahan'}});
  assert.equal(recorded.status,200);
  const entry=recorded.data.packages.at(-1);
  assert.equal(packageSummary(entry,recorded.data).balance,null);
  assert.equal(packageSummary(entry,recorded.data).remaining,null);
  const before=controlTotals(correction.data.packages,correction.data),after=controlTotals(recorded.data.packages,recorded.data);
  assert.deepEqual(after,{...before,funded:before.funded+750000,verified:before.verified+2});
  const closed=await call({revision:recorded.data.revision,command:{type:'close',packageId:unplanned.id,note:'Order selesai'}});
  assert.equal(closed.status,200);
  assert.equal(closed.data.packages.at(-1).closed.balance,null);

 }finally{globalThis.fetch=oldFetch;}
});
