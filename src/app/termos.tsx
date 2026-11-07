import { router } from 'expo-router';
import { View } from 'react-native';

import { Botao, T, Tela, Topo } from '@/components/ui';
import { C, F, TERMOS_VERSAO } from '@/theme';

// ATENÇÃO: texto-modelo. Peça a um advogado para revisar antes de publicar o app.
const SECOES: [string, string][] = [
  ['Quais dados coletamos', 'Nome, CPF ou CNPJ, data de nascimento (freelancers), e-mail, telefone e endereço. Para empresas, também os dados do responsável pela conta.'],
  ['Para que usamos', 'Verificar identidade, prevenir fraudes, viabilizar contratos e notas fiscais e conectar freelancers a oportunidades. Base legal: execução de contrato e legítimo interesse (LGPD, art. 7º).'],
  ['O que fica visível para outros usuários', 'Apenas nome, título profissional ou setor, cidade e UF. CPF, CNPJ, telefone, e-mail e endereço completo nunca aparecem em perfis públicos.'],
  ['Compartilhamento', 'Ao se candidatar, a empresa vê seu perfil público e a mensagem que você escrever. Não vendemos dados pessoais.'],
  ['Seus direitos (LGPD, art. 18)', 'Você pode acessar, corrigir, exportar e excluir seus dados a qualquer momento em Perfil → Privacidade.'],
  ['Segurança', 'Os dados ficam em servidores com criptografia em repouso e acesso restrito por regras de segurança no banco: só você consegue ler seus documentos e endereço.'],
  ['Contato do encarregado (DPO)', 'privacidade@vora.app (substitua pelo e-mail real).'],
];

export default function Termos() {
  return (
    <Tela>
      <Topo titulo="Termos e privacidade" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, fontSize: 13 }}>Versão {TERMOS_VERSAO} · resumo</T>
        {SECOES.map(([t, txt]) => (
          <View key={t} style={{ marginTop: 18 }}>
            <T style={{ fontFamily: F.interSemi, fontSize: 15.5, color: C.orange2 }}>{t}</T>
            <T style={{ color: '#E2D2C6', lineHeight: 22, marginTop: 6 }}>{txt}</T>
          </View>
        ))}
        <Botao titulo="Entendi" onPress={() => router.back()} estilo={{ marginTop: 28 }} />
      </View>
    </Tela>
  );
}
