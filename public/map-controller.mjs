export function mountOperationsMap(root){
 if(!root||!window.L)return ()=>{};
 const L=window.L;
 const map=L.map(root,{scrollWheelZoom:false,zoomControl:false,attributionControl:true}).setView([-6.126,106.883],12);
 L.control.zoom({position:'topright',zoomInTitle:'Perbesar peta',zoomOutTitle:'Perkecil peta'}).addTo(map);
 const status=root.parentElement.querySelector('[data-map-status]');let loaded=0,failed=0;
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'});
 tiles.on('tileload',()=>{loaded++;if(status)status.textContent='Jakarta Utara · Referensi wilayah';});
 tiles.on('tileerror',e=>{failed++;if(e.tile)e.tile.style.visibility='hidden';if(!loaded&&failed>2&&status)status.textContent='Referensi lokasi · peta jalan belum tersedia';});
 tiles.addTo(map);
 for(const point of [{name:'Penjaringan',lat:-6.1276,lng:106.7900},{name:'Tanjung Priok',lat:-6.1296,lng:106.8777},{name:'Kelapa Gading',lat:-6.1590,lng:106.9050},{name:'Cilincing',lat:-6.1255,lng:106.9400}]){L.circleMarker([point.lat,point.lng],{radius:4,color:'#536e7f',weight:1,fillColor:'#f9faf7',fillOpacity:1,interactive:false}).addTo(map).bindTooltip(point.name,{permanent:true,direction:'bottom',className:'district-reference-label',offset:[0,4]});}

 L.circleMarker([-6.1066,106.8848],{radius:9,color:'#185e88',weight:3,fillColor:'#55b9d2',fillOpacity:1}).addTo(map).bindPopup('<strong>Pelabuhan Tanjung Priok</strong><br>Lokasi referensi wilayah, bukan posisi kendaraan.');
 const views={north:{center:[-6.126,106.883],zoom:12},port:{center:[-6.1066,106.8848],zoom:14}};
 const handler=e=>{const b=e.target.closest('[data-map-view]');if(!b)return;const view=views[b.dataset.mapView];if(view)map.setView(view.center,view.zoom,{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});};
 root.parentElement.addEventListener('click',handler);requestAnimationFrame(()=>map.invalidateSize());
 return ()=>{root.parentElement?.removeEventListener('click',handler);map.remove();};
}
