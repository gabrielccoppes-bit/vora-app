import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/icone';
import { T } from '@/components/ui';
import { ouvirNotificacoes } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C } from '@/theme';

const ABAS: { nome: string; rotulo: string; icone: NomeIcone; cheio: boolean }[] = [
  { nome: 'inicio', rotulo: 'Início', icone: 'inicio', cheio: true },
  { nome: 'buscar', rotulo: 'Buscar', icone: 'buscar', cheio: false },
  { nome: 'publicar', rotulo: 'Publicar', icone: 'mais', cheio: false },
  { nome: 'conversas', rotulo: 'Conversas', icone: 'chat', cheio: false },
  { nome: 'perfil', rotulo: 'Perfil', icone: 'usuario', cheio: true },
];

function Barra({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[st.barra, { paddingBottom: Math.max(ins.bottom, 10) }]}>
      {state.routes.map((rota, i) => {
        const aba = ABAS.find((a) => a.nome === rota.name);
        if (!aba) return null;
        const ativo = state.index === i;
        const cor = ativo ? C.orange : '#CDBDB2';
        return (
          <Pressable
            key={rota.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            onPress={() => {
              const ev = emitter.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
              if (!ativo && !ev.defaultPrevented) navigateToTab(rota.key);
            }}
            style={st.aba}>
            <Icone nome={aba.icone} cor={cor} preenchido={ativo && aba.cheio} />
            <T style={{ fontSize: 11, color: cor, marginTop: 4 }}>{aba.rotulo}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

type Aviso = { rotulo: string; titulo: string; linha: string; rota: string; icone: NomeIcone };

/** Avisos no topo: vaga urgente perto do freelancer e convites diretos */
function AlertaUrgente() {
  const { perfil } = useSessao();
  const ins = useSafeAreaInsets();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const id = perfil?.id;

  const mostrar = (a: Aviso) => {
    setAviso(a);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 10000);
  };

  // todo aviso novo (candidatura, convite, contratação, vaga urgente...) aparece no topo.
  // Mensagens não: quem está no chat já vê a conversa.
  useEffect(() => {
    if (!id) return;
    return ouvirNotificacoes(id, (n) => {
      if (n.tipo === 'mensagem') return;
      mostrar({
        rotulo: n.tipo === 'urgente' ? 'VAGA URGENTE NA SUA CIDADE' : n.tipo === 'convite' ? 'VOCÊ RECEBEU UM CONVITE' : 'NOVO AVISO',
        titulo: n.titulo.replace(/^⚡ Vaga urgente: /, ''),
        linha: n.corpo,
        rota: n.rota ?? '/notificacoes',
        icone: n.tipo === 'urgente' ? 'raio' : n.tipo === 'convite' ? 'enviar' : 'sino',
      });
    });
  }, [id]);

  if (!aviso) return null;
  return (
    <Pressable
      onPress={() => {
        setAviso(null);
        router.push(aviso.rota as never);
      }}
      style={[st.alerta, { top: ins.top + 8 }]}>
      <View style={st.alertaIc}>
        <Icone nome={aviso.icone} cor="#fff" tamanho={18} preenchido={aviso.icone === 'raio'} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 }}>{aviso.rotulo}</T>
        <T style={{ color: C.ink, fontSize: 14.5, fontFamily: 'Inter_600SemiBold', marginTop: 2 }} numberOfLines={1}>
          {aviso.titulo}
        </T>
        <T style={{ color: C.ink2, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
          {aviso.linha}
        </T>
      </View>
    </Pressable>
  );
}

export default function LayoutAbas() {
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg }, lazy: true, freezeOnBlur: true }}
      tabBar={(p) => <Barra {...p} />}>
      {ABAS.map((a) => (
        <Tabs.Screen key={a.nome} name={a.nome} options={{ title: a.rotulo }} />
      ))}
    </Tabs>
    <AlertaUrgente />
    </View>
  );
}

const st = StyleSheet.create({
  barra: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, backgroundColor: '#0F0B0A', borderTopWidth: 1, borderTopColor: C.linha },
  aba: { alignItems: 'center', minWidth: 60, paddingVertical: 4 },
  alerta: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20,
    backgroundColor: C.cream, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  alertaIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
});
