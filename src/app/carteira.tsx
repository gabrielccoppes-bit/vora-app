import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';

import { DocumentoCarteira } from '@/components/carteira';
import { Botao, Carregando, Interruptor, T, Tela, Topo, useToast } from '@/components/ui';
import { definirCarteiraPublica, linkCarteira, minhaCarteira, type Carteira } from '@/lib/api';
import { compartilhar } from '@/lib/copiar';
import { useSessao } from '@/lib/sessao';
import { C } from '@/theme';

/** Freelancer: carteira de trabalho Vora (histórico verificado) */
export default function MinhaCarteira() {
  const { perfil, recarregarPerfil } = useSessao();
  const toast = useToast();
  const [c, setC] = useState<Carteira | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      minhaCarteira().then(setC).catch(() => setC(null));
    }, [])
  );

  if (c === undefined || !perfil)
    return (
      <Tela>
        <Topo titulo="Carteira de trabalho" />
        <Carregando />
      </Tela>
    );
  if (c === null)
    return (
      <Tela>
        <Topo titulo="Carteira de trabalho" />
        <T style={{ color: C.muted, padding: 20 }}>Disponível para freelancers.</T>
      </Tela>
    );

  const link = linkCarteira(c.codigo);

  async function alternar(v: boolean) {
    setC((x) => (x ? { ...x, publica: v } : x));
    try {
      await definirCarteiraPublica(perfil!.id, v);
      recarregarPerfil();
    } catch {
      setC((x) => (x ? { ...x, publica: !v } : x));
      toast('Não foi possível alterar agora.');
    }
  }

  return (
    <Tela>
      <Topo titulo="Carteira de trabalho" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21, marginBottom: 14 }}>
          Seu histórico no Vora, montado a partir das contratações, check-ins e avaliações. Use como currículo para conseguir mais turnos ou uma vaga fixa.
        </T>
        <DocumentoCarteira c={c} link={c.publica ? link : undefined} />
        <Interruptor
          titulo="Link de verificação"
          sub="Ligado, qualquer pessoa com o link vê esta carteira (sem CPF, telefone ou endereço)."
          valor={c.publica}
          aoMudar={alternar}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Botao
            titulo="Compartilhar"
            icone="compartilhar"
            variante="contorno"
            desativado={!c.publica}
            estilo={{ flex: 1 }}
            onPress={async () => {
              const r = await compartilhar(`Minha carteira de trabalho no Vora, com turnos e avaliações verificados: ${link}`);
              if (r === 'copiado') toast('Link copiado!');
            }}
          />
          {Platform.OS === 'web' ? <Botao titulo="Salvar PDF" icone="baixar" variante="contorno" estilo={{ flex: 1 }} onPress={() => window.print()} /> : null}
        </View>
        {!c.publica ? <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 8 }}>Ligue o link de verificação para compartilhar.</T> : null}
      </View>
    </Tela>
  );
}
