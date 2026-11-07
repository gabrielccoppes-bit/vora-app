import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { CartaoVaga } from '@/components/cartoes';
import { Carregando, Tela, Topo, Vazio } from '@/components/ui';
import { alternarSalvo, vagasCandidatadas, vagasSalvas, type Vaga } from '@/lib/api';
import { useSessao } from '@/lib/sessao';

export default function Lista() {
  const { tipo } = useLocalSearchParams<{ tipo: 'candidaturas' | 'salvos' }>();
  const { perfil } = useSessao();
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const salvos = tipo === 'salvos';

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      (salvos ? vagasSalvas(perfil.id) : vagasCandidatadas(perfil.id)).then(setVagas).catch(() => setVagas([]));
    }, [perfil, salvos])
  );

  return (
    <Tela>
      <Topo titulo={salvos ? 'Vagas salvas' : 'Minhas candidaturas'} />
      <View style={{ paddingHorizontal: 20, gap: 12, paddingTop: 6 }}>
        {vagas === null ? (
          <Carregando />
        ) : vagas.length === 0 ? (
          <Vazio icone={salvos ? 'salvar' : 'enviar'} texto={salvos ? 'Nenhuma vaga salva ainda.' : 'Você ainda não se candidatou a nenhuma vaga.'} />
        ) : (
          vagas.map((v) => (
            <CartaoVaga
              key={v.id}
              vaga={v}
              salvo={salvos}
              aoSalvar={
                salvos
                  ? () => {
                      setVagas((l) => (l ?? []).filter((x) => x.id !== v.id));
                      alternarSalvo(perfil!.id, v.id, false).catch(() => {});
                    }
                  : undefined
              }
            />
          ))
        )}
      </View>
    </Tela>
  );
}
