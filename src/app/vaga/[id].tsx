import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { FolhaConvidar, FolhaDenunciar, LinhaReputacao } from '@/components/acoes';
import { Selos } from '@/components/selos';
import { CartaoVolta } from '@/components/volta';
import { CamposInstrucoes, CartaoInstrucoes, paraForm, type FormInstrucoes } from '@/components/instrucoes';
import { FolhaAvaliar, NotaResumo, type AlvoAvaliacao } from '@/components/avaliacao';
import { SeloUrgente } from '@/components/cartoes';
import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, BotaoIcone, Botao, Campo, Carregando, Folha, T, Tag, Tela, Topo, useToast, Vazio } from '@/components/ui';
import {
  TRANSPORTE,
  abrirConversa,
  alternarSalvo,
  buscarVaga,
  candidatar,
  candidatosDaVaga,
  alternarSubstituto,
  termoDaCandidatura,
  termosDaVaga,
  instrucoesDaVaga,
  repetirVaga,
  salvarInstrucoes,
  turnosDaEscala,
  confirmarPresenca,
  mudarQuantidade,
  convitesDaVaga,
  duracao,
  horaCurta,
  registrarPresenca,
  definirStatus,
  idsBloqueados,
  listarFavoritos,
  retirarConvite,
  enviarMensagem,
  encerrarVaga,
  faixaSalarial,
  idsSalvos,
  minhaCandidatura,
  quandoComeca,
  totalCandidaturas,
  urgenteAtiva,
  type Candidatura,
  type Instrucoes,
  type TurnoDaEscala,
  type Convite,
  type Favorito,
  type Vaga,
  fotoUrl,
} from '@/lib/api';
import { distanciaAte, fmtDistancia, useLocalizacao } from '@/lib/localizacao';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function DetalheVaga() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSessao();
  const { ponto } = useLocalizacao();
  const toast = useToast();
  const [vaga, setVaga] = useState<Vaga | null | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [minha, setMinha] = useState<Candidatura | null>(null);
  const [salva, setSalva] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidatura[]>([]);
  const [folha, setFolha] = useState<'candidatar' | 'encerrar' | 'desistir' | 'favoritos' | 'repetir' | null>(null);
  const [gerir, setGerir] = useState<{ c: Candidatura; acao: 'falta' | 'cancelar' } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [convites, setConvites] = useState<Convite[]>([]);
  const [favoritos, setFavoritos] = useState<Favorito[] | null>(null);
  const [convidar, setConvidar] = useState<{ id: string; nome: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [presenca, setPresenca] = useState<string | null>(null); // id em andamento
  const [instr, setInstr] = useState<Instrucoes | null>(null);
  const [formInstr, setFormInstr] = useState<FormInstrucoes | null>(null);
  const [escala, setEscala] = useState<TurnoDaEscala[]>([]);
  const [repetindo, setRepetindo] = useState(false);
  const [termo, setTermo] = useState<{ id: string; aceite_freela_em: string | null } | null>(null); // freelancer
  const [termos, setTermos] = useState<Map<string, { id: string; aceite_freela_em: string | null }>>(new Map()); // dono
  const [avaliar, setAvaliar] = useState<AlvoAvaliacao | null>(null);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const dono = !!vaga && vaga.empresa_id === perfil?.id;
  const empresa = perfil?.tipo === 'empresa';

  useFocusEffect(
    useCallback(() => {
      if (!perfil || !id) return;
      (async () => {
        try {
          const v = await buscarVaga(id);
          setVaga(v);
          if (!v) return;
          const dono = v.empresa_id === perfil.id;
          const freela = perfil.tipo === 'freelancer';
          const [t, cands, minhaC, salvos, convs, bloq, ins, serie] = await Promise.all([
            totalCandidaturas(id),
            dono ? candidatosDaVaga(id) : Promise.resolve([]),
            freela ? minhaCandidatura(id, perfil.id) : Promise.resolve(null),
            freela ? idsSalvos(perfil.id) : Promise.resolve(new Set<string>()),
            dono ? convitesDaVaga(id).catch(() => []) : Promise.resolve([]),
            !dono ? idsBloqueados(perfil.id).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
            instrucoesDaVaga(id).catch(() => null), // só dono e contratados conseguem ler
            dono && v.serie_id ? turnosDaEscala(v.serie_id).catch(() => []) : Promise.resolve([]),
          ]);
          setInstr(ins);
          setEscala(serie);
          if (dono) termosDaVaga(id).then(setTermos).catch(() => {});
          if (minhaC?.status === 'contratado') termoDaCandidatura(minhaC.id).then(setTermo).catch(() => {});
          setConvites(convs);
          setBloqueado(bloq.has(v.empresa_id));
          setTotal(t);
          setCandidatos(cands);
          setMinha(minhaC);
          setSalva(salvos.has(id));
        } catch {
          setVaga(null);
        }
      })();
    }, [id, perfil])
  );

  async function enviarCandidatura() {
    if (!vaga || !perfil) return;
    setEnviando(true);
    try {
      await candidatar(vaga.id, perfil.id, mensagem.trim());
      // abre a conversa com a empresa já com a apresentação
      const conversa = await abrirConversa(vaga.empresa_id);
      await enviarMensagem(conversa, `Olá! Acabei de me candidatar à vaga de ${vaga.titulo}.${mensagem.trim() ? ' ' + mensagem.trim() : ''}`);
      setMinha(await minhaCandidatura(vaga.id, perfil.id));
      setTotal((t) => t + 1);
      setFolha(null);
      setMensagem('');
      toast('Candidatura enviada!');
    } catch (e) {
      toast((e as Error).message.includes('duplicate') ? 'Você já se candidatou a esta vaga.' : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarSalva() {
    if (!perfil || !vaga) return;
    const nova = !salva;
    setSalva(nova);
    toast(nova ? 'Vaga salva' : 'Vaga removida dos salvos');
    await alternarSalvo(perfil.id, vaga.id, nova).catch(() => setSalva(!nova));
  }

  async function decidir(c: Candidatura, status: 'contratado' | 'recusado' | 'pendente') {
    if (!vaga) return;
    setDecidindo(c.id);
    try {
      await definirStatus(c.id, status);
      setCandidatos((l) => l.map((x) => (x.id === c.id ? { ...x, status } : x)));
      recarregarVaga();
      if (status === 'contratado' && c.status !== 'falta') {
        // avisa o freelancer pelo chat
        const conversa = await abrirConversa(c.freelancer_id);
        await enviarMensagem(conversa, `Olá, ${c.freelancer?.nome?.split(' ')[0] ?? ''}! Você foi contratado(a) para "${vaga.titulo}". Vamos combinar os detalhes por aqui?`);
        toast('Contratado! Avisamos pelo chat.');
      } else if (status === 'recusado') toast('Candidatura recusada');
    } catch (e) {
      toast((e as Error).message || 'Não foi possível atualizar. Tente de novo.');
    } finally {
      setDecidindo(null);
    }
  }

  /** Falta ou cancelamento depois de contratar (contratante) */
  async function confirmarGerir() {
    if (!gerir || !vaga) return;
    const { c, acao } = gerir;
    const status = acao === 'falta' ? 'falta' : 'cancelado_empresa';
    setDecidindo(c.id);
    try {
      await definirStatus(c.id, status, motivo);
      const conversa = await abrirConversa(c.freelancer_id).catch(() => null);
      if (conversa)
        await enviarMensagem(
          conversa,
          acao === 'falta'
            ? `Registramos falta no turno de "${vaga.titulo}".${motivo.trim() ? ' ' + motivo.trim() : ''}`
            : `Precisamos cancelar sua contratação para "${vaga.titulo}". Desculpe o transtorno.${motivo.trim() ? ' Motivo: ' + motivo.trim() : ''}`
        ).catch(() => {});
      await recarregarCandidatos();
      toast(acao === 'falta' ? 'Falta registrada.' : 'Contratação cancelada. Avisamos pelo chat.');
      setGerir(null);
      setMotivo('');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setDecidindo(null);
    }
  }

  /** Freelancer desiste depois de contratado */
  async function desistir() {
    if (!minha || !vaga || !perfil) return;
    setEnviando(true);
    try {
      await definirStatus(minha.id, 'cancelado_freela', motivo);
      const conversa = await abrirConversa(vaga.empresa_id).catch(() => null);
      if (conversa) await enviarMensagem(conversa, `Infelizmente não vou poder trabalhar em "${vaga.titulo}".${motivo.trim() ? ' ' + motivo.trim() : ''} Desculpe o transtorno.`).catch(() => {});
      setMinha(await minhaCandidatura(vaga.id, perfil.id));
      setFolha(null);
      setMotivo('');
      toast('Participação cancelada. Avisamos o estabelecimento.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  /** Freelancer: check-in/check-out com o GPS do celular */
  async function marcarPresenca(tipo: 'entrada' | 'saida') {
    if (!minha || !vaga || !perfil) return;
    setPresenca(minha.id);
    try {
      let ponto: { lat: number; lng: number } | null = null;
      if (vaga.empresa?.lat != null) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) throw new Error('Permita o acesso à localização para registrar sua presença no local.');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        ponto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      await registrarPresenca(minha.id, tipo, ponto);
      setMinha(await minhaCandidatura(vaga.id, perfil.id));
      toast(tipo === 'entrada' ? 'Check-in feito! Bom trabalho.' : 'Saída registrada. Obrigado!');
    } catch (e) {
      toast((e as Error).message || 'Não foi possível registrar agora.');
    } finally {
      setPresenca(null);
    }
  }

  /** Contratante: confirma chegada/saída manualmente */
  async function confirmar(c: Candidatura, tipo: 'entrada' | 'saida') {
    setPresenca(c.id);
    try {
      await confirmarPresenca(c.id, tipo);
      await recarregarCandidatos();
      toast(tipo === 'entrada' ? 'Chegada confirmada.' : 'Saída confirmada.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPresenca(null);
    }
  }

  async function gravarInstrucoes() {
    if (!vaga || !formInstr) return;
    try {
      await salvarInstrucoes([vaga.id], formInstr);
      setInstr(await instrucoesDaVaga(vaga.id));
      setFormInstr(null);
      toast('Informações salvas. Os contratados já veem.');
    } catch {
      toast('Não foi possível salvar.');
    }
  }

  async function repetir(convidar: boolean) {
    if (!vaga) return;
    setRepetindo(true);
    try {
      const r = await repetirVaga(vaga.id, convidar);
      setFolha(null);
      toast(r.convidados ? `Turno criado! Convidamos ${r.convidados} pessoa(s) da equipe.` : 'Turno da próxima semana criado!');
      router.push(`/vaga/${r.id}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setRepetindo(false);
    }
  }

  async function abrirFavoritos() {
    if (!perfil) return;
    setFolha('favoritos');
    setFavoritos(null);
    listarFavoritos(perfil.id).then(setFavoritos).catch(() => setFavoritos([]));
  }

  async function recarregarVaga() {
    if (!vaga) return;
    const v = await buscarVaga(vaga.id).catch(() => null);
    if (v) setVaga(v);
  }

  async function mudarQtd(n: number) {
    if (!vaga || n < 1 || n > 50) return;
    try {
      await mudarQuantidade(vaga.id, n);
      await recarregarVaga();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function recarregarCandidatos() {
    if (vaga) setCandidatos(await candidatosDaVaga(vaga.id));
    recarregarVaga();
  }

  async function conversarCom(outroId: string, nome: string) {
    const conversa = await abrirConversa(outroId);
    router.push({ pathname: '/chat/[id]', params: { id: conversa, nome } });
  }

  if (vaga === undefined) return <Carregando clara />;
  if (vaga === null)
    return (
      <Tela clara>
        <Topo clara />
        <Vazio texto="Esta vaga não existe mais ou foi encerrada." />
      </Tela>
    );

  return (
    <Tela clara>
      <Topo
        clara
        direita={
          <>
            <BotaoIcone
              nome="compartilhar"
              cor={C.ink}
              rotulo="Compartilhar"
              onPress={() => Share.share({ message: `${vaga.titulo} — ${vaga.empresa?.nome} (${vaga.modalidade}, ${faixaSalarial(vaga)}). Veja no Vora.` }).catch(() => {})}
            />
            {!empresa ? <BotaoIcone nome="salvar" cor={C.ink} preenchido={salva} rotulo="Salvar vaga" onPress={alternarSalva} /> : null}
            {!dono ? <BotaoIcone nome="opcoes" cor={C.ink} rotulo="Mais opções" onPress={() => setMenu(true)} /> : null}
          </>
        }
      />
      <Pressable style={st.cab} onPress={() => router.push(`/estabelecimento/${vaga.empresa_id}`)}>
        <Avatar nome={vaga.empresa?.nome ?? '?'} tamanho={66} quadrado foto={fotoUrl(vaga.empresa)} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 19 }}>{vaga.empresa?.nome}</T>
            {vaga.empresa?.verificado ? (
              <View style={st.verif}>
                <Icone nome="check" tamanho={11} cor="#fff" espessura={3} />
              </View>
            ) : null}
          </View>
          <T style={{ color: C.ink2, fontSize: 13.5, marginTop: 4 }}>
            {vaga.empresa?.titulo} · {vaga.empresa?.cidade}, {vaga.empresa?.uf}
          </T>
          <View style={{ marginTop: 4 }}>
            <NotaResumo media={vaga.empresa?.nota_media} total={vaga.empresa?.nota_total} claro />
          </View>
        </View>
        <Icone nome="seta" tamanho={16} cor="#7A6A61" />
      </Pressable>

      {urgenteAtiva(vaga) ? (
        <View style={{ paddingHorizontal: 22, marginTop: 6 }}>
          <SeloUrgente inicio={vaga.inicio_em!} />
        </View>
      ) : null}
      <T style={[st.titulo, urgenteAtiva(vaga) && { paddingTop: 12 }]}>{vaga.titulo}</T>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 22, flexWrap: 'wrap' }}>
        <Tag texto={vaga.modalidade} />
        <Tag texto={vaga.contrato} />
        <Tag texto={vaga.nivel} />
      </View>
      <T style={st.desc}>{vaga.descricao}</T>
      {vaga.requisitos.length ? (
        <View style={{ paddingHorizontal: 22, paddingTop: 10, gap: 4 }}>
          {vaga.requisitos.map((r) => (
            <T key={r} style={{ color: '#3B2F29', lineHeight: 24 }}>
              •  {r}
            </T>
          ))}
        </View>
      ) : null}

      <View style={st.hr} />
      <View style={{ paddingHorizontal: 22 }}>
        {vaga.inicio_em ? <Meta icone={vaga.urgente ? 'raio' : 'relogio'} texto={`Começa ${quandoComeca(vaga.inicio_em)}`} /> : null}
        <Meta icone="relogio" texto={vaga.completa ? 'Equipe completa' : vaga.ativa ? `Publicada ${tempoRelativo(vaga.criado_em)}` : 'Vaga encerrada'} />
        <Meta
          icone="local"
          texto={(() => {
            const km = distanciaAte(ponto, vaga.empresa);
            return km != null ? `${fmtDistancia(km).replace(/^a /, 'A ')} de você · ${vaga.empresa?.cidade}, ${vaga.empresa?.uf}` : `${vaga.empresa?.cidade}, ${vaga.empresa?.uf}`;
          })()}
        />
        <Meta icone="dinheiro" texto={faixaSalarial(vaga)} />
        <Meta icone="maleta" texto={vaga.duracao} />
        {vaga.transporte && vaga.transporte !== 'nao_informado' ? <Meta icone="carro" texto={TRANSPORTE[vaga.transporte].longo} /> : null}
        <Meta icone="pessoas" texto={`${total} candidatura${total === 1 ? '' : 's'}`} />
      </View>

      {vaga.quantidade > 1 || dono ? (
        <View style={st.lotacao}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 15.5 }}>
              Equipe: {vaga.contratados} de {vaga.quantidade} {vaga.quantidade === 1 ? 'pessoa' : 'pessoas'}
            </T>
            {dono ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable onPress={() => mudarQtd(vaga.quantidade - 1)} style={st.passo} accessibilityLabel="Precisa de uma pessoa a menos">
                  <T style={{ color: C.ink, fontSize: 18, fontFamily: F.interSemi }}>−</T>
                </Pressable>
                <Pressable onPress={() => mudarQtd(vaga.quantidade + 1)} style={st.passo} accessibilityLabel="Precisa de mais uma pessoa">
                  <T style={{ color: C.ink, fontSize: 18, fontFamily: F.interSemi }}>+</T>
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EADBCF', marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (vaga.contratados / vaga.quantidade) * 100)}%`, height: 8, backgroundColor: vaga.completa ? '#1F7A4C' : C.orange }} />
          </View>
          <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 8 }}>
            {vaga.completa
              ? dono
                ? 'Equipe completa: a vaga saiu da busca. Se alguém cancelar, ela reabre sozinha.'
                : 'Equipe completa.'
              : `Faltam ${vaga.quantidade - vaga.contratados} ${vaga.quantidade - vaga.contratados === 1 ? 'pessoa' : 'pessoas'}.`}
          </T>
          {dono ? (
            <Pressable
              onPress={async () => {
                const novo = !vaga.substituto_auto;
                setVaga({ ...vaga, substituto_auto: novo });
                await alternarSubstituto(vaga.id, novo).catch(() => setVaga({ ...vaga }));
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <View style={[st.caixa, vaga.substituto_auto && { backgroundColor: C.orange, borderColor: C.orange }]}>
                {vaga.substituto_auto ? <Icone nome="check" tamanho={13} cor={C.onOrange} espessura={3} /> : null}
              </View>
              <T style={{ color: C.ink2, fontSize: 13.5, flex: 1 }}>Substituto automático se alguém cancelar</T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {dono || (minha?.status === 'contratado' && instr) ? (
        <View style={st.lotacao}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: instr ? 12 : 0 }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 15.5 }}>{dono ? 'Informações para a equipe' : 'O que levar no turno'}</T>
            {dono ? (
              <T style={{ color: C.orange, fontFamily: F.interSemi }} onPress={() => setFormInstr(paraForm(instr))}>
                {instr ? 'Editar' : 'Adicionar'}
              </T>
            ) : null}
          </View>
          {instr ? (
            <CartaoInstrucoes i={instr} clara />
          ) : (
            <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 6 }}>Traje, o que levar e onde entrar. Só os contratados veem.</T>
          )}
        </View>
      ) : null}

      {dono && escala.length > 1 ? (
        <View style={st.lotacao}>
          <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 15.5, marginBottom: 10 }}>Escala · {escala.length} turnos</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {escala.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => t.id !== vaga.id && router.push(`/vaga/${t.id}`)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: t.id === vaga.id ? C.orange : '#E3D2C4',
                  backgroundColor: t.completa ? '#E6F4EC' : '#fff',
                }}>
                <T style={{ color: C.ink, fontSize: 12.5, fontFamily: F.interSemi }}>
                  {t.inicio_em ? new Date(t.inicio_em).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—'}
                </T>
                <T style={{ color: '#7A6A61', fontSize: 11.5 }}>
                  {t.contratados}/{t.quantidade}
                  {t.completa ? ' ✓' : ''}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {dono ? (
        <>
          <View style={st.hr} />
          <T style={{ color: C.ink, fontFamily: F.interMed, fontSize: 18, paddingHorizontal: 22, marginBottom: 10 }}>Candidatos</T>
          <View style={{ paddingHorizontal: 22, gap: 10 }}>
            {candidatos.length ? (
              candidatos.map((c) => (
                <View key={c.id} style={[st.cand, ['recusado', 'cancelado_freela', 'cancelado_empresa'].includes(c.status) && { opacity: 0.6 }]}>
                  <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} onPress={() => router.push(`/freela/${c.freelancer_id}`)}>
                    <Avatar nome={c.freelancer?.nome ?? '?'} tamanho={42} foto={fotoUrl(c.freelancer)} />
                    <View style={{ flex: 1 }}>
                      <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 14.5 }}>{c.freelancer?.nome}</T>
                      <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>
                        {c.freelancer?.titulo} · {c.freelancer?.cidade}, {c.freelancer?.uf} · {tempoRelativo(c.criado_em)}
                      </T>
                      <View style={{ marginTop: 4 }}>
                        <NotaResumo media={c.freelancer?.nota_media} total={c.freelancer?.nota_total} claro />
                      </View>
                      {c.freelancer?.selos?.length ? (
                        <View style={{ marginTop: 4 }}>
                          <Selos selos={c.freelancer.selos} compacto />
                        </View>
                      ) : null}
                      {c.freelancer?.faltas || c.freelancer?.cancelamentos ? (
                        <View style={{ marginTop: 3 }}>
                          <LinhaReputacao faltas={c.freelancer.faltas} cancelamentos={c.freelancer.cancelamentos} clara />
                        </View>
                      ) : null}
                    </View>
                    <Icone nome="seta" tamanho={16} cor="#7A6A61" />
                  </Pressable>
                  {c.mensagem ? <T style={{ color: C.ink2, fontSize: 13, marginTop: 8, lineHeight: 18 }}>“{c.mensagem}”</T> : null}
                  {c.status === 'contratado' && termos.get(c.id) ? (
                    <Pressable onPress={() => router.push(`/termo/${termos.get(c.id)!.id}`)} style={[st.presenca, { marginTop: 8 }]}>
                      <Icone nome="arquivo" tamanho={16} cor={termos.get(c.id)!.aceite_freela_em ? '#1F7A4C' : '#7A6A61'} />
                      <T style={{ color: C.ink2, fontSize: 13, flex: 1 }}>{termos.get(c.id)!.aceite_freela_em ? 'Termo de serviço aceito' : 'Termo de serviço aguardando aceite'}</T>
                      <T style={{ color: C.orange, fontSize: 12.5, fontFamily: F.interSemi }}>Ver</T>
                    </Pressable>
                  ) : null}
                  {c.status === 'contratado' && (c.checkin_em || !vaga.inicio_em || new Date(vaga.inicio_em).getTime() - 2 * 3600e3 <= Date.now()) ? (
                    <View style={st.presenca}>
                      <Icone nome="local" tamanho={16} cor={c.checkin_em ? '#1F7A4C' : '#7A6A61'} />
                      <T style={{ color: C.ink2, fontSize: 13, flex: 1 }}>
                        {c.checkin_em
                          ? `Chegou ${horaCurta(c.checkin_em)}${c.presenca_por === 'estabelecimento' ? ' (confirmado por você)' : c.checkin_dist_m != null ? ` · a ${c.checkin_dist_m} m` : ''}${
                              c.checkout_em ? ` · saiu ${horaCurta(c.checkout_em)} · ${duracao(c.checkin_em, c.checkout_em)}` : ' · trabalhando'
                            }`
                          : 'Ainda não fez check-in'}
                      </T>
                      {!c.checkin_em || !c.checkout_em ? (
                        <Pressable style={st.miniClaro} disabled={presenca === c.id} onPress={() => confirmar(c, c.checkin_em ? 'saida' : 'entrada')}>
                          <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: C.ink }}>{presenca === c.id ? '...' : c.checkin_em ? 'Confirmar saída' : 'Confirmar chegada'}</T>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={st.candAcoes}>
                    {c.status === 'pendente' ? (
                      <>
                        <Pressable style={[st.mini, { backgroundColor: C.orange }]} disabled={decidindo === c.id} onPress={() => decidir(c, 'contratado')}>
                          <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.onOrange }}>{decidindo === c.id ? '...' : 'Contratar'}</T>
                        </Pressable>
                        <Pressable style={st.miniClaro} disabled={decidindo === c.id} onPress={() => decidir(c, 'recusado')}>
                          <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.ink }}>Recusar</T>
                        </Pressable>
                      </>
                    ) : c.status === 'contratado' ? (
                      <>
                        <View style={st.selo}>
                          <Icone nome="check" tamanho={14} cor={C.ok} espessura={2.6} />
                          <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: '#1F7A4C' }}>Contratado</T>
                        </View>
                        <Pressable
                          style={[st.mini, { backgroundColor: C.orange }]}
                          onPress={() =>
                            setAvaliar({
                              candidatura_id: c.id,
                              vaga_id: vaga.id,
                              vaga_titulo: vaga.titulo,
                              empresa_id: vaga.empresa_id,
                              freelancer_id: c.freelancer_id,
                              direcao: 'empresa_para_freela',
                              alvo_nome: c.freelancer?.nome ?? 'freelancer',
                              existente: c.avaliacao,
                            })
                          }>
                          <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.onOrange }}>{c.avaliacao ? `★ ${c.avaliacao.nota} · Editar` : 'Avaliar'}</T>
                        </Pressable>
                        {!c.checkin_em && (!vaga.inicio_em || new Date(vaga.inicio_em).getTime() <= Date.now()) ? (
                          <Pressable style={st.miniClaro} onPress={() => (setMotivo(''), setGerir({ c, acao: 'falta' }))}>
                            <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.ink }}>Faltou</T>
                          </Pressable>
                        ) : null}
                        {!c.checkin_em ? (
                          <Pressable style={st.miniClaro} onPress={() => (setMotivo(''), setGerir({ c, acao: 'cancelar' }))}>
                            <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.ink }}>Cancelar</T>
                          </Pressable>
                        ) : null}
                      </>
                    ) : c.status === 'falta' ? (
                      <>
                        <View style={[st.selo, { backgroundColor: '#FDE7E7' }]}>
                          <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: '#B23B3B' }}>Faltou</T>
                        </View>
                        <Pressable style={st.miniClaro} disabled={decidindo === c.id} onPress={() => decidir(c, 'contratado')}>
                          <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.ink }}>Desfazer</T>
                        </Pressable>
                      </>
                    ) : c.status === 'cancelado_freela' || c.status === 'cancelado_empresa' ? (
                      <View style={[st.selo, { backgroundColor: '#F1E6DD' }]}>
                        <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: C.ink2 }}>
                          {c.status === 'cancelado_freela' ? 'Freelancer cancelou' : 'Você cancelou'}
                          {c.ultima_hora ? ' · em cima da hora' : ''}
                        </T>
                      </View>
                    ) : (
                      <Pressable style={st.miniClaro} onPress={() => decidir(c, 'pendente')}>
                        <T style={{ fontSize: 13, fontFamily: F.interSemi, color: C.ink }}>Recusado · desfazer</T>
                      </Pressable>
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable style={st.mini} onPress={() => conversarCom(c.freelancer_id, c.freelancer?.nome ?? 'Freelancer')}>
                      <T style={{ fontSize: 13, fontFamily: F.interSemi }}>Conversar</T>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <T style={{ color: '#7A6A61' }}>Ainda sem candidatos.</T>
            )}
          </View>
          {convites.length ? (
            <>
              <T style={{ color: C.ink, fontFamily: F.interMed, fontSize: 18, paddingHorizontal: 22, marginTop: 22, marginBottom: 10 }}>Convidados</T>
              <View style={{ paddingHorizontal: 22, gap: 8 }}>
                {convites.map((cv) => (
                  <View key={cv.id} style={[st.cand, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                    <Avatar nome={cv.freelancer?.nome ?? '?'} tamanho={36} foto={fotoUrl(cv.freelancer)} />
                    <T style={{ color: C.ink, flex: 1, fontFamily: F.interMed }} numberOfLines={1}>
                      {cv.freelancer?.nome}
                    </T>
                    <T style={{ color: cv.status === 'aceito' ? '#1F7A4C' : '#7A6A61', fontSize: 12.5, fontFamily: F.interSemi }}>
                      {cv.status === 'aceito' ? 'Aceitou' : cv.status === 'recusado' ? 'Recusou' : 'Aguardando'}
                    </T>
                    {cv.status === 'pendente' ? (
                      <Pressable
                        hitSlop={8}
                        onPress={async () => {
                          await retirarConvite(cv.id).catch(() => {});
                          setConvites((l) => l.filter((x) => x.id !== cv.id));
                        }}>
                        <Icone nome="fechar" tamanho={16} cor="#7A6A61" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}
          <View style={st.acoes}>
            {vaga.ativa ? <Botao titulo="Convidar favoritos" icone="estrela" onPress={abrirFavoritos} /> : null}
            {vaga.inicio_em ? <Botao titulo="Repetir na próxima semana" icone="relogio" variante="contornoEscuro" onPress={() => setFolha('repetir')} /> : null}
            {vaga.ativa ? <Botao titulo="Encerrar vaga" icone="lixo" variante="contornoEscuro" onPress={() => setFolha('encerrar')} /> : null}
          </View>
        </>
      ) : empresa ? (
        <T style={{ color: '#7A6A61', textAlign: 'center', padding: 22, fontSize: 13.5 }}>Você está vendo como empresa. Para se candidatar, use uma conta de freelancer.</T>
      ) : (
        <View style={st.acoes}>
          {minha?.status === 'contratado' ? (
            <>
              <Botao titulo="Você foi contratado(a)! 🎉" icone="check" variante="feito" desativado />
              {(() => {
                const ini = vaga.inicio_em ? new Date(vaga.inicio_em).getTime() : null;
                const abre = ini === null || Date.now() >= ini - 2 * 3600e3;
                const fechou = ini !== null && Date.now() > ini + 12 * 3600e3 && !minha.checkin_em;
                return (
                  <View style={st.turno}>
                    <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 15.5 }}>
                      {minha.checkout_em ? 'Turno concluído ✓' : minha.checkin_em ? 'Turno em andamento' : 'Presença no turno'}
                    </T>
                    <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                      {minha.checkout_em && minha.checkin_em
                        ? `Entrada ${horaCurta(minha.checkin_em)} · saída ${horaCurta(minha.checkout_em)} · ${duracao(minha.checkin_em, minha.checkout_em)}`
                        : minha.checkin_em
                          ? `Check-in às ${horaCurta(minha.checkin_em)}. Registre a saída quando terminar.`
                          : fechou
                            ? 'O prazo para check-in deste turno passou.'
                            : abre
                              ? 'Ao chegar no local, faça o check-in. Usamos o GPS só para conferir que você está lá, sem guardar sua posição.'
                              : `O check-in abre 2 horas antes do início (${quandoComeca(vaga.inicio_em!)}).`}
                    </T>
                    {!minha.checkout_em && !fechou && abre ? (
                      <Botao
                        titulo={minha.checkin_em ? 'Encerrar turno' : 'Cheguei · fazer check-in'}
                        icone="local"
                        variante={minha.checkin_em ? 'contornoEscuro' : 'pri'}
                        carregando={presenca === minha.id}
                        onPress={() => marcarPresenca(minha.checkin_em ? 'saida' : 'entrada')}
                        estilo={{ marginTop: 12 }}
                      />
                    ) : null}
                  </View>
                );
              })()}
              {termo ? (
                <Pressable onPress={() => router.push(`/termo/${termo.id}`)} style={[st.turno, { borderColor: termo.aceite_freela_em ? '#E3D2C4' : C.orange, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <Icone nome="arquivo" cor={termo.aceite_freela_em ? '#1F7A4C' : C.orange} />
                  <View style={{ flex: 1 }}>
                    <T style={{ color: C.ink, fontFamily: F.interSemi }}>Termo de prestação de serviço</T>
                    <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 2 }}>{termo.aceite_freela_em ? 'Aceito ✓ · toque para ver' : 'Leia e aceite antes do turno'}</T>
                  </View>
                  <Icone nome="seta" tamanho={16} cor="#7A6A61" />
                </Pressable>
              ) : null}
              {(() => {
                const ini = vaga.inicio_em ? new Date(vaga.inicio_em).getTime() : null;
                const mostrar = !!minha.checkin_em || ini === null || (Date.now() >= ini - 3 * 3600e3 && Date.now() < ini + 30 * 3600e3);
                return mostrar ? <CartaoVolta vaga={vaga} minha={minha} aoMudar={setMinha} /> : null;
              })()}
              {!minha.checkin_em ? <Botao titulo="Não vou poder ir" variante="fantasma" onPress={() => (setMotivo(''), setFolha('desistir'))} /> : null}
              <Botao
                titulo={minha.avaliacao ? `Sua avaliação: ★ ${minha.avaliacao.nota} · Editar` : 'Avaliar este estabelecimento'}
                icone="estrela"
                variante="contornoEscuro"
                onPress={() =>
                  setAvaliar({
                    direcao: 'freela_para_empresa',
                    candidatura_id: minha.id,
                    vaga_id: vaga.id,
                    vaga_titulo: vaga.titulo,
                    empresa_id: vaga.empresa_id,
                    freelancer_id: perfil!.id,
                    alvo_nome: vaga.empresa?.nome ?? 'estabelecimento',
                    existente: minha.avaliacao,
                  })
                }
              />
            </>
          ) : minha?.status === 'cancelado_freela' ? (
            <Botao titulo="Você cancelou sua participação" variante="fantasma" desativado />
          ) : minha?.status === 'cancelado_empresa' ? (
            <Botao titulo="O estabelecimento cancelou a contratação" variante="fantasma" desativado />
          ) : minha?.status === 'falta' ? (
            <>
              <Botao titulo="O estabelecimento registrou falta" variante="fantasma" desativado />
              <T style={{ color: '#7A6A61', fontSize: 13, textAlign: 'center' }}>Se isso estiver errado, converse com o estabelecimento ou toque em ⋯ para denunciar.</T>
            </>
          ) : bloqueado && !minha ? (
            <Botao titulo="Você bloqueou este estabelecimento" variante="fantasma" desativado />
          ) : minha?.status === 'recusado' ? (
            <Botao titulo="Candidatura não selecionada desta vez" variante="fantasma" desativado />
          ) : minha ? (
            <Botao titulo={`Candidatura enviada ${tempoRelativo(minha.criado_em)}`} icone="check" variante="feito" desativado />
          ) : (
            <Botao titulo={vaga.completa ? 'Vaga preenchida' : vaga.ativa ? 'Candidatar-se' : 'Vaga encerrada'} onPress={() => setFolha('candidatar')} desativado={!vaga.ativa} />
          )}
          <Botao titulo={salva ? 'Vaga salva' : 'Salvar vaga'} icone="salvar" variante="contornoEscuro" onPress={alternarSalva} />
        </View>
      )}

      <FolhaAvaliar
        alvo={avaliar}
        aoFechar={() => setAvaliar(null)}
        aoSalvar={async () => {
          if (dono) await recarregarCandidatos();
          else if (perfil && vaga) setMinha(await minhaCandidatura(vaga.id, perfil.id));
        }}
      />

      <Folha visivel={folha === 'candidatar'} aoFechar={() => setFolha(null)} titulo={`Candidatar-se a ${vaga.titulo}`}>
        <T style={{ color: C.muted, lineHeight: 20 }}>
          A {vaga.empresa?.nome} verá seu nome, título profissional, cidade/UF e seu perfil de serviço. CPF, e-mail, telefone e endereço não são compartilhados.
        </T>
        <Campo rotulo="Mensagem para a empresa (opcional)" valor={mensagem} aoMudar={setMensagem} multiline maxLength={600} placeholder="Conte por que você é uma boa escolha para este projeto." />
        <Botao titulo="Enviar candidatura" onPress={enviarCandidatura} carregando={enviando} estilo={{ marginTop: 18 }} />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setFolha(null)} />
      </Folha>

      <Folha visivel={folha === 'encerrar'} aoFechar={() => setFolha(null)} titulo="Encerrar esta vaga?">
        <T style={{ color: C.muted, lineHeight: 20 }}>Ela deixa de aparecer nas buscas. Os candidatos continuam na sua lista.</T>
        <Botao
          titulo="Encerrar vaga"
          estilo={{ marginTop: 18 }}
          onPress={async () => {
            await encerrarVaga(vaga.id).catch(() => {});
            setFolha(null);
            setVaga({ ...vaga, ativa: false });
            toast('Vaga encerrada');
          }}
        />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setFolha(null)} />
      </Folha>
      <Folha visivel={!!gerir} aoFechar={() => setGerir(null)} titulo={gerir?.acao === 'falta' ? 'Registrar falta?' : 'Cancelar contratação?'}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          {gerir?.acao === 'falta'
            ? `${gerir?.c.freelancer?.nome?.split(' ')[0] ?? 'O freelancer'} não apareceu no turno? A falta fica registrada no perfil e ajuda outros estabelecimentos. Use só quando a pessoa realmente não veio.`
            : 'O cancelamento fica registrado no perfil do seu estabelecimento. Cancelamentos com menos de 24h do início aparecem como “em cima da hora”.'}
        </T>
        <Campo rotulo="Motivo (opcional)" valor={motivo} aoMudar={setMotivo} multiline maxLength={300} />
        <Botao titulo={gerir?.acao === 'falta' ? 'Registrar falta' : 'Cancelar contratação'} variante="perigo" carregando={!!gerir && decidindo === gerir.c.id} onPress={confirmarGerir} estilo={{ marginTop: 18 }} />
        <Botao titulo="Voltar" variante="fantasma" onPress={() => setGerir(null)} />
      </Folha>

      <Folha visivel={folha === 'desistir'} aoFechar={() => setFolha(null)} titulo="Cancelar sua participação?">
        <T style={{ color: C.muted, lineHeight: 21 }}>
          {vaga.inicio_em && new Date(vaga.inicio_em).getTime() - Date.now() < 24 * 3600 * 1000
            ? 'Faltam menos de 24 horas para o início. O cancelamento vai aparecer como “em cima da hora” no seu perfil.'
            : 'O cancelamento fica registrado no seu perfil. Avise o quanto antes para o estabelecimento achar outra pessoa.'}
        </T>
        <Campo rotulo="Motivo (opcional)" valor={motivo} aoMudar={setMotivo} multiline maxLength={300} />
        <Botao titulo="Cancelar participação" variante="perigo" carregando={enviando} onPress={desistir} estilo={{ marginTop: 18 }} />
        <Botao titulo="Voltar" variante="fantasma" onPress={() => setFolha(null)} />
      </Folha>

      <Folha visivel={folha === 'favoritos'} aoFechar={() => setFolha(null)} titulo="Convidar favoritos">
        {favoritos === null ? (
          <Carregando />
        ) : favoritos.length === 0 ? (
          <T style={{ color: C.muted, lineHeight: 21 }}>Você ainda não tem favoritos. Toque na estrela no perfil de um freelancer para salvá-lo.</T>
        ) : (
          favoritos.map((f) => {
            const jaConvidado = convites.some((cv) => cv.freelancer_id === f.freelancer_id) || candidatos.some((c) => c.freelancer_id === f.freelancer_id);
            return (
              <View key={f.freelancer_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                <Avatar nome={f.freelancer.nome} tamanho={40} foto={fotoUrl(f.freelancer)} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: F.interSemi }}>{f.freelancer.nome}</T>
                  <T style={{ color: C.muted, fontSize: 12.5 }}>{f.freelancer.titulo}</T>
                </View>
                <Pressable
                  disabled={jaConvidado}
                  onPress={() => {
                    setFolha(null);
                    setConvidar({ id: f.freelancer_id, nome: f.freelancer.nome });
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: jaConvidado ? C.card2 : C.orange }}>
                  <T style={{ fontSize: 13, fontFamily: F.interSemi, color: jaConvidado ? C.muted : C.onOrange }}>{jaConvidado ? 'Já está' : 'Convidar'}</T>
                </Pressable>
              </View>
            );
          })
        )}
      </Folha>

      <FolhaConvidar
        visivel={!!convidar}
        aoFechar={() => {
          setConvidar(null);
          if (vaga) convitesDaVaga(vaga.id).then(setConvites).catch(() => {});
        }}
        freelancer={convidar}
        vagaId={vaga.id}
      />
      {vaga.empresa ? (
        <FolhaDenunciar
          visivel={menu}
          aoFechar={() => setMenu(false)}
          alvo={{ id: vaga.empresa_id, nome: vaga.empresa.nome }}
          vagaId={vaga.id}
          bloqueado={bloqueado}
          aoMudarBloqueio={setBloqueado}
        />
      ) : null}
      <Folha visivel={!!formInstr} aoFechar={() => setFormInstr(null)} titulo="Informações para a equipe">
        <T style={{ color: C.muted, lineHeight: 20 }}>Só quem for contratado vê. Deixe em branco o que não precisar.</T>
        {formInstr ? <CamposInstrucoes valor={formInstr} aoMudar={setFormInstr} /> : null}
        <Botao titulo="Salvar" onPress={gravarInstrucoes} estilo={{ marginTop: 18 }} />
      </Folha>

      <Folha visivel={folha === 'repetir'} aoFechar={() => setFolha(null)} titulo="Repetir na próxima semana">
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Criamos o mesmo turno 7 dias depois{vaga.inicio_em ? ` (${new Date(new Date(vaga.inicio_em).getTime() + 7 * 864e5).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })})` : ''}, com as mesmas informações para a equipe.
        </T>
        {vaga.contratados > 0 ? (
          <>
            <Botao titulo={`Repetir e convidar a mesma equipe (${vaga.contratados})`} onPress={() => repetir(true)} carregando={repetindo} estilo={{ marginTop: 18 }} />
            <Botao titulo="Repetir sem convidar" variante="fantasma" onPress={() => repetir(false)} desativado={repetindo} />
          </>
        ) : (
          <Botao titulo="Criar turno da próxima semana" onPress={() => repetir(false)} carregando={repetindo} estilo={{ marginTop: 18 }} />
        )}
      </Folha>
    </Tela>
  );
}

function Meta({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
      <Icone nome={icone} cor="#2C221D" />
      <T style={{ color: '#2C221D' }}>{texto}</T>
    </View>
  );
}

const st = StyleSheet.create({
  cab: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22, paddingTop: 8 },
  verif: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: C.ink, fontFamily: F.interSemi, fontSize: 22, lineHeight: 28, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 12 },
  desc: { color: '#3B2F29', lineHeight: 23, paddingHorizontal: 22, paddingTop: 20, fontSize: 14.5 },
  hr: { height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 22, marginBottom: 6 },
  candAcoes: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  miniClaro: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: '#D9C7BA' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#E3F5EA' },
  cand: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#ECDCCF' },
  mini: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: C.ink },
  acoes: { paddingHorizontal: 22, paddingTop: 22, gap: 12 },
  lotacao: { marginHorizontal: 22, marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EADBCF' },
  passo: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#E3D2C4', alignItems: 'center', justifyContent: 'center' },
  caixa: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#C9B6A8', alignItems: 'center', justifyContent: 'center' },
  presenca: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0E3D8' },
  turno: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.orange },
});
