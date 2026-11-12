import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icone } from '@/components/icone';
import { Selos } from '@/components/selos';
import { Avatar, Botao, Carregando, T, Tela, useToast } from '@/components/ui';
import { deixarElogio, ELOGIOS_CLIENTE, fotoUrl, paginaGorjeta, type PaginaGorjeta } from '@/lib/api';
import { copiar } from '@/lib/copiar';
import { codigoPix } from '@/lib/pix';
import { C, F } from '@/theme';

const VALORES = [5, 10, 20, 50];

/** Página pública do QR Code: o cliente elogia e manda gorjeta por Pix (sem login) */
export default function PaginaPublicaGorjeta() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const toast = useToast();
  const [p, setP] = useState<PaginaGorjeta | null | undefined>(undefined);
  const [valor, setValor] = useState<number | null>(10);
  const [outro, setOutro] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [autor, setAutor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    paginaGorjeta(String(codigo)).then(setP).catch(() => setP(null));
  }, [codigo]);

  if (p === undefined) return <Carregando clara />;
  if (p === null)
    return (
      <Tela clara>
        <View style={{ padding: 28, alignItems: 'center', marginTop: 80 }}>
          <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 20, textAlign: 'center' }}>Página não encontrada</T>
          <T style={{ color: '#7A6A61', marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Este QR Code não está mais ativo. Que tal agradecer pessoalmente? 🙂</T>
        </View>
      </Tela>
    );

  const valorFinal = valor ?? (Number(outro.replace(',', '.')) || 0);
  const temPix = !!p.pix_chave;

  async function copiarPix() {
    if (!p?.pix_chave) return;
    if (valorFinal <= 0 || valorFinal > 5000) return toast('Escolha um valor entre R$ 1 e R$ 5.000.');
    const cod = codigoPix({ chave: p.pix_chave, nome: p.pix_nome ?? p.nome, cidade: p.cidade, valor: valorFinal });
    const ok = await copiar(cod);
    if (ok) toast('Código Pix copiado! Abra o app do seu banco › Pix › Copia e cola.');
  }

  async function enviar() {
    if (!tags.length && texto.trim().length < 2) return toast('Escolha um elogio ou escreva uma mensagem.');
    setEnviando(true);
    try {
      await deixarElogio(String(codigo), tags, texto, autor);
      setEnviado(true);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela clara>
      <View style={{ paddingHorizontal: 22, paddingTop: 26, alignItems: 'center' }}>
        <T style={{ color: C.orange, fontFamily: F.soraSemi, fontSize: 18, letterSpacing: 1 }}>vora</T>
        <View style={{ marginTop: 18 }}>
          <Avatar nome={p.nome} tamanho={92} foto={fotoUrl(p)} />
        </View>
        <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 24, marginTop: 12 }}>{p.nome}</T>
        {p.titulo ? <T style={{ color: C.ink2, fontSize: 15, marginTop: 2 }}>{p.titulo}</T> : null}
        <View style={{ marginTop: 10 }}>
          <Selos selos={p.selos} clara />
        </View>
        {p.elogios_total > 0 ? (
          <T style={{ color: '#7A6A61', fontSize: 13, marginTop: 8 }}>
            💛 {p.elogios_total} {p.elogios_total === 1 ? 'elogio' : 'elogios'} de clientes
          </T>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 22 }}>
        {temPix ? (
          <View style={st.cartao}>
            <T style={st.titulo}>Deixar uma gorjeta</T>
            <T style={st.sub}>Vai direto para {p.nome}, sem taxa.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {VALORES.map((v) => (
                <Pressable key={v} onPress={() => setValor(v)} style={[st.valor, valor === v && st.valorAtivo]}>
                  <T style={{ fontFamily: F.interSemi, color: valor === v ? C.onOrange : C.ink }}>R$ {v}</T>
                </Pressable>
              ))}
              <Pressable onPress={() => setValor(null)} style={[st.valor, valor === null && st.valorAtivo]}>
                <T style={{ fontFamily: F.interSemi, color: valor === null ? C.onOrange : C.ink }}>Outro</T>
              </Pressable>
            </View>
            {valor === null ? (
              <TextInput
                value={outro}
                onChangeText={(t) => setOutro(t.replace(/[^0-9,]/g, '').slice(0, 7))}
                placeholder="Valor em R$"
                placeholderTextColor="#A8978C"
                keyboardType="decimal-pad"
                style={st.input}
              />
            ) : null}
            <Botao titulo={`Copiar Pix de R$ ${valorFinal ? valorFinal.toFixed(2).replace('.', ',') : '0,00'}`} icone="dinheiro" onPress={copiarPix} estilo={{ marginTop: 14 }} />
            <T style={[st.sub, { marginTop: 10, textAlign: 'center' }]}>Depois é só colar em Pix › Copia e cola no app do seu banco.</T>
          </View>
        ) : null}

        <View style={st.cartao}>
          {enviado ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <T style={{ fontSize: 34 }}>💛</T>
              <T style={[st.titulo, { marginTop: 6 }]}>Elogio enviado!</T>
              <T style={[st.sub, { textAlign: 'center' }]}>{p.nome} vai adorar. Obrigado por valorizar quem te atendeu.</T>
            </View>
          ) : (
            <>
              <T style={st.titulo}>Deixar um elogio</T>
              <T style={st.sub}>Ajuda {p.nome} a conseguir mais turnos.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {ELOGIOS_CLIENTE.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <Pressable key={t} onPress={() => setTags((l) => (on ? l.filter((x) => x !== t) : l.length < 4 ? [...l, t] : l))} style={[st.tag, on && st.valorAtivo]}>
                      <T style={{ fontSize: 13.5, color: on ? C.onOrange : C.ink }}>{t}</T>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Escreva algo (opcional)"
                placeholderTextColor="#A8978C"
                multiline
                maxLength={280}
                style={[st.input, { minHeight: 80, textAlignVertical: 'top' }]}
              />
              <TextInput value={autor} onChangeText={setAutor} placeholder="Seu nome (opcional)" placeholderTextColor="#A8978C" maxLength={40} style={st.input} />
              <Botao titulo="Enviar elogio" onPress={enviar} carregando={enviando} estilo={{ marginTop: 14 }} />
            </>
          )}
        </View>

        {p.ultimos.length ? (
          <View style={{ marginTop: 18 }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, marginBottom: 8 }}>O que outros clientes disseram</T>
            {p.ultimos.map((e, i) => (
              <View key={i} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: '#EADBCF' }}>
                {e.tags.length ? <T style={{ color: '#B4400B', fontSize: 13 }}>{e.tags.join(' · ')}</T> : null}
                {e.texto ? <T style={{ color: C.ink, marginTop: 2, lineHeight: 20 }}>“{e.texto}”</T> : null}
                {e.autor ? <T style={{ color: '#7A6A61', fontSize: 12, marginTop: 2 }}>— {e.autor}</T> : null}
              </View>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/boas-vindas')} style={{ marginTop: 26, padding: 16, borderRadius: 18, backgroundColor: '#1A1412', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icone nome="predio" cor={C.orange} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.interSemi }}>Tem um bar ou restaurante?</T>
            <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>Ache freelancers como {p.nome} no Vora.</T>
          </View>
          <Icone nome="seta" cor={C.muted} tamanho={18} />
        </Pressable>
      </View>
    </Tela>
  );
}

const st = {
  cartao: { marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECDCCF' },
  titulo: { color: C.ink, fontFamily: F.soraSemi, fontSize: 18 },
  sub: { color: '#7A6A61', fontSize: 13, marginTop: 2, lineHeight: 18 },
  valor: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5D3C5' },
  valorAtivo: { backgroundColor: C.orange, borderColor: C.orange },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5D3C5' },
  input: { marginTop: 12, borderWidth: 1.5, borderColor: '#E5D3C5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink, fontFamily: F.inter },
} as const;
