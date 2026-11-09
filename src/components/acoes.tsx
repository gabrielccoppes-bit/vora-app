import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  bloquear,
  convidar,
  DIAS,
  denunciar,
  minhasVagas,
  MOTIVOS_DENUNCIA,
  quandoComeca,
  TURNOS,
  type Disponivel,
  type Turno,
  type Vaga,
} from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';
import { Icone, type NomeIcone } from './icone';
import { Botao, Campo, Carregando, Folha, Marcar, T, useToast } from './ui';

/* ============ Convidar para uma vaga ============ */
export function FolhaConvidar({ visivel, aoFechar, freelancer, vagaId }: { visivel: boolean; aoFechar: () => void; freelancer: { id: string; nome: string } | null; vagaId?: string }) {
  const { perfil } = useSessao();
  const toast = useToast();
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visivel || !perfil) return;
    setEscolhida(vagaId ?? null);
    setMsg('');
    minhasVagas(perfil.id)
      .then((v) => setVagas(v.filter((x) => x.ativa)))
      .catch(() => setVagas([]));
  }, [visivel, perfil, vagaId]);

  async function enviar() {
    if (!perfil || !freelancer || !escolhida) return;
    setEnviando(true);
    try {
      await convidar(escolhida, perfil.id, freelancer.id, msg);
      toast(`Convite enviado para ${freelancer.nome.split(' ')[0]}!`);
      aoFechar();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Folha visivel={visivel} aoFechar={aoFechar} titulo={freelancer ? `Convidar ${freelancer.nome.split(' ')[0]}` : 'Convidar'}>
      {vagas === null ? (
        <Carregando />
      ) : vagas.length === 0 ? (
        <>
          <T style={{ color: C.muted, lineHeight: 21 }}>Você não tem vagas abertas. Publique uma vaga e depois convide quem você quiser.</T>
          <Botao
            titulo="Publicar vaga"
            onPress={() => {
              aoFechar();
              router.navigate('/publicar');
            }}
            estilo={{ marginTop: 18 }}
          />
        </>
      ) : (
        <>
          <T style={{ color: C.muted, lineHeight: 21, marginBottom: 8 }}>Escolha a vaga. Se a pessoa aceitar, ela já entra como contratada.</T>
          <View style={{ gap: 8, maxHeight: 260 }}>
            {vagas.slice(0, 8).map((v) => {
              const ativo = escolhida === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setEscolhida(v.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: ativo ? C.orange : C.stroke, backgroundColor: ativo ? '#FF5A1214' : 'transparent' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ativo ? C.orange : C.muted2, alignItems: 'center', justifyContent: 'center' }}>
                    {ativo ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
                      {v.titulo}
                    </T>
                    <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                      {v.inicio_em ? quandoComeca(v.inicio_em) : v.duracao}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Campo rotulo="Mensagem (opcional)" valor={msg} aoMudar={setMsg} placeholder="Ex.: Gostamos muito do seu trabalho na última sexta!" multiline maxLength={300} />
          <Botao titulo="Enviar convite" onPress={enviar} carregando={enviando} estilo={{ marginTop: 18, opacity: escolhida ? 1 : 0.5 }} />
        </>
      )}
    </Folha>
  );
}

/* ============ Denunciar / bloquear ============ */
export function FolhaDenunciar({
  visivel,
  aoFechar,
  alvo,
  vagaId,
  bloqueado,
  aoMudarBloqueio,
}: {
  visivel: boolean;
  aoFechar: () => void;
  alvo: { id: string; nome: string } | null;
  vagaId?: string | null;
  bloqueado: boolean;
  aoMudarBloqueio: (b: boolean) => void;
}) {
  const { perfil } = useSessao();
  const toast = useToast();
  const [modo, setModo] = useState<'menu' | 'denunciar'>('menu');
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState('');
  const [tambemBloquear, setTambemBloquear] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visivel) {
      setModo('menu');
      setMotivo(null);
      setDetalhes('');
      setTambemBloquear(true);
    }
  }, [visivel]);

  async function alternarBloqueio() {
    if (!perfil || !alvo) return;
    setEnviando(true);
    try {
      await bloquear(perfil.id, alvo.id, !bloqueado);
      aoMudarBloqueio(!bloqueado);
      toast(bloqueado ? `${alvo.nome} foi desbloqueado(a).` : `${alvo.nome} foi bloqueado(a).`);
      aoFechar();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    if (!perfil || !alvo || !motivo) return;
    setEnviando(true);
    try {
      await denunciar({ alvo_id: alvo.id, motivo, detalhes, vaga_id: vagaId });
      if (tambemBloquear && !bloqueado) {
        await bloquear(perfil.id, alvo.id, true);
        aoMudarBloqueio(true);
      }
      toast('Denúncia enviada. Obrigado por ajudar a manter o Vora seguro.');
      aoFechar();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Folha visivel={visivel} aoFechar={aoFechar} titulo={modo === 'menu' ? alvo?.nome : 'Denunciar'}>
      {modo === 'menu' ? (
        <View style={{ gap: 4 }}>
          <ItemMenu icone="escudo" titulo="Denunciar" sub="A equipe do Vora analisa em sigilo" onPress={() => setModo('denunciar')} />
          <ItemMenu
            icone="fechar"
            titulo={bloqueado ? 'Desbloquear' : 'Bloquear'}
            sub={bloqueado ? 'Vocês voltam a poder conversar' : 'Não poderão mais conversar, convidar nem se candidatar'}
            onPress={alternarBloqueio}
            perigo={!bloqueado}
          />
        </View>
      ) : (
        <>
          <T style={{ color: C.muted, lineHeight: 21 }}>O que aconteceu? A pessoa não fica sabendo quem denunciou.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {MOTIVOS_DENUNCIA.map((m) => {
              const ativo = motivo === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMotivo(m.id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: ativo ? C.orange : C.stroke, backgroundColor: ativo ? C.orange : 'transparent' }}>
                  <T style={{ fontSize: 13.5, color: ativo ? C.onOrange : C.cream, fontFamily: ativo ? F.interSemi : F.inter }}>{m.nome}</T>
                </Pressable>
              );
            })}
          </View>
          <Campo rotulo="Detalhes (opcional)" valor={detalhes} aoMudar={setDetalhes} placeholder="Conte o que aconteceu, com datas se possível." multiline maxLength={1000} />
          {!bloqueado ? (
            <Marcar marcado={tambemBloquear} aoMudar={setTambemBloquear}>
              <T style={{ fontSize: 14 }}>Também bloquear {alvo?.nome.split(' ')[0]}</T>
            </Marcar>
          ) : null}
          <Botao titulo="Enviar denúncia" variante="perigo" onPress={enviar} carregando={enviando} estilo={{ marginTop: 18, opacity: motivo ? 1 : 0.5 }} />
          <Botao titulo="Voltar" variante="fantasma" onPress={() => setModo('menu')} />
          <T style={{ color: C.muted2, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Em caso de crime ou perigo, ligue 190.</T>
        </>
      )}
    </Folha>
  );
}

function ItemMenu({ icone, titulo, sub, onPress, perigo }: { icone: NomeIcone; titulo: string; sub?: string; onPress: () => void; perigo?: boolean }) {
  const cor = perigo ? '#FF8A8A' : C.cream;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }, pressed && { opacity: 0.6 }]}>
      <Icone nome={icone} cor={cor} />
      <View style={{ flex: 1 }}>
        <T style={{ color: cor, fontSize: 15.5, fontFamily: F.interSemi }}>{titulo}</T>
        {sub ? <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sub}</T> : null}
      </View>
    </Pressable>
  );
}

