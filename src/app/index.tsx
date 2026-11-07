import { Redirect } from 'expo-router';

import { useSessao } from '@/lib/sessao';

/** Rota raiz: manda para o app (logado) ou para as boas-vindas. */
export default function Raiz() {
  const { sessao } = useSessao();
  return <Redirect href={sessao ? '/inicio' : '/boas-vindas'} />;
}
