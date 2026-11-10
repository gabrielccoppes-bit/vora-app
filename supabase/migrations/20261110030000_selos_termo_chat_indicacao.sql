-- Vora: selos de destaque, termo de prestação de serviço, chat com foto/localização e indicações.

/* ============ Selos de destaque (freelancer) ============ */
alter table public.perfis add column selos text[] not null default '{}';

create or replace function public.recalcular_selos(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record; concluidos int; com_horario int; pontuais int; s text[] := '{}';
begin
  select tipo, nota_media, nota_total, faltas, cancelamentos into p from public.perfis where id = p_id;
  if p.tipo is distinct from 'freelancer' then return; end if;

  select count(*) filter (where c.checkin_em is not null or (v.inicio_em is not null and v.inicio_em < now())),
         count(*) filter (where c.checkin_em is not null and v.inicio_em is not null),
         count(*) filter (where c.checkin_em is not null and v.inicio_em is not null and c.checkin_em <= v.inicio_em + interval '5 minutes')
    into concluidos, com_horario, pontuais
    from public.candidaturas c join public.vagas v on v.id = c.vaga_id
   where c.freelancer_id = p_id and c.status = 'contratado';

  if p.nota_total >= 3 and p.nota_media >= 4.8 then s := s || 'top'; end if;
  if concluidos >= 5 and p.faltas = 0 and p.cancelamentos = 0 then s := s || 'presenca'; end if;
  if com_horario >= 5 and pontuais >= ceil(com_horario * 0.9) then s := s || 'pontual'; end if;
  if concluidos >= 20 then s := s || 'veterano'; end if;

  update public.perfis set selos = s where id = p_id and selos is distinct from s;
end $$;
revoke execute on function public.recalcular_selos(uuid) from public, anon, authenticated;

create or replace function public.selos_por_candidatura()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_selos(coalesce(new.freelancer_id, old.freelancer_id));
  return null;
end $$;
revoke execute on function public.selos_por_candidatura() from public, anon, authenticated;
create trigger selos_por_candidatura after update of status, checkin_em on public.candidaturas
  for each row execute function public.selos_por_candidatura();

create or replace function public.selos_por_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_selos(new.id);
  return null;
end $$;
revoke execute on function public.selos_por_perfil() from public, anon, authenticated;
create trigger selos_por_perfil after update of nota_media, nota_total, faltas, cancelamentos on public.perfis
  for each row execute function public.selos_por_perfil();

-- turnos que "viram concluídos" com o passar do tempo: recalcula toda madrugada
select cron.schedule('vora-selos', '17 4 * * *', $$select public.recalcular_selos(id) from public.perfis where tipo = 'freelancer'$$);
select public.recalcular_selos(id) from public.perfis where tipo = 'freelancer';

/* ============ Termo de prestação de serviço ============ */
create table public.termos_servico (
  id               uuid primary key default gen_random_uuid(),
  candidatura_id   uuid not null unique references public.candidaturas (id) on delete cascade,
  vaga_id          uuid not null references public.vagas (id) on delete cascade,
  empresa_id       uuid not null references public.perfis (id) on delete cascade,
  freelancer_id    uuid not null references public.perfis (id) on delete cascade,
  conteudo         jsonb not null,           -- retrato dos dados no momento da contratação
  aceite_empresa_em timestamptz not null default now(), -- contratar = aceitar
  aceite_freela_em timestamptz,
  criado_em        timestamptz not null default now()
);
alter table public.termos_servico enable row level security;
grant select on public.termos_servico to authenticated;
create policy "partes veem o termo" on public.termos_servico for select to authenticated
  using (auth.uid() in (empresa_id, freelancer_id));

create or replace function public.gerar_termo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record; e record; ed record; f record; fd record; cpf_parcial text;
begin
  if new.status <> 'contratado' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'contratado' then return null; end if;
  if exists (select 1 from public.termos_servico where candidatura_id = new.id) then return null; end if;

  select * into v from public.vagas where id = new.vaga_id;
  select p.nome, p.cidade, p.uf into e from public.perfis p where p.id = v.empresa_id;
  select d.razao_social, d.cnpj, d.responsavel_nome, d.responsavel_cargo, d.logradouro, d.numero, d.bairro into ed from public.dados_privados d where d.id = v.empresa_id;
  select p.nome, p.cidade, p.uf into f from public.perfis p where p.id = new.freelancer_id;
  select d.cpf, d.cnpj_mei into fd from public.dados_privados d where d.id = new.freelancer_id;
  -- CPF aparece parcialmente (proteção de dados)
  cpf_parcial := case when fd.cpf is not null then '***.' || substr(fd.cpf, 4, 3) || '.' || substr(fd.cpf, 7, 3) || '-**' end;

  insert into public.termos_servico (candidatura_id, vaga_id, empresa_id, freelancer_id, conteudo)
  values (new.id, v.id, v.empresa_id, new.freelancer_id, jsonb_build_object(
    'versao', '1.0',
    'contratante', jsonb_build_object('nome', e.nome, 'razao_social', ed.razao_social, 'cnpj', ed.cnpj,
                                      'responsavel', ed.responsavel_nome, 'cargo', ed.responsavel_cargo,
                                      'endereco', concat_ws(', ', ed.logradouro, ed.numero, ed.bairro), 'cidade', e.cidade, 'uf', e.uf),
    'prestador', jsonb_build_object('nome', f.nome, 'cpf', cpf_parcial, 'cnpj_mei', fd.cnpj_mei, 'cidade', f.cidade, 'uf', f.uf),
    'servico', jsonb_build_object('titulo', v.titulo, 'area', v.area, 'descricao', v.descricao, 'inicio_em', v.inicio_em,
                                  'duracao', v.duracao, 'valor_min', v.valor_min, 'valor_max', v.valor_max, 'periodo', v.periodo)
  ));
  return null;
end $$;
revoke execute on function public.gerar_termo() from public, anon, authenticated;
create trigger gerar_termo after insert or update of status on public.candidaturas
  for each row execute function public.gerar_termo();

create or replace function public.aceitar_termo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.termos_servico set aceite_freela_em = now()
   where id = p_id and freelancer_id = auth.uid() and aceite_freela_em is null;
  if not found then raise exception 'Termo não encontrado ou já aceito' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.aceitar_termo(uuid) from public, anon;
grant execute on function public.aceitar_termo(uuid) to authenticated;

/* ============ Chat com foto e localização ============ */
alter table public.mensagens add column tipo text not null default 'texto' check (tipo in ('texto', 'foto', 'local'));
alter table public.mensagens add column anexo text check (anexo is null or length(anexo) <= 200);
alter table public.mensagens add column lat double precision check (lat is null or lat between -90 and 90);
alter table public.mensagens add column lng double precision check (lng is null or lng between -180 and 180);

-- a foto precisa estar na pasta da própria conversa
create or replace function public.validar_mensagem()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tipo = 'foto' and (new.anexo is null or new.anexo not like new.conversa_id::text || '/%') then
    raise exception 'Anexo inválido' using errcode = 'P0001';
  end if;
  if new.tipo = 'local' and (new.lat is null or new.lng is null) then
    raise exception 'Localização inválida' using errcode = 'P0001';
  end if;
  if new.tipo = 'texto' then new.anexo := null; new.lat := null; new.lng := null; end if;
  return new;
end $$;
create trigger validar_mensagem before insert on public.mensagens
  for each row execute function public.validar_mensagem();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 8388608, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.participa_da_conversa(p_conversa text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversas c where c.id::text = p_conversa and auth.uid() in (c.a, c.b));
$$;
revoke execute on function public.participa_da_conversa(text) from public, anon;
grant execute on function public.participa_da_conversa(text) to authenticated;

create policy "chat: enviar foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (select public.participa_da_conversa((storage.foldername(name))[1])));
create policy "chat: ver foto" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (select public.participa_da_conversa((storage.foldername(name))[1])));

