// Shared floating hints for bar charts, donut segments and their legends.
export function tooltipPosition(anchor,size,viewport){
 const margin=12,gap=10;
 const left=Math.max(margin,Math.min(anchor.left+anchor.width/2-size.width/2,viewport.width-size.width-margin));
 const above=anchor.top-size.height-gap;
 const top=Math.max(margin,Math.min(above>=margin?above:anchor.top+gap,viewport.height-size.height-margin));
 return {left,top};
}
export function installChartTooltip(root){
 const tooltip=document.createElement('div');tooltip.id='chart-tooltip';tooltip.className='chart-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
 const label=document.createElement('span'),value=document.createElement('strong'),meta=document.createElement('small');tooltip.append(label,value,meta);document.body.append(tooltip);
 let active=null;
 function hide(){if(active)active.removeAttribute('aria-describedby');active=null;tooltip.hidden=true;}
 function show(trigger){
  if(!trigger||!trigger.isConnected||document.querySelector('dialog[open]'))return;
  const anchor=trigger.getBoundingClientRect(),plot=trigger.closest('.chart-scroll,.client-distribution').getBoundingClientRect();
  if(anchor.bottom<0||anchor.top>window.innerHeight||anchor.right<plot.left||anchor.left>plot.right){hide();return;}
  if(active!==trigger)hide();active=trigger;
  label.textContent=trigger.dataset.tooltipLabel;value.textContent=trigger.dataset.tooltipValue;meta.textContent=trigger.dataset.tooltipMeta||'';meta.hidden=!meta.textContent;tooltip.dataset.tone=trigger.dataset.tooltipTone||trigger.dataset.chartSeries;
  if(/^#[0-9a-f]{6}$/i.test(trigger.dataset.tooltipColor||''))tooltip.style.setProperty('--tooltip-client-color',trigger.dataset.tooltipColor);else tooltip.style.removeProperty('--tooltip-client-color');
  tooltip.hidden=false;trigger.setAttribute('aria-describedby',tooltip.id);
  const {left,top}=tooltipPosition(trigger.getBoundingClientRect(),tooltip.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight});
  tooltip.style.left=left+'px';tooltip.style.top=top+'px';
 }
 const triggerFor=target=>target instanceof Element?target.closest('[data-tooltip-label][data-tooltip-value]'):null;
 root.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const bar=triggerFor(e.target);if(bar&&!bar.contains(e.relatedTarget))show(bar);});
 root.addEventListener('pointerout',e=>{const bar=triggerFor(e.target);if(bar&&!bar.contains(e.relatedTarget)&&!tooltip.contains(e.relatedTarget)&&document.activeElement!==bar)hide();});
 tooltip.addEventListener('pointerleave',e=>{if(active&&!active.contains(e.relatedTarget)&&document.activeElement!==active)hide();});
 root.addEventListener('focusin',e=>{const bar=triggerFor(e.target);if(bar)show(bar);});
 root.addEventListener('focusout',e=>{if(triggerFor(e.target))hide();});
 root.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 window.addEventListener('scroll',()=>{if(active)show(active);},true);window.addEventListener('resize',hide);
 return hide;
}
