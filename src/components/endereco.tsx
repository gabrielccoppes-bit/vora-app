import { useRef, useState } from 'react';
import { View } from 'react-native';

import { consultarCEP } from '@/lib/api';
import { digitos } from '@/lib/validacao';
import { UFS } from '@/theme';
import { Campo, Escolha, Secao, type TomDica } from './ui';

export type CamposEndereco = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string };
// Base do Vora: Porto Alegre/RS (o CEP corrige automaticamente se for outra cidade)
export const enderecoVazio: CamposEndereco = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'RS' };

export function validarEndereco(e: CamposEndereco) {
  const erros: Partial<Record<keyof CamposEndereco, string>> = {};
  if (digitos(e.cep).length !== 8) erros.cep = 'CEP deve ter 8 dígitos.';
  if (!e.logradouro.trim()) erros.logradouro = 'Informe a rua.';
  if (!e.numero.trim()) erros.numero = 'Obrigatório.';
  if (!e.bairro.trim()) erros.bairro = 'Informe o bairro.';
  if (!e.cidade.trim()) erros.cidade = 'Informe a cidade.';
  if (!e.uf) erros.uf = 'UF';
  return erros;
}

/** Bloco de endereço com preenchimento automático pelo CEP */
export function EnderecoForm({
  titulo = 'Endereço',
  valor,
  aoMudar,
  erros,
  dicaCep,
}: {
  titulo?: string;
  valor: CamposEndereco;
  aoMudar: (v: CamposEndereco) => void;
  erros: Partial<Record<string, string>>;
  dicaCep?: { texto: string; tom: TomDica };
}) {
  const [dica, setDica] = useState<{ texto: string; tom: TomDica }>({ texto: 'Digite o CEP e completamos o endereço.', tom: 'normal' });
  const ultimo = useRef('');
  const atual = useRef(valor);
  atual.current = valor;
  const set = (k: keyof CamposEndereco) => (v: string) => aoMudar({ ...atual.current, [k]: v });

  async function mudarCep(v: string) {
    const novo = { ...atual.current, cep: v };
    aoMudar(novo);
    const c = digitos(v);
    if (c.length < 8) {
      ultimo.current = '';
      return;
    }
    if (c === ultimo.current) return;
    ultimo.current = c;
    setDica({ texto: 'Buscando endereço...', tom: 'carregando' });
    const r = await consultarCEP(c);
    if (digitos(atual.current.cep) !== c) return;
    if (r) {
      aoMudar({ ...atual.current, logradouro: r.logradouro || atual.current.logradouro, bairro: r.bairro || atual.current.bairro, cidade: r.cidade, uf: r.uf });
      setDica({ texto: 'Endereço encontrado. Agora informe o número.', tom: 'ok' });
    } else {
      setDica({ texto: 'Não encontramos este CEP — preencha o endereço abaixo.', tom: 'aviso' });
    }
  }

  const d = dicaCep ?? dica;
  return (
    <View>
      <Secao titulo={titulo} />
      <Campo rotulo="CEP" valor={valor.cep} aoMudar={mudarCep} mascara="cep" keyboardType="number-pad" placeholder="90000-000" erro={erros.cep} dica={d.texto} tomDica={d.tom} />
      <Campo rotulo="Rua / Logradouro" valor={valor.logradouro} aoMudar={set('logradouro')} erro={erros.logradouro} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Campo rotulo="Número" valor={valor.numero} aoMudar={set('numero')} erro={erros.numero} estilo={{ width: 100 }} placeholder="123" />
        <Campo rotulo="Complemento" valor={valor.complemento} aoMudar={set('complemento')} estilo={{ flex: 1 }} placeholder="Apto, sala... (opcional)" />
      </View>
      <Campo rotulo="Bairro" valor={valor.bairro} aoMudar={set('bairro')} erro={erros.bairro} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Campo rotulo="Cidade" valor={valor.cidade} aoMudar={set('cidade')} erro={erros.cidade} estilo={{ flex: 1 }} placeholder="Ex.: Porto Alegre" />
        <Escolha rotulo="UF" valor={valor.uf} opcoes={UFS} aoMudar={set('uf')} erro={erros.uf} placeholder="—" estilo={{ width: 96 }} />
      </View>
    </View>
  );
}
