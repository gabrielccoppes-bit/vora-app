import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { salvarAvaliacao } from '@/lib/api';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';
import { Icone } from './icone';
import { Botao, Campo, Chip, Folha, T, useToast } from './ui';

export const DESTAQUES = ['Pontual', 'Profissional', 'Simpático(a)', 'Ágil', 'Trabalha bem em equipe', 'Voltaria a contratar'];

/** ★★★★☆ */
export function Estrelas({ nota, tamanho = 16, cor = C.orange }: { nota: number; tamanho?: number; cor?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icone key={i} nome="estrela" tamanho={tamanho} cor={cor} preenchido={i <= Math.round(nota)} espessura={1.6} />
      ))}
    </View>
  );
}

/** "★ 4,8 (12 avaliações)" ou "Novo no Vora" */
export function NotaResumo({ media, total, claro, compacto }: { media?: number | null; total?: number; claro?: boolean; compacto?: boolean }) {
  const cor = claro ? C.ink2 : C.muted;
  if (!total || media == null)
    return <T style={{ fontSize: 12.5, color: cor }}>{compacto ? 'Novo' : 'Novo no Vora · sem avaliações'}</T>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icone nome="estrela" tamanho={14} cor={C.orange} preenchido />
      <T style={{ fontSize: 13, fontFamily: F.interSemi, color: claro ? C.ink : C.cream }}>{Number(media).toFixed(1).replace('.', ',')}</T>
      <T style={{ fontSize: 12.5, color: cor }}>
        ({total}
        {compacto ? '' : total === 1 ? ' avaliação' : ' avaliações'})
      </T>
    </View>
  );
}

/** Cartão de uma avaliação (perfil do freelancer) */
export function CartaoAvaliacao({
  a,
}: {
  a: { nota: number; tags: string[]; comentario: string | null; criado_em: string; empresa?: { nome: string; titulo: string | null; cidade: string } | null; vaga?: { titulo: string } | null };
}) {
  return (
    <View style={st.cartao}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <T style={{ color: C.ink, fontFamily: F.interSemi }}>{a.empresa?.nome ?? 'Estabelecimento'}</T>
          <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>
            {[a.empresa?.titulo, a.empresa?.cidade, tempoRelativo(a.criado_em)].filter(Boolean).join(' · ')}
          </T>
        </View>
        <Estrelas nota={a.nota} tamanho={15} />
      </View>
      {a.vaga?.titulo ? <T style={{ color: C.ink2, fontSize: 12.5, marginTop: 8 }}>Trabalho: {a.vaga.titulo}</T> : null}
      {a.comentario ? <T style={{ color: '#3B2F29', marginTop: 8, lineHeight: 21 }}>“{a.comentario}”</T> : null}
      {a.tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {a.tags.map((t) => (
            <View key={t} style={st.tag}>
              <T style={{ fontSize: 12, color: C.ink2, fontFamily: F.interMed }}>{t}</T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type AlvoAvaliacao = {
  candidatura_id: string;
  vaga_id: string;
  vaga_titulo: string;
  empresa_id: string;
  freelancer_id: string;
  freelancer_nome: string;
  existente?: { id: string; nota: number; tags: string[]; comentario: string | null } | null;
};

/** Folha para avaliar (ou editar a avaliação de) um freelancer contratado */
export function FolhaAvaliar({ alvo, aoFechar, aoSalvar }: { alvo: AlvoAvaliacao | null; aoFechar: () => void; aoSalvar: () => void }) {
  const toast = useToast();
  const [nota, setNota] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setNota(alvo?.existente?.nota ?? 0);
    setTags(alvo?.existente?.tags ?? []);
    setComentario(alvo?.existente?.comentario ?? '');
  }, [alvo]);

  async function enviar() {
    if (!alvo) return;
    if (!nota) return toast('Escolha de 1 a 5 estrelas');
    setEnviando(true);
    try {
      await salvarAvaliacao({ ...alvo, existenteId: alvo.existente?.id, nota, tags, comentario });
      toast(alvo.existente ? 'Avaliação atualizada' : 'Avaliação enviada. Obrigado!');
      aoSalvar();
      aoFechar();
    } catch {
      toast('Não foi possível salvar a avaliação. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const rotulos = ['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'];
  return (
    <Folha visivel={!!alvo} aoFechar={aoFechar} titulo={alvo ? `Avaliar ${alvo.freelancer_nome}` : ''}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <T style={{ color: C.muted, lineHeight: 20 }}>Trabalho: {alvo?.vaga_titulo}. Sua avaliação fica pública no perfil e ajuda outros estabelecimentos a contratar.</T>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 20 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable key={i} onPress={() => setNota(i)} hitSlop={6} accessibilityLabel={`${i} estrela${i > 1 ? 's' : ''}`}>
            <Icone nome="estrela" tamanho={38} cor={C.orange} preenchido={i <= nota} espessura={1.4} />
          </Pressable>
        ))}
      </View>
      <T style={{ textAlign: 'center', marginTop: 8, color: nota ? C.orange2 : C.muted2, fontFamily: F.interSemi }}>{nota ? rotulos[nota] : 'Toque nas estrelas'}</T>
      <T style={{ color: C.muted, marginTop: 18, marginBottom: 8, fontSize: 13 }}>Destaques (opcional)</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DESTAQUES.map((d) => (
          <Chip key={d} texto={d} ativo={tags.includes(d)} onPress={() => setTags((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d]))} />
        ))}
      </View>
      <Campo rotulo="Comentário (opcional)" valor={comentario} aoMudar={setComentario} multiline maxLength={600} placeholder="Como foi trabalhar com essa pessoa?" />
      <Botao titulo={alvo?.existente ? 'Salvar alterações' : 'Enviar avaliação'} onPress={enviar} carregando={enviando} estilo={{ marginTop: 18 }} />
      <Botao titulo="Cancelar" variante="fantasma" onPress={aoFechar} />
      </ScrollView>
    </Folha>
  );
}

const st = StyleSheet.create({
  cartao: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#ECDCCF' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: C.cream3 },
});
