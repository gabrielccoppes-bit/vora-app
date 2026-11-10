import { View } from 'react-native';

import { SELOS } from '@/lib/api';
import { C, F } from '@/theme';
import { Icone, type NomeIcone } from './icone';
import { T } from './ui';

const ICONE: Record<string, NomeIcone> = { top: 'estrela', presenca: 'check', pontual: 'relogio', veterano: 'escudo' };

/** Selos de destaque do freelancer. compacto = só ícones (cartões da busca) */
export function Selos({ selos, clara, compacto, comDescricao }: { selos?: string[] | null; clara?: boolean; compacto?: boolean; comDescricao?: boolean }) {
  const lista = (selos ?? []).filter((s) => SELOS[s]);
  if (!lista.length) return null;
  if (compacto)
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {lista.map((s) => (
          <View key={s} accessibilityLabel={SELOS[s].nome} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF5A1222', alignItems: 'center', justifyContent: 'center' }}>
            <Icone nome={ICONE[s]} tamanho={11} cor={C.orange} preenchido={s === 'top'} />
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ gap: comDescricao ? 10 : 6, flexDirection: comDescricao ? 'column' : 'row', flexWrap: 'wrap' }}>
      {lista.map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: clara ? '#FFE7DA' : '#FF5A1222',
            }}>
            <Icone nome={ICONE[s]} tamanho={13} cor={C.orange} preenchido={s === 'top'} />
            <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: clara ? '#B4400B' : C.orange2 }}>{SELOS[s].nome}</T>
          </View>
          {comDescricao ? <T style={{ flex: 1, fontSize: 12.5, color: clara ? '#7A6A61' : C.muted }}>{SELOS[s].descricao}</T> : null}
        </View>
      ))}
    </View>
  );
}
