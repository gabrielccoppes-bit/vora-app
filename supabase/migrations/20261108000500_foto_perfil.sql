-- Foto de perfil (freelancer) / logo (estabelecimento)
-- Guardamos só a "versão" da foto; o endereço é sempre
-- <storage>/avatares/<id do usuário>/foto.jpg?v=<versão>
-- Assim ninguém consegue apontar a foto para um site externo.
alter table public.perfis add column if not exists foto_v bigint;
grant update (foto_v) on public.perfis to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cada pessoa só mexe na própria pasta (avatares/<seu id>/...)
drop policy if exists "avatar: ver o proprio" on storage.objects;
create policy "avatar: ver o proprio" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: enviar o proprio" on storage.objects;
create policy "avatar: enviar o proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: trocar o proprio" on storage.objects;
create policy "avatar: trocar o proprio" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: apagar o proprio" on storage.objects;
create policy "avatar: apagar o proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Lista de conversas passa a trazer a foto do outro participante
drop function if exists public.minhas_conversas();
create function public.minhas_conversas()
 returns table(id uuid, outro_id uuid, outro_nome text, outro_tipo tipo_conta, outro_foto_v bigint, ultima_texto text, ultima_autor uuid, ultima_em timestamptz)
 language sql stable set search_path to 'public'
as $$
  select c.id, p.id, p.nome, p.tipo, p.foto_v, m.texto, m.autor_id, coalesce(m.criado_em, c.criado_em)
    from public.conversas c
    join public.perfis p on p.id = case when c.a = auth.uid() then c.b else c.a end
    left join lateral (
      select texto, autor_id, criado_em from public.mensagens
       where conversa_id = c.id order by criado_em desc limit 1
    ) m on true
   where auth.uid() in (c.a, c.b)
   order by coalesce(m.criado_em, c.criado_em) desc;
$$;
revoke all on function public.minhas_conversas() from public, anon;
grant execute on function public.minhas_conversas() to authenticated;
