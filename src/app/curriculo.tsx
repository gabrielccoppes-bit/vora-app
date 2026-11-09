import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icone } from '@/components/icone';
import { Botao, Campo, Carregando, Folha, T, Tela, Topo, useToast } from '@/components/ui';
import {
  apagarCertificado,
  apagarExperiencia,
  certificadosDe,
  experienciasDe,
  salvarCertificado,
  salvarExperiencia,
  type Certificado,
  type Experiencia,
} from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { C, F } from '@/theme';

const SUGESTOES = ['Boas Práticas de Manipulação de Alimentos', 'Bartender / Coquetelaria', 'Barista', 'Sommelier', 'Primeiros Socorros', 'Brigada de Incêndio', 'Vigilante (CNV)'];

type FormCert = { id?: string; nome: string; instituicao: string; ano: string };
type FormExp = { id?: string; local: string; funcao: string; periodo: string; descricao: string };

/** Freelancer cadastra certificados e experiências (aparecem no perfil público) */
export default function Curriculo() {
  const { perfil } = useSessao();
  const toast = useToast();
  const [certs, setCerts] = useState<Certificado[] | null>(null);
  const [exps, setExps] = useState<Experiencia[] | null>(null);
  const [fc, setFc] = useState<FormCert | null>(null);
  const [fe, setFe] = useState<FormExp | null>(null);
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    if (!perfil) return;
    certificadosDe(perfil.id).then(setCerts).catch(() => setCerts([]));
    experienciasDe(perfil.id).then(setExps).catch(() => setExps([]));
  }, [perfil]);
  useFocusEffect(carregar);

  async function gravarCert() {
    if (!fc) return;
    const ano = fc.ano ? Number(fc.ano) : null;
    if (fc.nome.trim().length < 3) return setErro('Informe o nome do curso ou certificado.');
    if (ano !== null && (!Number.isInteger(ano) || ano < 1950 || ano > new Date().getFullYear() + 1)) return setErro('Ano inválido.');
    setErro(undefined);
    setSalvando(true);
    try {
      await salvarCertificado({ id: fc.id, nome: fc.nome, instituicao: fc.instituicao, ano });
      setFc(null);
      carregar();
    } catch {
      toast('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function gravarExp() {
    if (!fe) return;
    if (fe.local.trim().length < 2) return setErro('Informe o lugar.');
    if (fe.funcao.trim().length < 2) return setErro('Informe a função.');
    setErro(undefined);
    setSalvando(true);
    try {
      await salvarExperiencia(fe);
      setFe(null);
      carregar();
    } catch {
      toast('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(tipo: 'cert' | 'exp', id: string) {
    try {
      if (tipo === 'cert') await apagarCertificado(id);
      else await apagarExperiencia(id);
      setFc(null);
      setFe(null);
      carregar();
    } catch {
      toast('Não foi possível apagar.');
    }
  }

  return (
    <Tela>
      <Topo titulo="Certificados e experiência" />
      <View style={{ paddingHorizontal: 20 }}>
        <T style={{ color: C.muted, lineHeight: 21 }}>Isso aparece no seu perfil público e ajuda o estabelecimento a confiar em você antes de contratar.</T>

        <Cab titulo="Experiência" onAdd={() => (setErro(undefined), setFe({ local: '', funcao: '', periodo: '', descricao: '' }))} />
        {exps === null ? (
          <Carregando />
        ) : exps.length === 0 ? (
          <T style={{ color: C.muted2, fontSize: 13.5 }}>Adicione bares, restaurantes e eventos onde você já trabalhou.</T>
        ) : (
          exps.map((e) => (
            <Item key={e.id} titulo={`${e.funcao} · ${e.local}`} sub={[e.periodo, e.descricao].filter(Boolean).join(' — ')} onPress={() => (setErro(undefined), setFe({ id: e.id, local: e.local, funcao: e.funcao, periodo: e.periodo ?? '', descricao: e.descricao ?? '' }))} />
          ))
        )}

        <Cab titulo="Certificados e cursos" onAdd={() => (setErro(undefined), setFc({ nome: '', instituicao: '', ano: '' }))} />
        {certs === null ? (
          <Carregando />
        ) : certs.length === 0 ? (
          <T style={{ color: C.muted2, fontSize: 13.5 }}>Ex.: manipulação de alimentos, coquetelaria, primeiros socorros.</T>
        ) : (
          certs.map((c) => (
            <Item key={c.id} titulo={c.nome} sub={[c.instituicao, c.ano].filter(Boolean).join(' · ')} onPress={() => (setErro(undefined), setFc({ id: c.id, nome: c.nome, instituicao: c.instituicao ?? '', ano: c.ano ? String(c.ano) : '' }))} />
          ))
        )}
      </View>

      <Folha visivel={!!fc} aoFechar={() => setFc(null)} titulo={fc?.id ? 'Editar certificado' : 'Novo certificado'}>
        {fc ? (
          <>
            {!fc.id ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {SUGESTOES.map((s) => (
                  <Pressable key={s} onPress={() => setFc({ ...fc, nome: s })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.stroke }}>
                    <T style={{ fontSize: 12.5, color: '#E6D6CA' }}>{s}</T>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Campo rotulo="Curso ou certificado" valor={fc.nome} aoMudar={(v) => setFc({ ...fc, nome: v })} erro={erro} maxLength={120} />
            <Campo rotulo="Instituição (opcional)" valor={fc.instituicao} aoMudar={(v) => setFc({ ...fc, instituicao: v })} placeholder="Ex.: SENAC" maxLength={120} />
            <Campo rotulo="Ano (opcional)" valor={fc.ano} aoMudar={(v) => setFc({ ...fc, ano: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" placeholder="2024" />
            <Botao titulo="Salvar" onPress={gravarCert} carregando={salvando} estilo={{ marginTop: 18 }} />
            {fc.id ? <Botao titulo="Apagar" variante="fantasma" onPress={() => apagar('cert', fc.id!)} /> : null}
          </>
        ) : null}
      </Folha>

      <Folha visivel={!!fe} aoFechar={() => setFe(null)} titulo={fe?.id ? 'Editar experiência' : 'Nova experiência'}>
        {fe ? (
          <>
            <Campo rotulo="Onde trabalhou" valor={fe.local} aoMudar={(v) => setFe({ ...fe, local: v })} placeholder="Ex.: Bar do Beco" maxLength={120} erro={erro} />
            <Campo rotulo="Função" valor={fe.funcao} aoMudar={(v) => setFe({ ...fe, funcao: v })} placeholder="Ex.: Bartender" maxLength={80} />
            <Campo rotulo="Período (opcional)" valor={fe.periodo} aoMudar={(v) => setFe({ ...fe, periodo: v })} placeholder="Ex.: 2023 – 2025" maxLength={60} />
            <Campo rotulo="O que fazia (opcional)" valor={fe.descricao} aoMudar={(v) => setFe({ ...fe, descricao: v })} multiline maxLength={400} />
            <Botao titulo="Salvar" onPress={gravarExp} carregando={salvando} estilo={{ marginTop: 18 }} />
            {fe.id ? <Botao titulo="Apagar" variante="fantasma" onPress={() => apagar('exp', fe.id!)} /> : null}
          </>
        ) : null}
      </Folha>
    </Tela>
  );
}

function Cab({ titulo, onAdd }: { titulo: string; onAdd: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 }}>
      <T style={{ fontFamily: F.soraSemi, fontSize: 17 }}>{titulo}</T>
      <Pressable onPress={onAdd} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icone nome="mais" tamanho={16} cor={C.orange2} />
        <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 14 }}>Adicionar</T>
      </Pressable>
    </View>
  );
}

function Item({ titulo, sub, onPress }: { titulo: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke, marginBottom: 8 }, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.interSemi, fontSize: 14.5 }}>{titulo}</T>
        {sub ? <T style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{sub}</T> : null}
      </View>
      <Icone nome="editar" tamanho={16} cor={C.muted2} />
    </Pressable>
  );
}
