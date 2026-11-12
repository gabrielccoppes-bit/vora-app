import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Icone } from '@/components/icone';
import { Botao, Campo, Carregando, T, Tela, Topo, useToast } from '@/components/ui';
import { informarMei, meusTurnos, tenhoMei, type TurnoGanho } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

// Valores de 2026 (salário mínimo de R$ 1.621). Revisar todo janeiro.
const ANO = 2026;
const DAS_SERVICOS = 86.05; // 5% do salário mínimo (R$ 81,05) + R$ 5 de ISS
const LIMITE: Record<number, number> = { 2026: 81000, 2027: 110000, 2028: 140000 };
const PORTAL = 'https://www.gov.br/empreendedor';
const NFSE = 'https://www.nfse.gov.br/EmissorNacional';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function valorDo(t: TurnoGanho): number {
  if (t.vaga.periodo === 'hora') {
    if (!t.checkin_em || !t.checkout_em) return 0;
    return (t.vaga.valor_min * (new Date(t.checkout_em).getTime() - new Date(t.checkin_em).getTime())) / 3600e3;
  }
  return t.vaga.valor_min;
}

/** Freelancer: guia rápido do MEI, com o DAS, a nota fiscal e o limite do ano */
export default function Mei() {
  const { perfil } = useSessao();
  const [mei, setMei] = useState<boolean | null>(null);
  const [ganhoAno, setGanhoAno] = useState(0);
  const [cnpj, setCnpj] = useState('');
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  async function salvarCnpj() {
    setSalvando(true);
    try {
      await informarMei(cnpj);
      setMei(true);
      toast('MEI salvo! Vamos te lembrar do DAS todo mês.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      tenhoMei().then(setMei).catch(() => setMei(false));
      meusTurnos(perfil.id)
        .then((l) => {
          const ano = new Date().getFullYear();
          const soma = l
            .filter((t) => t.status === 'contratado' && new Date(t.vaga.inicio_em ?? t.criado_em).getFullYear() === ano && (t.checkout_em || new Date(t.vaga.inicio_em ?? t.criado_em).getTime() < Date.now()))
            .reduce((s, t) => s + valorDo(t), 0);
          setGanhoAno(soma);
        })
        .catch(() => {});
    }, [perfil])
  );

  if (mei === null)
    return (
      <Tela>
        <Topo titulo="Meu MEI" />
        <Carregando />
      </Tela>
    );

  const ano = new Date().getFullYear();
  const limite = LIMITE[ano] ?? LIMITE[ANO];
  const pct = Math.min(100, (ganhoAno / limite) * 100);
  const hoje = new Date();
  const proximoDas = new Date(hoje.getFullYear(), hoje.getMonth() + (hoje.getDate() > 20 ? 1 : 0), 20);

  return (
    <Tela>
      <Topo titulo={mei ? 'Meu MEI' : 'MEI: vale a pena?'} />
      <View style={{ paddingHorizontal: 20 }}>
        {mei ? (
          <>
            <View style={st.destaque}>
              <T style={{ color: C.muted, fontSize: 13 }}>Próximo DAS</T>
              <T style={{ fontFamily: F.soraSemi, fontSize: 26, marginTop: 2 }}>{brl(DAS_SERVICOS)}</T>
              <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                vence em {proximoDas.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · avisamos no dia 15
              </T>
              <Link texto="Gerar a guia no Portal do Empreendedor" url={PORTAL} />
            </View>

            <View style={st.cartao}>
              <T style={{ fontFamily: F.interSemi }}>Limite de faturamento em {ano}</T>
              <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                {brl(limite)} no ano. Pelo Vora você recebeu cerca de {brl(ganhoAno)} em {ano}.
              </T>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#2A201C', marginTop: 10, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: 8, backgroundColor: pct > 85 ? C.bad : C.orange }} />
              </View>
              <T style={{ color: C.muted2, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
                Some também o que você faturou fora do Vora. O limite sobe para R$ 110 mil em 2027 e R$ 140 mil em 2028. Até 20% acima do limite, você paga a diferença e vira microempresa no ano seguinte.
              </T>
            </View>
          </>
        ) : (
          <View style={st.destaque}>
            <T style={{ fontFamily: F.interSemi, fontSize: 16 }}>Por que ter um MEI?</T>
            <T style={{ color: C.muted, fontSize: 13.5, marginTop: 6, lineHeight: 20 }}>
              Com CNPJ você emite nota para os estabelecimentos, contribui para o INSS (aposentadoria por idade, auxílio-doença, salário-maternidade) e paga um valor fixo por mês: {brl(DAS_SERVICOS)} em {ANO} para prestação de serviços.
            </T>
            <T style={{ color: C.muted, fontSize: 13.5, marginTop: 6, lineHeight: 20 }}>
              Abrir é gratuito, pelo Portal do Empreendedor. Antes, confira se a sua ocupação está na lista de atividades permitidas.
            </T>
            <Link texto="Abrir meu MEI no Portal do Empreendedor" url={PORTAL} />
            <T style={{ color: C.cream, fontFamily: F.interSemi, marginTop: 18 }}>Já tenho MEI</T>
            <Campo rotulo="CNPJ do seu MEI" valor={cnpj} aoMudar={setCnpj} mascara="cnpj" keyboardType="number-pad" placeholder="00.000.000/0001-00" dica="Fica privado. Usamos só para os lembretes e o termo de serviço." />
            <Botao titulo="Salvar CNPJ" onPress={salvarCnpj} carregando={salvando} desativado={cnpj.replace(/\D/g, '').length < 14} estilo={{ marginTop: 12 }} />
          </View>
        )}

        <T style={st.secao}>O QUE O MEI PRECISA FAZER</T>
        <Item icone="dinheiro" titulo="Pagar o DAS todo mês" texto="Vence no dia 20. O valor é fixo, não importa quanto você faturou." />
        <Item icone="arquivo" titulo="Emitir nota quando o cliente for empresa" texto="O MEI emite a nota de serviço (NFS-e) pelo Emissor Nacional, no site ou no app. Para pessoa física, só se ela pedir." link={{ texto: 'Abrir o Emissor Nacional', url: NFSE }} />
        <Item icone="relogio" titulo="Declaração anual até 31 de maio" texto="A DASN-SIMEI informa quanto você faturou no ano anterior. Avisamos você em maio." />
        <Item icone="salvar" titulo="Anotar o que recebe" texto="Guarde mês a mês o total recebido. A tela Meus ganhos ajuda com o que veio pelo Vora." />

        <T style={{ color: C.muted2, fontSize: 12, marginTop: 18, lineHeight: 17 }}>
          Informação geral, com valores de {ANO}. Para o seu caso, confirme no Portal do Empreendedor ou com um contador.
        </T>
      </View>
    </Tela>
  );
}

function Link({ texto, url }: { texto: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
      <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 13.5 }}>{texto}</T>
      <Icone nome="seta" tamanho={14} cor={C.orange2} />
    </Pressable>
  );
}

function Item({ icone, titulo, texto, link }: { icone: 'dinheiro' | 'arquivo' | 'relogio' | 'salvar'; titulo: string; texto: string; link?: { texto: string; url: string } }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.linha }}>
      <Icone nome={icone} cor={C.orange} tamanho={20} />
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.interSemi }}>{titulo}</T>
        <T style={{ color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 19 }}>{texto}</T>
        {link ? <Link texto={link.texto} url={link.url} /> : null}
      </View>
    </View>
  );
}

const st = {
  destaque: { padding: 18, borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.orange },
  cartao: { padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginTop: 12 },
  secao: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1, marginTop: 26, marginBottom: 4 },
} as const;
