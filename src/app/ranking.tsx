import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NotaResumo } from '@/components/avaliacao';
import { Icone } from '@/components/icone';
import { Selos } from '@/components/selos';
import { Avatar, Carregando, Chip, T, Tela, Topo } from '@/components/ui';
import { fotoUrl, rankingCasas, type CasaRanking } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

type Escopo = 'cidade' | 'estado' | 'brasil';

/** Ranking das melhores casas para trabalhar, segundo os freelancers */
export default function Ranking() {
  const { perfil } = useSessao();
  const [escopo, setEscopo] = useState<Escopo>('cidade');
  const [lista, setLista] = useState<CasaRanking[] | null>(null);
  const [regras, setRegras] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      setLista(null);
      rankingCasas(escopo === 'brasil' ? null : perfil.uf, escopo === 'cidade' ? perfil.cidade : null)
        .then(setLista)
        .catch(() => setLista([]));
    }, [perfil, escopo])
  );

  if (!perfil) return <Carregando />;
  const empresa = perfil.tipo === 'empresa';
  const minhaPos = empresa && lista ? lista.findIndex((c) => c.id === perfil.id) : -1;

  return (
    <Tela>
      <Topo titulo="Melhores casas" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Onde os freelancers mais gostam de trabalhar, pelas avaliações de quem já fez turno lá. Só conta quem trabalhou de verdade.
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Chip texto={perfil.cidade} ativo={escopo === 'cidade'} onPress={() => setEscopo('cidade')} />
          <Chip texto={perfil.uf} ativo={escopo === 'estado'} onPress={() => setEscopo('estado')} />
          <Chip texto="Brasil" ativo={escopo === 'brasil'} onPress={() => setEscopo('brasil')} />
        </View>

        {empresa ? (
          <View style={{ marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: perfil.selos?.includes('casa_vora') ? '#1F7A4C22' : '#FF5A1214', borderWidth: 1, borderColor: perfil.selos?.includes('casa_vora') ? '#1F7A4C' : '#FF5A1240' }}>
            <T style={{ fontFamily: F.interSemi }}>
              {perfil.selos?.includes('casa_vora') ? 'Sua casa tem o selo Casa Vora ✓' : minhaPos >= 0 ? `Sua casa está em ${minhaPos + 1}º lugar` : 'Sua casa ainda não está no ranking'}
            </T>
            <T style={{ color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              {perfil.selos?.includes('casa_vora')
                ? 'O selo aparece no seu perfil e atrai os melhores freelancers. Continue pagando em dia e tratando bem a equipe.'
                : 'Para ganhar o selo Casa Vora: nota 4,5 ou mais em pelo menos 3 avaliações de freelancers, metade delas marcando "Pagou em dia", e no máximo 2 cancelamentos.'}
            </T>
          </View>
        ) : null}

        <Pressable onPress={() => setRegras((x) => !x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <T style={{ color: C.orange2, fontSize: 13, fontFamily: F.interSemi }}>Como funciona o ranking</T>
          <Icone nome={regras ? 'cima' : 'baixo'} tamanho={14} cor={C.orange2} />
        </Pressable>
        {regras ? (
          <T style={{ color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            Usamos a nota média ajustada pela quantidade de avaliações, para que uma casa com uma única nota 5 não passe na frente de quem tem dezenas de avaliações boas. As etiquetas mais marcadas pelos freelancers aparecem em cada casa.
          </T>
        ) : null}

        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <T style={{ color: C.muted2, marginTop: 24, lineHeight: 21 }}>
            Ainda não há casas avaliadas aqui. Depois de cada turno, avalie onde você trabalhou: é assim que o ranking se forma.
          </T>
        ) : (
          <View style={{ marginTop: 16, gap: 10 }}>
            {lista.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/estabelecimento/${c.id}`)}
                style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: c.id === perfil.id ? 1.5 : 1, borderColor: c.id === perfil.id ? C.orange : C.stroke }}>
                <T style={{ fontFamily: F.soraSemi, fontSize: 20, width: 28, color: i < 3 ? C.orange : C.muted, marginTop: 8 }}>{i + 1}</T>
                <Avatar nome={c.nome} tamanho={48} quadrado foto={fotoUrl(c)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontFamily: F.interSemi, fontSize: 15.5 }} numberOfLines={1}>
                    {c.nome}
                    {c.verificado ? <T style={{ color: C.ok, fontSize: 13 }}> ✓</T> : null}
                  </T>
                  <T style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
                    {c.titulo ?? 'Estabelecimento'} · {c.cidade}
                  </T>
                  <View style={{ marginTop: 4 }}>
                    <NotaResumo media={c.nota_media} total={c.nota_total} compacto />
                  </View>
                  {c.selos?.includes('casa_vora') ? (
                    <View style={{ marginTop: 6 }}>
                      <Selos selos={['casa_vora']} />
                    </View>
                  ) : null}
                  {c.destaques.length ? (
                    <T style={{ color: C.muted, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                      {c.destaques.map((d) => `${d.tag} (${d.n})`).join(' · ')}
                    </T>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Tela>
  );
}
