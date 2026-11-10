import { createElement, useEffect } from 'react';
import { View } from 'react-native';

import { htmlMapa, type PinoVaga } from './mapaHtml';

/** Mapa de vagas no site: a mesma página do mapa, num iframe */
export function MapaVagas({ pinos, eu, aoAbrir }: { pinos: PinoVaga[]; eu: { lat: number; lng: number } | null; aoAbrir: (id: string) => void }) {
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      try {
        const d = JSON.parse(e.data) as { vora?: string; id?: string };
        if (d.vora === 'abrir' && d.id) aoAbrir(d.id);
      } catch {
        // ignora
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [aoAbrir]);
  return (
    <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}>
      {createElement('iframe', {
        srcDoc: htmlMapa(pinos, eu),
        title: 'Mapa de vagas',
        style: { border: 0, width: '100%', height: '100%', background: '#0D0A09' },
        sandbox: 'allow-scripts allow-popups',
      })}
    </View>
  );
}
