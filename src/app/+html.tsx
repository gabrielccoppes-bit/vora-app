import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// HTML base de cada página da versão web (só é usado com "output": "static").
// Roda apenas no Node durante o export: não use window, document nem APIs do navegador aqui.
// Importante (Expo SDK 58): headNodes/bodyNodes trazem os <script> do app. Sem eles a página fica em branco.
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html {...htmlAttributes} lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0D0A09" />
        <meta name="description" content="Vora — trabalho certo. No seu ritmo." />
        {/* app instalável pelo site (PWA) */}
        <link rel="manifest" href="/vora-app/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/vora-app/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vora" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body { background-color: #0D0A09; }' }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
