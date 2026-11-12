import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icone } from '@/components/icone';
import { QrCode } from '@/components/qr';
import { Botao, Campo, Carregando, Interruptor, T, Tela, Topo, useToast } from '@/components/ui';
import { elogiosDoFreela, linkGorjeta, minhaGorjeta, ocultarElogio, salvarGorjeta, type Elogio } from '@/lib/api';
import { compartilhar } from '@/lib/copiar';
import { normalizarChave } from '@/lib/pix';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

const NOME_TIPO = { cpf: 'CPF', telefone: 'celular', email: 'e-mail', aleatoria: 'chave aleatória' } as const;

/** Freelancer: QR Code de gorjeta e elogios dos clientes */
export default function Gorjeta() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [carregado, setCarregado] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [chave, setChave] = useState('');
  const [nomeBanco, setNomeBanco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [elogios, setElogios] = useState<Elogio[] | null>(null);

  const carregar = useCallback(() => {
    if (!perfil) return;
    minhaGorjeta(perfil.id)
      .then((g) => {
        setAtivo(g?.ativo ?? true);
        setChave(g?.pix_chave ?? '');
        setNomeBanco(g?.pix_nome ?? '');
      })
      .catch(() => {})
      .finally(() => setCarregado(true));
    elogiosDoFreela(perfil.id, 50).then(setElogios).catch(() => setElogios([]));
  }, [perfil]);
  useFocusEffect(carregar);

  if (!perfil?.codigo || !carregado)
    return (
      <Tela>
        <Topo titulo="Gorjeta e elogios" />
        <Carregando />
      </Tela>
    );
  if (perfil.tipo !== 'freelancer')
    return (
      <Tela>
        <Topo titulo="Gorjeta e elogios" />
        <T style={{ color: C.muted, padding: 20 }}>Disponível para freelancers.</T>
      </Tela>
    );

  const link = linkGorjeta(perfil.codigo);
  const norm = chave.trim() ? normalizarChave(chave) : null;
  const chaveInvalida = !!chave.trim() && !norm;

  async function salvar() {
    if (chaveInvalida) return toast('Confira a chave Pix: use CPF, celular com DDD, e-mail ou chave aleatória.');
    setSalvando(true);
    try {
      await salvarGorjeta({ freelancer_id: perfil!.id, ativo, pix_chave: norm?.chave ?? null, pix_nome: nomeBanco.trim().slice(0, 25) || null });
      if (norm) setChave(norm.chave);
      toast('Salvo!');
    } catch {
      toast('Não foi possível salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(e: Elogio) {
    setElogios((l) => (l ?? []).map((x) => (x.id === e.id ? { ...x, oculto: !e.oculto } : x)));
    try {
      await ocultarElogio(e.id, !e.oculto);
    } catch {
      toast('Não foi possível alterar agora.');
      carregar();
    }
  }

  const imprimir = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.print();
  };

  return (
    <Tela>
      <Topo titulo="Gorjeta e elogios" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Mostre este QR Code no turno (no celular ou impresso no crachá). O cliente escaneia, te elogia e, se quiser, manda uma gorjeta por Pix direto para você.
        </T>

        <View style={{ marginTop: 18, padding: 20, borderRadius: 24, backgroundColor: C.cream, alignItems: 'center' }}>
          <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 18 }}>Gostou do atendimento?</T>
          <T style={{ color: C.ink2, fontSize: 13.5, marginTop: 2, marginBottom: 12 }}>Escaneie e elogie {perfil.nome.split(' ')[0]} 💛</T>
          <QrCode valor={link} tamanho={210} />
          <T style={{ color: '#7A6A61', fontSize: 12, marginTop: 10 }} selectable>
            {link.replace('https://', '')}
          </T>
          <T style={{ color: C.orange, fontFamily: F.soraSemi, fontSize: 15, marginTop: 8, letterSpacing: 1 }}>vora</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Botao
            titulo="Compartilhar"
            icone="compartilhar"
            variante="contorno"
            estilo={{ flex: 1 }}
            onPress={async () => {
              const r = await compartilhar(`Gostou do meu atendimento? Deixe um elogio ou uma gorjeta: ${link}`);
              if (r === 'copiado') toast('Link copiado!');
            }}
          />
          {Platform.OS === 'web' ? <Botao titulo="Imprimir" icone="baixar" variante="contorno" estilo={{ flex: 1 }} onPress={imprimir} /> : null}
        </View>

        <T style={st.secao}>GORJETA POR PIX</T>
        <Interruptor titulo="Mostrar minha página de gorjeta" sub="Desligado, o QR Code deixa de funcionar." valor={ativo} aoMudar={setAtivo} />
        <Campo
          rotulo="Chave Pix (opcional)"
          valor={chave}
          aoMudar={setChave}
          placeholder="Celular, e-mail, CPF ou chave aleatória"
          autoCapitalize="none"
          erro={chaveInvalida ? 'Chave não reconhecida' : undefined}
          dica={norm ? `Reconhecida como ${NOME_TIPO[norm.tipo]}` : 'Sem chave, a página aceita só elogios.'}
          tomDica={norm ? 'ok' : 'normal'}
        />
        <Campo rotulo="Seu nome como aparece no banco" valor={nomeBanco} aoMudar={setNomeBanco} placeholder={perfil.nome} maxLength={25} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FF5A1214', borderWidth: 1, borderColor: '#FF5A1240' }}>
          <Icone nome="cadeado" tamanho={18} cor={C.orange} />
          <T style={{ flex: 1, color: C.muted, fontSize: 12.5, lineHeight: 18 }}>
            Quem escanear o QR Code verá esta chave. Para mais privacidade, crie uma <T style={{ fontFamily: F.interSemi, color: C.cream, fontSize: 12.5 }}>chave aleatória</T> no app do seu banco. O dinheiro vai direto para a sua conta: o Vora não cobra nada da gorjeta.
          </T>
        </View>
        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} estilo={{ marginTop: 16 }} />

        <T style={st.secao}>ELOGIOS DOS CLIENTES ({(elogios ?? []).filter((e) => !e.oculto).length})</T>
        {elogios === null ? (
          <Carregando />
        ) : elogios.length === 0 ? (
          <T style={{ color: C.muted2 }}>Os elogios aparecem aqui e no seu perfil. Os estabelecimentos também veem.</T>
        ) : (
          elogios.map((e) => (
            <View key={e.id} style={{ padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginBottom: 8, opacity: e.oculto ? 0.55 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T style={{ flex: 1, color: C.muted, fontSize: 12.5 }}>
                  {e.autor ? `${e.autor} · ` : 'Cliente · '}
                  {tempoRelativo(e.criado_em)}
                </T>
                <Pressable onPress={() => alternar(e)} hitSlop={8}>
                  <T style={{ color: C.orange2, fontSize: 12.5, fontFamily: F.interSemi }}>{e.oculto ? 'Mostrar' : 'Ocultar'}</T>
                </Pressable>
              </View>
              {e.tags.length ? <T style={{ color: C.orange2, fontSize: 13, marginTop: 6 }}>{e.tags.join(' · ')}</T> : null}
              {e.texto ? <T style={{ marginTop: 4, lineHeight: 20 }}>“{e.texto}”</T> : null}
            </View>
          ))
        )}
      </View>
    </Tela>
  );
}

const st = { secao: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 26, marginBottom: 8 } as const };
