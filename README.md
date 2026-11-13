# OpusCash

Dashboard de finanças pessoais, construído a partir da ideia da planilha `PLANILHA_FINANCEIRA_2026.xlsx`
(mesmos conceitos, mas com cara de app):

- **Visual OpusCash, claro e escuro**: menu lateral com a marca, barra de busca, seletor de mês, sino de contas e
  perfil no topo; na Início, saudação, cartões de indicadores, fluxo financeiro dos últimos 6 meses, últimos
  lançamentos, rosca por categoria, metas e um convite para planejar. As cores vêm do símbolo (índigo → azul →
  verde-água). O tema segue o aparelho ou é escolhido no botão ☀/☾ do topo e em **Configurações → Aparência**
- **Animações**: blocos que saem do desfoque um após o outro, números que contam até o valor, gráficos que crescem
  da base, barras de progresso que enchem, pílula do menu que desliza até a página aberta e cartões que sobem sob o
  ponteiro. A troca de tema espalha o tema novo como uma mancha de tinta a partir do botão. Quem quiser menos movimento
  escolhe **Animações: Reduzidas** em Configurações → Aparência
- **Qualquer idioma**: o botão 文A (no topo do painel; nas outras telas, preso no canto de cima) abre a lista de mais de
  100 idiomas, cada um escrito nele mesmo, com busca. O app é escrito em português. Inglês e espanhol têm tradução nossa
  (`lib/textos.ts` e `src/i18n/traducoes.json`, no app inteiro menos as páginas legais); os outros idiomas são a
  tradução automática do Google (`lib/idioma.ts`). A escolha fica salva no navegador. Valores em dinheiro, a marca e o nome da pessoa não são traduzidos.
  A política de segurança (`vercel.json`) libera o tradutor do Google; se ele mudar o script que roda na barra dele, o hash
  `sha256-…` do `script-src` precisa ser atualizado (o console do navegador mostra o novo)

- **Painel que se adapta a cada pessoa**: no primeiro acesso, o seu nome e 4 perguntas rápidas (moeda, outras moedas, o que faz
  parte da vida financeira, jeito de ver) montam o painel só com o que faz sentido. Dívidas, bancos, investimentos e
  outras moedas são módulos que ligam e desligam; o jeito de ver vai de **simples** (só o essencial) a **detalhado**
  (todas as categorias, lançamentos do mês e mais indicadores). Depois disso o app continua se adaptando: percebe pelos lançamentos que a pessoa
  começou a investir, paga parcelas, mexe com dólar ou usa vários bancos e sugere ligar (sem insistir se ela recusar).
  No formulário, uma dica aparece enquanto ela digita ("Aporte no CDB" → acompanhar investimentos). Tudo pode ser mudado
  em **Personalizar** (Configurações → Painel), ou com um toque em "+ Investimentos" no fim da visão geral
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
  iniciais ou em Personalizar (Configurações → Painel)
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
- **Medição de uso** ([migração 30](supabase/migracao-30-uso-do-app.sql), `lib/uso.ts`): com a pessoa logada, o app manda a cada minuto (e ao
  trocar de tela ou sair) em qual tela ela está, quanto tempo ficou em cada uma, **quantos** toques e teclas deu (nunca o que digitou),
  o idioma, se é o site ou o app Android e a versão. Também registra se ela pulou o tutorial (em qual passo) ou viu inteiro, e quando
  respondeu as perguntas iniciais. Nada do que ela lança ou escreve sai daí. Quem lê é só o painel de suporte (repositório
  `painel-opus-cash`), pela chave de serviço: as tabelas `uso_*` não abrem para ninguém pelo navegador
- **Tutorial guiado**: depois das perguntas iniciais, o painel escurece e destaca, um por vez, onde fica cada coisa (lançar, resumo,
  lançamentos, importar extrato, e só as abas que a pessoa ligou). Um passo oferece ligar abas que ela não tinha escolhido.
  Dá para pular a qualquer momento (botão, X ou Esc) e rever em Configurações → Conta → Ver o tutorial, ou no menu da conta
