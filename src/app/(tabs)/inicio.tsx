import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartaoFreela, CartaoVaga } from '@/components/cartoes';
import { Icone } from '@/components/icone';
import { Botao, BotaoIcone, Brilho, Carregando, Chip, Folha, T, Vazio } from '@/components/ui';
import { alternarSalvo, candidaturasRecebidas, contratadosDaEmpresa, convitesPendentes, disponibilidadeDe, idsFavoritos, minhasContratacoes, idsSalvos, listarServicos, listarVagas, urgentesAbertas, vagasProximas, type Servico, type Vaga } from '@/lib/api';
import { distanciaAte, useLocalizacao } from '@/lib/localizacao';
import { useSessao } from '@/lib/sessao';
import { primeiroNome, tempoRelativo } from '@/lib/validacao';
import { C, CATEGORIAS, F } from '@/theme';

type Aviso = { texto: string; em: string; vaga: string };

export default function Inicio() {
  const { perfil } = useSessao();
  const { ponto, estado: estadoLoc, ativar } = useLocalizacao();
  const ins = useSafeAreaInsets();
  const [raio, setRaio] = useState(10);
  const [proximas, setProximas] = useState<Vaga[] | null>(null);
  const [paraAvaliar, setParaAvaliar] = useState(0);
  const [convites, setConvites] = useState(0);
  const [semAgenda, setSemAgenda] = useState(false);
  const [nFavoritos, setNFavoritos] = useState(0);
  const [area, setArea] = useState('Todas');
  const [busca, setBusca] = useState('');
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [urgentes, setUrgentes] = useState<Vaga[]>([]);
  const [freelas, setFreelas] = useState<Servico[] | null>(null);
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [verAvisos, setVerAvisos] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const empresa = perfil?.tipo === 'empresa';

  const carregar = useCallback(async () => {
    if (!perfil) return;
    try {
      // tudo em paralelo: a tela não espera uma consulta terminar para começar a próxima
      if (empresa) {
        const [s, cands, contratados, favs] = await Promise.all([
          listarServicos({ area, limite: 6 }),
          candidaturasRecebidas(perfil.id),
          contratadosDaEmpresa(perfil.id),
          idsFavoritos(perfil.id).catch(() => new Set<string>()),
        ]);
        setParaAvaliar(contratados.filter((c) => !c.avaliacao).length);
        setNFavoritos(favs.size);
        setFreelas(s.filter((x) => x.freelancer_id !== perfil.id));
        setVagas([]);
        setAvisos(cands.map((c) => ({ texto: `${c.freelancer?.nome ?? 'Alguém'} se candidatou a ${c.vaga.titulo}`, em: c.criado_em, vaga: c.vaga.id })));
      } else {
        const [v, urg, sv, prox, contratacoes, nConv, agenda] = await Promise.all([
          listarVagas({ area, limite: 8 }),
          urgentesAbertas(),
          idsSalvos(perfil.id),
          ponto ? vagasProximas(ponto, raio, 12) : Promise.resolve(null),
          minhasContratacoes(perfil.id).catch(() => []),
          convitesPendentes(perfil.id).catch(() => 0),
          disponibilidadeDe(perfil.id).catch(() => null),
        ]);
        setConvites(nConv);
        setSemAgenda(agenda !== null && agenda.length === 0);
        setParaAvaliar(contratacoes.filter((c) => !c.avaliacao).length);
        const daArea = (x: Vaga) => area === 'Todas' || x.area === area;
        setVagas(v.filter((x) => x.empresa_id !== perfil.id));
        // urgentes: até 30 km de onde a pessoa está; sem localização, mesma cidade
        setUrgentes(
          urg.filter((x) => {
            if (!daArea(x)) return false;
            const km = distanciaAte(ponto, x.empresa);
            return km != null ? km <= 30 : x.empresa?.cidade?.toLowerCase() === perfil.cidade.toLowerCase();
          })
        );
        setProximas(prox ? prox.filter(daArea) : null);
        setSalvos(sv);
        setAvisos(
          v
            .filter((x) => x.area === perfil.area)
            .slice(0, 4)
            .map((x) => ({ texto: `Nova vaga em ${x.area}: ${x.titulo} — ${x.empresa?.nome}`, em: x.criado_em, vaga: x.id }))
        );
      }
    } catch {
      setVagas((x) => x ?? []);
      setFreelas((x) => x ?? []);
    }
  }, [perfil, area, empresa, ponto, raio]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function salvar(id: string) {
    if (!perfil) return;
    const novo = !salvos.has(id);
    setSalvos((s) => {
      const n = new Set(s);
      if (novo) n.add(id);
      else n.delete(id);
      return n;
    });
    await alternarSalvo(perfil.id, id, novo).catch(() => {});
  }

  if (!perfil) return <Carregando />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          tintColor={C.orange}
          refreshing={atualizando}
          onRefresh={async () => {
            setAtualizando(true);
            await carregar();
            setAtualizando(false);
          }}
        />
      }>
      <View style={[st.hero, { paddingTop: ins.top + 16 }]}>
        <Brilho variante="topo" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.soraSemi, fontSize: 23 }}>Olá, {empresa ? perfil.nome : primeiroNome(perfil.nome)}!</T>
            <T style={{ fontSize: 16, color: '#E9DBD0', marginTop: 8, lineHeight: 22, maxWidth: 260 }}>
              {empresa ? 'Que tal encontrar o talento certo para o seu projeto?' : 'Que tal encontrar uma nova oportunidade hoje?'}
            </T>
          </View>
          <BotaoIcone nome="sino" rotulo="Notificações" onPress={() => setVerAvisos(true)} ponto={avisos.length > 0} />
        </View>
        <View style={st.busca}>
          <Icone nome="buscar" cor={C.ink} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por área, serviço..."
            placeholderTextColor="#8A7A70"
            style={st.buscaInput}
            returnKeyType="search"
            onSubmitEditing={() => router.push({ pathname: '/buscar', params: { q: busca, seg: empresa ? 'freelas' : 'vagas' } })}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 16 }}>
        {['Todas', ...CATEGORIAS].map((c) => (
          <Chip key={c} texto={c} ativo={area === c} onPress={() => setArea(c)} />
        ))}
      </ScrollView>

      <Pressable style={st.banner} onPress={() => (empresa ? router.navigate('/publicar') : router.push({ pathname: '/buscar', params: { seg: 'freelas' } }))}>
        <View style={st.bannerBola} />
        <View style={st.bannerIc}>
          <Icone nome="brilho" cor={C.orange} tamanho={18} />
        </View>
        <T style={{ fontSize: 16.5, lineHeight: 23, fontFamily: F.interMed, maxWidth: 180 }}>
          {empresa ? 'Publique uma vaga em minutos.' : 'Freelancers de alto nível, mais perto de você.'}
        </T>
        <View style={st.bannerSeta}>
          <Icone nome="seta" cor={C.ink} tamanho={18} />
        </View>
      </Pressable>

      {empresa ? (
        <>
          {paraAvaliar > 0 ? (
            <Pressable style={st.ativarLoc} onPress={() => router.push('/avaliar')}>
              <View style={st.ativarIc}>
                <Icone nome="estrela" cor={C.orange} preenchido />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>
                  {paraAvaliar === 1 ? '1 freelancer para avaliar' : `${paraAvaliar} freelancers para avaliar`}
                </T>
                <T style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>Sua avaliação ajuda outros estabelecimentos a contratar bem.</T>
              </View>
              <Icone nome="seta" tamanho={18} cor={C.muted} />
            </Pressable>
          ) : null}
          {nFavoritos > 0 ? (
            <Cartao icone="estrela" titulo={`Seus favoritos (${nFavoritos})`} sub="Chame de novo quem já trabalhou bem com você." onPress={() => router.push('/favoritos')} />
          ) : null}
          <Cabecalho titulo="Freelancers em destaque" onVer={() => router.push({ pathname: '/buscar', params: { seg: 'freelas' } })} />
          <View style={st.lista}>
            {freelas === null ? <Carregando /> : freelas.length ? freelas.map((s) => <CartaoFreela key={s.id} servico={s} />) : <Vazio texto="Nenhum freelancer nessa categoria ainda." />}
          </View>
        </>
      ) : (
        <>
          {paraAvaliar > 0 ? (
            <Pressable style={st.ativarLoc} onPress={() => router.push('/avaliar')}>
              <View style={st.ativarIc}>
                <Icone nome="estrela" cor={C.orange} preenchido />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>
                  {paraAvaliar === 1 ? 'Avalie onde você trabalhou' : `${paraAvaliar} estabelecimentos para avaliar`}
                </T>
                <T style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>Sua opinião ajuda outros freelancers a escolher onde trabalhar.</T>
              </View>
              <Icone nome="seta" tamanho={18} cor={C.muted} />
            </Pressable>
          ) : null}
          {convites > 0 ? (
            <Cartao
              icone="enviar"
              destaque
              titulo={convites === 1 ? 'Você tem 1 convite' : `Você tem ${convites} convites`}
              sub="Estabelecimentos querem você na equipe. Responda logo!"
              onPress={() => router.push('/convites')}
            />
          ) : null}
          {semAgenda ? (
            <Cartao icone="relogio" titulo="Marque sua disponibilidade" sub="Quem informa os dias e turnos livres aparece primeiro para os estabelecimentos." onPress={() => router.push('/disponibilidade')} />
          ) : null}
          {urgentes.length ? (
            <>
              <Cabecalho titulo={ponto ? '⚡ Urgentes perto de você' : `⚡ Urgentes em ${perfil.cidade}`} onVer={() => router.push({ pathname: '/buscar', params: { seg: 'vagas', urgentes: '1' } })} />
              <View style={st.lista}>
                {urgentes.slice(0, 3).map((v) => (
                  <CartaoVaga key={v.id} vaga={v} salvo={salvos.has(v.id)} aoSalvar={() => salvar(v.id)} />
                ))}
              </View>
            </>
          ) : null}
          {ponto ? (
            <>
              <Cabecalho titulo="Perto de você" onVer={() => router.push({ pathname: '/buscar', params: { seg: 'vagas', perto: '1' } })} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
                {[5, 10, 25, 50].map((km) => (
                  <Chip key={km} texto={`até ${km} km`} ativo={raio === km} onPress={() => setRaio(km)} />
                ))}
              </ScrollView>
              <View style={st.lista}>
                {proximas === null ? (
                  <Carregando />
                ) : proximas.filter((v) => !urgentes.some((u) => u.id === v.id)).length ? (
                  proximas
                    .filter((v) => !urgentes.some((u) => u.id === v.id))
                    .slice(0, 5)
                    .map((v) => <CartaoVaga key={v.id} vaga={v} salvo={salvos.has(v.id)} aoSalvar={() => salvar(v.id)} />)
                ) : (
                  <Vazio icone="local" texto={`Nenhuma vaga em até ${raio} km agora. Tente aumentar o raio.`} />
                )}
              </View>
            </>
          ) : (
            <View style={st.ativarLoc}>
              <View style={st.ativarIc}>
                <Icone nome="local" cor={C.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>Vagas perto de você</T>
                <T style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                  {estadoLoc === 'negado'
                    ? 'A localização está bloqueada. Libere nas configurações do celular para ver a distância das vagas.'
                    : 'Use sua localização para ver as vagas mais próximas. Ela fica só no seu celular.'}
                </T>
                {estadoLoc !== 'negado' ? (
                  <Botao titulo={estadoLoc === 'carregando' ? 'Localizando...' : 'Usar minha localização'} icone="local" carregando={estadoLoc === 'carregando'} onPress={ativar} estilo={{ height: 42, marginTop: 12 }} />
                ) : null}
              </View>
            </View>
          )}
          <Cabecalho titulo="Vagas em destaque" onVer={() => router.push({ pathname: '/buscar', params: { seg: 'vagas' } })} />
          <View style={st.lista}>
            {vagas === null ? (
              <Carregando />
            ) : vagas.some((v) => !urgentes.some((u) => u.id === v.id)) ? (
              vagas.filter((v) => !urgentes.some((u) => u.id === v.id)).map((v) => <CartaoVaga key={v.id} vaga={v} salvo={salvos.has(v.id)} aoSalvar={() => salvar(v.id)} />)
            ) : (
              <Vazio texto={urgentes.length ? 'Por enquanto, só as urgentes acima.' : 'Nenhuma vaga nessa categoria ainda.'} />
            )}
          </View>
        </>
      )}

      <Folha visivel={verAvisos} aoFechar={() => setVerAvisos(false)} titulo="Notificações">
        {avisos.length ? (
          avisos.map((a, i) => (
            <Pressable
              key={i}
              style={st.aviso}
              onPress={() => {
                setVerAvisos(false);
                router.push(`/vaga/${a.vaga}`);
              }}>
              <View style={st.avisoIc}>
                <Icone nome={empresa ? 'pessoas' : 'brilho'} cor={C.orange} tamanho={17} />
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 14, lineHeight: 20 }}>{a.texto}</T>
                <T style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{tempoRelativo(a.em)}</T>
              </View>
            </Pressable>
          ))
        ) : (
          <T style={{ color: C.muted }}>Nenhuma notificação por enquanto.</T>
        )}
      </Folha>
    </ScrollView>
  );
}

