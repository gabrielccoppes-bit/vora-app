// Converte o endereço do contratante em um ponto no mapa (lat/lng).
// Ordem: endereço completo (Photon/OpenStreetMap) → CEP (AwesomeAPI) → CEP (BrasilAPI) → cidade.
// O app guarda o ponto arredondado (~100 m): suficiente para calcular distância.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Vora/1.0 (+https://gabrielccoppes-bit.github.io/vora-app)';

async function getJSON(url: string, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
const valido = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat > -34 && lat < 6 && lng > -75 && lng < -28; // dentro do Brasil

type Ponto = { lat: number; lng: number };
async function photon(q: string, extra = ''): Promise<Ponto | null> {
  const r = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1${extra}`);
  const f = r?.features?.[0];
  if (!f || f.properties?.countrycode !== 'BR') return null;
  const [lng, lat] = f.geometry?.coordinates ?? [];
  return valido(lat, lng) ? { lat, lng } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const b = await req.json().catch(() => ({}));
  const cep = String(b.cep ?? '').replace(/\D/g, '');
  const rua = String(b.logradouro ?? '').slice(0, 120);
  const numero = String(b.numero ?? '').slice(0, 10);
  const cidade = String(b.cidade ?? '').slice(0, 80);
  const uf = String(b.uf ?? '').slice(0, 2);

  // 1) Endereço completo
  if (rua && cidade) {
    const p = await photon(`${rua} ${numero}, ${cidade}, ${uf}, Brasil`);
    if (p) return json({ ...p, fonte: 'endereco' });
  }
  // 2) CEP — AwesomeAPI (costuma ter a coordenada da rua)
  if (cep.length === 8) {
    const r = await getJSON(`https://cep.awesomeapi.com.br/json/${cep}`);
    const lat = Number(r?.lat), lng = Number(r?.lng);
    if (valido(lat, lng)) return json({ lat, lng, fonte: 'cep' });
    // 3) CEP — BrasilAPI
    const b2 = await getJSON(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    const lat2 = Number(b2?.location?.coordinates?.latitude), lng2 = Number(b2?.location?.coordinates?.longitude);
    if (valido(lat2, lng2)) return json({ lat: lat2, lng: lng2, fonte: 'cep' });
  }
  // 4) Só a cidade (último recurso)
  if (cidade) {
    const p = await photon(`${cidade}, ${uf}, Brasil`, '&osm_tag=place');
    if (p) return json({ ...p, fonte: 'cidade' });
  }
  return json({ erro: 'Endereço não localizado' }, 404);
});
