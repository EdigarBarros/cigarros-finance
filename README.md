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
- **Qualquer idioma**: o botão 文A (no topo do painel; nas outras telas, preso no canto de cima) abre a lista de mais de
  100 idiomas, cada um escrito nele mesmo, com busca. O app é escrito em português. Inglês e espanhol têm tradução nossa
  (`lib/textos.ts` e `src/i18n/traducoes.json`, no app inteiro menos as páginas legais); os outros idiomas são a
  tradução automática do Google (`lib/idioma.ts`). A escolha fica salva no navegador. Valores em dinheiro, a marca e o nome da pessoa não são traduzidos.
  A política de segurança (`vercel.json`) libera o tradutor do Google; se ele mudar o script que roda na barra dele, o hash
  `sha256-…` do `script-src` precisa ser atualizado (o console do navegador mostra o novo)

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
- **Moeda em todo o sistema e dinheiro sem vírgula na mão**: contas do mês e dívidas também podem ser em outra moeda (internet em
  dólar, alguém te deve US$ 5). O valor aparece na moeda da conta ou da dívida, com "≈ R$ …" ao lado, e os totais do painel
  somam tudo na moeda principal pela cotação do dia. "Paguei" numa conta em dólar guarda o valor original e a cotação (dá para
  informar a que você pagou); pagar uma dívida em dólar já abre em dólar. A escolha de moeda é uma fileira de pílulas com a
  bandeira desenhada, o código e o símbolo, e os campos de dinheiro preenchem os centavos sozinhos (digitar 1500 mostra 15,00;
  contas como `=105,53-60,02` continuam valendo). A conta em outra moeda aceita uma **cotação combinada** (a que a pessoa paga de
  verdade, "1 R$ = 290 ARS", com botão para inverter): o valor da conta em reais passa a ser exato e a mesma cotação já vem
  preenchida no "Paguei". Pedem a [migração 14](supabase/migracao-14-moeda-em-contas-e-dividas.sql) e a
  [15](supabase/migracao-15-cotacao-da-conta.sql)
- **Tutorial guiado**: depois das perguntas iniciais, o painel escurece e destaca, um por vez, onde fica cada coisa (lançar, resumo,
  lançamentos, importar extrato, e só as abas que a pessoa ligou). Um passo oferece ligar abas que ela não tinha escolhido.
  Dá para pular a qualquer momento (botão, X ou Esc) e rever em Configurações → Conta → Ver o tutorial, ou no menu da conta
- **Assinatura (Stripe)**: conta nova ganha 7 dias grátis **sem cartão** (a [migração 17](supabase/migracao-17-teste-sem-cartao.sql) cria o teste no cadastro); o cartão só é pedido ao assinar, por R$ 9,99
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
  Com a parcela definida, o app prevê quando a dívida acaba. Juros ou acordo? Basta informar o saldo novo.
  Se você informar os **juros por mês** de cada dívida (opcional, [migração 19](supabase/migracao-19-juros-das-dividas.sql)), o
  conselheiro do menu diz qual dívida pagar primeiro (a que cobra mais) e avisa quando os juros são muito altos
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

> **Já tinha o banco criado antes?** Rode também as migrações que faltarem, em ordem, no SQL Editor (de
> [`migracao-02`](supabase/migracao-02-dividas-interligadas.sql) até a [`migracao-19`](supabase/migracao-19-juros-das-dividas.sql)).
> Todas só acrescentam, não apagam nada. A 12 (assinaturas) e a 13 (bloqueio no banco) só servem se você cobra assinatura; a 16 acrescenta
> carência no cartão recusado, teste grátis por cartão e o registro de erros; a 19 acrescenta os juros por mês das dívidas (opcional).

### 2b. Cobrança (Stripe) e contas de cortesia

1. No Stripe, crie o produto com preço mensal e `lookup_key = opuscash_mensal` (em reais e nas outras moedas aceitas).
2. Supabase → **Edge Functions**: publique `stripe-checkout`, `stripe-portal`, `excluir-conta` (com verificação de JWT) e `stripe-webhook`
   (**sem** verificação de JWT). Em **Secrets**, defina `STRIPE_SECRET_KEY`.
3. Stripe → Webhooks: aponte para a função `stripe-webhook` com os eventos `customer.subscription.created`, `.updated` e `.deleted`.
4. **Cortesia** (acesso liberado, sem cobrança, nunca revogado pelo Stripe): rode [`supabase/dar-cortesia.sql`](supabase/dar-cortesia.sql)
   com os e-mails escolhidos. Rodar as migrações **não** dá cortesia a ninguém.
5. Na hospedagem (Vercel), defina `VITE_EMAIL_SUPORTE` e `VITE_RESPONSAVEL`: aparecem nos Termos e na Privacidade.

### 2c. Login (Supabase → Authentication)

- **URL Configuration:** `Site URL` = endereço do site; em `Redirect URLs` adicione o mesmo endereço (o link de "Esqueci minha senha" e
  o de confirmação voltam para ele).
- **SMTP próprio** (Project Settings → Authentication → SMTP): o e-mail padrão do Supabase manda pouquíssimos por hora e quase
  não serve para um site aberto. Use Resend, Brevo, SendGrid etc.
- **E-mails com a cara do OpusCash** (Authentication → Emails → Templates): cole o conteúdo de cada arquivo de
  [`supabase/emails/`](supabase/emails/) no template correspondente e use o assunto sugerido:

  | Template do Supabase | Arquivo | Assunto |
  | --- | --- | --- |
  | Confirm sign up | `confirmar-cadastro.html` | Confirme seu e-mail no OpusCash |
  | Reset password | `redefinir-senha.html` | Crie uma senha nova no OpusCash |
  | Change email address | `trocar-email.html` | Confirme seu novo e-mail no OpusCash |
  | Password changed (ative "Ativar notificações") | `senha-alterada.html` | Sua senha do OpusCash foi alterada |

  Em Authentication → Sign In / Providers → Email, deixe **Confirm email** ligado.
- **Passwords:** ligue "Prevent use of leaked passwords" (plano Pro) e deixe o mínimo em 8 caracteres ou mais.
- Erros do app aparecem em `select * from erros_app order by criado_em desc limit 50;`.

### 3. Primeiro acesso

1. Abra o site → **Primeiro acesso? Criar conta** → confirme pelo e-mail.
2. Menu **☰ → Importar planilha (.xlsx)** e escolha sua planilha. Os meses que vierem nela substituem os do site.
3. Se o site for **só seu** (sem cobrança), desligue **Allow new users to sign up** em **Authentication → Sign In / Providers**. Se for aberto ao público, deixe ligado.

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
