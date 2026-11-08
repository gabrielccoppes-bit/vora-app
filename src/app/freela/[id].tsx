import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { CartaoAvaliacao, Estrelas, NotaResumo } from '@/components/avaliacao';
import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, Botao, Carregando, T, Tag, Tela, Topo, Vazio } from '@/components/ui';
import { abrirConversa, avaliacoesDoFreelancer, buscarServico, perfilPublico, type Avaliacao, type Perfil, type Servico } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { dinheiro } from '@/lib/validacao';
import { C, F } from '@/theme';

/** Perfil público do freelancer: serviço + avaliações de estabelecimentos.
 *  Aceita o id do serviço ou o id do freelancer. */
export default function PerfilFreelancer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil: eu } = useSessao();
  const [s, setS] = useState<Servico | null>(null);
  const [p, setP] = useState<Perfil | null | undefined>(undefined);
  const [avals, setAvals] = useState<Avaliacao[] | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      (async () => {
        try {
          const serv = await buscarServico(id);
          const freelaId = serv?.freelancer_id ?? id;
          const [perf, av] = await Promise.all([perfilPublico(freelaId), avaliacoesDoFreelancer(freelaId)]);
          setS(serv);
          setP(perf && perf.tipo === 'freelancer' ? perf : null);
          setAvals(av);
        } catch {
          setP(null);
        }
      })();
    }, [id])
  );

  if (p === undefined) return <Carregando clara />;
  if (p === null)
    return (
      <Tela clara>
        <Topo clara />
        <Vazio texto="Perfil não encontrado." />
      </Tela>
    );

  const meu = p.id === eu?.id;
  // contagem por estrela (5 → 1)
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, q: (avals ?? []).filter((a) => a.nota === n).length }));
  const maxQ = Math.max(1, ...dist.map((d) => d.q));

  return (
    <Tela clara>
      <Topo clara titulo={meu ? 'Meu perfil público' : undefined} />
      <View style={{ alignItems: 'center', paddingHorizontal: 22 }}>
        <Avatar nome={p.nome} tamanho={84} />
        <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 22, marginTop: 14 }}>{p.nome}</T>
        <T style={{ color: C.ink2, fontSize: 15, marginTop: 4 }}>{s?.titulo ?? p.titulo ?? 'Freelancer'}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icone nome="local" tamanho={16} cor="#7A6A61" />
          <T style={{ color: '#7A6A61', fontSize: 13.5 }}>
            {p.cidade}, {p.uf}
          </T>
        </View>
        <View style={{ marginTop: 8 }}>
          <NotaResumo media={p.nota_media} total={p.nota_total} claro />
        </View>
      </View>

      {s ? (
        <>
          <T style={{ color: '#3B2F29', lineHeight: 23, paddingHorizontal: 22, paddingTop: 20 }}>{s.bio}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 22, paddingTop: 14 }}>
            {s.habilidades.map((h) => (
              <Tag key={h} texto={h} />
            ))}
          </View>
        </>
      ) : null}

      <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 22, marginBottom: 6 }} />
      <View style={{ paddingHorizontal: 22 }}>
        {s ? <Meta icone="dinheiro" texto={`A partir de R$ ${dinheiro(s.valor_hora)}/hora`} /> : null}
        {s ? <Meta icone="maleta" texto={s.area} /> : null}
        <Meta icone="escudo" texto={p.verificado ? 'Identidade verificada' : 'CPF validado no cadastro'} />
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
        {meu ? (
          s ? <Botao titulo="Editar meu serviço" icone="editar" variante="contornoEscuro" onPress={() => router.navigate('/publicar')} /> : null
        ) : (
          <Botao
            titulo="Enviar mensagem"
            carregando={abrindo}
            onPress={async () => {
              setAbrindo(true);
              try {
                const c = await abrirConversa(p.id);
                router.push({ pathname: '/chat/[id]', params: { id: c, nome: p.nome } });
              } finally {
                setAbrindo(false);
              }
            }}
          />
        )}
      </View>

      {/* Avaliações dos estabelecimentos */}
      <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 24, marginBottom: 6 }} />
      <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
        <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 18 }}>Avaliações</T>
        {avals === null ? (
          <Carregando clara />
        ) : avals.length === 0 ? (
          <T style={{ color: '#7A6A61', marginTop: 8, lineHeight: 21 }}>
            {meu ? 'Você ainda não tem avaliações. Elas aparecem aqui depois que um estabelecimento te contratar e avaliar.' : 'Ainda sem avaliações. É novo no Vora.'}
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
    </Tela>
  );
}

function Meta({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
      <Icone nome={icone} cor="#2C221D" />
      <T style={{ color: '#2C221D' }}>{texto}</T>
    </View>
  );
}
