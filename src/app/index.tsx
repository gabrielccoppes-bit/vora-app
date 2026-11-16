import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { useSessao } from '@/lib/sessao';

/** Rota raiz: manda para o app (logado) ou para as boas-vindas. */
export default function Raiz() {
  const { sessao } = useSessao();
  // No site, quem chega sem conta vê a apresentação; no app, vai direto às boas-vindas
  return <Redirect href={sessao ? '/inicio' : Platform.OS === 'web' ? '/conheca' : '/boas-vindas'} />;
}
