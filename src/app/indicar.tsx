import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { Icone } from '@/components/icone';
import { Botao, Carregando, T, Tela, Topo, useToast } from '@/components/ui';
import { linkIndicacao, minhasIndicacoes, type Indicado } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

/** Indique o Vora: código/link pessoal e quem entrou pelo convite */
export default function Indicar() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [lista, setLista] = useState<Indicado[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      minhasIndicacoes().then(setLista).catch(() => setLista([]));
    }, [])
  );

  if (!perfil?.codigo) return <Tela><Topo titulo="Indique o Vora" /><Carregando /></Tela>;
  const link = linkIndicacao(perfil.codigo);
  const empresa = perfil.tipo === 'empresa';
  const mensagem = empresa
    ? `Estamos usando o Vora para achar freelancers para bares e restaurantes em Porto Alegre. Cadastre-se pelo meu convite: ${link}`
    : `Tô usando o Vora para pegar turnos em bares e restaurantes de Porto Alegre. Entra pelo meu convite: ${link}`;

  async function compartilhar() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (navigator.share) await navigator.share({ title: 'Vora', text: mensagem });
        else {
          await navigator.clipboard.writeText(mensagem);
          toast('Convite copiado! Cole no WhatsApp.');
        }
      } else await Share.share({ message: mensagem });
    } catch {
      // a pessoa cancelou
    }
  }

  const concluidos = (lista ?? []).filter((i) => i.primeiro_turno_em).length;

  return (
    <Tela>
      <Topo titulo="Indique o Vora" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          {empresa
            ? 'Conhece outro bar, restaurante ou casa noturna que precisa de freelancers? Mande seu convite.'
            : 'Conhece alguém bom de serviço? Mande seu convite. Quanto mais gente boa no Vora, mais turnos para todo mundo.'}
        </T>
        <View style={{ marginTop: 18, padding: 20, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.orange, alignItems: 'center' }}>
          <T style={{ color: C.muted, fontSize: 13 }}>Seu código</T>
          <T style={{ fontFamily: F.soraSemi, fontSize: 34, letterSpacing: 6, marginTop: 4 }} selectable>
            {perfil.codigo}
          </T>
          <T style={{ color: C.muted2, fontSize: 12, marginTop: 6, textAlign: 'center' }} selectable numberOfLines={1}>
            {link.replace('https://', '')}
          </T>
          <Botao titulo="Enviar convite" icone="compartilhar" onPress={compartilhar} estilo={{ marginTop: 16, alignSelf: 'stretch' }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Numero v={String(lista?.length ?? 0)} r="entraram pelo seu convite" />
          <Numero v={String(concluidos)} r="já completaram o 1º turno" />
        </View>

        <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 12, letterSpacing: 1.1, marginTop: 24, marginBottom: 10 }}>SUAS INDICAÇÕES</T>
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <T style={{ color: C.muted2 }}>Ninguém ainda. Quem se cadastrar pelo seu link aparece aqui.</T>
        ) : (
          lista.map((i, n) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginBottom: 8 }}>
              <Icone nome={i.tipo === 'empresa' ? 'predio' : 'usuario'} cor={C.orange} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi }}>{i.nome}</T>
                <T style={{ color: C.muted, fontSize: 12.5 }}>
                  {i.tipo === 'empresa' ? 'Estabelecimento' : 'Freelancer'} · entrou {tempoRelativo(i.criado_em)}
                </T>
              </View>
              <T style={{ color: i.primeiro_turno_em ? '#7FD3A0' : C.muted2, fontSize: 12.5, fontFamily: F.interSemi }}>{i.primeiro_turno_em ? '1º turno ✓' : 'Aguardando'}</T>
            </View>
          ))
        )}
        <Pressable disabled>
          <T style={{ color: C.muted2, fontSize: 12, marginTop: 14, lineHeight: 17 }}>
            Em breve: benefícios para quem indica, quando o pagamento pelo app estiver ativo. Mostramos só o primeiro nome de quem você indicou.
          </T>
        </Pressable>
      </View>
    </Tela>
  );
}

function Numero({ v, r }: { v: string; r: string }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 24 }}>{v}</T>
      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{r}</T>
    </View>
  );
}
