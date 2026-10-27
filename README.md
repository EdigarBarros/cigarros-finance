# Controle Financeiro

Site para administrar as finanças com a mesma cara e as mesmas contas da planilha `PLANILHA_FINANCEIRA_2026.xlsx`:

- **Entradas** e **Saídas** do mês (saídas separadas em principal, **Nubank** e **Inter**), editáveis direto na tabela, como planilha
- **Resumo**: entradas, saídas, fluxo de caixa, caixa, dívida, investimentos e US$
- **Visão anual**: gráfico entradas × saídas (com linhas de caixa, dívida, investimentos e US$) e tabela mês a mês
- **Dívidas**: valor mensal, parcelas, pagas, restantes e total (botão `+1` para marcar parcela paga)
- **Caixa**: conta corrente, caixinha e reserva de emergência em Nubank, Inter e Itaú
- **Métricas**: transporte, dívidas, alimentação e outros, com gráfico de rosca (a categoria de cada saída é a bolinha `T` / `D` / `A` / `O`)
- **Meta de US$** com gráfico de progresso
- Abas de meses no rodapé, igual às abas da planilha
- **Importar planilha (.xlsx)**: puxa todos os meses da sua planilha atual, já com as categorias
- **Exportar backup (.xlsx)** com todos os dados
- Botão para **trazer dívidas e caixa do mês anterior** ao abrir um mês novo
- Campos de valor aceitam `1.234,56` e contas como na planilha: `=105,53-60,02`

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