/* ============ Indique e ganhe ============ */
alter table public.perfis add column codigo text unique check (codigo ~ '^[A-Z0-9]{6}$');

create or replace function public.gerar_codigo()
returns trigger language plpgsql set search_path = '' as $$
declare tentativa text; i int := 0;
begin
  if new.codigo is not null then return new; end if;
  loop
    tentativa := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', 'ABCDEFGH'), 1, 6));
    exit when not exists (select 1 from public.perfis where codigo = tentativa) or i > 10;
    i := i + 1;
  end loop;
  new.codigo := tentativa;
  return new;
end $$;
create trigger gerar_codigo before insert on public.perfis for each row execute function public.gerar_codigo();
update public.perfis set codigo = upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', 'ABCDEFGH'), 1, 6)) where codigo is null;

create table public.indicacoes (
  indicado_id       uuid primary key references public.perfis (id) on delete cascade,
  indicador_id      uuid not null references public.perfis (id) on delete cascade,
  criado_em         timestamptz not null default now(),
  primeiro_turno_em timestamptz,
  check (indicado_id <> indicador_id)
);
create index indicacoes_indicador_idx on public.indicacoes (indicador_id);
alter table public.indicacoes enable row level security;
grant select on public.indicacoes to authenticated;
create policy "minhas indicacoes" on public.indicacoes for select to authenticated using (indicador_id = auth.uid() or indicado_id = auth.uid());

create or replace function public.registrar_indicacao(p_indicado uuid, p_codigo text)
returns void language plpgsql security definer set search_path = public as $$
declare quem uuid; nome_indicado text;
begin
  if coalesce(p_codigo, '') = '' then return; end if;
  select id into quem from public.perfis where codigo = upper(trim(p_codigo));
  if quem is null or quem = p_indicado then return; end if;
  insert into public.indicacoes (indicado_id, indicador_id) values (p_indicado, quem) on conflict do nothing;
  select primeiro_nome(nome) into nome_indicado from public.perfis where id = p_indicado;
  perform public.notificar(quem, 'indicacao', nome_indicado || ' entrou no Vora pelo seu convite 🎉', 'Obrigado por indicar!', '/indicar');
