import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Carregando, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import { bloquear, fotoUrl, listarBloqueados } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

export default function Bloqueados() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [lista, setLista] = useState<Awaited<ReturnType<typeof listarBloqueados>> | null>(null);

  const carregar = useCallback(() => {
    if (perfil) listarBloqueados(perfil.id).then(setLista).catch(() => setLista([]));
  }, [perfil]);
  useFocusEffect(carregar);

  return (
    <Tela>
      <Topo titulo="Pessoas bloqueadas" />
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>Quem está aqui não consegue conversar com você, te convidar ou se candidatar às suas vagas.</T>
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio icone="escudo" texto="Você não bloqueou ninguém." />
        ) : (
          lista.map((b) => (
            <View key={b.alvo_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
              <Avatar nome={b.alvo?.nome ?? '?'} tamanho={40} quadrado={b.alvo?.tipo === 'empresa'} foto={fotoUrl(b.alvo)} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi }}>{b.alvo?.nome ?? 'Conta removida'}</T>
                <T style={{ color: C.muted, fontSize: 12.5 }}>{b.alvo?.tipo === 'empresa' ? 'Estabelecimento' : 'Freelancer'}</T>
              </View>
              <Pressable
                onPress={async () => {
                  if (!perfil) return;
                  try {
                    await bloquear(perfil.id, b.alvo_id, false);
                    setLista((l) => (l ?? []).filter((x) => x.alvo_id !== b.alvo_id));
                    toast('Desbloqueado(a).');
                  } catch {
                    toast('Não foi possível desbloquear.');
                  }
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: C.stroke }}>
                <T style={{ fontSize: 13, fontFamily: F.interSemi }}>Desbloquear</T>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </Tela>
  );
}
