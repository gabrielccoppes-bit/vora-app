import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Botao, Campo, Carregando, Chip, Escolha, Interruptor, T, Tela, Topo, useToast } from '@/components/ui';
import { DIAS, meuServico, publicarEscala, publicarVaga, salvarInstrucoes, salvarServico, type Transporte, type Vaga } from '@/lib/api';
import { CamposInstrucoes } from '@/components/instrucoes';
import { Icone } from '@/components/icone';
import { useSessao } from '@/lib/sessao';
import { dataISO, digitos, dinheiro } from '@/lib/validacao';
import { SeletorAreas } from '@/components/areas';
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
  const [urgente, setUrgente] = useState(false);
  const [dia, setDia] = useState<'hoje' | 'amanha'>('hoje');
  const [hora, setHora] = useState('');
  const [data, setData] = useState(''); // turno com data marcada (vagas normais)
  const [qtd, setQtd] = useState(1);
  const [substituto, setSubstituto] = useState(true);
  const [transporte, setTransporte] = useState<Transporte>('nao_informado');
  const [timeDaCasa, setTimeDaCasa] = useState(false);
  // escala: repete toda semana nos dias escolhidos
  const [escala, setEscala] = useState(false);
  const [diasEscala, setDiasEscala] = useState<number[]>([]); // 0 = domingo
  const [semanas, setSemanas] = useState(4);
  // informações para a equipe (só contratados veem)
  const [verInstr, setVerInstr] = useState(false);
  const [instr, setInstr] = useState({ traje: '', levar: '', chegada: '', contato: '' });
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
    let inicio: string | null = null;
    if (urgente) {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
      if (!m) e.hora = 'Use o formato 20:00.';
      else {
        const d = new Date();
        if (dia === 'amanha') d.setDate(d.getDate() + 1);
        d.setHours(Number(m[1]), Number(m[2]), 0, 0);
        if (d.getTime() < Date.now() - 3600e3) e.hora = 'Esse horário já passou. Escolha "Amanhã" ou outro horário.';
        else inicio = d.toISOString();
      }
    } else if (escala) {
      if (!diasEscala.length) e.dias = 'Escolha pelo menos um dia da semana.';
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(hora)) e.hora = 'Use o formato 20:00.';
    } else if (data || hora) {
      // data do turno é opcional, mas se informar precisa da data e da hora
      const iso = dataISO(data);
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
      if (!iso) e.data = 'Use o formato DD/MM/AAAA.';
      if (!m) e.hora = 'Use o formato 20:00.';
      if (iso && m) {
        const [a, mo, d] = iso.split('-').map(Number);
        const dt = new Date(a, mo - 1, d, Number(m[1]), Number(m[2]));
        if (dt.getTime() < Date.now() - 3600e3) e.data = 'Essa data já passou.';
        else inicio = dt.toISOString();
      }
    }
    setErros(e);
    if (Object.keys(e).length) return toast('Confira os campos destacados');
    setEnviando(true);
    try {
      const dados = {
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
        urgente,
        inicio_em: inicio,
        quantidade: qtd,
        substituto_auto: substituto,
        transporte,
        exclusivo_ate: timeDaCasa && !urgente ? new Date(Date.now() + 3600e3).toISOString() : null,
      };
      let id: string;
      let n = 1;
      if (escala) {
        const turnos = await publicarEscala(dados, proximosTurnos(diasEscala, hora, semanas));
        id = turnos[0].id;
        n = turnos.length;
        await salvarInstrucoes(turnos.map((t) => t.id), instr).catch(() => {});
      } else {
        ({ id } = await publicarVaga(dados));
        await salvarInstrucoes([id], instr).catch(() => {});
      }
      setF(vazio);
      setEscala(false);
      setDiasEscala([]);
      setInstr({ traje: '', levar: '', chegada: '', contato: '' });
      setUrgente(false);
      setHora('');
      setData('');
      setQtd(1);
      setTransporte('nao_informado');
      setTimeDaCasa(false);
      toast(urgente ? 'Vaga urgente publicada! Avisamos os freelancers da cidade.' : n > 1 ? `Escala publicada: ${n} turnos!` : 'Vaga publicada!');
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
        <Interruptor
          titulo="⚡ Vaga urgente"
          sub="Para hoje ou amanhã. Aparece no topo e os freelancers da cidade são avisados na hora."
          valor={urgente}
          aoMudar={setUrgente}
        />
        {urgente ? (
          <View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Chip texto="Hoje" ativo={dia === 'hoje'} onPress={() => setDia('hoje')} />
              <Chip texto="Amanhã" ativo={dia === 'amanha'} onPress={() => setDia('amanha')} />
            </View>
            <Campo
              rotulo="Horário de início do turno"
              valor={hora}
              aoMudar={(v) => {
                setHora(v);
                if (erros.hora) setErros((x) => ({ ...x, hora: '' }));
              }}
              mascara="hora"
              keyboardType="number-pad"
              placeholder="20:00"
              erro={erros.hora}
            />
          </View>
        ) : null}
        {!urgente ? (
          <Interruptor
            titulo="Repetir toda semana"
            sub="Para escalas fixas, como toda sexta e sábado. Criamos um turno para cada dia."
            valor={escala}
            aoMudar={setEscala}
          />
        ) : null}
        {!urgente && escala ? (
          <View>
            <T style={{ color: C.muted, fontSize: 13, fontFamily: F.interMed, marginTop: 14, marginBottom: 8 }}>Dias da semana</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip
                  key={d}
                  texto={DIAS[d]}
                  ativo={diasEscala.includes(d)}
                  onPress={() => {
                    setDiasEscala((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
                    if (erros.dias) setErros((x) => ({ ...x, dias: '' }));
                  }}
                />
              ))}
            </View>
            {erros.dias ? <T style={{ color: C.bad, fontSize: 12.5, marginTop: 6 }}>{erros.dias}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Campo
                rotulo="Início do turno"
                valor={hora}
                aoMudar={(v) => (setHora(v), erros.hora && setErros((x) => ({ ...x, hora: '' })))}
                mascara="hora"
                keyboardType="number-pad"
                placeholder="20:00"
                erro={erros.hora}
                estilo={{ flex: 1 }}
              />
              <View style={{ flex: 1.3, marginTop: 12 }}>
                <T style={{ color: C.muted, fontSize: 13, fontFamily: F.interMed, marginBottom: 8 }}>Por quantas semanas</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => setSemanas((n) => Math.max(1, n - 1))} style={st.passo} accessibilityLabel="Menos uma semana">
                    <T style={{ fontSize: 22, fontFamily: F.interSemi }}>−</T>
                  </Pressable>
                  <T style={{ fontFamily: F.soraSemi, fontSize: 20, minWidth: 24, textAlign: 'center' }}>{semanas}</T>
                  <Pressable onPress={() => setSemanas((n) => Math.min(8, n + 1))} style={st.passo} accessibilityLabel="Mais uma semana">
                    <T style={{ fontSize: 22, fontFamily: F.interSemi }}>+</T>
                  </Pressable>
                </View>
              </View>
            </View>
            {diasEscala.length && /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora) ? (
              <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
                Serão criados {proximosTurnos(diasEscala, hora, semanas).length} turnos:{' '}
                {proximosTurnos(diasEscala, hora, semanas)
                  .slice(0, 4)
                  .map((x) => new Date(x).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }))
                  .join(', ')}
                {proximosTurnos(diasEscala, hora, semanas).length > 4 ? '…' : ''}
              </T>
            ) : null}
          </View>
        ) : null}
        {!urgente && !escala ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Campo
              rotulo="Data do turno (opcional)"
              valor={data}
              aoMudar={(v) => (setData(v), erros.data && setErros((x) => ({ ...x, data: '' })))}
              mascara="data"
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              erro={erros.data}
              estilo={{ flex: 1.4 }}
            />
            <Campo
              rotulo="Início"
              valor={hora}
              aoMudar={(v) => (setHora(v), erros.hora && setErros((x) => ({ ...x, hora: '' })))}
              mascara="hora"
              keyboardType="number-pad"
              placeholder="20:00"
              erro={erros.hora}
              estilo={{ flex: 1 }}
            />
          </View>
        ) : null}
        {!urgente && !escala ? <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 6 }}>Com data e horário, o Vora lembra a equipe antes do turno e libera o check-in na hora certa.</T> : null}

        <View style={{ marginTop: 14 }}>
          <T style={{ color: C.muted, fontSize: 13, fontFamily: F.interMed, marginBottom: 8 }}>Quantas pessoas você precisa?</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={() => setQtd((n) => Math.max(1, n - 1))} style={st.passo} accessibilityLabel="Menos uma pessoa">
              <T style={{ fontSize: 22, fontFamily: F.interSemi }}>−</T>
            </Pressable>
            <T style={{ fontFamily: F.soraSemi, fontSize: 24, minWidth: 34, textAlign: 'center' }}>{qtd}</T>
            <Pressable onPress={() => setQtd((n) => Math.min(50, n + 1))} style={st.passo} accessibilityLabel="Mais uma pessoa">
              <T style={{ fontSize: 22, fontFamily: F.interSemi }}>+</T>
            </Pressable>
            <T style={{ color: C.muted, fontSize: 13, flex: 1 }}>{qtd === 1 ? 'pessoa' : 'pessoas · a vaga fecha sozinha quando completar'}</T>
          </View>
        </View>
        {!urgente ? (
          <Interruptor
            titulo="🔒 Chamar primeiro o time da casa"
            sub="Seus favoritos recebem um aviso e veem a vaga 1 hora antes de todo mundo. Depois ela abre para todos."
            valor={timeDaCasa}
            aoMudar={setTimeDaCasa}
          />
        ) : null}
        <Interruptor
          titulo="Substituto automático"
          sub="Se alguém cancelar, convidamos na hora seus favoritos e quem já se candidatou. O primeiro que aceitar entra."
          valor={substituto}
          aoMudar={setSubstituto}
        />

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
        {casa ? (
          <View style={{ marginTop: 16 }}>
            <T style={{ color: C.muted, fontSize: 13, fontFamily: F.interMed, marginBottom: 8 }}>Volta para casa no fim do turno</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['pago', 'ajuda', 'nao'] as const).map((t) => (
                <Chip key={t} texto={{ pago: 'A casa paga', ajuda: 'Ajuda de custo', nao: 'Sem transporte' }[t]} ativo={transporte === t} onPress={() => setTransporte(transporte === t ? 'nao_informado' : t)} />
              ))}
            </View>
            <T style={{ color: C.muted2, fontSize: 12.5, marginTop: 6 }}>Vagas com volta paga aparecem com destaque e atraem mais gente para turnos da noite.</T>
          </View>
        ) : null}
        <Pressable onPress={() => setVerInstr((x) => !x)} style={st.secao}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.interSemi, fontSize: 15 }}>Informações para a equipe</T>
            <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>Traje, o que levar, onde entrar. Só os contratados veem.</T>
          </View>
          <Icone nome={verInstr ? 'cima' : 'baixo'} cor={C.muted} />
        </Pressable>
        {verInstr ? <CamposInstrucoes valor={instr} aoMudar={setInstr} /> : null}

        <Botao titulo={escala ? 'Publicar escala' : 'Publicar vaga'} onPress={enviar} carregando={enviando} estilo={{ marginTop: 24 }} />
      </View>
    </Tela>
  );
}

