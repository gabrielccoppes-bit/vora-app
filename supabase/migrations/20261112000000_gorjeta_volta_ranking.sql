-- Vora: gorjeta e elogios do cliente final (QR Code), volta para casa segura
-- e ranking das melhores casas para trabalhar (selo Casa Vora).

/* ============ Gorjeta e elogios ============ */

-- Chave Pix que o freelancer escolhe mostrar na página pública de gorjeta
create table public.gorjeta_config (
  freelancer_id uuid primary key references public.perfis (id) on delete cascade,
  ativo         boolean not null default true,
  pix_chave     text check (pix_chave is null or length(pix_chave) between 3 and 77),
  pix_nome      text check (pix_nome is null or length(pix_nome) between 2 and 25),
  atualizado_em timestamptz not null default now()
);
alter table public.gorjeta_config enable row level security;
grant select, insert, update, delete on public.gorjeta_config to authenticated;
create policy "freelancer gerencia a propria gorjeta" on public.gorjeta_config for all to authenticated
  using (freelancer_id = auth.uid())
  with check (freelancer_id = auth.uid() and exists (select 1 from public.perfis p where p.id = auth.uid() and p.tipo = 'freelancer'));

create table public.elogios (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  tags          text[] not null default '{}' check (cardinality(tags) <= 4),
  texto         text check (texto is null or length(texto) between 2 and 280),
  autor         text check (autor is null or length(autor) between 1 and 40),
  oculto        boolean not null default false,
  criado_em     timestamptz not null default now(),
  check (cardinality(tags) > 0 or texto is not null)
);
create index elogios_freelancer_idx on public.elogios (freelancer_id, criado_em desc);
alter table public.elogios enable row level security;
grant select on public.elogios to authenticated;
grant update (oculto) on public.elogios to authenticated;
create policy "elogios visiveis" on public.elogios for select to authenticated
  using (not oculto or freelancer_id = auth.uid());
create policy "freelancer oculta elogio" on public.elogios for update to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());

alter table public.perfis add column elogios_total integer not null default 0;

create or replace function public.contar_elogios()
returns trigger language plpgsql security definer set search_path = public as $$
declare alvo uuid := coalesce(new.freelancer_id, old.freelancer_id);
begin
  update public.perfis set elogios_total = (select count(*) from public.elogios where freelancer_id = alvo and not oculto)
   where id = alvo;
  return null;
end $$;
revoke execute on function public.contar_elogios() from public, anon, authenticated;
create trigger contar_elogios after insert or delete or update of oculto on public.elogios
  for each row execute function public.contar_elogios();

-- Página pública (sem login): só o necessário para dar gorjeta e elogiar
create or replace function public.pagina_gorjeta(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'nome', primeiro_nome(p.nome), 'titulo', p.titulo, 'cidade', p.cidade, 'foto_v', p.foto_v,
    'selos', p.selos, 'elogios_total', p.elogios_total,
    'pix_chave', case when g.ativo then g.pix_chave end,
    'pix_nome', case when g.ativo then coalesce(g.pix_nome, p.nome) end,
    'ultimos', (select coalesce(jsonb_agg(jsonb_build_object('tags', e.tags, 'texto', e.texto, 'autor', e.autor, 'criado_em', e.criado_em) order by e.criado_em desc), '[]')
                  from (select * from public.elogios where freelancer_id = p.id and not oculto order by criado_em desc limit 3) e)
  )
  from public.perfis p left join public.gorjeta_config g on g.freelancer_id = p.id
  where p.codigo = upper(trim(p_codigo)) and p.tipo = 'freelancer' and not p.suspenso
    and coalesce(g.ativo, true);
$$;
revoke execute on function public.pagina_gorjeta(text) from public;
grant execute on function public.pagina_gorjeta(text) to anon, authenticated;

create or replace function public.deixar_elogio(p_codigo text, p_tags text[], p_texto text, p_autor text)
returns void language plpgsql security definer set search_path = public as $$
declare f uuid; t text := nullif(trim(coalesce(p_texto, '')), ''); a text := nullif(trim(coalesce(p_autor, '')), '');
        tg text[] := array(select distinct x from unnest(coalesce(p_tags, '{}')) x
                           where x in ('Atendimento incrível', 'Muito simpático(a)', 'Rápido(a)', 'Ótimas indicações', 'Drinks perfeitos', 'Cuidadoso(a)'));
