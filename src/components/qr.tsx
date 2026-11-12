import qrcode from 'qrcode-generator';
import { memo, useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** QR Code desenhado em SVG (funciona no celular e no site, sem internet) */
export const QrCode = memo(function QrCode({ valor, tamanho = 220, cor = '#1A1412', fundo = '#FFFFFF' }: { valor: string; tamanho?: number; cor?: string; fundo?: string }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(valor);
    q.make();
    const total = q.getModuleCount();
    let caminho = '';
    for (let y = 0; y < total; y++)
      for (let x = 0; x < total; x++) if (q.isDark(y, x)) caminho += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d: caminho, n: total + 4 }; // 2 módulos de margem
  }, [valor]);
  return (
    <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR Code">
      <Rect x={0} y={0} width={n} height={n} fill={fundo} />
      <Path d={d} fill={cor} />
    </Svg>
  );
});
