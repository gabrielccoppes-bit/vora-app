import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** base64 → bytes (para enviar ao Storage em qualquer plataforma) */
export function base64ParaBytes(b64: string) {
  const tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpo = b64.replace(/^data:[^,]+,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((limpo.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => tab.indexOf(limpo[i + k] ?? 'A'));
    const n = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    bytes[j++] = (n >> 16) & 255;
    if (i + 2 < limpo.length) bytes[j++] = (n >> 8) & 255;
    if (i + 3 < limpo.length) bytes[j++] = n & 255;
  }
  return bytes.slice(0, j).buffer;
}

/**
 * Abre a câmera ou a galeria e devolve a imagem em JPEG (bytes + endereço para prévia).
 * quadrado: recorta no centro. max: lado maior em pixels.
 */
export async function escolherImagem(o: { origem: 'camera' | 'galeria'; quadrado?: boolean; max?: number; frontal?: boolean }) {
  const max = o.max ?? 1280;
  if (o.origem === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Permita o acesso à câmera para tirar a foto.');
  } else {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) throw new Error('Permita o acesso às fotos para escolher uma imagem.');
  }
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: !!o.quadrado,
    aspect: o.quadrado ? [1, 1] : undefined,
    quality: 1,
    cameraType: o.frontal ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const r = o.origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const acoes: ImageManipulator.Action[] = [];
  let w = a.width || max;
  let h = a.height || max;
  if (o.quadrado && a.width && a.height && a.width !== a.height) {
    const lado = Math.min(a.width, a.height);
    acoes.push({ crop: { originX: Math.floor((a.width - lado) / 2), originY: Math.floor((a.height - lado) / 2), width: lado, height: lado } });
    w = h = lado;
  }
  if (Math.max(w, h) > max) acoes.push({ resize: w >= h ? { width: max } : { height: max } });
  const img = await ImageManipulator.manipulateAsync(a.uri, acoes, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!img.base64) throw new Error('Não foi possível ler a imagem.');
  return { uri: img.uri, bytes: base64ParaBytes(img.base64) };
}
