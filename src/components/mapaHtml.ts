import type { Vaga } from '@/lib/api';

export type PinoVaga = { id: string; lat: number; lng: number; titulo: string; empresa: string; valor: string; urgente: boolean };

export function pinosDe(vagas: Vaga[], valor: (v: Vaga) => string): PinoVaga[] {
  return vagas
    .filter((v) => v.empresa?.lat != null && v.empresa?.lng != null)
    .map((v) => ({ id: v.id, lat: v.empresa!.lat!, lng: v.empresa!.lng!, titulo: v.titulo, empresa: v.empresa?.nome ?? '', valor: valor(v), urgente: v.urgente }));
}

/** Página do mapa (Leaflet + OpenStreetMap). Comunica o toque no pino para o app. */
export function htmlMapa(pinos: PinoVaga[], eu: { lat: number; lng: number } | null) {
  const centro = eu ?? (pinos[0] ? { lat: pinos[0].lat, lng: pinos[0].lng } : { lat: -30.0346, lng: -51.2177 }); // Porto Alegre
  const dados = JSON.stringify({ pinos, eu, centro }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:#0D0A09;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
.leaflet-popup-content-wrapper{border-radius:14px}.leaflet-popup-content{margin:12px 14px}
.t{font-weight:700;font-size:14px;color:#1A1412}.e{color:#7A6A61;font-size:12.5px;margin-top:2px}.v{color:#C2410C;font-weight:600;font-size:13px;margin-top:6px}
.b{margin-top:10px;width:100%;border:0;border-radius:18px;background:#FF5A12;color:#1A0B04;font-weight:700;padding:9px 0;font-size:13.5px}
.u{display:inline-block;background:#FF5A12;color:#1A0B04;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:700;margin-bottom:6px}
</style></head><body><div id="m"></div><script>
var D=${dados};
function enviar(id){var msg=JSON.stringify({vora:'abrir',id:id});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg)}else{window.parent.postMessage(msg,'*')}}
var m=L.map('m',{zoomControl:false}).setView([D.centro.lat,D.centro.lng],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(m);
var g=[];
D.pinos.forEach(function(p){
  var c=L.circleMarker([p.lat,p.lng],{radius:p.urgente?11:9,color:'#fff',weight:2,fillColor:p.urgente?'#FF2E00':'#FF5A12',fillOpacity:1}).addTo(m);
  var d=document.createElement('div');
  d.innerHTML=(p.urgente?'<div class="u">⚡ URGENTE</div>':'')+'<div class="t"></div><div class="e"></div><div class="v"></div><button class="b">Ver vaga</button>';
  d.querySelector('.t').textContent=p.titulo;d.querySelector('.e').textContent=p.empresa;d.querySelector('.v').textContent=p.valor;
  d.querySelector('.b').onclick=function(){enviar(p.id)};
  c.bindPopup(d);g.push([p.lat,p.lng]);
});
if(D.eu){L.circleMarker([D.eu.lat,D.eu.lng],{radius:8,color:'#fff',weight:3,fillColor:'#2F80ED',fillOpacity:1}).addTo(m).bindPopup('Você está aqui');g.push([D.eu.lat,D.eu.lng]);}
if(g.length>1){m.fitBounds(g,{padding:[40,40],maxZoom:15})}
</script></body></html>`;
}
