-- Freelancer pode atuar em várias áreas (ex.: Bar + Atendimento + Eventos).
-- "area" continua existindo como a área principal (a primeira escolhida), para compatibilidade.

alter table public.perfis add column areas text[] not null default '{}'
  check (cardinality(areas) <= 12);
alter table public.servicos add column areas text[] not null default '{}'
  check (cardinality(areas) <= 12);

update public.perfis set areas = array[area] where tipo = 'freelancer' and area is not null and areas = '{}';
update public.servicos set areas = array[area] where area is not null and areas = '{}';

create index servicos_areas_idx on public.servicos using gin (areas);
create index perfis_areas_idx on public.perfis using gin (areas);

grant update (areas) on public.perfis to authenticated;

-- Mantém "area" igual à primeira das "areas"
create or replace function public.sincronizar_area()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- versão antiga do app mudou só "area": vira a principal da lista
  if tg_op = 'UPDATE' and new.areas is not distinct from old.areas and new.area is distinct from old.area and new.area is not null then
    new.areas := array[new.area] || array_remove(old.areas, new.area);
  end if;
  if new.areas is not null and cardinality(new.areas) > 0 then
    new.area := new.areas[1];
  elsif new.area is not null then
    new.areas := array[new.area];
  end if;
  return new;
end $$;
create trigger sincronizar_area_perfis before insert or update of area, areas on public.perfis
  for each row when (new.tipo = 'freelancer') execute function public.sincronizar_area();
create trigger sincronizar_area_servicos before insert or update of area, areas on public.servicos
  for each row execute function public.sincronizar_area();

-- Cadastro: aceita a lista de áreas enviada pelo app
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

  update auth.users
     set raw_user_meta_data = jsonb_build_object('tipo', m->>'tipo', 'nome', m->>'nome')
   where id = new.id;

  return new;
end $$;

-- Vaga urgente: avisa só quem atua na área da vaga (ou quem ainda não escolheu áreas)
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
     and (cardinality(p.areas) = 0 or new.area = any(p.areas))
     and not exists (select 1 from public.bloqueios b where (b.autor_id = p.id and b.alvo_id = new.empresa_id) or (b.autor_id = new.empresa_id and b.alvo_id = p.id))
   limit 500;
  return null;
end $$;
revoke execute on function public.avisar_vaga_urgente() from public, anon, authenticated;
