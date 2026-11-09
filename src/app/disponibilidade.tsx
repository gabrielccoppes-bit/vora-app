import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GradeDisponibilidade } from '@/components/acoes';
import { Botao, Carregando, Chip, T, Tela, Topo, useToast } from '@/components/ui';
import { disponibilidadeDe, salvarDisponibilidade, TURNOS, type Disponivel, type Turno } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C } from '@/theme';

/** Freelancer marca os dias e turnos em que costuma estar livre */
export default function Disponibilidade() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [itens, setItens] = useState<Disponivel[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (perfil) disponibilidadeDe(perfil.id).then(setItens).catch(() => setItens([]));
  }, [perfil]);

  const alternar = (dia: number, turno: Turno) =>
    setItens((l) => {
      const a = l ?? [];
      return a.some((i) => i.dia === dia && i.turno === turno) ? a.filter((i) => !(i.dia === dia && i.turno === turno)) : [...a, { dia, turno }];
    });

  // atalhos comuns na noite
  const atalho = (dias: number[], turnos: Turno[]) =>
    setItens((l) => {
      const a = [...(l ?? [])];
      for (const d of dias) for (const t of turnos) if (!a.some((i) => i.dia === d && i.turno === t)) a.push({ dia: d, turno: t });
      return a;
    });

  async function salvar() {
    if (!perfil || !itens) return;
    setSalvando(true);
    try {
      await salvarDisponibilidade(perfil.id, itens);
      toast('Disponibilidade salva!');
      if (router.canGoBack()) router.back();
    } catch {
      toast('Não foi possível salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Topo titulo="Minha disponibilidade" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Toque nos turnos em que você costuma estar livre. Os estabelecimentos usam isso para achar quem pode trabalhar hoje à noite, no fim de semana etc.
        </T>
        {itens === null ? (
          <Carregando />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <Chip texto="+ Noites de sex e sáb" onPress={() => atalho([5, 6], ['noite', 'madrugada'])} />
              <Chip texto="+ Fins de semana" onPress={() => atalho([6, 0], TURNOS.map((t) => t.id))} />
              <Chip texto="+ Toda noite" onPress={() => atalho([0, 1, 2, 3, 4, 5, 6], ['noite'])} />
              <Chip texto="Limpar" onPress={() => setItens([])} />
            </View>
            <View style={{ marginTop: 20, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.stroke, padding: 14 }}>
              <GradeDisponibilidade itens={itens} aoAlternar={alternar} />
            </View>
            <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 10 }}>
              {itens.length ? `${itens.length} turno${itens.length > 1 ? 's' : ''} por semana` : 'Nenhum turno marcado'}
            </T>
            <Botao titulo="Salvar" onPress={salvar} carregando={salvando} estilo={{ marginTop: 20 }} />
          </>
        )}
      </View>
    </Tela>
  );
}
