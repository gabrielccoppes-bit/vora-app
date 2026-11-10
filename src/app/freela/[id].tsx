import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EtiquetasAreas } from '@/components/areas';
import { Selos } from '@/components/selos';
import { FolhaConvidar, FolhaDenunciar, GradeDisponibilidade, LinhaReputacao } from '@/components/acoes';
import { CartaoAvaliacao, Estrelas, NotaResumo } from '@/components/avaliacao';
import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, Botao, BotaoIcone, Carregando, T, Tag, Tela, Topo, useToast, Vazio } from '@/components/ui';
import {
  abrirConversa,
  alternarFavorito,
  avaliacoesDoFreelancer,
  buscarServico,
  certificadosDe,
  disponibilidadeDe,
  experienciasDe,
  fotoUrl,
  idsBloqueados,
  idsFavoritos,
  perfilPublico,
  type Avaliacao,
  type Certificado,
  type Disponivel,
  type Experiencia,
  type Perfil,
  type Servico,
} from '@/lib/api';
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
  const [agenda, setAgenda] = useState<Disponivel[]>([]);
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [exps, setExps] = useState<Experiencia[]>([]);
  const [favorito, setFavorito] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [menu, setMenu] = useState(false);
  const [convidar, setConvidar] = useState(false);
  const toast = useToast();
  const souEmpresa = eu?.tipo === 'empresa';

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      (async () => {
        try {
          const serv = await buscarServico(id);
          const freelaId = serv?.freelancer_id ?? id;
          const [perf, av, ag, ce, ex, favs, bloq] = await Promise.all([
            perfilPublico(freelaId),
            avaliacoesDoFreelancer(freelaId),
            disponibilidadeDe(freelaId).catch(() => []),
            certificadosDe(freelaId).catch(() => []),
            experienciasDe(freelaId).catch(() => []),
            eu?.tipo === 'empresa' ? idsFavoritos(eu.id).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
            eu ? idsBloqueados(eu.id).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
          ]);
          setS(serv);
          setP(perf && perf.tipo === 'freelancer' ? perf : null);
          setAvals(av);
          setAgenda(ag);
          setCerts(ce);
          setExps(ex);
          setFavorito(favs.has(freelaId));
          setBloqueado(bloq.has(freelaId));
        } catch {
          setP(null);
        }
      })();
    }, [id, eu])
  );

  async function favoritar() {
    if (!eu || !p) return;
    const novo = !favorito;
    setFavorito(novo);
    try {
      await alternarFavorito(eu.id, p.id, novo);
      toast(novo ? 'Salvo nos favoritos' : 'Removido dos favoritos');
    } catch {
      setFavorito(!novo);
    }
  }

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
      <Topo
        clara
        titulo={meu ? 'Meu perfil público' : undefined}
        direita={
          meu ? null : (
            <View style={{ flexDirection: 'row' }}>
              {souEmpresa ? <BotaoIcone nome="estrela" cor={favorito ? C.orange : C.ink} preenchido={favorito} rotulo={favorito ? 'Remover dos favoritos' : 'Favoritar'} onPress={favoritar} /> : null}
              <BotaoIcone nome="opcoes" cor={C.ink} rotulo="Mais opções" onPress={() => setMenu(true)} />
            </View>
          )
        }
      />
      <View style={{ alignItems: 'center', paddingHorizontal: 22 }}>
        <Avatar nome={p.nome} tamanho={84} foto={fotoUrl(p)} />
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
        {p.selos?.length ? (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Selos selos={p.selos} clara />
          </View>
        ) : null}
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
        {(s?.areas?.length ? s.areas : p.areas)?.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 }}>
            <Icone nome="maleta" cor="#2C221D" />
            <View style={{ flex: 1 }}>
              <EtiquetasAreas areas={s?.areas?.length ? s.areas : p.areas} clara />
            </View>
          </View>
        ) : s ? (
          <Meta icone="maleta" texto={s.area} />
        ) : null}
        <Meta icone="escudo" texto={p.verificado ? 'Identidade verificada' : 'CPF validado no cadastro'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Icone nome="check" cor="#2C221D" />
          <LinhaReputacao faltas={p.faltas} cancelamentos={p.cancelamentos} clara />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
        {meu ? (
          s ? <Botao titulo="Editar meu serviço" icone="editar" variante="contornoEscuro" onPress={() => router.navigate('/publicar')} /> : null
        ) : bloqueado ? (
          <T style={{ color: '#7A6A61', textAlign: 'center' }}>Você bloqueou esta pessoa. Toque em ⋯ para desbloquear.</T>
        ) : (
          <View style={{ gap: 10 }}>
          {souEmpresa ? <Botao titulo="Convidar para uma vaga" icone="enviar" onPress={() => setConvidar(true)} /> : null}
          <Botao
            variante={souEmpresa ? 'contornoEscuro' : undefined}
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
          </View>
        )}
      </View>

      {/* Disponibilidade */}
      {agenda.length || meu ? (
        <>
          <Divisor />
          <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
            <Titulo texto="Disponibilidade" acao={meu ? { texto: 'Editar', rota: '/disponibilidade' } : undefined} />
            {agenda.length ? (
              <View style={{ marginTop: 12 }}>
                <GradeDisponibilidade itens={agenda} clara />
              </View>
            ) : (
              <T style={{ color: '#7A6A61', marginTop: 8 }}>Marque os dias e turnos em que você está livre.</T>
            )}
          </View>
        </>
      ) : null}

      {/* Experiência e certificados */}
      {exps.length || certs.length || meu ? (
        <>
          <Divisor />
          <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
            <Titulo texto="Experiência e certificados" acao={meu ? { texto: 'Editar', rota: '/curriculo' } : undefined} />
            {!exps.length && !certs.length ? <T style={{ color: '#7A6A61', marginTop: 8 }}>Adicione onde já trabalhou e seus cursos.</T> : null}
            {exps.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <Icone nome="maleta" cor="#2C221D" tamanho={20} />
                <View style={{ flex: 1 }}>
                  <T style={{ color: C.ink, fontFamily: F.interSemi }}>
                    {e.funcao} · {e.local}
                  </T>
                  {e.periodo ? <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 2 }}>{e.periodo}</T> : null}
                  {e.descricao ? <T style={{ color: '#3B2F29', fontSize: 14, marginTop: 4, lineHeight: 20 }}>{e.descricao}</T> : null}
                </View>
              </View>
            ))}
            {certs.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <Icone nome="arquivo" cor="#2C221D" tamanho={20} />
                <View style={{ flex: 1 }}>
                  <T style={{ color: C.ink, fontFamily: F.interSemi }}>{c.nome}</T>
                  {c.instituicao || c.ano ? <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 2 }}>{[c.instituicao, c.ano].filter(Boolean).join(' · ')}</T> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Avaliações dos estabelecimentos */}
      <Divisor />
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

      <FolhaConvidar visivel={convidar} aoFechar={() => setConvidar(false)} freelancer={{ id: p.id, nome: p.nome }} />
      <FolhaDenunciar visivel={menu} aoFechar={() => setMenu(false)} alvo={{ id: p.id, nome: p.nome }} bloqueado={bloqueado} aoMudarBloqueio={setBloqueado} />
    </Tela>
  );
}

function Divisor() {
  return <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 24, marginBottom: 6 }} />;
}

function Titulo({ texto, acao }: { texto: string; acao?: { texto: string; rota: '/disponibilidade' | '/curriculo' } }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 18 }}>{texto}</T>
      {acao ? (
        <T style={{ color: C.orange, fontFamily: F.interSemi }} onPress={() => router.push(acao.rota)}>
          {acao.texto}
        </T>
      ) : null}
    </View>
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