- **Assinatura (Stripe)**: conta nova ganha 7 dias grátis **sem cartão** (o teste começa quando a pessoa escolhe o plano: [migração 17](supabase/migracao-17-teste-sem-cartao.sql) e [18](supabase/migracao-18-teste-ao-escolher-plano.sql)); o cartão só é pedido ao assinar, por R$ 9,99
  por mês (ou o equivalente em USD, EUR, ARS, CLP, UYU, COP, PEN, MXN, CAD, AUD, CHF, GBP, conforme a moeda da pessoa).
  Teste acabou, cancelou ou o cartão falhou: o painel fica bloqueado. Quem deve ter acesso sem cobrança recebe `cortesia` (veja `supabase/dar-cortesia.sql`). Peças:
  tabela `assinaturas` ([migração 12](supabase/migracao-12-assinaturas.sql)), funções `stripe-checkout`, `stripe-portal` e
  `stripe-webhook` em `supabase/functions/` (segredo `STRIPE_SECRET_KEY` no Supabase, nunca no código) e, para o bloqueio valer
  também no banco, a [migração 20](supabase/migracao-20-acesso-no-banco-definitivo.sql) (a 13 antiga), que liga o bloqueio: teste o fluxo de assinatura com uma conta nova logo depois de rodá-la
  - **Pix de 30 dias** ([migração 29](supabase/migracao-29-pix-30-dias.sql)): a conta do Stripe não tem o Pix recorrente (Pix Automático), então
    o Pix não cabe em assinatura. Em reais, quem prefere Pix paga **R$ 9,99 de uma vez** (checkout avulso, só Pix) e ganha 30 dias de acesso
    (status `pix`, vale até `periodo_fim`; não renova sozinho, e pagar antes de vencer soma 30 dias ao que sobrou). O `stripe-webhook` ouve
    `checkout.session.completed` e `.async_payment_succeeded`, confere a sessão no Stripe e chama a função `registrar_pix` do banco, que registra o
    pagamento (`pagamentos_pix`, chave = id da sessão: aviso repetido não soma de novo) e libera o acesso na mesma transação.
    Quem paga o Pix durante o teste grátis não perde o que sobrou do teste (os 30 dias começam depois). Pix pago por quem já tinha cortesia ou
    assinatura ativa (uma corrida rara) fica registrado sem crédito: `select * from pagamentos_pix where not creditado;` mostra os que precisam de reembolso.
    Reembolso ou estorno de um Pix **não** tira o acesso sozinho: ajuste `assinaturas.periodo_fim` à mão.
- **Forma de pagamento**: todo lançamento tem "Como pagou?" (Pix, débito, crédito, dinheiro, boleto) ou "Como recebeu?" (Pix,
  transferência, dinheiro). O app lembra a forma que você usou para cada descrição e reconhece "Pix" escrito no texto (e
  no extrato importado). **Crédito** leva ao cartão e às parcelas e a compra entra na fatura e no limite da aba Cartões;
  Pix e débito saem do banco escolhido. Na lista, um filtro por forma mostra quanto foi gasto em cada uma (migração 11;
  sem ela o app funciona, só não guarda Pix/débito/dinheiro)
- **Dinheiro guardado ligado ao lançamento**: numa saída, "Foi guardar dinheiro?" liga o lançamento ao banco e ao lugar
  onde o dinheiro foi (conta, caixinha/porquinho ou reserva). Ex.: Itaú → porquinho do PicPay. A saída continua na lista,
  mas não conta como gasto (fica fora de Saiu, Faltou e Para onde foi); o app tira o valor da conta de origem e soma na
  caixinha de destino do mês (e o limite garantido do cartão que usa essa caixinha sobe junto). Editar ou apagar o
  lançamento desfaz o ajuste ([migração 23](supabase/migracao-23-guardado-em-banco.sql); sem ela o app funciona e avisa)
