-- =====================================================================
--  Localização
--  * Contratantes: ponto APROXIMADO do estabelecimento (3 casas decimais
--    ≈ 100 m), público para usuários logados — serve para calcular distância.
--  * Freelancers: a localização fica só no aparelho. Ela é enviada apenas
--    como parâmetro da busca (vagas_proximas) e NUNCA é gravada.
-- =====================================================================

alter table public.perfis add column lat double precision check (lat between -90 and 90);
alter table public.perfis add column lng double precision check (lng between -180 and 180);
create index perfis_geo_idx on public.perfis (lat, lng) where lat is not null;

-- Contratante pode atualizar o ponto do próprio estabelecimento
grant update (lat, lng) on public.perfis to authenticated;

-- Cadastro: grava o ponto aproximado que o app enviou (só para contratantes)
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  t public.tipo_conta := (m->>'tipo')::public.tipo_conta;
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

  insert into public.perfis (id, tipo, nome, titulo, area, cidade, uf, lat, lng)
  values (new.id, t, m->>'nome', m->>'titulo', m->>'area', m->>'cidade', upper(m->>'uf'),
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
revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

-- Vagas ativas num raio (km) a partir de um ponto. O ponto do freelancer
-- é só parâmetro: nada é gravado.
create or replace function public.vagas_proximas(p_lat float8, p_lng float8, p_raio_km float8 default 25, p_limite int default 50)
returns table (vaga_id uuid, distancia_km float8)
language sql stable security invoker set search_path = public as $$
  select v.id, d.km
    from public.vagas v
    join public.perfis p on p.id = v.empresa_id
    cross join lateral (
      select 6371 * 2 * asin(sqrt(
               power(sin(radians(p.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2)
             )) as km
    ) d
   where v.ativa and p.lat is not null and d.km <= least(p_raio_km, 200)
   order by d.km
   limit least(p_limite, 100);
$$;
revoke execute on function public.vagas_proximas(float8, float8, float8, int) from public, anon;
grant execute on function public.vagas_proximas(float8, float8, float8, int) to authenticated;
