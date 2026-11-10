import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CartaoFreela, CartaoVaga } from '@/components/cartoes';
import { Icone } from '@/components/icone';
import { Botao, Carregando, Chip, Folha, T, Tela, Topo, Vazio } from '@/components/ui';
import { alternarSalvo, disponiveisEm, idsBloqueados, idsFavoritos, idsSalvos, listarServicos, listarVagas, turnoAtual, type Servico, type Vaga } from '@/lib/api';
import { distanciaAte, useLocalizacao } from '@/lib/localizacao';
import { useSessao } from '@/lib/sessao';
import { C, CATEGORIAS, CONTRATOS, F, MODALIDADES } from '@/theme';

export default function Buscar() {
  const p = useLocalSearchParams<{ q?: string; seg?: string; urgentes?: string; perto?: string }>();
  const { perfil } = useSessao();
  const { ponto, ativar, estado: estadoLoc } = useLocalizacao();
  const [perto, setPerto] = useState(p.perto === '1');
  const [q, setQ] = useState(p.q ?? '');
  const [termo, setTermo] = useState(p.q ?? '');
  const [seg, setSeg] = useState<'vagas' | 'freelas'>(p.seg === 'freelas' ? 'freelas' : 'vagas');
  const [area, setArea] = useState('Todas');
  const [filt, setFilt] = useState({ modalidade: '', contrato: '', urgentes: p.urgentes === '1' });
  const [verFiltros, setVerFiltros] = useState(false);
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [freelas, setFreelas] = useState<Servico[] | null>(null);
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [livres, setLivres] = useState<'' | 'hoje' | 'agora'>('');
  const minhasAreas = perfil?.tipo === 'freelancer' ? (perfil.areas?.length ? perfil.areas : perfil.area ? [perfil.area] : []) : [];
  const [soMinhas, setSoMinhas] = useState(false);
  const [soFavoritos, setSoFavoritos] = useState(false);

  // parâmetros vindos da tela inicial
  useEffect(() => {
    if (p.q !== undefined) {
      setQ(p.q);
      setTermo(p.q);
    }
    if (p.seg === 'vagas' || p.seg === 'freelas') setSeg(p.seg);
    if (p.urgentes === '1') setFilt((f) => ({ ...f, urgentes: true }));
    if (p.perto === '1') setPerto(true);
  }, [p.q, p.seg, p.urgentes, p.perto]);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    try {
      const bloq = await idsBloqueados(perfil.id).catch(() => new Set<string>());
      if (seg === 'vagas') {
        const v = await listarVagas({ area, areas: soMinhas && area === 'Todas' ? minhasAreas : undefined, q: termo, ...filt });
        setVagas(v.filter((x) => x.empresa_id !== perfil.id && !bloq.has(x.empresa_id)));
        if (perfil.tipo === 'freelancer') setSalvos(await idsSalvos(perfil.id));
      } else {
        const agora = turnoAtual();
        const [s, livresIds, favs] = await Promise.all([
          listarServicos({ area, q: termo, limite: livres || soFavoritos ? 200 : 50 }),
          livres ? disponiveisEm(agora.dia, livres === 'agora' ? agora.turno : undefined) : Promise.resolve(null),
          soFavoritos ? idsFavoritos(perfil.id) : Promise.resolve(null),
        ]);
        setFreelas(
          s.filter(
            (x) => x.freelancer_id !== perfil.id && !bloq.has(x.freelancer_id) && (!livresIds || livresIds.has(x.freelancer_id)) && (!favs || favs.has(x.freelancer_id))
          )
        );
      }
    } catch {
      setVagas([]);
      setFreelas([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, seg, area, termo, filt, livres, soFavoritos, soMinhas]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const lista = seg === 'vagas' ? vagas : freelas;
  const nFiltros = (filt.modalidade ? 1 : 0) + (filt.contrato ? 1 : 0) + (filt.urgentes ? 1 : 0);

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

      {seg === 'vagas' ? (
        <Pressable
          onPress={async () => {
            if (perto && ponto) return setPerto(false);
            if (!ponto && !(await ativar())) return;
            setPerto(true);
          }}
          style={[st.local, perto && ponto ? { borderColor: C.orange, backgroundColor: '#FF5A1214' } : null]}>
          <Icone nome="local" cor={perto && ponto ? C.orange : C.cream} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.interSemi, fontSize: 14.5 }}>
              {perto && ponto ? 'Mostrando as mais próximas de você' : estadoLoc === 'carregando' ? 'Localizando...' : 'Ver vagas mais próximas de mim'}
            </T>
            <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>
              {estadoLoc === 'negado'
                ? 'Localização bloqueada. Libere nas configurações do celular.'
                : perto && ponto
                  ? 'Toque para voltar à ordem normal'
                  : 'Usa sua localização só no celular, sem salvar'}
            </T>
          </View>
          <View style={[st.toggle, perto && ponto ? { backgroundColor: C.orange, alignItems: 'flex-end' } : null]}>
            <View style={st.toggleBola} />
          </View>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14 }} style={{ flexGrow: 0 }}>
          <Chip icone="relogio" texto="Livres hoje" ativo={livres === 'hoje'} onPress={() => setLivres((x) => (x === 'hoje' ? '' : 'hoje'))} />
          <Chip icone="raio" texto="Livres agora" ativo={livres === 'agora'} onPress={() => setLivres((x) => (x === 'agora' ? '' : 'agora'))} />
          {perfil?.tipo === 'empresa' ? <Chip icone="estrela" texto="Favoritos" ativo={soFavoritos} onPress={() => setSoFavoritos((x) => !x)} /> : null}
        </ScrollView>
      )}

      <T style={st.rotulo}>ÁREA</T>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }}>
          {seg === 'vagas' && minhasAreas.length > 1 ? (
            <Chip
              icone="estrela"
              texto="Minhas áreas"
              ativo={soMinhas && area === 'Todas'}
              onPress={() => {
                setArea('Todas');
                setSoMinhas((x) => !(x && area === 'Todas'));
              }}
            />
          ) : null}
          {['Todas', ...CATEGORIAS].map((c) => (
            <Chip
              key={c}
              texto={c}
              ativo={area === c && !(c === 'Todas' && soMinhas)}
              onPress={() => {
                setSoMinhas(false);
                setArea(c);
              }}
            />
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
              ? (perto && ponto
                  ? [...vagas!].sort((a, b) => (distanciaAte(ponto, a.empresa) ?? 1e9) - (distanciaAte(ponto, b.empresa) ?? 1e9))
                  : vagas!
                ).map((v) => (
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
        <View style={[st.chips, { marginTop: 6 }]}>
          <Chip texto="⚡ Só urgentes (hoje/amanhã)" ativo={filt.urgentes} onPress={() => setFilt((f) => ({ ...f, urgentes: !f.urgentes }))} />
        </View>
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
            setFilt({ modalidade: '', contrato: '', urgentes: false });
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
  local: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke },
  toggle: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#3A2E29', padding: 3, justifyContent: 'center' },
  toggleBola: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.cream },
  rotulo: { color: C.muted2, fontSize: 11.5, fontFamily: F.interSemi, letterSpacing: 1.1, paddingHorizontal: 20, marginTop: 14 },
});
