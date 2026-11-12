import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

/** Contato de confiança: fica só neste aparelho, nunca vai para o servidor */
export type ContatoConfianca = { nome: string; telefone: string };
const CHAVE = 'vora:contato-confianca';

export async function lerContato(): Promise<ContatoConfianca | null> {
  try {
    const t = await AsyncStorage.getItem(CHAVE);
    return t ? (JSON.parse(t) as ContatoConfianca) : null;
  } catch {
    return null;
  }
}
export async function salvarContato(c: ContatoConfianca | null) {
  if (c) await AsyncStorage.setItem(CHAVE, JSON.stringify(c));
  else await AsyncStorage.removeItem(CHAVE);
}

/** Telefone BR em dígitos com 55 na frente (para o WhatsApp) */
export function telefoneWhats(t: string) {
  const d = t.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

/** Abre o WhatsApp com a mensagem pronta para o contato */
export async function avisarContato(c: ContatoConfianca, mensagem: string) {
  const n = telefoneWhats(c.telefone);
  if (!n) throw new Error('Telefone do contato inválido');
  const url = `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else await Linking.openURL(url);
}
