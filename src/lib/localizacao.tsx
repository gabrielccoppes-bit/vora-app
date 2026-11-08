import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

/**
 * Localização do freelancer.
 * Fica SÓ no aparelho (memória do app): é usada para calcular distâncias e,
 * na busca "perto de você", vai como parâmetro da consulta — nunca é gravada.
 */
export type Ponto = { lat: number; lng: number };
type Estado = 'desconhecido' | 'carregando' | 'ok' | 'negado' | 'indisponivel';
type Ctx = { ponto: Ponto | null; estado: Estado; ativar: () => Promise<boolean>; atualizar: () => Promise<void> };

const LocCtx = createContext<Ctx>({ ponto: null, estado: 'desconhecido', ativar: async () => false, atualizar: async () => {} });

export function LocalizacaoProvider({ children }: { children: ReactNode }) {
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [estado, setEstado] = useState<Estado>('desconhecido');

  const obter = useCallback(async () => {
    try {
      // posição recente (instantânea) e depois a atual
      const ultima = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60e3 }).catch(() => null);
      if (ultima) setPonto({ lat: ultima.coords.latitude, lng: ultima.coords.longitude });
      const atual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPonto({ lat: atual.coords.latitude, lng: atual.coords.longitude });
      setEstado('ok');
    } catch {
      setEstado((e) => (e === 'ok' ? 'ok' : 'indisponivel'));
    }
  }, []);

  // Se a permissão já foi dada antes, pega a posição sem perguntar de novo
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (p.granted) {
          setEstado('carregando');
          obter();
        } else if (!p.canAskAgain) setEstado('negado');
      })
      .catch(() => {});
  }, [obter]);

  // Atualiza ao voltar para o app (a pessoa pode ter se deslocado)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && estado === 'ok') obter();
    });
    return () => sub.remove();
  }, [estado, obter]);

  const ativar = useCallback(async () => {
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setEstado('negado');
        return false;
      }
      setEstado('carregando');
      await obter();
      return true;
    } catch {
      setEstado('indisponivel');
      return false;
    }
  }, [obter]);

  const valor = useMemo(() => ({ ponto, estado, ativar, atualizar: obter }), [ponto, estado, ativar, obter]);
  return <LocCtx.Provider value={valor}>{children}</LocCtx.Provider>;
}

export const useLocalizacao = () => useContext(LocCtx);

/** Distância em km entre dois pontos (fórmula de Haversine) */
export function distanciaKm(a: Ponto, b: Ponto) {
  const r = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** "a 800 m", "a 2,3 km", "a 15 km" */
export function fmtDistancia(km: number) {
  if (km < 1) return `a ${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  if (km < 10) return `a ${km.toFixed(1).replace('.', ',')} km`;
  return `a ${Math.round(km)} km`;
}

/** Distância do freelancer até o contratante, se os dois pontos existirem */
export function distanciaAte(ponto: Ponto | null, alvo?: { lat?: number | null; lng?: number | null } | null) {
  if (!ponto || alvo?.lat == null || alvo?.lng == null) return null;
  return distanciaKm(ponto, { lat: alvo.lat, lng: alvo.lng });
}
