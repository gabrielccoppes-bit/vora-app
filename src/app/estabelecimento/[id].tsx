import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { CartaoAvaliacao, Estrelas, NotaResumo } from '@/components/avaliacao';
import { CartaoVaga } from '@/components/cartoes';
import { Icone } from '@/components/icone';
import { Avatar, Carregando, T, Tela, Topo, Vazio } from '@/components/ui';
import { avaliacoesDoEstabelecimento, perfilPublico, vagasDoEstabelecimento, type Avaliacao, type Perfil, type Vaga } from '@/lib/api';
import { distanciaAte, fmtDistancia, useLocalizacao } from '@/lib/localizacao';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

/** Página pública do estabelecimento: nota, avaliações dos freelancers e vagas abertas */
export default function Estabelecimento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil: eu } = useSessao();
  const { ponto } = useLocalizacao();
  const [p, setP] = useState<Perfil | null | undefined>(undefined);
  const [avals, setAvals] = useState<Avaliacao[] | null>(null);
  const [vagas, setVagas] = useState<Vaga[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([perfilPublico(id), avaliacoesDoEstabelecimento(id), vagasDoEstabelecimento(id)])
        .then(([perf, av, vs]) => {
          setP(perf && perf.tipo === 'empresa' ? perf : null);
          setAvals(av);
          setVagas(vs);
        })
        .catch(() => setP(null));
    }, [id])
  );

  if (p === undefined) return <Carregando clara />;
  if (p === null)
    return (
      <Tela clara>
        <Topo clara />
        <Vazio texto="Estabelecimento não encontrado." />
      </Tela>
    );

  const meu = p.id === eu?.id;
  const km = distanciaAte(ponto, p);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, q: (avals ?? []).filter((a) => a.nota === n).length }));
  const maxQ = Math.max(1, ...dist.map((d) => d.q));

  return (
    <Tela clara>
      <Topo clara titulo={meu ? 'Meu estabelecimento' : undefined} />
      <View style={{ alignItems: 'center', paddingHorizontal: 22 }}>
        <Avatar nome={p.nome} tamanho={84} quadrado />
        <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 22, marginTop: 14, textAlign: 'center' }}>{p.nome}</T>
        <T style={{ color: C.ink2, fontSize: 15, marginTop: 4 }}>{p.titulo ?? 'Estabelecimento'}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icone nome="local" tamanho={16} cor="#7A6A61" />
          <T style={{ color: '#7A6A61', fontSize: 13.5 }}>
            {km != null ? `${fmtDistancia(km)} · ` : ''}
            {p.cidade}, {p.uf}
          </T>
        </View>
        <View style={{ marginTop: 8 }}>
          <NotaResumo media={p.nota_media} total={p.nota_total} claro />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 22, marginBottom: 6 }} />
      <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
        <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 18 }}>O que dizem os freelancers</T>
        {avals === null ? (
          <Carregando clara />
        ) : avals.length === 0 ? (
          <T style={{ color: '#7A6A61', marginTop: 8, lineHeight: 21 }}>
            {meu
              ? 'Você ainda não tem avaliações. Os freelancers contratados por você podem avaliar o estabelecimento depois do trabalho.'
              : 'Ainda sem avaliações de freelancers.'}
          </T>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center', marginTop: 12, marginBottom: 14 }}>
              <View style={{ alignItems: 'center' }}>
                <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 40, lineHeight: 46 }}>{Number(p.nota_media ?? 0).toFixed(1).replace('.', ',')}</T>
                <Estrelas nota={Number(p.nota_media ?? 0)} tamanho={14} />
                <T style={{ color: '#7A6A61', fontSize: 12, marginTop: 4 }}>
                  {p.nota_total} {p.nota_total === 1 ? 'avaliação' : 'avaliações'}
                </T>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                {dist.map((d) => (
                  <View key={d.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T style={{ color: C.ink2, fontSize: 12, width: 10 }}>{d.n}</T>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EADBCF' }}>
                      <View style={{ width: `${(d.q / maxQ) * 100}%`, height: 6, borderRadius: 3, backgroundColor: C.orange }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {avals.map((a) => (
                <CartaoAvaliacao key={a.id} a={a} />
              ))}
            </View>
          </>
        )}
      </View>

      {vagas.length ? (
        <>
          <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 24, marginBottom: 6 }} />
          <View style={{ paddingHorizontal: 22, paddingTop: 10, gap: 12 }}>
            <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 18 }}>Vagas abertas ({vagas.length})</T>
            {vagas.map((v) => (
              <View key={v.id} style={{ borderWidth: 1, borderColor: '#ECDCCF', borderRadius: 22 }}>
                <CartaoVaga vaga={v} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Tela>
  );
}
