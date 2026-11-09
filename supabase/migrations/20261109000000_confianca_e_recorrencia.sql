-- Vora: disponibilidade, favoritos, convites, faltas/cancelamentos,
-- certificados/experiências, verificação de identidade, denúncias/bloqueios
-- e painel administrativo.

/* ============ Administração ============ */
create table public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security; -- sem políticas: só funções internas leem
revoke all on public.admins from anon, authenticated;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- Conta suspensa pela moderação: some das buscas e não publica/escreve
alter table public.perfis add column suspenso boolean not null default false;
-- Reputação (mantida pelo banco)
alter table public.perfis add column faltas integer not null default 0;
alter table public.perfis add column cancelamentos integer not null default 0;

drop policy "vagas ativas visiveis" on public.vagas;
create policy "vagas ativas visiveis" on public.vagas for select to authenticated
  using (empresa_id = auth.uid()
         or (ativa and not exists (select 1 from public.perfis p where p.id = empresa_id and p.suspenso))
         or public.eh_admin());
drop policy "empresa publica vaga" on public.vagas;
create policy "empresa publica vaga" on public.vagas for insert to authenticated
  with check (empresa_id = auth.uid() and public.eh_empresa()
              and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.suspenso));

drop policy "servicos visiveis" on public.servicos;
create policy "servicos visiveis" on public.servicos for select to authenticated
  using (freelancer_id = auth.uid()
         or not exists (select 1 from public.perfis p where p.id = freelancer_id and p.suspenso));

/* ============ Bloqueios ============ */
create table public.bloqueios (
  autor_id  uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  alvo_id   uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (autor_id, alvo_id),
  check (autor_id <> alvo_id)
);
alter table public.bloqueios enable row level security;
grant select, insert, delete on public.bloqueios to authenticated;
create policy "meus bloqueios" on public.bloqueios for all to authenticated
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());

-- Há bloqueio entre as duas pessoas (em qualquer direção)?
create or replace function public.bloqueado(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bloqueios
                  where (autor_id = p_a and alvo_id = p_b) or (autor_id = p_b and alvo_id = p_a));
$$;
revoke execute on function public.bloqueado(uuid, uuid) from public, anon;
grant execute on function public.bloqueado(uuid, uuid) to authenticated;

drop policy "enviar mensagem" on public.mensagens;
create policy "enviar mensagem" on public.mensagens for insert to authenticated
  with check (autor_id = auth.uid()
              and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.suspenso)
              and exists (select 1 from public.conversas c
                           where c.id = conversa_id and auth.uid() in (c.a, c.b) and not public.bloqueado(c.a, c.b)));

create or replace function public.abrir_conversa(p_outro uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare cid uuid; eu uuid := auth.uid();
begin
  select id into cid from public.conversas
   where least(a,b) = least(eu, p_outro) and greatest(a,b) = greatest(eu, p_outro);
  if cid is null then
    if public.bloqueado(eu, p_outro) then
      raise exception 'Conversa indisponível' using errcode = 'P0001';
    end if;
    insert into public.conversas (a, b) values (eu, p_outro) returning id into cid;
  end if;
  return cid;
end $$;

drop policy "freelancer se candidata" on public.candidaturas;
create policy "freelancer se candidata" on public.candidaturas for insert to authenticated
  with check (freelancer_id = auth.uid() and not public.eh_empresa()
              and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.suspenso)
              and exists (select 1 from public.vagas v where v.id = vaga_id and v.ativa
                           and not public.bloqueado(auth.uid(), v.empresa_id)));

/* ============ Faltas e cancelamentos ============ */
alter table public.candidaturas drop constraint candidaturas_status_check;
alter table public.candidaturas add constraint candidaturas_status_check
  check (status in ('pendente', 'contratado', 'recusado', 'cancelado_freela', 'cancelado_empresa', 'falta'));
alter table public.candidaturas add column motivo text check (motivo is null or length(motivo) <= 300);
alter table public.candidaturas add column ultima_hora boolean not null default false;
alter table public.candidaturas add column alterado_em timestamptz;
grant update (status, motivo) on public.candidaturas to authenticated;

create policy "freelancer cancela a propria" on public.candidaturas for update to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());

-- Quem pode mudar o quê:
--   freelancer: contratado → cancelado_freela
--   contratante: pendente/contratado/recusado entre si; contratado → cancelado_empresa ou falta; falta → contratado (desfazer)
create or replace function public.validar_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  dono uuid;
  inicio timestamptz;
  convite boolean := coalesce(current_setting('vora.convite', true), '') = '1';