begin
  select p.id into f from public.perfis p left join public.gorjeta_config g on g.freelancer_id = p.id
   where p.codigo = upper(trim(p_codigo)) and p.tipo = 'freelancer' and not p.suspenso and coalesce(g.ativo, true);
  if f is null then raise exception 'Perfil não encontrado' using errcode = 'P0001'; end if;
  if cardinality(tg) = 0 and t is null then raise exception 'Escolha um elogio ou escreva uma mensagem' using errcode = 'P0001'; end if;
  if (select count(*) from public.elogios where freelancer_id = f and criado_em > now() - interval '1 hour') >= 20 then
    raise exception 'Muitos elogios agora. Tente daqui a pouco.' using errcode = 'P0001';
  end if;
  insert into public.elogios (freelancer_id, tags, texto, autor) values (f, tg, left(t, 280), left(a, 40));
  perform public.notificar(f, 'elogio', 'Um cliente te elogiou 💛', coalesce(left(t, 90), array_to_string(tg, ' · ')), '/gorjeta');
end $$;
revoke execute on function public.deixar_elogio(text, text[], text, text) from public;
grant execute on function public.deixar_elogio(text, text[], text, text) to anon, authenticated;

/* ============ Volta para casa segura ============ */
alter table public.vagas add column transporte text not null default 'nao_informado'
  check (transporte in ('nao_informado', 'pago', 'ajuda', 'nao'));
grant update (transporte) on public.vagas to authenticated;

alter table public.candidaturas add column dividir_volta boolean not null default false;
alter table public.candidaturas add column bairro_volta text check (bairro_volta is null or length(bairro_volta) between 2 and 40);
alter table public.candidaturas add column chegou_em timestamptz;
alter table public.candidaturas add column volta_lembrada boolean not null default false;

create or replace function public.definir_volta(p_candidatura uuid, p_dividir boolean, p_bairro text)
returns void language plpgsql security definer set search_path = public as $$
declare b text := nullif(trim(coalesce(p_bairro, '')), '');
begin
  if p_dividir and b is null then raise exception 'Informe o bairro para onde você volta' using errcode = 'P0001'; end if;
  update public.candidaturas set dividir_volta = p_dividir, bairro_volta = case when p_dividir then left(b, 40) end
   where id = p_candidatura and freelancer_id = auth.uid() and status = 'contratado';
  if not found then raise exception 'Contratação não encontrada' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.definir_volta(uuid, boolean, text) from public, anon;
grant execute on function public.definir_volta(uuid, boolean, text) to authenticated;

