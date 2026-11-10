-- Vora: vaga para várias pessoas, substituto automático e lembretes automáticos.

/* ============ Vaga para várias pessoas ============ */
alter table public.vagas add column quantidade smallint not null default 1 check (quantidade between 1 and 50);
alter table public.vagas add column contratados smallint not null default 0;   -- mantido pelo banco
alter table public.vagas add column completa boolean not null default false;   -- fechou porque lotou
alter table public.vagas add column substituto_auto boolean not null default true;
alter table public.vagas add column lembrete_2h_em timestamptz;

update public.vagas v set contratados = (select count(*) from public.candidaturas c where c.vaga_id = v.id and c.status = 'contratado');

-- O contratante não pode mexer nos campos mantidos pelo banco
revoke update on public.vagas from authenticated;
grant update (titulo, area, modalidade, contrato, nivel, valor_min, valor_max, periodo, duracao, descricao,
              requisitos, ativa, urgente, inicio_em, quantidade, substituto_auto) on public.vagas to authenticated;

-- Mudou a quantidade: fecha se lotou, reabre se ainda cabe gente
create or replace function public.ajustar_lotacao_vaga()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.quantidade is distinct from old.quantidade and new.quantidade < new.contratados then
    raise exception 'Já há % pessoas contratadas. A quantidade não pode ser menor.', new.contratados using errcode = 'P0001';
  end if;
  if new.contratados >= new.quantidade then
    if new.ativa or not new.completa then new.ativa := false; new.completa := true; end if;
  elsif old.completa then
    new.completa := false;
    if new.inicio_em is null or new.inicio_em > now() - interval '1 hour' then new.ativa := true; end if;
  end if;
  if new.ativa and new.completa then new.completa := false; end if; -- reaberta à mão
  return new;
end $$;
create trigger ajustar_lotacao_vaga before update of quantidade, contratados, ativa on public.vagas
  for each row execute function public.ajustar_lotacao_vaga();

-- Recalcula quantos foram contratados (o gatilho acima fecha/reabre a vaga)
create or replace function public.recontar_contratados()
returns trigger language plpgsql security definer set search_path = public as $$
declare vid uuid := coalesce(new.vaga_id, old.vaga_id);
begin
  update public.vagas set contratados = (select count(*) from public.candidaturas where vaga_id = vid and status = 'contratado')
   where id = vid;
  return null;
end $$;
revoke execute on function public.recontar_contratados() from public, anon, authenticated;
create trigger recontar_contratados after insert or update of status or delete on public.candidaturas
  for each row execute function public.recontar_contratados();

/* ============ Substituto automático ============ */
alter table public.convites add column substituicao boolean not null default false;

create or replace function public.buscar_substituto()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record; n integer;
begin
  if not (old.status = 'contratado' and new.status = 'cancelado_freela') then return null; end if;
  select id, titulo, empresa_id, inicio_em, substituto_auto into v from public.vagas where id = new.vaga_id;
  if not v.substituto_auto or (v.inicio_em is not null and v.inicio_em < now() - interval '1 hour') then return null; end if;

  -- convida: quem já se candidatou e está aguardando + favoritos do estabelecimento
  with alvos as (
    select c.freelancer_id as id, 1 as ordem from public.candidaturas c
     where c.vaga_id = v.id and c.status = 'pendente'
    union
    select f.freelancer_id, 2 from public.favoritos f
     where f.empresa_id = v.empresa_id
       and not exists (select 1 from public.candidaturas c where c.vaga_id = v.id and c.freelancer_id = f.freelancer_id and c.status <> 'pendente')
  ), filtrados as (
    select distinct on (a.id) a.id, a.ordem from alvos a join public.perfis p on p.id = a.id
     where a.id <> new.freelancer_id and not p.suspenso
       and not exists (select 1 from public.bloqueios b where (b.autor_id = a.id and b.alvo_id = v.empresa_id) or (b.autor_id = v.empresa_id and b.alvo_id = a.id))
     order by a.id, a.ordem
  ), novos as (
    insert into public.convites (vaga_id, empresa_id, freelancer_id, mensagem, substituicao)
    select v.id, v.empresa_id, f.id, 'Alguém cancelou e precisamos de reforço. O primeiro que aceitar fica com o turno.', true
      from filtrados f order by f.ordem limit 25
    on conflict (vaga_id, freelancer_id) do nothing
    returning 1
  )
  select count(*) into n from novos;

  perform public.notificar(v.empresa_id, 'substituto',
    case when n > 0 then 'Procurando substituto' else 'Sem substituto automático' end,
    case when n > 0 then 'Convidamos ' || n || ' pessoa(s) para ' || v.titulo || '. O primeiro que aceitar entra.'
         else 'Não havia candidatos nem favoritos para convidar em ' || v.titulo || '. Que tal reabrir para todos?' end,
    '/vaga/' || v.id);
  return null;
