import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/icone';
import { T } from '@/components/ui';
import { buscarVaga, faixaSalarial, ouvirVagasUrgentes, quandoComeca, type Vaga } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C } from '@/theme';

const ABAS: { nome: string; rotulo: string; icone: NomeIcone; cheio: boolean }[] = [
  { nome: 'inicio', rotulo: 'Início', icone: 'inicio', cheio: true },
  { nome: 'buscar', rotulo: 'Buscar', icone: 'buscar', cheio: false },
  { nome: 'publicar', rotulo: 'Publicar', icone: 'mais', cheio: false },
  { nome: 'conversas', rotulo: 'Conversas', icone: 'chat', cheio: false },
  { nome: 'perfil', rotulo: 'Perfil', icone: 'usuario', cheio: true },
];

type BarraProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

function Barra({ state, navigation }: BarraProps) {
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
              const ev = navigation.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
              if (!ativo && !ev.defaultPrevented) navigation.navigate(rota.name, rota.params);
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

/** Aviso no topo quando uma vaga urgente é publicada na cidade do freelancer */
function AlertaUrgente() {
  const { perfil } = useSessao();
  const ins = useSafeAreaInsets();
  const [vaga, setVaga] = useState<Vaga | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tipo = perfil?.tipo;
  const cidade = perfil?.cidade ?? '';
  useEffect(() => {
    if (tipo !== 'freelancer') return;
    return ouvirVagasUrgentes(async (id) => {
      const v = await buscarVaga(id).catch(() => null);
      if (!v || v.empresa?.cidade?.toLowerCase() !== cidade.toLowerCase()) return;
      setVaga(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVaga(null), 12000);
    });
  }, [tipo, cidade]);

  if (!vaga) return null;
  return (
    <Pressable
      onPress={() => {
        setVaga(null);
        router.push(`/vaga/${vaga.id}`);
      }}
      style={[st.alerta, { top: ins.top + 8 }]}>
      <View style={st.alertaIc}>
        <Icone nome="raio" cor="#fff" tamanho={18} preenchido />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 }}>VAGA URGENTE PERTO DE VOCÊ</T>
        <T style={{ color: C.ink, fontSize: 14.5, fontFamily: 'Inter_600SemiBold', marginTop: 2 }} numberOfLines={1}>
          {vaga.titulo} · {vaga.empresa?.nome}
        </T>
        <T style={{ color: C.ink2, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
          {vaga.inicio_em ? quandoComeca(vaga.inicio_em) : ''} · {faixaSalarial(vaga)}
        </T>
      </View>
    </Pressable>
  );
}

export default function LayoutAbas() {
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}
      tabBar={(p) => <Barra {...(p as unknown as BarraProps)} />}>
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
