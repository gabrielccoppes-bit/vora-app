-- Vora: escalas (turnos que se repetem), instruções do turno e proteção dos campos mantidos pelo banco.

/* ============ Campos mantidos pelo banco não vêm do app ============ */
create or replace function public.limpar_vaga_nova()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.contratados := 0;
  new.completa := false;
  new.lembrete_2h_em := null;
  return new;
end $$;
create trigger limpar_vaga_nova before insert on public.vagas
  for each row execute function public.limpar_vaga_nova();

/* ============ O que levar no turno (só contratados veem) ============ */
create table public.vaga_instrucoes (
  vaga_id   uuid primary key references public.vagas (id) on delete cascade,
  traje     text check (traje is null or length(traje) <= 200),
  levar     text check (levar is null or length(levar) <= 300),
  chegada   text check (chegada is null or length(chegada) <= 300),   -- onde entrar, com quem falar
  contato   text check (contato is null or length(contato) <= 120),   -- nome/telefone no local
  atualizado_em timestamptz not null default now()
);
alter table public.vaga_instrucoes enable row level security;
grant select, insert, update, delete on public.vaga_instrucoes to authenticated;
create policy "dono gerencia instrucoes" on public.vaga_instrucoes for all to authenticated
  using (exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid()))
  with check (exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid()));
create policy "contratado ve instrucoes" on public.vaga_instrucoes for select to authenticated
  using (exists (select 1 from public.candidaturas c where c.vaga_id = vaga_instrucoes.vaga_id and c.freelancer_id = auth.uid() and c.status = 'contratado'));

/* ============ Escala: vários turnos ligados entre si ============ */
alter table public.vagas add column serie_id uuid;
create index vagas_serie_idx on public.vagas (serie_id) where serie_id is not null;
grant update (serie_id) on public.vagas to authenticated;

-- "Repetir na próxima semana": copia a vaga 7 dias depois e convida quem trabalhou nela
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
                            descricao, requisitos, urgente, inicio_em, quantidade, substituto_auto, serie_id)
  values (v.empresa_id, v.titulo, v.area, v.modalidade, v.contrato, v.nivel, v.valor_min, v.valor_max, v.periodo, v.duracao,
          v.descricao, v.requisitos, false,
          case when v.inicio_em is null then null
               -- próxima semana que ainda não passou
               else v.inicio_em + interval '7 days' * greatest(1, floor(extract(epoch from (now() - v.inicio_em)) / 604800.0)::int + 1) end,
          v.quantidade, v.substituto_auto, serie)
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

-- Lembrete de 2h já leva o traje, quando houver
create or replace function public.enviar_lembretes()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; total integer := 0; hora text; dia text;
begin
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

  for r in
    select c.id, c.freelancer_id, vg.id as vaga_id, vg.titulo, vg.inicio_em, e.nome as empresa, i.traje
      from public.candidaturas c join public.vagas vg on vg.id = c.vaga_id join public.perfis e on e.id = vg.empresa_id
      left join public.vaga_instrucoes i on i.vaga_id = vg.id
     where c.status = 'contratado' and c.lembrete_2h_em is null and c.checkin_em is null
       and vg.inicio_em between now() and now() + interval '2 hours'
     for update of c skip locked
  loop
    perform public.notificar(r.freelancer_id, 'lembrete', 'Seu turno começa às ' || to_char(r.inicio_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
      r.empresa || coalesce(' · Traje: ' || nullif(r.traje, ''), '') || ' · faça o check-in quando chegar', '/vaga/' || r.vaga_id);
    update public.candidaturas set lembrete_2h_em = now(), lembrete_vespera_em = coalesce(lembrete_vespera_em, now()) where id = r.id;
    total := total + 1;
  end loop;

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
