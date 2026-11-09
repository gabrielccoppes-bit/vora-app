import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { Avatar, Botao, Carregando, Chip, T, Tela, Topo, Vazio } from '@/components/ui';
import { contratacoesDoEstabelecimento, fotoUrl, PER, type LinhaRelatorio } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nomeMes = (k: string) => {
  const [a, m] = k.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};
const dataDoTurno = (l: LinhaRelatorio) => new Date(l.vaga.inicio_em ?? l.criado_em);
const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`;
const STATUS: Record<string, string> = { contratado: 'Trabalhou', falta: 'Faltou', cancelado_freela: 'Freelancer cancelou', cancelado_empresa: 'Você cancelou' };

/** Relatório mensal do estabelecimento: turnos, freelancers e valores previstos */
export default function Relatorio() {
  const { perfil } = useSessao();
  const [linhas, setLinhas] = useState<LinhaRelatorio[] | null>(null);
  const [mes, setMes] = useState(chaveMes(new Date()));

  useFocusEffect(
    useCallback(() => {
      if (perfil) contratacoesDoEstabelecimento(perfil.id).then(setLinhas).catch(() => setLinhas([]));
    }, [perfil])
  );

  const meses = useMemo(() => {
    const s = new Set<string>([chaveMes(new Date())]);
    (linhas ?? []).forEach((l) => s.add(chaveMes(dataDoTurno(l))));
    return [...s].sort().reverse().slice(0, 12);
  }, [linhas]);

  const doMes = useMemo(() => (linhas ?? []).filter((l) => chaveMes(dataDoTurno(l)) === mes).sort((a, b) => +dataDoTurno(a) - +dataDoTurno(b)), [linhas, mes]);

  const r = useMemo(() => {
    const trabalhou = doMes.filter((l) => l.status === 'contratado');
    let min = 0;
    let max = 0;
    let porHora = 0;
    for (const l of trabalhou) {
      if (l.vaga.periodo === 'hora') porHora++;
      else {
        min += l.vaga.valor_min;
        max += l.vaga.valor_max ?? l.vaga.valor_min;
      }
    }
    return {
      turnos: trabalhou.length,
      pessoas: new Set(trabalhou.map((l) => l.freelancer_id)).size,
      faltas: doMes.filter((l) => l.status === 'falta').length,
      cancel: doMes.filter((l) => l.status === 'cancelado_freela' || l.status === 'cancelado_empresa').length,
      min,
      max,
      porHora,
    };
  }, [doMes]);

  function exportar() {
    const cab = 'Data;Vaga;Freelancer;Situação;Valor anunciado';
    const corpo = doMes.map((l) =>
      [
        dataDoTurno(l).toLocaleDateString('pt-BR'),
        l.vaga.titulo,
        l.freelancer?.nome ?? '',
        STATUS[l.status] ?? l.status,
        `${l.vaga.valor_min}${l.vaga.valor_max ? '-' + l.vaga.valor_max : ''}${PER[l.vaga.periodo]}`,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';')
    );
    Share.share({ title: `Relatório Vora ${nomeMes(mes)}`, message: [cab, ...corpo].join('\n') }).catch(() => {});
  }

  return (
    <Tela rolar={false}>
      <Topo titulo="Relatório do mês" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
          {meses.map((m) => (
            <Chip key={m} texto={nomeMes(m)} ativo={mes === m} onPress={() => setMes(m)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {linhas === null ? (
          <Carregando />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Numero valor={String(r.turnos)} rotulo="turnos trabalhados" />
              <Numero valor={String(r.pessoas)} rotulo="freelancers diferentes" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Numero valor={String(r.faltas)} rotulo="faltas" alerta={r.faltas > 0} />
              <Numero valor={String(r.cancel)} rotulo="cancelamentos" alerta={r.cancel > 0} />
            </View>
            <View style={{ marginTop: 10, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
              <T style={{ color: C.muted, fontSize: 13 }}>Valor previsto (pelas vagas)</T>
              <T style={{ fontFamily: F.soraSemi, fontSize: 24, marginTop: 4 }}>{r.min === r.max ? reais(r.min) : `${reais(r.min)} – ${reais(r.max)}`}</T>
              {r.porHora ? <T style={{ color: C.muted, fontSize: 12.5, marginTop: 4 }}>+ {r.porHora} turno(s) pagos por hora (depende das horas trabalhadas)</T> : null}
              <T style={{ color: C.muted2, fontSize: 12, marginTop: 8, lineHeight: 17 }}>Estimativa a partir dos valores anunciados. Quando o pagamento pelo app estiver ativo, aqui aparecem os valores pagos.</T>
            </View>

            <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 12, letterSpacing: 1.1, marginTop: 24, marginBottom: 8 }}>CONTRATAÇÕES EM {nomeMes(mes).toUpperCase()}</T>
            {doMes.length === 0 ? (
              <Vazio icone="arquivo" texto="Nenhuma contratação neste mês." />
            ) : (
              <View style={{ gap: 8 }}>
                {doMes.map((l) => (
                  <Pressable
                    key={l.id}
                    onPress={() => router.push(`/vaga/${l.vaga_id}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
                    <Avatar nome={l.freelancer?.nome ?? '?'} tamanho={38} foto={fotoUrl(l.freelancer)} />
                    <View style={{ flex: 1 }}>
                      <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
                        {l.freelancer?.nome}
                      </T>
                      <T style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
                        {dataDoTurno(l).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {l.vaga.titulo}
                      </T>
                    </View>
                    <T style={{ fontSize: 12, fontFamily: F.interSemi, color: l.status === 'contratado' ? '#7FD3A0' : '#FF8A8A' }}>{STATUS[l.status]}</T>
                  </Pressable>
                ))}
              </View>
            )}
            {doMes.length ? <Botao titulo="Exportar para planilha (CSV)" icone="compartilhar" variante="contorno" onPress={exportar} estilo={{ marginTop: 20 }} /> : null}
          </>
        )}
      </ScrollView>
    </Tela>
  );
}

function Numero({ valor, rotulo, alerta }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 26, color: alerta ? '#FF8A8A' : C.cream }}>{valor}</T>
      <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{rotulo}</T>
    </View>
  );
}
