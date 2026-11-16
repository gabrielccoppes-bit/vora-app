import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Botao, Campo, Carregando, Chip, Folha, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import {
  adminFeedbacks,
  adminFunil,
  marcarFeedback,
  type FeedbackAdmin,
  type Funil,
  apagarDataMovimento,
  criarDataMovimento,
  datasMovimento,
  type DataMovimento,
  adminDenuncias,
  adminVerificacoes,
  fotosVerificacao,
  MOTIVOS_DENUNCIA,
  painelAdmin,
  resolverDenuncia,
  revisarVerificacao,
  souAdmin,
  suspenderConta,
  type DenunciaAdmin,
  type PainelAdmin,
  type VerificacaoAdmin,
} from '@/lib/api';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

type Aba = 'geral' | 'metricas' | 'feedbacks' | 'denuncias' | 'verificacoes' | 'datas';
type StatusDen = 'aberta' | 'resolvida' | 'descartada';
const nomeMotivo = (m: string) => MOTIVOS_DENUNCIA.find((x) => x.id === m)?.nome ?? m;

/** Painel interno da equipe do Vora: números, denúncias e verificações */
export default function Admin() {
  const toast = useToast();
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [aba, setAba] = useState<Aba>('geral');
  const [painel, setPainel] = useState<PainelAdmin | null>(null);
  const [statusDen, setStatusDen] = useState<StatusDen>('aberta');
  const [dens, setDens] = useState<DenunciaAdmin[] | null>(null);
  const [verifs, setVerifs] = useState<VerificacaoAdmin[] | null>(null);
  const [aberta, setAberta] = useState<VerificacaoAdmin | null>(null);
  const [fotos, setFotos] = useState<{ selfie: string | null; documento: string | null } | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const ok = await souAdmin();
    setPermitido(ok);
    if (!ok) return;
    const [p, d, v] = await Promise.all([painelAdmin().catch(() => null), adminDenuncias(statusDen).catch(() => []), adminVerificacoes().catch(() => [])]);
    setPainel(p);
    setDens(d);
    setVerifs(v);
  }, [statusDen]);
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function abrirVerificacao(v: VerificacaoAdmin) {
    setAberta(v);
    setFotos(null);
    setMotivoRecusa('');
    setFotos(await fotosVerificacao(v.perfil_id));
  }

  async function decidirVerificacao(aprovar: boolean) {
    if (!aberta) return;
    if (!aprovar && !motivoRecusa.trim()) return toast('Escreva o motivo da recusa (a pessoa vai ver).');
    setOcupado(true);
    try {
      await revisarVerificacao(aberta, aprovar, motivoRecusa);
      toast(aprovar ? 'Verificação aprovada. Fotos apagadas.' : 'Verificação recusada. Fotos apagadas.');
      setAberta(null);
      carregar();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function acaoDenuncia(d: DenunciaAdmin, acao: 'resolvida' | 'descartada' | 'aberta' | 'suspender' | 'reativar') {
    setOcupado(true);
    try {
      if (acao === 'suspender' || acao === 'reativar') {
        await suspenderConta(d.alvo_id, acao === 'suspender');
        toast(acao === 'suspender' ? `${d.alvo_nome} foi suspenso(a).` : `${d.alvo_nome} foi reativado(a).`);
      } else {
        await resolverDenuncia(d.id, acao);
      }
      carregar();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (permitido === null) return <Tela><Topo titulo="Painel do Vora" /><Carregando /></Tela>;
  if (!permitido)
    return (
      <Tela>
        <Topo titulo="Painel do Vora" />
        <Vazio icone="cadeado" texto="Acesso restrito à equipe do Vora." />
      </Tela>
    );

  return (
    <Tela rolar={false}>
      <Topo titulo="Painel do Vora" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Chip texto="Visão geral" ativo={aba === 'geral'} onPress={() => setAba('geral')} />
        <Chip texto="Métricas" ativo={aba === 'metricas'} onPress={() => setAba('metricas')} />
        <Chip texto="Sugestões" ativo={aba === 'feedbacks'} onPress={() => setAba('feedbacks')} />
        <Chip texto={`Denúncias${painel?.denuncias_abertas ? ` (${painel.denuncias_abertas})` : ''}`} ativo={aba === 'denuncias'} onPress={() => setAba('denuncias')} />
        <Chip texto={`Verificações${painel?.verificacoes_pendentes ? ` (${painel.verificacoes_pendentes})` : ''}`} ativo={aba === 'verificacoes'} onPress={() => setAba('verificacoes')} />
        <Chip texto="Datas" ativo={aba === 'datas'} onPress={() => setAba('datas')} />
      </ScrollView>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            tintColor={C.orange}
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }>
        {aba === 'geral' ? (
          painel ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Num v={painel.freelancers} r="freelancers" />
              <Num v={painel.estabelecimentos} r="estabelecimentos" />
              <Num v={painel.novos_7d} r="cadastros em 7 dias" />
              <Num v={painel.vagas_ativas} r="vagas abertas" />
              <Num v={painel.candidaturas_30d} r="candidaturas em 30 dias" />
              <Num v={painel.contratacoes_30d} r="contratações em 30 dias" />
              <Num v={painel.faltas_30d} r="faltas em 30 dias" alerta />
              <Num v={painel.denuncias_abertas} r="denúncias abertas" alerta onPress={() => setAba('denuncias')} />
              <Num v={painel.verificacoes_pendentes} r="verificações pendentes" alerta onPress={() => setAba('verificacoes')} />
              <Num v={painel.suspensos} r="contas suspensas" />
            </View>
          ) : (
            <Carregando />
          )
        ) : aba === 'denuncias' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['aberta', 'resolvida', 'descartada'] as const).map((s) => (
                <Chip key={s} texto={s === 'aberta' ? 'Abertas' : s === 'resolvida' ? 'Resolvidas' : 'Descartadas'} ativo={statusDen === s} onPress={() => setStatusDen(s)} />
              ))}
            </View>
            {dens === null ? (
              <Carregando />
            ) : dens.length === 0 ? (
              <Vazio icone="escudo" texto="Nenhuma denúncia aqui." />
            ) : (
              <View style={{ gap: 10 }}>
                {dens.map((d) => (
                  <View key={d.id} style={{ padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: d.alvo_suspenso ? '#FF8A8A' : C.stroke }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T style={{ fontFamily: F.interSemi, color: C.orange2 }}>{nomeMotivo(d.motivo)}</T>
                      <T style={{ color: C.muted2, fontSize: 12 }}>{tempoRelativo(d.criado_em)}</T>
                    </View>
                    <Pressable onPress={() => router.push((d.alvo_tipo === 'empresa' ? `/estabelecimento/${d.alvo_id}` : `/freela/${d.alvo_id}`) as never)}>
                      <T style={{ fontSize: 16, fontFamily: F.interSemi, marginTop: 6 }}>
                        {d.alvo_nome} <T style={{ color: C.muted, fontSize: 13 }}>· {d.alvo_tipo === 'empresa' ? 'estabelecimento' : 'freelancer'} · {d.alvo_denuncias} denúncia(s)</T>
                      </T>
                    </Pressable>
                    {d.vaga_titulo ? <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Vaga: {d.vaga_titulo}</T> : null}
                    {d.detalhes ? <T style={{ marginTop: 8, lineHeight: 20 }}>{d.detalhes}</T> : null}
                    <T style={{ color: C.muted2, fontSize: 12, marginTop: 8 }}>Denunciado por {d.autor_nome}{d.alvo_suspenso ? ' · CONTA SUSPENSA' : ''}</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {d.status === 'aberta' ? (
                        <>
                          <Mini texto="Resolvida" onPress={() => acaoDenuncia(d, 'resolvida')} desativado={ocupado} />
                          <Mini texto="Descartar" onPress={() => acaoDenuncia(d, 'descartada')} desativado={ocupado} />
                        </>
                      ) : (
                        <Mini texto="Reabrir" onPress={() => acaoDenuncia(d, 'aberta')} desativado={ocupado} />
                      )}
                      <Mini
                        texto={d.alvo_suspenso ? 'Reativar conta' : 'Suspender conta'}
                        perigo={!d.alvo_suspenso}
                        onPress={() => acaoDenuncia(d, d.alvo_suspenso ? 'reativar' : 'suspender')}
                        desativado={ocupado}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : aba === 'datas' ? (
          <AdminDatas />
        ) : aba === 'metricas' ? (
          <AdminMetricas />
        ) : aba === 'feedbacks' ? (
          <AdminFeedbacks />
        ) : verifs === null ? (
          <Carregando />
        ) : verifs.length === 0 ? (
          <Vazio icone="escudo" texto="Nenhuma verificação pendente." />
        ) : (
          <View style={{ gap: 10 }}>
            {verifs.map((v) => (
              <Pressable key={v.id} onPress={() => abrirVerificacao(v)} style={{ padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>{v.nome}</T>
                <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                  {v.tipo === 'empresa' ? 'Estabelecimento' : 'Freelancer'} · enviado {tempoRelativo(v.criado_em)}
                </T>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Folha visivel={!!aberta} aoFechar={() => setAberta(null)} titulo={aberta?.nome}>
        <T style={{ color: C.muted, lineHeight: 20 }}>Confira se o rosto da selfie é o mesmo do documento e se o nome bate com o cadastro.</T>
        {fotos === null ? (
          <Carregando />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {(['selfie', 'documento'] as const).map((k) => (
              <View key={k} style={{ flex: 1 }}>
                <T style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{k === 'selfie' ? 'Selfie' : 'Documento'}</T>
                {fotos[k] ? (
                  <Image source={{ uri: fotos[k]! }} style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: C.bg }} contentFit="contain" />
                ) : (
                  <T style={{ color: '#FF8A8A' }}>Foto não encontrada</T>
                )}
              </View>
            ))}
          </View>
        )}
        <Campo rotulo="Motivo (se recusar)" valor={motivoRecusa} aoMudar={setMotivoRecusa} placeholder="Ex.: documento ilegível" maxLength={300} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Botao titulo="Recusar" variante="perigo" onPress={() => decidirVerificacao(false)} desativado={ocupado} estilo={{ flex: 1 }} />
          <Botao titulo="Aprovar" onPress={() => decidirVerificacao(true)} carregando={ocupado} estilo={{ flex: 1 }} />
        </View>
        <T style={{ color: C.muted2, fontSize: 12, textAlign: 'center', marginTop: 10 }}>As fotos são apagadas automaticamente depois da decisão.</T>
      </Folha>
    </Tela>
  );
}

function Num({ v, r, alerta, onPress }: { v: number; r: string; alerta?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ width: '48%', flexGrow: 1, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 26, color: alerta && v > 0 ? C.orange2 : C.cream }}>{v}</T>
      <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{r}</T>
    </Pressable>
  );
}

function Mini({ texto, onPress, perigo, desativado }: { texto: string; onPress: () => void; perigo?: boolean; desativado?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: perigo ? '#FF8A8A' : C.stroke, opacity: desativado ? 0.5 : 1 }}>
      <T style={{ fontSize: 13, fontFamily: F.interSemi, color: perigo ? '#FF8A8A' : C.cream }}>{texto}</T>
    </Pressable>
  );
}

/** Datas de movimento: aparecem no Início e geram aviso 7 dias antes */
function AdminDatas() {
  const toast = useToast();
  const [lista, setLista] = useState<DataMovimento[] | null>(null);
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [dica, setDica] = useState('');
  const [onde, setOnde] = useState<'poa' | 'rs' | 'br'>('poa');
  const [salvando, setSalvando] = useState(false);
  const carregar = () => datasMovimento().then(setLista).catch(() => setLista([]));
  useEffect(() => {
    carregar();
  }, []);
  const iso = (d: string) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };
  async function salvar() {
    const i = iso(inicio);
    const f = fim.trim() ? iso(fim) : i;
    if (titulo.trim().length < 3 || !i || !f || f < i) return toast('Preencha o título e as datas no formato DD/MM/AAAA.');
    setSalvando(true);
    try {
      await criarDataMovimento({ titulo: titulo.trim(), inicio: i, fim: f, dica: dica.trim() || null, cidade: onde === 'poa' ? 'Porto Alegre' : null, uf: onde === 'br' ? null : 'RS' });
      setTitulo('');
      setInicio('');
      setFim('');
      setDica('');
      toast('Data cadastrada!');
      carregar();
    } catch {
      toast('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <View>
      <T style={{ color: C.muted, lineHeight: 20 }}>Jogos, shows, feriados e eventos. Aparecem no Início e avisam estabelecimentos e freelancers da região 7 dias antes.</T>
      <Campo rotulo="O que acontece" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Grenal no Beira-Rio" maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Campo rotulo="Início" valor={inicio} aoMudar={setInicio} mascara="data" keyboardType="number-pad" placeholder="DD/MM/AAAA" estilo={{ flex: 1 }} />
        <Campo rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} mascara="data" keyboardType="number-pad" placeholder="DD/MM/AAAA" estilo={{ flex: 1 }} />
      </View>
      <Campo rotulo="Dica (opcional)" valor={dica} aoMudar={setDica} placeholder="Ex.: bares da região do estádio lotam" maxLength={240} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Chip texto="Porto Alegre" ativo={onde === 'poa'} onPress={() => setOnde('poa')} />
        <Chip texto="Todo o RS" ativo={onde === 'rs'} onPress={() => setOnde('rs')} />
        <Chip texto="Brasil" ativo={onde === 'br'} onPress={() => setOnde('br')} />
      </View>
      <Botao titulo="Cadastrar data" onPress={salvar} carregando={salvando} estilo={{ marginTop: 14 }} />
      <T style={{ fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 24, marginBottom: 6 }}>PRÓXIMAS DATAS</T>
      {lista === null ? (
        <Carregando />
      ) : (
        lista.map((d) => (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.linha }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.interSemi }}>{d.titulo}</T>
              <T style={{ color: C.muted, fontSize: 12.5 }}>
                {d.inicio.split('-').reverse().join('/')}
                {d.fim !== d.inicio ? ` a ${d.fim.split('-').reverse().join('/')}` : ''} · {d.cidade ?? d.uf ?? 'Brasil'}
              </T>
            </View>
            <Mini
              texto="Apagar"
              perigo
              onPress={async () => {
                await apagarDataMovimento(d.id).catch(() => toast('Não foi possível apagar.'));
                carregar();
              }}
            />
          </View>
        ))
      )}
    </View>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
const horas = (h: number | null) => (h === null ? '–' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${String(h).replace('.', ',')} h` : `${Math.round(h / 24)} dias`);

/** Funil do piloto: onde as pessoas param e quanto tempo uma vaga leva para ser preenchida */
function AdminMetricas() {
  const [dias, setDias] = useState(30);
  const [f, setF] = useState<Funil | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    setF(null);
    setErro(false);
    adminFunil(dias).then(setF).catch(() => setErro(true));
  }, [dias]);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[7, 30, 90].map((d) => (
          <Chip key={d} texto={`${d} dias`} ativo={dias === d} onPress={() => setDias(d)} />
        ))}
      </View>
      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
        Cada funil acompanha quem se cadastrou (ou vaga publicada) nos últimos {dias} dias e mostra até onde chegou.
      </T>
      {erro ? (
        <Vazio icone="fechar" texto="Não foi possível carregar as métricas." />
      ) : !f ? (
        <Carregando />
      ) : (
        <>
          <FunilBarras
            titulo="Freelancers"
            etapas={[
              ['Cadastrados', f.freelancers.cadastrados],
              ['Completaram o perfil', f.freelancers.perfil_completo],
              ['Se candidataram', f.freelancers.candidataram],
              ['Foram contratados', f.freelancers.contratados],
              ['Fizeram um turno', f.freelancers.turno_feito],
              ['Fizeram 2 ou mais', f.freelancers.dois_turnos],
            ]}
          />
          <FunilBarras
            titulo="Estabelecimentos"
            etapas={[
              ['Cadastrados', f.estabelecimentos.cadastrados],
              ['Publicaram vaga', f.estabelecimentos.publicaram],
              ['Receberam candidatura', f.estabelecimentos.receberam],
              ['Contrataram', f.estabelecimentos.contrataram],
              ['Publicaram em 2+ semanas', f.estabelecimentos.voltaram],
            ]}
          />
          <T style={st2.secao}>VAGAS</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Num v={f.vagas.publicadas} r="publicadas" />
            <Num v={f.vagas.preenchidas} r={`preenchidas (${pct(f.vagas.preenchidas, f.vagas.publicadas)})`} />
            <Num v={f.vagas.sem_candidatos_vencidas} r="venceram sem candidato" alerta />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Caixa v={horas(f.vagas.horas_ate_candidatura)} r="até a 1ª candidatura (mediana)" />
            <Caixa v={horas(f.vagas.horas_ate_contratacao)} r="até a 1ª contratação (mediana)" />
          </View>
          <T style={st2.secao}>ÚLTIMAS 8 SEMANAS</T>
          {(() => {
            const max = Math.max(1, ...f.semanas.map((w) => Math.max(w.freelancers, w.estabelecimentos, w.contratacoes)));
            return f.semanas.map((w) => (
              <View key={w.semana} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <T style={{ color: C.muted, fontSize: 12, width: 44 }}>{new Date(w.semana).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</T>
                <View style={{ flex: 1, gap: 3 }}>
                  {(
                    [
                      [w.freelancers, C.orange],
                      [w.estabelecimentos, C.cream],
                      [w.contratacoes, C.ok],
                    ] as const
                  ).map(([n, cor], i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: cor, width: `${Math.max(2, (n / max) * 85)}%`, opacity: n ? 1 : 0.25 }} />
                      <T style={{ color: C.muted, fontSize: 11 }}>{n}</T>
                    </View>
                  ))}
                </View>
              </View>
            ));
          })()}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            <Legenda cor={C.orange} t="freelancers novos" />
            <Legenda cor={C.cream} t="casas novas" />
            <Legenda cor={C.ok} t="contratações" />
          </View>
        </>
      )}
    </View>
  );
}

function FunilBarras({ titulo, etapas }: { titulo: string; etapas: [string, number][] }) {
  const topo = etapas[0][1];
  return (
    <View>
      <T style={st2.secao}>{titulo.toUpperCase()}</T>
      {etapas.map(([nome, n], i) => {
        const anterior = i ? etapas[i - 1][1] : n;
        const queda = i > 0 && anterior > 0 && n / anterior < 0.5;
        return (
          <View key={nome} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T style={{ flex: 1, fontSize: 13.5 }}>{nome}</T>
              <T style={{ fontFamily: F.interSemi }}>{n}</T>
              <T style={{ color: queda ? C.bad : C.muted, fontSize: 12, width: 44, textAlign: 'right' }}>{i ? pct(n, anterior) : ''}</T>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#2A201C', marginTop: 4, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${topo ? (n / topo) * 100 : 0}%`, backgroundColor: queda ? C.bad : C.orange }} />
            </View>
          </View>
        );
      })}
      <T style={{ color: C.muted2, fontSize: 11.5 }}>A porcentagem compara com a etapa anterior. Em vermelho: onde mais da metade parou.</T>
    </View>
  );
}

