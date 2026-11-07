import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, type NomeIcone } from '@/components/icone';
import { T } from '@/components/ui';
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

export default function LayoutAbas() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}
      tabBar={(p) => <Barra {...(p as unknown as BarraProps)} />}>
      {ABAS.map((a) => (
        <Tabs.Screen key={a.nome} name={a.nome} options={{ title: a.rotulo }} />
      ))}
    </Tabs>
  );
}

const st = StyleSheet.create({
  barra: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, backgroundColor: '#0F0B0A', borderTopWidth: 1, borderTopColor: C.linha },
  aba: { alignItems: 'center', minWidth: 60, paddingVertical: 4 },
});
