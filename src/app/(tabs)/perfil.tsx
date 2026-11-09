import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, Botao, Carregando, Folha, T, Tela, Topo, useToast } from '@/components/ui';
import { excluirMinhaConta, fotoUrl, convitesPendentes, souAdmin, exportarMeusDados, meusDadosPrivados, minhasVagas, sair, type DadosPrivados, type Vaga } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { fmtCEP, fmtCNPJ, ocultarCPF, ocultarEmail, ocultarTelefone, tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function Perfil() {
  const { perfil, sessao } = useSessao();
  const toast = useToast();
  const [dados, setDados] = useState<DadosPrivados | null>(null);
  const [vagas, setVagas] = useState<(Vaga & { n: number })[]>([]);
  const [exportado, setExportado] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [nConvites, setNConvites] = useState(0);
  const empresa = perfil?.tipo === 'empresa';

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      meusDadosPrivados(perfil.id).then(setDados).catch(() => {});
      souAdmin().then(setAdmin).catch(() => {});
      if (perfil.tipo === 'freelancer') convitesPendentes(perfil.id).then(setNConvites).catch(() => {});
      if (perfil.tipo === 'empresa') {
        minhasVagas(perfil.id)
          .then(setVagas)
          .catch(() => {});
      }
    }, [perfil])
  );

  async function exportar() {
    try {
      setExportado(JSON.stringify(await exportarMeusDados(), null, 2));
    } catch {
      toast('Não foi possível exportar agora.');
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await excluirMinhaConta();
    } catch (e) {
      toast((e as Error).message);
      setExcluindo(false);
    }
  }

  if (!perfil) return <Carregando />;

  return (
    <Tela>
      <Topo titulo="Perfil" voltar={false} />
      <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
        <Avatar nome={perfil.nome} tamanho={84} quadrado={empresa} foto={fotoUrl(perfil)} />
        <T style={{ fontFamily: F.soraSemi, fontSize: 21, marginTop: 12, textAlign: 'center' }}>{perfil.nome}</T>
        <T style={{ color: C.muted, marginTop: 4, textAlign: 'center' }}>
          {empresa ? dados?.razao_social ?? '' : perfil.titulo ?? 'Freelancer'} · {perfil.cidade}, {perfil.uf}
        </T>
        <View style={st.selo}>
          <Icone nome={empresa ? 'predio' : 'escudo'} tamanho={15} cor={C.orange2} />
          <T style={{ fontSize: 12, fontFamily: F.interSemi, color: C.orange2 }}>
            {empresa ? (perfil.verificado ? 'Empresa · CNPJ verificado' : 'Empresa') : perfil.verificado ? 'Freelancer · identidade verificada' : 'Freelancer · CPF validado'}
          </T>
        </View>
      </View>

      {empresa ? (
        <>
        <Grupo titulo="Equipe">
          <Item icone="estrela" onPress={() => router.push('/favoritos')} sub="Convide de novo quem trabalhou bem">
            Favoritos
          </Item>
          <Item icone="arquivo" onPress={() => router.push('/relatorio')} sub="Turnos, faltas e valores do mês">
            Relatório do mês
          </Item>
        </Grupo>
        <Grupo titulo="Avaliações">
          <Item icone="estrela" onPress={() => router.push('/avaliar')} sub="Avalie quem trabalhou com você">
            Avaliar freelancers
          </Item>
          <Item
            icone="predio"
            onPress={() => router.push(`/estabelecimento/${perfil.id}`)}
            sub={perfil.nota_total ? `★ ${Number(perfil.nota_media).toFixed(1).replace('.', ',')} · ${perfil.nota_total} ${perfil.nota_total === 1 ? 'avaliação' : 'avaliações'} de freelancers` : 'Ainda sem avaliações de freelancers'}>
            Avaliações do meu estabelecimento
          </Item>
        </Grupo>
        <Grupo titulo="Minhas vagas">
          {vagas.length ? (
            vagas.map((v) => (
              <Item key={v.id} icone="maleta" onPress={() => router.push(`/vaga/${v.id}`)} sub={`${v.n} candidato${v.n === 1 ? '' : 's'} · ${v.ativa ? tempoRelativo(v.criado_em) : 'encerrada'}`}>
                {v.titulo}
              </Item>
            ))
          ) : (
            <Item icone="mais" onPress={() => router.navigate('/publicar')}>
              Publicar primeira vaga
            </Item>
          )}
        </Grupo>
        </>
      ) : (
        <Grupo titulo="Minha atividade">
          <Item icone="sino" onPress={() => router.push('/convites')} sub={nConvites ? `${nConvites} aguardando resposta` : 'Estabelecimentos que chamaram você'}>
            Convites
          </Item>
          <Item icone="relogio" onPress={() => router.push('/disponibilidade')} sub="Dias e turnos em que você está livre">
            Minha disponibilidade
          </Item>
          <Item icone="arquivo" onPress={() => router.push('/curriculo')} sub="Aparece no seu perfil público">
            Certificados e experiência
          </Item>
          <Item icone="enviar" onPress={() => router.push({ pathname: '/lista', params: { tipo: 'candidaturas' } })}>
            Minhas candidaturas
          </Item>
          <Item icone="salvar" onPress={() => router.push({ pathname: '/lista', params: { tipo: 'salvos' } })}>
            Vagas salvas
          </Item>
          <Item icone="editar" onPress={() => router.navigate('/publicar')}>
            Meu serviço
          </Item>
          <Item
            icone="estrela"
            onPress={() => router.push(`/freela/${perfil.id}`)}
            sub={perfil.nota_total ? `★ ${Number(perfil.nota_media).toFixed(1).replace('.', ',')} · ${perfil.nota_total} ${perfil.nota_total === 1 ? 'avaliação' : 'avaliações'}` : 'Ainda sem avaliações'}>
            Minhas avaliações
          </Item>
          <Item icone="predio" onPress={() => router.push('/avaliar')} sub="Conte como foi trabalhar em cada lugar">
            Avaliar estabelecimentos
          </Item>
        </Grupo>
      )}

      <Grupo
        titulo="Dados cadastrais"
        extra={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icone nome="cadeado" tamanho={14} cor={C.muted2} />
            <T style={{ fontSize: 12, color: C.muted2 }}>só você vê</T>
          </View>
        }>
        {dados ? (
          <>
            {empresa ? (
              <>
                <Linha k="CNPJ" v={fmtCNPJ(dados.cnpj ?? '')} />
                <Linha k="Responsável" v={dados.responsavel_nome ?? '—'} />
                <Linha k="CPF do responsável" v={ocultarCPF(dados.responsavel_cpf)} />
              </>
            ) : (
              <>
                <Linha k="CPF" v={ocultarCPF(dados.cpf)} />
                {dados.cnpj_mei ? <Linha k="CNPJ (MEI)" v={fmtCNPJ(dados.cnpj_mei)} /> : null}
              </>
            )}
            <Linha k="E-mail" v={ocultarEmail(sessao?.user.email)} />
            <Linha k="Telefone" v={ocultarTelefone(dados.telefone)} />
            <Linha k="Endereço" v={`${dados.logradouro}, ${dados.numero}${dados.complemento ? ' – ' + dados.complemento : ''}\n${dados.bairro} · ${fmtCEP(dados.cep)}`} />
          </>
        ) : (
          <Carregando />
        )}
      </Grupo>

      <Grupo titulo="Conta">
        <Item icone="editar" onPress={() => router.push('/editar-perfil')} sub={empresa ? 'Logo, nome, endereço e contato' : 'Foto, dados, endereço e contato'}>
          Editar perfil
        </Item>
        <Item icone="cadeado" onPress={() => router.push({ pathname: '/editar-perfil', params: { secao: 'senha' } })}>
          Alterar senha
        </Item>
        <Item icone="escudo" onPress={() => router.push('/verificacao')} sub={perfil.verificado ? 'Verificada ✓' : 'Ganhe o selo de verificado'}>
          Verificar identidade
        </Item>
        <Item icone="fechar" onPress={() => router.push('/bloqueados')}>
          Pessoas bloqueadas
        </Item>
      </Grupo>

      {admin ? (
        <Grupo titulo="Equipe Vora">
          <Item icone="escudo" onPress={() => router.push('/admin')} sub="Números, denúncias e verificações">
            Painel do Vora
          </Item>
        </Grupo>
      ) : null}

      <Grupo titulo="Privacidade (LGPD)">
        <Item icone="baixar" onPress={exportar}>
          Exportar meus dados
        </Item>
        <Item icone="arquivo" onPress={() => router.push('/termos')} sub={dados ? `Aceitos em ${new Date(dados.termos_aceitos_em).toLocaleDateString('pt-BR')} · versão ${dados.termos_versao}` : undefined}>
          Termos e política de privacidade
        </Item>
        <Item icone="lixo" perigo onPress={() => setConfirmarExclusao(true)}>
          Excluir minha conta
        </Item>
      </Grupo>

      <Grupo>
        <Item icone="sair" onPress={() => sair()}>
          Sair
        </Item>
      </Grupo>

      <Folha visivel={exportado !== null} aoFechar={() => setExportado(null)} titulo="Exportar meus dados">
        <T style={{ color: C.muted, lineHeight: 20 }}>Direito de portabilidade (LGPD, art. 18). Estes são todos os dados que o Vora guarda sobre você.</T>
        <ScrollView style={st.json} nestedScrollEnabled>
          <T style={{ fontSize: 11.5, lineHeight: 17, color: '#E2D2C6', fontFamily: F.inter }}>{exportado}</T>
        </ScrollView>
        <Botao titulo="Compartilhar / salvar" icone="compartilhar" onPress={() => Share.share({ message: exportado ?? '', title: 'Meus dados — Vora' }).catch(() => {})} />
        <Botao titulo="Fechar" variante="fantasma" onPress={() => setExportado(null)} />
      </Folha>

      <Folha visivel={confirmarExclusao} aoFechar={() => setConfirmarExclusao(false)} titulo="Excluir sua conta?">
        <T style={{ color: C.muted, lineHeight: 21 }}>
          Seus dados cadastrais, {empresa ? 'vagas, candidaturas recebidas' : 'candidaturas, serviço, vagas salvas'} e conversas serão apagados de forma definitiva. Essa ação não pode ser desfeita.
        </T>
        <Botao titulo="Excluir definitivamente" variante="perigo" carregando={excluindo} onPress={excluir} estilo={{ marginTop: 20 }} />
        <Botao titulo="Cancelar" variante="fantasma" onPress={() => setConfirmarExclusao(false)} />
      </Folha>
    </Tela>
  );
}

