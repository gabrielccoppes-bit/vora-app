export const C = {
  bg: '#0D0A09',
  bg2: '#151010',
  card: '#1D1614',
  card2: '#251C19',
  stroke: '#3A2E29',
  linha: '#2A211E',
  orange: '#FF5A12',
  orange2: '#FF7B35',
  cream: '#F7EBE1',
  cream2: '#FBF4EE',
  cream3: '#EFDFD2',
  ink: '#1B1310',
  ink2: '#4B3D36',
  muted: '#A8968C',
  muted2: '#7C6C64',
  ok: '#3DBE7A',
  bad: '#FF6B6B',
  onOrange: '#1A0D06',
};

export const F = {
  sora: 'Sora_400Regular',
  soraSemi: 'Sora_600SemiBold',
  inter: 'Inter_400Regular',
  interMed: 'Inter_500Medium',
  interSemi: 'Inter_600SemiBold',
};

// Áreas de atuação (freelancers e vagas): primeiro as de bares, restaurantes e casas noturnas
export const CATEGORIAS = [
  'Atendimento', 'Bar', 'Cozinha', 'DJ e música', 'Segurança', 'Limpeza', 'Eventos',
  'Design', 'Marketing', 'TI', 'Dados', 'Redação', 'Audiovisual',
];
// Tipos de negócio do contratante
export const HOSPITALIDADE = ['Restaurante', 'Bar', 'Casa noturna', 'Eventos e buffet', 'Hotel e pousada', 'Cafeteria e padaria'];
export const SETORES = [...HOSPITALIDADE, 'Tecnologia', 'Marketing e agência', 'Varejo', 'Indústria', 'Saúde', 'Educação', 'Outro'];
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const MODALIDADES = ['Remoto', 'Híbrido', 'Presencial'];
export const CONTRATOS = ['PJ', 'Freelance', 'CLT'];
export const NIVEIS = ['Júnior', 'Pleno', 'Sênior', 'Especialista'];
export const PERIODOS: { valor: 'mes' | 'projeto' | 'hora' | 'diaria'; rotulo: string }[] = [
  { valor: 'diaria', rotulo: 'Por diária/turno' },
  { valor: 'mes', rotulo: 'Por mês' },
  { valor: 'projeto', rotulo: 'Por projeto' },
  { valor: 'hora', rotulo: 'Por hora' },
];
export const TERMOS_VERSAO = '1.0';