end $$;
revoke execute on function public.buscar_substituto() from public, anon, authenticated;
create trigger buscar_substituto after update of status on public.candidaturas
  for each row execute function public.buscar_substituto();

-- Convite de substituição tem aviso próprio
create or replace function public.avisar_convite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select vg.titulo, vg.inicio_em, e.nome as empresa into v from public.vagas vg join public.perfis e on e.id = vg.empresa_id where vg.id = new.vaga_id;
  if tg_op = 'INSERT' then
    if new.substituicao then
      perform public.notificar(new.freelancer_id, 'convite', '⚡ ' || v.empresa || ' precisa de alguém',
        v.titulo || coalesce(' · ' || to_char(v.inicio_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), '') || ' · quem aceitar primeiro fica', '/convites');
    else
      perform public.notificar(new.freelancer_id, 'convite', v.empresa || ' convidou você', v.titulo, '/convites');
    end if;
  elsif new.status = 'recusado' and old.status = 'pendente' and not new.substituicao then
    perform public.notificar(new.empresa_id, 'convite_recusado', (select primeiro_nome(nome) from public.perfis where id = new.freelancer_id) || ' recusou o convite', v.titulo, '/vaga/' || new.vaga_id);
  end if;
  return null;
end $$;
revoke execute on function public.avisar_convite() from public, anon, authenticated;