function Grupo({ titulo, extra, children }: { titulo?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <View style={st.grupo}>
      {titulo ? (
        <View style={st.grupoCab}>
          <T style={st.grupoTit}>{titulo.toUpperCase()}</T>
          {extra}
        </View>
      ) : null}
      {children}
    </View>
  );
}
function Item({ icone, children, sub, onPress, perigo }: { icone: NomeIcone; children: ReactNode; sub?: string; onPress: () => void; perigo?: boolean }) {
  const cor = perigo ? '#FF8A8A' : C.cream;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.item, pressed && { backgroundColor: '#FFFFFF08' }]}>
      <Icone nome={icone} cor={cor} />
      <View style={{ flex: 1 }}>
        <T style={{ color: cor, fontSize: 15 }}>{children}</T>
        {sub ? <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sub}</T> : null}
      </View>
      {!perigo ? <Icone nome="seta" tamanho={16} cor={C.muted2} /> : null}
    </Pressable>
  );
}
function Linha({ k, v }: { k: string; v: string }) {
  return (
    <View style={st.linha}>
      <T style={{ color: C.muted, fontSize: 14 }}>{k}</T>
      <T style={{ fontSize: 14, fontFamily: F.interMed, textAlign: 'right', flex: 1 }}>{v}</T>
    </View>
  );
}

const st = StyleSheet.create({
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#FF5A1220' },
  grupo: { marginHorizontal: 20, marginTop: 18, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.stroke, overflow: 'hidden' },
  grupoCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  grupoTit: { fontSize: 12, color: C.orange2, fontFamily: F.interSemi, letterSpacing: 1.1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.linha },
  linha: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.linha },
  json: { maxHeight: 280, backgroundColor: '#0A0807', borderWidth: 1, borderColor: C.stroke, borderRadius: 14, padding: 14, marginVertical: 14 },
});
