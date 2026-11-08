-- Vaga urgente: para hoje/amanhã, com horário de início do turno
alter table public.vagas add column urgente boolean not null default false;
alter table public.vagas add column inicio_em timestamptz;
alter table public.vagas add constraint vagas_urgente_inicio_check check (not urgente or inicio_em is not null);
create index vagas_urgentes_idx on public.vagas (urgente, inicio_em) where urgente and ativa;

-- avisos em tempo real para quem está com o app aberto (respeita o RLS)
alter publication supabase_realtime add table public.vagas;