- **Consultor que aprende com você**: a aba Consultor pergunta o seu objetivo (sair das dívidas, fechar o mês sem aperto,
  juntar dinheiro, saber para onde vai o dinheiro, gastar sem culpa, fazer render) e muda a ordem do plano e o que diz.
  Cada passo que dá para medir é conferido quando o mês fecha: deu certo, vira vitória; não deu, o próximo vem menor;
  duas vezes sem dar, ele para de insistir. Também lê o seu jeito (guarda muito, usa crédito com controle, orçamento
  justo, estável, anota tudo) e fala com cada um de um jeito ([migração 24](supabase/migracao-24-memoria-do-consultor.sql);
  sem ela, a memória fica só no aparelho)
- **Saldo de um mês para o outro**: a pessoa diz uma vez quanto tinha no começo de um mês e o quadro de cada mês mostra o que
  veio do mês anterior e o saldo no fim dele (o que sobrou soma, o que faltou tira). Não vira lançamento nem mexe no saldo
  dos bancos ([migração 27](supabase/migracao-27-saldo-de-um-mes-para-o-outro.sql); sem ela, fica só no aparelho)
- **Lançamentos**: lista por dia com busca e filtros; formulário rápido com "salvar e lançar outro",
  sugestão de descrição e categoria automática pelo histórico (digitou "iFood", já vem Alimentação)
- **Dívidas interligadas**: cada dívida existe ao longo dos meses. Ao lançar uma saída de dívida, você escolhe
  qual dívida ela abate (ou o app reconhece pela descrição) e o saldo cai sozinho em todos os meses seguintes.
  Com a parcela definida, o app prevê quando a dívida acaba. Juros ou acordo? Basta informar o saldo novo.
  Se você informar os **juros por mês** de cada dívida (opcional, [migração 19](supabase/migracao-19-juros-das-dividas.sql)), o
  Consultor diz qual dívida pagar primeiro (a que cobra mais) e avisa quando os juros são muito altos.
  Uma dívida feita de várias compras (o crédito de uma loja, por exemplo) pode ser dividida em **partes**, cada uma com
  as suas parcelas, valores e datas ([migração 21](supabase/migracao-21-partes-da-divida.sql)), ou ser um valor único
  com o dia em que começou e o dia combinado para pagar ([migração 26](supabase/migracao-26-inicio-da-parte.sql)): o
  calendário e o atraso saem delas. Com a regra de **juros de atraso** do credor ([migração 22](supabase/migracao-22-juros-de-atraso.sql)), a
  dívida atrasada cresce sozinha dia a dia, como no banco ("falta pagar hoje", estimado), e o botão **Conferi com o banco**
  acerta o valor real quando você quiser. Atrasou e prometeu pagar outro dia? Anote as **promessas de pagamento**
  ([migração 25](supabase/migracao-25-promessas-de-pagamento.sql)): o cartão mostra "prometeu pagar amanhã", o calendário
  de Lançamentos põe o atrasado no dia prometido e o app diz, pelos pagamentos, se cada promessa foi cumprida
- **Invest** ([migração 28](supabase/migracao-28-invest.sql)): a carteira de investimentos. Cada investimento (CDB, LCI, LCA,
  Tesouro, ações, fundos imobiliários, ETFs, fundos) com as operações dele (aplicação, resgate, venda parcial, proventos,
  amortização, desdobramento…), de onde o app refaz quantidade, custo médio, resultado e a **rentabilidade de verdade**
  (aporte não conta como ganho). O valor de cada ativo vem do preço ou saldo que você informa ou importa, sempre com a data
  e a fonte; título com taxa é estimado pelos índices do Banco Central. Importa os extratos da B3 (Movimentação, Negociação
  e Posição) e planilhas, sem duplicar e sem perder o que não entendeu. As análises explicam o porquê de cada uma, e o
  planejamento mostra meta, aportes e três cenários. O valor investido entra no patrimônio uma vez só: o número que você
  digitava antes fica como histórico. É para acompanhar: o OpusCash não compra, não vende e não recomenda investimentos.
  Testes: `node scripts/invest/testar.mjs` e `scripts/invest/isolamento.sh`