begin
  if eu is null or convite then return new; end if; -- funções internas

  if tg_op = 'INSERT' then
    new.status := 'pendente'; -- candidatura sempre nasce pendente
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
  elsif eu = old.freelancer_id then
    if not (old.status = 'contratado' and new.status = 'cancelado_freela') then
      raise exception 'Mudança de status não permitida' using errcode = 'P0001';
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
create trigger validar_candidatura
  before insert or update on public.candidaturas
  for each row execute function public.validar_candidatura();

create or replace function public.recalcular_reputacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare f uuid := coalesce(new.freelancer_id, old.freelancer_id);
        e uuid;
begin
  select empresa_id into e from public.vagas where id = coalesce(new.vaga_id, old.vaga_id);
  update public.perfis set
    faltas = (select count(*) from public.candidaturas where freelancer_id = f and status = 'falta'),
    cancelamentos = (select count(*) from public.candidaturas where freelancer_id = f and status = 'cancelado_freela')
   where id = f;
  if e is not null then
    update public.perfis set
      cancelamentos = (select count(*) from public.candidaturas c join public.vagas v on v.id = c.vaga_id
                        where v.empresa_id = e and c.status = 'cancelado_empresa')
     where id = e;
  end if;
  return null;
end $$;
revoke execute on function public.recalcular_reputacao() from public, anon, authenticated;
create trigger recalcular_reputacao
  after update of status or delete on public.candidaturas
  for each row execute function public.recalcular_reputacao();

/* ============ Disponibilidade ============ */
create table public.disponibilidade (
  freelancer_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  dia           smallint not null check (dia between 0 and 6), -- 0 = domingo
  turno         text not null check (turno in ('manha', 'tarde', 'noite', 'madrugada')),
  primary key (freelancer_id, dia, turno)
);
alter table public.disponibilidade enable row level security;
grant select, insert, delete on public.disponibilidade to authenticated;
create policy "disponibilidade visivel" on public.disponibilidade for select to authenticated using (true);
create policy "freelancer marca disponibilidade" on public.disponibilidade for insert to authenticated
  with check (freelancer_id = auth.uid() and not public.eh_empresa());
create policy "freelancer desmarca disponibilidade" on public.disponibilidade for delete to authenticated
  using (freelancer_id = auth.uid());

/* ============ Favoritos ============ */
create table public.favoritos (
  empresa_id    uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (empresa_id, freelancer_id)
);
alter table public.favoritos enable row level security;
grant select, insert, delete on public.favoritos to authenticated;
create policy "meus favoritos" on public.favoritos for all to authenticated
  using (empresa_id = auth.uid()) with check (empresa_id = auth.uid() and public.eh_empresa());

/* ============ Convites diretos ============ */
create table public.convites (
  id            uuid primary key default gen_random_uuid(),
  vaga_id       uuid not null references public.vagas (id) on delete cascade,
  empresa_id    uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  mensagem      text check (mensagem is null or length(mensagem) <= 300),
  status        text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  criado_em     timestamptz not null default now(),
  respondido_em timestamptz,
  unique (vaga_id, freelancer_id)
);
create index convites_freelancer_idx on public.convites (freelancer_id, status, criado_em desc);
alter table public.convites enable row level security;
grant select, insert, delete on public.convites to authenticated;
create policy "ver meus convites" on public.convites for select to authenticated
  using (auth.uid() in (empresa_id, freelancer_id));
create policy "contratante convida" on public.convites for insert to authenticated
  with check (empresa_id = auth.uid() and status = 'pendente'
              and exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid() and v.ativa)
              and exists (select 1 from public.perfis p where p.id = freelancer_id and p.tipo = 'freelancer' and not p.suspenso)
              and not public.bloqueado(auth.uid(), freelancer_id));
create policy "contratante retira convite pendente" on public.convites for delete to authenticated
  using (empresa_id = auth.uid() and status = 'pendente');
alter publication supabase_realtime add table public.convites;

