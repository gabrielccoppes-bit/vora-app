import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CartaoFreela, CartaoVaga } from '@/components/cartoes';
import { Icone } from '@/components/icone';
import { Botao, Carregando, Chip, Folha, T, Tela, Topo, Vazio } from '@/components/ui';
import { alternarSalvo, idsSalvos, listarServicos, listarVagas, type Servico, type Vaga } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, CATEGORIAS, CONTRATOS, F, MODALIDADES } from '@/theme';

export default function Buscar() {
  const p = useLocalSearchParams<{ q?: string; seg?: string }>();
  const { perfil } = useSessao();
  const [q, setQ] = useState(p.q ?? '');
  const [termo, setTermo] = useState(p.q ?? '');
  const [seg, setSeg] = useState<'vagas' | 'freelas'>(p.seg === 'freelas' ? 'freelas' : 'vagas');
  const [area, setArea] = useState('Todas');
  const [filt, setFilt] = useState({ modalidade: '', contrato: '' });
  const [verFiltros, setVerFiltros] = useState(false);
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [freelas, setFreelas] = useState<Servico[] | null>(null);
  const [salvos, setSalvos] = useState<Set<string>>(new Set());

  // parâmetros vindos da tela inicial
  useEffect(() => {
    if (p.q !== undefined) {
      setQ(p.q);
      setTermo(p.q);
    }
    if (p.seg === 'vagas' || p.seg === 'freelas') setSeg(p.seg);
  }, [p.q, p.seg]);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    try {
      if (seg === 'vagas') {
        setVagas(null);
        const v = await listarVagas({ area, q: termo, ...filt });
        setVagas(v.filter((x) => x.empresa_id !== perfil.id));
        if (perfil.tipo === 'freelancer') setSalvos(await idsSalvos(perfil.id));
      } else {
        setFreelas(null);
        const s = await listarServicos({ area, q: termo });
        setFreelas(s.filter((x) => x.freelancer_id !== perfil.id));
      }
    } catch {
      setVagas([]);
      setFreelas([]);
    }
  }, [perfil, seg, area, termo, filt]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const lista = seg === 'vagas' ? vagas : freelas;
  const nFiltros = (filt.modalidade ? 1 : 0) + (filt.contrato ? 1 : 0);

  return (
    <Tela rolar={false}>
      <Topo titulo="Buscar" voltar={false} />
      <View style={st.busca}>
        <Icone nome="buscar" />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setTermo(q)}
          returnKeyType="search"
          placeholder={seg === 'vagas' ? 'Cargo, área, palavra-chave...' : 'Serviço, habilidade...'}
          placeholderTextColor={C.muted2}
          style={st.input}
        />
        {q ? (
          <Pressable
            onPress={() => {
              setQ('');
              setTermo('');
            }}
            hitSlop={8}>
            <Icone nome="fechar" tamanho={18} cor={C.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={st.seg}>
        {(['vagas', 'freelas'] as const).map((k) => (
          <Pressable key={k} onPress={() => setSeg(k)} style={[st.segBtn, seg === k && { backgroundColor: C.cream }]}>
            <T style={{ fontSize: 14, fontFamily: seg === k ? F.interSemi : F.interMed, color: seg === k ? C.ink : C.muted }}>{k === 'vagas' ? 'Vagas' : 'Freelancers'}</T>
          </Pressable>
        ))}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 14 }}>
          {['Todas', ...CATEGORIAS].map((c) => (
            <Chip key={c} texto={c} ativo={area === c} onPress={() => setArea(c)} />
          ))}
          {seg === 'vagas' ? <Chip icone="filtros" ativo={nFiltros > 0} onPress={() => setVerFiltros(true)} /> : null}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, gap: 12 }} keyboardShouldPersistTaps="handled">
        {lista === null ? (
          <Carregando />
        ) : (
          <>
            <T style={{ color: C.muted, fontSize: 13 }}>
              {lista.length} {seg === 'vagas' ? (lista.length === 1 ? 'vaga encontrada' : 'vagas encontradas') : lista.length === 1 ? 'freelancer' : 'freelancers'}
              {seg === 'vagas' && nFiltros ? ` · ${nFiltros} filtro${nFiltros > 1 ? 's' : ''}` : ''}
            </T>
            {lista.length === 0 ? <Vazio texto="Nada encontrado. Tente outro termo ou categoria." /> : null}
            {seg === 'vagas'
              ? vagas!.map((v) => (
                  <CartaoVaga
                    key={v.id}
                    vaga={v}
                    salvo={salvos.has(v.id)}
                    aoSalvar={
                      perfil?.tipo === 'freelancer'
                        ? () => {
                            const novo = !salvos.has(v.id);
                            setSalvos((s) => {
                              const n = new Set(s);
                              if (novo) n.add(v.id);
                              else n.delete(v.id);
                              return n;
                            });
                            alternarSalvo(perfil.id, v.id, novo).catch(() => {});
                          }
                        : undefined
                    }
                  />
                ))
              : freelas!.map((s) => <CartaoFreela key={s.id} servico={s} />)}
          </>
        )}
      </ScrollView>

      <Folha visivel={verFiltros} aoFechar={() => setVerFiltros(false)} titulo="Filtros">
        <T style={{ color: C.muted, marginTop: 6, marginBottom: 8 }}>Modalidade</T>
        <View style={st.chips}>
          {MODALIDADES.map((m) => (
            <Chip key={m} texto={m} ativo={filt.modalidade === m} onPress={() => setFilt((f) => ({ ...f, modalidade: f.modalidade === m ? '' : m }))} />
          ))}
        </View>
        <T style={{ color: C.muted, marginTop: 18, marginBottom: 8 }}>Contrato</T>
        <View style={st.chips}>
          {CONTRATOS.map((m) => (
            <Chip key={m} texto={m} ativo={filt.contrato === m} onPress={() => setFilt((f) => ({ ...f, contrato: f.contrato === m ? '' : m }))} />
          ))}
        </View>
        <Botao titulo="Ver vagas" onPress={() => setVerFiltros(false)} estilo={{ marginTop: 22 }} />
        <Botao
          titulo="Limpar filtros"
          variante="fantasma"
          onPress={() => {
            setFilt({ modalidade: '', contrato: '' });
            setVerFiltros(false);
          }}
        />
      </Folha>
    </Tela>
  );
}

const st = StyleSheet.create({
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 26, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke, paddingHorizontal: 16, marginHorizontal: 20 },
  input: { flex: 1, fontSize: 15, color: C.cream, fontFamily: F.inter, height: '100%' },
  seg: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, backgroundColor: C.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.stroke },
  segBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
