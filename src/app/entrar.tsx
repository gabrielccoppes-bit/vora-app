import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Botao, Campo, Folha, T, Tela, Topo } from '@/components/ui';
import { entrar, pedirNovaSenha } from '@/lib/api';
import { emailValido } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [emailRec, setEmailRec] = useState('');
  const [erroRec, setErroRec] = useState<string>();
  const [enviandoRec, setEnviandoRec] = useState(false);
  const [enviadoRec, setEnviadoRec] = useState(false);

  function abrirEsqueci() {
    setEmailRec(email);
    setErroRec(undefined);
    setEnviadoRec(false);
    setEsqueci(true);
  }

  async function enviarLink() {
    if (!emailValido(emailRec)) return setErroRec('Informe um e-mail válido.');
    setErroRec(undefined);
    setEnviandoRec(true);
    try {
      await pedirNovaSenha(emailRec);
      setEnviadoRec(true);
    } catch (err) {
      setErroRec((err as Error).message);
    } finally {
      setEnviandoRec(false);
    }
  }

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
        <Pressable onPress={abrirEsqueci} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 12 }}>
          <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 14 }}>Esqueci minha senha</T>
        </Pressable>
        <Botao titulo="Entrar" onPress={enviar} carregando={enviando} estilo={{ marginTop: 20 }} />
        <Pressable onPress={() => router.replace('/tipo')} style={{ marginTop: 20, alignItems: 'center' }}>
          <T style={{ color: C.muted, fontSize: 14 }}>
            Ainda não tem conta? <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 14 }}>Criar conta</T>
          </T>
        </Pressable>
      </View>

      <Folha visivel={esqueci} aoFechar={() => setEsqueci(false)} titulo="Recuperar senha">
        {enviadoRec ? (
          <>
            <T style={{ color: C.muted, lineHeight: 21 }}>
              Se existir uma conta com <T style={{ color: C.cream, fontFamily: F.interSemi }}>{emailRec.trim()}</T>, enviamos um link para criar uma nova senha. Confira também a caixa de spam.
            </T>
            <T style={{ color: C.muted, lineHeight: 21, marginTop: 10 }}>Abra o link neste aparelho. Ele vale por 1 hora.</T>
            <Botao titulo="Entendi" onPress={() => setEsqueci(false)} estilo={{ marginTop: 20 }} />
          </>
        ) : (
          <>
            <T style={{ color: C.muted, lineHeight: 21 }}>Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</T>
            <Campo rotulo="E-mail" valor={emailRec} aoMudar={setEmailRec} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="voce@email.com" erro={erroRec} onSubmitEditing={enviarLink} />
            <Botao titulo="Enviar link" onPress={enviarLink} carregando={enviandoRec} estilo={{ marginTop: 20 }} />
          </>
        )}
      </Folha>
    </Tela>
  );
}
