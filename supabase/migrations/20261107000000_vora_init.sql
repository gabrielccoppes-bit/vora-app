-- =====================================================================
--  VORA — estrutura inicial do banco (Supabase / Postgres)
--  Execute no SQL Editor do Supabase ou com `supabase db push`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Validação de documentos (também feita no app, mas o banco é a
--    última barreira: nada inválido entra, mesmo via API direta)
-- ---------------------------------------------------------------------
create or replace function public.cpf_valido(c text)
returns boolean language plpgsql immutable as $$
declare s int; d int; i int;
begin
  if c is null or c !~ '^[0-9]{11}$' or c = repeat(substr(c,1,1), 11) then
    return false;
  end if;
  s := 0;
  for i in 1..9 loop s := s + substr(c,i,1)::int * (11 - i); end loop;
  d := (s * 10) % 11; if d = 10 then d := 0; end if;
  if d <> substr(c,10,1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(c,i,1)::int * (12 - i); end loop;
  d := (s * 10) % 11; if d = 10 then d := 0; end if;
  return d = substr(c,11,1)::int;
end $$;

-- Aceita o CNPJ numérico e o novo CNPJ alfanumérico (letras nas 12 primeiras posições)
create or replace function public.cnpj_valido(c text)
returns boolean language plpgsql immutable as $$
declare
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; d1 int; d2 int; i int;
begin
  if c is null or c !~ '^[A-Z0-9]{12}[0-9]{2}$' or c = repeat(substr(c,1,1), 14) then
    return false;
  end if;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(c,i,1)) - 48) * w1[i]; end loop;
  r := s % 11; d1 := case when r < 2 then 0 else 11 - r end;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(c,i,1)) - 48) * w2[i]; end loop;
  s := s + d1 * w2[13];
  r := s % 11; d2 := case when r < 2 then 0 else 11 - r end;
  return d1 = substr(c,13,1)::int and d2 = substr(c,14,1)::int;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------
create type public.tipo_conta as enum ('freelancer', 'empresa');

-- Perfil PÚBLICO: o que outros usuários podem ver (nunca documento nem endereço)
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  tipo        public.tipo_conta not null,
  nome        text not null check (length(nome) between 2 and 120),  -- pessoa ou nome fantasia
  titulo      text,          -- título profissional (freelancer) ou setor (empresa)
  area        text,          -- categoria principal
  cidade      text not null,
  uf          char(2) not null,
  verificado  boolean not null default false,  -- só o backend altera (ver seção 4)
  criado_em   timestamptz not null default now()
);

-- Dados PRIVADOS: só o próprio titular lê. Separados em outra tabela de propósito,
-- assim nenhuma consulta pública consegue "vazar" CPF/CNPJ/endereço por engano.
create table public.dados_privados (
  id                 uuid primary key references public.perfis (id) on delete cascade,
  cpf                char(11) unique check (cpf is null or public.cpf_valido(cpf)),      -- freelancer
  nascimento         date,
  cnpj_mei           char(14) check (cnpj_mei is null or public.cnpj_valido(cnpj_mei)),   -- freelancer MEI
  cnpj               char(14) unique check (cnpj is null or public.cnpj_valido(cnpj)),    -- empresa
  razao_social       text,
  responsavel_nome   text,
  responsavel_cpf    char(11) check (responsavel_cpf is null or public.cpf_valido(responsavel_cpf)),
  responsavel_cargo  text,
  telefone           text not null check (telefone ~ '^[0-9]{10,11}$'),
  cep                char(8) not null check (cep ~ '^[0-9]{8}$'),
  logradouro         text not null,
  numero             text not null,
  complemento        text,
  bairro             text not null,
  termos_versao      text not null,
  termos_aceitos_em  timestamptz not null default now()
);

create table public.servicos (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null unique references public.perfis (id) on delete cascade,
  titulo        text not null,
  area          text not null,
  valor_hora    integer not null check (valor_hora > 0),
  habilidades   text[] not null default '{}',
  bio           text not null default '',
  criado_em     timestamptz not null default now()
);

create table public.vagas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.perfis (id) on delete cascade,
  titulo      text not null check (length(titulo) >= 4),
  area        text not null,
  modalidade  text not null check (modalidade in ('Remoto','Híbrido','Presencial')),
  contrato    text not null check (contrato in ('PJ','Freelance','CLT')),
  nivel       text not null default 'Pleno',
  valor_min   integer not null check (valor_min > 0),
  valor_max   integer check (valor_max is null or valor_max >= valor_min),
  periodo     text not null default 'mes' check (periodo in ('mes','projeto','hora')),
  duracao     text not null,
  descricao   text not null check (length(descricao) >= 30),
  requisitos  text[] not null default '{}',
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index vagas_ativas_idx on public.vagas (ativa, criado_em desc);

