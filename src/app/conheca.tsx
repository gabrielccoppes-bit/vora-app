import { Image } from 'expo-image';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { Brilho, T } from '@/components/ui';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

type Item = { icone: NomeIcone; titulo: string; texto: string };

const PASSOS: Item[] = [
  { icone: 'mais', titulo: 'Publique o turno', texto: 'Função, dia, horário e valor. Leva um minuto. Se for para hoje, marque como urgente e avisamos quem está perto.' },
  { icone: 'usuario', titulo: 'Escolha quem vai', texto: 'Veja nota, presença, selos, elogios de clientes e experiência de cada candidato. Converse pelo chat antes de contratar.' },
  { icone: 'check', titulo: 'Turno feito, tudo registrado', texto: 'Termo de serviço gerado sozinho, check-in e check-out pelo celular e avaliação dos dois lados no final.' },
];

const CASAS: Item[] = [
  { icone: 'raio', titulo: 'Equipe em minutos', texto: 'Vaga urgente avisa na hora os freelancers da sua cidade, com os mais próximos primeiro.' },
  { icone: 'escudo', titulo: 'Gente verificada e avaliada', texto: 'Identidade conferida, histórico de presença e selos como Pontual e Top avaliado.' },
  { icone: 'cadeado', titulo: 'Seu time da casa', texto: 'Favoritos veem a vaga antes de todo mundo. Se alguém cancelar, chamamos um substituto sozinhos.' },
  { icone: 'relogio', titulo: 'Escalas que se repetem', texto: 'Toda sexta e sábado? Publique a escala uma vez e convide de novo quem já trabalhou bem.' },
  { icone: 'arquivo', titulo: 'Papelada pronta', texto: 'Termo de prestação de serviço com os dados das duas partes, gerado em cada contratação.' },
  { icone: 'estrela', titulo: 'Selo Casa Vora', texto: 'Pagou em dia e tratou bem a equipe? Sua casa sobe no ranking e atrai os melhores freelancers.' },
];

const FREELAS: Item[] = [
  { icone: 'local', titulo: 'Turnos perto de você', texto: 'Lista ou mapa, com filtro por área e distância. Diga quando está livre e receba convites.' },
  { icone: 'dinheiro', titulo: 'Gorjeta direto no seu Pix', texto: 'Seu QR Code no crachá: o cliente elogia e manda gorjeta sem passar pelo Vora.' },
  { icone: 'inicio', titulo: 'Volta para casa segura', texto: 'Veja se a casa paga a volta, divida o carro com colegas e avise alguém quando chegar.' },
  { icone: 'brilho', titulo: 'Carteira de trabalho', texto: 'Seu histórico verificado vira currículo com link, para conseguir mais turnos ou vaga fixa.' },
  { icone: 'estrela', titulo: 'Saiba onde vale a pena', texto: 'Ranking das melhores casas para trabalhar, avaliadas por quem já fez turno lá.' },
  { icone: 'arquivo', titulo: 'Ajuda com o MEI', texto: 'Lembrete do DAS, quanto falta para o limite do ano e como emitir nota.' },
];

const FAQ = [
  { p: 'Quanto custa?', r: 'Criar conta é gratuito, para estabelecimentos e para freelancers.' },
  { p: 'Como o freelancer recebe?', r: 'O valor fica combinado na vaga e registrado no termo de serviço. Por enquanto, o pagamento é feito direto entre o estabelecimento e o freelancer.' },
  { p: 'Onde o Vora funciona?', r: 'Estamos começando por Porto Alegre e região metropolitana, com bares, restaurantes, casas noturnas e eventos.' },
  { p: 'Preciso baixar um app?', r: 'Não. O Vora funciona no navegador do celular e pode ser instalado na tela inicial. O app para Android está chegando.' },
  { p: 'Meus dados ficam seguros?', r: 'CPF, telefone e endereço nunca aparecem no perfil. Seguimos a LGPD: você pode baixar ou apagar seus dados quando quiser.' },
  { p: 'E se algo der errado no turno?', r: 'Dá para denunciar ou bloquear qualquer conta, e a equipe do Vora analisa cada caso. Faltas e cancelamentos em cima da hora ficam no histórico.' },
];

