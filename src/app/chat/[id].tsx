import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { FlatList, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone } from '@/components/icone';
import { FolhaDenunciar } from '@/components/acoes';
import { Botao, BotaoIcone, Carregando, Folha, T, Tela, Topo, useToast } from '@/components/ui';
import { conversaBloqueada, enviarFotoChat, enviarLocalChat, enviarMensagem, linkMapa, urlFotoChat, idsBloqueados, mensagens as carregarMensagens, ouvirMensagens, outroDaConversa, type Mensagem } from '@/lib/api';
import { escolherImagem } from '@/lib/imagem';
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
  const [anexar, setAnexar] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);

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

  const adicionar = (m: Mensagem) => setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));

  async function mandarFoto(origem: 'camera' | 'galeria') {
    if (!id) return;
    setAnexar(false);
    try {
      const img = await escolherImagem({ origem, max: 1600 });
      if (!img) return;
      setEnviandoAnexo(true);
      adicionar(await enviarFotoChat(id, img.bytes));
    } catch (e) {
      toast((e as Error).message || 'Não foi possível enviar a foto.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function mandarLocal() {
    if (!id) return;
    setAnexar(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return toast('Permita o acesso à localização para enviar onde você está.');
      setEnviandoAnexo(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      adicionar(await enviarLocalChat(id, pos.coords.latitude, pos.coords.longitude));
    } catch {
      toast('Não foi possível pegar sua localização.');
    } finally {
      setEnviandoAnexo(false);
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
              <View style={[st.msg, meu ? st.minha : st.dela, m.tipo === 'foto' && { padding: 5 }]}>
                {m.tipo === 'foto' && m.anexo ? (
                  <FotoChat caminho={m.anexo} aoAbrir={setAmpliada} />
                ) : m.tipo === 'local' && m.lat != null && m.lng != null ? (
                  <Pressable onPress={() => Linking.openURL(linkMapa(m.lat!, m.lng!))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="link">
                    <View style={[st.pino, { backgroundColor: meu ? '#00000022' : '#FF5A1222' }]}>
                      <Icone nome="local" tamanho={18} cor={meu ? C.onOrange : C.orange} />
                    </View>
                    <View>
                      <T style={{ color: meu ? C.onOrange : C.cream, fontFamily: F.interSemi, fontSize: 14.5 }}>Localização</T>
                      <T style={{ color: meu ? C.onOrange : C.muted, fontSize: 12.5, marginTop: 1 }}>Toque para abrir no mapa</T>
                    </View>
                  </Pressable>
                ) : (
                  <T style={{ color: meu ? C.onOrange : C.cream, fontSize: 14.5, lineHeight: 20 }}>{m.texto}</T>
                )}
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
        <Pressable onPress={() => setAnexar(true)} style={st.clipe} accessibilityLabel="Enviar foto ou localização" disabled={enviandoAnexo}>
          <Icone nome={enviandoAnexo ? 'relogio' : 'mais'} tamanho={20} cor={C.cream} />
        </Pressable>
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
      <Folha visivel={anexar} aoFechar={() => setAnexar(false)} titulo="Enviar">
        <Botao titulo="Tirar foto" icone="camera" onPress={() => mandarFoto('camera')} />
        <Botao titulo="Foto da galeria" variante="contorno" onPress={() => mandarFoto('galeria')} estilo={{ marginTop: 10 }} />
        <Botao titulo="Minha localização atual" icone="local" variante="contorno" onPress={mandarLocal} estilo={{ marginTop: 10 }} />
        <T style={{ color: C.muted2, fontSize: 12, textAlign: 'center', marginTop: 12 }}>Fotos ficam guardadas só para quem está nesta conversa.</T>
      </Folha>
      <Folha visivel={!!ampliada} aoFechar={() => setAmpliada(null)}>
        {ampliada ? <Image source={{ uri: ampliada }} style={{ width: '100%', height: 420, borderRadius: 12 }} contentFit="contain" /> : null}
      </Folha>
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

/** Foto do chat: busca um link temporário (o cofre do chat é privado) */
function FotoChat({ caminho, aoAbrir }: { caminho: string; aoAbrir: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlFotoChat(caminho).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [caminho]);
  return (
    <Pressable onPress={() => url && aoAbrir(url)} accessibilityLabel="Abrir foto">
      {url ? (
        <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 15 }} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <View style={{ width: 220, height: 220, borderRadius: 15, backgroundColor: '#00000022' }} />
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  clipe: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center' },
  pino: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  msg: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20 },
  minha: { alignSelf: 'flex-end', backgroundColor: C.orange, borderBottomRightRadius: 6 },
  dela: { alignSelf: 'flex-start', backgroundColor: C.card2, borderBottomLeftRadius: 6 },
  compositor: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.linha, backgroundColor: C.bg },
  input: { flex: 1, height: 48, borderRadius: 26, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke, paddingHorizontal: 18, color: C.cream, fontFamily: F.inter, fontSize: 15 },
  enviar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
});
