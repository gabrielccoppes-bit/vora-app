import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { AvisoPrivacidade, Botao, Carregando, Marcar, T, Tela, Topo, useToast } from '@/components/ui';
import { minhaVerificacao, pedirVerificacao, type Verificacao } from '@/lib/api';
import { escolherImagem } from '@/lib/imagem';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

type Foto = { uri: string; bytes: ArrayBuffer } | null;

/** Verificação de identidade: selfie + documento com foto, analisados pela equipe do Vora */
export default function VerificacaoIdentidade() {
  const { perfil, recarregarPerfil } = useSessao();
  const toast = useToast();
  const [atual, setAtual] = useState<Verificacao | null | undefined>(undefined);
  const [selfie, setSelfie] = useState<Foto>(null);
  const [doc, setDoc] = useState<Foto>(null);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [novoPedido, setNovoPedido] = useState(false);
  const empresa = perfil?.tipo === 'empresa';

  useEffect(() => {
    if (!perfil) return;
    recarregarPerfil();
    minhaVerificacao(perfil.id).then(setAtual).catch(() => setAtual(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function pegar(qual: 'selfie' | 'doc', origem: 'camera' | 'galeria') {
    try {
      const img = await escolherImagem({ origem, max: 1600, frontal: qual === 'selfie' });
      if (img) (qual === 'selfie' ? setSelfie : setDoc)(img);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function enviar() {
    if (!perfil || !selfie || !doc || !aceite) return;
    setEnviando(true);
    try {
      await pedirVerificacao(perfil.id, selfie.bytes, doc.bytes);
      setAtual(await minhaVerificacao(perfil.id));
      setNovoPedido(false);
      setSelfie(null);
      setDoc(null);
      toast('Fotos enviadas! Avisaremos quando a análise terminar.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!perfil || atual === undefined) return <Tela><Topo titulo="Verificar identidade" /><Carregando /></Tela>;

  const mostrarForm = !perfil.verificado && (!atual || atual.status === 'recusada' || novoPedido) && atual?.status !== 'pendente';

  return (
    <Tela>
      <Topo titulo="Verificar identidade" />
      <View style={{ paddingHorizontal: 20 }}>
        {perfil.verificado ? (
          <Status icone="escudo" cor="#7FD3A0" titulo="Identidade verificada" texto="Seu perfil mostra o selo de verificado. Isso passa mais confiança para quem vai trabalhar com você." />
        ) : atual?.status === 'pendente' ? (
          <Status icone="relogio" cor={C.orange2} titulo="Em análise" texto={`Recebemos suas fotos ${tempoRelativo(atual.criado_em)}. A análise costuma levar até 2 dias úteis.`} />
        ) : atual?.status === 'recusada' && !novoPedido ? (
          <>
            <Status icone="fechar" cor="#FF8A8A" titulo="Não foi possível verificar" texto={atual.motivo ? `Motivo: ${atual.motivo}` : 'As fotos não permitiram confirmar sua identidade.'} />
            <Botao titulo="Enviar novas fotos" onPress={() => setNovoPedido(true)} estilo={{ marginTop: 16 }} />
          </>
        ) : null}

        {mostrarForm && (!atual || novoPedido) ? (
          <>
            <T style={{ color: C.muted, lineHeight: 21 }}>
              {empresa
                ? 'Envie uma selfie do responsável pela conta e a foto de um documento dele com foto (RG ou CNH). Estabelecimentos verificados recebem mais candidatos.'
                : 'Envie uma selfie e a foto de um documento com foto (RG ou CNH). Freelancers verificados são escolhidos com mais confiança.'}
            </T>
            <Passo n={1} titulo="Selfie" dica="Rosto inteiro, sem óculos escuros nem boné, em lugar iluminado." foto={selfie} aoCamera={() => pegar('selfie', 'camera')} aoGaleria={() => pegar('selfie', 'galeria')} />
            <Passo n={2} titulo="Documento com foto" dica="Frente do RG ou CNH, sem cortar as bordas e sem reflexo." foto={doc} aoCamera={() => pegar('doc', 'camera')} aoGaleria={() => pegar('doc', 'galeria')} />
            <AvisoPrivacidade>
              As fotos ficam num cofre privado: só a equipe de moderação do Vora vê, e elas são <T style={{ fontFamily: F.interSemi, color: C.cream, fontSize: 13 }}>apagadas assim que a análise termina</T>. Guardamos só o resultado (verificado ou não).
            </AvisoPrivacidade>
            <Marcar marcado={aceite} aoMudar={setAceite}>
              <T style={{ fontSize: 14, lineHeight: 20 }}>Autorizo o Vora a usar estas fotos, incluindo a imagem do meu rosto, só para confirmar minha identidade (LGPD, art. 11).</T>
            </Marcar>
            <Botao titulo="Enviar para análise" onPress={enviar} carregando={enviando} estilo={{ marginTop: 20, opacity: selfie && doc && aceite ? 1 : 0.5 }} />
          </>
        ) : null}
      </View>
    </Tela>
  );
}

function Status({ icone, cor, titulo, texto }: { icone: NomeIcone; cor: string; titulo: string; texto: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 22, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginTop: 8 }}>
      <Icone nome={icone} cor={cor} tamanho={36} />
      <T style={{ fontFamily: F.soraSemi, fontSize: 19, marginTop: 10 }}>{titulo}</T>
      <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21, marginTop: 6 }}>{texto}</T>
    </View>
  );
}

function Passo({ n, titulo, dica, foto, aoCamera, aoGaleria }: { n: number; titulo: string; dica: string; foto: Foto; aoCamera: () => void; aoGaleria: () => void }) {
  return (
    <View style={{ marginTop: 20, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: foto ? C.orange : C.stroke }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: foto ? C.orange : C.card2, alignItems: 'center', justifyContent: 'center' }}>
          {foto ? <Icone nome="check" tamanho={14} cor={C.onOrange} espessura={3} /> : <T style={{ fontFamily: F.interSemi, fontSize: 13 }}>{n}</T>}
        </View>
        <T style={{ fontFamily: F.interSemi, fontSize: 15.5 }}>{titulo}</T>
      </View>
      <T style={{ color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>{dica}</T>
      {foto ? <Image source={{ uri: foto.uri }} style={{ width: '100%', height: 180, borderRadius: 14, marginTop: 12, backgroundColor: C.bg }} contentFit="contain" /> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={aoCamera} style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: foto ? C.card2 : C.orange, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.interSemi, color: foto ? C.cream : C.onOrange }}>{foto ? 'Tirar outra' : 'Tirar foto'}</T>
        </Pressable>
        <Pressable onPress={aoGaleria} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.interSemi }}>Da galeria</T>
        </Pressable>
      </View>
    </View>
  );
}
