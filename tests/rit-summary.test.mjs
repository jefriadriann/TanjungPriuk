import test from 'node:test';
import assert from 'node:assert/strict';
import {controlTotals} from '../public/rit-control-model.mjs';
import {plates} from '../public/domain.mjs';
const pack=(id,rit,{plate=plates[0],date='2026-11-01',target=5,rate=200000,amount=1000000,...extra}={})=>({id,plate,date,target,rate,payments:[{amount}],proofs:[],actuals:[{rit}],...extra});
const sum=packages=>controlTotals(packages,{packages});
test('three advances with 17 completed trips report two excess trips and 400k shortfall',()=>{
 assert.deepEqual(sum([pack('a',6),pack('b',5),pack('c',6)]),{funded:3000000,verified:17,target:15,accounted:3400000,netRit:-2,netFunds:-400000});
});
test('positive and negative balances offset before applying display labels',()=>{
 const data=[pack('remaining',2),pack('extra',7)];assert.equal(sum(data).netRit,1);assert.equal(sum(data).netFunds,200000);
 const zero=[pack('remaining',3),pack('extra',7)];assert.equal(sum(zero).netRit,0);assert.equal(sum(zero).netFunds,0);
 assert.equal(sum([pack('extra',8),pack('remaining',3)]).netRit,-1);
});
test('same calculation covers every fleet, every month, all statuses, and combined selections',()=>{
 const data=[];
 for(const plate of plates)for(let month=1;month<=12;month++){
  const date=`2026-${String(month).padStart(2,'0')}-01`;
  data.push(pack(`${plate}-${month}-a`,6,{plate,date}),pack(`${plate}-${month}-b`,5,{plate,date,closed:{balance:0}}));
 }
 for(const plate of plates)for(let month=1;month<=12;month++){
  const selected=data.filter(p=>p.plate===plate&&Number(p.date.slice(5,7))===month);
  assert.equal(sum(selected).netRit,-1);assert.equal(sum(selected).netFunds,-200000);
 }
 const all=sum(data);assert.equal(all.netRit,-96);assert.equal(all.netFunds,-19200000);
 assert.equal(sum(data.filter(p=>p.closed)).netRit,0);assert.equal(sum([]).netFunds,0);
});
test('uses each control rate and verified proofs, without mutating saved records',()=>{
 const data=[pack('low',6,{rate:100000}),pack('high',2,{rate:300000,proofs:[{status:'verified'},{status:'pending'}]})],before=structuredClone(data);
 assert.equal(sum(data).netFunds,500000);assert.equal(sum(data).netRit,1);assert.deepEqual(data,before);
});
test('carried cash is counted once when both controls are selected and remains available when only recipient is selected',()=>{
 const previous=pack('previous',3,{closed:{balance:400000}}),next=pack('next',5,{amount:600000,carryFrom:'previous'}),state={packages:[previous,next]};
 const all=controlTotals(state.packages,state);assert.equal(all.funded,1600000);assert.equal(all.netFunds,0);
 const recipient=controlTotals([next],state);assert.equal(recipient.funded,1000000);assert.equal(recipient.netFunds,0);
});