/* ============ Grade de disponibilidade ============ */
export function GradeDisponibilidade({
  itens,
  aoAlternar,
  clara,
}: {
  itens: Disponivel[];
  aoAlternar?: (dia: number, turno: Turno) => void;
  clara?: boolean;
}) {
  const tem = (d: number, t: Turno) => itens.some((i) => i.dia === d && i.turno === t);
  const corTexto = clara ? C.ink2 : C.muted;
  const vazio = clara ? '#EADBCF' : '#2A211D';
  // semana começando na segunda (mais natural para escala)
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return (
    <View>
      <View style={{ flexDirection: 'row', marginLeft: 74 }}>
        {ordem.map((d) => (
          <T key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: corTexto, fontFamily: F.interSemi }}>
            {DIAS[d]}
          </T>
        ))}
      </View>
      {TURNOS.map((t) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <View style={{ width: 74 }}>
            <T style={{ fontSize: 12.5, color: clara ? C.ink : C.cream, fontFamily: F.interMed }}>{t.nome}</T>
            <T style={{ fontSize: 10.5, color: corTexto }}>{t.horas}</T>
          </View>
          {ordem.map((d) => {
            const on = tem(d, t.id);
            const cel = <View style={{ height: 32, borderRadius: 8, backgroundColor: on ? C.orange : vazio, alignItems: 'center', justifyContent: 'center' }}>{on ? <Icone nome="check" tamanho={14} cor={C.onOrange} espessura={3} /> : null}</View>;
            return aoAlternar ? (
              <Pressable
                key={d}
                onPress={() => aoAlternar(d, t.id)}
                style={{ flex: 1, paddingHorizontal: 2 }}
                accessibilityLabel={`${DIAS[d]} ${t.nome}: ${on ? 'disponível' : 'indisponível'}`}>
                {cel}
              </Pressable>
            ) : (
              <View key={d} style={{ flex: 1, paddingHorizontal: 2 }}>
                {cel}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ============ Reputação (faltas e cancelamentos) ============ */
export function LinhaReputacao({ faltas, cancelamentos, empresa, clara }: { faltas?: number; cancelamentos?: number; empresa?: boolean; clara?: boolean }) {
  const f = faltas ?? 0;
  const c = cancelamentos ?? 0;
  const cor = clara ? '#7A6A61' : C.muted;
  if (!f && !c)
    return <T style={{ color: clara ? '#2E7D4F' : '#7FD3A0', fontSize: 13 }}>{empresa ? '✓ Nenhum cancelamento de contratação' : '✓ Nenhuma falta ou cancelamento'}</T>;
  const partes = [f ? `${f} falta${f > 1 ? 's' : ''}` : null, c ? `${c} cancelamento${c > 1 ? 's' : ''}` : null].filter(Boolean);
  return <T style={{ color: cor, fontSize: 13 }}>⚠ {partes.join(' · ')}</T>;
}