/** Página de apresentação (pública) */
export default function Conheca() {
  const { width } = useWindowDimensions();
  const { sessao } = useSessao();
  const largo = width >= 860;
  const [aberta, setAberta] = useState<number | null>(0);
  const cadastrar = () => router.push(sessao ? '/inicio' : '/tipo');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Head>
        <title>Vora · Freelancers para bares e restaurantes em Porto Alegre</title>
        <meta name="description" content="Garçons, bartenders, cozinheiros e equipe de apoio para o seu turno, verificados e avaliados. Para freelancers: turnos perto de você, gorjeta por Pix e volta para casa segura." />
        <meta property="og:title" content="Vora · Turnos de bar e restaurante, resolvidos" />
        <meta property="og:description" content="Conecta bares, restaurantes e eventos a freelancers de hospitalidade em Porto Alegre." />
      </Head>

      {/* Topo */}
      <View style={[st.faixa, { paddingTop: 22, paddingBottom: largo ? 90 : 56, overflow: 'hidden' }]}>
        <Brilho />
        <View style={[st.miolo, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('@/assets/images/logo-mark.png')} style={{ width: 34, height: 22 }} contentFit="contain" />
            <T style={{ fontFamily: F.sora, fontSize: 24, letterSpacing: -0.5 }}>vora</T>
          </View>
          <Pressable onPress={() => router.push(sessao ? '/inicio' : '/entrar')} style={st.entrar} accessibilityRole="link">
            <T style={{ fontFamily: F.interSemi, fontSize: 14 }}>{sessao ? 'Abrir o app' : 'Entrar'}</T>
          </Pressable>
        </View>

        <View style={[st.miolo, { marginTop: largo ? 72 : 44, flexDirection: largo ? 'row' : 'column', gap: 40, alignItems: largo ? 'center' : 'stretch' }]}>
          <View style={{ flex: largo ? 1.2 : undefined }}>
            <T style={st.selo}>PORTO ALEGRE · BARES, RESTAURANTES E EVENTOS</T>
            <T style={[st.h1, { fontSize: largo ? 58 : 40, lineHeight: largo ? 64 : 46 }]} accessibilityRole="header">
              Turno de hoje,{'\n'}
              <T style={[st.h1, { fontSize: largo ? 58 : 40, lineHeight: largo ? 64 : 46, color: C.orange }]}>equipe de hoje.</T>
            </T>
            <T style={[st.sub, { fontSize: largo ? 19 : 17 }]}>
              O Vora conecta casas de Porto Alegre a garçons, bartenders, cozinheiros e equipe de apoio, verificados e avaliados, prontos para o turno.
            </T>
            <View style={{ flexDirection: largo ? 'row' : 'column', gap: 12, marginTop: 30 }}>
              <Botao titulo="Preciso de equipe" onPress={cadastrar} />
              <Botao titulo="Quero trabalhar" claro onPress={cadastrar} />
            </View>
          </View>
          <View style={{ flex: largo ? 1 : undefined, alignItems: 'center' }}>
            <Demonstracao />
          </View>
        </View>
      </View>

      {/* Como funciona */}
      <View style={[st.faixa, { backgroundColor: C.cream2 }]}>
        <View style={st.miolo}>
          <T style={[st.rotulo, { color: '#B4400B' }]}>COMO FUNCIONA</T>
          <T style={[st.h2, { color: C.ink }]}>Do anúncio ao fim do turno, num lugar só.</T>
          <View style={{ flexDirection: largo ? 'row' : 'column', gap: 16, marginTop: 28 }}>
            {PASSOS.map((p, i) => (
              <View key={p.titulo} style={[st.passo, largo && { flex: 1 }]}>
                <T style={{ fontFamily: F.soraSemi, color: C.orange, fontSize: 30 }}>{i + 1}</T>
                <T style={{ fontFamily: F.soraSemi, color: C.ink, fontSize: 19, marginTop: 8 }}>{p.titulo}</T>
                <T style={{ color: C.ink2, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{p.texto}</T>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Secao rotulo="PARA ESTABELECIMENTOS" titulo="Menos correria para fechar a escala." itens={CASAS} largo={largo} cta="Publicar minha primeira vaga" onCta={cadastrar} />
      <Secao rotulo="PARA FREELANCERS" titulo="Mais turnos, mais respeito, mais segurança." itens={FREELAS} largo={largo} cta="Criar meu perfil" onCta={cadastrar} claro />

      {/* Perguntas */}
      <View style={st.faixa}>
        <View style={[st.miolo, { maxWidth: 820 }]}>
          <T style={st.rotulo}>PERGUNTAS FREQUENTES</T>
          <T style={st.h2}>Antes de começar</T>
          <View style={{ marginTop: 20 }}>
            {FAQ.map((f, i) => (
              <Pressable key={f.p} onPress={() => setAberta(aberta === i ? null : i)} style={st.pergunta} accessibilityRole="button" accessibilityState={{ expanded: aberta === i }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <T style={{ flex: 1, fontFamily: F.interSemi, fontSize: 16.5 }}>{f.p}</T>
                  <Icone nome={aberta === i ? 'cima' : 'baixo'} cor={C.orange} tamanho={18} />
                </View>
                {aberta === i ? <T style={{ color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 10 }}>{f.r}</T> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Chamada final */}
      <View style={[st.faixa, { paddingTop: 0 }]}>
        <View style={[st.miolo, st.final, { flexDirection: largo ? 'row' : 'column', alignItems: largo ? 'center' : 'stretch' }]}>
          <View style={{ flex: largo ? 1 : undefined }}>
            <T style={{ fontFamily: F.soraSemi, color: C.onOrange, fontSize: largo ? 34 : 27, lineHeight: largo ? 40 : 33 }}>Bora fechar a escala?</T>
            <T style={{ color: C.onOrange, fontSize: 16, marginTop: 8, opacity: 0.85 }}>Crie sua conta em 2 minutos. É de graça.</T>
          </View>
          <Pressable onPress={cadastrar} style={[st.botaoEscuro, !largo && { marginTop: 20 }]} accessibilityRole="button">
            <T style={{ fontFamily: F.interSemi, fontSize: 16, color: C.cream }}>Começar agora</T>
            <Icone nome="seta" cor={C.orange} tamanho={18} />
          </Pressable>
        </View>
        <View style={[st.miolo, { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 34, alignItems: 'center' }]}>
          <T style={{ fontFamily: F.sora, fontSize: 18 }}>vora</T>
          <T style={{ color: C.muted2, fontSize: 13, flex: 1, minWidth: 190 }}>Feito em Porto Alegre · {new Date().getFullYear()}</T>
          <T style={st.rodape} onPress={() => router.push('/termos')}>
            Termos e privacidade
          </T>
          <T style={st.rodape} onPress={() => router.push(sessao ? '/inicio' : '/entrar')}>
            {sessao ? 'Abrir o app' : 'Entrar'}
          </T>
        </View>
      </View>
    </ScrollView>
  );
}

function Botao({ titulo, onPress, claro }: { titulo: string; onPress: () => void; claro?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.botao, claro ? st.botaoClaro : null, pressed ? { opacity: 0.85 } : null]}>
      <T style={{ fontFamily: F.interSemi, fontSize: 16, color: claro ? C.cream : C.onOrange }}>{titulo}</T>
      <Icone nome="seta" cor={claro ? C.cream : C.onOrange} tamanho={18} />
    </Pressable>
  );
}

function Secao({ rotulo, titulo, itens, largo, cta, onCta, claro }: { rotulo: string; titulo: string; itens: Item[]; largo: boolean; cta: string; onCta: () => void; claro?: boolean }) {
  const fundo = claro ? C.cream : C.bg2;
  const tinta = claro ? C.ink : C.cream;
  const sub = claro ? C.ink2 : C.muted;
  return (
    <View style={[st.faixa, { backgroundColor: fundo }]}>
      <View style={st.miolo}>
        <T style={[st.rotulo, claro && { color: '#B4400B' }]}>{rotulo}</T>
        <T style={[st.h2, { color: tinta }]}>{titulo}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
          {itens.map((it) => (
            <View
              key={it.titulo}
              style={{
                width: largo ? '31.8%' : '100%',
                padding: 20,
                borderRadius: 22,
                backgroundColor: claro ? '#FFFFFF' : C.card,
                borderWidth: 1,
                borderColor: claro ? '#E8D6C8' : C.stroke,
              }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#FF5A1220', alignItems: 'center', justifyContent: 'center' }}>
                <Icone nome={it.icone} cor={C.orange} tamanho={21} />
              </View>
              <T style={{ fontFamily: F.soraSemi, fontSize: 17.5, color: tinta, marginTop: 14 }}>{it.titulo}</T>
              <T style={{ color: sub, fontSize: 14.5, lineHeight: 21, marginTop: 6 }}>{it.texto}</T>
            </View>
          ))}
        </View>
        <Pressable onPress={onCta} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26 }} accessibilityRole="link">
          <T style={{ color: claro ? '#B4400B' : C.orange2, fontFamily: F.interSemi, fontSize: 16 }}>{cta}</T>
          <Icone nome="seta" cor={claro ? '#B4400B' : C.orange2} tamanho={18} />
        </Pressable>
      </View>
    </View>
  );
}

/** Ilustração do produto: uma vaga urgente sendo preenchida */
function Demonstracao() {
  return (
    <View style={{ width: '100%', maxWidth: 380, gap: 12 }} accessibilityLabel="Exemplo: vaga urgente de bartender preenchida em 12 minutos">
      <View style={[st.demo, { transform: [{ rotate: '-1.5deg' }] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={st.tagUrg}>
            <T style={{ color: C.onOrange, fontSize: 11.5, fontFamily: F.interSemi }}>⚡ URGENTE</T>
          </View>
          <T style={{ color: C.muted, fontSize: 12.5 }}>hoje · 20h às 2h</T>
        </View>
        <T style={{ fontFamily: F.soraSemi, fontSize: 21, marginTop: 10 }}>Bartender</T>
        <T style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>Cidade Baixa · R$ 220 a noite · 🚗 volta paga</T>
        <View style={{ height: 1, backgroundColor: C.linha, marginVertical: 14 }} />
        {[
          ['Ana S.', '4,9 ★ · Pontual · 38 turnos', true],
          ['Rafael M.', '4,7 ★ · 0,8 km', false],
        ].map(([n, d, ok]) => (
          <View key={String(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={[st.bolinha, ok ? { backgroundColor: C.orange } : null]}>
              <T style={{ fontFamily: F.interSemi, fontSize: 13, color: ok ? C.onOrange : C.cream }}>{String(n)[0]}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.interSemi, fontSize: 14.5 }}>{n}</T>
              <T style={{ color: C.muted, fontSize: 12.5 }}>{d}</T>
            </View>
            {ok ? <T style={{ color: C.ok, fontFamily: F.interSemi, fontSize: 13 }}>Contratada ✓</T> : null}
          </View>
        ))}
      </View>
      <View style={[st.demo, { alignSelf: 'flex-end', width: '78%', paddingVertical: 14, transform: [{ rotate: '1.5deg' }] }]}>
        <T style={{ fontSize: 13.5, lineHeight: 19 }}>
          <T style={{ fontFamily: F.interSemi, fontSize: 13.5 }}>Equipe fechada em 12 min.</T> Termo gerado e lembrete enviado para a Ana.
        </T>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  faixa: { paddingHorizontal: 22, paddingVertical: 64, backgroundColor: C.bg },
  miolo: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  entrar: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.stroke },
  selo: { color: C.orange2, fontFamily: F.interSemi, fontSize: 12, letterSpacing: 1.4 },
  h1: { fontFamily: F.soraSemi, color: C.cream, letterSpacing: -1.2, marginTop: 16 },
  sub: { color: C.muted, lineHeight: 28, marginTop: 18, maxWidth: 560 },
  rotulo: { color: C.orange2, fontFamily: F.interSemi, fontSize: 12.5, letterSpacing: 1.4 },
  h2: { fontFamily: F.soraSemi, fontSize: 32, lineHeight: 39, letterSpacing: -0.6, marginTop: 10, color: C.cream, maxWidth: 680 },
  passo: { padding: 22, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D6C8' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 26, paddingVertical: 17, borderRadius: 999, backgroundColor: C.orange },
  botaoClaro: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.stroke },
  botaoEscuro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 26, paddingVertical: 17, borderRadius: 999, backgroundColor: C.bg },
  pergunta: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.linha },
  final: { padding: 32, borderRadius: 28, backgroundColor: C.orange, gap: 16 },
  rodape: { color: C.muted, fontSize: 13.5 },
  demo: { padding: 18, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  tagUrg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.orange },
  bolinha: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
});
