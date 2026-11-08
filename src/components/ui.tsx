import { Image } from 'expo-image';
import { router } from 'expo-router';
import { createContext, memo, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { MASCARAS, type Mascara } from '@/lib/validacao';
import { C, F } from '@/theme';
import { Icone, type NomeIcone } from './icone';

/* ---------------- Texto ---------------- */
export function T({ style, ...p }: React.ComponentProps<typeof Text>) {
  return <Text {...p} style={[{ color: C.cream, fontFamily: F.inter, fontSize: 15 }, style]} />;
}

/* ---------------- Fundo com brilho laranja (identidade Vora) ---------------- */
export const Brilho = memo(function Brilho({ variante = 'cantos' }: { variante?: 'cantos' | 'topo' }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="a" cx="105%" cy="102%" r="55%">
          <Stop offset="0" stopColor={C.orange} stopOpacity="1" />
          <Stop offset="0.35" stopColor="#C63F0B" stopOpacity="0.85" />
          <Stop offset="1" stopColor={C.bg} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="b" cx="-15%" cy="108%" r="40%">
          <Stop offset="0" stopColor={C.orange} stopOpacity="0.6" />
          <Stop offset="1" stopColor={C.bg} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="c" cx="100%" cy="0%" r="70%">
          <Stop offset="0" stopColor="#6B4A3C" stopOpacity="1" />
          <Stop offset="0.5" stopColor="#2A1D18" stopOpacity="0.6" />
          <Stop offset="1" stopColor={C.bg} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {variante === 'cantos' ? (
        <>
          <Rect width="100%" height="100%" fill="url(#a)" />
          <Rect width="100%" height="100%" fill="url(#b)" />
        </>
      ) : (
        <Rect width="100%" height="100%" fill="url(#c)" />
      )}
    </Svg>
  );
});

/* ---------------- Tela com rolagem ---------------- */
export function Tela({
  children,
  clara = false,
  rolar = true,
  semTopo = false,
  estilo,
}: {
  children: ReactNode;
  clara?: boolean;
  rolar?: boolean;
  semTopo?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const ins = useSafeAreaInsets();
  const bg = clara ? C.cream2 : C.bg;
  const conteudo = rolar ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: 40 }, estilo]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, estilo]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg, paddingTop: semTopo ? 0 : ins.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {conteudo}
    </KeyboardAvoidingView>
  );
}

/* ---------------- Barra superior ---------------- */
export function Topo({ titulo, clara = false, direita, voltar = true }: { titulo?: string; clara?: boolean; direita?: ReactNode; voltar?: boolean }) {
  const cor = clara ? C.ink : C.cream;
  return (
    <View style={s.topo}>
      {voltar ? (
        <BotaoIcone nome="voltar" cor={cor} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} rotulo="Voltar" />
      ) : null}
      <T style={[s.topoTitulo, { color: cor, paddingLeft: voltar ? 0 : 6 }]} numberOfLines={1}>
        {titulo ?? ''}
      </T>
      {direita}
    </View>
  );
}

export function BotaoIcone({ nome, cor = C.cream, onPress, rotulo, preenchido, ponto }: { nome: NomeIcone; cor?: string; onPress?: () => void; rotulo: string; preenchido?: boolean; ponto?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={rotulo} hitSlop={6} style={({ pressed }) => [s.icBtn, pressed && { opacity: 0.6 }]}>
      <Icone nome={nome} cor={cor} preenchido={preenchido} />
      {ponto ? <View style={s.ponto} /> : null}
    </Pressable>
  );
}

