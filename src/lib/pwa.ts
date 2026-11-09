import { Platform } from 'react-native';

/** Instalação do site como app (PWA). O navegador avisa cedo; guardamos o convite para usar depois. */
type ConviteInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let convite: ConviteInstalar | null = null;
const ouvintes = new Set<() => void>();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    convite = e as ConviteInstalar;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    convite = null;
    ouvintes.forEach((f) => f());
  });
  // service worker (necessário para notificações e ajuda na instalação)
  if ('serviceWorker' in navigator) {
    const base = window.location.pathname.startsWith('/vora-app') ? '/vora-app' : '';
    const registrar = () => navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar);
  }
}

export function jaInstalado() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
export function ehIphone() {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export const podeInstalar = () => !!convite;
export function aoMudarInstalacao(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
export async function instalar() {
  if (!convite) return false;
  await convite.prompt();
  const { outcome } = await convite.userChoice;
  convite = null;
  ouvintes.forEach((f) => f());
  return outcome === 'accepted';
}
