# Vora — app

**Conectando talentos a novas oportunidades.**
App para iOS e Android (e web) feito com **Expo / React Native** e **Supabase** (banco Postgres, login, tempo real e funções no servidor).

---

## O que já vem pronto

| Área | Detalhes |
|---|---|
| **Cadastro de freelancer** | Nome, CPF (validação na hora), data de nascimento (18+), contato, endereço pelo CEP, área e título. Opção de CNPJ para MEI. |
| **Cadastro de empresa** | O usuário digita o CNPJ e o app consulta a Receita (razão social, situação, endereço). Aceita o CNPJ alfanumérico. Também pede nome, CPF e cargo do responsável pela conta. |
| **Vagas** | Busca por texto e categoria, filtros (modalidade e contrato), detalhe da vaga, candidatura com mensagem, vagas salvas. |
| **Empresas** | Publicam e encerram vagas, veem os candidatos e abrem conversa com eles. |
| **Freelancers** | Perfil de serviço (título, valor/hora, habilidades, bio) que as empresas encontram na busca. |
| **Conversas** | Chat em tempo real (Supabase Realtime). |
| **Privacidade (LGPD)** | Perfil público sem documentos. Dados privados em tabela separada que só o dono lê. CPF, telefone e e-mail aparecem mascarados. Aceite dos termos fica registrado. O usuário pode **exportar os dados** e **excluir a conta**. |

### Segurança no banco (não só no app)
- O **CPF e o CNPJ são validados também no Postgres** (`cpf_valido` / `cnpj_valido`), então nada inválido entra, mesmo por chamada direta à API.
- **RLS (Row Level Security)** em todas as tabelas:
  - ninguém lê os dados privados de outra pessoa;
  - só empresas publicam vagas;
  - só freelancers se candidatam;
  - cada conversa só é vista pelos dois participantes.
- O usuário **não consegue trocar CPF/CNPJ** nem se marcar como "verificado" pelo app (permissões por coluna).
- CPF e CNPJ duplicados são bloqueados. Menores de 18 anos são recusados.

Essas regras foram testadas num Postgres local antes da entrega.

---

## ✅ Já configurado para você

O projeto Supabase **vora** (servidor na região `sa-east-1`, o datacenter do Supabase no Brasil; ref `atgtitircagbjuazrmth`) já foi criado com:

> A base de operação do Vora é **Porto Alegre/RS**: cadastros já vêm com UF RS e exemplos de DDD 51.
- o banco completo, as regras de segurança e o endurecimento apontado pelo Security Advisor;
- as funções `consulta-cep`, `consulta-cnpj` e `excluir-conta` publicadas;
- o arquivo `.env` já preenchido com a URL e a chave pública.

**Você só precisa:** `npm install` e depois `npx expo start` (passo 5 abaixo). Os passos 1 a 3 servem para quem for montar outro ambiente do zero.

---

## Como colocar para rodar

### 1. Crie o projeto no Supabase
1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região São Paulo, se disponível).
2. Em **Project Settings → API**, copie a **Project URL** e a **chave pública** (publishable/anon).

### 2. Crie o banco
No painel do Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261107000000_vora_init.sql` e clique em **Run**.

> Pela linha de comando: `npx supabase link --project-ref SEU_REF` e depois `npx supabase db push`.

### 3. Publique as funções de servidor
```bash
npx supabase login
npx supabase link --project-ref SEU_REF
npx supabase functions deploy consulta-cep  --no-verify-jwt
npx supabase functions deploy consulta-cnpj --no-verify-jwt
npx supabase functions deploy excluir-conta --no-verify-jwt   # valida o login internamente
```
- `consulta-cep` usa BrasilAPI, com ViaCEP de reserva.
- `consulta-cnpj` usa BrasilAPI, ou seja, a base pública da Receita.
- `excluir-conta` apaga o usuário e, em cascata, todos os dados dele.

### 4. Configure o login
Em **Authentication → Sign In / Providers → Email**:
- **Confirm email** ligado (recomendado): o usuário recebe um link antes de entrar.
- Em **Authentication → Email Templates**, traduza os e-mails para português.

### 5. Rode o app
```bash
cp .env.example .env        # e preencha com a URL e a chave do passo 1
npm install
npx expo start
```
Escaneie o QR code com o app **Expo Go** no celular, ou pressione `w` para abrir no navegador.

### 6. Publicar nas lojas
```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```
Antes, troque o `bundleIdentifier`/`package` em `app.json` (`br.com.vora.app`) pelo domínio de vocês.

---

## Estrutura

```
src/
  app/                    telas (Expo Router: cada arquivo é uma rota)
    boas-vindas.tsx       splash com logo
    entrar.tsx · tipo.tsx · cadastro-freelancer.tsx · cadastro-empresa.tsx
    (tabs)/               Início · Buscar · Publicar · Conversas · Perfil
    vaga/[id].tsx · freela/[id].tsx · chat/[id].tsx · lista.tsx · termos.tsx
  components/             botões, campos, cartões, endereço com CEP, ícones
  lib/
    api.ts                todas as consultas ao Supabase
    validacao.ts          CPF, CNPJ (inclusive alfanumérico), máscaras
    sessao.tsx            login e perfil do usuário logado
  theme.ts                cores e fontes da identidade Vora
supabase/
  migrations/             tabelas, validações, RLS e funções SQL
  functions/              consulta-cep · consulta-cnpj · excluir-conta
```

---

## Próximos passos recomendados (antes de lançar)

1. **Revisão jurídica:** o texto de `src/app/termos.tsx` é um modelo. Um advogado precisa revisar os termos e a política de privacidade, e vocês precisam nomear o encarregado de dados (DPO).
2. **Verificação de identidade:** hoje o CPF é validado pelos dígitos. Para confirmar na Receita, contrate a API **Consulta CPF** do Serpro e crie uma função de servidor que marque `perfis.verificado = true`. Ela deve usar a chave de serviço, porque o app não pode alterar esse campo.
3. **Pagamentos:** se o Vora intermediar pagamentos, use um intermediador (Asaas, Pagar.me, Mercado Pago, Stripe) com split e verificação de identidade (KYC). Assim vocês não guardam dados bancários.
4. **Proteção contra abuso:** limite de requisições nas funções de CEP/CNPJ e CAPTCHA no cadastro (o Supabase tem integração com hCaptcha/Turnstile).
5. **Criptografia de colunas:** se quiserem uma camada extra além da criptografia em repouso do Supabase, usem o **Supabase Vault** para o CPF.
6. **Notificações push** com `expo-notifications` para mensagens novas e candidaturas.
