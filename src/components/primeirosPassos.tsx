import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { progressoPerfil, type Passo, type Perfil } from '@/lib/api';
import { aoMudarInstalacao, ehIphone, instalar, jaInstalado, podeInstalar } from '@/lib/pwa';
import { C, F } from '@/theme';
import { Icone } from './icone';
import { T } from './ui';

const ler = (k: string) => AsyncStorage.getItem(k).catch(() => null);
const gravar = (k: string) => AsyncStorage.setItem(k, '1').catch(() => {});

/** Lista de primeiros passos na tela Início (some quando tudo estiver feito ou se a pessoa dispensar) */
export function PrimeirosPassos({ perfil, versao }: { perfil: Perfil; versao: number }) {
  const [passos, setPassos] = useState<Passo[] | null>(null);
  const [oculto, setOculto] = useState(true);
  const chave = `vora:passos-ocultos:${perfil.id}`;

  useEffect(() => {
    ler(chave).then((v) => setOculto(v === '1'));
  }, [chave]);
  useEffect(() => {
    progressoPerfil(perfil).then(setPassos).catch(() => setPassos(null));
  }, [perfil, versao]);

  if (oculto || !passos) return null;
  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;
  const faltam = passos.filter((p) => !p.feito);

  return (
    <View style={{ marginHorizontal: 20, marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T style={{ fontFamily: F.soraSemi, fontSize: 17 }}>Primeiros passos</T>
        <Pressable
          hitSlop={10}
          accessibilityLabel="Esconder primeiros passos"
          onPress={() => {
            setOculto(true);
            gravar(chave);
          }}>
          <Icone nome="fechar" tamanho={18} cor={C.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2A211D', overflow: 'hidden' }}>
          <View style={{ width: `${(feitos / passos.length) * 100}%`, height: 6, backgroundColor: C.orange }} />
        </View>
        <T style={{ color: C.muted, fontSize: 12.5 }}>
          {feitos} de {passos.length}
        </T>
      </View>
      {faltam.slice(0, 3).map((p) => (
        <Pressable key={p.id} onPress={() => router.push(p.rota as never)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14 }, pressed && { opacity: 0.6 }]}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.muted2 }} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.interSemi, fontSize: 14.5 }}>{p.titulo}</T>
            <T style={{ color: C.muted, fontSize: 12.5, marginTop: 1 }}>{p.sub}</T>
          </View>
          <Icone nome="seta" tamanho={16} cor={C.muted} />
        </Pressable>
      ))}
    </View>
  );
}

/** Convite para instalar o site como app (só no navegador) */
export function InstalarApp() {
  const [, forcar] = useState(0);
  const [oculto, setOculto] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web' || jaInstalado()) return;
    ler('vora:instalar-oculto').then((v) => setOculto(v === '1'));
    return aoMudarInstalacao(() => forcar((n) => n + 1));
  }, []);
  if (Platform.OS !== 'web' || oculto || jaInstalado()) return null;
  const iphone = ehIphone();
  if (!podeInstalar() && !iphone) return null;

  return (
    <View style={{ marginHorizontal: 20, marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#FF5A1214', borderWidth: 1, borderColor: C.orange, flexDirection: 'row', gap: 12 }}>
      <Icone nome="raio" cor={C.orange} preenchido />
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>Instale o Vora no celular</T>
        <T style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
          {iphone
            ? 'No Safari, toque em Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início". Assim o Vora abre como app e recebe notificações.'
            : 'Abre direto da tela inicial, em tela cheia, e recebe notificações.'}
        </T>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          {!iphone ? (
            <T style={{ color: C.orange2, fontFamily: F.interSemi }} onPress={() => instalar().then(() => forcar((n) => n + 1))}>
              Instalar
            </T>
          ) : null}
          <T
            style={{ color: C.muted, fontFamily: F.interSemi }}
            onPress={() => {
              setOculto(true);
              gravar('vora:instalar-oculto');
            }}>
            Agora não
          </T>
        </View>
      </View>
    </View>
  );
}
