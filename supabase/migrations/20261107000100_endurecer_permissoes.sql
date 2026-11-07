-- Ajustes apontados pelo Security Advisor do Supabase
alter function public.cpf_valido(text) set search_path = public;
alter function public.cnpj_valido(text) set search_path = public;

-- função do gatilho: ninguém chama pela API
revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

-- funções internas / de usuário logado: fora do alcance de anônimos
revoke execute on function public.eh_empresa() from public, anon;
revoke execute on function public.exportar_meus_dados() from public, anon;
revoke execute on function public.total_candidaturas(uuid) from public, anon;
revoke execute on function public.abrir_conversa(uuid) from public, anon;
revoke execute on function public.minhas_conversas() from public, anon;
grant execute on function public.eh_empresa() to authenticated;
grant execute on function public.exportar_meus_dados() to authenticated;
grant execute on function public.total_candidaturas(uuid) to authenticated;
grant execute on function public.abrir_conversa(uuid) to authenticated;
grant execute on function public.minhas_conversas() to authenticated;

-- documento_disponivel continua público de propósito (checagem antes do cadastro)
revoke execute on function public.documento_disponivel(text, text) from public;
grant execute on function public.documento_disponivel(text, text) to anon, authenticated;
