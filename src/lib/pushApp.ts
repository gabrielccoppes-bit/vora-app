import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Notificações com o app fechado (Android/iOS), via Expo Push.
 * Só funciona depois de configurar o projeto na Expo (projectId) e o Firebase (Android).
 * Sem essa configuração, não faz nada — os avisos continuam aparecendo dentro do app.
 */
let tokenAtual: string | null = null;

// Com o app aberto, o aviso já aparece no topo da tela; não duplica com o banner do sistema.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export function projetoExpo(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function registrarPushApp(usuarioId: string): Promise<'ok' | 'sem-config' | 'negado' | 'indisponivel'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'indisponivel';
  const projectId = projetoExpo();
  if (!projectId) return 'sem-config';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('avisos', {
        name: 'Avisos do Vora',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FF5A12',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'negado';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    tokenAtual = token;
    await supabase.from('push_inscricoes').upsert({ usuario_id: usuarioId, tipo: 'expo', endpoint: token }, { onConflict: 'endpoint' });
    return 'ok';
  } catch {
    return 'indisponivel';
  }
}

/** Ao sair da conta, este aparelho para de receber os avisos dela */
export async function esquecerAparelho() {
  if (tokenAtual) await supabase.from('push_inscricoes').delete().eq('endpoint', tokenAtual);
  tokenAtual = null;
}

/** Abre a tela certa quando a pessoa toca na notificação */
export function aoTocarNotificacao(abrir: (rota: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const rota = (r.notification.request.content.data as { rota?: string } | undefined)?.rota;
    if (rota) abrir(rota);
  });
  return () => sub.remove();
}
