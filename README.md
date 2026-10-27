# Controle Financeiro

Dashboard de finanças pessoais, construído a partir da ideia da planilha `PLANILHA_FINANCEIRA_2026.xlsx`
(mesmos conceitos e cores, mas com cara de app):

- **Visão geral**: saldo do mês em destaque, indicadores (entradas, saídas, caixa, dívida, investimentos, dólar)
  com comparação ao mês anterior, gráfico entradas × saídas do ano, para onde foi o dinheiro (por categoria),
  saídas por conta (Principal, Nubank, Inter), dívidas em aberto e meta em dólar
- **Lançamentos**: lista por dia com busca e filtros; formulário rápido com "salvar e lançar outro",
  sugestão de descrição e categoria automática pelo histórico (digitou "iFood", já vem Alimentação)
- **Dívidas interligadas**: cada dívida existe ao longo dos meses. Ao lançar uma saída de dívida, você escolhe
  qual dívida ela abate (ou o app reconhece pela descrição) e o saldo cai sozinho em todos os meses seguintes.
  Com a parcela definida, o app prevê quando a dívida acaba. Juros ou acordo? Basta informar o saldo novo
- **Bancos**: cadastre os seus (Nubank, Itaú, Next, PicPay, dinheiro vivo…). O banco de cada entrada/saída é
  **opcional** — o app reconhece "(Next)" na descrição e lembra o banco que você usa para cada coisa. Tela de bancos
  com saldo guardado e movimento do mês de cada um, detalhe individual e bloco "Por banco" na visão geral.
  Saldos, US$ e meta passam automaticamente para os meses seguintes até você atualizar
- **Ano**: totais do ano, gráficos de saldo e evolução de caixa, dívida, investimentos e dólar, tabela mês a mês
- **Importar planilha (.xlsx)** com os meses e categorias da planilha antiga; **exportar backup (.xlsx)**
- Valores aceitam `1.234,56` e contas como `=105,53-60,02`
- Celular em modo leitura: resumo, gráficos e listas recolhidas; editar continua a um toque (botão + e tocando nos itens)

Tudo grátis: o site fica na **Vercel** ou **Netlify** e os dados no **Supabase** (Postgres), protegidos por login.

## Como colocar no ar (≈15 min)

### 1. Banco de dados (Supabase)

1. Entre em <https://supabase.com> → **New project** (plano Free). Anote a senha do banco.
2. No projeto: **SQL Editor** → **New query** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Em **Project Settings → API** (ou botão **Connect**), copie:
   - **Project URL** → vai em `VITE_SUPABASE_URL`
   - **anon / publishable key** → vai em `VITE_SUPABASE_ANON_KEY`
   (essa chave é pública por natureza; quem protege os dados são as regras RLS do `schema.sql`. Nunca use a `service_role`.)

### 2. Site (escolha um)

**Vercel:** <https://vercel.com/new> → importe este repositório → em *Environment Variables* adicione as duas variáveis acima → **Deploy**.

**Netlify:** <https://app.netlify.com/start> → importe este repositório (o `netlify.toml` já configura o build) → *Site configuration → Environment variables* → adicione as duas variáveis → **Deploy**.

### 3. Primeiro acesso

1. Abra o site → **Primeiro acesso? Criar conta** → confirme pelo e-mail.
2. Menu **☰ → Importar planilha (.xlsx)** e escolha sua planilha. Os meses que vierem nela substituem os do site.
3. **Recomendado:** depois de criar sua conta, no Supabase vá em **Authentication → Sign In / Providers** e desligue **Allow new users to sign up**, para ninguém mais conseguir se cadastrar no seu site.

## Bom saber

- No plano grátis, o Supabase **pausa o projeto depois de 7 dias sem uso**. Os dados não se perdem: é só entrar no painel do Supabase e clicar em *Restore*. Usando o site toda semana, não pausa.
- Faça **Exportar backup** de vez em quando.
- Este repositório é público: nunca coloque aqui a planilha nem o arquivo `.env` (o `.gitignore` já bloqueia `*.xlsx` e `.env`).

## Rodar no computador

```bash
cp .env.example .env   # preencha as duas variáveis
npm install
npm run dev
```
