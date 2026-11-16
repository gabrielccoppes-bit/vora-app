-- Vora: funil de métricas para o painel admin e feedback (problema/sugestão) dentro do app.

/* ============ Feedback ============ */
create table public.feedbacks (
  id        uuid primary key default gen_random_uuid(),
  autor_id  uuid references public.perfis (id) on delete set null,
  tipo      text not null check (tipo in ('problema', 'sugestao', 'elogio')),
  texto     text not null check (length(texto) between 5 and 2000),
  tela      text check (tela is null or length(tela) <= 120),
  aparelho  text check (aparelho is null or length(aparelho) <= 160),
  status    text not null default 'novo' check (status in ('novo', 'visto', 'resolvido')),
  criado_em timestamptz not null default now()
);
create index feedbacks_status_idx on public.feedbacks (status, criado_em desc);
alter table public.feedbacks enable row level security;
revoke all on public.feedbacks from anon, authenticated;
grant insert (tipo, texto, tela, aparelho) on public.feedbacks to authenticated;
grant select on public.feedbacks to authenticated;
grant update (status) on public.feedbacks to authenticated;
create policy "envia feedback" on public.feedbacks for insert to authenticated with check (autor_id = auth.uid());
create policy "ve o proprio ou admin" on public.feedbacks for select to authenticated using (autor_id = auth.uid() or public.eh_admin());
create policy "admin atualiza feedback" on public.feedbacks for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- autor preenchido pelo servidor; no máximo 10 por dia
create or replace function public.preparar_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.autor_id := auth.uid();
  new.status := 'novo';
  if (select count(*) from public.feedbacks where autor_id = auth.uid() and criado_em > now() - interval '1 day') >= 10 then
    raise exception 'Você já enviou bastante hoje. Obrigado! Tente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.preparar_feedback() from public, anon, authenticated;
create trigger preparar_feedback before insert on public.feedbacks for each row execute function public.preparar_feedback();

create or replace function public.admin_feedbacks(p_status text default 'novo')
returns table (id uuid, tipo text, texto text, tela text, aparelho text, status text, criado_em timestamptz,
               autor_id uuid, autor_nome text, autor_tipo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  return query
    select f.id, f.tipo, f.texto, f.tela, f.aparelho, f.status, f.criado_em, f.autor_id, p.nome, p.tipo::text
      from public.feedbacks f left join public.perfis p on p.id = f.autor_id
     where p_status is null or f.status = p_status
     order by f.criado_em desc limit 200;
end $$;
revoke execute on function public.admin_feedbacks(text) from public, anon;
grant execute on function public.admin_feedbacks(text) to authenticated;

/* ============ Funil ============ */
-- Coortes: quem se cadastrou (ou vaga publicada) nos últimos p_dias, e até onde chegou
create or replace function public.admin_funil(p_dias integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := now() - make_interval(days => greatest(1, least(p_dias, 365)));
begin
  if not public.eh_admin() then raise exception 'Sem permissão' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'dias', greatest(1, least(p_dias, 365)),
    'freelancers', (
      select jsonb_build_object(
        'cadastrados', count(*),
        'perfil_completo', count(*) filter (where exists (select 1 from public.servicos s where s.freelancer_id = p.id)),
        'candidataram', count(*) filter (where exists (select 1 from public.candidaturas c where c.freelancer_id = p.id)),
        'contratados', count(*) filter (where exists (select 1 from public.candidaturas c where c.freelancer_id = p.id and c.status = 'contratado')),
        'turno_feito', count(*) filter (where exists (select 1 from public.candidaturas c join public.vagas v on v.id = c.vaga_id
                                                       where c.freelancer_id = p.id and c.status = 'contratado'
                                                         and (c.checkout_em is not null or v.inicio_em < now() - interval '12 hours'))),
        'dois_turnos', count(*) filter (where (select count(*) from public.candidaturas c join public.vagas v on v.id = c.vaga_id
                                               where c.freelancer_id = p.id and c.status = 'contratado'
                                                 and (c.checkout_em is not null or v.inicio_em < now() - interval '12 hours')) >= 2))
      from public.perfis p where p.tipo = 'freelancer' and p.criado_em >= desde),
    'estabelecimentos', (
      select jsonb_build_object(
        'cadastrados', count(*),
        'publicaram', count(*) filter (where exists (select 1 from public.vagas v where v.empresa_id = p.id)),
        'receberam', count(*) filter (where exists (select 1 from public.candidaturas c join public.vagas v on v.id = c.vaga_id where v.empresa_id = p.id)),
        'contrataram', count(*) filter (where exists (select 1 from public.candidaturas c join public.vagas v on v.id = c.vaga_id where v.empresa_id = p.id and c.status = 'contratado')),
        'voltaram', count(*) filter (where (select count(distinct date_trunc('week', v.criado_em)) from public.vagas v where v.empresa_id = p.id) >= 2))
      from public.perfis p where p.tipo = 'empresa' and p.criado_em >= desde),
    'vagas', (
      with v as (
        select x.id, x.criado_em, x.ativa, x.inicio_em,
               (select min(c.criado_em) from public.candidaturas c where c.vaga_id = x.id) as primeira_cand,
               (select min(coalesce(c.alterado_em, c.criado_em)) from public.candidaturas c where c.vaga_id = x.id and c.status = 'contratado') as primeira_contr
          from public.vagas x where x.criado_em >= desde)
      select jsonb_build_object(
        'publicadas', count(*),
        'com_candidatura', count(*) filter (where primeira_cand is not null),
        'preenchidas', count(*) filter (where primeira_contr is not null),
        'sem_candidatos_vencidas', count(*) filter (where primeira_cand is null and (not ativa or inicio_em < now())),
        'horas_ate_candidatura', round((percentile_cont(0.5) within group (order by extract(epoch from primeira_cand - criado_em) / 3600.0))::numeric, 1),
        'horas_ate_contratacao', round((percentile_cont(0.5) within group (order by extract(epoch from primeira_contr - criado_em) / 3600.0))::numeric, 1))
      from v),
    'semanas', (
      select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'freelancers', s.fr, 'estabelecimentos', s.es, 'contratacoes', s.ct) order by s.semana), '[]')
        from (select w.semana,
                     (select count(*) from public.perfis p where p.tipo = 'freelancer' and date_trunc('week', p.criado_em) = w.semana) as fr,
                     (select count(*) from public.perfis p where p.tipo = 'empresa' and date_trunc('week', p.criado_em) = w.semana) as es,
                     (select count(*) from public.candidaturas c where c.status = 'contratado' and date_trunc('week', coalesce(c.alterado_em, c.criado_em)) = w.semana) as ct
                from (select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as semana) w) s),
    'feedbacks_novos', (select count(*) from public.feedbacks where status = 'novo')
  );
end $$;
revoke execute on function public.admin_funil(integer) from public, anon;
grant execute on function public.admin_funil(integer) to authenticated;

/* ============ LGPD: feedbacks no export ============ */
do $$
declare def text;
begin
  select pg_get_functiondef('public.exportar_meus_dados()'::regprocedure) into def;
  def := replace(def, $q$'elogios_recebidos',$q$, $q$'feedbacks', (select coalesce(jsonb_agg(x), '[]') from public.feedbacks x where x.autor_id = auth.uid()),
    'elogios_recebidos',$q$);
  execute def;
end $$;