create or replace function public.marcar_cheguei(p_candidatura uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.candidaturas set chegou_em = coalesce(chegou_em, now()), volta_lembrada = true
   where id = p_candidatura and freelancer_id = auth.uid();
  if not found then raise exception 'Contratação não encontrada' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.marcar_cheguei(uuid) from public, anon;
grant execute on function public.marcar_cheguei(uuid) to authenticated;

-- Colegas do mesmo turno que também querem dividir a volta (só vê quem também topou)
create or replace function public.colegas_de_volta(p_vaga uuid)
returns table (freelancer_id uuid, nome text, foto_v bigint, bairro text)
language sql stable security definer set search_path = public as $$
  select c.freelancer_id, primeiro_nome(p.nome), p.foto_v, c.bairro_volta
    from public.candidaturas c join public.perfis p on p.id = c.freelancer_id
   where c.vaga_id = p_vaga and c.status = 'contratado' and c.dividir_volta and c.freelancer_id <> auth.uid()
     and not public.bloqueado(auth.uid(), c.freelancer_id)
     and exists (select 1 from public.candidaturas eu
                  where eu.vaga_id = p_vaga and eu.freelancer_id = auth.uid() and eu.status = 'contratado' and eu.dividir_volta)
   order by c.bairro_volta;
$$;
revoke execute on function public.colegas_de_volta(uuid) from public, anon;
grant execute on function public.colegas_de_volta(uuid) to authenticated;

-- "Chegou bem?" para quem saiu de turno da noite (21h–6h) e não avisou
create or replace function public.lembrar_volta()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    update public.candidaturas c set volta_lembrada = true
     where c.status = 'contratado' and c.chegou_em is null and not c.volta_lembrada
       and c.checkout_em between now() - interval '3 hours' and now() - interval '40 minutes'
       and (extract(hour from c.checkout_em at time zone 'America/Sao_Paulo') >= 21
            or extract(hour from c.checkout_em at time zone 'America/Sao_Paulo') < 6)
    returning c.freelancer_id, c.vaga_id
  loop
    perform public.notificar(r.freelancer_id, 'volta', 'Chegou bem em casa? 🏠', 'Toque para avisar seu contato de confiança.', '/vaga/' || r.vaga_id);
  end loop;
end $$;
revoke execute on function public.lembrar_volta() from public, anon, authenticated;
select cron.schedule('vora-volta', '*/5 * * * *', $$select public.lembrar_volta()$$);

-- Repetir vaga leva junto o transporte
create or replace function public.repetir_vaga(p_vaga uuid, p_convidar boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vagas; nova uuid; n integer := 0; serie uuid;
begin
  select * into v from public.vagas where id = p_vaga and empresa_id = auth.uid();
  if not found then raise exception 'Vaga não encontrada' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfis where id = auth.uid() and suspenso) then raise exception 'Conta suspensa' using errcode = 'P0001'; end if;
  serie := coalesce(v.serie_id, v.id);
  if v.serie_id is null then update public.vagas set serie_id = serie where id = v.id; end if;

  insert into public.vagas (empresa_id, titulo, area, modalidade, contrato, nivel, valor_min, valor_max, periodo, duracao,
                            descricao, requisitos, urgente, inicio_em, quantidade, substituto_auto, serie_id, transporte)
  values (v.empresa_id, v.titulo, v.area, v.modalidade, v.contrato, v.nivel, v.valor_min, v.valor_max, v.periodo, v.duracao,
          v.descricao, v.requisitos, false,
          case when v.inicio_em is null then null
               else v.inicio_em + interval '7 days' * greatest(1, floor(extract(epoch from (now() - v.inicio_em)) / 604800.0)::int + 1) end,
          v.quantidade, v.substituto_auto, serie, v.transporte)
  returning id into nova;

  insert into public.vaga_instrucoes (vaga_id, traje, levar, chegada, contato)
  select nova, traje, levar, chegada, contato from public.vaga_instrucoes where vaga_id = v.id;

  if p_convidar then
    insert into public.convites (vaga_id, empresa_id, freelancer_id, mensagem)
    select nova, v.empresa_id, c.freelancer_id, 'Gostamos de trabalhar com você! Topa repetir o turno?'
      from public.candidaturas c join public.perfis p on p.id = c.freelancer_id
     where c.vaga_id = v.id and c.status = 'contratado' and not p.suspenso
       and not public.bloqueado(v.empresa_id, c.freelancer_id)
    on conflict do nothing;
    get diagnostics n = row_count;
  end if;
  return jsonb_build_object('id', nova, 'convidados', n);
end $$;
revoke execute on function public.repetir_vaga(uuid, boolean) from public, anon;
grant execute on function public.repetir_vaga(uuid, boolean) to authenticated;

/* ============ Ranking das casas e selo Casa Vora ============ */
alter table public.avaliacoes drop constraint if exists avaliacoes_tags_check;
alter table public.avaliacoes add constraint avaliacoes_tags_check check (cardinality(tags) <= 8);

create or replace function public.recalcular_selos(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record; concluidos int; com_horario int; pontuais int; pagou int; s text[] := '{}';
begin
  select tipo, nota_media, nota_total, faltas, cancelamentos into p from public.perfis where id = p_id;

  if p.tipo = 'empresa' then
    -- Casa Vora: bem avaliada por freelancers, paga em dia e quase não cancela
    select count(*) filter (where 'Pagou em dia' = any(tags)) into pagou
      from public.avaliacoes where empresa_id = p_id and direcao = 'freela_para_empresa';
    if p.nota_total >= 3 and p.nota_media >= 4.5 and p.cancelamentos <= 2 and pagou * 2 >= p.nota_total then
      s := array_append(s, 'casa_vora');
    end if;
    update public.perfis set selos = s where id = p_id and selos is distinct from s;
    return;
  end if;
  if p.tipo is distinct from 'freelancer' then return; end if;

  select count(*) filter (where c.checkin_em is not null or (v.inicio_em is not null and v.inicio_em < now())),
         count(*) filter (where c.checkin_em is not null and v.inicio_em is not null),
         count(*) filter (where c.checkin_em is not null and v.inicio_em is not null and c.checkin_em <= v.inicio_em + interval '5 minutes')
    into concluidos, com_horario, pontuais
    from public.candidaturas c join public.vagas v on v.id = c.vaga_id
   where c.freelancer_id = p_id and c.status = 'contratado';

  if p.nota_total >= 3 and p.nota_media >= 4.8 then s := array_append(s, 'top'); end if;
  if concluidos >= 5 and p.faltas = 0 and p.cancelamentos = 0 then s := array_append(s, 'presenca'); end if;
  if com_horario >= 5 and pontuais >= ceil(com_horario * 0.9) then s := array_append(s, 'pontual'); end if;
  if concluidos >= 20 then s := array_append(s, 'veterano'); end if;

  update public.perfis set selos = s where id = p_id and selos is distinct from s;
end $$;
revoke execute on function public.recalcular_selos(uuid) from public, anon, authenticated;

-- selos da casa também mudam quando as etiquetas de uma avaliação mudam
create or replace function public.selos_por_avaliacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.direcao, old.direcao) = 'freela_para_empresa' then
    perform public.recalcular_selos(coalesce(new.empresa_id, old.empresa_id));
  end if;
  return null;
end $$;
revoke execute on function public.selos_por_avaliacao() from public, anon, authenticated;
create trigger selos_por_avaliacao after insert or delete or update of tags on public.avaliacoes
  for each row execute function public.selos_por_avaliacao();

select cron.unschedule('vora-selos');
select cron.schedule('vora-selos', '17 4 * * *', $$select public.recalcular_selos(id) from public.perfis where tipo in ('freelancer', 'empresa')$$);
select public.recalcular_selos(id) from public.perfis where tipo = 'empresa';

-- Ranking: média ajustada (poucas avaliações não disparam ninguém para o topo)
create or replace function public.ranking_casas(p_uf text default null, p_cidade text default null)
returns table (id uuid, nome text, titulo text, cidade text, uf text, foto_v bigint, verificado boolean,
               nota_media numeric, nota_total integer, selos text[], destaques jsonb, pontuacao numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.titulo, p.cidade, p.uf, p.foto_v, p.verificado, p.nota_media, p.nota_total, p.selos,
         (select coalesce(jsonb_agg(jsonb_build_object('tag', t.tag, 'n', t.n) order by t.n desc, t.tag), '[]')
            from (select tag, count(*)::int as n
                    from public.avaliacoes a, unnest(a.tags) tag
                   where a.empresa_id = p.id and a.direcao = 'freela_para_empresa'
                   group by tag order by count(*) desc, tag limit 3) t),
         round((coalesce(p.nota_media, 0) * p.nota_total + 4.0 * 3) / (p.nota_total + 3), 2)
    from public.perfis p
   where p.tipo = 'empresa' and not p.suspenso and p.nota_total >= 1
     and (p_uf is null or p.uf = upper(p_uf))
     and (p_cidade is null or lower(p.cidade) = lower(p_cidade))
     and not public.bloqueado(auth.uid(), p.id)
   order by 12 desc, p.nota_total desc
   limit 50;
$$;
revoke execute on function public.ranking_casas(text, text) from public, anon;
grant execute on function public.ranking_casas(text, text) to authenticated;

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
    'termos_servico',  (select coalesce(jsonb_agg(x), '[]') from public.termos_servico x where auth.uid() in (x.empresa_id, x.freelancer_id)),
    'indicacoes',      (select coalesce(jsonb_agg(x), '[]') from public.indicacoes x where auth.uid() in (x.indicador_id, x.indicado_id)),
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid()),
    'gorjeta',         (select to_jsonb(g) from public.gorjeta_config g where g.freelancer_id = auth.uid()),
    'elogios_recebidos', (select coalesce(jsonb_agg(e), '[]') from public.elogios e where e.freelancer_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

/* ============ Permissões finas (Supabase concede tudo por padrão) ============ */
revoke all on public.elogios, public.gorjeta_config from anon;
revoke insert, delete, truncate, references, trigger on public.elogios from authenticated;
revoke update on public.elogios from authenticated;
grant update (oculto) on public.elogios to authenticated;
revoke truncate, references, trigger on public.gorjeta_config from authenticated;