end $$;
revoke execute on function public.registrar_indicacao(uuid, text) from public, anon, authenticated;

-- cadastro: lê o código de quem indicou (?ref=)
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  t public.tipo_conta := (m->>'tipo')::public.tipo_conta;
  lista text[] := case when jsonb_typeof(m->'areas') = 'array'
                       then array(select jsonb_array_elements_text(m->'areas') limit 12) else '{}' end;
begin
  if t is null then
    raise exception 'Tipo de conta não informado';
  end if;
  if coalesce(m->>'termos_versao','') = '' then
    raise exception 'É preciso aceitar os termos de uso';
  end if;
  if t = 'freelancer' then
    if (m->>'nascimento')::date > current_date - interval '18 years' then
      raise exception 'É preciso ter 18 anos ou mais';
    end if;
  elsif coalesce(m->>'cnpj','') = '' or coalesce(m->>'responsavel_cpf','') = '' then
    raise exception 'CNPJ e CPF do responsável são obrigatórios';
  end if;

  insert into public.perfis (id, tipo, nome, titulo, area, areas, cidade, uf, lat, lng)
  values (new.id, t, m->>'nome', m->>'titulo', coalesce(lista[1], m->>'area'),
          case when t = 'freelancer' then lista else '{}' end,
          m->>'cidade', upper(m->>'uf'),
          case when t = 'empresa' and nullif(m->>'lat','') is not null then round((m->>'lat')::numeric, 3)::float8 end,
          case when t = 'empresa' and nullif(m->>'lng','') is not null then round((m->>'lng')::numeric, 3)::float8 end);

  insert into public.dados_privados (
    id, cpf, nascimento, cnpj_mei, cnpj, razao_social,
    responsavel_nome, responsavel_cpf, responsavel_cargo,
    telefone, cep, logradouro, numero, complemento, bairro, termos_versao)
  values (
    new.id,
    case when t = 'freelancer' then m->>'cpf' end,
    case when t = 'freelancer' then (m->>'nascimento')::date end,
    case when t = 'freelancer' then nullif(m->>'cnpj_mei','') end,
    case when t = 'empresa' then m->>'cnpj' end,
    case when t = 'empresa' then m->>'razao_social' end,
    m->>'responsavel_nome', nullif(m->>'responsavel_cpf',''), m->>'responsavel_cargo',
    m->>'telefone', m->>'cep', m->>'logradouro', m->>'numero', nullif(m->>'complemento',''), m->>'bairro',
    m->>'termos_versao');

  perform public.registrar_indicacao(new.id, m->>'ref');

  update auth.users
     set raw_user_meta_data = jsonb_build_object('tipo', m->>'tipo', 'nome', m->>'nome')
   where id = new.id;

  return new;
end $$;

-- Primeiro turno concluído de quem foi indicado (como freelancer ou estabelecimento)
create or replace function public.indicacao_primeiro_turno()
returns trigger language plpgsql security definer set search_path = public as $$
declare emp uuid; r record;
begin
  if new.checkout_em is null or old.checkout_em is not null then return null; end if;
  select empresa_id into emp from public.vagas where id = new.vaga_id;
  for r in
    update public.indicacoes set primeiro_turno_em = now()
     where indicado_id in (new.freelancer_id, emp) and primeiro_turno_em is null
    returning indicador_id, indicado_id
  loop
    perform public.notificar(r.indicador_id, 'indicacao',
      (select primeiro_nome(nome) from public.perfis where id = r.indicado_id) || ' completou o primeiro turno ✓',
      'Sua indicação deu certo. Obrigado por fazer o Vora crescer!', '/indicar');
  end loop;
  return null;
end $$;
revoke execute on function public.indicacao_primeiro_turno() from public, anon, authenticated;
create trigger indicacao_primeiro_turno after update of checkout_em on public.candidaturas
  for each row execute function public.indicacao_primeiro_turno();

-- Quem indicou vê só o primeiro nome e o tipo de conta dos indicados
create or replace function public.minhas_indicacoes()
returns table (nome text, tipo public.tipo_conta, criado_em timestamptz, primeiro_turno_em timestamptz)
language sql stable security definer set search_path = public as $$
  select primeiro_nome(p.nome), p.tipo, i.criado_em, i.primeiro_turno_em
    from public.indicacoes i join public.perfis p on p.id = i.indicado_id
   where i.indicador_id = auth.uid()
   order by i.criado_em desc;
$$;
revoke execute on function public.minhas_indicacoes() from public, anon;
grant execute on function public.minhas_indicacoes() to authenticated;

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
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
revoke execute on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
