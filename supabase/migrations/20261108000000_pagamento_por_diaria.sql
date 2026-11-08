-- Bares, restaurantes e casas noturnas contratam por diária/turno
alter table public.vagas drop constraint if exists vagas_periodo_check;
alter table public.vagas add constraint vagas_periodo_check check (periodo in ('mes','projeto','hora','diaria'));
