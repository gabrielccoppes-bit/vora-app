// Consulta de CEP: BrasilAPI, com ViaCEP como reserva.
import { cors, json, getJSON } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { cep } = await req.json().catch(() => ({}));
  const c = String(cep ?? '').replace(/\D/g, '');
  if (c.length !== 8) return json({ erro: 'CEP inválido' }, 400);

  const b = await getJSON(`https://brasilapi.com.br/api/cep/v2/${c}`);
  if (b?.city) {
    return json({ cep: c, logradouro: b.street ?? '', bairro: b.neighborhood ?? '', cidade: b.city, uf: b.state });
  }
  const v = await getJSON(`https://viacep.com.br/ws/${c}/json/`);
  if (v && !v.erro) {
    return json({ cep: c, logradouro: v.logradouro ?? '', bairro: v.bairro ?? '', cidade: v.localidade, uf: v.uf });
  }
  return json({ erro: 'CEP não encontrado' }, 404);
});
