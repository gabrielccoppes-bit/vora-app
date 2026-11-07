import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Brilho, T } from '@/components/ui';
import { C, F } from '@/theme';

export default function BoasVindas() {
  const ins = useSafeAreaInsets();
  return (
    <View style={[st.tela, { paddingTop: ins.top + 40, paddingBottom: ins.bottom + 32 }]}>
      <Brilho />
      <View style={st.centro}>
        <Image source={require('@/assets/images/logo-mark.png')} style={st.marca} contentFit="contain" accessibilityLabel="Vora" />
        <T style={st.palavra}>vora</T>
        <T style={st.frase}>
          Trabalho certo.{'\n'}No <T style={[st.frase, { color: C.orange }]}>seu ritmo.</T>
        </T>
      </View>
      <View style={{ gap: 12 }}>
        <Botao titulo="Criar conta" onPress={() => router.push('/tipo')} />
        <Botao titulo="Já tenho conta" variante="contorno" onPress={() => router.push('/entrar')} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 28, justifyContent: 'space-between' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  marca: { width: 190, height: 120 },
  palavra: { fontFamily: F.sora, fontSize: 64, letterSpacing: -2, marginTop: 8, lineHeight: 72 },
  frase: { fontSize: 19, textAlign: 'center', marginTop: 24, lineHeight: 26 },
});
