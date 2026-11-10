import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const CHAVE = 'vora:ref';
const valido = (c: string | null | undefined) => (c && /^[A-Za-z0-9]{6}$/.test(c) ? c.toUpperCase() : null);

/** Guarda o código de quem indicou (?ref=ABC123 no link do convite) para usar no cadastro */
export async function capturarIndicacao() {
  try {
    let url: string | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') url = window.location.href;
    else url = await Linking.getInitialURL();
    if (!url) return;
    const ref = valido(new URL(url.replace(/^vora:\/\//, 'https://x/')).searchParams.get('ref'));
    if (ref) await AsyncStorage.setItem(CHAVE, ref);
  } catch {
    // link sem código: nada a fazer
  }
}

export async function codigoIndicacao() {
  return valido(await AsyncStorage.getItem(CHAVE).catch(() => null));
}
export async function limparIndicacao() {
  await AsyncStorage.removeItem(CHAVE).catch(() => {});
}
