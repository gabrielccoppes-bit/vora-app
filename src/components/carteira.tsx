import { View } from 'react-native';

import { SELOS, fotoUrl, type Carteira } from '@/lib/api';
import { MODULOS } from '@/lib/treinamentos';
import { C, F } from '@/theme';
import { Icone } from './icone';
import { Avatar, T } from './ui';

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const mesAno = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
const num = (n: number) => String(n).replace('.', ',');

/** Documento da carteira de trabalho Vora (claro, pronto para imprimir) */
export function DocumentoCarteira({ c, link }: { c: Carteira; link?: string }) {
  const presenca = c.turnos + c.faltas > 0 ? Math.round((c.turnos / (c.turnos + c.faltas)) * 100) : null;
  const porCasa = new Map<string, { casa: string; cidade: string; funcoes: Set<string>; n: number; horas: number; de: string; ate: string }>();
  c.historico.forEach((h) => {
    const k = h.casa;
    const x = porCasa.get(k) ?? { casa: h.casa, cidade: h.cidade, funcoes: new Set<string>(), n: 0, horas: 0, de: h.data, ate: h.data };
    x.n += 1;
    x.horas += h.horas ?? 0;
    x.funcoes.add(h.area || h.funcao);
    if (h.data < x.de) x.de = h.data;
    if (h.data > x.ate) x.ate = h.data;
    porCasa.set(k, x);
  });

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#ECDCCF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T style={{ color: C.orange, fontFamily: F.soraSemi, fontSize: 18, letterSpacing: 1 }}>vora</T>
        <T style={{ color: '#7A6A61', fontSize: 11.5, letterSpacing: 1 }}>CARTEIRA DE TRABALHO</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 16 }}>
        <Avatar nome={c.nome} tamanho={64} foto={fotoUrl(c)} />
        <View style={{ flex: 1 }}>
          <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 20 }}>{c.nome}</T>
          <T style={{ color: C.ink2, fontSize: 14, marginTop: 2 }}>{c.areas?.length ? c.areas.join(' · ') : (c.titulo ?? 'Freelancer')}</T>
          <T style={{ color: '#7A6A61', fontSize: 12.5, marginTop: 2 }}>
            {c.cidade}/{c.uf} · no Vora desde {mesAno(c.membro_desde)}
            {c.verificado ? ' · identidade verificada' : ''}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <Numero v={String(c.turnos)} r="turnos" />
        <Numero v={num(c.horas)} r="horas registradas" />
        <Numero v={String(c.casas)} r={c.casas === 1 ? 'casa' : 'casas'} />
        <Numero v={presenca === null ? '–' : `${presenca}%`} r="presença" />
        <Numero v={c.nota_total ? Number(c.nota_media ?? 0).toFixed(1).replace('.', ',') : '–'} r={`nota (${c.nota_total})`} />
        <Numero v={String(c.elogios_total)} r="elogios de clientes" />
      </View>

      {c.selos.filter((s) => SELOS[s]).length ? (
        <Bloco titulo="Selos">
          {c.selos
            .filter((s) => SELOS[s])
            .map((s) => (
              <T key={s} style={{ color: C.ink, fontSize: 13.5, marginTop: 4 }}>
                ✓ <T style={{ fontFamily: F.interSemi, color: C.ink, fontSize: 13.5 }}>{SELOS[s].nome}</T> — {SELOS[s].descricao}
              </T>
            ))}
        </Bloco>
      ) : null}

      {c.treinamentos.length ? (
        <Bloco titulo="Treinamentos concluídos">
          {c.treinamentos.map((t) => (
            <T key={t.modulo} style={{ color: C.ink, fontSize: 13.5, marginTop: 4 }}>
              ✓ {MODULOS.find((m) => m.id === t.modulo)?.titulo ?? t.modulo} · {data(t.em)}
            </T>
          ))}
        </Bloco>
      ) : null}

      <Bloco titulo="Onde trabalhou">
        {porCasa.size === 0 ? (
          <T style={{ color: '#7A6A61', fontSize: 13.5, marginTop: 4 }}>Ainda sem turnos concluídos pelo Vora.</T>
        ) : (
          [...porCasa.values()].map((x) => (
            <View key={x.casa} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1E5DB' }}>
              <T style={{ color: C.ink, fontFamily: F.interSemi }}>{x.casa}</T>
              <T style={{ color: '#5C4E46', fontSize: 13, marginTop: 2 }}>
                {[...x.funcoes].join(', ')} · {x.n} {x.n === 1 ? 'turno' : 'turnos'}
                {x.horas ? ` · ${num(Math.round(x.horas * 10) / 10)} h` : ''}
              </T>
              <T style={{ color: '#7A6A61', fontSize: 12 }}>
                {x.cidade} · {mesAno(x.de) === mesAno(x.ate) ? mesAno(x.de) : `${mesAno(x.de)} a ${mesAno(x.ate)}`}
              </T>
            </View>
          ))
        )}
      </Bloco>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: '#F8F1EA' }}>
        <Icone nome="escudo" tamanho={18} cor="#1F7A4C" />
        <T style={{ flex: 1, color: '#5C4E46', fontSize: 12, lineHeight: 17 }}>
          Dados registrados pelo Vora a partir das contratações, check-ins e avaliações ({c.turnos_gps} de {c.turnos} turnos com entrada e saída registradas no app). Emitida em {data(c.gerada_em)}.
          {link ? ` Confira a versão atualizada em ${link.replace('https://', '')}` : ''}
        </T>
      </View>
    </View>
  );
}

function Numero({ v, r }: { v: string; r: string }) {
  return (
    <View style={{ minWidth: '30%', flexGrow: 1, padding: 10, borderRadius: 14, backgroundColor: '#F8F1EA' }}>
      <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 19 }}>{v}</T>
      <T style={{ color: '#7A6A61', fontSize: 11.5, marginTop: 1 }}>{r}</T>
    </View>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <T style={{ color: '#B4400B', fontSize: 11.5, fontFamily: F.interSemi, letterSpacing: 1.1 }}>{titulo.toUpperCase()}</T>
      {children}
    </View>
  );
}
