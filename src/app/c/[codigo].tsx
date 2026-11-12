import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { DocumentoCarteira } from '@/components/carteira';
import { Botao, Carregando, T, Tela } from '@/components/ui';
import { carteiraPublica, linkCarteira, type Carteira } from '@/lib/api';
import { C, F } from '@/theme';

/** Página pública de verificação da carteira de trabalho (sem login) */
export default function VerificarCarteira() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [c, setC] = useState<Carteira | null | undefined>(undefined);

  useEffect(() => {
    if (codigo) carteiraPublica(String(codigo)).then(setC).catch(() => setC(null));
  }, [codigo]);

  if (c === undefined) return <Carregando clara />;
  return (
    <Tela clara>
      <View style={{ paddingHorizontal: 18, paddingTop: 22, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        {c === null ? (
          <View style={{ padding: 24, alignItems: 'center', marginTop: 60 }}>
            <T style={{ color: C.ink, fontFamily: F.soraSemi, fontSize: 20, textAlign: 'center' }}>Carteira não disponível</T>
            <T style={{ color: '#7A6A61', marginTop: 8, textAlign: 'center', lineHeight: 21 }}>O link pode estar errado ou o freelancer desligou a verificação pública.</T>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <T style={{ color: '#1F7A4C', fontFamily: F.interSemi }}>✓ Documento verificado pelo Vora</T>
            </View>
            <DocumentoCarteira c={c} link={linkCarteira(c.codigo)} />
            {Platform.OS === 'web' ? <Botao titulo="Salvar PDF" icone="baixar" variante="contornoEscuro" onPress={() => window.print()} estilo={{ marginTop: 14 }} /> : null}
          </>
        )}
        <Pressable onPress={() => router.push('/boas-vindas')} style={{ marginTop: 22, alignItems: 'center' }}>
          <T style={{ color: '#7A6A61', fontSize: 13 }}>
            Vora · freelancers de bares e restaurantes · <T style={{ color: C.orange, fontSize: 13, fontFamily: F.interSemi }}>conhecer</T>
          </T>
        </Pressable>
      </View>
    </Tela>
  );
}
