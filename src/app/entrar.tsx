import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Botao, Campo, T, Tela, Topo } from '@/components/ui';
import { entrar } from '@/lib/api';
import { emailValido } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({});
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const e: typeof erros = {};
    if (!emailValido(email)) e.email = 'Informe um e-mail válido.';
    if (!senha) e.senha = 'Informe a senha.';
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      await entrar(email, senha); // a navegação acontece sozinha quando a sessão muda
    } catch (err) {
      setErros({ senha: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Topo />
      <View style={{ paddingHorizontal: 20 }}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 14 }} />
        <T style={{ fontFamily: F.soraSemi, fontSize: 26 }}>Bem-vindo(a) de volta</T>
        <T style={{ color: C.muted, marginTop: 6, marginBottom: 8 }}>Entre com o e-mail e a senha cadastrados.</T>
        <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="voce@email.com" erro={erros.email} />
        <Campo rotulo="Senha" valor={senha} aoMudar={setSenha} secureTextEntry autoComplete="current-password" placeholder="••••••••" erro={erros.senha} onSubmitEditing={enviar} />
        <Botao titulo="Entrar" onPress={enviar} carregando={enviando} estilo={{ marginTop: 24 }} />
        <Pressable onPress={() => router.replace('/tipo')} style={{ marginTop: 20, alignItems: 'center' }}>
          <T style={{ color: C.muted, fontSize: 14 }}>
            Ainda não tem conta? <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 14 }}>Criar conta</T>
          </T>
        </Pressable>
      </View>
    </Tela>
  );
}
