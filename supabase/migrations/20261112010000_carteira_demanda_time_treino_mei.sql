-- Vora: carteira de trabalho verificada, datas de movimento (alerta de demanda),
-- janela exclusiva para o time da casa, microtreinamentos e ajuda com o MEI.

/* ============ Microtreinamentos ============ */
create table public.treinamentos_concluidos (
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  modulo        text not null check (modulo in ('atendimento', 'higiene', 'bebida', 'seguranca')),
  acertos       smallint not null,
  concluido_em  timestamptz not null default now(),
  primary key (freelancer_id, modulo)
);
alter table public.treinamentos_concluidos enable row level security;
revoke all on public.treinamentos_concluidos from anon, authenticated;
grant select on public.treinamentos_concluidos to authenticated;
create policy "treinamentos visiveis" on public.treinamentos_concluidos for select to authenticated using (true);

-- O gabarito fica no servidor: só conclui quem acerta tudo
create or replace function public.concluir_treinamento(p_modulo text, p_respostas int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare gab int[]; certos int := 0;
begin
  if not exists (select 1 from public.perfis where id = auth.uid() and tipo = 'freelancer') then
    raise exception 'Treinamentos são para freelancers' using errcode = 'P0001';
  end if;
  gab := case p_modulo
           when 'atendimento' then array[1, 1, 2]
           when 'higiene'     then array[0, 1, 1]
           when 'bebida'      then array[1, 1, 1]
           when 'seguranca'   then array[1, 1, 1]
         end;
  if gab is null then raise exception 'Módulo inválido' using errcode = 'P0001'; end if;
  for i in 1 .. array_length(gab, 1) loop
    if p_respostas[i] = gab[i] then certos := certos + 1; end if;
  end loop;
  if certos = array_length(gab, 1) then
    insert into public.treinamentos_concluidos (freelancer_id, modulo, acertos) values (auth.uid(), p_modulo, certos)
    on conflict (freelancer_id, modulo) do update set acertos = excluded.acertos, concluido_em = now();
    perform public.recalcular_selos(auth.uid());
  end if;
  return jsonb_build_object('acertos', certos, 'total', array_length(gab, 1), 'aprovado', certos = array_length(gab, 1),
                            'erradas', (select coalesce(jsonb_agg(i), '[]') from generate_subscripts(gab, 1) i where p_respostas[i] is distinct from gab[i]));
end $$;
revoke execute on function public.concluir_treinamento(text, int[]) from public, anon;
grant execute on function public.concluir_treinamento(text, int[]) to authenticated;

-- Selo "Capacitado": concluiu todos os treinamentos
create or replace function public.recalcular_selos(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record; concluidos int; com_horario int; pontuais int; pagou int; s text[] := '{}';
begin
  select tipo, nota_media, nota_total, faltas, cancelamentos into p from public.perfis where id = p_id;

  if p.tipo = 'empresa' then
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
  if (select count(*) from public.treinamentos_concluidos where freelancer_id = p_id) >= 4 then s := array_append(s, 'capacitado'); end if;

  update public.perfis set selos = s where id = p_id and selos is distinct from s;
end $$;
revoke execute on function public.recalcular_selos(uuid) from public, anon, authenticated;

/* ============ Carteira de trabalho Vora ============ */
alter table public.perfis add column carteira_publica boolean not null default false;
grant update (carteira_publica) on public.perfis to authenticated;

create or replace function public.carteira_de(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select c.id, c.checkin_em, c.checkout_em, c.presenca_por, v.titulo, v.area, v.inicio_em, e.nome as casa, e.cidade,
           case when c.checkin_em is not null and c.checkout_em is not null
                then extract(epoch from (c.checkout_em - c.checkin_em)) / 3600.0 end as horas
      from public.candidaturas c join public.vagas v on v.id = c.vaga_id join public.perfis e on e.id = v.empresa_id
     where c.freelancer_id = p_id and c.status = 'contratado'
       and (c.checkout_em is not null or (v.inicio_em is not null and v.inicio_em < now() - interval '12 hours'))
  )
  select jsonb_build_object(
    'nome', p.nome, 'titulo', p.titulo, 'areas', p.areas, 'cidade', p.cidade, 'uf', p.uf, 'foto_v', p.foto_v, 'id', p.id,
    'verificado', p.verificado, 'codigo', p.codigo, 'membro_desde', p.criado_em, 'gerada_em', now(),
    'nota_media', p.nota_media, 'nota_total', p.nota_total, 'faltas', p.faltas, 'cancelamentos', p.cancelamentos,
    'selos', p.selos, 'elogios_total', p.elogios_total, 'publica', p.carteira_publica,
    'turnos', (select count(*) from t),
    'turnos_gps', (select count(*) from t where t.checkout_em is not null),
    'horas', (select round(coalesce(sum(t.horas), 0)::numeric, 1) from t),
    'casas', (select count(distinct t.casa) from t),
    'treinamentos', (select coalesce(jsonb_agg(jsonb_build_object('modulo', x.modulo, 'em', x.concluido_em) order by x.concluido_em), '[]')
                       from public.treinamentos_concluidos x where x.freelancer_id = p.id),
    'historico', (select coalesce(jsonb_agg(jsonb_build_object('casa', h.casa, 'cidade', h.cidade, 'funcao', h.titulo, 'area', h.area,
                                                               'data', coalesce(h.checkin_em, h.inicio_em), 'horas', round(h.horas::numeric, 1),
                                                               'gps', h.checkout_em is not null) order by coalesce(h.checkin_em, h.inicio_em) desc), '[]')
                    from (select * from t order by coalesce(t.checkin_em, t.inicio_em) desc limit 60) h)
  )
  from public.perfis p where p.id = p_id and p.tipo = 'freelancer';
$$;
revoke execute on function public.carteira_de(uuid) from public, anon, authenticated;

create or replace function public.minha_carteira()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.carteira_de(auth.uid());
$$;
revoke execute on function public.minha_carteira() from public, anon;
grant execute on function public.minha_carteira() to authenticated;

-- Link de verificação: só funciona se o freelancer deixar a carteira pública
create or replace function public.carteira_publica(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.carteira_de(p.id) from public.perfis p
   where p.codigo = upper(trim(p_codigo)) and p.tipo = 'freelancer' and p.carteira_publica and not p.suspenso;
$$;
revoke execute on function public.carteira_publica(text) from public;
grant execute on function public.carteira_publica(text) to anon, authenticated;

/* ============ Janela do time da casa ============ */
alter table public.vagas add column exclusivo_ate timestamptz;

create or replace function public.pode_ver_exclusiva(p_empresa uuid, p_vaga uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.favoritos f where f.empresa_id = p_empresa and f.freelancer_id = auth.uid())
      or exists (select 1 from public.convites c where c.vaga_id = p_vaga and c.freelancer_id = auth.uid())
      or exists (select 1 from public.candidaturas c where c.vaga_id = p_vaga and c.freelancer_id = auth.uid());
$$;
revoke execute on function public.pode_ver_exclusiva(uuid, uuid) from public, anon;
grant execute on function public.pode_ver_exclusiva(uuid, uuid) to authenticated;

drop policy "vagas ativas visiveis" on public.vagas;
create policy "vagas ativas visiveis" on public.vagas for select to authenticated
  using (empresa_id = auth.uid()
         or public.eh_admin()
         or (ativa and not exists (select 1 from public.perfis p where p.id = empresa_id and p.suspenso)
             and (exclusivo_ate is null or exclusivo_ate <= now() or public.pode_ver_exclusiva(empresa_id, id))));

-- Limites: no máximo 3 horas; vaga urgente não tem janela
create or replace function public.ajustar_exclusiva()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.exclusivo_ate is not null then
    if new.urgente then new.exclusivo_ate := null;
    else new.exclusivo_ate := least(new.exclusivo_ate, now() + interval '3 hours');
    end if;
  end if;
  return new;
end $$;
create trigger ajustar_exclusiva before insert on public.vagas for each row execute function public.ajustar_exclusiva();

create or replace function public.avisar_time_da_casa()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; casa text;
begin
  if new.exclusivo_ate is null or new.exclusivo_ate <= now() then return null; end if;
  -- escala: avisa uma vez só
  if new.serie_id is not null and exists (select 1 from public.vagas v where v.serie_id = new.serie_id and v.id <> new.id and v.criado_em > now() - interval '2 minutes') then
    return null;
  end if;
  select nome into casa from public.perfis where id = new.empresa_id;
  for r in select f.freelancer_id from public.favoritos f join public.perfis p on p.id = f.freelancer_id
            where f.empresa_id = new.empresa_id and not p.suspenso and not public.bloqueado(new.empresa_id, f.freelancer_id)
  loop
    perform public.notificar(r.freelancer_id, 'time_da_casa', casa || ' chamou o time da casa 🔒',
      new.titulo || ' · você vê antes de todo mundo, até ' || to_char(new.exclusivo_ate at time zone 'America/Sao_Paulo', 'HH24:MI'), '/vaga/' || new.id);
  end loop;
  return null;
end $$;
revoke execute on function public.avisar_time_da_casa() from public, anon, authenticated;
create trigger avisar_time_da_casa after insert on public.vagas for each row execute function public.avisar_time_da_casa();

/* ============ Datas de movimento (alerta de demanda) ============ */
create table public.datas_movimento (
  id        uuid primary key default gen_random_uuid(),
  inicio    date not null,
  fim       date not null,
  titulo    text not null check (length(titulo) between 3 and 80),
  dica      text check (dica is null or length(dica) <= 240),
  cidade    text,          -- null = vale para todas
  uf        text,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
alter table public.datas_movimento enable row level security;
revoke all on public.datas_movimento from anon, authenticated;
grant select, insert, delete on public.datas_movimento to authenticated;
create policy "datas visiveis" on public.datas_movimento for select to authenticated using (true);
create policy "admin cadastra datas" on public.datas_movimento for insert to authenticated with check (public.eh_admin());
create policy "admin apaga datas" on public.datas_movimento for delete to authenticated using (public.eh_admin());

insert into public.datas_movimento (inicio, fim, titulo, dica, cidade, uf) values
  ('2026-11-20', '2026-11-22', 'Feriadão da Consciência Negra', 'Feriado nacional na sexta: bares cheios de quinta a domingo.', null, null),
  ('2026-12-01', '2026-12-23', 'Festas de fim de ano das empresas', 'Temporada de confraternizações: reservas grandes e eventos fechados.', null, null),
  ('2026-12-24', '2026-12-25', 'Natal', 'Ceias e almoços: quem trabalha costuma combinar com antecedência.', null, null),
  ('2026-12-31', '2027-01-01', 'Réveillon', 'A noite mais disputada do ano para freelancers.', null, null),
  ('2027-02-02', '2027-02-02', 'Nossa Senhora dos Navegantes', 'Feriado municipal em Porto Alegre, com a procissão no centro.', 'Porto Alegre', 'RS'),
  ('2027-02-06', '2027-02-09', 'Carnaval', 'Blocos e festas: movimento alto do sábado à terça.', null, null),
  ('2027-05-09', '2027-05-09', 'Dia das Mães', 'Um dos almoços mais cheios do ano nos restaurantes.', null, null),
  ('2027-06-12', '2027-06-12', 'Dia dos Namorados', 'Jantares com reserva: reforce o salão.', null, null),
  ('2027-08-08', '2027-08-08', 'Dia dos Pais', 'Almoço de domingo cheio.', null, null),
  ('2027-09-20', '2027-09-20', 'Dia do Gaúcho (Revolução Farroupilha)', 'Feriado estadual no fim da Semana Farroupilha.', null, 'RS');

create or replace function public.avisar_datas_movimento()
returns void language plpgsql security definer set search_path = public as $$
declare d record; r record;
begin
  for d in select * from public.datas_movimento where inicio = (now() at time zone 'America/Sao_Paulo')::date + 7 loop
    for r in select id, tipo from public.perfis p
              where not p.suspenso
                and (d.uf is null or p.uf = d.uf)
                and (d.cidade is null or lower(p.cidade) = lower(d.cidade))
    loop
      if r.tipo = 'empresa' then
        perform public.notificar(r.id, 'movimento', 'Daqui a 1 semana: ' || d.titulo, coalesce(d.dica || ' ', '') || 'Publique cedo e garanta a equipe.', '/publicar');
      else
        perform public.notificar(r.id, 'movimento', 'Vem aí: ' || d.titulo, 'Datas assim têm muitas vagas. Deixe sua disponibilidade em dia.', '/disponibilidade');
      end if;
    end loop;
  end loop;
end $$;
revoke execute on function public.avisar_datas_movimento() from public, anon, authenticated;
select cron.schedule('vora-movimento', '7 13 * * *', $$select public.avisar_datas_movimento()$$);

/* ============ MEI: lembrete do DAS e da declaração anual ============ */
create or replace function public.lembrar_mei()
returns void language plpgsql security definer set search_path = public as $$
declare r record; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for r in select p.id from public.perfis p join public.dados_privados d on d.id = p.id
            where p.tipo = 'freelancer' and not p.suspenso and d.cnpj_mei is not null
  loop
    if extract(day from hoje) = 15 then
      perform public.notificar(r.id, 'mei', 'O DAS do seu MEI vence dia 20', 'Pague em dia para manter o INSS e os benefícios.', '/mei');
    end if;
    if extract(month from hoje) = 5 and extract(day from hoje) = 20 then
      perform public.notificar(r.id, 'mei', 'Declaração anual do MEI até 31/05', 'A DASN-SIMEI informa quanto você faturou no ano passado.', '/mei');
    end if;
  end loop;
end $$;
revoke execute on function public.lembrar_mei() from public, anon, authenticated;
select cron.schedule('vora-mei', '3 12 * * *', $$select public.lembrar_mei()$$);

-- Freelancer sabe se tem MEI cadastrado (sem expor o número)
create or replace function public.tenho_mei()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select d.cnpj_mei is not null from public.dados_privados d where d.id = auth.uid()), false);
$$;
revoke execute on function public.tenho_mei() from public, anon;
grant execute on function public.tenho_mei() to authenticated;

/* ============ LGPD: treinamentos no export ============ */
do $$
declare def text;
begin
  select pg_get_functiondef('public.exportar_meus_dados()'::regprocedure) into def;
  def := replace(def, $q$'elogios_recebidos',$q$, $q$'treinamentos', (select coalesce(jsonb_agg(x), '[]') from public.treinamentos_concluidos x where x.freelancer_id = auth.uid()),
    'elogios_recebidos',$q$);
  execute def;
end $$;

/* ============ MEI: informar ou remover o CNPJ depois do cadastro ============ */
create or replace function public.informar_mei(p_cnpj text)
returns void language plpgsql security definer set search_path = public as $$
declare c text := nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9A-Za-z]', '', 'g'), '');
begin
  if not exists (select 1 from public.perfis where id = auth.uid() and tipo = 'freelancer') then
    raise exception 'Disponível para freelancers' using errcode = 'P0001';
  end if;
  if c is not null and not public.cnpj_valido(upper(c)) then
    raise exception 'CNPJ inválido. Confira os números.' using errcode = 'P0001';
  end if;
  update public.dados_privados set cnpj_mei = upper(c) where id = auth.uid();
end $$;
revoke execute on function public.informar_mei(text) from public, anon;
grant execute on function public.informar_mei(text) to authenticated;
