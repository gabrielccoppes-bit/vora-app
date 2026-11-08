import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { SeloUrgente } from '@/components/cartoes';
import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, BotaoIcone, Botao, Campo, Carregando, Folha, T, Tag, Tela, Topo, useToast, Vazio } from '@/components/ui';
import {
  abrirConversa,
  alternarSalvo,
  buscarVaga,
  candidatar,
  candidatosDaVaga,
  enviarMensagem,
  encerrarVaga,
  faixaSalarial,
  idsSalvos,
  minhaCandidatura,
  quandoComeca,
  totalCandidaturas,
  urgenteAtiva,
  type Candidatura,
  type Vaga,
} from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function DetalheVaga() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSessao();
  const toast = useToast();
  const [vaga, setVaga] = useState<Vaga | null | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [minha, setMinha] = useState<Candidatura | null>(null);
  const [salva, setSalva] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidatura[]>([]);
  const [folha, setFolha] = useState<'candidatar' | 'encerrar' | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const dono = !!vaga && vaga.empresa_id === perfil?.id;
  const empresa = perfil?.tipo === 'empresa';

  useFocusEffect(
    useCallback(() => {
      if (!perfil || !id) return;
      (async () => {
        try {
          const v = await buscarVaga(id);
          setVaga(v);
          if (!v) return;
          const dono = v.empresa_id === perfil.id;
          const freela = perfil.tipo === 'freelancer';
          const [t, cands, minhaC, salvos] = await Promise.all([
            totalCandidaturas(id),
            dono ? candidatosDaVaga(id) : Promise.resolve([]),
            freela ? minhaCandidatura(id, perfil.id) : Promise.resolve(null),
            freela ? idsSalvos(perfil.id) : Promise.resolve(new Set<string>()),
          ]);
          setTotal(t);
          setCandidatos(cands);
          setMinha(minhaC);
          setSalva(salvos.has(id));
        } catch {
          setVaga(null);
        }
      })();
    }, [id, perfil])
  );

  async function enviarCandidatura() {
    if (!vaga || !perfil) return;
    setEnviando(true);
    try {
      await candidatar(vaga.id, perfil.id, mensagem.trim());
      // abre a conversa com a empresa já com a apresentação
      const conversa = await abrirConversa(vaga.empresa_id);
      await enviarMensagem(conversa, `Olá! Acabei de me candidatar à vaga de ${vaga.titulo}.${mensagem.trim() ? ' ' + mensagem.trim() : ''}`);
      setMinha(await minhaCandidatura(vaga.id, perfil.id));
      setTotal((t) => t + 1);
      setFolha(null);
      setMensagem('');
      toast('Candidatura enviada!');
    } catch (e) {
      toast((e as Error).message.includes('duplicate') ? 'Você já se candidatou a esta vaga.' : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarSalva() {
    if (!perfil || !vaga) return;
    const nova = !salva;
    setSalva(nova);
    toast(nova ? 'Vaga salva' : 'Vaga removida dos salvos');
    await alternarSalvo(perfil.id, vaga.id, nova).catch(() => setSalva(!nova));
  }

  async function conversarCom(outroId: string, nome: string) {
    const conversa = await abrirConversa(outroId);
    router.push({ pathname: '/chat/[id]', params: { id: conversa, nome } });
  }

  if (vaga === undefined) return <Carregando clara />;
  if (vaga === null)
    return (
      <Tela clara>
        <Topo clara />
        <Vazio texto="Esta vaga não existe mais ou foi encerrada." />
      </Tela>
    );

  return (
    <Tela clara>
      <Topo
        clara
        direita={
          <>
            <BotaoIcone
              nome="compartilhar"
              cor={C.ink}
              rotulo="Compartilhar"
              onPress={() => Share.share({ message: `${vaga.titulo} — ${vaga.empresa?.nome} (${vaga.modalidade}, ${faixaSalarial(vaga)}). Veja no Vora.` }).catch(() => {})}
            />
            {!empresa ? <BotaoIcone nome="salvar" cor={C.ink} preenchido={salva} rotulo="Salvar vaga" onPress={alternarSalva} /> : null}
          </>
        }
      />
      <View style={st.cab}>
        <Avatar nome={vaga.empresa?.nome ?? '?'} tamanho={66} quadrado />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 19 }}>{vaga.empresa?.nome}</T>
            {vaga.empresa?.verificado ? (
              <View style={st.verif}>
                <Icone nome="check" tamanho={11} cor="#fff" espessura={3} />
              </View>
            ) : null}
          </View>
          <T style={{ color: C.ink2, fontSize: 13.5, marginTop: 4 }}>
            {vaga.empresa?.titulo} · {vaga.empresa?.cidade}, {vaga.empresa?.uf}
          </T>
        </View>
      </View>

      {urgenteAtiva(vaga) ? (
        <View style={{ paddingHorizontal: 22, marginTop: 6 }}>
          <SeloUrgente inicio={vaga.inicio_em!} />
        </View>
      ) : null}
      <T style={[st.titulo, urgenteAtiva(vaga) && { paddingTop: 12 }]}>{vaga.titulo}</T>
      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 22, flexWrap: 'wrap' }}>
        <Tag texto={vaga.modalidade} />
        <Tag texto={vaga.contrato} />
        <Tag texto={vaga.nivel} />
      </View>
      <T style={st.desc}>{vaga.descricao}</T>
      {vaga.requisitos.length ? (
        <View style={{ paddingHorizontal: 22, paddingTop: 10, gap: 4 }}>
          {vaga.requisitos.map((r) => (
            <T key={r} style={{ color: '#3B2F29', lineHeight: 24 }}>
              •  {r}
            </T>
          ))}
        </View>
      ) : null}

      <View style={st.hr} />
      <View style={{ paddingHorizontal: 22 }}>
        {vaga.urgente && vaga.inicio_em ? <Meta icone="raio" texto={`Começa ${quandoComeca(vaga.inicio_em)}`} /> : null}
        <Meta icone="relogio" texto={vaga.ativa ? `Publicada ${tempoRelativo(vaga.criado_em)}` : 'Vaga encerrada'} />
        <Meta icone="dinheiro" texto={faixaSalarial(vaga)} />
        <Meta icone="maleta" texto={vaga.duracao} />
        <Meta icone="pessoas" texto={`${total} candidatura${total === 1 ? '' : 's'}`} />
      </View>

      {dono ? (
        <>
          <View style={st.hr} />
          <T style={{ color: C.ink, fontFamily: F.interMed, fontSize: 18, paddingHorizontal: 22, marginBottom: 10 }}>Candidatos</T>
          <View style={{ paddingHorizontal: 22, gap: 10 }}>
            {candidatos.length ? (
              candidatos.map((c) => (
                <View key={c.id} style={st.cand}>
                  <Avatar nome={c.freelancer?.nome ?? '?'} tamanho={42} />
                  <View style={{ flex: 1 }}>
                    <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 14.5 }}>{c.freelancer?.nome}</T>
                    <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>
                      {c.freelancer?.titulo} · {c.freelancer?.cidade}, {c.freelancer?.uf} · {tempoRelativo(c.criado_em)}
                    </T>
                    {c.mensagem ? <T style={{ color: C.ink2, fontSize: 13, marginTop: 6, lineHeight: 18 }}>“{c.mensagem}”</T> : null}
                  </View>
                  <Pressable style={st.mini} onPress={() => conversarCom(c.freelancer_id, c.freelancer?.nome ?? 'Freelancer')}>
                    <T style={{ fontSize: 13, fontFamily: F.interSemi }}>Conversar</T>
                  </Pressable>
                </View>
              ))
            ) : (
              <T style={{ color: '#7A6A61' }}>Ainda sem candidatos.</T>
            )}
          </View>
          {vaga.ativa ? (
            <View style={st.acoes}>
              <Botao titulo="Encerrar vaga" icone="lixo" variante="contornoEscuro" onPress={() => setFolha('encerrar')} />
            </View>
          ) : null}
        </>
      ) : empresa ? (
        <T style={{ color: '#7A6A61', textAlign: 'center', padding: 22, fontSize: 13.5 }}>Você está vendo como empresa. Para se candidatar, use uma conta de freelancer.</T>
      ) : (
        <View style={st.acoes}>
          {minha ? (
            <Botao titulo={`Candidatura enviada ${tempoRelativo(minha.criado_em)}`} icone="check" variante="feito" desativado />
          ) : (
            <Botao titulo="Candidatar-se" onPress={() => setFolha('candidatar')} desativado={!vaga.ativa} />
          )}
          <Botao titulo={salva ? 'Vaga salva' : 'Salvar vaga'} icone="salvar" variante="contornoEscuro" onPress={alternarSalva} />
        </View>
      )}

      <Folha visivel={folha === 'candidatar'} aoFechar={() => setFolha(null)} titulo={`Candidatar-se a ${vaga.titulo}`}>
        <T style={{ color: C.muted, lineHeight: 20 }}>
          A {vaga.empresa?.nome} verá seu nome, título profissional, cidade/UF e seu perfil de serviço. CPF, e-mail, telefone e endereço não são compartilhados.
        </T>
        <Campo rotulo="Mensagem para a empresa (opcional)" valor={mensagem} aoMudar={setMensagem} multiline maxLength={600} placeholder="Conte por que você é uma boa escolha para este projeto." />
        <Botao titulo="Enviar candidatura" onPress={enviarCandidatura} carregando={enviando} estilo={{ marginTop: 18 }} />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setFolha(null)} />
      </Folha>

      <Folha visivel={folha === 'encerrar'} aoFechar={() => setFolha(null)} titulo="Encerrar esta vaga?">
        <T style={{ color: C.muted, lineHeight: 20 }}>Ela deixa de aparecer nas buscas. Os candidatos continuam na sua lista.</T>
        <Botao
          titulo="Encerrar vaga"
          estilo={{ marginTop: 18 }}
          onPress={async () => {
            await encerrarVaga(vaga.id).catch(() => {});
            setFolha(null);
            setVaga({ ...vaga, ativa: false });
            toast('Vaga encerrada');
          }}
        />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setFolha(null)} />
      </Folha>
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

const st = StyleSheet.create({
  cab: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22, paddingTop: 8 },
  verif: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: C.ink, fontFamily: F.interSemi, fontSize: 22, lineHeight: 28, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 12 },
  desc: { color: '#3B2F29', lineHeight: 23, paddingHorizontal: 22, paddingTop: 20, fontSize: 14.5 },
  hr: { height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 22, marginBottom: 6 },
  cand: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#ECDCCF' },
  mini: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: C.ink },
  acoes: { paddingHorizontal: 22, paddingTop: 22, gap: 12 },
});