function PublicarServico() {
  const { perfil, recarregarPerfil } = useSessao();
  const toast = useToast();
  const [f, setF] = useState({ titulo: '', areas: [] as string[], valor: '', habilidades: '', bio: '' });
  const [existe, setExiste] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const set = (k: Exclude<keyof typeof f, 'areas'>) => (v: string) => {
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
            areas: s?.areas?.length ? s.areas : perfil.areas?.length ? perfil.areas : s?.area ? [s.area] : perfil.area ? [perfil.area] : [],
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
    if (!f.areas.length) e.area = 'Escolha pelo menos uma área.';
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
        areas: f.areas,
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
        <Campo rotulo="Título do serviço" valor={f.titulo} aoMudar={set('titulo')} placeholder="Ex.: Bartender, Garçom" erro={erros.titulo} />
        <SeletorAreas valor={f.areas} aoMudar={(v) => (setF((p) => ({ ...p, areas: v })), erros.area && setErros((x) => ({ ...x, area: '' })))} erro={erros.area} />
        <Campo rotulo="Valor por hora (R$)" valor={f.valor} aoMudar={set('valor')} mascara="dinheiro" keyboardType="number-pad" placeholder="100" erro={erros.valor} />
        <Campo rotulo="Habilidades (separe por vírgula)" valor={f.habilidades} aoMudar={set('habilidades')} placeholder="Figma, Prototipação, UX Research" erro={erros.habilidades} />
        <Campo rotulo="Sobre você" valor={f.bio} aoMudar={set('bio')} multiline placeholder="Experiência, tipos de projeto, diferenciais." erro={erros.bio} maxLength={800} />
        <Botao titulo={existe ? 'Salvar alterações' : 'Publicar serviço'} onPress={enviar} carregando={enviando} estilo={{ marginTop: 24 }} />
      </View>
    </Tela>
  );
}

/** Próximas datas da escala: cada dia escolhido, a partir de hoje, por N semanas */
function proximosTurnos(dias: number[], hora: string, semanas: number) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!m || !dias.length) return [];
  const lista: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i, Number(m[1]), Number(m[2]));
    if (dias.includes(d.getDay()) && d.getTime() > Date.now()) lista.push(d.toISOString());
  }
  return lista;
}

const st = StyleSheet.create({
  secao: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke },
  passo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
});
