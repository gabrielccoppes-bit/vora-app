/**
 * Pix "copia e cola" (BR Code estático, padrão do Banco Central).
 * O dinheiro vai direto do banco do cliente para a chave do freelancer: o Vora não toca no valor.
 */

export type TipoChave = 'cpf' | 'telefone' | 'email' | 'aleatoria';

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .trim();

/** Descobre o tipo e devolve a chave no formato que os bancos esperam (ou null se inválida) */
export function normalizarChave(bruta: string): { tipo: TipoChave; chave: string } | null {
  const t = bruta.trim();
  if (!t) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return { tipo: 'aleatoria', chave: t.toLowerCase() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) && t.length <= 77) return { tipo: 'email', chave: t.toLowerCase() };
  const d = t.replace(/\D/g, '');
  // telefone: +55 DDD número (10 ou 11 dígitos sem o 55)
  if (t.startsWith('+') || /[()]/.test(t) || (d.length === 13 && d.startsWith('55'))) {
    const n = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
    if (n.length === 10 || n.length === 11) return { tipo: 'telefone', chave: `+55${n}` };
    return null;
  }
  if (d.length === 11 && cpfValido(d)) return { tipo: 'cpf', chave: d };
  if (d.length === 11 || d.length === 10) return { tipo: 'telefone', chave: `+55${d}` };
  return null;
}

function cpfValido(c: string) {
  if (/^(\d)\1{10}$/.test(c)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}

const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, '0') + valor;

function crc16(txt: string) {
  let crc = 0xffff;
  for (let i = 0; i < txt.length; i++) {
    crc ^= txt.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Código copia e cola com valor (opcional) */
export function codigoPix({ chave, nome, cidade, valor }: { chave: string; nome: string; cidade: string; valor?: number | null }) {
  const n = semAcento(nome).slice(0, 25) || 'FREELANCER';
  const c = semAcento(cidade).slice(0, 15) || 'BRASIL';
  let p =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor && valor > 0 ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', n.toUpperCase()) +
    campo('60', c.toUpperCase()) +
    campo('62', campo('05', 'VORA')) +
    '6304';
  p += crc16(p);
  return p;
}
