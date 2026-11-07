// Consulta de CNPJ na base pública da Receita (via BrasilAPI).
// O CNPJ alfanumérico ainda pode não estar disponível nas APIs públicas:
// nesse caso o app pede o preenchimento manual.
import { cors, json, getJSON } from '../_shared/http.ts';

const titulo = (s?: string) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/(^|[\s\-/])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { cnpj } = await req.json().catch(() => ({}));
  const c = String(cnpj ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 14) return json({ erro: 'CNPJ inválido' }, 400);
  if (!/^\d{14}$/.test(c)) return json({ erro: 'Consulta automática indisponível para CNPJ alfanumérico' }, 404);

  const r = await getJSON(`https://brasilapi.com.br/api/cnpj/v1/${c}`, 9000);
  if (!r?.razao_social) return json({ erro: 'CNPJ não encontrado' }, 404);

  const tipo = r.descricao_tipo_de_logradouro ?? '';
  const lg = r.logradouro ?? '';
  return json({
    cnpj: c,
    razao_social: titulo(r.razao_social),
    nome_fantasia: titulo(r.nome_fantasia),
    situacao: r.descricao_situacao_cadastral ?? '',
    ativa: (r.descricao_situacao_cadastral ?? '').toUpperCase() === 'ATIVA',
    cep: String(r.cep ?? '').replace(/\D/g, ''),
    logradouro: titulo(tipo && !lg.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${lg}` : lg),
    numero: r.numero ?? '',
    complemento: titulo(r.complemento),
    bairro: titulo(r.bairro),
    cidade: titulo(r.municipio),
    uf: r.uf ?? '',
  });
});
