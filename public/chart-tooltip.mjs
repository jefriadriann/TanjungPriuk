// Render outside scrollable chart panels so the tallest bar cannot clip its label.
export function tooltipPosition(anchor,size,viewport){
 const margin=12,gap=10;
 const left=Math.max(margin,Math.min(anchor.left+anchor.width/2-size.width/2,viewport.width-size.width-margin));
 const above=anchor.top-size.height-gap;
 const top=Math.max(margin,Math.min(above>=margin?above:anchor.top+gap,viewport.height-size.height-margin));
 return {left,top};
}
export function installChartTooltip(root){
 const tooltip=document.createElement('div');tooltip.id='chart-tooltip';tooltip.className='chart-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
 const label=document.createElement('span'),value=document.createElement('strong');tooltip.append(label,value);document.body.append(tooltip);
 let active=null;
 function hide(){if(active)active.removeAttribute('aria-describedby');active=null;tooltip.hidden=true;}
 function show(bar){
  if(!bar||!bar.isConnected||document.querySelector('dialog[open]'))return;
  const anchor=bar.getBoundingClientRect(),plot=bar.closest('.chart-scroll').getBoundingClientRect();
  if(anchor.bottom<0||anchor.top>window.innerHeight||anchor.right<plot.left||anchor.left>plot.right){hide();return;}
  if(active!==bar)hide();active=bar;
  label.textContent=bar.dataset.tooltipLabel;value.textContent=bar.dataset.tooltipValue;tooltip.dataset.tone=bar.dataset.chartSeries;
  tooltip.hidden=false;bar.setAttribute('aria-describedby',tooltip.id);
  const {left,top}=tooltipPosition(bar.getBoundingClientRect(),tooltip.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight});
  tooltip.style.left=left+'px';tooltip.style.top=top+'px';
 }
 const barFor=target=>target instanceof Element?target.closest('.bar[data-chart-month]'):null;
 root.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const bar=barFor(e.target);if(bar&&!bar.contains(e.relatedTarget))show(bar);});
 root.addEventListener('pointerout',e=>{const bar=barFor(e.target);if(bar&&!bar.contains(e.relatedTarget)&&!tooltip.contains(e.relatedTarget)&&document.activeElement!==bar)hide();});
 tooltip.addEventListener('pointerleave',e=>{if(active&&!active.contains(e.relatedTarget)&&document.activeElement!==active)hide();});
 root.addEventListener('focusin',e=>{const bar=barFor(e.target);if(bar)show(bar);});
 root.addEventListener('focusout',e=>{if(barFor(e.target))hide();});
 root.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 window.addEventListener('scroll',()=>{if(active)show(active);},true);window.addEventListener('resize',hide);
 return hide;
}
