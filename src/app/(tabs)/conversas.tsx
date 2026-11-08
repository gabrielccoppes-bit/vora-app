import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Carregando, T, Tela, Topo, Vazio } from '@/components/ui';
import { minhasConversas, type ConversaResumo, fotoUrl } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function Conversas() {
  const { perfil } = useSessao();
  const [lista, setLista] = useState<ConversaResumo[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      minhasConversas()
        .then(setLista)
        .catch(() => setLista([]));
    }, [])
  );

  return (
    <Tela rolar={false}>
      <Topo titulo="Conversas" voltar={false} />
      {lista === null ? (
        <Carregando />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Vazio icone="chat" texto="Nenhuma conversa ainda. Candidate-se a uma vaga ou envie uma mensagem para começar." />}
          renderItem={({ item: c }) => (
            <Pressable style={({ pressed }) => [st.linha, pressed && { backgroundColor: '#FFFFFF08' }]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id, nome: c.outro_nome } })}>
              <Avatar nome={c.outro_nome} quadrado={c.outro_tipo === 'empresa'} foto={fotoUrl({ id: c.outro_id, foto_v: c.outro_foto_v })} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15.5 }}>{c.outro_nome}</T>
                <T style={{ color: C.muted, fontSize: 13.5, marginTop: 3 }} numberOfLines={1}>
                  {c.ultima_texto ? `${c.ultima_autor === perfil?.id ? 'Você: ' : ''}${c.ultima_texto}` : 'Conversa iniciada'}
                </T>
              </View>
              <T style={{ color: C.muted2, fontSize: 12, alignSelf: 'flex-start', marginTop: 4 }}>{tempoRelativo(c.ultima_em)}</T>
            </Pressable>
          )}
        />
      )}
    </Tela>
  );
}

const st = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
});
