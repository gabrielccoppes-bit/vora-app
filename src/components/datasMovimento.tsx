import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { datasDaMinhaCidade, datasMovimento, type DataMovimento, type Perfil } from '@/lib/api';
import { C, F } from '@/theme';
import { Icone } from './icone';
import { T } from './ui';

const dia = (d: string) => new Date(`${d}T12:00:00`);
function quando(d: DataMovimento) {
  const ini = dia(d.inicio);
  const dias = Math.round((ini.getTime() - dia(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)).getTime()) / 86400e3);
  const data = ini.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  if (dias <= 0) return d.fim > d.inicio ? 'acontecendo agora' : 'hoje';
  if (dias === 1) return 'amanhã';
  return dias <= 14 ? `em ${dias} dias · ${data}` : data;
}

/** Próximas datas de muito movimento na cidade (alerta de demanda) */
export function DatasMovimento({ perfil }: { perfil: Perfil }) {
  const [lista, setLista] = useState<DataMovimento[]>([]);
  useEffect(() => {
    datasMovimento()
      .then((l) => {
        const limite = new Date(Date.now() + 45 * 86400e3).toISOString().slice(0, 10);
        setLista(datasDaMinhaCidade(l, perfil).filter((d) => d.inicio <= limite).slice(0, 3));
      })
      .catch(() => setLista([]));
  }, [perfil]);

  if (!lista.length) return null;
  const empresa = perfil.tipo === 'empresa';
  return (
    <View style={{ marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.stroke }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icone nome="raio" cor={C.orange} tamanho={18} />
        <T style={{ fontFamily: F.interSemi, fontSize: 15, flex: 1 }}>{empresa ? 'Vem movimento por aí' : 'Datas com muitas vagas'}</T>
      </View>
      {lista.map((d) => (
        <View key={d.id} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T style={{ fontFamily: F.interSemi, flex: 1 }} numberOfLines={1}>
              {d.titulo}
            </T>
            <T style={{ color: C.orange2, fontSize: 12.5 }}>{quando(d)}</T>
          </View>
          {d.dica ? <T style={{ color: C.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{d.dica}</T> : null}
        </View>
      ))}
      <Pressable onPress={() => router.navigate(empresa ? '/publicar' : '/disponibilidade')} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T style={{ color: C.orange2, fontFamily: F.interSemi, fontSize: 13.5 }}>{empresa ? 'Publicar com antecedência' : 'Atualizar minha disponibilidade'}</T>
        <Icone nome="seta" tamanho={14} cor={C.orange2} />
      </Pressable>
    </View>
  );
}
