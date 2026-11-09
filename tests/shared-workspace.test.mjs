import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,validate} from '../lib/model.mjs';
import {emptyControl,applyControlCommand} from '../public/rit-control-model.mjs';
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
