import { Platform, Share } from 'react-native';

/** Copia no site; no celular abre o compartilhar (que também tem "Copiar"). Devolve true se copiou de fato. */
export async function copiar(texto: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // sem permissão: cai no compartilhar
    }
  }
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text: texto });
    else await Share.share({ message: texto });
  } catch {
    // cancelado
  }
  return false;
}

/** Compartilhar (WhatsApp etc.); no site sem suporte, copia */
export async function compartilhar(texto: string, titulo = 'Vora'): Promise<'copiado' | 'ok'> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: texto });
        return 'ok';
      }
      await navigator.clipboard.writeText(texto);
      return 'copiado';
    }
    await Share.share({ message: texto });
  } catch {
    // cancelado
  }
  return 'ok';
}
