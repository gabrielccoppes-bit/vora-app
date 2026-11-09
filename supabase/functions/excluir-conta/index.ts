// Exclusão definitiva da conta (LGPD art. 18, VI).
// Apagar o usuário no Auth remove em cascata perfil, dados privados,
// vagas, candidaturas, serviços e conversas. As fotos são apagadas aqui.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!token) return json({ erro: 'Não autenticado' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ erro: 'Sessão inválida' }, 401);

  // apaga foto de perfil e fotos de verificação (o Storage não é apagado em cascata)
  const pasta = data.user.id;
  for (const bucket of ['avatares', 'verificacoes']) {
    const { data: arquivos } = await admin.storage.from(bucket).list(pasta);
    if (arquivos?.length) await admin.storage.from(bucket).remove(arquivos.map((a) => `${pasta}/${a.name}`));
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ erro: delErr.message }, 500);
  return json({ ok: true });
});
