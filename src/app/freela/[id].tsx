import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { Avatar, Botao, Carregando, T, Tag, Tela, Topo, Vazio } from '@/components/ui';
import { abrirConversa, buscarServico, type Servico } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { dinheiro } from '@/lib/validacao';
import { C, F } from '@/theme';

export default function PerfilFreelancer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSessao();
  const [s, setS] = useState<Servico | null | undefined>(undefined);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    if (id) buscarServico(id).then(setS).catch(() => setS(null));
  }, [id]);

  if (s === undefined) return <Carregando clara />;
  if (s === null)
    return (
      <Tela clara>
        <Topo clara />
        <Vazio texto="Perfil não encontrado." />
      </Tela>
    );

  const meu = s.freelancer_id === perfil?.id;
  return (
    <Tela clara>
      <Topo clara />
      <View style={{ alignItems: 'center', paddingHorizontal: 22 }}>
        <Avatar nome={s.perfil?.nome ?? '?'} tamanho={84} />
        <T style={{ color: C.ink, fontFamily: F.interSemi, fontSize: 22, marginTop: 14 }}>{s.perfil?.nome}</T>
        <T style={{ color: C.ink2, fontSize: 15, marginTop: 4 }}>{s.titulo}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icone nome="local" tamanho={16} cor="#7A6A61" />
          <T style={{ color: '#7A6A61', fontSize: 13.5 }}>
            {s.perfil?.cidade}, {s.perfil?.uf}
          </T>
        </View>
      </View>
      <T style={{ color: '#3B2F29', lineHeight: 23, paddingHorizontal: 22, paddingTop: 20 }}>{s.bio}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 22, paddingTop: 14 }}>
        {s.habilidades.map((h) => (
          <Tag key={h} texto={h} />
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: '#E5D3C5', marginHorizontal: 22, marginTop: 22, marginBottom: 6 }} />
      <View style={{ paddingHorizontal: 22 }}>
        <Meta icone="dinheiro" texto={`A partir de R$ ${dinheiro(s.valor_hora)}/hora`} />
        <Meta icone="maleta" texto={s.area} />
        <Meta icone="escudo" texto={s.perfil?.verificado ? 'Identidade verificada' : 'CPF validado no cadastro'} />
      </View>
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        {meu ? (
          <Botao titulo="Editar meu serviço" icone="editar" variante="contornoEscuro" onPress={() => router.navigate('/publicar')} />
        ) : (
          <Botao
            titulo="Enviar mensagem"
            carregando={abrindo}
            onPress={async () => {
              setAbrindo(true);
              try {
                const c = await abrirConversa(s.freelancer_id);
                router.push({ pathname: '/chat/[id]', params: { id: c, nome: s.perfil?.nome ?? '' } });
              } finally {
                setAbrindo(false);
              }
            }}
          />
        )}
      </View>
    </Tela>
  );
}

function Meta({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
      <Icone nome={icone} cor="#2C221D" />
      <T style={{ color: '#2C221D' }}>{texto}</T>
    </View>
  );
}
