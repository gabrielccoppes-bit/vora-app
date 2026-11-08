import * as Crypto from 'expo-crypto';

/**
 * Verifica se a senha já apareceu em vazamentos de dados (base Have I Been Pwned,
 * a mesma usada pelo Supabase no plano Pro).
 *
 * Privacidade: a senha NUNCA sai do aparelho. Só os 5 primeiros caracteres do
 * hash SHA-1 são enviados (técnica "k-anonimato"); a comparação é feita aqui.
 * Se o serviço estiver fora do ar, não bloqueia o cadastro.
 */
export async function senhaVazada(senha: string): Promise<number> {
  try {
    const hash = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, senha)).toUpperCase();
    const prefixo = hash.slice(0, 5);
    const sufixo = hash.slice(5);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, { headers: { 'Add-Padding': 'true' }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return 0;
    const linha = (await r.text()).split('\n').find((l) => l.startsWith(sufixo));
    return linha ? Number(linha.split(':')[1]) || 0 : 0;
  } catch {
    return 0;
  }
}
