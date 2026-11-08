import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Estrelas, FolhaAvaliar, NotaResumo, type AlvoAvaliacao } from '@/components/avaliacao';
import { Icone } from '@/components/icone';
import { Avatar, Carregando, T, Tela, Topo, Vazio } from '@/components/ui';
import { contratadosDaEmpresa, minhasContratacoes, type Candidatura } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

/** Item genérico: quem pode ser avaliado numa contratação */
type Item = {
  candidatura: Candidatura;
  vaga: { id: string; titulo: string };
  empresa_id: string;
  alvoId: string; // perfil a abrir ao tocar
  alvoNome: string;
  rota: string;
  media?: number | null;
  total?: number;
  quadrado: boolean;
};

/** Aba de avaliações: o contratante avalia freelancers; o freelancer avalia estabelecimentos */
export default function Avaliar() {
  const { perfil } = useSessao();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [alvo, setAlvo] = useState<AlvoAvaliacao | null>(null);
  const empresa = perfil?.tipo === 'empresa';

  const carregar = useCallback(async () => {
    if (!perfil) return;
    try {
      if (perfil.tipo === 'empresa') {
        const l = await contratadosDaEmpresa(perfil.id);
        setItens(
          l.map((c) => ({
            candidatura: c,
            vaga: c.vaga,
            empresa_id: perfil.id,
            alvoId: c.freelancer_id,
            alvoNome: c.freelancer?.nome ?? 'Freelancer',
            rota: `/freela/${c.freelancer_id}`,
            media: c.freelancer?.nota_media,
            total: c.freelancer?.nota_total,
            quadrado: false,
          }))
        );
      } else {
        const l = await minhasContratacoes(perfil.id);
        setItens(
          l
            .filter((c) => c.vaga)
            .map((c) => ({
              candidatura: c,
              vaga: c.vaga,
              empresa_id: c.vaga.empresa_id,
              alvoId: c.vaga.empresa_id,
              alvoNome: c.vaga.empresa?.nome ?? 'Estabelecimento',
              rota: `/estabelecimento/${c.vaga.empresa_id}`,
              media: c.vaga.empresa?.nota_media,
              total: c.vaga.empresa?.nota_total,
              quadrado: true,
            }))
        );
      }
    } catch {
      setItens([]);
    }
  }, [perfil]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const abrir = (i: Item) =>
    setAlvo({
      direcao: empresa ? 'empresa_para_freela' : 'freela_para_empresa',
      candidatura_id: i.candidatura.id,
      vaga_id: i.vaga.id,
      vaga_titulo: i.vaga.titulo,
      empresa_id: i.empresa_id,
      freelancer_id: i.candidatura.freelancer_id,
      alvo_nome: i.alvoNome,
      existente: i.candidatura.avaliacao,
    });

  const pendentes = (itens ?? []).filter((i) => !i.candidatura.avaliacao);
  const feitas = (itens ?? []).filter((i) => i.candidatura.avaliacao);

  return (
    <Tela>
      <Topo titulo={empresa ? 'Avaliar freelancers' : 'Avaliar estabelecimentos'} />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          {empresa
            ? 'Avalie quem trabalhou com você. As avaliações ficam no perfil do freelancer e ajudam outros estabelecimentos a contratar com segurança.'
            : 'Conte como foi trabalhar em cada lugar. Sua avaliação ajuda outros freelancers a escolher onde trabalhar.'}
        </T>
        {itens === null ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Vazio
            icone="estrela"
            texto={
              empresa
                ? 'Quando você contratar alguém numa vaga (botão "Contratar" na lista de candidatos), a pessoa aparece aqui para avaliar.'
                : 'Quando um estabelecimento te contratar, ele aparece aqui para você avaliar depois do trabalho.'
            }
          />
        ) : (
          <>
            <T style={st.secao}>PARA AVALIAR ({pendentes.length})</T>
            {pendentes.length ? (
              pendentes.map((i) => <Linha key={i.candidatura.id} i={i} onPress={() => abrir(i)} />)
            ) : (
              <T style={{ color: C.muted, marginTop: 6 }}>Tudo em dia. 👏</T>
            )}
            {feitas.length ? (
              <>
                <T style={st.secao}>JÁ AVALIADOS ({feitas.length})</T>
                {feitas.map((i) => (
                  <Linha key={i.candidatura.id} i={i} onPress={() => abrir(i)} />
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

function Linha({ i, onPress }: { i: Item; onPress: () => void }) {
  const av = i.candidatura.avaliacao;
  return (
    <View style={st.linha}>
      <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }} onPress={() => router.push(i.rota as never)}>
        <Avatar nome={i.alvoNome} tamanho={46} quadrado={i.quadrado} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
            {i.alvoNome}
          </T>
          <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
            {i.vaga.titulo} · {tempoRelativo(i.candidatura.criado_em)}
          </T>
          <View style={{ marginTop: 4 }}>{av ? <Estrelas nota={av.nota} tamanho={13} /> : <NotaResumo media={i.media} total={i.total} compacto />}</View>
        </View>
      </Pressable>
      <Pressable style={[st.botao, av && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.stroke }]} onPress={onPress}>
        {av ? <Icone nome="editar" tamanho={15} cor={C.cream} /> : <Icone nome="estrela" tamanho={15} cor={C.onOrange} preenchido />}
        <T style={{ fontSize: 13, fontFamily: F.interSemi, color: av ? C.cream : C.onOrange }}>{av ? 'Editar' : 'Avaliar'}</T>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  secao: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 22, marginBottom: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.linha },
  botao: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: C.orange },
});
