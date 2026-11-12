import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icone } from '@/components/icone';
import { T, Tela, Topo } from '@/components/ui';
import { treinamentosDe } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { MODULOS } from '@/lib/treinamentos';
import { C, F } from '@/theme';

/** Lista de microtreinamentos */
export default function Treinamentos() {
  const { perfil } = useSessao();
  const [feitos, setFeitos] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (perfil) treinamentosDe(perfil.id).then((l) => setFeitos(new Set(l.map((x) => x.modulo)))).catch(() => {});
    }, [perfil])
  );

  const n = MODULOS.filter((m) => feitos.has(m.id)).length;
  return (
    <Tela>
      <Topo titulo="Treinamentos" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Lições de 2 a 3 minutos com um quiz no final. Cada uma concluída aparece no seu perfil e na sua carteira de trabalho. Fazendo todas, você ganha o selo Capacitado.
        </T>
        <View style={{ marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
          <T style={{ fontFamily: F.interSemi }}>
            {n} de {MODULOS.length} concluídos{n === MODULOS.length ? ' · selo Capacitado ✓' : ''}
          </T>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#2A201C', marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${(n / MODULOS.length) * 100}%`, height: 8, backgroundColor: C.orange }} />
          </View>
        </View>
        {MODULOS.map((m) => {
          const ok = feitos.has(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/treinamento/${m.id}`)}
              style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: ok ? '#1F7A4C' : C.stroke, marginTop: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: ok ? '#1F7A4C33' : '#FF5A1222', alignItems: 'center', justifyContent: 'center' }}>
                <Icone nome={ok ? 'check' : m.icone} cor={ok ? C.ok : C.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15.5 }}>{m.titulo}</T>
                <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{m.resumo}</T>
                <T style={{ color: ok ? C.ok : C.orange2, fontSize: 12, marginTop: 4, fontFamily: F.interSemi }}>{ok ? 'Concluído' : `${m.minutos} min · ${m.perguntas.length} perguntas`}</T>
              </View>
              <Icone nome="seta" cor={C.muted} tamanho={16} />
            </Pressable>
          );
        })}
      </View>
    </Tela>
  );
}
