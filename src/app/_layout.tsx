import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Sora_400Regular, Sora_600SemiBold, useFonts } from '@expo-google-fonts/sora';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui';
import { LocalizacaoProvider } from '@/lib/localizacao';
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
  const { sessao, carregando } = useSessao();

  useEffect(() => {
    if (pronto && !carregando) SplashScreen.hideAsync();
  }, [pronto, carregando]);

  if (!pronto || carregando) return null;

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
      </Stack>
    </>
  );
}
