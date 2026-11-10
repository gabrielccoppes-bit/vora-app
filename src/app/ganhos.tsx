import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Carregando, T, Tela, Topo, Vazio } from '@/components/ui';
import { duracao, fotoUrl, meusTurnos, type TurnoGanho } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nomeMes = (k: string) => MESES[Number(k.split('-')[1]) - 1];
const reais = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
const dataDo = (t: TurnoGanho) => new Date(t.vaga.inicio_em ?? t.criado_em);
const minutos = (t: TurnoGanho) => (t.checkin_em && t.checkout_em ? Math.max(0, (new Date(t.checkout_em).getTime() - new Date(t.checkin_em).getTime()) / 60000) : null);

/** Quanto vale o turno: por hora usa as horas registradas; diária/projeto usa o valor da vaga */
function valorDo(t: TurnoGanho): number | null {
  if (t.vaga.periodo === 'hora') {
    const m = minutos(t);
    return m === null ? null : (t.vaga.valor_min * m) / 60;
  }
  return t.vaga.valor_min;
}

/** Freelancer: ganhos, horas e turnos por mês */
export default function Ganhos() {
  const { perfil } = useSessao();
  const [turnos, setTurnos] = useState<TurnoGanho[] | null>(null);
  const [mes, setMes] = useState(chave(new Date()));

  useFocusEffect(
    useCallback(() => {
      if (perfil) meusTurnos(perfil.id).then(setTurnos).catch(() => setTurnos([]));
    }, [perfil])
  );

  const agora = Date.now();
  const trabalhados = useMemo(() => (turnos ?? []).filter((t) => t.status === 'contratado' && (t.checkout_em || dataDo(t).getTime() <= agora)), [turnos, agora]);
  const futuros = useMemo(
    () => (turnos ?? []).filter((t) => t.status === 'contratado' && !t.checkout_em && dataDo(t).getTime() > agora).sort((a, b) => +dataDo(a) - +dataDo(b)),
    [turnos, agora]
  );

  // últimos 6 meses para o gráfico
  const serie = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const k = chave(new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1));
      const total = trabalhados.filter((t) => chave(dataDo(t)) === k).reduce((s, t) => s + (valorDo(t) ?? 0), 0);
      return { k, total };
    });
  }, [trabalhados]);
  const maior = Math.max(1, ...serie.map((x) => x.total));

  const r = useMemo(() => {
    const doMes = trabalhados.filter((t) => chave(dataDo(t)) === mes);
    const todosDoMes = (turnos ?? []).filter((t) => chave(dataDo(t)) === mes);
    const min = doMes.reduce((s, t) => s + (minutos(t) ?? 0), 0);
    return {
      lista: doMes.sort((a, b) => +dataDo(b) - +dataDo(a)),
      total: doMes.reduce((s, t) => s + (valorDo(t) ?? 0), 0),
      semValor: doMes.filter((t) => valorDo(t) === null).length,
      horas: `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`,
      lugares: new Set(doMes.map((t) => t.vaga.empresa?.id)).size,
      faltas: todosDoMes.filter((t) => t.status === 'falta').length,
      cancel: todosDoMes.filter((t) => t.status === 'cancelado_freela').length,
    };
  }, [trabalhados, turnos, mes]);

  const previsto = futuros.reduce((s, t) => s + (valorDo(t) ?? 0), 0);

  return (
    <Tela>
      <Topo titulo="Meus ganhos" />
      {turnos === null ? (
        <Carregando />
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          {/* Gráfico dos últimos 6 meses (toque numa barra para ver o mês) */}
          <View style={{ padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
            <T style={{ color: C.muted, fontSize: 13 }}>Ganhos em {nomeMes(mes)}</T>
            <T style={{ fontFamily: F.soraSemi, fontSize: 30, marginTop: 2 }}>{reais(r.total)}</T>
            {r.semValor ? <T style={{ color: C.muted2, fontSize: 12, marginTop: 2 }}>+ {r.semValor} turno(s) por hora sem check-in/check-out</T> : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 18 }}>
              {serie.map((b) => {
                const ativo = b.k === mes;
                return (
                  <Pressable key={b.k} onPress={() => setMes(b.k)} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} accessibilityLabel={`${nomeMes(b.k)}: ${reais(b.total)}`}>
                    {b.total > 0 ? (
                      <T style={{ color: ativo ? C.cream : C.muted2, fontSize: 10.5, marginBottom: 4 }} numberOfLines={1}>
                        {b.total >= 1000 ? `${(b.total / 1000).toFixed(1).replace('.', ',')}k` : Math.round(b.total)}
                      </T>
                    ) : null}
                    <View style={{ width: '100%', maxWidth: 34, height: Math.max(4, (b.total / maior) * 84), borderRadius: 6, backgroundColor: ativo ? C.orange : '#3A2E29' }} />
                    <T style={{ color: ativo ? C.cream : C.muted, fontSize: 12, marginTop: 6, fontFamily: ativo ? F.interSemi : F.inter }}>{nomeMes(b.k)}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Numero v={String(r.lista.length)} r="turnos" />
            <Numero v={r.horas} r="horas registradas" />
            <Numero v={String(r.lugares)} r={r.lugares === 1 ? 'lugar' : 'lugares'} />
          </View>
          {r.faltas || r.cancel ? (
            <T style={{ color: C.muted, fontSize: 13, marginTop: 10 }}>
              Neste mês: {[r.faltas ? `${r.faltas} falta(s)` : null, r.cancel ? `${r.cancel} cancelamento(s)` : null].filter(Boolean).join(' · ')}
            </T>
          ) : null}

          {futuros.length ? (
            <>
              <T style={st.rotulo}>PRÓXIMOS TURNOS · {reais(previsto)} PREVISTO</T>
              {futuros.slice(0, 5).map((t) => (
                <Linha key={t.id} t={t} />
              ))}
            </>
          ) : null}

          <T style={st.rotulo}>TURNOS EM {nomeMes(mes).toUpperCase()}</T>
          {r.lista.length === 0 ? <Vazio icone="dinheiro" texto="Nenhum turno trabalhado neste mês." /> : r.lista.map((t) => <Linha key={t.id} t={t} />)}

          <T style={{ color: C.muted2, fontSize: 12, marginTop: 16, lineHeight: 17 }}>
            Valores calculados pelo que foi anunciado na vaga (diária ou valor por hora × horas do check-in/check-out). Quando o pagamento pelo app estiver ativo, aqui aparecem os valores recebidos.
          </T>
        </View>
      )}
    </Tela>
  );
}

function Linha({ t }: { t: TurnoGanho }) {
  const v = valorDo(t);
  return (
    <Pressable
      onPress={() => router.push(`/vaga/${t.vaga_id}`)}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginBottom: 8 }, pressed && { opacity: 0.7 }]}>
      <Avatar nome={t.vaga.empresa?.nome ?? '?'} tamanho={38} quadrado foto={fotoUrl(t.vaga.empresa)} />
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.interSemi }} numberOfLines={1}>
          {t.vaga.empresa?.nome}
        </T>
        <T style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
          {dataDo(t).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} · {t.vaga.titulo}
          {t.checkin_em && t.checkout_em ? ` · ${duracao(t.checkin_em, t.checkout_em)}` : ''}
        </T>
      </View>
      <T style={{ color: v === null ? C.muted : '#7FD3A0', fontFamily: F.interSemi, fontSize: 13.5 }}>{v === null ? 'por hora' : reais(v)}</T>
    </Pressable>
  );
}

function Numero({ v, r }: { v: string; r: string }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 20 }}>{v}</T>
      <T style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{r}</T>
    </View>
  );
}

const st = { rotulo: { color: C.orange2, fontFamily: F.interSemi, fontSize: 12, letterSpacing: 1.1, marginTop: 24, marginBottom: 10 } } as const;
