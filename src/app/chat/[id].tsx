import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone } from '@/components/icone';
import { FolhaDenunciar } from '@/components/acoes';
import { BotaoIcone, Carregando, T, Tela, Topo, useToast } from '@/components/ui';
import { conversaBloqueada, enviarMensagem, idsBloqueados, mensagens as carregarMensagens, ouvirMensagens, outroDaConversa, type Mensagem } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

export default function Chat() {
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const { perfil } = useSessao();
  const toast = useToast();
  const ins = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState('');
  const lista = useRef<FlatList<Mensagem>>(null);
  const [outro, setOutro] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false); // por qualquer um dos dois
  const [euBloqueei, setEuBloqueei] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!id || !perfil) return;
    (async () => {
      const o = await outroDaConversa(id, perfil.id).catch(() => null);
      setOutro(o);
      if (!o) return;
      const [b, meus] = await Promise.all([conversaBloqueada(perfil.id, o), idsBloqueados(perfil.id).catch(() => new Set<string>())]);
      setBloqueada(b);
      setEuBloqueei(meus.has(o));
    })();
  }, [id, perfil]);

  useEffect(() => {
    if (!id) return;
    carregarMensagens(id)
      .then(setMsgs)
      .catch(() => setMsgs([]));
    // tempo real: novas mensagens chegam sem recarregar
    return ouvirMensagens(id, (m) => setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l)));
  }, [id]);

  async function enviar() {
    const t = texto.trim();
    if (!t || !id) return;
    setTexto('');
    try {
      const m = await enviarMensagem(id, t);
      setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
    } catch {
      setTexto(t);
      toast('Mensagem não enviada. Tente de novo.');
    }
  }

  return (
    <Tela rolar={false}>
      <Topo titulo={nome || 'Conversa'} direita={outro ? <BotaoIcone nome="opcoes" rotulo="Mais opções" onPress={() => setMenu(true)} /> : null} />
      {msgs === null ? (
        <Carregando />
      ) : (
        <FlatList
          ref={lista}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: 'flex-end' }}
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center' }}>Diga olá! 👋</T>}
          renderItem={({ item: m }) => {
            const meu = m.autor_id === perfil?.id;
            return (
              <View style={[st.msg, meu ? st.minha : st.dela]}>
                <T style={{ color: meu ? C.onOrange : C.cream, fontSize: 14.5, lineHeight: 20 }}>{m.texto}</T>
                <T style={{ color: meu ? C.onOrange : C.cream, opacity: 0.6, fontSize: 11, marginTop: 4 }}>
                  {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </T>
              </View>
            );
          }}
        />
      )}
      {bloqueada ? (
        <View style={[st.compositor, { paddingBottom: Math.max(ins.bottom, 12), justifyContent: 'center' }]}>
          <T style={{ color: C.muted, textAlign: 'center', paddingVertical: 12 }}>
            {euBloqueei ? 'Você bloqueou esta pessoa. Toque em ⋯ para desbloquear.' : 'Não é possível enviar mensagens nesta conversa.'}
          </T>
        </View>
      ) : (
      <View style={[st.compositor, { paddingBottom: Math.max(ins.bottom, 12) }]}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={C.muted2}
          style={st.input}
          onSubmitEditing={enviar}
          returnKeyType="send"
          maxLength={2000}
        />
        <Pressable onPress={enviar} style={st.enviar} accessibilityLabel="Enviar">
          <Icone nome="enviar" tamanho={18} cor={C.onOrange} />
        </Pressable>
      </View>
      )}
      <FolhaDenunciar
        visivel={menu}
        aoFechar={() => setMenu(false)}
        alvo={outro ? { id: outro, nome: nome || 'Esta pessoa' } : null}
        bloqueado={euBloqueei}
        aoMudarBloqueio={async (b) => {
          setEuBloqueei(b);
          if (perfil && outro) setBloqueada(b || (await conversaBloqueada(perfil.id, outro)));
        }}
      />
    </Tela>
  );
}

const st = StyleSheet.create({
  msg: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20 },
  minha: { alignSelf: 'flex-end', backgroundColor: C.orange, borderBottomRightRadius: 6 },
  dela: { alignSelf: 'flex-start', backgroundColor: C.card2, borderBottomLeftRadius: 6 },
  compositor: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.linha, backgroundColor: C.bg },
  input: { flex: 1, height: 48, borderRadius: 26, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke, paddingHorizontal: 18, color: C.cream, fontFamily: F.inter, fontSize: 15 },
  enviar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
});
