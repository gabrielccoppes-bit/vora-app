import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Sora_400Regular, Sora_600SemiBold, useFonts } from '@expo-google-fonts/sora';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Botao, T, Tela, ToastProvider } from '@/components/ui';
import { sair } from '@/lib/api';
import { LocalizacaoProvider } from '@/lib/localizacao';
import '@/lib/pwa'; // escuta o convite de instalação o quanto antes
import { SessaoProvider, useSessao } from '@/lib/sessao';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

const tema = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.orange, text: C.cream } };

export default function Raiz() {
  const [fontes] = useFonts({ Sora_400Regular, Sora_600SemiBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  return (
    <ThemeProvider value={tema}>
      <SessaoProvider>
        <LocalizacaoProvider>
          <ToastProvider>
            <Navegacao pronto={fontes} />
          </ToastProvider>
        </LocalizacaoProvider>
      </SessaoProvider>
    </ThemeProvider>
  );
}

function Navegacao({ pronto }: { pronto: boolean }) {
  const { sessao, perfil, carregando } = useSessao();

  useEffect(() => {
    if (pronto && !carregando) SplashScreen.hideAsync();
  }, [pronto, carregando]);

  // notificações com o app fechado (APK): registra o aparelho depois do login
  const uid = perfil?.id;
  useEffect(() => {
    if (Platform.OS === 'web' || !uid) return;
    let parar: (() => void) | undefined;
    import('@/lib/pushApp').then((m) => {
      m.registrarPushApp(uid).catch(() => {});
      parar = m.aoTocarNotificacao((rota) => router.push(rota as never));
    });
    return () => parar?.();
  }, [uid]);

  if (!pronto || carregando) return null;
  if (perfil?.suspenso) return <ContaSuspensa />;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        {/* Área logada */}
        <Stack.Protected guard={!!sessao}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="vaga/[id]" />
          <Stack.Screen name="freela/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="lista" />
          <Stack.Screen name="avaliar" />
          <Stack.Screen name="estabelecimento/[id]" />
          <Stack.Screen name="editar-perfil" />
          <Stack.Screen name="disponibilidade" />
          <Stack.Screen name="curriculo" />
          <Stack.Screen name="convites" />
          <Stack.Screen name="favoritos" />
          <Stack.Screen name="verificacao" />
          <Stack.Screen name="bloqueados" />
          <Stack.Screen name="relatorio" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="notificacoes" />
        </Stack.Protected>
        {/* Boas-vindas, login e cadastro */}
        <Stack.Protected guard={!sessao}>
          <Stack.Screen name="boas-vindas" options={{ animation: 'fade' }} />
          <Stack.Screen name="entrar" />
          <Stack.Screen name="tipo" />
          <Stack.Screen name="cadastro-freelancer" />
          <Stack.Screen name="cadastro-empresa" />
        </Stack.Protected>
        <Stack.Screen name="termos" options={{ presentation: 'modal' }} />
        {/* Aberta pelo link do e-mail (com ou sem login) */}
        <Stack.Screen name="nova-senha" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

/** Conta suspensa pela moderação */
function ContaSuspensa() {
  return (
    <Tela>
      <StatusBar style="light" />
      <T style={{ fontSize: 24, fontFamily: 'Sora_600SemiBold', marginTop: 80, paddingHorizontal: 24 }}>Conta suspensa</T>
      <T style={{ color: C.muted, lineHeight: 22, marginTop: 10, paddingHorizontal: 24 }}>
        Sua conta foi suspensa pela equipe do Vora depois de denúncias. Se acha que foi um engano, escreva para o suporte do Vora explicando o que aconteceu.
      </T>
      <Botao titulo="Sair" onPress={() => sair()} estilo={{ marginTop: 28, marginHorizontal: 24 }} />
    </Tela>
  );
}
