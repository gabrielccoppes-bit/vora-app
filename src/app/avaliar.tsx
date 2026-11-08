import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Estrelas, FolhaAvaliar, NotaResumo, type AlvoAvaliacao } from '@/components/avaliacao';
import { Icone } from '@/components/icone';
import { Avatar, Carregando, T, Tela, Topo, Vazio } from '@/components/ui';
import { contratadosDaEmpresa, type Candidatura } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

type Item = Candidatura & { vaga: { id: string; titulo: string } };

/** Aba do contratante: freelancers contratados para avaliar (e os já avaliados) */
export default function Avaliar() {
  const { perfil } = useSessao();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [alvo, setAlvo] = useState<AlvoAvaliacao | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setItens(await contratadosDaEmpresa(perfil.id).catch(() => []));
  }, [perfil]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const abrir = (c: Item) =>
    setAlvo({
      candidatura_id: c.id,
      vaga_id: c.vaga.id,
      vaga_titulo: c.vaga.titulo,
      empresa_id: perfil!.id,
      freelancer_id: c.freelancer_id,
      freelancer_nome: c.freelancer?.nome ?? 'freelancer',
      existente: c.avaliacao,
    });

  const pendentes = (itens ?? []).filter((c) => !c.avaliacao);
  const feitas = (itens ?? []).filter((c) => c.avaliacao);

  return (
    <Tela>
      <Topo titulo="Avaliar freelancers" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Avalie quem trabalhou com você. As avaliações ficam no perfil do freelancer e ajudam outros estabelecimentos a contratar com segurança.
        </T>
        {itens === null ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Vazio icone="estrela" texto={'Quando você contratar alguém numa vaga (botão "Contratar" na lista de candidatos), a pessoa aparece aqui para avaliar.'} />
        ) : (
          <>
            <T style={st.secao}>PARA AVALIAR ({pendentes.length})</T>
            {pendentes.length ? (
              pendentes.map((c) => <Linha key={c.id} c={c} onPress={() => abrir(c)} />)
            ) : (
              <T style={{ color: C.muted, marginTop: 6 }}>Tudo em dia. 👏</T>
            )}
            {feitas.length ? (
              <>
                <T style={st.secao}>JÁ AVALIADOS ({feitas.length})</T>
                {feitas.map((c) => (
                  <Linha key={c.id} c={c} onPress={() => abrir(c)} />
                ))}
              </>
            ) : null}
          </>
        )}
      </View>
      <FolhaAvaliar alvo={alvo} aoFechar={() => setAlvo(null)} aoSalvar={carregar} />
    </Tela>
  );
}

function Linha({ c, onPress }: { c: Item; onPress: () => void }) {
  return (
    <View style={st.linha}>
      <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }} onPress={() => router.push(`/freela/${c.freelancer_id}`)}>
        <Avatar nome={c.freelancer?.nome ?? '?'} tamanho={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
            {c.freelancer?.nome}
          </T>
          <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
            {c.vaga.titulo} · {tempoRelativo(c.criado_em)}
          </T>
          <View style={{ marginTop: 4 }}>
            {c.avaliacao ? <Estrelas nota={c.avaliacao.nota} tamanho={13} /> : <NotaResumo media={c.freelancer?.nota_media} total={c.freelancer?.nota_total} compacto />}
          </View>
        </View>
      </Pressable>
      <Pressable style={[st.botao, c.avaliacao && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.stroke }]} onPress={onPress}>
        {c.avaliacao ? <Icone nome="editar" tamanho={15} cor={C.cream} /> : <Icone nome="estrela" tamanho={15} cor={C.onOrange} preenchido />}
        <T style={{ fontSize: 13, fontFamily: F.interSemi, color: c.avaliacao ? C.cream : C.onOrange }}>{c.avaliacao ? 'Editar' : 'Avaliar'}</T>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  secao: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 22, marginBottom: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.linha },
  botao: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: C.orange },
});
