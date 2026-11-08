import { memo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { C } from '@/theme';

const P = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mais: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  sino: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  salvar: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  compartilhar: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v8h14v-8"/>',
  voltar: '<path d="m15 5-7 7 7 7"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dinheiro: '<path d="M12 2v20M17 6.5C16 5 14.2 4.5 12 4.5c-2.8 0-4.5 1.3-4.5 3.3 0 4.8 9.5 2.4 9.5 7.7 0 2.1-2 3.5-5 3.5-2.4 0-4.4-.8-5.2-2.5"/>',
  maleta: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  filtros: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  local: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sair: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  baixar: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  brilho: '<path d="M12 3c.5 4.5 2.5 8 9 9-6.5 1-8.5 4.5-9 9-.5-4.5-2.5-8-9-9 6.5-1 8.5-4.5 9-9z"/>',
  enviar: '<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  arquivo: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  predio: '<path d="M4 21V5l8-3v19M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M2 21h20"/>',
  estrela: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.8 6.6 19.6l1.1-6L3.2 9.4l6.1-.8z"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.3 0 4 1.2 4.7 3.8"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
} as const;

export type NomeIcone = keyof typeof P;

/* Os desenhos são convertidos uma única vez (não a cada renderização). */
type Elemento = { tag: 'path' | 'circle' | 'rect'; a: Record<string, string> };
function converter(markup: string): Elemento[] {
  const out: Elemento[] = [];
  const re = /<(path|circle|rect)\s+([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const a: Record<string, string> = {};
    m[2].replace(/([a-z-]+)="([^"]*)"/g, (_x, k: string, v: string) => ((a[k] = v), ''));
    out.push({ tag: m[1] as Elemento['tag'], a });
  }
  return out;
}
const DESENHOS = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, converter(v)])) as Record<NomeIcone, Elemento[]>;

export const Icone = memo(function Icone({
  nome,
  tamanho = 22,
  cor = C.cream,
  preenchido = false,
  espessura = 1.8,
}: {
  nome: NomeIcone;
  tamanho?: number;
  cor?: string;
  preenchido?: boolean;
  espessura?: number;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <G fill={preenchido ? cor : 'none'} stroke={cor} strokeWidth={espessura} strokeLinecap="round" strokeLinejoin="round">
        {DESENHOS[nome].map((e, i) =>
          e.tag === 'path' ? (
            <Path key={i} d={e.a.d} />
          ) : e.tag === 'circle' ? (
            <Circle key={i} cx={e.a.cx} cy={e.a.cy} r={e.a.r} />
          ) : (
            <Rect key={i} x={e.a.x} y={e.a.y} width={e.a.width} height={e.a.height} rx={e.a.rx} />
          )
        )}
      </G>
    </Svg>
  );
});