- **Consultor**: uma aba com a análise completa do seu dinheiro, refeita a cada lançamento, compra no cartão ou dívida nova.
  Nota de 0 a 100 por pilares (sobra, reserva, dívidas, cartão, controle dos gastos, metas), a fase em que você está (do
  "sair do vermelho" ao "fazer o dinheiro crescer"), previsão de como o mês fecha e quanto dá para gastar por dia, tendência de
  12 meses, regra 50/30/20, assinaturas e gastos formiga, orçamento sugerido, plano das dívidas (avalanche × bola de neve, com
  a economia de juros), reserva de emergência, metas, patrimônio e um plano de ação em ordem. Depois de cada mudança, um aviso
  conta o que mudou na análise ([docs/arquitetura-do-painel.md](docs/arquitetura-do-painel.md), seção 4.7)
- **Bancos**: cadastre os seus (Nubank, Itaú, Next, PicPay, dinheiro vivo…). O banco de cada entrada/saída é
  **opcional** — o app reconhece "(Next)" na descrição e lembra o banco que você usa para cada coisa. Tela de bancos
  com saldo guardado e movimento do mês de cada um, detalhe individual e bloco "Por banco" na visão geral.
  Saldos, US$ e meta passam automaticamente para os meses seguintes até você atualizar
- **Ano**: totais do ano, gráficos de saldo e evolução de caixa, dívida, investimentos e dólar, tabela mês a mês
- **Importar planilha (.xlsx)** com os meses e categorias da planilha antiga; **baixar backup (.xlsx)** com tudo o que você cadastrou (lançamentos, dívidas e as partes e promessas delas, cartões e faturas, contas do mês, metas, bancos, investimentos e preferências)
- Valores aceitam `1.234,56` e contas como `=105,53-60,02`
- Celular em modo leitura: resumo, gráficos e listas recolhidas; editar continua a um toque (botão + e tocando nos itens)

Tudo grátis: o site fica na **Vercel** e os dados no **Supabase** (Postgres), protegidos por login.

## Como colocar no ar (≈15 min)

### 1. Banco de dados (Supabase)

1. Entre em <https://supabase.com> → **New project** (plano Free). Anote a senha do banco.
2. No projeto: **SQL Editor** → **New query** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Depois, uma consulta por vez e **nesta ordem**, rode as migrações [`09`](supabase/migracao-09-cartoes-extras.sql),
   [`10`](supabase/migracao-10-dividas-e-a-receber.sql), [`11`](supabase/migracao-11-forma-de-pagamento.sql),
   [`12`](supabase/migracao-12-assinaturas.sql), [`14`](supabase/migracao-14-moeda-em-contas-e-dividas.sql),
   [`15`](supabase/migracao-15-cotacao-da-conta.sql), [`16`](supabase/migracao-16-acesso-teste-e-erros.sql),
   [`17`](supabase/migracao-17-teste-sem-cartao.sql), [`18`](supabase/migracao-18-teste-ao-escolher-plano.sql),
   [`19`](supabase/migracao-19-juros-das-dividas.sql), [`21`](supabase/migracao-21-partes-da-divida.sql),
   [`22`](supabase/migracao-22-juros-de-atraso.sql), [`23`](supabase/migracao-23-guardado-em-banco.sql),
   [`24`](supabase/migracao-24-memoria-do-consultor.sql), [`25`](supabase/migracao-25-promessas-de-pagamento.sql),
   [`26`](supabase/migracao-26-inicio-da-parte.sql), [`27`](supabase/migracao-27-saldo-de-um-mes-para-o-outro.sql),
   [`28`](supabase/migracao-28-invest.sql), [`29`](supabase/migracao-29-pix-30-dias.sql) e, **por último**, a
   [`20`](supabase/migracao-20-acesso-no-banco-definitivo.sql).
   O `schema.sql` sozinho **não** tem cobrança nem bloqueio: sem a 12 e a 20 o painel abre para qualquer conta, paga ou não.
   Não rode as migrações 02 a 08 num banco novo (o `schema.sql` já inclui o que elas fazem) nem a 13 (a 20 a substitui).