/* ---------------- Botões ---------------- */
type Variante = 'pri' | 'contorno' | 'contornoEscuro' | 'fantasma' | 'perigo' | 'feito';
export function Botao({
  titulo,
  onPress,
  variante = 'pri',
  carregando,
  desativado,
  icone,
  estilo,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  carregando?: boolean;
  desativado?: boolean;
  icone?: NomeIcone;
  estilo?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTES[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado || carregando}
      style={({ pressed }) => [s.btn, v.caixa, (desativado || carregando) && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.98 }] }, estilo]}>
      {carregando ? <ActivityIndicator color={v.cor} /> : icone ? <Icone nome={icone} tamanho={18} cor={v.cor} /> : null}
      <T style={{ color: v.cor, fontFamily: F.interSemi, fontSize: 16 }}>{titulo}</T>
    </Pressable>
  );
}
const VARIANTES: Record<Variante, { caixa: ViewStyle; cor: string }> = {
  pri: { caixa: { backgroundColor: C.orange, shadowColor: C.orange, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, cor: C.onOrange },
  contorno: { caixa: { borderWidth: 1.5, borderColor: C.cream }, cor: C.cream },
  contornoEscuro: { caixa: { borderWidth: 1.5, borderColor: C.ink }, cor: C.ink },
  fantasma: { caixa: {}, cor: C.muted },
  perigo: { caixa: { backgroundColor: C.bad }, cor: '#fff' },
  feito: { caixa: { backgroundColor: '#2A201C' }, cor: C.ok },
};

/* ---------------- Campos de formulário ---------------- */
export type TomDica = 'normal' | 'ok' | 'aviso' | 'carregando';
type CampoProps = Omit<TextInputProps, 'onChange' | 'style'> & {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  mascara?: Mascara;
  erro?: string;
  dica?: string;
  tomDica?: TomDica;
  valido?: boolean;
  estilo?: StyleProp<ViewStyle>;
};
export function Campo({ rotulo, valor, aoMudar, mascara, erro, dica, tomDica = 'normal', valido, estilo, multiline, ...resto }: CampoProps) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[{ marginTop: 12 }, estilo]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput
        value={valor}
        onChangeText={(t) => aoMudar(mascara ? MASCARAS[mascara](t) : t)}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        placeholderTextColor={C.muted2}
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
          foco && { borderColor: C.orange },
          valido && !erro && { borderColor: '#3DBE7A88' },
          !!erro && { borderColor: C.bad },
        ]}
        {...resto}
      />
      {erro ? <T style={s.erro}>{erro}</T> : null}
      {dica ? <Dica texto={dica} tom={tomDica} /> : null}
    </View>
  );
}
export function Dica({ texto, tom = 'normal' }: { texto: string; tom?: TomDica }) {
  const cor = tom === 'ok' ? C.ok : tom === 'aviso' ? '#F0B35A' : tom === 'carregando' ? C.orange2 : C.muted2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      {tom === 'ok' ? <Icone nome="check" tamanho={15} cor={cor} espessura={2.4} /> : null}
      {tom === 'carregando' ? <ActivityIndicator size="small" color={cor} /> : null}
      <T style={{ color: cor, fontSize: 12.5, flex: 1, lineHeight: 17 }}>{texto}</T>
    </View>
  );
}

/** Seletor simples (abre lista em uma folha) */
export function Escolha({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  erro,
  placeholder = 'Selecione',
  estilo,
}: {
  rotulo: string;
  valor: string;
  opcoes: (string | { valor: string; rotulo: string })[];
  aoMudar: (v: string) => void;
  erro?: string;
  placeholder?: string;
  estilo?: StyleProp<ViewStyle>;
}) {
  const [aberto, setAberto] = useState(false);
  const ops = opcoes.map((o) => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  const atual = ops.find((o) => o.valor === valor);
  return (
    <View style={[{ marginTop: 12 }, estilo]}>
      <T style={s.rotulo}>{rotulo}</T>
      <Pressable onPress={() => setAberto(true)} style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, !!erro && { borderColor: C.bad }]}>
        <T style={{ color: atual ? C.cream : C.muted2, fontSize: 15.5 }}>{atual?.rotulo ?? placeholder}</T>
        <Icone nome="baixo" tamanho={18} cor={C.muted} />
      </Pressable>
      {erro ? <T style={s.erro}>{erro}</T> : null}
      <Folha visivel={aberto} aoFechar={() => setAberto(false)} titulo={rotulo}>
        <ScrollView style={{ maxHeight: 420 }}>
          {ops.map((o) => (
            <Pressable
              key={o.valor}
              onPress={() => {
                aoMudar(o.valor);
                setAberto(false);
              }}
              style={s.opcao}>
              <T style={{ fontSize: 16, color: o.valor === valor ? C.orange2 : C.cream }}>{o.rotulo}</T>
              {o.valor === valor ? <Icone nome="check" tamanho={18} cor={C.orange2} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Folha>
    </View>
  );
}

export function Marcar({ marcado, aoMudar, children, erro }: { marcado: boolean; aoMudar: (v: boolean) => void; children: ReactNode; erro?: boolean }) {
  return (
    <Pressable onPress={() => aoMudar(!marcado)} style={{ flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'flex-start' }}>
      <View style={[s.caixa, marcado && { backgroundColor: C.orange, borderColor: C.orange }, erro && !marcado && { borderColor: C.bad }]}>
        {marcado ? <Icone nome="check" tamanho={15} cor={C.onOrange} espessura={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Interruptor({ titulo, sub, valor, aoMudar }: { titulo: string; sub?: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => aoMudar(!valor)} style={s.interruptor}>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 14.5 }}>{titulo}</T>
        {sub ? <T style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{sub}</T> : null}
      </View>
      <Switch value={valor} onValueChange={aoMudar} trackColor={{ true: C.orange, false: '#3A2E29' }} thumbColor={C.cream} />
    </Pressable>
  );
}

export function Secao({ titulo }: { titulo: string }) {
  return (
    <View style={s.secao}>
      <T style={s.secaoTxt}>{titulo.toUpperCase()}</T>
      <View style={{ flex: 1, height: 1, backgroundColor: C.stroke }} />
    </View>
  );
}

export function AvisoPrivacidade({ children }: { children: ReactNode }) {
  return (
    <View style={s.privacidade}>
      <Icone nome="escudo" cor={C.orange2} tamanho={20} />
      <T style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#E7D6CA' }}>{children}</T>
    </View>
  );
}

/* ---------------- Chips e tags ---------------- */
export function Chip({ texto, ativo, onPress, icone }: { texto?: string; ativo?: boolean; onPress?: () => void; icone?: NomeIcone }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo && { backgroundColor: C.orange, borderColor: C.orange }, icone && !texto && { width: 38, paddingHorizontal: 0 }]}>
      {icone ? <Icone nome={icone} tamanho={17} cor={ativo ? C.onOrange : C.cream} /> : null}
      {texto ? <T style={{ fontSize: 14, color: ativo ? C.onOrange : '#E6D6CA', fontFamily: ativo ? F.interSemi : F.inter }}>{texto}</T> : null}
    </Pressable>
  );
}
export function Tag({ texto }: { texto: string }) {
  return (
    <View style={s.tag}>
      <T style={{ fontSize: 12.5, fontFamily: F.interMed, color: C.ink2 }}>{texto}</T>
    </View>
  );
}

/* ---------------- Folha inferior (modal) ---------------- */
export function Folha({ visivel, aoFechar, titulo, children }: { visivel: boolean; aoFechar: () => void; titulo?: string; children: ReactNode }) {
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.overlay} onPress={aoFechar} />
        <View style={[s.folha, { paddingBottom: 24 + ins.bottom }]}>
          <View style={s.pegador} />
          {titulo ? <T style={s.folhaTitulo}>{titulo}</T> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------- Toast ---------------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(), 2400);
    },
    [op]
  );
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <Animated.View pointerEvents="none" style={[s.toast, { opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <T style={{ color: C.ink, fontFamily: F.interMed, fontSize: 14 }}>{msg}</T>
      </Animated.View>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Estados ---------------- */
export function Carregando({ clara }: { clara?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: clara ? C.cream2 : 'transparent' }}>
      <ActivityIndicator color={C.orange} size="large" />
    </View>
  );
}
export function Vazio({ texto, icone = 'buscar' }: { texto: string; icone?: NomeIcone }) {
  return (
    <View style={{ alignItems: 'center', padding: 36, gap: 10 }}>
      <Icone nome={icone} tamanho={42} cor="#5A4A43" />
      <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21, fontSize: 14.5 }}>{texto}</T>
    </View>
  );
}

