import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { EnderecoForm, enderecoVazio, validarEndereco, type CamposEndereco } from '@/components/endereco';
import { Icone } from '@/components/icone';
import { Avatar, Botao, Campo, Carregando, Escolha, Folha, Secao, T, Tela, Topo, useToast } from '@/components/ui';
import {
  conferirSenhaAtual,
  definirNovaSenha,
  enviarFoto,
  fotoUrl,
  geocodificar,
  meusDadosPrivados,
  removerFoto,
  salvarPerfil,
  type DadosPrivados,
} from '@/lib/api';
import { escolherImagem } from '@/lib/imagem';
import { senhaVazada } from '@/lib/senha';
import { useSessao } from '@/lib/sessao';
import { digitos, fmtCEP, fmtTelefone, senhaForte } from '@/lib/validacao';
import { C, CATEGORIAS, F, SETORES } from '@/theme';

type Form = { nome: string; titulo: string; area: string; telefone: string; respNome: string; respCargo: string };

export default function EditarPerfil() {
  const { perfil, sessao, recarregarPerfil } = useSessao();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const toast = useToast();
  const empresa = perfil?.tipo === 'empresa';
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [privados, setPrivados] = useState<DadosPrivados | null>(null);
  const [f, setF] = useState<Form>({ nome: '', titulo: '', area: '', telefone: '', respNome: '', respCargo: '' });
  const [end, setEnd] = useState<CamposEndereco>(enderecoVazio);
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState<'enviando' | 'removendo' | null>(null);
  const [opcoesFoto, setOpcoesFoto] = useState(false);

  // troca de senha
  const [senhaAberta, setSenhaAberta] = useState(secao === 'senha');
  const [sAtual, setSAtual] = useState('');
  const [sNova, setSNova] = useState('');
  const [sConf, setSConf] = useState('');
  const [errosS, setErrosS] = useState<{ atual?: string; nova?: string; conf?: string }>({});
  const [salvandoS, setSalvandoS] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    meusDadosPrivados(perfil.id)
      .then((d) => {
        setPrivados(d);
        setF({
          nome: perfil.nome,
          titulo: perfil.titulo ?? '',
          area: perfil.area ?? '',
          telefone: fmtTelefone(d?.telefone ?? ''),
          respNome: d?.responsavel_nome ?? '',
          respCargo: d?.responsavel_cargo ?? '',
        });
        if (d)
          setEnd({
            cep: fmtCEP(d.cep),
            logradouro: d.logradouro,
            numero: d.numero,
            complemento: d.complemento ?? '',
            bairro: d.bairro,
            cidade: perfil.cidade,
            uf: perfil.uf,
          });
      })
      .catch(() => toast('Não foi possível carregar seus dados.'));
    // só na abertura da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const set = (k: keyof Form) => (v: string) => setF((a) => ({ ...a, [k]: v }));

  async function escolherFoto() {
    setOpcoesFoto(false);
    if (!perfil) return;
    try {
      const img = await escolherImagem({ origem: 'galeria', quadrado: true, max: 512 });
      if (!img) return;
      setFoto('enviando');
      await enviarFoto(perfil.id, img.bytes);
      await recarregarPerfil();
      toast(empresa ? 'Logo atualizado!' : 'Foto atualizada!');
    } catch (e) {
      toast((e as Error).message || 'Não foi possível enviar a foto.');
    } finally {
      setFoto(null);
    }
  }

  async function tirarFoto() {
    setOpcoesFoto(false);
    if (!perfil) return;
    setFoto('removendo');
    try {
      await removerFoto(perfil.id);
      await recarregarPerfil();
      toast('Foto removida.');
    } catch {
      toast('Não foi possível remover agora.');
    } finally {
      setFoto(null);
    }
  }

  async function salvar() {
    if (!perfil || !privados) return;
    const e: Record<string, string | undefined> = {};
    if (f.nome.trim().length < 2) e.nome = empresa ? 'Informe o nome do estabelecimento.' : 'Informe seu nome.';
    if (empresa) {
      if (!f.titulo) e.titulo = 'Escolha o tipo de negócio.';
      if (f.respNome.trim().length < 3) e.respNome = 'Informe o nome do responsável.';
    } else {
      if (!f.area) e.area = 'Escolha uma área.';
      if (!f.titulo.trim()) e.titulo = 'Ex.: Bartender, Garçom...';
    }
    if (digitos(f.telefone).length < 10) e.telefone = 'Informe DDD + número.';
    Object.assign(e, validarEndereco(end));
    setErros(e);
    if (Object.values(e).some(Boolean)) {
      toast('Confira os campos destacados');
      rolagem.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSalvando(true);
    try {
      const cep = digitos(end.cep);
      const mudouEndereco =
        cep !== privados.cep || end.logradouro.trim() !== privados.logradouro || end.numero.trim() !== privados.numero || end.cidade !== perfil.cidade || end.uf !== perfil.uf;

      let ponto: { lat: number | null; lng: number | null } | undefined;
      if (empresa && (mudouEndereco || perfil.lat === null)) {
        const geo = await geocodificar({ cep, logradouro: end.logradouro, numero: end.numero, cidade: end.cidade, uf: end.uf }).catch(() => null);
        // ponto aproximado (~100 m), como no cadastro
        ponto = geo ? { lat: Math.round(geo.lat * 1000) / 1000, lng: Math.round(geo.lng * 1000) / 1000 } : mudouEndereco ? { lat: null, lng: null } : undefined;
      }

      await salvarPerfil(perfil.id, {
        perfil: {
          nome: f.nome.trim(),
          titulo: empresa ? f.titulo : f.titulo.trim(),
          area: empresa ? f.titulo : f.area,
          cidade: end.cidade.trim(),
          uf: end.uf,
          ...(ponto ?? {}),
        },
        privados: {
          telefone: digitos(f.telefone),
          cep,
          logradouro: end.logradouro.trim(),
          numero: end.numero.trim(),
          complemento: end.complemento.trim() || null,
          bairro: end.bairro.trim(),
          ...(empresa ? { responsavel_nome: f.respNome.trim(), responsavel_cargo: f.respCargo.trim() || null } : {}),
        },
      });
      await recarregarPerfil();
      toast(empresa && mudouEndereco && ponto?.lat === null ? 'Salvo! Não achamos o endereço no mapa; a distância não vai aparecer.' : 'Perfil atualizado!');
      if (router.canGoBack()) router.back();
    } catch {
      toast('Não foi possível salvar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    const email = sessao?.user.email;
    if (!email) return;
    const e: typeof errosS = {};
    if (!sAtual) e.atual = 'Informe a senha atual.';
    if (!senhaForte(sNova)) e.nova = 'Use pelo menos 8 caracteres, com letras e números.';
    else if (sNova === sAtual) e.nova = 'A nova senha precisa ser diferente da atual.';
    else if (sConf !== sNova) e.conf = 'As senhas não são iguais.';
    setErrosS(e);
    if (Object.keys(e).length) return;
    setSalvandoS(true);
    try {
      try {
        await conferirSenhaAtual(email, sAtual);
      } catch (err) {
        return setErrosS({ atual: (err as Error).message });
      }
      if ((await senhaVazada(sNova)) > 0) return setErrosS({ nova: 'Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.' });
      await definirNovaSenha(sNova);
      setSenhaAberta(false);
      setSAtual('');
      setSNova('');
      setSConf('');
      toast('Senha alterada!');
    } catch (err) {
      setErrosS({ nova: (err as Error).message });
    } finally {
      setSalvandoS(false);
    }
  }

  if (!perfil || !privados) return <Tela><Topo titulo="Editar perfil" /><Carregando /></Tela>;

  const url = fotoUrl(perfil);

  return (
    <Tela rolar={false}>
      <Topo titulo="Editar perfil" />
      <ScrollView ref={rolagem} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <Pressable onPress={() => (url ? setOpcoesFoto(true) : escolherFoto())} disabled={!!foto} accessibilityLabel={empresa ? 'Trocar logo' : 'Trocar foto'}>
            <View style={{ opacity: foto ? 0.5 : 1 }}>
              <Avatar nome={f.nome || perfil.nome} tamanho={96} quadrado={empresa} foto={url} />
            </View>
            <View style={{ position: 'absolute', right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg }}>
              <Icone nome="editar" tamanho={15} cor={C.onOrange} />
            </View>
          </Pressable>
          <T style={{ color: C.muted, fontSize: 13, marginTop: 10 }}>
            {foto === 'enviando' ? 'Enviando...' : foto === 'removendo' ? 'Removendo...' : url ? `Toque para trocar ${empresa ? 'o logo' : 'a foto'}` : `Adicionar ${empresa ? 'logo' : 'foto'}`}
          </T>
        </View>

        {empresa ? (
          <>
            <Secao titulo="Estabelecimento" />
            <Campo rotulo="Nome fantasia" valor={f.nome} aoMudar={set('nome')} erro={erros.nome} />
            <Escolha rotulo="Tipo de negócio" valor={f.titulo} opcoes={SETORES} aoMudar={set('titulo')} erro={erros.titulo} />
            <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 8 }}>CNPJ e razão social não podem ser alterados. Para corrigir, fale com o suporte.</T>
            <EnderecoForm titulo="Endereço da sede" valor={end} aoMudar={setEnd} erros={erros} />
            <Secao titulo="Responsável e contato" />
            <Campo rotulo="Nome do responsável" valor={f.respNome} aoMudar={set('respNome')} erro={erros.respNome} />
            <Campo rotulo="Cargo (opcional)" valor={f.respCargo} aoMudar={set('respCargo')} placeholder="Ex.: Sócio, Gerente" />
          </>
        ) : (
          <>
            <Secao titulo="Dados pessoais" />
            <Campo rotulo="Nome completo" valor={f.nome} aoMudar={set('nome')} erro={erros.nome} autoComplete="name" />
            <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 8 }}>CPF e data de nascimento não podem ser alterados.</T>
            <Secao titulo="Atuação" />
            <Escolha rotulo="Área principal" valor={f.area} opcoes={CATEGORIAS} aoMudar={set('area')} erro={erros.area} />
            <Campo rotulo="Título profissional" valor={f.titulo} aoMudar={set('titulo')} placeholder="Ex.: Bartender, Garçom" erro={erros.titulo} />
            <EnderecoForm valor={end} aoMudar={setEnd} erros={erros} />
            <Secao titulo="Contato" />
          </>
        )}
        <Campo rotulo="Celular" valor={f.telefone} aoMudar={set('telefone')} mascara="telefone" keyboardType="phone-pad" placeholder="(51) 90000-0000" erro={erros.telefone} />

        <Botao titulo="Salvar alterações" onPress={salvar} carregando={salvando} estilo={{ marginTop: 26 }} />
        <Botao titulo="Alterar senha" icone="cadeado" variante="fantasma" onPress={() => setSenhaAberta(true)} estilo={{ marginTop: 6 }} />
      </ScrollView>

      <Folha visivel={opcoesFoto} aoFechar={() => setOpcoesFoto(false)} titulo={empresa ? 'Logo' : 'Foto de perfil'}>
        <Botao titulo={empresa ? 'Escolher outro logo' : 'Escolher outra foto'} onPress={escolherFoto} />
        <Botao titulo="Remover" variante="perigo" onPress={tirarFoto} estilo={{ marginTop: 10 }} />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setOpcoesFoto(false)} />
      </Folha>

      <Folha visivel={senhaAberta} aoFechar={() => setSenhaAberta(false)} titulo="Alterar senha">
        <Campo rotulo="Senha atual" valor={sAtual} aoMudar={setSAtual} secureTextEntry autoComplete="current-password" erro={errosS.atual} />
        <Campo rotulo="Nova senha" valor={sNova} aoMudar={setSNova} secureTextEntry autoComplete="new-password" dica="Pelo menos 8 caracteres, com letras e números." erro={errosS.nova} />
        <Campo rotulo="Repita a nova senha" valor={sConf} aoMudar={setSConf} secureTextEntry autoComplete="new-password" erro={errosS.conf} onSubmitEditing={trocarSenha} />
        <Botao titulo="Salvar nova senha" onPress={trocarSenha} carregando={salvandoS} estilo={{ marginTop: 20 }} />
        <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 12, textAlign: 'center' }}>Esqueceu a senha atual? Saia da conta e use “Esqueci minha senha”.</T>
      </Folha>
    </Tela>
  );
}
