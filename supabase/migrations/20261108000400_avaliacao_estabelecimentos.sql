-- =====================================================================
--  Avaliações nos dois sentidos
--  empresa_para_freela: o estabelecimento avalia o freelancer (já existia)
--  freela_para_empresa: o freelancer avalia o estabelecimento (novo)
--  Regra comum: só avalia quem participou de uma contratação real.
-- =====================================================================

alter table public.avaliacoes
  add column direcao text not null default 'empresa_para_freela'
  check (direcao in ('empresa_para_freela', 'freela_para_empresa'));

-- uma avaliação por contratação EM CADA sentido
alter table public.avaliacoes drop constraint avaliacoes_candidatura_id_key;
alter table public.avaliacoes add constraint avaliacoes_candidatura_direcao_key unique (candidatura_id, direcao);
create index avaliacoes_empresa_idx on public.avaliacoes (empresa_id, direcao, criado_em desc);

-- Regras de escrita (leitura continua pública para usuários logados)
drop policy "contratante avalia quem contratou" on public.avaliacoes;
drop policy "contratante edita a propria avaliacao" on public.avaliacoes;
drop policy "contratante apaga a propria avaliacao" on public.avaliacoes;

create policy "contratante avalia quem contratou" on public.avaliacoes for insert to authenticated
  with check (
    direcao = 'empresa_para_freela'
    and empresa_id = auth.uid()
    and exists (
      select 1 from public.candidaturas c
        join public.vagas v on v.id = c.vaga_id
       where c.id = candidatura_id and c.status = 'contratado'
         and c.vaga_id = avaliacoes.vaga_id and c.freelancer_id = avaliacoes.freelancer_id
         and v.empresa_id = auth.uid()
    )
  );

create policy "freelancer avalia quem o contratou" on public.avaliacoes for insert to authenticated
  with check (
    direcao = 'freela_para_empresa'
    and freelancer_id = auth.uid()
    and exists (
      select 1 from public.candidaturas c
        join public.vagas v on v.id = c.vaga_id
       where c.id = candidatura_id and c.status = 'contratado'
         and c.vaga_id = avaliacoes.vaga_id and c.freelancer_id = auth.uid()
         and v.empresa_id = avaliacoes.empresa_id
    )
  );

create policy "autor edita a propria avaliacao" on public.avaliacoes for update to authenticated
  using ((direcao = 'empresa_para_freela' and empresa_id = auth.uid()) or (direcao = 'freela_para_empresa' and freelancer_id = auth.uid()))
  with check ((direcao = 'empresa_para_freela' and empresa_id = auth.uid()) or (direcao = 'freela_para_empresa' and freelancer_id = auth.uid()));

create policy "autor apaga a propria avaliacao" on public.avaliacoes for delete to authenticated
  using ((direcao = 'empresa_para_freela' and empresa_id = auth.uid()) or (direcao = 'freela_para_empresa' and freelancer_id = auth.uid()));

-- Média: do freelancer (avaliações recebidas dos estabelecimentos) ou do estabelecimento
create or replace function public.recalcular_nota_freelancer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d text;
  alvo uuid;
begin
  if tg_op = 'DELETE' then
    d := old.direcao;
    alvo := case when old.direcao = 'empresa_para_freela' then old.freelancer_id else old.empresa_id end;
  else
    d := new.direcao;
    alvo := case when new.direcao = 'empresa_para_freela' then new.freelancer_id else new.empresa_id end;
  end if;

  update public.perfis p
     set nota_media = s.media, nota_total = s.total
    from (select round(avg(nota)::numeric, 1) as media, count(*)::int as total
            from public.avaliacoes a
           where a.direcao = d
             and (case when d = 'empresa_para_freela' then a.freelancer_id else a.empresa_id end) = alvo) s
   where p.id = alvo;
  return null;
end $$;
revoke execute on function public.recalcular_nota_freelancer() from public, anon, authenticated;

-- LGPD: recebidas/feitas considerando o sentido
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
    'avaliacoes_recebidas', (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a
                              where (a.direcao = 'empresa_para_freela' and a.freelancer_id = auth.uid())
                                 or (a.direcao = 'freela_para_empresa' and a.empresa_id = auth.uid())),
    'avaliacoes_feitas',    (select coalesce(jsonb_agg(a), '[]') from public.avaliacoes a
                              where (a.direcao = 'empresa_para_freela' and a.empresa_id = auth.uid())
                                 or (a.direcao = 'freela_para_empresa' and a.freelancer_id = auth.uid())),
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