function Cartao({ icone, titulo, sub, onPress, destaque }: { icone: 'estrela' | 'enviar' | 'relogio'; titulo: string; sub: string; onPress: () => void; destaque?: boolean }) {
  return (
    <Pressable style={[st.ativarLoc, destaque && { borderColor: C.orange, backgroundColor: '#FF5A1214' }]} onPress={onPress}>
      <View style={st.ativarIc}>
        <Icone nome={icone} cor={C.orange} preenchido={icone === 'estrela'} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>{titulo}</T>
        <T style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{sub}</T>
      </View>
      <Icone nome="seta" tamanho={18} cor={C.muted} />
    </Pressable>
  );
}

function Cabecalho({ titulo, onVer }: { titulo: string; onVer: () => void }) {
  return (
    <View style={st.cab}>
      <T style={{ fontSize: 18, fontFamily: F.interMed }}>{titulo}</T>
      <Pressable onPress={onVer} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <T style={{ fontSize: 13.5, color: '#E6D6CA' }}>Ver todas</T>
        <Icone nome="seta" tamanho={16} cor="#E6D6CA" />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 6, overflow: 'hidden' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 28, backgroundColor: C.cream, paddingHorizontal: 18, marginTop: 20 },
  buscaInput: { flex: 1, fontSize: 15, color: C.ink, fontFamily: F.inter, height: '100%' },
  banner: { marginHorizontal: 20, marginTop: 16, borderRadius: 24, padding: 22, minHeight: 118, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#1F1613', borderWidth: 1, borderColor: '#3A2A24', overflow: 'hidden' },
  bannerBola: { position: 'absolute', right: -50, bottom: -70, width: 220, height: 180, borderRadius: 110, backgroundColor: C.orange, transform: [{ rotate: '-25deg' }] },
  bannerIc: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF5A1222', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  bannerSeta: { position: 'absolute', right: 18, bottom: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  cab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  lista: { paddingHorizontal: 20, gap: 12 },
  ativarLoc: { flexDirection: 'row', gap: 14, marginHorizontal: 20, marginTop: 22, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke },
  ativarIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5A1220', alignItems: 'center', justifyContent: 'center' },
  aviso: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.linha },
  avisoIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF5A1220', alignItems: 'center', justifyContent: 'center' },
});
