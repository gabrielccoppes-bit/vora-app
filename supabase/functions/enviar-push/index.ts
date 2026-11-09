// Envia os avisos do Vora como notificação do navegador (Web Push).
// Chamada pelo banco (gatilho em "notificacoes") e pelo app (para pegar a chave pública).
// Não precisa de login: só envia avisos recém-criados e ainda não enviados.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

let chaves: { publica: string; privada: string } | null = null;
async function obterChaves() {
  if (chaves) return chaves;
  const { data } = await db.from('vapid_chaves').select('publica, privada').eq('id', 1).maybeSingle();
  if (data) return (chaves = data);
  // primeira vez: cria o par de chaves aqui dentro
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const x = deB64url(jwk.x!);
  const y = deB64url(jwk.y!);
  const pub = new Uint8Array(65);
  pub[0] = 4;
  pub.set(x, 1);
  pub.set(y, 33);
  const novo = { id: 1, publica: b64url(pub), privada: jwk.d! };
  await db.from('vapid_chaves').upsert(novo, { onConflict: 'id', ignoreDuplicates: true });
  const { data: salvo } = await db.from('vapid_chaves').select('publica, privada').eq('id', 1).single();
  return (chaves = salvo!);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const k = await obterChaves();
    if (req.method === 'GET') return json({ publica: k.publica });

    const { id } = await req.json().catch(() => ({}));
    if (typeof id !== 'string') return json({ erro: 'id' }, 400);

    // marca como enviado (só uma vez e só avisos recentes)
    const { data: n } = await db
      .from('notificacoes')
      .update({ push_em: new Date().toISOString() })
      .eq('id', id)
      .is('push_em', null)
      .gt('criado_em', new Date(Date.now() - 5 * 60e3).toISOString())
      .select('usuario_id, titulo, corpo, rota, tipo')
      .maybeSingle();
    if (!n) return json({ ok: true, enviados: 0 });

    const { data: inscricoes } = await db.from('push_inscricoes').select('id, endpoint, p256dh, auth').eq('usuario_id', n.usuario_id).eq('tipo', 'web');
    webpush.setVapidDetails('mailto:contato@vora.app', k.publica, k.privada);
    const carga = JSON.stringify({ titulo: n.titulo, corpo: n.corpo, rota: n.rota, tipo: n.tipo });
    let enviados = 0;
    for (const s of inscricoes ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 3600, urgency: 'high' });
        enviados++;
      } catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) await db.from('push_inscricoes').delete().eq('id', s.id); // navegador cancelou
        else console.error('push falhou', st, (e as Error).message);
      }
    }
    return json({ ok: true, enviados });
  } catch (e) {
    console.error(e);
    return json({ erro: 'falha' }, 500);
  }
});
