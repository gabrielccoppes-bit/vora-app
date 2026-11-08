import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AcessoForm, acessoVazio, validarAcesso, type CamposAcesso } from '@/components/acesso';
import { EnderecoForm, enderecoVazio, validarEndereco, type CamposEndereco } from '@/components/endereco';
import { Botao, Campo, Escolha, Secao, T, Tela, Topo, useToast, type TomDica } from '@/components/ui';
import { cadastrar, consultarCNPJ, documentoDisponivel, geocodificar } from '@/lib/api';
import { alfanum, cnpjValido, cpfValido, digitos, emailValido, fmtCEP } from '@/lib/validacao';
import { C, SETORES, TERMOS_VERSAO } from '@/theme';

const DICA_INICIAL = { texto: 'Aceita também o novo CNPJ alfanumérico.', tom: 'normal' as TomDica };

export default function CadastroEmpresa() {
  const toast = useToast();
  const [f, setF] = useState({ cnpj: '', razao: '', fantasia: '', setor: '', respNome: '', respCpf: '', respCargo: '', email: '', telefone: '' });
  const [end, setEnd] = useState<CamposEndereco>(enderecoVazio);
  const [acesso, setAcesso] = useState<CamposAcesso>(acessoVazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [dicaCnpj, setDicaCnpj] = useState(DICA_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const ultimoCnpj = useRef('');
  const cnpjAtual = useRef('');
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const set = (k: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }));
  };

  async function mudarCnpj(v: string) {
    set('cnpj')(v);
    const c = alfanum(v);
    cnpjAtual.current = c;
    if (c.length < 14) {
      ultimoCnpj.current = '';
      setDicaCnpj(DICA_INICIAL);
      return;
    }
    if (!cnpjValido(c)) {
      setErros((e) => ({ ...e, cnpj: 'CNPJ inválido — confira os dígitos.' }));
      return;
    }
    if (c === ultimoCnpj.current) return;
    ultimoCnpj.current = c;
    setDicaCnpj({ texto: 'Consultando a Receita Federal...', tom: 'carregando' });
    const r = await consultarCNPJ(c);
    if (cnpjAtual.current !== c) return;
    if (!r) {
      setDicaCnpj({ texto: 'CNPJ válido. Não foi possível consultar a Receita agora — preencha os dados da empresa.', tom: 'aviso' });
      return;
    }
    if (!r.ativa) {
      setErros((e) => ({ ...e, cnpj: `Situação na Receita: ${r.situacao || 'irregular'}. Só aceitamos empresas ativas.` }));
      setDicaCnpj({ texto: '', tom: 'normal' });
      return;
    }
    setF((p) => ({ ...p, razao: r.razao_social, fantasia: p.fantasia || r.nome_fantasia }));
    setEnd({ cep: fmtCEP(r.cep), logradouro: r.logradouro, numero: r.numero, complemento: r.complemento, bairro: r.bairro, cidade: r.cidade, uf: r.uf });
    setDicaCnpj({ texto: 'Empresa ativa — dados preenchidos pela Receita. Confira abaixo.', tom: 'ok' });
  }

  async function enviar() {
    const e: Record<string, string> = {};
    const cnpj = alfanum(f.cnpj);
    if (!cnpjValido(cnpj)) e.cnpj = 'CNPJ inválido — confira os dígitos.';
    if (!f.razao.trim()) e.razao = 'Informe a razão social.';
    if (!f.fantasia.trim()) e.fantasia = 'Como a empresa aparece no app.';
    if (!f.setor) e.setor = 'Escolha o tipo de negócio.';
    if (f.respNome.trim().split(/\s+/).length < 2) e.respNome = 'Informe nome e sobrenome.';
    if (!cpfValido(f.respCpf)) e.respCpf = 'CPF inválido.';
    if (!f.respCargo.trim()) e.respCargo = 'Informe o cargo.';
    if (!emailValido(f.email)) e.email = 'Informe um e-mail válido.';
    if (digitos(f.telefone).length < 10) e.telefone = 'Informe DDD + número.';
    Object.assign(e, validarEndereco(end), validarAcesso(acesso));
    if (!e.cnpj && !(await documentoDisponivel({ cnpj }))) e.cnpj = 'Este CNPJ já possui cadastro.';

    setErros(e);
    if (Object.keys(e).length) {
      toast('Confira os campos destacados');
      rolagem.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setEnviando(true);
    try {
      // ponto aproximado do estabelecimento (para os freelancers verem a distância)
      const geo = await geocodificar({ cep: digitos(end.cep), logradouro: end.logradouro, numero: end.numero, cidade: end.cidade, uf: end.uf }).catch(() => null);
      const { precisaConfirmarEmail } = await cadastrar(f.email, acesso.senha, {
        lat: geo ? String(geo.lat) : '',
        lng: geo ? String(geo.lng) : '',
        tipo: 'empresa',
        nome: f.fantasia.trim(),
        titulo: f.setor,
        area: f.setor,
        cnpj,
        razao_social: f.razao.trim(),
        responsavel_nome: f.respNome.trim(),
        responsavel_cpf: digitos(f.respCpf),
        responsavel_cargo: f.respCargo.trim(),
        telefone: digitos(f.telefone),
        cep: digitos(end.cep),
        logradouro: end.logradouro.trim(),
        numero: end.numero.trim(),
        complemento: end.complemento.trim(),
        bairro: end.bairro.trim(),
        cidade: end.cidade.trim(),
        uf: end.uf,
        termos_versao: TERMOS_VERSAO,
      });
      if (precisaConfirmarEmail) {
        toast('Conta criada! Confirme pelo link enviado ao e-mail.');
        router.replace('/entrar');
      } else {
        toast('Conta criada com sucesso!');
      }
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const respCpfD = digitos(f.respCpf);
  return (
    <Tela rolar={false}>
      <Topo titulo="Cadastro do contratante" />
      <ScrollView ref={rolagem} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <T style={{ color: C.muted, lineHeight: 21 }}>Digite o CNPJ e buscamos razão social e endereço na Receita Federal.</T>

        <Secao titulo="Empresa ou estabelecimento" />
        <Campo
          rotulo="CNPJ"
          valor={f.cnpj}
          aoMudar={mudarCnpj}
          mascara="cnpj"
          autoCapitalize="characters"
          placeholder="00.000.000/0000-00"
          erro={erros.cnpj}
          dica={dicaCnpj.texto}
          tomDica={dicaCnpj.tom}
          valido={dicaCnpj.tom === 'ok'}
        />
        <Campo rotulo="Razão social" valor={f.razao} aoMudar={set('razao')} placeholder="Preenchida pela consulta" erro={erros.razao} />
        <Campo rotulo="Nome fantasia (aparece no app)" valor={f.fantasia} aoMudar={set('fantasia')} placeholder="Ex.: Bar do Zé, NovaTech" erro={erros.fantasia} />
        <Escolha rotulo="Tipo de negócio" valor={f.setor} opcoes={SETORES} aoMudar={set('setor')} erro={erros.setor} />

        <EnderecoForm titulo="Endereço da sede" valor={end} aoMudar={setEnd} erros={erros} />

        <Secao titulo="Responsável pela conta" />
        <Campo rotulo="Nome completo" valor={f.respNome} aoMudar={set('respNome')} placeholder="Quem administra a conta" erro={erros.respNome} />
        <Campo
          rotulo="CPF do responsável"
          valor={f.respCpf}
          aoMudar={set('respCpf')}
          mascara="cpf"
          keyboardType="number-pad"
          placeholder="000.000.000-00"
          erro={erros.respCpf || (respCpfD.length === 11 && !cpfValido(respCpfD) ? 'CPF inválido.' : '')}
          dica={respCpfD.length === 11 && cpfValido(respCpfD) ? 'CPF válido' : undefined}
          tomDica="ok"
        />
        <Campo rotulo="Cargo" valor={f.respCargo} aoMudar={set('respCargo')} placeholder="Ex.: Gerente de RH" erro={erros.respCargo} />
        <Campo rotulo="E-mail corporativo" valor={f.email} aoMudar={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="rh@empresa.com.br" erro={erros.email} />
        <Campo rotulo="Telefone" valor={f.telefone} aoMudar={set('telefone')} mascara="telefone" keyboardType="phone-pad" placeholder="(51) 3000-0000" erro={erros.telefone} />

        <AcessoForm valor={acesso} aoMudar={setAcesso} erros={erros} />
        <View style={{ marginTop: 24 }}>
          <Botao titulo="Criar conta" onPress={enviar} carregando={enviando} />
        </View>
      </ScrollView>
    </Tela>
  );
}
