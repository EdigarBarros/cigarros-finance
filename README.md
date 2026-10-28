# OpusCash

Dashboard de finanças pessoais, construído a partir da ideia da planilha `PLANILHA_FINANCEIRA_2026.xlsx`
(mesmos conceitos, mas com cara de app):

- **Visual OpusCash, claro e escuro**: menu lateral com a marca, barra de busca, seletor de mês, sino de contas e
  perfil no topo; na Início, saudação, cartões de indicadores, fluxo financeiro dos últimos 6 meses, últimos
  lançamentos, rosca por categoria, metas e um convite para planejar. As cores vêm do símbolo (índigo → azul →
  verde-água). O tema segue o aparelho ou é escolhido no botão ☀/☾ do topo e em **Configurações → Painel → Aparência**
- **Animações**: blocos que saem do desfoque um após o outro, números que contam até o valor, gráficos que crescem
  da base, barras de progresso que enchem, pílula do menu que desliza até a página aberta e cartões que sobem sob o
  ponteiro. A troca de tema espalha o tema novo como uma mancha de tinta a partir do botão. Quem quiser menos movimento
  escolhe **Animações: Reduzidas** em Configurações → Painel → Aparência

- **Painel que se adapta a cada pessoa**: no primeiro acesso, 4 perguntas rápidas (moeda, outras moedas, o que faz
  parte da vida financeira, jeito de ver) montam o painel só com o que faz sentido. Dívidas, bancos, investimentos e
  outras moedas são módulos que ligam e desligam; o jeito de ver vai de **simples** (só o essencial) a **detalhado**
  (todas as categorias, lançamentos do mês e mais indicadores). Depois disso o app continua se adaptando: percebe pelos lançamentos que a pessoa
  começou a investir, paga parcelas, mexe com dólar ou usa vários bancos e sugere ligar (sem insistir se ela recusar).
  No formulário, uma dica aparece enquanto ela digita ("Aporte no CDB" → acompanhar investimentos). Tudo pode ser mudado
  em **Personalizar painel**, ou com um toque em "+ Investimentos" no fim da visão geral
- **Qualquer moeda**: a moeda principal define todos os totais (real, dólar, euro, peso…). Lançamentos podem ser feitos
  em outra moeda com a cotação do dia (editável); o valor original fica guardado e o total entra convertido
- **Categorias suas**: toda conta começa com categorias que servem para qualquer pessoa (moradia, saúde, lazer,
  assinaturas, pets, salário, renda extra…), e cada uma pode ser criada, renomeada, ganhar emoji e cor ou ser apagada.
  Entradas também têm categoria. Ao lançar, o app sugere a categoria pela descrição ("Netflix" → Assinaturas) e aprende
  com o que você escolhe; dá para criar uma categoria nova sem sair do lançamento
- **Metas para qualquer objetivo**: viagem, carro, casa, estudos, reserva de emergência (o app sugere 6 meses dos seus
  gastos)… Cada meta tem valor, moeda e prazo opcional; você registra o que guarda ou retira e o app mostra quanto falta,
  quanto guardar por mês para chegar no prazo e, no seu ritmo, quando você chega lá
- **Contas fixas e a pagar**: aluguel, luz, internet, academia, streaming… e também entradas fixas como o salário.
  Cadastre uma vez (dia, valor de costume, categoria) e todo mês o app mostra o que está **atrasado**, o que **vence
  esta semana**, o que vem depois e o que já foi **pago**. Nada é lançado sozinho: você toca em **Paguei** (ou **Recebi**)
  e o app cria o lançamento com 1 toque, com a opção de trocar o valor (a conta de luz muda) ou a data; dá para desfazer.
  O app também sugere transformar em conta fixa o que você paga todo mês. Módulo "Contas do mês", ligado nas perguntas
  iniciais ou em Personalizar painel
