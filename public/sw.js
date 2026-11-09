/* Vora — service worker das notificações do navegador */
const BASE = self.registration.scope.replace(/\/$/, ''); // ex.: https://.../vora-app

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch (_) {
    d = { titulo: 'Vora', corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(d.titulo || 'Vora', {
      body: d.corpo || '',
      icon: BASE + '/icone-192.png',
      badge: BASE + '/badge-96.png',
      tag: d.rota || undefined, // avisos da mesma tela se substituem
      renotify: !!d.rota,
      data: { rota: d.rota || '/notificacoes' },
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = BASE + (evento.notification.data && evento.notification.data.rota ? evento.notification.data.rota : '/notificacoes');
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(BASE) && 'focus' in j) {
          j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
