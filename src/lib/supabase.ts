import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !chave) {
  throw new Error(
    'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY no arquivo .env (veja o README).'
  );
}

// Na web, as páginas são geradas antes no Node (output "static"), onde não existe
// window nem localStorage. Lá o cliente roda sem guardar sessão; no navegador e
// no celular, funciona normalmente.
const noServidor = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url, chave, {
  auth: {
    storage: noServidor ? undefined : AsyncStorage,
    autoRefreshToken: !noServidor,
    persistSession: !noServidor,
    detectSessionInUrl: false,
  },
});

// Renova o token só com o app em primeiro plano
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