create table public.candidaturas (
  id            uuid primary key default gen_random_uuid(),
  vaga_id       uuid not null references public.vagas (id) on delete cascade,
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  mensagem      text,
  criado_em     timestamptz not null default now(),
  unique (vaga_id, freelancer_id)
);

create table public.salvos (
  freelancer_id uuid not null references public.perfis (id) on delete cascade,
  vaga_id       uuid not null references public.vagas (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (freelancer_id, vaga_id)
);

create table public.conversas (
  id        uuid primary key default gen_random_uuid(),
  a         uuid not null references public.perfis (id) on delete cascade,
  b         uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  check (a <> b)
);
create unique index conversas_par_idx on public.conversas (least(a,b), greatest(a,b));

create table public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  autor_id    uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  texto       text not null check (length(texto) between 1 and 2000),
  criado_em   timestamptz not null default now()
);
create index mensagens_conversa_idx on public.mensagens (conversa_id, criado_em);

-- ---------------------------------------------------------------------
-- 3. Criação do perfil no cadastro
--    O app chama supabase.auth.signUp({ email, password, options: { data } })
--    e este gatilho grava perfil + dados privados a partir de `data`.
-- ---------------------------------------------------------------------
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

  insert into public.perfis (id, tipo, nome, titulo, area, cidade, uf)
  values (new.id, t, m->>'nome', m->>'titulo', m->>'area', m->>'cidade', upper(m->>'uf'));

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

  -- Os documentos já foram copiados para dados_privados (protegidos por RLS);
  -- removemos do metadata do Auth para não ficarem duplicados no token de sessão.
  update auth.users
     set raw_user_meta_data = jsonb_build_object('tipo', m->>'tipo', 'nome', m->>'nome')
   where id = new.id;

  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Checagem antes do cadastro (CPF/CNPJ já usados). Retorna só true/false.
create or replace function public.documento_disponivel(p_cpf text default null, p_cnpj text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.dados_privados
     where (p_cpf  is not null and cpf  = p_cpf)
        or (p_cnpj is not null and cnpj = p_cnpj)
  );
$$;
grant execute on function public.documento_disponivel(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Segurança por linha (RLS) — quem pode ver/alterar o quê
-- ---------------------------------------------------------------------
create or replace function public.eh_empresa()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select tipo = 'empresa' from public.perfis where id = auth.uid()), false);
$$;

-- Permissões base: só usuários logados acessam tabelas (sempre filtrados pelo RLS abaixo);
-- visitantes anônimos não leem nenhuma tabela diretamente.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

alter table public.perfis          enable row level security;
alter table public.dados_privados  enable row level security;
alter table public.servicos        enable row level security;
alter table public.vagas           enable row level security;
alter table public.candidaturas    enable row level security;
alter table public.salvos          enable row level security;
alter table public.conversas       enable row level security;
alter table public.mensagens       enable row level security;

-- perfis: qualquer usuário logado vê; cada um edita o próprio (exceto tipo e verificado)
create policy "perfis visiveis para logados" on public.perfis for select to authenticated using (true);
create policy "editar proprio perfil" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.perfis from authenticated;
grant update (nome, titulo, area, cidade, uf) on public.perfis to authenticated;

-- dados privados: SÓ o titular. Documentos não podem ser trocados pelo app.
create policy "ler meus dados" on public.dados_privados for select to authenticated using (id = auth.uid());
create policy "editar meus dados" on public.dados_privados for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.dados_privados from authenticated;
grant update (telefone, cep, logradouro, numero, complemento, bairro, responsavel_nome, responsavel_cargo)
  on public.dados_privados to authenticated;

-- serviços (perfil profissional do freelancer)
create policy "servicos visiveis" on public.servicos for select to authenticated using (true);
create policy "freelancer cria servico" on public.servicos for insert to authenticated
  with check (freelancer_id = auth.uid() and not public.eh_empresa());
create policy "freelancer edita servico" on public.servicos for update to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());
create policy "freelancer apaga servico" on public.servicos for delete to authenticated
  using (freelancer_id = auth.uid());

-- vagas
create policy "vagas ativas visiveis" on public.vagas for select to authenticated
  using (ativa or empresa_id = auth.uid());
create policy "empresa publica vaga" on public.vagas for insert to authenticated
  with check (empresa_id = auth.uid() and public.eh_empresa());