- **Cartão de crédito**: cadastre cada cartão com o dia em que a fatura fecha, o dia em que vence e o limite. Ao lançar uma
  saída, escolha "Como pagou?" e em quantas vezes: cada parcela cai na fatura certa (compra depois do fechamento vai para o
  mês seguinte) e conta como saída no mês em que você de fato paga. A página Cartões mostra a fatura de cada mês com situação
  (aberta, fechada, paga, venceu), as compras dela, as próximas 6 faturas, as compras parceladas em andamento ("3/10") e quanto
  do limite ainda está livre. "Paguei a fatura" só marca como paga, sem contar o gasto duas vezes
- **Início**: responde, nesta ordem, "como estou este mês?" (quanto sobrou, entrou e saiu), "o que preciso fazer?"
  (dívidas e o que vem por aí) e "para onde está indo meu dinheiro?" (categorias e últimos lançamentos); depois o mês a
  mês do ano, o dinheiro guardado e as metas. O jeito de ver (simples, equilibrado, detalhado) só acrescenta linhas aos
  mesmos blocos. A lógica de cada modo está em [`docs/arquitetura-do-painel.md`](docs/arquitetura-do-painel.md), junto
  com o guia de linguagem do app
- **Assinatura (Stripe)**: conta nova vê a tela de assinatura em vez do painel: 7 dias grátis com cartão obrigatório, depois R$ 9,99
  por mês (ou o equivalente em USD, EUR, ARS, CLP, UYU, COP, PEN, MXN, CAD, AUD, CHF, GBP, conforme a moeda da pessoa).
  Teste acabou, cancelou ou o cartão falhou: o painel fica bloqueado. Contas que já existiam entram como `cortesia`. Peças:
  tabela `assinaturas` ([migração 12](supabase/migracao-12-assinaturas.sql)), funções `stripe-checkout`, `stripe-portal` e
  `stripe-webhook` em `supabase/functions/` (segredo `STRIPE_SECRET_KEY` no Supabase, nunca no código) e, para o bloqueio valer
  também no banco, a [migração 13](supabase/migracao-13-bloqueio-no-banco.sql), que só deve ser rodada depois de testar o fluxo
- **Forma de pagamento**: todo lançamento tem "Como pagou?" (Pix, débito, crédito, dinheiro, boleto) ou "Como recebeu?" (Pix,
  transferência, dinheiro). O app lembra a forma que você usou para cada descrição e reconhece "Pix" escrito no texto (e
  no extrato importado). **Crédito** leva ao cartão e às parcelas e a compra entra na fatura e no limite da aba Cartões;
  Pix e débito saem do banco escolhido. Na lista, um filtro por forma mostra quanto foi gasto em cada uma (migração 11;
  sem ela o app funciona, só não guarda Pix/débito/dinheiro)
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

> **Já tinha o banco criado antes?** Rode também as migrações que faltarem, em ordem, no SQL Editor:
> [`migracao-02`](supabase/migracao-02-dividas-interligadas.sql), [`migracao-03`](supabase/migracao-03-bancos.sql) e
> [`migracao-04-perfil-e-moedas`](supabase/migracao-04-perfil-e-moedas.sql) (perfil adaptável e outras moedas) e
> [`migracao-05-categorias`](supabase/migracao-05-categorias.sql) (categorias editáveis; os lançamentos antigos passam para as
> categorias novas), [`migracao-06-metas`](supabase/migracao-06-metas.sql) (metas; a meta em dólar antiga vira uma meta),
> [`migracao-07-contas-fixas`](supabase/migracao-07-contas-fixas.sql) (contas fixas e a pagar; precisa das migrações 3 e 5) e
> [`migracao-08-cartoes`](supabase/migracao-08-cartoes.sql) (cartões de crédito, faturas e compras parceladas) e
> [`migracao-09-cartoes-extras`](supabase/migracao-09-cartoes-extras.sql) (renegociar fatura, juros de atraso, limite
> garantido da caixinha e foto de perfil) e
> [`migracao-10-dividas-e-a-receber`](supabase/migracao-10-dividas-e-a-receber.sql) (quem te deve, com quem é a dívida e
> calendário de parcelas: paga, pela metade, atrasada).
> Todas só acrescentam, não apagam nada.

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
