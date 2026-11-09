-- Vora: central de avisos, notificações no navegador (Web Push) e check-in/check-out.

/* ============ Central de avisos ============ */
create table public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  corpo       text not null default '',
  rota        text,               -- tela do app que abre ao tocar
  lida        boolean not null default false,
  push_em     timestamptz,        -- quando o push foi enviado (evita duplicar)
  criado_em   timestamptz not null default now()
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, criado_em desc);
alter table public.notificacoes enable row level security;
grant select, delete on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;
create policy "minhas notificacoes" on public.notificacoes for select to authenticated using (usuario_id = auth.uid());
create policy "marcar como lida" on public.notificacoes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "apagar notificacao" on public.notificacoes for delete to authenticated using (usuario_id = auth.uid());
alter publication supabase_realtime add table public.notificacoes;

-- Cria um aviso. agrupar=true junta avisos repetidos (ex.: várias mensagens da mesma conversa).
create or replace function public.notificar(p_usuario uuid, p_tipo text, p_titulo text, p_corpo text, p_rota text, p_agrupar boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null then return; end if;
  if p_agrupar then
    update public.notificacoes set corpo = p_corpo, titulo = p_titulo, criado_em = now()
     where usuario_id = p_usuario and tipo = p_tipo and rota is not distinct from p_rota
       and not lida and criado_em > now() - interval '30 minutes';
    if found then return; end if;
  end if;
  insert into public.notificacoes (usuario_id, tipo, titulo, corpo, rota)
  values (p_usuario, p_tipo, left(p_titulo, 120), left(coalesce(p_corpo, ''), 300), p_rota);
end $$;
revoke execute on function public.notificar(uuid, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.primeiro_nome(n text)
returns text language sql immutable as $$ select split_part(coalesce(n, ''), ' ', 1) $$;

-- Candidaturas: nova, contratado, recusado, cancelamentos, falta, presença
create or replace function public.avisar_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record; f text;
begin
  select vg.id, vg.titulo, vg.empresa_id, e.nome as empresa into v
    from public.vagas vg join public.perfis e on e.id = vg.empresa_id where vg.id = new.vaga_id;
  select nome into f from public.perfis where id = new.freelancer_id;

  if tg_op = 'INSERT' then
    if new.status = 'contratado' then -- veio de convite aceito
      perform public.notificar(v.empresa_id, 'convite_aceito', primeiro_nome(f) || ' aceitou seu convite', v.titulo, '/vaga/' || v.id);
    else
      perform public.notificar(v.empresa_id, 'candidatura', 'Nova candidatura', f || ' se candidatou a ' || v.titulo, '/vaga/' || v.id);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'contratado' then
        if old.status <> 'falta' then
          perform public.notificar(new.freelancer_id, 'contratado', 'Você foi contratado(a)! 🎉', v.empresa || ' · ' || v.titulo, '/vaga/' || v.id);
        end if;
      when 'recusado' then
        perform public.notificar(new.freelancer_id, 'recusado', 'Candidatura não selecionada', v.empresa || ' · ' || v.titulo, '/vaga/' || v.id);
      when 'cancelado_empresa' then
        perform public.notificar(new.freelancer_id, 'cancelado', 'Contratação cancelada', v.empresa || ' cancelou sua contratação para ' || v.titulo, '/vaga/' || v.id);
      when 'cancelado_freela' then
        perform public.notificar(v.empresa_id, 'cancelado', primeiro_nome(f) || ' cancelou a participação', v.titulo || case when new.ultima_hora then ' · em cima da hora' else '' end, '/vaga/' || v.id);
      when 'falta' then
        perform public.notificar(new.freelancer_id, 'falta', 'Falta registrada', v.empresa || ' registrou falta em ' || v.titulo, '/vaga/' || v.id);
      else null;
    end case;
  end if;

  if new.checkin_em is not null and old.checkin_em is null then
    perform public.notificar(v.empresa_id, 'presenca', primeiro_nome(f) || ' chegou', v.titulo || ' · check-in às ' || to_char(new.checkin_em at time zone 'America/Sao_Paulo', 'HH24:MI'), '/vaga/' || v.id);
  end if;
  if new.checkout_em is not null and old.checkout_em is null then
    perform public.notificar(v.empresa_id, 'presenca', primeiro_nome(f) || ' encerrou o turno', v.titulo || ' · saída às ' || to_char(new.checkout_em at time zone 'America/Sao_Paulo', 'HH24:MI'), '/vaga/' || v.id);
  end if;
  return null;
end $$;
revoke execute on function public.avisar_candidatura() from public, anon, authenticated;

-- Convites
create or replace function public.avisar_convite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select vg.titulo, e.nome as empresa into v from public.vagas vg join public.perfis e on e.id = vg.empresa_id where vg.id = new.vaga_id;
  if tg_op = 'INSERT' then
    perform public.notificar(new.freelancer_id, 'convite', v.empresa || ' convidou você', v.titulo, '/convites');
  elsif new.status = 'recusado' and old.status = 'pendente' then
    perform public.notificar(new.empresa_id, 'convite_recusado', (select primeiro_nome(nome) from public.perfis where id = new.freelancer_id) || ' recusou o convite', v.titulo, '/vaga/' || new.vaga_id);
  end if;
  return null;
end $$;
revoke execute on function public.avisar_convite() from public, anon, authenticated;

-- Mensagens (agrupadas por conversa)
create or replace function public.avisar_mensagem()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; autor text;
begin
  select a, b into c from public.conversas where id = new.conversa_id;
  select nome into autor from public.perfis where id = new.autor_id;
  perform public.notificar(case when c.a = new.autor_id then c.b else c.a end, 'mensagem', 'Mensagem de ' || autor,
                           left(new.texto, 140), '/chat/' || new.conversa_id || '?nome=' || replace(autor, ' ', '%20'), true);
  return null;
end $$;
revoke execute on function public.avisar_mensagem() from public, anon, authenticated;

-- Avaliações recebidas
create or replace function public.avisar_avaliacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direcao = 'empresa_para_freela' then
    perform public.notificar(new.freelancer_id, 'avaliacao', 'Você recebeu uma avaliação ' || repeat('★', new.nota),
      (select nome from public.perfis where id = new.empresa_id), '/freela/' || new.freelancer_id);
  else
    perform public.notificar(new.empresa_id, 'avaliacao', 'Seu estabelecimento recebeu ' || repeat('★', new.nota),
      'Avaliação de ' || (select primeiro_nome(nome) from public.perfis where id = new.freelancer_id), '/estabelecimento/' || new.empresa_id);
  end if;
  return null;
end $$;
revoke execute on function public.avisar_avaliacao() from public, anon, authenticated;

-- Resultado da verificação de identidade
create or replace function public.avisar_verificacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('aprovada', 'recusada') then
    perform public.notificar(new.perfil_id, 'verificacao',
      case when new.status = 'aprovada' then 'Identidade verificada ✓' else 'Verificação não aprovada' end,
      case when new.status = 'aprovada' then 'Seu perfil agora mostra o selo de verificado.' else coalesce(new.motivo, 'Toque para enviar novas fotos.') end,
      '/verificacao');
  end if;
  return null;
end $$;
revoke execute on function public.avisar_verificacao() from public, anon, authenticated;

-- Vaga urgente: avisa freelancers da mesma cidade (sem bloqueio entre eles)
create or replace function public.avisar_vaga_urgente()
returns trigger language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if not new.urgente or not new.ativa then return null; end if;
  select nome, cidade, uf into e from public.perfis where id = new.empresa_id;
  insert into public.notificacoes (usuario_id, tipo, titulo, corpo, rota)
  select p.id, 'urgente', '⚡ Vaga urgente: ' || new.titulo, e.nome || ' · ' || to_char(new.inicio_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), '/vaga/' || new.id
    from public.perfis p
   where p.tipo = 'freelancer' and not p.suspenso
     and lower(p.cidade) = lower(e.cidade) and p.uf = e.uf
     and not exists (select 1 from public.bloqueios b where (b.autor_id = p.id and b.alvo_id = new.empresa_id) or (b.autor_id = new.empresa_id and b.alvo_id = p.id))
   limit 500;
  return null;
end $$;
revoke execute on function public.avisar_vaga_urgente() from public, anon, authenticated;

/* ============ Check-in e check-out ============ */
alter table public.candidaturas add column checkin_em timestamptz;
alter table public.candidaturas add column checkout_em timestamptz;
alter table public.candidaturas add column checkin_dist_m integer;   -- distância até o local no check-in (a posição em si não é guardada)
alter table public.candidaturas add column checkout_dist_m integer;
alter table public.candidaturas add column presenca_por text check (presenca_por in ('gps', 'estabelecimento'));

create trigger avisar_candidatura after insert or update on public.candidaturas
  for each row execute function public.avisar_candidatura();
create trigger avisar_convite after insert or update on public.convites
  for each row execute function public.avisar_convite();
create trigger avisar_mensagem after insert on public.mensagens
  for each row execute function public.avisar_mensagem();
create trigger avisar_avaliacao after insert on public.avaliacoes
  for each row execute function public.avisar_avaliacao();
create trigger avisar_verificacao after update on public.verificacoes
  for each row execute function public.avisar_verificacao();
create trigger avisar_vaga_urgente after insert on public.vagas
  for each row execute function public.avisar_vaga_urgente();

-- Distância em metros (Haversine)
create or replace function public.distancia_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns integer language sql immutable as $$
  select round(6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::int;
$$;

-- Freelancer registra chegada/saída com o GPS do celular.
-- A posição é usada só para medir a distância até o local e é descartada.
create or replace function public.registrar_presenca(p_candidatura uuid, p_tipo text, p_lat float8, p_lng float8)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.candidaturas;
  v record;
  dist integer;
  limite constant integer := 400; -- metros
begin
  if p_tipo not in ('entrada', 'saida') then raise exception 'Tipo inválido' using errcode = 'P0001'; end if;
  select * into c from public.candidaturas where id = p_candidatura and freelancer_id = auth.uid() for update;
  if not found then raise exception 'Contratação não encontrada' using errcode = 'P0001'; end if;
  if c.status <> 'contratado' then raise exception 'Só é possível registrar presença em contratações ativas' using errcode = 'P0001'; end if;

  select vg.inicio_em, e.lat, e.lng into v from public.vagas vg join public.perfis e on e.id = vg.empresa_id where vg.id = c.vaga_id;

  if p_tipo = 'entrada' then
    if c.checkin_em is not null then raise exception 'Sua chegada já foi registrada' using errcode = 'P0001'; end if;
    if v.inicio_em is not null and now() < v.inicio_em - interval '2 hours' then
      raise exception 'O check-in abre 2 horas antes do início do turno' using errcode = 'P0001';
    end if;
    if v.inicio_em is not null and now() > v.inicio_em + interval '12 hours' then
      raise exception 'O prazo para check-in deste turno já passou' using errcode = 'P0001';
    end if;
  else
    if c.checkin_em is null then raise exception 'Faça o check-in primeiro' using errcode = 'P0001'; end if;
    if c.checkout_em is not null then raise exception 'Sua saída já foi registrada' using errcode = 'P0001'; end if;
  end if;

  if v.lat is not null and p_lat is not null and p_lng is not null then
    dist := public.distancia_m(p_lat, p_lng, v.lat, v.lng);
    if dist > limite then
      raise exception 'Você está a % m do estabelecimento. Chegue mais perto (até % m) para registrar.', dist, limite using errcode = 'P0001';
    end if;
  elsif v.lat is not null then
    raise exception 'Não conseguimos sua localização. Ative o GPS e tente de novo.' using errcode = 'P0001';
  end if;

  if p_tipo = 'entrada' then
    update public.candidaturas set checkin_em = now(), checkin_dist_m = dist, presenca_por = 'gps' where id = c.id;
  else
    update public.candidaturas set checkout_em = now(), checkout_dist_m = dist where id = c.id;
  end if;
  return jsonb_build_object('ok', true, 'distancia_m', dist);
end $$;
revoke execute on function public.registrar_presenca(uuid, text, float8, float8) from public, anon;
grant execute on function public.registrar_presenca(uuid, text, float8, float8) to authenticated;

-- Contratante confirma presença manualmente (quando o GPS falha)
create or replace function public.confirmar_presenca(p_candidatura uuid, p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.candidaturas;
begin
  select ca.* into c from public.candidaturas ca join public.vagas vg on vg.id = ca.vaga_id
   where ca.id = p_candidatura and vg.empresa_id = auth.uid() for update of ca;
  if not found then raise exception 'Contratação não encontrada' using errcode = 'P0001'; end if;
  if c.status <> 'contratado' then raise exception 'Só é possível confirmar presença em contratações ativas' using errcode = 'P0001'; end if;
  if p_tipo = 'entrada' and c.checkin_em is null then
    update public.candidaturas set checkin_em = now(), presenca_por = 'estabelecimento' where id = c.id;
  elsif p_tipo = 'saida' and c.checkin_em is not null and c.checkout_em is null then
    update public.candidaturas set checkout_em = now() where id = c.id;
  else
    raise exception 'Nada para confirmar' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.confirmar_presenca(uuid, text) from public, anon;
grant execute on function public.confirmar_presenca(uuid, text) to authenticated;

-- Quem fez check-in não pode receber falta
create or replace function public.validar_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  dono uuid;
  inicio timestamptz;
  convite boolean := coalesce(current_setting('vora.convite', true), '') = '1';
begin
  if eu is null or convite then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    return new;
  end if;
  if new.status = old.status then return new; end if;
  select empresa_id, inicio_em into dono, inicio from public.vagas where id = new.vaga_id;
  if eu = dono then
    if not (
      (old.status in ('pendente', 'contratado', 'recusado') and new.status in ('pendente', 'contratado', 'recusado'))
      or (old.status = 'contratado' and new.status in ('cancelado_empresa', 'falta'))
      or (old.status = 'falta' and new.status = 'contratado')
    ) then
      raise exception 'Mudança de status não permitida' using errcode = 'P0001';
    end if;
    if new.status = 'falta' and inicio is not null and inicio > now() then
      raise exception 'Mudança de status não permitida: o turno ainda não começou' using errcode = 'P0001';
    end if;
    if new.status = 'falta' and old.checkin_em is not null then
      raise exception 'Mudança de status não permitida: o freelancer fez check-in' using errcode = 'P0001';
    end if;
    if new.status in ('pendente', 'recusado', 'cancelado_empresa') and old.checkin_em is not null then
      raise exception 'Mudança de status não permitida: o turno já começou' using errcode = 'P0001';
    end if;
  elsif eu = old.freelancer_id then
    if not (old.status = 'contratado' and new.status = 'cancelado_freela') then
      raise exception 'Mudança de status não permitida' using errcode = 'P0001';
    end if;
    if old.checkin_em is not null then
      raise exception 'Mudança de status não permitida: você já fez check-in' using errcode = 'P0001';
    end if;
  else
    raise exception 'Sem permissão' using errcode = 'P0001';
  end if;
  new.alterado_em := now();
  new.ultima_hora := new.status in ('cancelado_freela', 'cancelado_empresa')
                     and inicio is not null and inicio - now() < interval '24 hours';
  return new;
end $$;
revoke execute on function public.validar_candidatura() from public, anon, authenticated;

/* ============ Web Push (notificações no navegador) ============ */
create table public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  tipo        text not null default 'web' check (tipo in ('web', 'expo')),
  endpoint    text not null unique check (length(endpoint) <= 1000),
  p256dh      text check (p256dh is null or length(p256dh) <= 200),
  auth        text check (auth is null or length(auth) <= 100),
  criado_em   timestamptz not null default now()
);
create index push_inscricoes_usuario_idx on public.push_inscricoes (usuario_id);
alter table public.push_inscricoes enable row level security;
grant select, insert, delete on public.push_inscricoes to authenticated;
create policy "minhas inscricoes" on public.push_inscricoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create extension if not exists pg_net with schema extensions;

-- A cada aviso novo, pede à função "enviar-push" para avisar o navegador/celular da pessoa.
create or replace function public.disparar_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.push_inscricoes where usuario_id = new.usuario_id) then
    perform net.http_post(
      url := 'https://atgtitircagbjuazrmth.supabase.co/functions/v1/enviar-push',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return null;
end $$;
revoke execute on function public.disparar_push() from public, anon, authenticated;
create trigger disparar_push after insert on public.notificacoes
  for each row execute function public.disparar_push();

/* ============ LGPD ============ */
create or replace function public.exportar_meus_dados()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exportado_em',    now(),
    'email',           (select email from auth.users where id = auth.uid()),
    'perfil',          (select to_jsonb(p) from public.perfis p where p.id = auth.uid()),
    'dados_privados',  (select to_jsonb(d) from public.dados_privados d where d.id = auth.uid()),
    'servico',         (select to_jsonb(s) from public.servicos s where s.freelancer_id = auth.uid()),
    'disponibilidade', (select coalesce(jsonb_agg(x), '[]') from public.disponibilidade x where x.freelancer_id = auth.uid()),
    'certificados',    (select coalesce(jsonb_agg(x), '[]') from public.certificados x where x.freelancer_id = auth.uid()),
    'experiencias',    (select coalesce(jsonb_agg(x), '[]') from public.experiencias x where x.freelancer_id = auth.uid()),
    'vagas',           (select coalesce(jsonb_agg(v), '[]') from public.vagas v where v.empresa_id = auth.uid()),
    'candidaturas',    (select coalesce(jsonb_agg(c), '[]') from public.candidaturas c where c.freelancer_id = auth.uid()),
    'convites',        (select coalesce(jsonb_agg(x), '[]') from public.convites x where auth.uid() in (x.empresa_id, x.freelancer_id)),
    'favoritos',       (select coalesce(jsonb_agg(x), '[]') from public.favoritos x where x.empresa_id = auth.uid()),
    'vagas_salvas',    (select coalesce(jsonb_agg(s), '[]') from public.salvos s where s.freelancer_id = auth.uid()),
    'avaliacoes_recebidas', (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a
                              where (a.direcao = 'empresa_para_freela' and a.freelancer_id = auth.uid())
                                 or (a.direcao = 'freela_para_empresa' and a.empresa_id = auth.uid())),
    'avaliacoes_feitas',    (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a
                              where (a.direcao = 'empresa_para_freela' and a.empresa_id = auth.uid())
                                 or (a.direcao = 'freela_para_empresa' and a.freelancer_id = auth.uid())),
    'verificacoes',    (select coalesce(jsonb_agg(x), '[]') from public.verificacoes x where x.perfil_id = auth.uid()),
    'denuncias_feitas',(select coalesce(jsonb_agg(x), '[]') from public.denuncias x where x.autor_id = auth.uid()),
    'bloqueios',       (select coalesce(jsonb_agg(x), '[]') from public.bloqueios x where x.autor_id = auth.uid()),
    'notificacoes',    (select coalesce(jsonb_agg(x), '[]') from public.notificacoes x where x.usuario_id = auth.uid()),
    'dispositivos_push', (select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'criado_em', x.criado_em)), '[]') from public.push_inscricoes x where x.usuario_id = auth.uid()),
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

-- Chaves do Web Push: criadas pela própria função "enviar-push" no primeiro uso.
-- A chave privada nunca sai do servidor (tabela sem acesso para usuários).
create table public.vapid_chaves (
  id       integer primary key default 1 check (id = 1),
  publica  text not null,
  privada  text not null,
  criado_em timestamptz not null default now()
);
alter table public.vapid_chaves enable row level security;
revoke all on public.vapid_chaves from anon, authenticated;

alter function public.primeiro_nome(text) set search_path = '';
alter function public.distancia_m(float8, float8, float8, float8) set search_path = '';