export function Avatar({ nome, tamanho = 52, quadrado, foto }: { nome: string; tamanho?: number; quadrado?: boolean; foto?: string | null }) {
  const raio = quadrado ? tamanho * 0.28 : tamanho / 2;
  if (foto)
    return (
      <Image
        source={{ uri: foto }}
        style={{ width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: C.card }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        accessibilityLabel={`Foto de ${nome}`}
      />
    );
  const cores = ['#FF7B35', '#F7C6A3', '#FFB37A', '#E8DCCF', '#FF9A5C', '#F2A07B'];
  const cor = cores[[...String(nome)].reduce((a, c) => a + c.charCodeAt(0), 0) % cores.length];
  const ini = String(nome ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, quadrado ? 1 : 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: raio,
        backgroundColor: quadrado ? C.ink : cor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T style={{ fontFamily: quadrado ? F.soraSemi : F.soraSemi, fontSize: tamanho * 0.38, color: quadrado ? C.orange : C.onOrange }}>{ini}</T>
    </View>
  );
}

export const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, minHeight: 56 },
  topoTitulo: { flex: 1, fontSize: 18, fontFamily: F.soraSemi },
  icBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  ponto: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.orange, borderWidth: 2, borderColor: C.bg },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 28 },
  rotulo: { fontSize: 13, color: C.muted, marginBottom: 6, fontFamily: F.interMed },
  input: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.stroke,
    paddingHorizontal: 15,
    fontSize: 15.5,
    color: C.cream,
    fontFamily: F.inter,
  },
  erro: { color: '#FF8A8A', fontSize: 12.5, marginTop: 5 },
  caixa: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.stroke, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.stroke },
  secao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 2 },
  secaoTxt: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1 },
  privacidade: { flexDirection: 'row', gap: 12, padding: 14, marginTop: 18, borderRadius: 16, backgroundColor: '#FF5A1212', borderWidth: 1, borderColor: '#FF5A1233' },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: C.stroke, backgroundColor: '#1A1311', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.cream3 },
  overlay: { flex: 1, backgroundColor: '#000000AA' },
  folha: { backgroundColor: C.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: C.stroke, maxHeight: '88%' },
  pegador: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#4A3A33', alignSelf: 'center', marginBottom: 14 },
  folhaTitulo: { fontSize: 19, fontFamily: F.soraSemi, marginBottom: 8 },
  opcao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.linha },
  toast: { position: 'absolute', bottom: 110, alignSelf: 'center', backgroundColor: C.cream, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
});
