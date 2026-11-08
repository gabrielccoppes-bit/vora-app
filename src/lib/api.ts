import { supabase } from './supabase';

/* ================= Tipos ================= */
export type TipoConta = 'freelancer' | 'empresa';

export type Perfil = {
  id: string;
  tipo: TipoConta;
  nome: string;
  titulo: string | null;
  area: string | null;
  cidade: string;
  uf: string;
  verificado: boolean;
  criado_em: string;
};

export type DadosPrivados = {
  id: string;
  cpf: string | null;
  nascimento: string | null;
  cnpj_mei: string | null;
  cnpj: string | null;
  razao_social: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_cargo: string | null;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  termos_versao: string;
  termos_aceitos_em: string;
};

type PerfilResumo = Pick<Perfil, 'id' | 'nome' | 'titulo' | 'cidade' | 'uf' | 'verificado'>;

export type Vaga = {
  id: string;
  empresa_id: string;
  titulo: string;
  area: string;
  modalidade: string;
  contrato: string;
  nivel: string;
  valor_min: number;
  valor_max: number | null;
  periodo: 'mes' | 'projeto' | 'hora';
  duracao: string;
  descricao: string;
  requisitos: string[];
  ativa: boolean;
  criado_em: string;
  empresa: PerfilResumo;
};

export type Servico = {
  id: string;
  freelancer_id: string;
  titulo: string;
  area: string;
  valor_hora: number;
  habilidades: string[];
  bio: string;
  criado_em: string;
  perfil: PerfilResumo;
};

export type Candidatura = {
  id: string;
  vaga_id: string;
  freelancer_id: string;
  mensagem: string | null;
  criado_em: string;
  freelancer?: PerfilResumo;
};

export type ConversaResumo = {
  id: string;
  outro_id: string;
  outro_nome: string;
  outro_tipo: TipoConta;
  ultima_texto: string | null;
  ultima_autor: string | null;
  ultima_em: string;
};

export type Mensagem = { id: string; conversa_id: string; autor_id: string; texto: string; criado_em: string };

/* ================= Helpers ================= */
function ok<T = unknown>(r: { data: unknown; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
const limparBusca = (q: string) => q.replace(/[,()%*\\]/g, ' ').trim();

export const PER: Record<Vaga['periodo'], string> = { mes: '/mês', projeto: '/projeto', hora: '/hora' };
export const faixaSalarial = (v: Pick<Vaga, 'valor_min' | 'valor_max' | 'periodo'>) => {
  const f = (n: number) => Number(n).toLocaleString('pt-BR');
  return v.valor_max ? `R$ ${f(v.valor_min)} – ${f(v.valor_max)}${PER[v.periodo]}` : `R$ ${f(v.valor_min)}${PER[v.periodo]}`;
};

/* ================= Consultas externas (via Edge Functions) ================= */
export type Endereco = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string };
export type EmpresaReceita = Endereco & {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: string;
  ativa: boolean;
  numero: string;
  complemento: string;
};

export async function consultarCEP(cep: string): Promise<Endereco | null> {
  const { data, error } = await supabase.functions.invoke('consulta-cep', { body: { cep } });
  return error || !data?.cidade ? null : data;
}
export async function consultarCNPJ(cnpj: string): Promise<EmpresaReceita | null> {
  const { data, error } = await supabase.functions.invoke('consulta-cnpj', { body: { cnpj } });
  return error || !data?.razao_social ? null : data;
}
export async function documentoDisponivel(doc: { cpf?: string; cnpj?: string }) {
  const { data, error } = await supabase.rpc('documento_disponivel', { p_cpf: doc.cpf ?? null, p_cnpj: doc.cnpj ?? null });
  return error ? true : Boolean(data); // em caso de falha de rede, o banco ainda barra duplicados
}

/* ================= Autenticação ================= */
export async function cadastrar(email: string, senha: string, dados: Record<string, string>) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { data: dados } });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('rate limit') || error.status === 429)
      throw new Error('Muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo.');
    if (m.includes('already registered') || m.includes('already been registered')) throw new Error('Já existe uma conta com este e-mail.');
    if (m.includes('database error')) throw new Error('Não foi possível concluir o cadastro. Confira CPF/CNPJ e os demais dados.');
    if (m.includes('password')) throw new Error('A senha não atende aos requisitos de segurança.');
    throw new Error(error.message);
  }
  return { precisaConfirmarEmail: !data.session };
}
export async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) {
    if (error.message.toLowerCase().includes('not confirmed')) throw new Error('Confirme seu e-mail antes de entrar.');
    throw new Error('E-mail ou senha incorretos.');
  }
}
export const sair = () => supabase.auth.signOut();