create policy "empresa edita vaga" on public.vagas for update to authenticated
  using (empresa_id = auth.uid()) with check (empresa_id = auth.uid());
create policy "empresa apaga vaga" on public.vagas for delete to authenticated
  using (empresa_id = auth.uid());

-- candidaturas: o freelancer vê as dele; a empresa vê as das vagas dela
create policy "ver candidaturas" on public.candidaturas for select to authenticated
  using (freelancer_id = auth.uid()
         or exists (select 1 from public.vagas v where v.id = vaga_id and v.empresa_id = auth.uid()));
create policy "freelancer se candidata" on public.candidaturas for insert to authenticated
  with check (freelancer_id = auth.uid() and not public.eh_empresa()
              and exists (select 1 from public.vagas v where v.id = vaga_id and v.ativa));
create policy "freelancer retira candidatura" on public.candidaturas for delete to authenticated
  using (freelancer_id = auth.uid());

-- total público de candidaturas (sem revelar quem)
create or replace function public.total_candidaturas(p_vaga uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.candidaturas where vaga_id = p_vaga;
$$;
grant execute on function public.total_candidaturas(uuid) to authenticated;

-- vagas salvas
create policy "meus salvos" on public.salvos for all to authenticated
  using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());

-- conversas e mensagens: só os dois participantes
create policy "minhas conversas" on public.conversas for select to authenticated
  using (auth.uid() in (a, b));
create policy "abrir conversa" on public.conversas for insert to authenticated
  with check (auth.uid() in (a, b));
create policy "ler mensagens" on public.mensagens for select to authenticated
  using (exists (select 1 from public.conversas c where c.id = conversa_id and auth.uid() in (c.a, c.b)));
create policy "enviar mensagem" on public.mensagens for insert to authenticated
  with check (autor_id = auth.uid()
              and exists (select 1 from public.conversas c where c.id = conversa_id and auth.uid() in (c.a, c.b)));

-- ---------------------------------------------------------------------
-- 5. Funções usadas pelo app
-- ---------------------------------------------------------------------
create or replace function public.abrir_conversa(p_outro uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare cid uuid; eu uuid := auth.uid();
begin
  select id into cid from public.conversas
   where least(a,b) = least(eu, p_outro) and greatest(a,b) = greatest(eu, p_outro);
  if cid is null then
    insert into public.conversas (a, b) values (eu, p_outro) returning id into cid;
  end if;
  return cid;
end $$;

create or replace function public.minhas_conversas()
returns table (id uuid, outro_id uuid, outro_nome text, outro_tipo public.tipo_conta,
               ultima_texto text, ultima_autor uuid, ultima_em timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, p.id, p.nome, p.tipo, m.texto, m.autor_id, coalesce(m.criado_em, c.criado_em)
    from public.conversas c
    join public.perfis p on p.id = case when c.a = auth.uid() then c.b else c.a end
    left join lateral (
      select texto, autor_id, criado_em from public.mensagens
       where conversa_id = c.id order by criado_em desc limit 1
    ) m on true
   where auth.uid() in (c.a, c.b)
   order by coalesce(m.criado_em, c.criado_em) desc;
$$;

-- LGPD art. 18 — portabilidade: tudo o que guardamos sobre o titular
create or replace function public.exportar_meus_dados()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'exportado_em',    now(),
    'email',           (select email from auth.users where id = auth.uid()),
    'perfil',          (select to_jsonb(p) from public.perfis p where p.id = auth.uid()),
    'dados_privados',  (select to_jsonb(d) from public.dados_privados d where d.id = auth.uid()),
    'servico',         (select to_jsonb(s) from public.servicos s where s.freelancer_id = auth.uid()),
    'vagas',           (select coalesce(jsonb_agg(v), '[]') from public.vagas v where v.empresa_id = auth.uid()),
    'candidaturas',    (select coalesce(jsonb_agg(c), '[]') from public.candidaturas c where c.freelancer_id = auth.uid()),
    'vagas_salvas',    (select coalesce(jsonb_agg(s), '[]') from public.salvos s where s.freelancer_id = auth.uid()),
    'mensagens_enviadas', (select coalesce(jsonb_agg(m), '[]') from public.mensagens m where m.autor_id = auth.uid())
  );
$$;
-- (auth.users não é legível por padrão; a função lê só o e-mail do próprio titular)
alter function public.exportar_meus_dados() security definer;

-- ---------------------------------------------------------------------
-- 6. Chat em tempo real
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.mensagens;
