import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/* ================= Tipos ================= */
export type TipoConta = 'freelancer' | 'empresa';

export type Perfil = {
  id: string;
  tipo: TipoConta;
  nome: string;
  titulo: string | null;
  area: string | null;
  areas: string[]; // freelancer: todas as áreas (a primeira é a principal)
  cidade: string;
  uf: string;
  verificado: boolean;
  lat: number | null; // ponto aproximado (só contratantes)
  lng: number | null;
  nota_media: number | null; // média das avaliações (mantida pelo banco)
  nota_total: number;
  foto_v: number | null; // versão da foto de perfil/logo (null = sem foto)
  suspenso: boolean; // suspensa pela moderação
  faltas: number; // freelancer: faltas marcadas pelos contratantes
  cancelamentos: number; // contratações canceladas por esta conta
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

type PerfilResumo = Pick<Perfil, 'id' | 'nome' | 'titulo' | 'cidade' | 'uf' | 'verificado'> & {
  lat?: number | null;
  lng?: number | null;
  nota_media?: number | null;
  nota_total?: number;
  foto_v?: number | null;
  faltas?: number;
  cancelamentos?: number;
};

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
  periodo: 'mes' | 'projeto' | 'hora' | 'diaria';
  duracao: string;
  descricao: string;
  requisitos: string[];
  ativa: boolean;
  urgente: boolean;
  inicio_em: string | null;
  quantidade: number; // quantas pessoas a vaga precisa
  contratados: number; // mantido pelo banco
  completa: boolean; // fechou porque lotou
  substituto_auto: boolean;
  serie_id: string | null; // turnos da mesma escala
  criado_em: string;
  empresa: PerfilResumo;
};

export type Servico = {
  id: string;
  freelancer_id: string;
  titulo: string;
  area: string;
  areas: string[];
  valor_hora: number;
  habilidades: string[];
  bio: string;
  criado_em: string;
  perfil: PerfilResumo;
};

export type StatusCandidatura = 'pendente' | 'contratado' | 'recusado' | 'cancelado_freela' | 'cancelado_empresa' | 'falta';
export type DirecaoAvaliacao = 'empresa_para_freela' | 'freela_para_empresa';
export type Avaliacao = {
  direcao: DirecaoAvaliacao;
  freelancer?: { nome: string; titulo: string | null } | null;
  id: string;
  candidatura_id: string;
  vaga_id: string;
  empresa_id: string;
  freelancer_id: string;
  nota: number;
  tags: string[];
  comentario: string | null;
  criado_em: string;
  empresa?: { nome: string; titulo: string | null; cidade: string; uf: string };
  vaga?: { titulo: string } | null;
};
export type Candidatura = {
  id: string;
  vaga_id: string;
  freelancer_id: string;
  mensagem: string | null;
  status: StatusCandidatura;
  motivo: string | null;
  ultima_hora: boolean;
  alterado_em: string | null;
  checkin_em?: string | null;
  checkout_em?: string | null;
  checkin_dist_m?: number | null;
  checkout_dist_m?: number | null;
  presenca_por?: 'gps' | 'estabelecimento' | null;
  criado_em: string;
  freelancer?: PerfilResumo;
  avaliacao?: Pick<Avaliacao, 'id' | 'nota' | 'tags' | 'comentario'> | null;
};
const FREELA_EMBED = 'freelancer:perfis!candidaturas_freelancer_id_fkey(id, nome, titulo, cidade, uf, verificado, nota_media, nota_total, foto_v, faltas, cancelamentos)';
/** PostgREST devolve objeto (1:1) ou lista; normaliza para objeto */
const umOuNada = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export type ConversaResumo = {
  id: string;
  outro_id: string;
  outro_nome: string;
  outro_tipo: TipoConta;
  outro_foto_v: number | null;
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

export const PER: Record<Vaga['periodo'], string> = { mes: '/mês', projeto: '/projeto', hora: '/hora', diaria: '/diária' };
/** Vaga urgente ainda válida (até 6h depois do início do turno) */
export const urgenteAtiva = (v: Pick<Vaga, 'urgente' | 'inicio_em' | 'ativa'>) =>
  v.ativa && v.urgente && !!v.inicio_em && new Date(v.inicio_em).getTime() > Date.now() - 6 * 3600e3;

/** "hoje às 20:00", "amanhã às 22:30" ou "sáb, 15/11 às 20:00" */
export function quandoComeca(iso: string) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date();
  const amanha = new Date(Date.now() + 864e5);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `hoje às ${hora}`;
  if (mesmoDia(d, amanha)) return `amanhã às ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} às ${hora}`;
}

const urgentesPrimeiro = (l: Vaga[]) => [...l].sort((a, b) => Number(urgenteAtiva(b)) - Number(urgenteAtiva(a)));

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
export async function cadastrar(email: string, senha: string, dados: Record<string, string | string[]>) {
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
export async function sair() {
  if (Platform.OS !== 'web') {
    const { esquecerAparelho } = await import('./pushApp');
    await esquecerAparelho().catch(() => {});
  }
  await supabase.auth.signOut();
}

/* ================= Senha ================= */
/** Endereço para onde o link do e-mail de recuperação leva (site ou app). */
function linkNovaSenha() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const base = window.location.pathname.startsWith('/vora-app') ? '/vora-app' : '';
    return `${window.location.origin}${base}/nova-senha`;
  }
  return Linking.createURL('/nova-senha');
}

function erroDeSenha(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.';
  if (m.includes('same') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('weak') || m.includes('pwned')) return 'Essa senha é fraca ou já vazou. Escolha outra.';
  if (m.includes('reauthentication') || m.includes('session')) return 'Sua sessão expirou. Peça um novo link.';
  return 'Não foi possível concluir agora. Tente de novo.';
}

