import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Botao, Campo, Chip, T, Tela, Topo, useToast } from '@/components/ui';
import { enviarFeedback, type TipoFeedback } from '@/lib/api';
import { C, F } from '@/theme';

const TIPOS: { id: TipoFeedback; nome: string; dica: string }[] = [
  { id: 'problema', nome: 'Algo deu errado', dica: 'Conte o que você tentou fazer e o que aconteceu. Se der, diga em qual tela.' },
  { id: 'sugestao', nome: 'Tenho uma ideia', dica: 'O que faria o Vora funcionar melhor para você?' },
  { id: 'elogio', nome: 'Quero elogiar', dica: 'O que você mais gostou? Isso ajuda a saber o que manter.' },
];

function aparelho() {
  const versao = Constants.expoConfig?.version ?? '';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') return `site ${versao} · ${navigator.userAgent.slice(0, 120)}`;
  return `${Platform.OS} ${String(Platform.Version)} · app ${versao}`;
}

/** Relatar problema, sugerir ou elogiar: vai direto para a equipe do Vora */
export default function Feedback() {
  const { tela } = useLocalSearchParams<{ tela?: string }>();
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoFeedback>('problema');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (texto.trim().length < 5) return toast('Escreva um pouco mais, por favor.');
    setEnviando(true);
    try {
      await enviarFeedback(tipo, texto, tela ? String(tela).slice(0, 120) : null, aparelho());
      setEnviado(true);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Topo titulo="Fale com o Vora" />
      <View style={{ paddingHorizontal: 20 }}>
        {enviado ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <T style={{ fontSize: 44 }}>🧡</T>
            <T style={{ fontFamily: F.soraSemi, fontSize: 22, marginTop: 10 }}>Recebemos, obrigado!</T>
            <T style={{ color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
              A equipe do Vora lê tudo. Se precisarmos de mais detalhes, falamos com você.
            </T>
            <Botao titulo="Voltar" onPress={() => router.back()} estilo={{ marginTop: 24, alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <T style={{ color: C.muted, lineHeight: 21 }}>Estamos no começo e cada mensagem ajuda a decidir o que melhorar primeiro.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {TIPOS.map((t) => (
                <Chip key={t.id} texto={t.nome} ativo={tipo === t.id} onPress={() => setTipo(t.id)} />
              ))}
            </View>
            <Campo
              rotulo="Sua mensagem"
              valor={texto}
              aoMudar={setTexto}
              placeholder={TIPOS.find((t) => t.id === tipo)?.dica}
              multiline
              maxLength={2000}
            />
            <T style={{ color: C.muted2, fontSize: 12, marginTop: 8 }}>Junto vai o modelo do aparelho e a versão do app, para acharmos o problema mais rápido.</T>
            <Botao titulo="Enviar" onPress={enviar} carregando={enviando} estilo={{ marginTop: 18 }} />
          </>
        )}
      </View>
    </Tela>
  );
}