3. Em **Project Settings → API** (ou botão **Connect**), copie:
   - **Project URL** → vai em `VITE_SUPABASE_URL`
   - **anon / publishable key** → vai em `VITE_SUPABASE_ANON_KEY`
   (essa chave é pública por natureza; quem protege os dados são as regras RLS do `schema.sql`. Nunca use a `service_role`.)

### 2. Site (escolha um)

**Vercel:** <https://vercel.com/new> → importe este repositório → em *Environment Variables* adicione as duas variáveis acima → **Deploy**.


> **Já tinha o banco criado antes?** Rode as migrações que faltarem, em ordem, no SQL Editor (de
> [`migracao-02`](supabase/migracao-02-dividas-interligadas.sql) até a [`migracao-20`](supabase/migracao-20-acesso-no-banco-definitivo.sql)),
> e a 20 sempre por último. A maioria só acrescenta, não apaga nada. A 12 (assinaturas) e a 20 (bloqueio no banco) só servem se você cobra
> assinatura; a 16 acrescenta carência no cartão recusado, teste grátis por cartão e o registro de erros; a 19 acrescenta os juros por mês
> das dívidas (opcional).
>
> **Não rode de novo** o `schema.sql` nem as migrações 04 a 08, 13 e 16 num banco que já tem cobrança: elas apagam as regras de acesso
> (política `dono` sem `tem_acesso()`, ou a função sem o teste grátis) e o bloqueio de quem não pagou deixa de valer. Se isso
> acontecer, rode a [`migracao-20`](supabase/migracao-20-acesso-no-banco-definitivo.sql), que é segura de rodar quantas vezes precisar.

### 2b. Cobrança (Stripe) e contas de cortesia

1. No Stripe, crie o produto com preço mensal e `lookup_key = opuscash_mensal` (em reais e nas outras moedas aceitas).
2. Supabase → **Edge Functions**: publique `stripe-checkout`, `stripe-portal`, `excluir-conta` (com verificação de JWT) e `stripe-webhook`
   (**sem** verificação de JWT). Em **Secrets**, defina `STRIPE_SECRET_KEY`.
3. Stripe → Webhooks: aponte para a função `stripe-webhook` com os eventos `customer.subscription.created`, `.updated` e `.deleted` e, para o Pix de 30 dias,
   `checkout.session.completed` e `checkout.session.async_payment_succeeded`. Ordem para publicar o Pix: migração 29, depois as funções `stripe-webhook` e
   `stripe-checkout`, depois os eventos no Stripe, e só então o site (sem isso a pessoa pagaria e não receberia o acesso). O Pix precisa estar ativo em
   Configurações → Métodos de pagamento do Stripe.
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

1. Abra o site → **Novo no OpusCash? Criar conta** → confirme pelo e-mail.
2. **Configurações → Dados → Importar planilha (.xlsx)** e escolha sua planilha. Os meses que vierem nela substituem os do site; as dívidas com o mesmo nome são atualizadas (as partes, promessas e pagamentos delas ficam).
3. Se o site for **só seu** (sem cobrança), desligue **Allow new users to sign up** em **Authentication → Sign In / Providers**. Se for aberto ao público, deixe ligado.

## Bom saber

