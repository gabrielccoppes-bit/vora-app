import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { T, Tela, Topo } from '@/components/ui';
import { C, F } from '@/theme';

export default function Tipo() {
  return (
    <Tela>
      <Topo />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ fontFamily: F.soraSemi, fontSize: 26, lineHeight: 32 }}>
          Como você quer usar a <T style={{ fontFamily: F.soraSemi, fontSize: 26, color: C.orange }}>Vora</T>?
        </T>
        <T style={{ color: C.muted, marginTop: 8, marginBottom: 8, lineHeight: 21 }}>Você pode criar outra conta depois, se precisar dos dois perfis.</T>
        <Opcao
          icone="usuario"
          titulo="Sou freelancer"
          texto="Encontre projetos e receba propostas de empresas. Cadastro com CPF (e CNPJ, se for MEI)."
          onPress={() => router.push('/cadastro-freelancer')}
        />
        <Opcao
          icone="predio"
          titulo="Sou empresa"
          texto="Publique vagas e contrate talentos. Digite o CNPJ e preenchemos os dados da Receita."
          onPress={() => router.push('/cadastro-empresa')}
        />
      </View>
    </Tela>
  );
}

function Opcao({ icone, titulo, texto, onPress }: { icone: NomeIcone; titulo: string; texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.opcao, pressed && { borderColor: C.orange }]}>
      <View style={st.ic}>
        <Icone nome={icone} cor={C.orange} tamanho={26} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.soraSemi, fontSize: 17 }}>{titulo}</T>
        <T style={{ color: C.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>{texto}</T>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  opcao: { flexDirection: 'row', gap: 16, alignItems: 'center', padding: 20, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke, marginTop: 14 },
  ic: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#FF5A1220', alignItems: 'center', justifyContent: 'center' },
});
