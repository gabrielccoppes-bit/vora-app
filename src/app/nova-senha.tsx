import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Botao, Campo, Carregando, T, Tela, Topo, useToast } from '@/components/ui';
import { definirNovaSenha } from '@/lib/api';
import { senhaVazada } from '@/lib/senha';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { senhaForte } from '@/lib/validacao';
import { C, F } from '@/theme';

type Estado = 'verificando' | 'pronto' | 'invalido';

/** Lê os parâmetros do link (o Supabase manda os dados depois do "#"). */
function parametros(url: string | null) {
  const p = new URLSearchParams();
  if (!url) return p;
  const [antes, hash = ''] = url.split('#');
  const busca = antes.includes('?') ? antes.slice(antes.indexOf('?') + 1) : '';
  for (const parte of [busca, hash]) new URLSearchParams(parte).forEach((v, k) => p.set(k, v));
  return p;
}

export default function NovaSenha() {
  const toast = useToast();
  const { sessao } = useSessao();
  const urlApp = Linking.useURL();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erros, setErros] = useState<{ senha?: string; conf?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const tratado = useRef(false);

  useEffect(() => {
    if (tratado.current) return;
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : urlApp;
    if (Platform.OS !== 'web' && urlApp === null) {
      // ainda carregando o link no app; se não vier nada, cai no estado inválido
      const t = setTimeout(() => {
        if (!tratado.current) {
          tratado.current = true;
          if (sessao) setEstado('pronto');
          else {
            setMotivo('Abra o link que enviamos para o seu e-mail.');
            setEstado('invalido');
          }
        }
      }, 1500);
      return () => clearTimeout(t);
    }
    tratado.current = true;
    const p = parametros(url);

    // limpa os dados sensíveis da barra de endereço
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    (async () => {
      try {
        if (p.get('error') || p.get('error_code')) {
          const cod = p.get('error_code') ?? '';
          setMotivo(cod.includes('expired') ? 'Esse link expirou ou já foi usado. Peça um novo na tela de entrar.' : 'Esse link não é válido. Peça um novo na tela de entrar.');
          return setEstado('invalido');
        }
        const access = p.get('access_token');
        const refresh = p.get('refresh_token');
        const tokenHash = p.get('token_hash');
        if (access && refresh) {
          const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          if (error) throw error;
          return setEstado('pronto');
        }
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error) throw error;
          return setEstado('pronto');
        }
        if (sessao) return setEstado('pronto');
        setMotivo('Abra o link que enviamos para o seu e-mail.');
        setEstado('invalido');
      } catch {
        setMotivo('Esse link expirou ou já foi usado. Peça um novo na tela de entrar.');
        setEstado('invalido');
      }
    })();
  }, [urlApp, sessao]);

  async function salvar() {
    const e: typeof erros = {};
    if (!senhaForte(senha)) e.senha = 'Use pelo menos 8 caracteres, com letras e números.';
    else if (conf !== senha) e.conf = 'As senhas não são iguais.';
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      if ((await senhaVazada(senha)) > 0) {
        setErros({ senha: 'Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.' });
        return;
      }
      await definirNovaSenha(senha);
      toast('Senha alterada!');
      router.replace('/inicio');
    } catch (err) {
      setErros({ senha: (err as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  if (estado === 'verificando') return <Tela><Carregando /></Tela>;

  return (
    <Tela>
      <Topo voltar={false} />
      <View style={{ paddingHorizontal: 20 }}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 14 }} />
        {estado === 'invalido' ? (
          <>
            <T style={{ fontFamily: F.soraSemi, fontSize: 26 }}>Link inválido</T>
            <T style={{ color: C.muted, marginTop: 6, lineHeight: 21 }}>{motivo}</T>
            <Botao titulo="Ir para entrar" onPress={() => router.replace(sessao ? '/inicio' : '/entrar')} estilo={{ marginTop: 24 }} />
          </>
        ) : (
          <>
            <T style={{ fontFamily: F.soraSemi, fontSize: 26 }}>Crie uma nova senha</T>
            <T style={{ color: C.muted, marginTop: 6, marginBottom: 8 }}>Pelo menos 8 caracteres, com letras e números.</T>
            <Campo rotulo="Nova senha" valor={senha} aoMudar={setSenha} secureTextEntry autoComplete="new-password" placeholder="••••••••" erro={erros.senha} />
            <Campo rotulo="Repita a nova senha" valor={conf} aoMudar={setConf} secureTextEntry autoComplete="new-password" placeholder="••••••••" erro={erros.conf} onSubmitEditing={salvar} />
            <Botao titulo="Salvar nova senha" onPress={salvar} carregando={salvando} estilo={{ marginTop: 24 }} />
          </>
        )}
      </View>
    </Tela>
  );
}
