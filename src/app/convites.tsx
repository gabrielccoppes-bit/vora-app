import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NotaResumo } from '@/components/avaliacao';
import { Avatar, Botao, Carregando, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import { faixaSalarial, fotoUrl, meusConvites, quandoComeca, responderConvite, type Convite } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

/** Convites diretos recebidos pelo freelancer */
export default function Convites() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [lista, setLista] = useState<Convite[] | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (perfil) meusConvites(perfil.id).then(setLista).catch(() => setLista([]));
  }, [perfil]);
  useFocusEffect(carregar);

  async function responder(c: Convite, aceitar: boolean) {
    setRespondendo(c.id);
    try {
      await responderConvite(c.id, aceitar);
      toast(aceitar ? 'Convite aceito! Você está contratado(a).' : 'Convite recusado.');
      carregar();
      if (aceitar) router.push(`/vaga/${c.vaga_id}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setRespondendo(null);
    }
  }

  const pendentes = (lista ?? []).filter((c) => c.status === 'pendente' && c.vaga?.ativa);
  const outros = (lista ?? []).filter((c) => !pendentes.includes(c));

  return (
    <Tela>
      <Topo titulo="Convites" />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio icone="enviar" texto="Nenhum convite ainda. Complete seu perfil e marque sua disponibilidade para ser lembrado(a)." />
        ) : (
          <>
            {pendentes.map((c) => (
              <View key={c.id} style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1.5, borderColor: C.orange, padding: 16 }}>
                <Pressable onPress={() => router.push(`/estabelecimento/${c.empresa_id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Avatar nome={c.vaga!.empresa.nome} quadrado tamanho={46} foto={fotoUrl(c.vaga!.empresa)} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>{c.vaga!.empresa.nome}</T>
                    <NotaResumo media={c.vaga!.empresa.nota_media ?? null} total={c.vaga!.empresa.nota_total ?? 0} />
                  </View>
                  <T style={{ color: C.muted2, fontSize: 12 }}>{tempoRelativo(c.criado_em)}</T>
                </Pressable>
                <Pressable onPress={() => router.push(`/vaga/${c.vaga_id}`)}>
                  <T style={{ fontFamily: F.soraSemi, fontSize: 17, marginTop: 14 }}>{c.vaga!.titulo}</T>
                  <T style={{ color: C.muted, marginTop: 4 }}>
                    {[c.vaga!.inicio_em ? quandoComeca(c.vaga!.inicio_em) : null, faixaSalarial(c.vaga!)].filter(Boolean).join(' · ')}
                  </T>
                </Pressable>
                {c.mensagem ? <T style={{ marginTop: 10, lineHeight: 21, fontStyle: 'italic', color: '#E6D6CA' }}>“{c.mensagem}”</T> : null}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <Botao titulo="Recusar" variante="contorno" onPress={() => responder(c, false)} estilo={{ flex: 1, height: 46 }} />
                  <Botao titulo="Aceitar" onPress={() => responder(c, true)} carregando={respondendo === c.id} estilo={{ flex: 1, height: 46 }} />
                </View>
                <T style={{ color: C.muted2, fontSize: 12, marginTop: 10, textAlign: 'center' }}>Ao aceitar, você já fica contratado(a) para essa vaga.</T>
              </View>
            ))}
            {outros.length ? <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 12, letterSpacing: 1.1, marginTop: 10 }}>ANTERIORES</T> : null}
            {outros.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/vaga/${c.vaga_id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
                <Avatar nome={c.vaga!.empresa.nome} quadrado tamanho={40} foto={fotoUrl(c.vaga!.empresa)} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
                    {c.vaga!.titulo}
                  </T>
                  <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {c.vaga!.empresa.nome} · {c.status === 'aceito' ? 'Aceito' : c.status === 'recusado' ? 'Recusado' : 'Vaga encerrada'}
                  </T>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </Tela>
  );
}
