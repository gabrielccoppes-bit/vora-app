import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { abrirConversa, colegasDeVolta, definirVolta, marcarCheguei, TRANSPORTE, type Candidatura, type ColegaVolta, type Vaga, fotoUrl } from '@/lib/api';
import { avisarContato, lerContato, salvarContato, telefoneWhats, type ContatoConfianca } from '@/lib/volta';
import { C, F } from '@/theme';
import { Icone } from './icone';
import { Avatar, Botao, T, useToast } from './ui';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Volta para casa: transporte, dividir a volta com a equipe e avisar um contato de confiança */
export function CartaoVolta({ vaga, minha, aoMudar }: { vaga: Vaga; minha: Candidatura; aoMudar: (c: Candidatura) => void }) {
  const toast = useToast();
  const [contato, setContato] = useState<ContatoConfianca | null>(null);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [dividir, setDividir] = useState(!!minha.dividir_volta);
  const [bairro, setBairro] = useState(minha.bairro_volta ?? '');
  const [colegas, setColegas] = useState<ColegaVolta[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [chegando, setChegando] = useState(false);
  const equipe = vaga.quantidade > 1;

  useEffect(() => {
    lerContato().then((c) => {
      setContato(c);
      setNome(c?.nome ?? '');
      setTel(c?.telefone ?? '');
    });
  }, []);
  useEffect(() => {
    if (equipe && minha.dividir_volta) colegasDeVolta(vaga.id).then(setColegas).catch(() => setColegas([]));
  }, [equipe, minha.dividir_volta, vaga.id]);

  async function guardarContato() {
    if (nome.trim().length < 2 || !telefoneWhats(tel)) return toast('Informe o nome e o celular com DDD.');
    const c = { nome: nome.trim(), telefone: tel.trim() };
    await salvarContato(c);
    setContato(c);
    setEditando(false);
    toast('Contato salvo neste celular.');
  }

  async function salvarDivisao(novo: boolean) {
    if (novo && bairro.trim().length < 2) {
      setDividir(true);
      return toast('Informe o bairro para onde você volta.');
    }
    setSalvando(true);
    try {
      await definirVolta(minha.id, novo, bairro);
      setDividir(novo);
      aoMudar({ ...minha, dividir_volta: novo, bairro_volta: novo ? bairro.trim() : null });
      if (!novo) setColegas(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function avisarSaida() {
    if (!contato) return setEditando(true);
    try {
      await avisarContato(contato, `Oi, ${contato.nome.split(' ')[0]}! Saí agora do turno em ${vaga.empresa?.nome ?? 'um estabelecimento'} (${vaga.empresa?.cidade}) e estou indo para casa. Te aviso quando chegar. 🧡`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function cheguei() {
    setChegando(true);
    try {
      await marcarCheguei(minha.id);
      aoMudar({ ...minha, chegou_em: new Date().toISOString() });
      if (contato) await avisarContato(contato, `Cheguei em casa! ✓ (aviso pelo Vora)`).catch(() => {});
    } catch {
      toast('Não foi possível registrar agora.');
    } finally {
      setChegando(false);
    }
  }

  const transp = TRANSPORTE[vaga.transporte ?? 'nao_informado'];

  return (
    <View style={st.cartao}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icone nome="inicio" cor={C.orange} />
        <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 15.5, flex: 1 }}>Volta para casa</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Icone nome="carro" tamanho={16} cor={vaga.transporte === 'pago' || vaga.transporte === 'ajuda' ? '#1F7A4C' : '#7A6A61'} />
        <T style={{ color: '#5C4E46', fontSize: 13.5, flex: 1 }}>{transp.longo}</T>
      </View>

      {equipe ? (
        <View style={{ marginTop: 14 }}>
          <Pressable onPress={() => (dividir && minha.dividir_volta ? salvarDivisao(false) : setDividir(!dividir))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} disabled={salvando}>
            <View style={[st.caixa, dividir && { backgroundColor: C.orange, borderColor: C.orange }]}>{dividir ? <Icone nome="check" tamanho={13} cor={C.onOrange} espessura={3} /> : null}</View>
            <T style={{ color: C.ink2, fontSize: 13.5, flex: 1 }}>Quero dividir a volta com colegas deste turno</T>
          </Pressable>
          {dividir && !minha.dividir_volta ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput value={bairro} onChangeText={setBairro} placeholder="Bairro para onde você volta" placeholderTextColor="#A8978C" maxLength={40} style={[st.input, { flex: 1, marginTop: 0 }]} />
              <Pressable onPress={() => salvarDivisao(true)} style={st.mini} disabled={salvando}>
                <T style={{ color: C.onOrange, fontFamily: F.interSemi, fontSize: 13.5 }}>{salvando ? '...' : 'Salvar'}</T>
              </Pressable>
            </View>
          ) : null}
          {minha.dividir_volta ? (
            <View style={{ marginTop: 10 }}>
              <T style={{ color: '#7A6A61', fontSize: 12.5 }}>
                Você volta para {minha.bairro_volta}. Só quem também marcou vê seu primeiro nome e bairro.
              </T>
              {colegas === null ? null : colegas.length === 0 ? (
                <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 8 }}>Ninguém da equipe marcou ainda. Quem marcar aparece aqui.</T>
              ) : (
                colegas.map((c) => (
                  <View key={c.freelancer_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <Avatar nome={c.nome} tamanho={36} foto={fotoUrl({ id: c.freelancer_id, foto_v: c.foto_v })} />
                    <View style={{ flex: 1 }}>
                      <T style={{ color: C.ink, fontFamily: F.interSemi }}>{c.nome}</T>
                      <T style={{ color: '#7A6A61', fontSize: 12.5 }}>Volta para {c.bairro}</T>
                    </View>
                    <Pressable
                      style={st.miniClaro}
                      onPress={async () => {
                        try {
                          const id = await abrirConversa(c.freelancer_id);
                          router.push(`/chat/${id}`);
                        } catch (e) {
                          toast((e as Error).message);
                        }
                      }}>
                      <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: C.ink }}>Combinar</T>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: '#EADBCF', marginVertical: 14 }} />
      {editando || !contato ? (
        editando ? (
          <View>
            <T style={{ color: C.ink, fontFamily: F.interSemi }}>Contato de confiança</T>
            <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>Fica salvo só neste celular. O Vora não guarda.</T>
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome (ex.: Mãe)" placeholderTextColor="#A8978C" maxLength={40} style={st.input} />
            <TextInput value={tel} onChangeText={setTel} placeholder="Celular com DDD" placeholderTextColor="#A8978C" keyboardType="phone-pad" maxLength={20} style={st.input} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Botao titulo="Salvar contato" onPress={guardarContato} estilo={{ flex: 1 }} />
              {contato ? <Botao titulo="Cancelar" variante="contornoEscuro" onPress={() => setEditando(false)} estilo={{ flex: 1 }} /> : null}
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setEditando(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icone nome="usuario" cor={C.orange} tamanho={18} />
            <View style={{ flex: 1 }}>
              <T style={{ color: C.ink, fontFamily: F.interSemi }}>Adicionar contato de confiança</T>
              <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>Avise alguém pelo WhatsApp quando sair e quando chegar.</T>
            </View>
            <Icone nome="seta" cor="#7A6A61" tamanho={16} />
          </Pressable>
        )
      ) : (
        <Pressable onPress={() => setEditando(true)}>
          <T style={{ color: '#7A6A61', fontSize: 12.5 }}>
            Contato de confiança: <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 12.5 }}>{contato.nome}</T> · alterar
          </T>
        </Pressable>
      )}

      {minha.chegou_em ? (
        <T style={{ color: '#1F7A4C', fontFamily: F.interSemi, marginTop: 12 }}>✓ Você avisou que chegou em casa às {hora(minha.chegou_em)}</T>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {contato ? <Botao titulo="Estou saindo" icone="enviar" variante="contornoEscuro" onPress={avisarSaida} estilo={{ flex: 1 }} /> : null}
          <Botao titulo={contato ? "Cheguei" : "Cheguei em casa"} icone="check" onPress={cheguei} carregando={chegando} estilo={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

const st = {
  cartao: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EADBCF' },
  caixa: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#CDB8A9', alignItems: 'center', justifyContent: 'center' },
  input: { marginTop: 10, borderWidth: 1.5, borderColor: '#E5D3C5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.ink, fontFamily: F.inter },
  mini: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, backgroundColor: C.orange },
  miniClaro: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E3D2C4' },
} as const;
