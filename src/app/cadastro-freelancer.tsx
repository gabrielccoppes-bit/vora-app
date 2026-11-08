import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AcessoForm, acessoVazio, validarAcesso, type CamposAcesso } from '@/components/acesso';
import { EnderecoForm, enderecoVazio, validarEndereco, type CamposEndereco } from '@/components/endereco';
import { Botao, Campo, Escolha, Interruptor, Secao, T, Tela, Topo, useToast, type TomDica } from '@/components/ui';
import { senhaVazada } from '@/lib/senha';
import { cadastrar, documentoDisponivel } from '@/lib/api';
import { alfanum, cnpjValido, cpfValido, dataISO, digitos, emailValido, idade } from '@/lib/validacao';
import { C, CATEGORIAS, TERMOS_VERSAO } from '@/theme';

export default function CadastroFreelancer() {
  const toast = useToast();
  const [f, setF] = useState({ nome: '', cpf: '', nascimento: '', email: '', telefone: '', area: '', titulo: '', mei: false, cnpj: '' });
  const [end, setEnd] = useState<CamposEndereco>(enderecoVazio);
  const [acesso, setAcesso] = useState<CamposAcesso>(acessoVazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (erros[k as string]) setErros((e) => ({ ...e, [k]: '' }));
  };

  // feedback imediato do CPF
  const cpfD = digitos(f.cpf);
  let dicaCpf: { texto: string; tom: TomDica } | undefined;
  if (cpfD.length === 11) dicaCpf = cpfValido(cpfD) ? { texto: 'CPF válido', tom: 'ok' } : undefined;
  const erroCpfAoVivo = cpfD.length === 11 && !cpfValido(cpfD) ? 'CPF inválido — confira os números.' : '';

  async function enviar() {
    const e: Record<string, string> = {};
    if (f.nome.trim().split(/\s+/).length < 2) e.nome = 'Informe nome e sobrenome.';
    if (!cpfValido(f.cpf)) e.cpf = 'CPF inválido — confira os números.';
    const iso = dataISO(f.nascimento);
    if (!iso) e.nascimento = 'Data inválida (DD/MM/AAAA).';
    else if (idade(iso) < 18) e.nascimento = 'É preciso ter 18 anos ou mais.';
    else if (idade(iso) > 110) e.nascimento = 'Data inválida.';
    if (!emailValido(f.email)) e.email = 'Informe um e-mail válido.';
    if (digitos(f.telefone).length < 10) e.telefone = 'Informe DDD + número.';
    if (!f.area) e.area = 'Escolha uma área.';
    if (!f.titulo.trim()) e.titulo = 'Ex.: Bartender, Garçom, Designer...';
    if (f.mei && !cnpjValido(f.cnpj)) e.cnpj = 'CNPJ inválido.';
    Object.assign(e, validarEndereco(end), validarAcesso(acesso));

    if (!e.cpf && !(await documentoDisponivel({ cpf: digitos(f.cpf) }))) e.cpf = 'Este CPF já possui cadastro.';
    if (!e.senha && (await senhaVazada(acesso.senha)) > 0) e.senha = 'Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.';

    setErros(e);
    if (Object.keys(e).length) {
      toast('Confira os campos destacados');
      rolagem.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setEnviando(true);
    try {
      const { precisaConfirmarEmail } = await cadastrar(f.email, acesso.senha, {
        tipo: 'freelancer',
        nome: f.nome.trim(),
        titulo: f.titulo.trim(),
        area: f.area,
        cpf: digitos(f.cpf),
        nascimento: iso!,
        cnpj_mei: f.mei ? alfanum(f.cnpj) : '',
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
        toast('Conta criada! Confirme pelo link enviado ao seu e-mail.');
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

  return (
    <Tela rolar={false}>
      <Topo titulo="Cadastro de freelancer" />
      <ScrollView ref={rolagem} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <T style={{ color: C.muted, lineHeight: 21 }}>Leva uns 2 minutos. Os campos são validados automaticamente.</T>

        <Secao titulo="Dados pessoais" />
        <Campo rotulo="Nome completo" valor={f.nome} aoMudar={set('nome')} autoComplete="name" placeholder="Como está no seu documento" erro={erros.nome} />
        <Campo
          rotulo="CPF"
          valor={f.cpf}
          aoMudar={set('cpf')}
          mascara="cpf"
          keyboardType="number-pad"
          placeholder="000.000.000-00"
          erro={erros.cpf || erroCpfAoVivo}
          dica={dicaCpf?.texto}
          tomDica={dicaCpf?.tom}
          valido={!!dicaCpf}
        />
        <Campo rotulo="Data de nascimento" valor={f.nascimento} aoMudar={set('nascimento')} mascara="data" keyboardType="number-pad" placeholder="DD/MM/AAAA" erro={erros.nascimento} />

        <Secao titulo="Contato" />
        <Campo rotulo="E-mail" valor={f.email} aoMudar={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="voce@email.com" erro={erros.email} />
        <Campo rotulo="Celular" valor={f.telefone} aoMudar={set('telefone')} mascara="telefone" keyboardType="phone-pad" placeholder="(51) 90000-0000" erro={erros.telefone} />

        <EnderecoForm valor={end} aoMudar={setEnd} erros={erros} />

        <Secao titulo="Atuação" />
        <Escolha rotulo="Área principal" valor={f.area} opcoes={CATEGORIAS} aoMudar={set('area')} erro={erros.area} />
        <Campo rotulo="Título profissional" valor={f.titulo} aoMudar={set('titulo')} placeholder="Ex.: Bartender, Garçom, Product Designer" erro={erros.titulo} />
        <Interruptor titulo="Tenho CNPJ (MEI ou empresa)" sub="Para emitir nota fiscal nos projetos" valor={f.mei} aoMudar={set('mei')} />
        {f.mei ? (
          <Campo
            rotulo="CNPJ"
            valor={f.cnpj}
            aoMudar={set('cnpj')}
            mascara="cnpj"
            autoCapitalize="characters"
            placeholder="00.000.000/0000-00"
            erro={erros.cnpj || (alfanum(f.cnpj).length === 14 && !cnpjValido(f.cnpj) ? 'CNPJ inválido.' : '')}
            dica={alfanum(f.cnpj).length === 14 && cnpjValido(f.cnpj) ? 'CNPJ válido' : undefined}
            tomDica="ok"
          />
        ) : null}

        <AcessoForm valor={acesso} aoMudar={setAcesso} erros={erros} />
        <View style={{ marginTop: 24 }}>
          <Botao titulo="Criar conta" onPress={enviar} carregando={enviando} />
        </View>
      </ScrollView>
    </Tela>
  );
}