export async function pedirNovaSenha(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: linkNovaSenha() });
  // e-mail inexistente não gera erro (não revelamos quem tem conta)
  if (error) throw new Error(erroDeSenha(error.message));
}

export async function definirNovaSenha(senha: string) {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw new Error(erroDeSenha(error.message));
}

/** Confere a senha atual sem trocar de sessão (usado em "Alterar senha"). */
export async function conferirSenhaAtual(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error('Senha atual incorreta.');
}

/* ================= Perfil ================= */
const SUPA_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
/** Endereço público da foto (ou null). A versão evita mostrar a foto antiga do cache. */
export function fotoUrl(p?: { id?: string; foto_v?: number | null } | null) {
  return p?.id && p.foto_v ? `${SUPA_URL}/storage/v1/object/public/avatares/${p.id}/foto.jpg?v=${p.foto_v}` : null;
}

/** Envia a foto já recortada (JPEG) e grava a nova versão no perfil. */
export async function enviarFoto(id: string, dados: ArrayBuffer) {
  const { error } = await supabase.storage.from('avatares').upload(`${id}/foto.jpg`, dados, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(error.message.includes('size') ? 'A foto é grande demais (máx. 5 MB).' : 'Não foi possível enviar a foto.');
  ok(await supabase.from('perfis').update({ foto_v: Date.now() }).eq('id', id));
}

export async function removerFoto(id: string) {
  await supabase.storage.from('avatares').remove([`${id}/foto.jpg`]);
  ok(await supabase.from('perfis').update({ foto_v: null }).eq('id', id));
}

export type EdicaoPerfil = {
  perfil: Partial<Pick<Perfil, 'nome' | 'titulo' | 'area' | 'areas' | 'cidade' | 'uf' | 'lat' | 'lng'>>;
  privados: Partial<Pick<DadosPrivados, 'telefone' | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'responsavel_nome' | 'responsavel_cargo'>>;
};

export async function salvarPerfil(id: string, e: EdicaoPerfil) {
  const [a, b] = await Promise.all([
    supabase.from('perfis').update(e.perfil).eq('id', id),
    supabase.from('dados_privados').update(e.privados).eq('id', id),
  ]);
  ok(a);
  ok(b);
}

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
const VAGA_SEL = '*, empresa:perfis!vagas_empresa_id_fkey(id, nome, titulo, cidade, uf, verificado, lat, lng, nota_media, nota_total, foto_v)';

export async function listarVagas(f: { area?: string; areas?: string[]; q?: string; modalidade?: string; contrato?: string; urgentes?: boolean; limite?: number } = {}) {
  let q = supabase.from('vagas').select(VAGA_SEL).eq('ativa', true).order('criado_em', { ascending: false }).limit(f.limite ?? 50);
  if (f.area && f.area !== 'Todas') q = q.eq('area', f.area);
  else if (f.areas?.length) q = q.in('area', f.areas); // "Minhas áreas" do freelancer
  if (f.modalidade) q = q.eq('modalidade', f.modalidade);
  if (f.contrato) q = q.eq('contrato', f.contrato);
  const t = limparBusca(f.q ?? '');
  if (t) q = q.or(`titulo.ilike.%${t}%,descricao.ilike.%${t}%,area.ilike.%${t}%`);
  if (f.urgentes) q = q.eq('urgente', true).gte('inicio_em', new Date(Date.now() - 6 * 3600e3).toISOString());
  return urgentesPrimeiro(ok<Vaga[]>(await q));
}
/** Vagas urgentes ainda abertas (a tela filtra por distância ou cidade) */
export async function urgentesAbertas() {
  const r = ok<Vaga[]>(
    await supabase
      .from('vagas')
      .select(VAGA_SEL)
      .eq('ativa', true)
      .eq('urgente', true)
      .gte('inicio_em', new Date(Date.now() - 6 * 3600e3).toISOString())
      .order('inicio_em', { ascending: true })
      .limit(50)
  );
  return r;
}
/** Vagas num raio a partir do ponto do freelancer (o ponto não é gravado) */
export async function vagasProximas(ponto: { lat: number; lng: number }, raioKm: number, limite = 20) {
  const ids = ok<{ vaga_id: string; distancia_km: number }[]>(
    await supabase.rpc('vagas_proximas', { p_lat: ponto.lat, p_lng: ponto.lng, p_raio_km: raioKm, p_limite: limite })
  );
  if (!ids.length) return [];
  const vs = ok<Vaga[]>(await supabase.from('vagas').select(VAGA_SEL).in('id', ids.map((x) => x.vaga_id)));
  const dist = new Map(ids.map((x) => [x.vaga_id, x.distancia_km]));
  return vs.sort((a, b) => (dist.get(a.id) ?? 0) - (dist.get(b.id) ?? 0));
}
/** Endereço do contratante → ponto no mapa */
export async function geocodificar(e: { cep: string; logradouro: string; numero: string; cidade: string; uf: string }) {
  const { data, error } = await supabase.functions.invoke('geocodificar', { body: e });
  return error || typeof data?.lat !== 'number' ? null : (data as { lat: number; lng: number });
}
/** Aviso em tempo real quando uma vaga urgente é publicada (app aberto) */
export function ouvirVagasUrgentes(aoReceber: (vagaId: string) => void) {
  const canal = supabase
    .channel(`vagas-urgentes-${Math.random().toString(36).slice(2)}`) // nome único: evita reaproveitar um canal que está sendo fechado
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vagas', filter: 'urgente=eq.true' }, (p) =>
      aoReceber((p.new as { id: string }).id)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
/** Vagas da empresa já com o total de candidatos (1 consulta só) */
export async function minhasVagas(empresaId: string) {
  const r = ok<(Vaga & { candidaturas: { count: number }[] })[]>(
    await supabase.from('vagas').select(`${VAGA_SEL}, candidaturas(count)`).eq('empresa_id', empresaId).order('criado_em', { ascending: false })
  );
  return r.map(({ candidaturas, ...v }) => ({ ...v, n: candidaturas?.[0]?.count ?? 0 }));
}
/** Últimas candidaturas recebidas nas vagas da empresa (1 consulta só) */
export async function candidaturasRecebidas(empresaId: string, limite = 6) {
  return ok<(Candidatura & { vaga: { id: string; titulo: string } })[]>(
    await supabase
      .from('candidaturas')
      .select(`*, ${FREELA_EMBED}, vaga:vagas!inner(id, titulo, empresa_id)`)
      .eq('vaga.empresa_id', empresaId)
      .order('criado_em', { ascending: false })
      .limit(limite)
  );
}
export async function buscarVaga(id: string) {
  return ok<Vaga | null>(await supabase.from('vagas').select(VAGA_SEL).eq('id', id).maybeSingle());
}
export async function publicarVaga(
  v: Omit<Vaga, 'id' | 'criado_em' | 'ativa' | 'empresa' | 'urgente' | 'inicio_em' | 'contratados' | 'completa' | 'serie_id'> & { urgente?: boolean; inicio_em?: string | null }
) {
  return ok<{ id: string }>(await supabase.from('vagas').insert(v).select('id').single());
}
/** Muda quantas pessoas a vaga precisa (o banco fecha/reabre sozinho) */
export async function mudarQuantidade(id: string, quantidade: number) {
  const { error } = await supabase.from('vagas').update({ quantidade }).eq('id', id);
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível alterar agora.');
}
export async function alternarSubstituto(id: string, ligado: boolean) {
  ok(await supabase.from('vagas').update({ substituto_auto: ligado }).eq('id', id));
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
  const c = ok<Candidatura | null>(
    await supabase
      .from('candidaturas')
      .select('*, avaliacao:avaliacoes(id, nota, tags, comentario)')
      .eq('avaliacao.direcao', 'freela_para_empresa')
      .eq('vaga_id', vagaId)
      .eq('freelancer_id', freelancerId)
      .maybeSingle()
  );
  return c ? { ...c, avaliacao: umOuNada(c.avaliacao) } : null;
}
export async function candidatosDaVaga(vagaId: string) {
  return ok<Candidatura[]>(
    await supabase
      .from('candidaturas')
      .select(`*, ${FREELA_EMBED}, avaliacao:avaliacoes(id, nota, tags, comentario)`)
      .eq('avaliacao.direcao', 'empresa_para_freela')
      .eq('vaga_id', vagaId)
      .order('criado_em', { ascending: false })
  ).map((c) => ({ ...c, avaliacao: umOuNada(c.avaliacao) }));
}
/** Contratante decide a candidatura */
export async function definirStatus(candidaturaId: string, status: StatusCandidatura, motivo?: string) {
  const { error } = await supabase
    .from('candidaturas')
    .update(motivo !== undefined ? { status, motivo: motivo.trim() || null } : { status })
    .eq('id', candidaturaId);
  if (error) throw new Error(error.message.includes('não permitida') ? 'Essa mudança não é permitida.' : 'Não foi possível atualizar agora.');
}
/** Freelancers contratados pela empresa (com ou sem avaliação) */
export async function contratadosDaEmpresa(empresaId: string) {
  return ok<(Candidatura & { vaga: { id: string; titulo: string } })[]>(
    await supabase
      .from('candidaturas')
      .select(`*, ${FREELA_EMBED}, vaga:vagas!inner(id, titulo, empresa_id), avaliacao:avaliacoes(id, nota, tags, comentario)`)
      .eq('avaliacao.direcao', 'empresa_para_freela')
      .eq('vaga.empresa_id', empresaId)
      .eq('status', 'contratado')
      .order('criado_em', { ascending: false })
  ).map((c) => ({ ...c, avaliacao: umOuNada(c.avaliacao) }));
}
/** Cria ou edita a avaliação de uma contratação */
export async function salvarAvaliacao(a: {
  existenteId?: string;
  direcao: DirecaoAvaliacao;
  candidatura_id: string;
  vaga_id: string;
  empresa_id: string;
  freelancer_id: string;
  nota: number;
  tags: string[];
  comentario: string;
}) {
  const campos = { nota: a.nota, tags: a.tags, comentario: a.comentario.trim() || null };
  if (a.existenteId) ok(await supabase.from('avaliacoes').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', a.existenteId));
  else
    ok(
      await supabase
        .from('avaliacoes')
        .insert({ candidatura_id: a.candidatura_id, vaga_id: a.vaga_id, empresa_id: a.empresa_id, freelancer_id: a.freelancer_id, direcao: a.direcao, ...campos })
    );
}
/** Avaliações públicas de um freelancer, com o estabelecimento que avaliou */
export async function avaliacoesDoFreelancer(freelancerId: string) {
  return ok<Avaliacao[]>(
    await supabase
      .from('avaliacoes')
      .select('*, empresa:perfis!avaliacoes_empresa_id_fkey(nome, titulo, cidade, uf), vaga:vagas(titulo)')
      .eq('freelancer_id', freelancerId)
      .eq('direcao', 'empresa_para_freela')
      .order('criado_em', { ascending: false })
      .limit(50)
  );
}
/** Avaliações públicas de um estabelecimento, feitas pelos freelancers que trabalharam lá */
export async function avaliacoesDoEstabelecimento(empresaId: string) {
  return ok<Avaliacao[]>(
    await supabase
      .from('avaliacoes')
      .select('*, freelancer:perfis!avaliacoes_freelancer_id_fkey(nome, titulo), vaga:vagas(titulo)')
      .eq('empresa_id', empresaId)
      .eq('direcao', 'freela_para_empresa')
      .order('criado_em', { ascending: false })
      .limit(50)
  );
}
/** Vagas abertas de um estabelecimento */
export async function vagasDoEstabelecimento(empresaId: string) {
  return ok<Vaga[]>(await supabase.from('vagas').select(VAGA_SEL).eq('empresa_id', empresaId).eq('ativa', true).order('criado_em', { ascending: false }));
}
type VagaComEmpresa = { id: string; titulo: string; empresa_id: string; inicio_em: string | null; empresa: PerfilResumo };
/** Trabalhos em que o freelancer foi contratado (para avaliar o estabelecimento) */
export async function minhasContratacoes(freelancerId: string) {
  return ok<(Candidatura & { vaga: VagaComEmpresa })[]>(
    await supabase
      .from('candidaturas')
      .select(
        '*, vaga:vagas(id, titulo, empresa_id, inicio_em, empresa:perfis!vagas_empresa_id_fkey(id, nome, titulo, cidade, uf, verificado, nota_media, nota_total, foto_v)), avaliacao:avaliacoes(id, nota, tags, comentario)'
      )
      .eq('avaliacao.direcao', 'freela_para_empresa')
      .eq('freelancer_id', freelancerId)
      .eq('status', 'contratado')
      .order('criado_em', { ascending: false })
  ).map((c) => ({ ...c, avaliacao: umOuNada(c.avaliacao) }));
}
/** Perfil público por id */
export async function perfilPublico(id: string) {
  return ok<Perfil | null>(await supabase.from('perfis').select('*').eq('id', id).maybeSingle());
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
const SERV_SEL = '*, perfil:perfis!servicos_freelancer_id_fkey(id, nome, titulo, cidade, uf, verificado, nota_media, nota_total, foto_v, faltas, cancelamentos)';

export async function listarServicos(f: { area?: string; q?: string; limite?: number } = {}) {
  let q = supabase.from('servicos').select(SERV_SEL).order('criado_em', { ascending: false }).limit(f.limite ?? 50);
  if (f.area && f.area !== 'Todas') q = q.contains('areas', [f.area]); // qualquer uma das áreas do freelancer
  const t = limparBusca(f.q ?? '');
  if (t) q = q.or(`titulo.ilike.%${t}%,bio.ilike.%${t}%`);
  return ok<Servico[]>(await q);
}
/** Aceita o id do serviço OU o id do freelancer */
export async function buscarServico(id: string) {
  return ok<Servico | null>(await supabase.from('servicos').select(SERV_SEL).or(`id.eq.${id},freelancer_id.eq.${id}`).limit(1).maybeSingle());
}
export async function meuServico(freelancerId: string) {
  return ok<Servico | null>(await supabase.from('servicos').select(SERV_SEL).eq('freelancer_id', freelancerId).maybeSingle());
}
export async function salvarServico(s: Pick<Servico, 'freelancer_id' | 'titulo' | 'areas' | 'valor_hora' | 'habilidades' | 'bio'>) {
  const dados = { ...s, area: s.areas[0] };
  const r = ok<{ id: string }>(await supabase.from('servicos').upsert(dados, { onConflict: 'freelancer_id' }).select('id').single());
  ok(await supabase.from('perfis').update({ titulo: s.titulo, areas: s.areas }).eq('id', s.freelancer_id));
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
    .channel(`conversa-${conversaId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` }, (p) =>
      aoReceber(p.new as Mensagem)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/* ================= Disponibilidade ================= */
export type Turno = 'manha' | 'tarde' | 'noite' | 'madrugada';
export const TURNOS: { id: Turno; nome: string; horas: string }[] = [
  { id: 'manha', nome: 'Manhã', horas: '6h–12h' },
  { id: 'tarde', nome: 'Tarde', horas: '12h–18h' },
  { id: 'noite', nome: 'Noite', horas: '18h–0h' },
  { id: 'madrugada', nome: 'Madrugada', horas: '0h–6h' },
];
export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export type Disponivel = { dia: number; turno: Turno };
/** Turno de agora (para "disponível agora") */
export function turnoAtual(d = new Date()): Disponivel {
  const h = d.getHours();
  const turno: Turno = h < 6 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
  return { dia: d.getDay(), turno };
}

export async function disponibilidadeDe(freelancerId: string) {
  return ok<Disponivel[]>(await supabase.from('disponibilidade').select('dia, turno').eq('freelancer_id', freelancerId));
}
export async function salvarDisponibilidade(freelancerId: string, itens: Disponivel[]) {
  ok(await supabase.from('disponibilidade').delete().eq('freelancer_id', freelancerId));
  if (itens.length) ok(await supabase.from('disponibilidade').insert(itens.map((i) => ({ ...i, freelancer_id: freelancerId }))));
}
/** Freelancers disponíveis num dia (e turno, se informado) */
export async function disponiveisEm(dia: number, turno?: Turno) {
  let q = supabase.from('disponibilidade').select('freelancer_id').eq('dia', dia);
  if (turno) q = q.eq('turno', turno);
  return new Set(ok<{ freelancer_id: string }[]>(await q.limit(1000)).map((x) => x.freelancer_id));
}

/* ================= Favoritos (contratante) ================= */
export async function idsFavoritos(empresaId: string) {
  return new Set(ok<{ freelancer_id: string }[]>(await supabase.from('favoritos').select('freelancer_id').eq('empresa_id', empresaId)).map((x) => x.freelancer_id));
}
export async function alternarFavorito(empresaId: string, freelancerId: string, favoritar: boolean) {
  if (favoritar) ok(await supabase.from('favoritos').insert({ empresa_id: empresaId, freelancer_id: freelancerId }));
  else ok(await supabase.from('favoritos').delete().eq('empresa_id', empresaId).eq('freelancer_id', freelancerId));
}
export type Favorito = { freelancer_id: string; criado_em: string; freelancer: PerfilResumo & { area?: string | null } };
export async function listarFavoritos(empresaId: string) {
  return ok<Favorito[]>(
    await supabase
      .from('favoritos')
      .select('freelancer_id, criado_em, freelancer:perfis!favoritos_freelancer_id_fkey(id, nome, titulo, area, cidade, uf, verificado, nota_media, nota_total, foto_v, faltas, cancelamentos)')
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })
  ).filter((f) => f.freelancer);
}

/* ================= Convites diretos ================= */
export type Convite = {
  id: string;
  vaga_id: string;
  empresa_id: string;
  freelancer_id: string;
  mensagem: string | null;
  status: 'pendente' | 'aceito' | 'recusado';
  substituicao: boolean;
  criado_em: string;
  respondido_em: string | null;
  vaga?: Pick<Vaga, 'id' | 'titulo' | 'valor_min' | 'valor_max' | 'periodo' | 'inicio_em' | 'ativa' | 'urgente' | 'quantidade' | 'contratados' | 'completa'> & { empresa: PerfilResumo };
  freelancer?: PerfilResumo;
};
export async function convidar(vagaId: string, empresaId: string, freelancerId: string, mensagem: string) {
  const { error } = await supabase.from('convites').insert({ vaga_id: vagaId, empresa_id: empresaId, freelancer_id: freelancerId, mensagem: mensagem.trim() || null });
  if (error) throw new Error(error.code === '23505' ? 'Você já convidou essa pessoa para essa vaga.' : 'Não foi possível enviar o convite.');
}
export async function meusConvites(freelancerId: string) {
  return ok<Convite[]>(
    await supabase
      .from('convites')
      .select('*, vaga:vagas(id, titulo, valor_min, valor_max, periodo, inicio_em, ativa, urgente, quantidade, contratados, completa, empresa:perfis!vagas_empresa_id_fkey(id, nome, titulo, cidade, uf, verificado, nota_media, nota_total, foto_v, cancelamentos))')
      .eq('freelancer_id', freelancerId)
      .order('criado_em', { ascending: false })
      .limit(100)
  ).filter((c) => c.vaga);
}
export async function convitesPendentes(freelancerId: string) {
  const { count } = await supabase.from('convites').select('id', { count: 'exact', head: true }).eq('freelancer_id', freelancerId).eq('status', 'pendente');
  return count ?? 0;
}
export async function convitesDaVaga(vagaId: string) {
  return ok<Convite[]>(
    await supabase
      .from('convites')
      .select('*, freelancer:perfis!convites_freelancer_id_fkey(id, nome, titulo, cidade, uf, verificado, nota_media, nota_total, foto_v)')
      .eq('vaga_id', vagaId)
      .order('criado_em', { ascending: false })
  );
}
export async function responderConvite(id: string, aceitar: boolean) {
  const { error } = await supabase.rpc('responder_convite', { p_convite: id, p_aceitar: aceitar });
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível responder agora.');
}
export async function retirarConvite(id: string) {
  ok(await supabase.from('convites').delete().eq('id', id));
}
/** Aviso em tempo real de convite novo (app aberto) */
export function ouvirConvites(freelancerId: string, aoReceber: (c: Convite) => void) {
  const canal = supabase
    .channel(`convites-${freelancerId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'convites', filter: `freelancer_id=eq.${freelancerId}` }, (p) => aoReceber(p.new as Convite))
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/* ================= Certificados e experiência ================= */
export type Certificado = { id: string; freelancer_id: string; nome: string; instituicao: string | null; ano: number | null; criado_em: string };
export type Experiencia = { id: string; freelancer_id: string; local: string; funcao: string; periodo: string | null; descricao: string | null; criado_em: string };
export async function certificadosDe(freelancerId: string) {
  return ok<Certificado[]>(await supabase.from('certificados').select('*').eq('freelancer_id', freelancerId).order('ano', { ascending: false, nullsFirst: false }));
}
export async function experienciasDe(freelancerId: string) {
  return ok<Experiencia[]>(await supabase.from('experiencias').select('*').eq('freelancer_id', freelancerId).order('criado_em', { ascending: false }));
}
export async function salvarCertificado(c: { id?: string; nome: string; instituicao: string; ano: number | null }) {
  const campos = { nome: c.nome.trim(), instituicao: c.instituicao.trim() || null, ano: c.ano };
  if (c.id) ok(await supabase.from('certificados').update(campos).eq('id', c.id));
  else ok(await supabase.from('certificados').insert(campos));
}
export async function salvarExperiencia(e: { id?: string; local: string; funcao: string; periodo: string; descricao: string }) {
  const campos = { local: e.local.trim(), funcao: e.funcao.trim(), periodo: e.periodo.trim() || null, descricao: e.descricao.trim() || null };
  if (e.id) ok(await supabase.from('experiencias').update(campos).eq('id', e.id));
  else ok(await supabase.from('experiencias').insert(campos));
}
export async function apagarCertificado(id: string) {
  ok(await supabase.from('certificados').delete().eq('id', id));
}
export async function apagarExperiencia(id: string) {
  ok(await supabase.from('experiencias').delete().eq('id', id));
}

/* ================= Verificação de identidade ================= */
export type Verificacao = { id: string; perfil_id: string; status: 'pendente' | 'aprovada' | 'recusada'; motivo: string | null; criado_em: string; revisado_em: string | null };
export async function minhaVerificacao(perfilId: string) {
  return ok<Verificacao | null>(
    await supabase.from('verificacoes').select('*').eq('perfil_id', perfilId).order('criado_em', { ascending: false }).limit(1).maybeSingle()
  );
}
/** Envia selfie + documento (JPEG) para o cofre privado e abre o pedido */
export async function pedirVerificacao(perfilId: string, selfie: ArrayBuffer, documento: ArrayBuffer) {
  for (const [nome, dados] of [['selfie', selfie], ['documento', documento]] as const) {
    const { error } = await supabase.storage.from('verificacoes').upload(`${perfilId}/${nome}.jpg`, dados, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error('Não foi possível enviar as fotos. Tente de novo.');
  }
  const { error } = await supabase.from('verificacoes').insert({ perfil_id: perfilId });
  if (error) throw new Error(error.code === '23505' ? 'Você já tem um pedido em análise.' : 'Não foi possível enviar o pedido.');
}

/* ================= Denúncias e bloqueios ================= */
export const MOTIVOS_DENUNCIA: { id: string; nome: string }[] = [
  { id: 'golpe', nome: 'Golpe ou fraude' },
  { id: 'nao_pagou', nome: 'Não pagou o combinado' },
  { id: 'assedio', nome: 'Assédio ou discriminação' },
  { id: 'falso', nome: 'Perfil ou vaga falsa' },
  { id: 'conduta', nome: 'Conduta inadequada no trabalho' },
  { id: 'spam', nome: 'Spam ou propaganda' },
  { id: 'outro', nome: 'Outro motivo' },
];
export async function denunciar(d: { alvo_id: string; motivo: string; detalhes: string; vaga_id?: string | null }) {
  const { error } = await supabase.from('denuncias').insert({ alvo_id: d.alvo_id, motivo: d.motivo, detalhes: d.detalhes.trim() || null, vaga_id: d.vaga_id ?? null });
  if (error) throw new Error(error.message.includes('row-level') ? 'Limite de denúncias atingido hoje. Tente amanhã.' : 'Não foi possível enviar a denúncia.');
}
export async function idsBloqueados(autorId: string) {
  return new Set(ok<{ alvo_id: string }[]>(await supabase.from('bloqueios').select('alvo_id').eq('autor_id', autorId)).map((x) => x.alvo_id));
}
export async function bloquear(autorId: string, alvoId: string, bloquear: boolean) {
  if (bloquear) {
    const { error } = await supabase.from('bloqueios').insert({ autor_id: autorId, alvo_id: alvoId });
    if (error && error.code !== '23505') throw new Error('Não foi possível bloquear agora.');
  } else ok(await supabase.from('bloqueios').delete().eq('autor_id', autorId).eq('alvo_id', alvoId));
}
export async function listarBloqueados(autorId: string) {
  return ok<{ alvo_id: string; criado_em: string; alvo: PerfilResumo & { tipo: TipoConta } }[]>(
    await supabase
      .from('bloqueios')
      .select('alvo_id, criado_em, alvo:perfis!bloqueios_alvo_id_fkey(id, nome, titulo, cidade, uf, verificado, tipo, foto_v)')
      .eq('autor_id', autorId)
      .order('criado_em', { ascending: false })
  );
}
/** A conversa está bloqueada (por qualquer um dos dois)? */
export async function conversaBloqueada(eu: string, outro: string) {
  const { data } = await supabase.rpc('bloqueado', { p_a: eu, p_b: outro });
  return !!data;
}

/* ================= Painel do Vora (moderação) ================= */
export async function souAdmin() {
  const { data } = await supabase.rpc('eh_admin');
  return !!data;
}
export type PainelAdmin = Record<
  'freelancers' | 'estabelecimentos' | 'novos_7d' | 'vagas_ativas' | 'candidaturas_30d' | 'contratacoes_30d' | 'faltas_30d' | 'denuncias_abertas' | 'verificacoes_pendentes' | 'suspensos',
  number
>;
export async function painelAdmin() {
  return ok<PainelAdmin>(await supabase.rpc('painel_admin'));
}
export type DenunciaAdmin = {
  id: string;
  motivo: string;
  detalhes: string | null;
  status: string;
  criado_em: string;
  autor_id: string;
  autor_nome: string;
  alvo_id: string;
  alvo_nome: string;
  alvo_tipo: TipoConta;
  alvo_suspenso: boolean;
  alvo_denuncias: number;
  vaga_titulo: string | null;
};
export async function adminDenuncias(status: 'aberta' | 'resolvida' | 'descartada' = 'aberta') {
  return ok<DenunciaAdmin[]>(await supabase.rpc('admin_denuncias', { p_status: status }));
}
export async function resolverDenuncia(id: string, status: 'resolvida' | 'descartada' | 'aberta') {
  ok(await supabase.rpc('resolver_denuncia', { p_id: id, p_status: status }));
}
export async function suspenderConta(perfilId: string, suspender: boolean) {
  ok(await supabase.rpc('suspender_conta', { p_perfil: perfilId, p_suspender: suspender }));
}
export type VerificacaoAdmin = { id: string; perfil_id: string; nome: string; tipo: TipoConta; criado_em: string };
export async function adminVerificacoes() {
  return ok<VerificacaoAdmin[]>(await supabase.rpc('admin_verificacoes'));
}
/** Links temporários (5 min) para a moderação ver as fotos */
export async function fotosVerificacao(perfilId: string) {
  const { data } = await supabase.storage.from('verificacoes').createSignedUrls([`${perfilId}/selfie.jpg`, `${perfilId}/documento.jpg`], 300);
  return { selfie: data?.[0]?.signedUrl ?? null, documento: data?.[1]?.signedUrl ?? null };
}
/** Aprova/recusa e apaga as fotos (só guardamos o resultado — LGPD) */
export async function revisarVerificacao(v: { id: string; perfil_id: string }, aprovar: boolean, motivo?: string) {
  ok(await supabase.rpc('revisar_verificacao', { p_id: v.id, p_aprovar: aprovar, p_motivo: motivo ?? null }));
  await supabase.storage.from('verificacoes').remove([`${v.perfil_id}/selfie.jpg`, `${v.perfil_id}/documento.jpg`]);
}

/* ================= Relatório do estabelecimento ================= */
export type LinhaRelatorio = Candidatura & {
  vaga: Pick<Vaga, 'id' | 'titulo' | 'valor_min' | 'valor_max' | 'periodo' | 'inicio_em' | 'criado_em' | 'area'>;
};
/** Contratações (inclui faltas e cancelamentos) de todas as vagas do estabelecimento */
export async function contratacoesDoEstabelecimento(empresaId: string) {
  return ok<LinhaRelatorio[]>(
    await supabase
      .from('candidaturas')
      .select(`*, ${FREELA_EMBED}, vaga:vagas!inner(id, titulo, valor_min, valor_max, periodo, inicio_em, criado_em, area, empresa_id)`)
      .eq('vaga.empresa_id', empresaId)
      .in('status', ['contratado', 'falta', 'cancelado_freela', 'cancelado_empresa'])
      .order('criado_em', { ascending: false })
      .limit(1000)
  );
}
/** Quem é a outra pessoa da conversa */
export async function outroDaConversa(conversaId: string, eu: string) {
  const c = ok<{ a: string; b: string } | null>(await supabase.from('conversas').select('a, b').eq('id', conversaId).maybeSingle());
  return c ? (c.a === eu ? c.b : c.a) : null;
}

/* ================= Central de avisos ================= */
export type Notificacao = { id: string; tipo: string; titulo: string; corpo: string; rota: string | null; lida: boolean; criado_em: string };
export async function listarNotificacoes(usuarioId: string) {
  return ok<Notificacao[]>(await supabase.from('notificacoes').select('id, tipo, titulo, corpo, rota, lida, criado_em').eq('usuario_id', usuarioId).order('criado_em', { ascending: false }).limit(100));
}
export async function naoLidas(usuarioId: string) {
  const { count } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId).eq('lida', false);
  return count ?? 0;
}
export async function marcarLidas(usuarioId: string, id?: string) {
  let q = supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', usuarioId).eq('lida', false);
  if (id) q = q.eq('id', id);
  ok(await q);
}
export async function apagarNotificacao(id: string) {
  ok(await supabase.from('notificacoes').delete().eq('id', id));
}
/** Aviso novo em tempo real (app aberto) */
export function ouvirNotificacoes(usuarioId: string, aoReceber: (n: Notificacao) => void) {
  const canal = supabase
    .channel(`avisos-${usuarioId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${usuarioId}` }, (p) => aoReceber(p.new as Notificacao))
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/* ================= Notificações do navegador (Web Push) ================= */
const FUNCOES = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const baseSite = () => (typeof window !== 'undefined' && window.location.pathname.startsWith('/vora-app') ? '/vora-app' : '');
export function pushSuportado() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export type EstadoPush = 'indisponivel' | 'ativo' | 'inativo' | 'bloqueado';
export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration(`${baseSite()}/`);
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'ativo' : 'inativo';
}
function chaveParaBytes(b64: string) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
/** Pede permissão, inscreve este navegador e guarda a inscrição */
export async function ativarPush(usuarioId: string) {
  if (!pushSuportado()) throw new Error('Este navegador não aceita notificações.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.');
  const reg = await navigator.serviceWorker.register(`${baseSite()}/sw.js`, { scope: `${baseSite()}/` });
  await navigator.serviceWorker.ready;
  const r = await fetch(`${FUNCOES}/enviar-push`);
  const { publica } = (await r.json()) as { publica: string };
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publica) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_inscricoes').upsert({ usuario_id: usuarioId, tipo: 'web', endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
  if (error) throw new Error('Não foi possível ativar agora.');
}
export async function desativarPush() {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.getRegistration(`${baseSite()}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_inscricoes').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

/* ================= Check-in / check-out ================= */
export async function registrarPresenca(candidaturaId: string, tipo: 'entrada' | 'saida', ponto: { lat: number; lng: number } | null) {
  const { data, error } = await supabase.rpc('registrar_presenca', { p_candidatura: candidaturaId, p_tipo: tipo, p_lat: ponto?.lat ?? null, p_lng: ponto?.lng ?? null });
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível registrar agora.');
  return data as { ok: boolean; distancia_m: number | null };
}
export async function confirmarPresenca(candidaturaId: string, tipo: 'entrada' | 'saida') {
  const { error } = await supabase.rpc('confirmar_presenca', { p_candidatura: candidaturaId, p_tipo: tipo });
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível confirmar agora.');
}
/** "6h12" entre duas datas */
export function duracao(inicio: string, fim: string) {
  const min = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}
export const horaCurta = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/* ================= Primeiros passos ================= */
export type Passo = { id: string; titulo: string; sub: string; feito: boolean; rota: string };
/** O que falta para o perfil ficar completo (para a lista de primeiros passos) */
export async function progressoPerfil(p: Perfil): Promise<Passo[]> {
  const conta = async (tabela: string, coluna: string) => {
    const { count } = await supabase.from(tabela).select(coluna, { count: 'exact', head: true }).eq(coluna, p.id);
    return count ?? 0;
  };
  const verif = await supabase.from('verificacoes').select('status').eq('perfil_id', p.id).eq('status', 'pendente').limit(1);
  const verificacao = p.verificado || (verif.data?.length ?? 0) > 0;
  if (p.tipo === 'empresa') {
    const vagas = await conta('vagas', 'empresa_id');
    return [
      { id: 'logo', titulo: 'Coloque o logo do seu estabelecimento', sub: 'Vagas com logo recebem mais candidatos', feito: !!p.foto_v, rota: '/editar-perfil' },
      { id: 'mapa', titulo: 'Confira o endereço no mapa', sub: 'Assim os freelancers veem a distância até você', feito: p.lat != null, rota: '/editar-perfil' },
      { id: 'vaga', titulo: 'Publique sua primeira vaga', sub: 'Leva menos de 2 minutos', feito: vagas > 0, rota: '/publicar' },
      { id: 'verificar', titulo: 'Verifique sua identidade', sub: 'Ganhe o selo de estabelecimento verificado', feito: verificacao, rota: '/verificacao' },
    ];
  }
  const [serv, disp, cert, exp] = await Promise.all([conta('servicos', 'freelancer_id'), conta('disponibilidade', 'freelancer_id'), conta('certificados', 'freelancer_id'), conta('experiencias', 'freelancer_id')]);
  return [
    { id: 'foto', titulo: 'Coloque uma foto de perfil', sub: 'Perfis com foto são escolhidos com mais confiança', feito: !!p.foto_v, rota: '/editar-perfil' },
    { id: 'servico', titulo: 'Publique seu serviço', sub: 'É o que aparece para os estabelecimentos na busca', feito: serv > 0, rota: '/publicar' },
    { id: 'agenda', titulo: 'Marque sua disponibilidade', sub: 'Apareça no filtro "Livres hoje"', feito: disp > 0, rota: '/disponibilidade' },
    { id: 'curriculo', titulo: 'Conte sua experiência', sub: 'Lugares onde trabalhou e cursos', feito: cert + exp > 0, rota: '/curriculo' },
    { id: 'verificar', titulo: 'Verifique sua identidade', sub: 'Ganhe o selo de verificado', feito: verificacao, rota: '/verificacao' },
  ];
}

/* ================= Escala (turnos que se repetem) ================= */
type NovaVaga = Parameters<typeof publicarVaga>[0];
/** Cria vários turnos de uma vez, ligados pela mesma escala */
export async function publicarEscala(base: NovaVaga, inicios: string[]) {
  const { randomUUID } = await import('expo-crypto');
  const serie_id = randomUUID();
  const linhas = inicios.map((inicio_em) => ({ ...base, inicio_em, urgente: false, serie_id }));
  return ok<{ id: string; inicio_em: string }[]>(await supabase.from('vagas').insert(linhas).select('id, inicio_em').order('inicio_em'));
}
export type TurnoDaEscala = Pick<Vaga, 'id' | 'inicio_em' | 'contratados' | 'quantidade' | 'ativa' | 'completa'>;
export async function turnosDaEscala(serieId: string) {
  return ok<TurnoDaEscala[]>(
    await supabase.from('vagas').select('id, inicio_em, contratados, quantidade, ativa, completa').eq('serie_id', serieId).order('inicio_em', { ascending: true }).limit(60)
  );
}
/** Copia a vaga para a próxima semana e (opcional) convida quem trabalhou nela */
export async function repetirVaga(id: string, convidar: boolean) {
  const { data, error } = await supabase.rpc('repetir_vaga', { p_vaga: id, p_convidar: convidar });
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível repetir agora.');
  return data as { id: string; convidados: number };
}

/* ================= O que levar no turno ================= */
export type Instrucoes = { traje: string | null; levar: string | null; chegada: string | null; contato: string | null };
export async function instrucoesDaVaga(vagaId: string) {
  return ok<Instrucoes | null>(await supabase.from('vaga_instrucoes').select('traje, levar, chegada, contato').eq('vaga_id', vagaId).maybeSingle());
}
export async function salvarInstrucoes(vagaIds: string[], i: Instrucoes) {
  const limpo = (x: string | null) => (x ?? '').trim() || null;
  const dados = { traje: limpo(i.traje), levar: limpo(i.levar), chegada: limpo(i.chegada), contato: limpo(i.contato) };
  if (!dados.traje && !dados.levar && !dados.chegada && !dados.contato) {
    ok(await supabase.from('vaga_instrucoes').delete().in('vaga_id', vagaIds));
    return;
  }
  ok(await supabase.from('vaga_instrucoes').upsert(vagaIds.map((vaga_id) => ({ vaga_id, ...dados, atualizado_em: new Date().toISOString() }))));
}

/* ================= Meus ganhos (freelancer) ================= */
export type TurnoGanho = Candidatura & {
  vaga: Pick<Vaga, 'id' | 'titulo' | 'valor_min' | 'valor_max' | 'periodo' | 'inicio_em' | 'criado_em'> & { empresa: PerfilResumo };
};
export async function meusTurnos(freelancerId: string) {
  return ok<TurnoGanho[]>(
    await supabase
      .from('candidaturas')
      .select('*, vaga:vagas(id, titulo, valor_min, valor_max, periodo, inicio_em, criado_em, empresa:perfis!vagas_empresa_id_fkey(id, nome, foto_v))')
      .eq('freelancer_id', freelancerId)
      .in('status', ['contratado', 'falta', 'cancelado_freela', 'cancelado_empresa'])
      .order('criado_em', { ascending: false })
      .limit(500)
  ).filter((t) => t.vaga);
}