create or replace function public.responder_convite(p_convite uuid, p_aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare cv public.convites;
begin
  select * into cv from public.convites where id = p_convite and freelancer_id = auth.uid() for update;
  if not found then raise exception 'Convite não encontrado' using errcode = 'P0001'; end if;
  if cv.status <> 'pendente' then raise exception 'Esse convite já foi respondido' using errcode = 'P0001'; end if;

  if p_aceitar then
    if not exists (select 1 from public.vagas where id = cv.vaga_id and ativa) then
      raise exception 'Essa vaga foi encerrada' using errcode = 'P0001';
    end if;
    perform set_config('vora.convite', '1', true);
    insert into public.candidaturas (vaga_id, freelancer_id, mensagem, status)
    values (cv.vaga_id, cv.freelancer_id, 'Aceitou o convite do estabelecimento.', 'contratado')
    on conflict (vaga_id, freelancer_id) do update set status = 'contratado'
      where public.candidaturas.status in ('pendente', 'recusado');
    perform set_config('vora.convite', '', true);
  end if;

  update public.convites set status = case when p_aceitar then 'aceito' else 'recusado' end, respondido_em = now()
   where id = p_convite;
end $$;
revoke execute on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;

/* ============ Certificados e experiência ============ */
create table public.certificados (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome          text not null check (length(nome) between 3 and 120),
  instituicao   text check (instituicao is null or length(instituicao) <= 120),
  ano           smallint check (ano is null or ano between 1950 and 2100),
  criado_em     timestamptz not null default now()
);
create index certificados_freelancer_idx on public.certificados (freelancer_id);

create table public.experiencias (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  local         text not null check (length(local) between 2 and 120),
  funcao        text not null check (length(funcao) between 2 and 80),
  periodo       text check (periodo is null or length(periodo) <= 60), -- ex.: "2023 – 2025"
  descricao     text check (descricao is null or length(descricao) <= 400),
  criado_em     timestamptz not null default now()
);
create index experiencias_freelancer_idx on public.experiencias (freelancer_id);

alter table public.certificados enable row level security;
alter table public.experiencias enable row level security;
grant select, insert, update, delete on public.certificados, public.experiencias to authenticated;
create policy "certificados visiveis" on public.certificados for select to authenticated using (true);
create policy "freelancer gerencia certificados" on public.certificados for all to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid() and not public.eh_empresa());
create policy "experiencias visiveis" on public.experiencias for select to authenticated using (true);
create policy "freelancer gerencia experiencias" on public.experiencias for all to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid() and not public.eh_empresa());

/* ============ Verificação de identidade ============ */
create table public.verificacoes (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  status       text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  motivo       text check (motivo is null or length(motivo) <= 300),
  criado_em    timestamptz not null default now(),
  revisado_em  timestamptz,
  revisado_por uuid references auth.users (id) on delete set null
);
create unique index verificacoes_uma_pendente on public.verificacoes (perfil_id) where status = 'pendente';
alter table public.verificacoes enable row level security;
grant select, insert on public.verificacoes to authenticated;
create policy "ver minha verificacao" on public.verificacoes for select to authenticated
  using (perfil_id = auth.uid() or public.eh_admin());
create policy "pedir verificacao" on public.verificacoes for insert to authenticated
  with check (perfil_id = auth.uid() and status = 'pendente'
              and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.verificado));

