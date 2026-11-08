import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Botao, Campo, Carregando, Escolha, T, Tela, Topo, useToast } from '@/components/ui';
import { meuServico, publicarVaga, salvarServico, type Vaga } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { digitos, dinheiro } from '@/lib/validacao';
import { C, CATEGORIAS, CONTRATOS, F, HOSPITALIDADE, MODALIDADES, NIVEIS, PERIODOS } from '@/theme';

export default function Publicar() {
  const { perfil } = useSessao();
  if (!perfil) return <Carregando />;
  return perfil.tipo === 'empresa' ? <PublicarVaga /> : <PublicarServico />;
}

function PublicarVaga() {
  const { perfil } = useSessao();
  const toast = useToast();
  // Bares, restaurantes e casas noturnas: padrão presencial, freelance e por diária
  const casa = HOSPITALIDADE.includes(perfil?.titulo ?? '');
  const vazio = {
    titulo: '', area: '', modalidade: casa ? 'Presencial' : 'Remoto', contrato: casa ? 'Freelance' : 'PJ', nivel: 'Pleno',
    periodo: casa ? 'diaria' : 'mes', min: '', max: '', duracao: '', descricao: '', requisitos: '',
  };
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }));
  };

  async function enviar() {
    const min = Number(digitos(f.min));
    const max = Number(digitos(f.max));
    const e: Record<string, string> = {};
    if (f.titulo.trim().length < 4) e.titulo = 'Informe o título da vaga.';
    if (!f.area) e.area = 'Escolha a categoria.';
    if (!min) e.min = 'Informe o valor.';
    if (max && max < min) e.max = 'Deve ser maior que o mínimo.';
    if (!f.duracao.trim()) e.duracao = 'Ex.: Projeto de 2 meses.';
    if (f.descricao.trim().length < 30) e.descricao = 'Descreva com pelo menos 30 caracteres.';
    setErros(e);
    if (Object.keys(e).length) return toast('Confira os campos destacados');
    setEnviando(true);
    try {
      const { id } = await publicarVaga({
        empresa_id: perfil!.id,
        titulo: f.titulo.trim(),
        area: f.area,
        modalidade: f.modalidade,
        contrato: f.contrato,
        nivel: f.nivel,
        valor_min: min,
        valor_max: max || null,
        periodo: f.periodo as Vaga['periodo'],
        duracao: f.duracao.trim(),
        descricao: f.descricao.trim(),
        requisitos: f.requisitos.split(',').map((x) => x.trim()).filter(Boolean),
      });
      setF(vazio);
      toast('Vaga publicada!');
      router.push(`/vaga/${id}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Topo titulo="Publicar vaga" voltar={false} />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          A vaga aparece com o nome <T style={{ color: C.cream, fontFamily: F.interSemi }}>{perfil?.nome}</T> e a cidade da sede ({perfil?.cidade}, {perfil?.uf}).
        </T>
        <Campo rotulo="Título da vaga" valor={f.titulo} aoMudar={set('titulo')} placeholder={casa ? 'Ex.: Bartender para sexta e sábado' : 'Ex.: Desenvolvedor(a) Front-End'} erro={erros.titulo} />
        <Escolha rotulo="Categoria" valor={f.area} opcoes={CATEGORIAS} aoMudar={set('area')} erro={erros.area} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Escolha rotulo="Modalidade" valor={f.modalidade} opcoes={MODALIDADES} aoMudar={set('modalidade')} estilo={{ flex: 1 }} />
          <Escolha rotulo="Contrato" valor={f.contrato} opcoes={CONTRATOS} aoMudar={set('contrato')} estilo={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Escolha rotulo="Nível" valor={f.nivel} opcoes={NIVEIS} aoMudar={set('nivel')} estilo={{ flex: 1 }} />
          <Escolha rotulo="Pagamento" valor={f.periodo} opcoes={PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} aoMudar={set('periodo')} estilo={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Campo rotulo="Valor mínimo (R$)" valor={f.min} aoMudar={set('min')} mascara="dinheiro" keyboardType="number-pad" placeholder={casa ? '180' : '6.000'} erro={erros.min} estilo={{ flex: 1 }} />
          <Campo rotulo="Valor máximo" valor={f.max} aoMudar={set('max')} mascara="dinheiro" keyboardType="number-pad" placeholder="opcional" erro={erros.max} estilo={{ flex: 1 }} />
        </View>
        <Campo rotulo="Duração" valor={f.duracao} aoMudar={set('duracao')} placeholder={casa ? 'Ex.: Sex e sáb, 20h às 4h' : 'Ex.: Projeto de 3 meses'} erro={erros.duracao} />
        <Campo rotulo="Descrição" valor={f.descricao} aoMudar={set('descricao')} multiline placeholder={casa ? 'Conte sobre a casa, o público, uniforme, alimentação e transporte no fim do turno.' : 'Conte sobre o projeto, entregas e como é trabalhar com vocês.'} erro={erros.descricao} maxLength={2000} />
        <Campo rotulo="Requisitos (separe por vírgula)" valor={f.requisitos} aoMudar={set('requisitos')} placeholder="React, TypeScript, Git" />
        <Botao titulo="Publicar vaga" onPress={enviar} carregando={enviando} estilo={{ marginTop: 24 }} />
      </View>
    </Tela>
  );
}

function PublicarServico() {
  const { perfil, recarregarPerfil } = useSessao();
  const toast = useToast();
  const [f, setF] = useState({ titulo: '', area: '', valor: '', habilidades: '', bio: '' });
  const [existe, setExiste] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: '' }));
  };

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      meuServico(perfil.id)
        .then((s) => {
          setExiste(!!s);
          setF({
            titulo: s?.titulo ?? perfil.titulo ?? '',
            area: s?.area ?? perfil.area ?? '',
            valor: s ? dinheiro(s.valor_hora) : '',
            habilidades: s?.habilidades.join(', ') ?? '',
            bio: s?.bio ?? '',
          });
        })
        .finally(() => setPronto(true));
    }, [perfil])
  );

  async function enviar() {
    const valor = Number(digitos(f.valor));
    const e: Record<string, string> = {};
    if (f.titulo.trim().length < 3) e.titulo = 'Informe o título.';
    if (!f.area) e.area = 'Escolha a categoria.';
    if (!valor) e.valor = 'Informe o valor por hora.';
    if (!f.habilidades.trim()) e.habilidades = 'Liste ao menos uma habilidade.';
    if (f.bio.trim().length < 20) e.bio = 'Escreva pelo menos 20 caracteres.';
    setErros(e);
    if (Object.keys(e).length) return toast('Confira os campos destacados');
    setEnviando(true);
    try {
      const { id } = await salvarServico({
        freelancer_id: perfil!.id,
        titulo: f.titulo.trim(),
        area: f.area,
        valor_hora: valor,
        habilidades: f.habilidades.split(',').map((x) => x.trim()).filter(Boolean),
        bio: f.bio.trim(),
      });
      await recarregarPerfil();
      toast(existe ? 'Serviço atualizado!' : 'Serviço publicado!');
      router.push(`/freela/${id}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!pronto) return <Carregando />;
  return (
    <Tela>
      <Topo titulo={existe ? 'Editar meu serviço' : 'Publicar serviço'} voltar={false} />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Seu perfil de serviço aparece para as empresas. Mostramos só nome, cidade e UF — CPF e endereço completo nunca são exibidos.
        </T>
        <Campo rotulo="Título do serviço" valor={f.titulo} aoMudar={set('titulo')} placeholder="Ex.: UX/UI Designer" erro={erros.titulo} />
        <Escolha rotulo="Categoria" valor={f.area} opcoes={CATEGORIAS} aoMudar={set('area')} erro={erros.area} />
        <Campo rotulo="Valor por hora (R$)" valor={f.valor} aoMudar={set('valor')} mascara="dinheiro" keyboardType="number-pad" placeholder="100" erro={erros.valor} />
        <Campo rotulo="Habilidades (separe por vírgula)" valor={f.habilidades} aoMudar={set('habilidades')} placeholder="Figma, Prototipação, UX Research" erro={erros.habilidades} />
        <Campo rotulo="Sobre você" valor={f.bio} aoMudar={set('bio')} multiline placeholder="Experiência, tipos de projeto, diferenciais." erro={erros.bio} maxLength={800} />
        <Botao titulo={existe ? 'Salvar alterações' : 'Publicar serviço'} onPress={enviar} carregando={enviando} estilo={{ marginTop: 24 }} />
      </View>
    </Tela>
  );
}