-- Aceitar convite: trava a vaga para o "primeiro que aceitar" valer de verdade
create or replace function public.responder_convite(p_convite uuid, p_aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare cv public.convites; vg record;
begin
  select * into cv from public.convites where id = p_convite and freelancer_id = auth.uid() for update;
  if not found then raise exception 'Convite não encontrado' using errcode = 'P0001'; end if;
  if cv.status <> 'pendente' then raise exception 'Esse convite já foi respondido' using errcode = 'P0001'; end if;

  if p_aceitar then
    select ativa, completa, contratados, quantidade into vg from public.vagas where id = cv.vaga_id for update;
    if vg.completa or vg.contratados >= vg.quantidade then
      update public.convites set status = 'recusado', respondido_em = now() where id = p_convite;
      raise exception 'Alguém já pegou essa vaga. Fica para a próxima!' using errcode = 'P0001';
    end if;
    if not vg.ativa then raise exception 'Essa vaga foi encerrada' using errcode = 'P0001'; end if;
    perform set_config('vora.convite', '1', true);
    insert into public.candidaturas (vaga_id, freelancer_id, mensagem, status)
    values (cv.vaga_id, cv.freelancer_id, case when cv.substituicao then 'Entrou como substituto(a).' else 'Aceitou o convite do estabelecimento.' end, 'contratado')
    on conflict (vaga_id, freelancer_id) do update set status = 'contratado'
      where public.candidaturas.status in ('pendente', 'recusado');
    perform set_config('vora.convite', '', true);
  end if;

  update public.convites set status = case when p_aceitar then 'aceito' else 'recusado' end, respondido_em = now()
   where id = p_convite;
end $$;
revoke execute on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;

-- Contratante não contrata além da quantidade
create or replace function public.validar_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  dono uuid;
  inicio timestamptz;
  qtd smallint;
  ja integer;
  convite boolean := coalesce(current_setting('vora.convite', true), '') = '1';
begin
  if eu is null or convite then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    return new;
  end if;
  if new.status = old.status then return new; end if;
  select empresa_id, inicio_em, quantidade into dono, inicio, qtd from public.vagas where id = new.vaga_id;
  if eu = dono then
    if not (
      (old.status in ('pendente', 'contratado', 'recusado') and new.status in ('pendente', 'contratado', 'recusado'))
      or (old.status = 'contratado' and new.status in ('cancelado_empresa', 'falta'))
      or (old.status = 'falta' and new.status = 'contratado')
    ) then
      raise exception 'Mudança de status não permitida' using errcode = 'P0001';
    end if;
    if new.status = 'contratado' then
      select count(*) into ja from public.candidaturas where vaga_id = new.vaga_id and status = 'contratado' and id <> new.id;
      if ja >= qtd then
        raise exception 'Mudança de status não permitida: a vaga já está completa (% de %). Aumente a quantidade de pessoas para contratar mais.', ja, qtd using errcode = 'P0001';
      end if;
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

/* ============ Lembretes automáticos ============ */
alter table public.candidaturas add column lembrete_vespera_em timestamptz;
alter table public.candidaturas add column lembrete_2h_em timestamptz;
alter table public.candidaturas add column lembrete_atraso_em timestamptz;

create or replace function public.enviar_lembretes()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; total integer := 0; hora text; dia text;
begin
  -- 1) Véspera (entre 24h e 3h antes)
  for r in
    select c.id, c.freelancer_id, vg.id as vaga_id, vg.titulo, vg.inicio_em, e.nome as empresa
      from public.candidaturas c join public.vagas vg on vg.id = c.vaga_id join public.perfis e on e.id = vg.empresa_id
     where c.status = 'contratado' and c.lembrete_vespera_em is null and c.lembrete_2h_em is null
       and vg.inicio_em between now() + interval '3 hours' and now() + interval '24 hours'
     for update of c skip locked
  loop
    hora := to_char(r.inicio_em at time zone 'America/Sao_Paulo', 'HH24:MI');
    dia := case when (r.inicio_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date then 'hoje' else 'amanhã' end;
    perform public.notificar(r.freelancer_id, 'lembrete', 'Seu turno é ' || dia || ' às ' || hora, r.titulo || ' · ' || r.empresa, '/vaga/' || r.vaga_id);
    update public.candidaturas set lembrete_vespera_em = now() where id = r.id;
    total := total + 1;
  end loop;

  -- 2) Duas horas antes
  for r in
    select c.id, c.freelancer_id, vg.id as vaga_id, vg.titulo, vg.inicio_em, e.nome as empresa
      from public.candidaturas c join public.vagas vg on vg.id = c.vaga_id join public.perfis e on e.id = vg.empresa_id
     where c.status = 'contratado' and c.lembrete_2h_em is null and c.checkin_em is null
       and vg.inicio_em between now() and now() + interval '2 hours'
     for update of c skip locked
  loop
    perform public.notificar(r.freelancer_id, 'lembrete', 'Seu turno começa às ' || to_char(r.inicio_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
      r.empresa || ' · faça o check-in quando chegar', '/vaga/' || r.vaga_id);
    update public.candidaturas set lembrete_2h_em = now(), lembrete_vespera_em = coalesce(lembrete_vespera_em, now()) where id = r.id;
    total := total + 1;
  end loop;

  -- 3) Resumo para o estabelecimento, duas horas antes
  for r in
    select vg.id, vg.empresa_id, vg.titulo, vg.inicio_em, vg.contratados, vg.quantidade
      from public.vagas vg
     where vg.lembrete_2h_em is null and vg.contratados > 0
       and vg.inicio_em between now() and now() + interval '2 hours'
     for update skip locked
  loop
    perform public.notificar(r.empresa_id, 'lembrete', 'Hoje às ' || to_char(r.inicio_em at time zone 'America/Sao_Paulo', 'HH24:MI') || ': ' || r.titulo,
      r.contratados || ' de ' || r.quantidade || ' confirmado(s)' || case when r.contratados < r.quantidade then ' · ainda faltam ' || (r.quantidade - r.contratados) else '' end,
      '/vaga/' || r.id);
    update public.vagas set lembrete_2h_em = now() where id = r.id;
    total := total + 1;
  end loop;

  -- 4) Check-in atrasado (15 min depois do início)
  for r in
    select c.id, c.freelancer_id, vg.id as vaga_id, vg.titulo, vg.empresa_id, e.nome as empresa, f.nome as freela
      from public.candidaturas c join public.vagas vg on vg.id = c.vaga_id
      join public.perfis e on e.id = vg.empresa_id join public.perfis f on f.id = c.freelancer_id
     where c.status = 'contratado' and c.checkin_em is null and c.lembrete_atraso_em is null
       and vg.inicio_em between now() - interval '2 hours' and now() - interval '15 minutes'
     for update of c skip locked
  loop
    perform public.notificar(r.freelancer_id, 'lembrete', 'Você ainda não fez check-in', r.empresa || ' · ' || r.titulo || '. Se já chegou, registre agora.', '/vaga/' || r.vaga_id);
    perform public.notificar(r.empresa_id, 'lembrete', primeiro_nome(r.freela) || ' ainda não fez check-in', r.titulo || '. Se já chegou, você pode confirmar a chegada.', '/vaga/' || r.vaga_id);
    update public.candidaturas set lembrete_atraso_em = now() where id = r.id;
    total := total + 1;
  end loop;

  return total;