-- Fotos ficam num cofre privado; só a própria pessoa e a moderação veem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verificacoes', 'verificacoes', false, 10485760, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "verificacao: enviar a propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'verificacoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "verificacao: trocar a propria" on storage.objects for update to authenticated
  using (bucket_id = 'verificacoes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'verificacoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "verificacao: ver a propria ou moderacao" on storage.objects for select to authenticated
  using (bucket_id = 'verificacoes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.eh_admin())));
create policy "verificacao: apagar a propria ou moderacao" on storage.objects for delete to authenticated
  using (bucket_id = 'verificacoes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.eh_admin())));

create or replace function public.revisar_verificacao(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  update public.verificacoes
     set status = case when p_aprovar then 'aprovada' else 'recusada' end,
         motivo = nullif(trim(p_motivo), ''), revisado_em = now(), revisado_por = auth.uid()
   where id = p_id and status = 'pendente'
  returning perfil_id into alvo;
  if alvo is null then raise exception 'Verificação não encontrada' using errcode = 'P0001'; end if;
  if p_aprovar then update public.perfis set verificado = true where id = alvo; end if;
end $$;
revoke execute on function public.revisar_verificacao(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_verificacao(uuid, boolean, text) to authenticated;

/* ============ Denúncias ============ */
create table public.denuncias (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  alvo_id       uuid not null references public.perfis (id) on delete cascade,
  vaga_id       uuid references public.vagas (id) on delete set null,
  motivo        text not null check (motivo in ('golpe', 'assedio', 'falso', 'nao_pagou', 'conduta', 'spam', 'outro')),
  detalhes      text check (detalhes is null or length(detalhes) <= 1000),
  status        text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  resolvido_por uuid references auth.users (id) on delete set null,
  check (autor_id <> alvo_id)
);
create index denuncias_status_idx on public.denuncias (status, criado_em desc);
alter table public.denuncias enable row level security;
grant select, insert on public.denuncias to authenticated;
create policy "ver minhas denuncias" on public.denuncias for select to authenticated
  using (autor_id = auth.uid() or public.eh_admin());
create policy "denunciar" on public.denuncias for insert to authenticated
  with check (autor_id = auth.uid() and status = 'aberta'
              and (select count(*) from public.denuncias d where d.autor_id = auth.uid() and d.criado_em > now() - interval '1 day') < 10);

/* ============ Funções do painel ============ */
create or replace function public.painel_admin()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'freelancers',        (select count(*) from public.perfis where tipo = 'freelancer'),
    'estabelecimentos',   (select count(*) from public.perfis where tipo = 'empresa'),
    'novos_7d',           (select count(*) from public.perfis where criado_em > now() - interval '7 days'),
    'vagas_ativas',       (select count(*) from public.vagas where ativa),
    'candidaturas_30d',   (select count(*) from public.candidaturas where criado_em > now() - interval '30 days'),
    'contratacoes_30d',   (select count(*) from public.candidaturas where status = 'contratado' and criado_em > now() - interval '30 days'),
    'faltas_30d',         (select count(*) from public.candidaturas where status = 'falta' and coalesce(alterado_em, criado_em) > now() - interval '30 days'),
    'denuncias_abertas',  (select count(*) from public.denuncias where status = 'aberta'),
    'verificacoes_pendentes', (select count(*) from public.verificacoes where status = 'pendente'),
    'suspensos',          (select count(*) from public.perfis where suspenso)
  );
end $$;

create or replace function public.admin_denuncias(p_status text default 'aberta')
returns table (id uuid, motivo text, detalhes text, status text, criado_em timestamptz,
               autor_id uuid, autor_nome text, alvo_id uuid, alvo_nome text, alvo_tipo public.tipo_conta,
               alvo_suspenso boolean, alvo_denuncias bigint, vaga_titulo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  return query
    select d.id, d.motivo, d.detalhes, d.status, d.criado_em,
           a.id, a.nome, b.id, b.nome, b.tipo, b.suspenso,
           (select count(*) from public.denuncias x where x.alvo_id = b.id), v.titulo
      from public.denuncias d
      join public.perfis a on a.id = d.autor_id
      join public.perfis b on b.id = d.alvo_id
      left join public.vagas v on v.id = d.vaga_id
     where d.status = p_status
     order by d.criado_em desc
     limit 200;
end $$;

create or replace function public.admin_verificacoes()
returns table (id uuid, perfil_id uuid, nome text, tipo public.tipo_conta, criado_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  return query
    select v.id, p.id, p.nome, p.tipo, v.criado_em
      from public.verificacoes v join public.perfis p on p.id = v.perfil_id
     where v.status = 'pendente'
     order by v.criado_em
     limit 200;
end $$;

create or replace function public.resolver_denuncia(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  if p_status not in ('resolvida', 'descartada', 'aberta') then raise exception 'Status inválido'; end if;
  update public.denuncias set status = p_status,
         resolvido_em = case when p_status = 'aberta' then null else now() end,
         resolvido_por = case when p_status = 'aberta' then null else auth.uid() end
   where id = p_id;
end $$;

create or replace function public.suspender_conta(p_perfil uuid, p_suspender boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  if p_perfil = auth.uid() then raise exception 'Você não pode suspender a própria conta'; end if;
  update public.perfis set suspenso = p_suspender where id = p_perfil;
end $$;

revoke execute on function public.painel_admin(), public.admin_denuncias(text), public.admin_verificacoes(),
  public.resolver_denuncia(uuid, text), public.suspender_conta(uuid, boolean) from public, anon;
grant execute on function public.painel_admin(), public.admin_denuncias(text), public.admin_verificacoes(),
  public.resolver_denuncia(uuid, text), public.suspender_conta(uuid, boolean) to authenticated;

/* ============ LGPD: exportação inclui tudo o que é novo ============ */
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
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

-- Só quem participa pode perguntar se há bloqueio entre duas pessoas
create or replace function public.bloqueado(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() in (p_a, p_b) and exists (select 1 from public.bloqueios
                  where (autor_id = p_a and alvo_id = p_b) or (autor_id = p_b and alvo_id = p_a));
$$;

-- Para tornar alguém administrador do Vora (rodar no SQL Editor do Supabase):
--   insert into public.admins (user_id) select id from auth.users where email = 'SEU_EMAIL';

-- Falta só pode ser marcada depois que o turno começou
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
  elsif eu = old.freelancer_id then
    if not (old.status = 'contratado' and new.status = 'cancelado_freela') then
      raise exception 'Mudança de status não permitida' using errcode = 'P0001';
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
