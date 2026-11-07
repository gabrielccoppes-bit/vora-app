import { router } from 'expo-router';

import { senhaForte } from '@/lib/validacao';
import { C, F } from '@/theme';
import { AvisoPrivacidade, Campo, Marcar, Secao, T } from './ui';

export type CamposAcesso = { senha: string; senha2: string; termos: boolean };
export const acessoVazio: CamposAcesso = { senha: '', senha2: '', termos: false };

export function validarAcesso(a: CamposAcesso) {
  const e: Partial<Record<keyof CamposAcesso, string>> = {};
  if (!senhaForte(a.senha)) e.senha = 'Use 8+ caracteres, com letras e números.';
  if (a.senha !== a.senha2) e.senha2 = 'As senhas não conferem.';
  if (!a.termos) e.termos = 'É preciso aceitar os termos.';
  return e;
}

export function AcessoForm({ valor, aoMudar, erros }: { valor: CamposAcesso; aoMudar: (v: CamposAcesso) => void; erros: Partial<Record<string, string>> }) {
  return (
    <>
      <Secao titulo="Acesso" />
      <Campo rotulo="Senha" valor={valor.senha} aoMudar={(senha) => aoMudar({ ...valor, senha })} secureTextEntry autoComplete="new-password" placeholder="Mínimo 8 caracteres, com letras e números" erro={erros.senha} />
      <Campo rotulo="Confirmar senha" valor={valor.senha2} aoMudar={(senha2) => aoMudar({ ...valor, senha2 })} secureTextEntry autoComplete="new-password" placeholder="Repita a senha" erro={erros.senha2} />
      <AvisoPrivacidade>
        Usamos seu CPF/CNPJ apenas para verificar identidade e viabilizar contratos.{' '}
        <T style={{ fontFamily: F.interSemi, fontSize: 13, color: C.cream }}>Documento e endereço completo nunca aparecem no perfil público</T> — os outros usuários veem só cidade e UF.
      </AvisoPrivacidade>
      <Marcar marcado={valor.termos} aoMudar={(termos) => aoMudar({ ...valor, termos })} erro={!!erros.termos}>
        <T style={{ fontSize: 14, lineHeight: 20, color: '#D9C9BE' }}>
          Li e aceito os{' '}
          <T style={{ color: C.orange2, fontSize: 14 }} onPress={() => router.push('/termos')}>
            Termos de uso e a Política de privacidade
          </T>{' '}
          da Vora, e autorizo o tratamento dos meus dados conforme a LGPD.
        </T>
      </Marcar>
    </>
  );
}
