-- =====================================================================
--  Avaliações de contratantes sobre freelancers
--  Regra anti-fraude: só avalia quem CONTRATOU o freelancer naquela vaga.
-- =====================================================================

-- 1) Contratação: status da candidatura (só o dono da vaga altera)
alter table public.candidaturas
  add column status text not null default 'pendente' check (status in ('pendente', 'contratado', 'recusado'));
revoke update on public.candidaturas from authenticated;
grant update (status) on public.candidaturas to authenticated;
create policy "empresa decide candidatura" on public.candidaturas for update to authenticated
  using (exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid()))
  with check (exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid()));

-- 2) Nota resumida no perfil público (mantida pelo banco, ninguém edita à mão)
alter table public.perfis add column nota_media numeric(2,1);
alter table public.perfis add column nota_total integer not null default 0;

-- 3) Avaliações
create table public.avaliacoes (
  id              uuid primary key default gen_random_uuid(),
  candidatura_id  uuid not null unique references public.candidaturas (id) on delete cascade,
  vaga_id         uuid not null references public.vagas (id) on delete cascade,
  empresa_id      uuid not null references public.perfis (id) on delete cascade,
  freelancer_id   uuid not null references public.perfis (id) on delete cascade,
  nota            smallint not null check (nota between 1 and 5),
  tags            text[] not null default '{}' check (cardinality(tags) <= 6),
  comentario      text check (comentario is null or length(comentario) <= 600),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz
);
create index avaliacoes_freelancer_idx on public.avaliacoes (freelancer_id, criado_em desc);

alter table public.avaliacoes enable row level security;
revoke all on public.avaliacoes from anon;
grant select, insert, delete on public.avaliacoes to authenticated;
grant update (nota, tags, comentario, atualizado_em) on public.avaliacoes to authenticated;

-- todos os usuários logados leem (é o que dá confiança a quem vai contratar)
create policy "avaliacoes publicas" on public.avaliacoes for select to authenticated using (true);
-- só o contratante que contratou aquele freelancer naquela vaga
create policy "contratante avalia quem contratou" on public.avaliacoes for insert to authenticated
  with check (
    empresa_id = auth.uid()
    and exists (
      select 1 from public.candidaturas c
        join public.vagas v on v.id = c.vaga_id
       where c.id = candidatura_id
         and c.status = 'contratado'
         and c.vaga_id = avaliacoes.vaga_id
         and c.freelancer_id = avaliacoes.freelancer_id
         and v.empresa_id = auth.uid()
    )
  );
create policy "contratante edita a propria avaliacao" on public.avaliacoes for update to authenticated
  using (empresa_id = auth.uid()) with check (empresa_id = auth.uid());
create policy "contratante apaga a propria avaliacao" on public.avaliacoes for delete to authenticated
  using (empresa_id = auth.uid());

-- 4) Recalcula a média do freelancer a cada avaliação nova/alterada/apagada
create or replace function public.recalcular_nota_freelancer()
returns trigger language plpgsql security definer set search_path = public as $$
declare alvo uuid := coalesce(new.freelancer_id, old.freelancer_id);
begin
  update public.perfis p
     set nota_media = s.media, nota_total = s.total
    from (select round(avg(nota)::numeric, 1) as media, count(*)::int as total
            from public.avaliacoes where freelancer_id = alvo) s
   where p.id = alvo;
  return null;
end $$;
revoke execute on function public.recalcular_nota_freelancer() from public, anon, authenticated;
create trigger ao_mudar_avaliacao
  after insert or update or delete on public.avaliacoes
  for each row execute function public.recalcular_nota_freelancer();

-- 5) LGPD: a exportação passa a incluir avaliações feitas e recebidas
create or replace function public.exportar_meus_dados()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exportado_em',    now(),
    'email',           (select email from auth.users where id = auth.uid()),
    'perfil',          (select to_jsonb(p) from public.perfis p where p.id = auth.uid()),
    'dados_privados',  (select to_jsonb(d) from public.dados_privados d where d.id = auth.uid()),
    'servico',         (select to_jsonb(s) from public.servicos s where s.freelancer_id = auth.uid()),
    'vagas',           (select coalesce(jsonb_agg(v), '[]') from public.vagas v where v.empresa_id = auth.uid()),
    'candidaturas',    (select coalesce(jsonb_agg(c), '[]') from public.candidaturas c where c.freelancer_id = auth.uid()),
    'vagas_salvas',    (select coalesce(jsonb_agg(s), '[]') from public.salvos s where s.freelancer_id = auth.uid()),
    'avaliacoes_recebidas', (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a where a.freelancer_id = auth.uid()),
    'avaliacoes_feitas',    (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a where a.empresa_id = auth.uid()),
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
