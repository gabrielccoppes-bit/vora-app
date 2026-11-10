import { View } from 'react-native';

import type { Instrucoes } from '@/lib/api';
import { C, F } from '@/theme';
import { Icone, type NomeIcone } from './icone';
import { Campo, T } from './ui';

export type FormInstrucoes = { traje: string; levar: string; chegada: string; contato: string };
export const instrucoesVazias: FormInstrucoes = { traje: '', levar: '', chegada: '', contato: '' };
export const paraForm = (i: Instrucoes | null): FormInstrucoes => ({ traje: i?.traje ?? '', levar: i?.levar ?? '', chegada: i?.chegada ?? '', contato: i?.contato ?? '' });

/** Campos de "O que levar no turno" (formulário do estabelecimento) */
export function CamposInstrucoes({ valor, aoMudar }: { valor: FormInstrucoes; aoMudar: (v: FormInstrucoes) => void }) {
  const set = (k: keyof FormInstrucoes) => (v: string) => aoMudar({ ...valor, [k]: v });
  return (
    <View>
      <Campo rotulo="Traje" valor={valor.traje} aoMudar={set('traje')} placeholder="Ex.: Camisa preta, calça preta e sapato fechado" maxLength={200} />
      <Campo rotulo="O que levar" valor={valor.levar} aoMudar={set('levar')} placeholder="Ex.: Abridor, caneta, documento com foto" maxLength={300} />
      <Campo rotulo="Chegada" valor={valor.chegada} aoMudar={set('chegada')} placeholder="Ex.: Entrar pela porta dos fundos, 30 min antes. Falar com o Rafa." maxLength={300} multiline />
      <Campo rotulo="Contato no local" valor={valor.contato} aoMudar={set('contato')} placeholder="Ex.: Rafa (gerente) · (51) 99999-0000" maxLength={120} />
    </View>
  );
}

/** Cartão "O que levar no turno" (freelancer contratado e dono) */
export function CartaoInstrucoes({ i, clara }: { i: Instrucoes; clara?: boolean }) {
  const itens: [NomeIcone, string, string | null][] = [
    ['pessoas', 'Traje', i.traje],
    ['maleta', 'Levar', i.levar],
    ['local', 'Chegada', i.chegada],
    ['chat', 'Contato', i.contato],
  ];
  const cor = clara ? C.ink : C.cream;
  const sub = clara ? '#7A6A61' : C.muted;
  return (
    <View style={{ gap: 12 }}>
      {itens
        .filter(([, , v]) => v)
        .map(([ic, rot, v]) => (
          <View key={rot} style={{ flexDirection: 'row', gap: 12 }}>
            <Icone nome={ic} cor={clara ? '#2C221D' : C.orange} tamanho={18} />
            <View style={{ flex: 1 }}>
              <T style={{ color: sub, fontSize: 12, fontFamily: F.interSemi, letterSpacing: 0.4 }}>{rot.toUpperCase()}</T>
              <T style={{ color: cor, fontSize: 14.5, marginTop: 2, lineHeight: 20 }}>{v}</T>
            </View>
          </View>
        ))}
    </View>
  );
}
