// Validação e máscaras de documentos brasileiros.
// O banco valida de novo (funções cpf_valido / cnpj_valido), então isto é só para UX.

export const digitos = (s: string) => String(s ?? '').replace(/\D/g, '');
export const alfanum = (s: string) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function comSeparadores(r: string, seps: Record<number, string>) {
  let o = '';
  for (let i = 0; i < r.length; i++) {
    if (seps[i]) o += seps[i];
    o += r[i];
  }
  return o;
}

export const fmtCPF = (v: string) => comSeparadores(digitos(v).slice(0, 11), { 3: '.', 6: '.', 9: '-' });
export const fmtCNPJ = (v: string) => comSeparadores(alfanum(v).slice(0, 14), { 2: '.', 5: '.', 8: '/', 12: '-' });
export const fmtCEP = (v: string) => comSeparadores(digitos(v).slice(0, 8), { 5: '-' });
export const fmtData = (v: string) => comSeparadores(digitos(v).slice(0, 8), { 2: '/', 4: '/' });
export const fmtHora = (v: string) => comSeparadores(digitos(v).slice(0, 4), { 2: ':' });
export function fmtTelefone(v: string) {
  const d = digitos(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  const r = d.slice(2);
  const corte = r.length > 8 ? 5 : 4;
  return `(${d.slice(0, 2)}) ` + (r.length > corte ? r.slice(0, corte) + '-' + r.slice(corte) : r);
}
export const fmtDinheiro = (v: string) => {
  const d = digitos(v).slice(0, 7);
  return d ? Number(d).toLocaleString('pt-BR') : '';
};

export const MASCARAS = {
  cpf: fmtCPF,
  cnpj: fmtCNPJ,
  cep: fmtCEP,
  telefone: fmtTelefone,
  data: fmtData,
  hora: fmtHora,
  dinheiro: fmtDinheiro,
};
export type Mascara = keyof typeof MASCARAS;

export function cpfValido(cpf: string) {
  const c = digitos(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const d = (s * 10) % 11;
    return d === 10 ? 0 : d;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

/** Aceita o CNPJ numérico e o novo CNPJ alfanumérico. */
export function cnpjValido(cnpj: string) {
  const c = alfanum(cnpj);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c) || /^(.)\1+$/.test(c)) return false;
  const valor = (ch: string) => ch.charCodeAt(0) - 48;
  const calc = (s: string, pesos: number[]) => {
    let t = 0;
    for (let i = 0; i < s.length; i++) t += valor(s[i]) * pesos[i];
    const r = t % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const base = c.slice(0, 12);
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}` === c.slice(12);
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** "DD/MM/AAAA" → "AAAA-MM-DD" (ou null se inválida) */
export function dataISO(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, d, mo, a] = m;
  const dt = new Date(Number(a), Number(mo) - 1, Number(d));
  if (dt.getDate() !== Number(d) || dt.getMonth() !== Number(mo) - 1) return null;
  return `${a}-${mo}-${d}`;
}
export function idade(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

export function senhaForte(s: string) {
  return s.length >= 8 && /[a-z]/i.test(s) && /\d/.test(s);
}

// Exibição mascarada (LGPD: mostrar só o necessário)
export const ocultarCPF = (c?: string | null) => {
  const d = digitos(c ?? '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '—';
};
export const ocultarTelefone = (p?: string | null) => {
  const d = digitos(p ?? '');
  return d.length >= 10 ? `(${d.slice(0, 2)}) •••••-${d.slice(-4)}` : '—';
};
export const ocultarEmail = (e?: string | null) => {
  const [u, dom] = String(e ?? '').split('@');
  return dom ? `${u.slice(0, 2)}•••@${dom}` : '—';
};

export function tempoRelativo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const dinheiro = (n: number) => Number(n).toLocaleString('pt-BR');
export const primeiroNome = (n: string) => String(n ?? '').trim().split(/\s+/)[0];
export const iniciais = (n: string) =>
  String(n ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