- No plano grátis, o Supabase **pausa o projeto depois de 7 dias sem uso**. Os dados não se perdem: é só entrar no painel do Supabase e clicar em *Restore*. Usando o site toda semana, não pausa.
- Faça **Baixar backup** (Configurações → Dados) de vez em quando.
- Este repositório é público: nunca coloque aqui a planilha nem o arquivo `.env` (o `.gitignore` já bloqueia `*.xlsx` e `.env`).

## App Android (Play Store)

O app da Play Store é feito com o [Capacitor](https://capacitorjs.com): o código deste site vai **dentro do APK** (pasta
`android/`) e conversa direto com o Supabase. Ele não abre o site, não depende do Chrome e não tem barra de endereço.
Pacote **`br.com.opuscash.app`**, Android 7 ou mais novo, feito para o Android 16, em celular e tablet.

**O app não se atualiza sozinho com o site.** O código vai junto do APK, então mudança de tela, texto ou regra só chega
ao app numa versão nova enviada à loja. Mudança no banco (migração) que quebre o código antigo também pede versão nova do
app no mesmo dia.

Como o app difere do site (`src/lib/appAndroid.ts`, montado no modo `app`):
- abre direto no login, sem a página de propaganda, e não mostra preço nem botão de assinar, gerenciar a assinatura ou
  atualizar o cartão (a política de pagamentos do Google Play não deixa levar a pessoa ao Stripe). O teste grátis continua,
  e quem assinou pelo site entra normalmente;
- os e-mails de confirmar a conta e de criar senha nova levam ao site (dentro do app a página é `https://localhost`);
- o backup em planilha abre o compartilhar do Android (salvar no Drive, em Arquivos, mandar no WhatsApp), em vez de baixar;
- a página fica entre a barra de status e a de navegação (sem `viewport-fit=cover`), com o fundo azul-escuro atrás delas.

Sem internet (no site e no app): se o painel não consegue abrir, aparece o aviso de sem internet no lugar do carregando,
e ele abre sozinho quando a conexão volta; com o painel aberto, uma faixa avisa que nada é salvo até a conexão voltar
(`src/components/SemInternet.tsx`, `src/lib/conexao.ts`; no app, o plugin de rede do Capacitor).

O endereço e a chave **pública** do Supabase do app ficam em `.env.app` (os mesmos que o site publica no navegador).

**A chave de assinatura não fica aqui** (o repositório é público). O arquivo `opuscash-upload.keystore` e a senha ficam com
o dono do projeto, com uma cópia no Google Drive dele. É a *chave de upload*: se ela se perder, o Play Console deixa trocar
(Protegido com o Google Play → Proteção da Google Play Store → Gerencie a Assinatura de Apps do Google Play → pedir
redefinição da chave de upload).

Para gerar uma versão nova (precisa do JDK 21 e do Android SDK, com `sdk.dir` em `android/local.properties`):

1. Aumente `versionCode` (sempre +1) e `versionName` em `android/app/build.gradle`.
2. `npm run app` (monta o código no modo `app` e copia para `android/`).
3. `cd android && ./gradlew bundleRelease`
4. Assine com a chave: `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore opuscash-upload.keystore
   app/build/outputs/bundle/release/app-release.aab opuscash`
5. Envie o `app-release.aab` no Play Console.

Ícones e abertura saem de `public/simbolo.webp` e `public/icone-512.png`: `python3 scripts/app-android/icones.py`.

As versões 1.0.x do app abriam o site pelo Chrome (Trusted Web Activity). Delas ficaram `public/.well-known/assetlinks.json`
(liga o pacote ao site, com as chaves do Google e a de upload; serve também se um dia o app abrir links do site) e a leitura
de `?app=android` em `src/lib/appAndroid.ts`.

## Rodar no computador

```bash
cp .env.example .env   # preencha as duas variáveis
npm install
npm run dev
```
