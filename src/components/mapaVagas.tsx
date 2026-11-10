import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { htmlMapa, type PinoVaga } from './mapaHtml';

/** Mapa de vagas no app (Android/iOS): página do mapa dentro de uma WebView */
export function MapaVagas({ pinos, eu, aoAbrir }: { pinos: PinoVaga[]; eu: { lat: number; lng: number } | null; aoAbrir: (id: string) => void }) {
  return (
    <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlMapa(pinos, eu) }}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data) as { vora?: string; id?: string };
            if (d.vora === 'abrir' && d.id) aoAbrir(d.id);
          } catch {
            // ignora mensagens que não são do mapa
          }
        }}
        style={{ flex: 1, backgroundColor: '#0D0A09' }}
      />
    </View>
  );
}