function Caixa({ v, r }: { v: string; r: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 20 }}>{v}</T>
      <T style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{r}</T>
    </View>
  );
}

function Legenda({ cor, t }: { cor: string; t: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 6, borderRadius: 3, backgroundColor: cor }} />
      <T style={{ color: C.muted, fontSize: 11.5 }}>{t}</T>
    </View>
  );
}

const NOME_FB = { problema: 'Problema', sugestao: 'Sugestão', elogio: 'Elogio' } as const;

/** Mensagens enviadas pelo "Fale com o Vora" */
function AdminFeedbacks() {
  const toast = useToast();
  const [status, setStatus] = useState<'novo' | 'visto' | 'resolvido'>('novo');
  const [lista, setLista] = useState<FeedbackAdmin[] | null>(null);
  const carregar = useCallback(() => {
    setLista(null);
    adminFeedbacks(status).then(setLista).catch(() => setLista([]));
  }, [status]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  async function marcar(id: string, s: 'visto' | 'resolvido') {
    setLista((l) => (l ?? []).filter((x) => x.id !== id));
    await marcarFeedback(id, s).catch(() => {
      toast('Não foi possível atualizar.');
      carregar();
    });
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip texto="Novas" ativo={status === 'novo'} onPress={() => setStatus('novo')} />
        <Chip texto="Vistas" ativo={status === 'visto'} onPress={() => setStatus('visto')} />
        <Chip texto="Resolvidas" ativo={status === 'resolvido'} onPress={() => setStatus('resolvido')} />
      </View>
      {lista === null ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio icone="chat" texto="Nenhuma mensagem aqui." />
      ) : (
        <View style={{ gap: 10 }}>
          {lista.map((f) => (
            <View key={f.id} style={{ padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: f.tipo === 'problema' ? '#E5484D66' : C.stroke }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T style={{ fontFamily: F.interSemi, color: f.tipo === 'problema' ? C.bad : f.tipo === 'elogio' ? C.ok : C.orange2 }}>{NOME_FB[f.tipo]}</T>
                <T style={{ color: C.muted, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
                  · {f.autor_nome ?? 'Conta excluída'}
                  {f.autor_tipo ? ` (${f.autor_tipo === 'empresa' ? 'estabelecimento' : 'freelancer'})` : ''} · {tempoRelativo(f.criado_em)}
                </T>
              </View>
              <T style={{ marginTop: 6, lineHeight: 20 }}>{f.texto}</T>
              {f.tela || f.aparelho ? (
                <T style={{ color: C.muted2, fontSize: 11.5, marginTop: 6 }} numberOfLines={2}>
                  {[f.tela && `tela: ${f.tela}`, f.aparelho].filter(Boolean).join(' · ')}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {f.autor_id ? <Mini texto="Ver perfil" onPress={() => router.push(f.autor_tipo === 'empresa' ? `/estabelecimento/${f.autor_id}` : `/freela/${f.autor_id}`)} /> : null}
                {status === 'novo' ? <Mini texto="Marcar como vista" onPress={() => marcar(f.id, 'visto')} /> : null}
                {status !== 'resolvido' ? <Mini texto="Resolvida" onPress={() => marcar(f.id, 'resolvido')} /> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st2 = { secao: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 22, marginBottom: 10 } as const };
