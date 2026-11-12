import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Botao, T, Tela, Topo, Vazio, useToast } from '@/components/ui';
import { concluirTreinamento } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { moduloPorId } from '@/lib/treinamentos';
import { C, F } from '@/theme';

/** Uma lição: cartões de conteúdo e depois o quiz (corrigido no servidor) */
export default function Treinamento() {
  const { modulo } = useLocalSearchParams<{ modulo: string }>();
  const { recarregarPerfil } = useSessao();
  const toast = useToast();
  const m = moduloPorId(String(modulo));
  const [passo, setPasso] = useState(0); // 0..licoes-1 = lições; licoes = quiz
  const [resp, setResp] = useState<(number | null)[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ aprovado: boolean; acertos: number; total: number; erradas: number[] } | null>(null);

  if (!m)
    return (
      <Tela>
        <Topo titulo="Treinamento" />
        <Vazio texto="Treinamento não encontrado." />
      </Tela>
    );

  const noQuiz = passo >= m.licoes.length;

  async function enviar() {
    if (!m) return;
    if (resp.length < m.perguntas.length || resp.some((r) => r === null || r === undefined)) return toast('Responda todas as perguntas.');
    setEnviando(true);
    try {
      const r = await concluirTreinamento(m.id, resp as number[]);
      setResultado(r);
      if (r.aprovado) recarregarPerfil?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Topo titulo={m.titulo} />
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
          {[...m.licoes, null].map((_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= passo ? C.orange : '#2A201C' }} />
          ))}
        </View>

        {!noQuiz ? (
          <>
            <T style={{ color: C.orange2, fontSize: 12, fontFamily: F.interSemi, letterSpacing: 1.1 }}>
              LIÇÃO {passo + 1} DE {m.licoes.length}
            </T>
            <T style={{ fontFamily: F.soraSemi, fontSize: 22, marginTop: 8 }}>{m.licoes[passo].titulo}</T>
            <T style={{ color: C.cream, fontSize: 16, lineHeight: 25, marginTop: 12 }}>{m.licoes[passo].texto}</T>
            <Botao titulo={passo === m.licoes.length - 1 ? 'Fazer o quiz' : 'Próxima'} onPress={() => setPasso(passo + 1)} estilo={{ marginTop: 28 }} />
            {passo > 0 ? <Botao titulo="Voltar" variante="fantasma" onPress={() => setPasso(passo - 1)} /> : null}
          </>
        ) : resultado ? (
          <View style={{ alignItems: 'center', paddingTop: 20 }}>
            <T style={{ fontSize: 44 }}>{resultado.aprovado ? '🎉' : '🤔'}</T>
            <T style={{ fontFamily: F.soraSemi, fontSize: 22, marginTop: 8, textAlign: 'center' }}>
              {resultado.aprovado ? 'Treinamento concluído!' : `Você acertou ${resultado.acertos} de ${resultado.total}`}
            </T>
            <T style={{ color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
              {resultado.aprovado
                ? 'Já aparece no seu perfil e na sua carteira de trabalho.'
                : `Reveja ${resultado.erradas.length === 1 ? 'a pergunta' : 'as perguntas'} ${resultado.erradas.join(' e ')} e tente de novo. Para concluir é preciso acertar todas.`}
            </T>
            {resultado.aprovado ? (
              <Botao titulo="Ver outros treinamentos" onPress={() => router.back()} estilo={{ marginTop: 24, alignSelf: 'stretch' }} />
            ) : (
              <>
                <Botao titulo="Tentar de novo" onPress={() => (setResultado(null), setResp([]))} estilo={{ marginTop: 24, alignSelf: 'stretch' }} />
                <Botao titulo="Rever as lições" variante="fantasma" onPress={() => (setResultado(null), setResp([]), setPasso(0))} />
              </>
            )}
          </View>
        ) : (
          <>
            {m.perguntas.map((q, i) => (
              <View key={i} style={{ marginBottom: 22 }}>
                <T style={{ fontFamily: F.interSemi, fontSize: 15.5, lineHeight: 22 }}>
                  {i + 1}. {q.texto}
                </T>
                {q.opcoes.map((o, k) => {
                  const on = resp[i] === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setResp((r) => Object.assign([...r], { [i]: k }))}
                      style={{ marginTop: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: on ? C.orange : C.stroke, backgroundColor: on ? '#FF5A1218' : C.card }}>
                      <T style={{ color: on ? C.cream : C.muted, lineHeight: 20 }}>{o}</T>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Botao titulo="Enviar respostas" onPress={enviar} carregando={enviando} />
          </>
        )}
      </View>
    </Tela>
  );
}
