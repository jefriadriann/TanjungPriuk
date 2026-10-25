import test from 'node:test';
import assert from 'node:assert/strict';
import {tooltipPosition} from '../public/chart-tooltip.mjs';
const size={width:230,height:80};
test('tall chart bars can display their tooltip above the plot without chart-boundary clamping',()=>{
 const p=tooltipPosition({left:500,top:200,width:30},size,{width:1440,height:900});assert.ok(p.top+size.height<200);assert.ok(p.left<=500&&p.left+size.width>=530);
});
test('tooltip remains inside narrow viewports at either horizontal edge',()=>{
 for(const left of [-15,0,290,500]){const p=tooltipPosition({left,top:180,width:30},size,{width:320,height:844});assert.ok(p.left>=12);assert.ok(p.left+size.width<=308);}
});
test('tooltip flips below its anchor near the top and stays inside short viewports',()=>{
 const p=tooltipPosition({left:20,top:5,width:28},size,{width:320,height:200});assert.ok(p.top>5);assert.ok(p.top+size.height<=188);
 const low=tooltipPosition({left:20,top:190,width:28},size,{width:320,height:200});assert.ok(low.top>=12&&low.top+size.height<=188);
});
