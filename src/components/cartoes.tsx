import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { TRANSPORTE, faixaSalarial, quandoComeca, urgenteAtiva, type Servico, type Vaga, fotoUrl } from '@/lib/api';
import { distanciaAte, fmtDistancia, useLocalizacao } from '@/lib/localizacao';
import { dinheiro, tempoRelativo } from '@/lib/validacao';
import { C, F } from '@/theme';
import { resumoAreas } from './areas';
import { Selos } from './selos';
import { NotaResumo } from './avaliacao';
import { Icone } from './icone';
import { Avatar, BotaoIcone, T, Tag } from './ui';

export function CartaoVaga({ vaga, salvo, aoSalvar }: { vaga: Vaga; salvo?: boolean; aoSalvar?: () => void }) {
  const { ponto } = useLocalizacao();
  const km = distanciaAte(ponto, vaga.empresa);
  return (
    <Pressable onPress={() => router.push(`/vaga/${vaga.id}`)} style={({ pressed }) => [st.vaga, pressed && { transform: [{ scale: 0.99 }] }]}>
      <View style={st.linha}>
        <Avatar nome={vaga.empresa?.nome ?? '?'} tamanho={44} quadrado foto={fotoUrl(vaga.empresa)} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={{ color: C.ink, fontFamily: F.interSemi, flexShrink: 1 }} numberOfLines={1}>
              {vaga.empresa?.nome}
            </T>
            {vaga.empresa?.nota_total ? <NotaResumo media={vaga.empresa.nota_media} total={vaga.empresa.nota_total} claro compacto /> : null}
          </View>
          <T style={{ color: '#7A6A61', fontSize: 12.5 }} numberOfLines={1}>
            {tempoRelativo(vaga.criado_em)} · {km != null ? `${fmtDistancia(km)} · ${vaga.empresa?.cidade}` : `${vaga.empresa?.cidade}, ${vaga.empresa?.uf}`}
          </T>
        </View>
        {aoSalvar ? <BotaoIcone nome="salvar" cor={C.ink} preenchido={salvo} onPress={aoSalvar} rotulo={salvo ? 'Remover dos salvos' : 'Salvar vaga'} /> : null}
      </View>
      {urgenteAtiva(vaga) ? <SeloUrgente inicio={vaga.inicio_em!} /> : null}
      <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 17, marginTop: urgenteAtiva(vaga) ? 10 : 14, marginBottom: 10 }}>{vaga.titulo}</T>
      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
        <Tag texto={vaga.modalidade} />
        <Tag texto={vaga.contrato} />
        {vaga.quantidade > 1 ? <Tag texto={`${vaga.quantidade - (vaga.contratados ?? 0)} de ${vaga.quantidade} vagas`} /> : null}
        {vaga.exclusivo_ate && new Date(vaga.exclusivo_ate).getTime() > Date.now() ? <Tag texto="🔒 Time da casa" /> : null}
        {vaga.transporte === 'pago' || vaga.transporte === 'ajuda' ? <Tag texto={`🚗 ${TRANSPORTE[vaga.transporte].curto}`} /> : null}
        {!urgenteAtiva(vaga) && vaga.inicio_em && new Date(vaga.inicio_em).getTime() > Date.now() ? <Tag texto={quandoComeca(vaga.inicio_em)} /> : null}
      </View>
      <View style={[st.linha, { marginTop: 12, justifyContent: 'space-between' }]}>
        <T style={{ color: C.ink2, fontFamily: F.interMed, fontSize: 14.5 }}>{faixaSalarial(vaga)}</T>
        <View style={st.seta}>
          <Icone nome="seta" tamanho={18} cor="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

export function SeloUrgente({ inicio }: { inicio: string }) {
  return (
    <View style={st.urgente}>
      <Icone nome="raio" tamanho={14} cor="#fff" preenchido />
      <T style={{ color: '#fff', fontFamily: F.interSemi, fontSize: 12, letterSpacing: 0.3 }}>URGENTE · {quandoComeca(inicio)}</T>
    </View>
  );
}

export function CartaoFreela({ servico }: { servico: Servico }) {
  return (
    <Pressable onPress={() => router.push(`/freela/${servico.id}`)} style={({ pressed }) => [st.freela, pressed && { opacity: 0.85 }]}>
      <Avatar nome={servico.perfil?.nome ?? '?'} foto={fotoUrl(servico.perfil)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontFamily: F.interSemi, fontSize: 15.5 }} numberOfLines={1}>
          {servico.perfil?.nome}
        </T>
        <T style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {servico.titulo} · {servico.perfil?.cidade}, {servico.perfil?.uf}
        </T>
        {servico.areas?.length > 1 ? (
          <T style={{ color: C.muted2, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {resumoAreas(servico.areas, servico.area, 3)}
          </T>
        ) : null}
        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NotaResumo media={servico.perfil?.nota_media} total={servico.perfil?.nota_total} compacto />
          <Selos selos={servico.perfil?.selos} compacto />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 13.5 }}>R$ {dinheiro(servico.valor_hora)}</T>
        <T style={{ color: C.muted, fontSize: 12 }}>/hora</T>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  vaga: { backgroundColor: C.cream, borderRadius: 22, padding: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seta: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  urgente: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.orange },
  freela: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke },
});

export { Icone };
