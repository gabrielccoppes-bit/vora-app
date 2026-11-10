import { Pressable, View } from 'react-native';

import { C, CATEGORIAS, F } from '@/theme';
import { Icone } from './icone';
import { T } from './ui';

/**
 * Escolha de várias áreas de atuação (freelancer).
 * A primeira marcada é a principal (aparece em destaque no perfil e nos cartões).
 */
export function SeletorAreas({
  rotulo = 'Áreas em que você trabalha',
  valor,
  aoMudar,
  erro,
  max = 6,
  clara,
}: {
  rotulo?: string;
  valor: string[];
  aoMudar: (v: string[]) => void;
  erro?: string;
  max?: number;
  clara?: boolean;
}) {
  const alternar = (a: string) => {
    if (valor.includes(a)) aoMudar(valor.filter((x) => x !== a));
    else if (valor.length < max) aoMudar([...valor, a]);
  };
  const tornarPrincipal = (a: string) => aoMudar([a, ...valor.filter((x) => x !== a)]);
  const corTexto = clara ? C.ink : C.cream;

  return (
    <View style={{ marginTop: 14 }}>
      <T style={{ color: clara ? C.ink2 : C.muted, fontSize: 13, fontFamily: F.interMed, marginBottom: 4 }}>{rotulo}</T>
      <T style={{ color: clara ? '#7A6A61' : C.muted2, fontSize: 12.5, marginBottom: 10 }}>
        Marque todas que quiser (até {max}). {valor.length > 1 ? 'Toque na estrela para escolher a principal.' : 'A primeira marcada é a principal.'}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIAS.map((a) => {
          const i = valor.indexOf(a);
          const ativo = i >= 0;
          const principal = i === 0;
          const cheio = !ativo && valor.length >= max;
          return (
            <Pressable
              key={a}
              onPress={() => alternar(a)}
              disabled={cheio}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ativo, disabled: cheio }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: ativo && valor.length > 1 ? 6 : 12,
                height: 38,
                borderRadius: 19,
                borderWidth: 1.5,
                borderColor: ativo ? C.orange : clara ? '#E3D2C4' : C.stroke,
                backgroundColor: ativo ? C.orange : 'transparent',
                opacity: cheio ? 0.4 : 1,
              }}>
              {ativo ? <Icone nome="check" tamanho={14} cor={C.onOrange} espessura={3} /> : null}
              <T style={{ fontSize: 14, color: ativo ? C.onOrange : corTexto, fontFamily: ativo ? F.interSemi : F.inter }}>{a}</T>
              {ativo && valor.length > 1 ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => tornarPrincipal(a)}
                  accessibilityLabel={principal ? `${a} é a área principal` : `Tornar ${a} a área principal`}
                  style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: principal ? '#00000026' : 'transparent' }}>
                  <Icone nome="estrela" tamanho={13} cor={C.onOrange} preenchido={principal} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {erro ? <T style={{ color: C.bad, fontSize: 12.5, marginTop: 6 }}>{erro}</T> : null}
    </View>
  );
}

/** Áreas como etiquetas (perfil público) */
export function EtiquetasAreas({ areas, clara }: { areas: string[]; clara?: boolean }) {
  if (!areas.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {areas.map((a, i) => (
        <View
          key={a}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
            backgroundColor: i === 0 ? C.orange : clara ? '#F1E6DD' : C.card2,
          }}>
          <T style={{ fontSize: 12.5, fontFamily: F.interSemi, color: i === 0 ? C.onOrange : clara ? C.ink2 : C.cream }}>{a}</T>
        </View>
      ))}
    </View>
  );
}

/** "Bar, Atendimento +2" para cartões */
export function resumoAreas(areas: string[] | undefined | null, area?: string | null, n = 2) {
  const l = areas?.length ? areas : area ? [area] : [];
  if (!l.length) return '';
  return l.slice(0, n).join(', ') + (l.length > n ? ` +${l.length - n}` : '');
}
