import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { Botao, Carregando, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import {
  ativarPush,
  desativarPush,
  estadoPush,
  listarNotificacoes,
  marcarLidas,
  ouvirNotificacoes,
  type EstadoPush,
  type Notificacao,
} from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

const ICONES: Record<string, NomeIcone> = {
  candidatura: 'pessoas',
  contratado: 'check',
  recusado: 'fechar',
  cancelado: 'fechar',
  falta: 'fechar',
  convite: 'enviar',
  convite_aceito: 'check',
  convite_recusado: 'fechar',
  mensagem: 'chat',
  avaliacao: 'estrela',
  verificacao: 'escudo',
  urgente: 'raio',
  presenca: 'local',
  substituto: 'pessoas',
  lembrete: 'relogio',
  indicacao: 'enviar',
};

/** Central de avisos: tudo o que aconteceu com você no Vora */
export default function Notificacoes() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [lista, setLista] = useState<Notificacao[] | null>(null);
  const [push, setPush] = useState<EstadoPush>('indisponivel');
  const [ativando, setAtivando] = useState(false);

  const carregar = useCallback(() => {
    if (!perfil) return;
    listarNotificacoes(perfil.id).then(setLista).catch(() => setLista([]));
    estadoPush().then(setPush).catch(() => {});
  }, [perfil]);
  useFocusEffect(carregar);

  useEffect(() => {
    if (!perfil) return;
    return ouvirNotificacoes(perfil.id, (n) => setLista((l) => (l ? [n, ...l.filter((x) => x.id !== n.id)] : l)));
  }, [perfil]);

  async function abrir(n: Notificacao) {
    if (!perfil) return;
    if (!n.lida) {
      setLista((l) => (l ?? []).map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      marcarLidas(perfil.id, n.id).catch(() => {});
    }
    if (n.rota) router.push(n.rota as never);
  }

  async function lerTodas() {
    if (!perfil) return;
    setLista((l) => (l ?? []).map((x) => ({ ...x, lida: true })));
    await marcarLidas(perfil.id).catch(() => {});
  }

  async function alternarPush() {
    if (!perfil) return;
    setAtivando(true);
    try {
      if (push === 'ativo') {
        await desativarPush();
        toast('Notificações do navegador desligadas.');
      } else {
        await ativarPush(perfil.id);
        toast('Pronto! Você vai receber avisos mesmo com o site fechado.');
      }
      setPush(await estadoPush());
    } catch (e) {
      toast((e as Error).message);
      setPush(await estadoPush().catch(() => 'inativo' as const));
    } finally {
      setAtivando(false);
    }
  }

  const temNaoLidas = (lista ?? []).some((n) => !n.lida);

  return (
    <Tela>
      <Topo
        titulo="Avisos"
        direita={
          temNaoLidas ? (
            <Pressable onPress={lerTodas} hitSlop={8} style={{ paddingHorizontal: 8 }}>
              <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 13.5 }}>Marcar como lidos</T>
            </Pressable>
          ) : null
        }
      />
      <View style={{ paddingHorizontal: 20 }}>
        {Platform.OS === 'web' ? (
          push === 'indisponivel' ? null : (
            <View style={{ padding: 16, borderRadius: 18, backgroundColor: push === 'ativo' ? C.card : '#FF5A1214', borderWidth: 1, borderColor: push === 'ativo' ? C.stroke : C.orange, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Icone nome="sino" cor={C.orange} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: F.interSemi }}>{push === 'ativo' ? 'Notificações ligadas neste navegador' : 'Receba os avisos mesmo com o site fechado'}</T>
                  <T style={{ color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                    {push === 'bloqueado'
                      ? 'Você bloqueou as notificações. Libere nas configurações do navegador (cadeado ao lado do endereço).'
                      : push === 'ativo'
                        ? 'Convites, contratações e mensagens chegam como notificação.'
                        : 'No iPhone, primeiro adicione o Vora à tela de início (Compartilhar → Adicionar à Tela de Início).'}
                  </T>
                </View>
              </View>
              {push !== 'bloqueado' ? (
                <Botao titulo={push === 'ativo' ? 'Desligar' : 'Ligar notificações'} variante={push === 'ativo' ? 'contorno' : 'pri'} carregando={ativando} onPress={alternarPush} estilo={{ marginTop: 12, height: 44 }} />
              ) : null}
            </View>
          )
        ) : null}

        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio icone="sino" texto="Nenhum aviso ainda. Candidaturas, convites, contratações e mensagens aparecem aqui." />
        ) : (
          <View style={{ gap: 2 }}>
            {lista.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => abrir(n)}
                style={({ pressed }) => [
                  { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, backgroundColor: n.lida ? 'transparent' : '#FF5A120F' },
                  pressed && { opacity: 0.7 },
                ]}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF5A1220', alignItems: 'center', justifyContent: 'center' }}>
                  <Icone nome={ICONES[n.tipo] ?? 'sino'} cor={C.orange} tamanho={17} preenchido={n.tipo === 'urgente' || n.tipo === 'avaliacao'} />
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: n.lida ? F.inter : F.interSemi, fontSize: 14.5, lineHeight: 20 }}>{n.titulo}</T>
                  {n.corpo ? (
                    <T style={{ color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
                      {n.corpo}
                    </T>
                  ) : null}
                  <T style={{ color: C.muted2, fontSize: 12, marginTop: 4 }}>{tempoRelativo(n.criado_em)}</T>
                </View>
                {!n.lida ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange, marginTop: 6 }} /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Tela>
  );
}