/* ================= Perfil ================= */
export async function meuPerfil(id: string) {
  return ok<Perfil | null>(await supabase.from('perfis').select('*').eq('id', id).maybeSingle());
}
export async function meusDadosPrivados(id: string) {
  return ok<DadosPrivados | null>(await supabase.from('dados_privados').select('*').eq('id', id).maybeSingle());
}
export async function exportarMeusDados() {
  return ok<unknown>(await supabase.rpc('exportar_meus_dados'));
}
export async function excluirMinhaConta() {
  const { error } = await supabase.functions.invoke('excluir-conta', { body: {} });
  if (error) throw new Error('Não foi possível excluir a conta agora. Tente novamente.');
  await supabase.auth.signOut();
}

/* ================= Vagas ================= */
const VAGA_SEL = '*, empresa:perfis(id, nome, titulo, cidade, uf, verificado)';

export async function listarVagas(f: { area?: string; q?: string; modalidade?: string; contrato?: string; limite?: number } = {}) {
  let q = supabase.from('vagas').select(VAGA_SEL).eq('ativa', true).order('criado_em', { ascending: false }).limit(f.limite ?? 50);
  if (f.area && f.area !== 'Todas') q = q.eq('area', f.area);
  if (f.modalidade) q = q.eq('modalidade', f.modalidade);
  if (f.contrato) q = q.eq('contrato', f.contrato);
  const t = limparBusca(f.q ?? '');
  if (t) q = q.or(`titulo.ilike.%${t}%,descricao.ilike.%${t}%,area.ilike.%${t}%`);
  return ok<Vaga[]>(await q);
}
export async function minhasVagas(empresaId: string) {
  return ok<Vaga[]>(await supabase.from('vagas').select(VAGA_SEL).eq('empresa_id', empresaId).order('criado_em', { ascending: false }));
}
export async function buscarVaga(id: string) {
  return ok<Vaga | null>(await supabase.from('vagas').select(VAGA_SEL).eq('id', id).maybeSingle());
}
export async function publicarVaga(v: Omit<Vaga, 'id' | 'criado_em' | 'ativa' | 'empresa'>) {
  return ok<{ id: string }>(await supabase.from('vagas').insert(v).select('id').single());
}
export async function encerrarVaga(id: string) {
  ok(await supabase.from('vagas').update({ ativa: false }).eq('id', id));
}
export async function totalCandidaturas(vagaId: string) {
  return ok<number>(await supabase.rpc('total_candidaturas', { p_vaga: vagaId }));
}

