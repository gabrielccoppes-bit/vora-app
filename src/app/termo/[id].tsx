import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Botao, Carregando, Marcar, T, Tela, Topo, useToast, Vazio } from '@/components/ui';
import { aceitarTermo, PER, termoPorId, type Termo } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cnpjFmt = (c: string | null) => (c && c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : (c ?? ''));

/** Monta as cláusulas do termo a partir do retrato salvo na contratação */
function clausulas(t: Termo) {
  const { contratante: e, prestador: p, servico: s } = t.conteudo;
  const valor = `R$ ${s.valor_min.toLocaleString('pt-BR')}${s.valor_max ? ` a R$ ${s.valor_max.toLocaleString('pt-BR')}` : ''}${PER[s.periodo]}`;
  const quando = s.inicio_em ? `com início em ${dataHora(s.inicio_em)}` : 'em data combinada entre as partes';
  return [
    [
      'PARTES',
      `CONTRATANTE: ${e.razao_social ?? e.nome}${e.razao_social && e.razao_social !== e.nome ? ` (nome fantasia ${e.nome})` : ''}, CNPJ ${cnpjFmt(e.cnpj)}, com sede em ${e.endereco}, ${e.cidade}/${e.uf}${e.responsavel ? `, representada por ${e.responsavel}${e.cargo ? ` (${e.cargo})` : ''}` : ''}.\nPRESTADOR(A): ${p.nome}, CPF ${p.cpf ?? '—'}${p.cnpj_mei ? `, MEI/CNPJ ${cnpjFmt(p.cnpj_mei)}` : ''}, residente em ${p.cidade}/${p.uf}.`,
    ],
    ['1. OBJETO', `Prestação de serviço de ${s.titulo} (${s.area}), ${quando}, duração: ${s.duracao}, no estabelecimento da CONTRATANTE. Descrição: ${s.descricao}`],
    ['2. REMUNERAÇÃO', `${valor}, a ser pago pela CONTRATANTE ao PRESTADOR na forma e no prazo combinados entre as partes. Quando o serviço for pago por hora, valem as horas registradas no check-in e check-out do aplicativo.`],
    ['3. NATUREZA DO SERVIÇO', 'As partes declaram que se trata de prestação de serviço eventual e autônoma, sem exclusividade e sem subordinação, não havendo intenção de criar vínculo de emprego.'],
    ['4. OBRIGAÇÕES DO PRESTADOR', 'Comparecer no horário combinado, registrar chegada e saída no aplicativo, seguir as normas de segurança, higiene e conduta do local e avisar com antecedência caso não possa comparecer.'],
    ['5. OBRIGAÇÕES DA CONTRATANTE', 'Oferecer condições seguras de trabalho, informar previamente traje e o necessário para o serviço e pagar o valor combinado no prazo acordado.'],
    ['6. CANCELAMENTO E FALTA', 'Cancelamentos e faltas ficam registrados no histórico das partes no aplicativo. Cancelamentos com menos de 24 horas do início são considerados de última hora.'],
    ['7. DADOS PESSOAIS', 'Os dados das partes são tratados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) e a Política de Privacidade do Vora, apenas para a execução deste serviço.'],
    ['8. PLATAFORMA', 'O Vora é a plataforma que aproximou as partes e não é parte deste termo.'],
  ];
}

export default function TermoServico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSessao();
  const toast = useToast();
  const [t, setT] = useState<Termo | null | undefined>(undefined);
  const [li, setLi] = useState(false);
  const [aceitando, setAceitando] = useState(false);

  useEffect(() => {
    if (id) termoPorId(id).then(setT).catch(() => setT(null));
  }, [id]);

  if (t === undefined) return <Tela><Topo titulo="Termo de serviço" /><Carregando /></Tela>;
  if (!t) return <Tela><Topo titulo="Termo de serviço" /><Vazio icone="arquivo" texto="Termo não encontrado." /></Tela>;

  const souPrestador = perfil?.id === t.freelancer_id;
  const lista = clausulas(t);

  async function aceitar() {
    if (!t) return;
    setAceitando(true);
    try {
      await aceitarTermo(t.id);
      setT(await termoPorId(t.id));
      toast('Termo aceito!');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAceitando(false);
    }
  }

  function compartilhar() {
    if (!t) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') return window.print();
    const texto = ['TERMO DE PRESTAÇÃO DE SERVIÇO AUTÔNOMO', '', ...lista.map(([a, b]) => `${a}\n${b}\n`), assinaturas(t)].join('\n');
    Share.share({ title: 'Termo de prestação de serviço', message: texto }).catch(() => {});
  }

  return (
    <Tela>
      <Topo titulo="Termo de serviço" />
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ backgroundColor: '#FBF4EE', borderRadius: 18, padding: 18 }}>
          <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 17, textAlign: 'center' }}>TERMO DE PRESTAÇÃO DE SERVIÇO AUTÔNOMO</T>
          {lista.map(([titulo, texto]) => (
            <View key={titulo} style={{ marginTop: 14 }}>
              <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 13 }}>{titulo}</T>
              <T style={{ color: '#3B2F29', fontSize: 14, lineHeight: 21, marginTop: 4 }}>{texto}</T>
            </View>
          ))}
          <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 13, marginTop: 18 }}>ACEITES</T>
          <T style={{ color: '#3B2F29', fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>{assinaturas(t)}</T>
          <T style={{ color: '#9A8A80', fontSize: 11.5, marginTop: 14, lineHeight: 16 }}>
            Modelo simplificado gerado pelo Vora (versão {t.conteudo.versao}) com os dados do momento da contratação. Para situações específicas, consulte um advogado.
          </T>
        </View>

        {souPrestador && !t.aceite_freela_em ? (
          <>
            <Marcar marcado={li} aoMudar={setLi}>
              <T style={{ fontSize: 14, lineHeight: 20 }}>Li e concordo com este termo de prestação de serviço.</T>
            </Marcar>
            <Botao titulo="Aceitar termo" onPress={aceitar} carregando={aceitando} estilo={{ marginTop: 16, opacity: li ? 1 : 0.5 }} desativado={!li} />
          </>
        ) : null}
        <Botao titulo={Platform.OS === 'web' ? 'Imprimir ou salvar em PDF' : 'Compartilhar'} icone="compartilhar" variante="contorno" onPress={compartilhar} estilo={{ marginTop: 12 }} />
      </View>
    </Tela>
  );
}

function assinaturas(t: Termo) {
  return [
    `Contratante: aceito ao contratar, em ${dataHora(t.aceite_empresa_em)}.`,
    t.aceite_freela_em ? `Prestador(a): aceito no aplicativo em ${dataHora(t.aceite_freela_em)}.` : 'Prestador(a): aguardando aceite.',
  ].join('\n');
}
