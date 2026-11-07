import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { meuPerfil, type Perfil } from './api';
import { supabase } from './supabase';

type Ctx = {
  sessao: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  recarregarPerfil: () => Promise<void>;
};

const SessaoCtx = createContext<Ctx>({ sessao: null, perfil: null, carregando: true, recarregarPerfil: async () => {} });

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      return;
    }
    try {
      const p = await meuPerfil(s.user.id);
      if (!p) {
        // conta apagada ou cadastro incompleto
        await supabase.auth.signOut();
        return;
      }
      setPerfil(p);
    } catch {
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      await carregarPerfil(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s);
      // fora do callback para não travar o cliente do Supabase
      setTimeout(() => carregarPerfil(s), 0);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  const recarregarPerfil = useCallback(() => carregarPerfil(sessao), [carregarPerfil, sessao]);

  return <SessaoCtx.Provider value={{ sessao, perfil, carregando, recarregarPerfil }}>{children}</SessaoCtx.Provider>;
}

export const useSessao = () => useContext(SessaoCtx);