end $$;
revoke execute on function public.enviar_lembretes() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('vora-lembretes', '*/5 * * * *', $$select public.enviar_lembretes()$$);

-- Aviso ao estabelecimento quando o substituto entra
create or replace function public.avisar_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record; f text;
begin
  select vg.id, vg.titulo, vg.empresa_id, vg.contratados, vg.quantidade, e.nome as empresa into v
    from public.vagas vg join public.perfis e on e.id = vg.empresa_id where vg.id = new.vaga_id;
  select nome into f from public.perfis where id = new.freelancer_id;

  if tg_op = 'INSERT' then
    if new.status = 'contratado' then
      if coalesce(current_setting('vora.substituto', true), '') <> '1' then -- substituto tem aviso próprio
        perform public.notificar(v.empresa_id, 'convite_aceito', primeiro_nome(f) || ' aceitou seu convite', v.titulo, '/vaga/' || v.id);
      end if;
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

-- Aceite de substituição: aviso próprio para o estabelecimento
create or replace function public.responder_convite(p_convite uuid, p_aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare cv public.convites; vg record;
begin
  select * into cv from public.convites where id = p_convite and freelancer_id = auth.uid() for update;
  if not found then raise exception 'Convite não encontrado' using errcode = 'P0001'; end if;
  if cv.status <> 'pendente' then raise exception 'Esse convite já foi respondido' using errcode = 'P0001'; end if;

  if p_aceitar then
    select ativa, completa, contratados, quantidade, titulo into vg from public.vagas where id = cv.vaga_id for update;
    if vg.completa or vg.contratados >= vg.quantidade then
      update public.convites set status = 'recusado', respondido_em = now() where id = p_convite;
      raise exception 'Alguém já pegou essa vaga. Fica para a próxima!' using errcode = 'P0001';
    end if;
    if not vg.ativa then raise exception 'Essa vaga foi encerrada' using errcode = 'P0001'; end if;
    perform set_config('vora.convite', '1', true);
    perform set_config('vora.substituto', case when cv.substituicao then '1' else '' end, true);
    insert into public.candidaturas (vaga_id, freelancer_id, mensagem, status)
    values (cv.vaga_id, cv.freelancer_id, case when cv.substituicao then 'Entrou como substituto(a).' else 'Aceitou o convite do estabelecimento.' end, 'contratado')
    on conflict (vaga_id, freelancer_id) do update set status = 'contratado'
      where public.candidaturas.status in ('pendente', 'recusado');
    perform set_config('vora.convite', '', true);
    perform set_config('vora.substituto', '', true);
    if cv.substituicao then
      perform public.notificar(cv.empresa_id, 'convite_aceito',
        (select primeiro_nome(nome) from public.perfis where id = cv.freelancer_id) || ' vai substituir ✓', vg.titulo, '/vaga/' || cv.vaga_id);
    end if;
  end if;

  update public.convites set status = case when p_aceitar then 'aceito' else 'recusado' end, respondido_em = now()
   where id = p_convite;
end $$;
revoke execute on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;