/* ================= Candidaturas e salvos ================= */
export async function candidatar(vagaId: string, freelancerId: string, mensagem: string) {
  ok(await supabase.from('candidaturas').insert({ vaga_id: vagaId, freelancer_id: freelancerId, mensagem: mensagem || null }));
}
export async function minhaCandidatura(vagaId: string, freelancerId: string) {
  return ok<Candidatura | null>(
    await supabase.from('candidaturas').select('*').eq('vaga_id', vagaId).eq('freelancer_id', freelancerId).maybeSingle()
  );
}
export async function candidatosDaVaga(vagaId: string) {
  return ok<Candidatura[]>(
    await supabase
      .from('candidaturas')
      .select('*, freelancer:perfis(id, nome, titulo, cidade, uf, verificado)')
      .eq('vaga_id', vagaId)
      .order('criado_em', { ascending: false })
  );
}
export async function vagasCandidatadas(freelancerId: string) {
  const r = ok<{ vaga: Vaga }[]>(
    await supabase.from('candidaturas').select(`vaga:vagas(${VAGA_SEL})`).eq('freelancer_id', freelancerId).order('criado_em', { ascending: false })
  );
  return r.map((x) => x.vaga).filter(Boolean);
}
export async function idsSalvos(freelancerId: string) {
  const r = ok<{ vaga_id: string }[]>(await supabase.from('salvos').select('vaga_id').eq('freelancer_id', freelancerId));
  return new Set(r.map((x) => x.vaga_id));
}
export async function vagasSalvas(freelancerId: string) {
  const r = ok<{ vaga: Vaga }[]>(
    await supabase.from('salvos').select(`vaga:vagas(${VAGA_SEL})`).eq('freelancer_id', freelancerId).order('criado_em', { ascending: false })
  );
  return r.map((x) => x.vaga).filter(Boolean);
}
export async function alternarSalvo(freelancerId: string, vagaId: string, salvar: boolean) {
  if (salvar) ok(await supabase.from('salvos').insert({ freelancer_id: freelancerId, vaga_id: vagaId }));
  else ok(await supabase.from('salvos').delete().eq('freelancer_id', freelancerId).eq('vaga_id', vagaId));
}

/* ================= Serviços (perfil profissional) ================= */
const SERV_SEL = '*, perfil:perfis(id, nome, titulo, cidade, uf, verificado)';

export async function listarServicos(f: { area?: string; q?: string; limite?: number } = {}) {
  let q = supabase.from('servicos').select(SERV_SEL).order('criado_em', { ascending: false }).limit(f.limite ?? 50);
  if (f.area && f.area !== 'Todas') q = q.eq('area', f.area);
  const t = limparBusca(f.q ?? '');
  if (t) q = q.or(`titulo.ilike.%${t}%,bio.ilike.%${t}%`);
  return ok<Servico[]>(await q);
}
export async function buscarServico(id: string) {
  return ok<Servico | null>(await supabase.from('servicos').select(SERV_SEL).eq('id', id).maybeSingle());
}
export async function meuServico(freelancerId: string) {
  return ok<Servico | null>(await supabase.from('servicos').select(SERV_SEL).eq('freelancer_id', freelancerId).maybeSingle());
}
export async function salvarServico(s: Pick<Servico, 'freelancer_id' | 'titulo' | 'area' | 'valor_hora' | 'habilidades' | 'bio'>) {
  const r = ok<{ id: string }>(await supabase.from('servicos').upsert(s, { onConflict: 'freelancer_id' }).select('id').single());
  ok(await supabase.from('perfis').update({ titulo: s.titulo, area: s.area }).eq('id', s.freelancer_id));
  return r;
}

/* ================= Conversas ================= */
export async function minhasConversas() {
  return ok<ConversaResumo[]>(await supabase.rpc('minhas_conversas'));
}
export async function abrirConversa(outroId: string) {
  return ok<string>(await supabase.rpc('abrir_conversa', { p_outro: outroId }));
}
export async function mensagens(conversaId: string) {
  return ok<Mensagem[]>(
    await supabase.from('mensagens').select('*').eq('conversa_id', conversaId).order('criado_em', { ascending: true }).limit(300)
  );
}
export async function enviarMensagem(conversaId: string, texto: string) {
  return ok<Mensagem>(await supabase.from('mensagens').insert({ conversa_id: conversaId, texto }).select('*').single());
}
export function ouvirMensagens(conversaId: string, aoReceber: (m: Mensagem) => void) {
  const canal = supabase
    .channel(`conversa-${conversaId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` }, (p) =>
      aoReceber(p.new as Mensagem)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
