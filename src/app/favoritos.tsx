import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FolhaConvidar, LinhaReputacao } from '@/components/acoes';
import { NotaResumo } from '@/components/avaliacao';
import { Icone } from '@/components/icone';
import { Avatar, Chip, Carregando, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import { alternarFavorito, disponiveisEm, fotoUrl, listarFavoritos, turnoAtual, type Favorito } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

/** Freelancers favoritos do estabelecimento, com convite rápido */
export default function Favoritos() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [lista, setLista] = useState<Favorito[] | null>(null);
  const [livresHoje, setLivresHoje] = useState<Set<string>>(new Set());
  const [soHoje, setSoHoje] = useState(false);
  const [convidar, setConvidar] = useState<{ id: string; nome: string } | null>(null);

  const carregar = useCallback(() => {
    if (!perfil) return;
    listarFavoritos(perfil.id).then(setLista).catch(() => setLista([]));
    disponiveisEm(turnoAtual().dia).then(setLivresHoje).catch(() => {});
  }, [perfil]);
  useFocusEffect(carregar);

  const visiveis = useMemo(() => (lista ?? []).filter((f) => !soHoje || livresHoje.has(f.freelancer_id)), [lista, soHoje, livresHoje]);

  async function remover(f: Favorito) {
    if (!perfil) return;
    setLista((l) => (l ?? []).filter((x) => x.freelancer_id !== f.freelancer_id));
    await alternarFavorito(perfil.id, f.freelancer_id, false).catch(() => toast('Não foi possível remover.'));
  }

  return (
    <Tela>
      <Topo titulo="Favoritos" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>Quem trabalhou bem com você. Convide de novo com um toque, sem publicar outra vaga para todo mundo.</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 6 }}>
          <Chip texto="Todos" ativo={!soHoje} onPress={() => setSoHoje(false)} />
          <Chip texto="🗓 Livres hoje" ativo={soHoje} onPress={() => setSoHoje(true)} />
        </View>
        {lista === null ? (
          <Carregando />
        ) : visiveis.length === 0 ? (
          <Vazio
            icone="estrela"
            texto={lista.length ? 'Nenhum favorito marcou disponibilidade para hoje.' : 'Toque na estrela no perfil de um freelancer para salvá-lo aqui.'}
          />
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {visiveis.map((f) => (
              <View key={f.freelancer_id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.stroke, padding: 14 }}>
                <Pressable onPress={() => router.push(`/freela/${f.freelancer_id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Avatar nome={f.freelancer.nome} tamanho={48} foto={fotoUrl(f.freelancer)} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>{f.freelancer.nome}</T>
                    <T style={{ color: C.muted, fontSize: 13, marginTop: 1 }}>{f.freelancer.titulo ?? 'Freelancer'}</T>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 3 }}>
                      <NotaResumo media={f.freelancer.nota_media ?? null} total={f.freelancer.nota_total ?? 0} />
                      {livresHoje.has(f.freelancer_id) ? <T style={{ color: '#7FD3A0', fontSize: 12.5 }}>● livre hoje</T> : null}
                    </View>
                  </View>
                  <Pressable onPress={() => remover(f)} hitSlop={10} accessibilityLabel="Remover dos favoritos">
                    <Icone nome="estrela" cor={C.orange} preenchido />
                  </Pressable>
                </Pressable>
                <View style={{ marginTop: 8 }}>
                  <LinhaReputacao faltas={f.freelancer.faltas} cancelamentos={f.freelancer.cancelamentos} />
                </View>
                <Pressable
                  onPress={() => setConvidar({ id: f.freelancer_id, nome: f.freelancer.nome })}
                  style={{ marginTop: 12, height: 42, borderRadius: 21, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <Icone nome="enviar" tamanho={16} cor={C.onOrange} />
                  <T style={{ color: C.onOrange, fontFamily: F.interSemi }}>Convidar para uma vaga</T>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
      <FolhaConvidar visivel={!!convidar} aoFechar={() => setConvidar(null)} freelancer={convidar} />
    </Tela>
  );
}
