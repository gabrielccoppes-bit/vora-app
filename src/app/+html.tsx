import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// HTML base de cada página da versão web (só é usado com "output": "static").
// Roda apenas no Node durante o export: não use window, document nem APIs do navegador aqui.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0D0A09" />
        <meta name="description" content="Vora — trabalho certo. No seu ritmo." />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body { background-color: #0D0A09; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
