# OpusCash: instruções e registro de trabalho do GPT/Codex

## Como usar este documento

Este documento foi criado pelo GPT/Codex, a pedido de Edigar Barros, para compartilhar contexto com o Claude
e com futuras sessões. Leia-o junto com `CLAUDE.md` antes de trabalhar no projeto. Ele complementa as regras
do projeto; não substitui as instruções atuais do usuário.

Para entender funcionalidades e configuração, consulte `README.md`. Para regras das telas e linguagem,
consulte `docs/arquitetura-do-painel.md`. Siga as orientações de testes, idiomas, banco e Android do `CLAUDE.md`.

## Como manter o registro

- Registre cada trabalho com data, autoria (GPT/Codex ou Claude), objetivo e estado.
- Explique o que mudou, por que mudou, os arquivos envolvidos e como foi feito.
- Separe problemas identificados de correções implementadas. Inclua cenário de reprodução, impacto e evidências.
- Anote os comandos de validação, resultados e limitações. Não apresente testes propostos como executados.
- Preserve o histórico: ao corrigir um problema, acrescente a resolução e atualize seu estado.
- Diferencie mudanças locais, commits, envio ao GitHub e publicação. Só registre cada etapa quando confirmada.
- Nunca registre senhas, tokens, valores de variáveis secretas ou dados financeiros reais.

## Estado atual

Os dois problemas identificados abaixo foram corrigidos e validados localmente pelo GPT/Codex.
Veja a entrada "Correções de metas e histórico de faturas" para implementação, comandos e resultados.
A publicação foi posteriormente autorizada pelo usuário; veja a entrada de publicação ao final para o estado atual.
Em 15/11/2026 o Claude revisou essas correções (sem achar erro) e as publicou; veja as entradas do Claude ao final.
As alterações anteriores de documentação (`CLAUDE.md` e criação deste arquivo) foram preservadas.

## Histórico

### 14/11/2026 — GPT/Codex — Análise de bugs

**Estado:** análise concluída para os cenários descritos; correções pendentes.

Revisão local do checkout em `11b11aec341d12d75c3088b8152371423168ca86`. Foram examinados cálculos
financeiros, carregamento de dados e formulários. Esta análise não é uma garantia de ausência de outros bugs.

#### 1. Metas: formulário fecha mesmo quando a gravação falha

**Estado atual:** corrigido localmente; veja a resolução ao final. Na análise inicial, a criação foi reproduzida com falha simulada.

- Arquivos: `src/pages/Metas.tsx` (salvamento da meta e de seus movimentos) e `src/lib/useDados.ts`
  (`addMeta`, `updMeta`, `addMovimentoMeta`).
- Causa: o formulário dispara a gravação com `void` e chama `aoFechar()` imediatamente, sem esperar o resultado.
- Impacto: se o servidor recusar a gravação, o erro aparece depois que o formulário já fechou. Os valores digitados
  se perdem e a pessoa precisa preenchê-los novamente. O mesmo padrão existe ao guardar ou retirar dinheiro da meta.
- Reprodução executada: build com Supabase fictício; servidor de demonstração do repositório; Playwright com
  `/usr/bin/chromium`; abrir `#/metas`, criar uma meta e interceptar o POST de `rest/v1/metas` com HTTP 503.
  Resultado: erro exibido, nenhum registro criado e nenhum modal aberto (`modalAberto: 0`, `metaGravada: false`).
- Limite da evidência: edição de meta e movimentos apresentam o mesmo padrão no código, mas não tiveram essa
  reprodução de falha no navegador nesta análise.
- Correção sugerida, ainda não implementada: retornar sucesso/falha das funções de gravação, aguardar o resultado,
  manter o formulário aberto em caso de erro e impedir novos envios enquanto a gravação estiver em andamento.

#### 2. Cartões: histórico de faturas pagas não é paginado

**Estado atual:** corrigido localmente e validado com 1.002 faturas; veja a resolução ao final. A análise inicial foi por inspeção e simulação da consulta.

- Arquivo: `src/lib/useCartoes.ts`, função `buscar`.
- Causa: `faturas_pagas` usa uma consulta única, ordenada por ano e mês. O Supabase limita as respostas a 1.000 linhas
  na configuração considerada pelo próprio projeto. Os lançamentos já usam `lerTudo`, mas as faturas pagas não.
- Impacto: ao ultrapassar esse limite, pagamentos mais recentes deixam de ser carregados. Faturas pagas podem aparecer
  em aberto, e o limite disponível pode ser calculado a menor. Renegociações omitidas também deixam de ser reconhecidas.
- Verificação executada: cliente Supabase com transporte simulado retornando 1.000 registros; a consulta terminou
  sem erro e sem solicitar outra página. O limite do servidor de produção não foi consultado nesta análise.
- Correção sugerida, ainda não implementada: usar `lerTudo` também para as faturas, com ordenação estável terminando
  em `id`, e validar um histórico com mais de 1.000 registros, incluindo pagamentos e renegociações na última página.

#### Validações executadas

Dependências instaladas com `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`, preservando o lockfile.

- `VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build`: passou; inclui TypeScript.
- `npm run lint`: terminou sem erros, com avisos existentes; não foram corrigidos nesta tarefa.
- `node scripts/painel/testar.mjs`: 20 de 20 casos passaram.
- `node scripts/extrato/testar.mjs`: 54 de 54 casos e 2 de 2 pistas passaram.
- `node scripts/invest/testar.mjs`: 27 de 27 casos passaram.
- Demonstração em Chromium: tela de metas e dados fictícios renderizados; falha de gravação reproduzida como descrito acima.
  Houve erros de recursos/rede no console; não foi declarado que todos os recursos externos funcionam.

Os 101 casos existentes passaram, mas não cobrem os dois cenários relatados. Nenhuma operação foi feita no banco real.
Os scripts temporários da investigação ficaram em `/tmp`; os passos relevantes estão descritos aqui para não depender deles.

### 14/11/2026 — GPT/Codex — Documentação para continuidade entre IAs

**Estado:** documentos criados/alterados localmente; sem commit, push ou publicação pelo GPT/Codex nesta entrega.

- Criado `GPT.md` com instruções de manutenção, achados, evidências e pendências.
- Acrescentada uma seção no início do `CLAUDE.md` orientando o Claude a ler este documento antes de trabalhar.
- Verificação desta entrega: revisão do diff e conferência dos caminhos citados. Não houve mudança de código executável;
  os resultados dos testes acima pertencem à análise anterior, não a uma nova execução para esta edição de documentação.

### 14/11/2026 — GPT/Codex — Correções de metas e histórico de faturas

**Estado:** implementado e validado localmente. Sem commit, push, migração, acesso ao banco real ou publicação.
A instrução do usuário para não publicar foi preservada.

#### Metas: implementação

- `src/lib/useDados.ts`: `addMeta`, `updMeta` e `addMovimentoMeta` agora retornam `Promise<boolean>`.
  Falhas retornam `false` e continuam usando o aviso/recarregamento existentes. A edição atualiza a lista local
  somente depois da confirmação do banco, evitando mostrar como gravado um valor rejeitado.
- `src/pages/Metas.tsx`: os dois formulários aguardam a gravação e só fecham com sucesso. Falha ou exceção mantém
  campos preenchidos e mostra uma mensagem local traduzida já existente ("Não deu certo. Tente de novo.").
- Um bloqueio síncrono com `useRef` impede submissões repetidas antes de o React atualizar a tela; `salvando`
  desabilita o botão e mostra "Salvando…". O bloqueio é liberado em `finally`, permitindo nova tentativa após erro.
  Durante o envio, o fechamento por Escape, botão de fechar, fundo ou cancelar é bloqueado pelo callback do modal;
  os botões de exclusão também ficam desabilitados para não concorrer com uma edição pendente.
- Não foram criados textos novos nem alteradas regras de cálculo ou tabelas do banco.
- Limite: isso evita repetição de envio na mesma instância do formulário; não implementa idempotência no servidor
  para o caso de uma gravação efetivada cuja resposta se perca na rede.

#### Cartões: implementação

- `src/lib/useCartoes.ts`: a consulta de `faturas_pagas` passou a usar o helper existente `lerTudo`, que lê páginas
  de 1.000 registros até terminar. A ordenação é `ano`, `mes`, `id`; o último campo desempata a ordem entre páginas.
- A consulta de uma linha usada para verificar a presença das colunas da migração 9 continua separada.
- Não houve alteração de formato de dados, dependências ou lockfile.

#### Teste de regressão adicionado

Arquivo: `scripts/app-de-demonstracao/testar-correcoes.cjs`. Usa o app compilado, o servidor falso e dados fictícios,
com Playwright; falhas HTTP são interceptadas no navegador. Não depende dos scripts temporários da análise inicial.

Cenários executados:

1. Criar meta com requisição pendente: botão desabilitado, Escape não fecha e um segundo evento de submit não
   cria outra requisição. Após HTTP 503, o nome permanece preenchido, o modal continua aberto e nada foi gravado.
   Retirar a falha e reenviar fecha o formulário e cria exatamente uma meta.
2. Editar meta: HTTP 503 preserva o modal e o registro anterior; nova tentativa grava a edição.
3. Guardar e retirar: HTTP 503 preserva valor e observação e não cria movimento; nova tentativa cria um único
   movimento com sinal correto e fecha o formulário.
4. Histórico de 1.002 faturas: verifica a requisição com offset 1.000 e ordenação estável. Um pagamento e uma
   renegociação na segunda página são reconhecidos visualmente como "Paga" e "Renegociada".
5. Nenhum `PAGEERROR` nos dois fluxos de navegador. Recursos externos não fazem parte dessas verificações.

#### Validações desta correção

Executadas em `/workspace/cigarros-finance`:

```bash
VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/app-de-demonstracao/testar-correcoes.cjs
npm run lint
node scripts/painel/testar.mjs
node scripts/extrato/testar.mjs
node scripts/invest/testar.mjs
```

- Build e TypeScript: passaram.
- Regressões no Chromium: ambos os grupos (metas e faturas) passaram.
- Lint: terminou sem erros; permanecem os avisos anteriores em outros trechos do projeto.
- Painel: 20/20; extrato: 54/54 e pistas 2/2; Invest: 27/27.
- Diff revisado; arquivos de configuração e documentação anteriores preservados.

O Android compartilha esses arquivos TypeScript, mas um APK já instalado não recebe estas correções automaticamente.
Não foi gerado nem assinado um pacote Android nesta tarefa.

### 14/11/2026 — GPT/Codex — Publicação autorizada

O usuário autorizou expressamente publicar as correções e a documentação, substituindo a instrução anterior
para mantê-las locais. Não há alterações de banco ou pacote Android nesta publicação.

- Os testes registrados na correção continuam válidos: não houve mudança no código da aplicação desde então.
- `git fetch origin claude/practical-mccarthy-qt2qoa` confirmou produção em `11b11ae`, sem novos commits
  a integrar antes do envio.
- Correções e documentação enviadas ao branch `codex/corrige-metas-faturas`: commit
  `0df89c447a6cb0e6451195c076f83360e083ab9b`, confirmado por `git ls-remote` após o push.
  Uma atualização posterior deste registro documenta o resultado do envio e a tentativa de PR.
- A API do GitHub (`api.github.com`) e a conferência do site (`www.opuscash.com.br/versao.json`) retornaram bloqueio
  da rede do ambiente. O acesso Git ao origin funcionou. Isso ainda não confirma acesso à API nem publicação.
- Foram adicionados ao rascunho de rede os domínios `api.github.com` e `www.opuscash.com.br`, preservando
  `cdn.sheetjs.com`; aplicar as configurações é necessário para tentar abrir/mesclar o PR e verificar o site.
- A tentativa de `gh pr create` com base em `claude/practical-mccarthy-qt2qoa` foi bloqueada:
  `Post https://api.github.com/graphql: Forbidden`. Nenhum PR, merge ou deploy foi confirmado.
  Não considerar a correção publicada só porque há commit.
- Próximo passo: aplicar as liberações de rede nas configurações do ambiente, depois abrir/mesclar o PR,
  acompanhar o deploy e conferir o commit em `/versao.json`. O rascunho salvo requer revisão/salvamento
  nas configurações e publicação do ambiente; isso é distinto de publicar o site.

### 14/11/2026 — Claude — Login, Pix reembolsado e painel de suporte

**Estado:** publicado (site, Supabase e painel de suporte), exceto o item pendente do Stripe abaixo.
Registro feito em 15/11/2026, depois do trabalho; os commits citados já estavam na produção quando o Codex começou.

- **Sair só neste aparelho** (PR #172): `supabase.auth.signOut()` saía de todos os aparelhos por padrão.
  Os botões Sair do painel (`components/Painel.tsx`) e da assinatura (`components/Assinatura.tsx`) passaram a usar
  `scope: 'local'`. Excluir a conta continua saindo de tudo. O app Android ainda tem o Sair antigo até uma versão nova.
- **Pix reembolsado tira os 30 dias** (PR #173): o `stripe-webhook` ignorava o reembolso. A migração 34
  (`supabase/migracao-34-pix-reembolsado.sql`) criou `pagamentos_pix.estornado_em` e `estornar_pix(sessao)`, que tira os
  dias uma vez só por pagamento. O webhook passou a ouvir `charge.refunded`, e só o reembolso total mexe no acesso.
  A migração foi aplicada e o webhook publicado (versão 7) pelo Claude. A conta de teste do dono teve os dias tirados à mão.
- **Painel de suporte** (repositório `painel-opus-cash`, PRs #21 e #22): saiu a saída automática depois de 30 minutos parado;
  o login vencido agora é renovado antes de deslogar; o Sair passou a valer só para o aparelho. Reembolsar um Pix pelo
  painel chama `estornar_pix`. A função `admin` foi publicada no Supabase (versão 10).
- **Pendente (dono):** adicionar o evento `charge.refunded` ao webhook no painel do Stripe. Sem isso, um reembolso feito
  direto no Stripe não tira os dias (o feito pelo painel tira).

### 15/11/2026 — Claude — Revisão das correções de metas e faturas do GPT/Codex

**Estado:** revisado sem erros encontrados; nenhuma mudança no código do Codex.

- Lido o diff de `11b11ae` até `1ae7180`: `src/lib/useDados.ts`, `src/pages/Metas.tsx`, `src/lib/useCartoes.ts`,
  o teste `scripts/app-de-demonstracao/testar-correcoes.cjs`, o README da demonstração e o `CLAUDE.md`.
- Conferido: `addMeta`, `updMeta` e `addMovimentoMeta` só são chamadas pelos formulários corrigidos; os textos
  "Salvando…" e "Não deu certo. Tente de novo." já têm `en` e `es`; `faturas_pagas.id` existe (migração 8) e serve de
  desempate; `lerTudo` devolve o mesmo formato `{ data, error }` que a consulta antiga, então o tratamento de erro segue igual.
- Procurado o mesmo problema das 1.000 linhas em outras consultas: as tabelas que crescem já usam `lerTudo`; as que não
  usam (bancos, categorias, metas, dívidas, contas do mês) ficam bem abaixo desse limite por pessoa.
- Validações executadas pelo Claude: `npx tsc -b` passou; `npm run lint` sem erros (só avisos antigos); build com
  Supabase fictício passou; painel 20/20; extrato 54/54 e pistas 2/2; Invest 27/27; `testar-correcoes.cjs` no
  Chromium passou (metas com falha e nova tentativa, envio duplicado bloqueado, 1.002 faturas).
- Publicação: veja a entrada seguinte.

### 15/11/2026 — Claude — Publicação das correções do GPT/Codex

**Estado:** publicado no site. O app Android ainda não recebeu (precisa de versão nova).

- PR #174 (branch `claude/modest-maxwell-wbm7jl` → `claude/practical-mccarthy-qt2qoa`) mesclado por squash: commit
  `de49acbadde8f9a373b51cb3666688a2a6e2f65f`. Antes do merge, a produção estava em `11b11ae`, sem nada a integrar, e o conteúdo
  mesclado foi conferido igual ao revisado (`git diff` vazio).
- Vercel: deploy de produção `dpl_9RVcQGQqYU1KBLNWaQFeUYkZmdmL` do commit `de49acb` em `READY`, com os endereços
  `www.opuscash.com.br` e `opuscash.com.br`. O `versao.json` não foi conferido: a rede do ambiente do Claude bloqueia
  o site; a confirmação veio da Vercel.
- Sem migração. Com isso, as pendências "Metas" e "Cartões" da análise de 14/11 estão resolvidas e publicadas no site.


### 15/11/2026 — Claude — Motor do OpusCash: a câmera entra na tela e a esfera vira rede neural

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a abertura da seção "O motor do OpusCash" (a tela do Consultor virando quadradinhos) não agradou, e a
  esfera dourada "parecia feita por IA". Ele pediu a câmera entrando na tela, como num espaço 3D, até chegar no algoritmo
  que roda atrás dela, e um desenho com cara de rede neural.
- `src/pages/algoritmoConsultor.ts`: as peças da foto do Consultor agora têm profundidade (o que está dentro dos cartões na
  frente, os cartões no meio, o fundo atrás). `mergulho(desm)` dá a abertura das camadas, a posição da câmera e o olhar de
  lado; `desenharConsultor` desenha tudo em perspectiva a partir do meio da tela, com um corredor de molduras até a rede.
- `src/pages/Algoritmo.tsx`: a esfera, os anéis, os arcos e o bokeh saíram. No lugar, uma rede em camadas (`REDE`: 110 nós,
  fios só entre camadas vizinhas), com ondas de sinal da entrada para a saída (`forca`, `pulso`), um quadro fino por camada e
  os fragmentos como poeira que anda pelos fios. Os lançamentos lidos do extrato entram pelos nós da primeira camada. As
  cenas do gráfico e da tela final seguem iguais.
- Validação: `npx tsc -b` e build com Supabase fictício passaram; `npm run lint` sem erros; fotos no Chromium (computador
  1440×860 e celular 390×844) em toda a rolagem, sem erro de página.

### 15/11/2026 — Claude — Abertura do motor sem moldura e sem recortes quadrados

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a tela do Consultor no começo da seção aparecia numa moldura dourada (um recorte feio); e, no zoom,
  cada peça vinha num quadrado (o recorte levava o fundo junto, mais as linhas douradas em volta de cada cartão e do
  corredor). Ele quer a tela plana, combinando com a página, e os elementos soltos, puros, com sombra e luz.
- Fotos (`scripts/motor/capturar-consultor.cjs`): os blocos (`-b.webp`) e as peças (`-p.webp`) agora saem com
  transparência de verdade, calculada de duas fotos da mesma camada, sobre preto e sobre branco (quinas redondas,
  sombras e brilhos inteiros). Saíram a foto inteira (`-a.jpg`) e os blocos opacos (`-b.jpg`); a tela parada é montada
  com as mesmas camadas do mergulho, então não há salto quando ela abre.
- `src/pages/algoritmoConsultor.ts`: cada ponto da foto pertence ao recorte mais perto (`dividir`), e cada bloco ou peça
  vira um desenho próprio, sem nada em volta. As beiradas se apagam na página: o fundo bem devagar, os cartões só na
  borda (mais embaixo, onde a foto corta a tela). Cada cartão faz sombra no fundo, deslocada pela luz conforme a
  distância. Saíram as linhas douradas dos cartões, as molduras do corredor e as quinas. O título e a frase dele ficam na
  mesma profundidade (não se cruzam mais).
- `src/pages/Algoritmo.tsx`: saíram o halo e o contorno dourados em volta da tela.
- Validação: `npx tsc -b` e build com Supabase fictício passaram; `npm run lint` sem erros; fotos no Chromium
  (1440×860 e 390×844) em toda a abertura, sem erro de página.

### 15/11/2026 — Claude — Motor: as linhas lidas viram cubinhos coloridos, e os cubinhos viram o gráfico

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: (1) a passagem da rede para o gráfico parecia uma troca de cena, e não os quadradinhos formando o
  gráfico; (2) a rede tinha quadros quadrados em volta de cada camada; (3) o PDF e a planilha eram pequenos e laranja, e
  as linhas lidas viravam um cartão em vez de as letras entrarem na rede. Ele pediu: o texto sai do documento, entra num
  fio da rede, corre por ele e se desfaz em cubinhos (verde o que entrou, vermelho o que saiu, amarelo as dívidas,
  diferente do laranja); os cubinhos viram o gráfico, que se firma como a tela final e depois volta a ser cubinhos.
- `src/pages/algoritmoDocs.ts`: documentos brancos, maiores (desenhados numa largura base e ampliados), sem brilho
  laranja; cada linha tem um tipo (`entrada`, `saida`, `divida`), com uma dívida em cada documento. `desenharTextos`
  desenha o texto limpo de cada linha (nome e valor, na cor do tipo) e sorteia pontos nas letras dele.
- `src/pages/Algoritmo.tsx`: cada linha tem um caminho de fios (`CAMINHOS`) e um relógio (`linhaT`). O texto sai da linha
  numa plaquinha escura, voa até um nó da entrada e corre por três fios, que acendem na cor dele; as letras se apagam da
  esquerda para a direita e, no lugar de cada uma, nascem os cubinhos dela (os coloridos só existem depois disso).
  70% dos cubinhos são coloridos e cada um já tem a sua coluna no gráfico (mês e série: entrou, saiu, dívidas), por isso a
  cor não muda no caminho. Eles sobem da rede num arco e enchem cada coluna de baixo para cima; depois uma linha de luz
  passa da esquerda para a direita e as colunas viram caixas 3D sólidas (`desenharGrafico`: faces com luz, chão, meses,
  média tracejada, legenda); antes da tela final ela passa de novo e as colunas voltam a ser cubinhos. Os quadros e as
  quinas das camadas da rede saíram.
- Tradução nova: "Empréstimo pessoal" (`en`, `es`).
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) em toda a rolagem da seção, sem erro de página; `extrair.cjs --faltando`: 0 textos sem tradução.

### 15/11/2026 — Claude — Motor: o texto anda numa esteira e o gráfico é feito de pilhas de quadradinhos

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: (1) o texto das linhas lidas flutuava preso a um ponto; ele quer o texto deitado sobre o fio,
  deslizando como numa esteira; (2) no gráfico os quadradinhos ficavam soltos por cima das colunas; ele quer as colunas
  feitas de quadradinhos empilhados, que viram o gráfico bonito e, quando a luz passa de novo, revelam que eram a pilha
  e se desfazem.
- Esteira (`src/pages/Algoritmo.tsx`): a cada quadro, cada linha ganha um caminho na tela (`eX`, `eY`, `eS`): começa
  embaixo do papel, sai pela borda direita (no celular, pela de baixo), faz uma curva suave até o nó da entrada na mesma
  altura da linha (`CAMINHOS`) e segue de fio em fio. O texto é desenhado letra por letra (`TextoLido.glifos`, em
  `algoritmoDocs.ts`), cada uma no ponto do caminho onde está e virada na direção dele; cada letra só aparece quando passa
  a borda do papel. No meio do primeiro fio (`sCorte`) as letras se apagam e ali nascem os cubinhos delas, que seguem pela
  esteira e vão para o lugar deles na rede. Saíram a plaquinha escura e o texto em pé.
- Gráfico: cada coluna é uma pilha de quadradinhos de `CUBO` de lado, dois por camada (`LUGARES`); os cubinhos coloridos
  são exatamente esses lugares (o total de cubinhos passou a ser as pilhas mais a poeira dourada). Eles chegam camada por
  camada, de baixo para cima, encaixados. A coluna firme tem a altura exata da pilha, e os quadradinhos ficam na frente
  dela, então a luz que firma e a que desfaz trocam uma pela outra no mesmo lugar.
- A rede é feita dos mesmos quadradinhos (pedido no mesmo dia, depois de ver as linhas da rede ainda ao fundo
  enquanto os cubinhos iam para o gráfico): os fios são desenhados como fileiras de quadradinhos (tracejado de pontas
  retas) e os nós como quadradinhos. Cada fio e cada nó sai da rede junto com o primeiro cubinho dele que vai para o
  gráfico (`saidaFio`, `saidaNo`, calculados em `medir` a partir do `atraso` dos cubinhos); não sobra linha atrás.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) na leitura, na rede, na passagem para o gráfico e no gráfico, sem erro de página; `extrair.cjs --faltando`: 0.

### 15/11/2026 — Claude — Abertura do motor: a câmera atravessa a fresta entre os cartões

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: na abertura, a tela do Consultor ficava transparente e o fundo escurecia; ele quer a tela inteira,
  como ela é, e a câmera passando pela fresta entre o cartão "Quando cada dívida acaba" e o "Com dívidas pesando", com o
  algoritmo aparecendo só do outro lado. Também: tirar o quadrado em volta do emblema de "Com dívidas pesando" e
  suavizar a passagem do azul do painel para o preto.
- `scripts/motor/capturar-consultor.cjs`: o mapa ganhou `fresta` (entre o cartão acima de `.an-perfil` e ele); fotos
  refeitas nos seis aparelhos/idiomas.
- `src/pages/algoritmoConsultor.ts` reescrito: a tela é uma imagem só (fundo, blocos e peças das camadas transparentes,
  na densidade da foto), com a fresta tirada do fundo. O mergulho aumenta a tela por potência de E (o quanto ela precisa
  crescer para a fresta ocupar a cena) até `ATRAVESSA`; depois a câmera segue até a rede. Só a parte da foto que cabe na
  cena é desenhada; perto da fresta entra uma faixa de um ponto de largura tirada da foto, esticada sem suavizar, para as
  bordas dos cartões ficarem nítidas. Saíram as profundidades por peça, as sombras e a transparência. O quadrado do
  emblema era a luz dele recortada como peça solta, maior que o cartão; com a tela inteira ela fica cortada pelo cartão,
  como no app.
- `src/pages/Algoritmo.tsx`: o meio da fresta vai do lugar dele na tela para o meio da rede enquanto a câmera chega; a
  rede fica atrás da fresta. A cena é pintada com a cor do painel (`COR_PAINEL`) enquanto a câmera chega e escurece aos
  poucos depois de atravessar.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) em toda a abertura, sem erro de página.

### 15/11/2026 — Claude — Abertura do motor: a fresta escurece, o túnel de dados e a rede nas costas da tela

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a fresta já aparecia como um retângulo preto, com o algoritmo visível, antes do zoom. Ele quer a tela
  normal, a fresta escurecendo conforme a câmera chega; do outro lado, passar por dentro de um "túnel" de informação
  (as linhas do extrato viajando e virando dados); e depois a câmera sair e mostrar por fora que o motor está instalado
  nas costas da tela, preso nela como uma teia.
- `src/pages/algoritmoConsultor.ts`: a fresta não é mais aberta na foto. Ela escurece (`desm` 0,1 a 0,36) com uma luz
  quente pequena lá dentro (do tamanho de uma luz no fundo; some antes de a câmera passar). `ATRAVESSA` passou a 0,42;
  `mergulho` virou `aumento` (só o tamanho da tela).
- `src/pages/Algoritmo.tsx`: `desenharTunel` (de `ATRAVESSA` a ~0,8): anéis de quadradinhos dourados e trilhos tracejados
  entre eles vindo da escuridão; nas paredes, as linhas lidas (nome e valor, na cor do tipo), que perto da câmera se
  desfazem em cubinhos. Depois a câmera sai: a rede aparece de perto (zoom extra que volta a 1) e `desenharCostas` mostra
  atrás dela as costas da tela (um painel da cor do painel com a tela espelhada, bem apagada) e a teia: de 24 pontos das
  costas saem fios até nós da rede, que crescem até eles, com dados correndo. As costas somem quando o documento chega.
  A rede fica escondida até essa saída (`oculto`); a câmera da cena 0 olha um pouco de lado e de cima (`CAM[0]`) para as
  costas aparecerem em perspectiva.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) em toda a abertura, sem erro de página.

### 15/11/2026 — Claude — Abertura do motor: o túnel é um fio de verdade e a câmera sai dele sem corte

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: no túnel, os nomes flutuavam; eles têm que andar deitados nos trilhos (como na esteira da rede) e
  virar quadradinhos. E a saída era uma troca de imagem para a tela de costas; ele quer uma câmera de verdade, que sai de
  dentro e pega o sistema por fora, mostrando tudo ligado nas costas da tela (que depois some).
- `src/pages/Algoritmo.tsx`: câmera livre no `proj` (posição, direções e foco; o que fica atrás dela não é desenhado). Na
  cena 0, de `ATRAVESSA` a `SAI` (0,72) ela anda dentro do fio que liga a fresta (nas costas da tela, `Z_COSTAS`) ao nó
  da entrada mais perto da altura dela (`tubo`); de `SAI` a 1 ela gira e se afasta até a câmera de sempre (yaw, pitch e
  distância F; em desm = 1 as duas coincidem, então a cena seguinte não salta). O túnel é desenhado em 3D em volta desse
  fio: anéis de quadradinhos e trilhos; as linhas lidas andam nos trilhos letra por letra, cada letra deitada na parede
  (comprimento ao longo do fio, altura ao longo do anel, sem espelhar), mais rápido que a câmera; num ponto fixo perto
  da rede (80% do fio) cada letra vira cubinhos, que seguem pelo trilho. Saindo, os anéis somem e o fio fica um fio da
  teia das costas da tela (`desenharCostas` liga a fresta ao nó). Fios e nós atrás da câmera não são desenhados.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) em toda a abertura, sem erro de página.

### 15/11/2026 — Claude — Abertura do motor: túnel de linhas, saída sem travar e a tela na ponta da rede

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: dentro do túnel as paredes eram quadradinhos (o fio da rede é feito de linhas, e as letras andam nelas);
  a saída da câmera travava; e a vista de fora era confusa (a tela de costas atrás, a rede de lado na frente).
- `src/pages/Algoritmo.tsx`: o túnel são 16 linhas contínuas ao longo do fio (mais fracas longe), e cada linha lida anda
  em cima de uma delas. A tela do Consultor agora fica presa na ponta da entrada da rede (`X_TELA`, girando com ela):
  a vista de fora se lê da esquerda para a direita, tela → fios → rede. Vista de frente, a tela aparece inteira e os
  fios saem de trás dela; vista por trás (o caso da câmera de sempre), aparece pelo vidro (espelhada, suave) com a teia
  presa nela por cima. A fresta e o fio do túnel saem da tela nesse lugar. Na saída, a câmera primeiro recua ao longo do
  fio e depois gira (não atravessa mais a rede). Na cena 0, a rede fica mais à direita (`desX0`), com zoom menor
  (0,75; no celular, ainda mais longe), para a tela caber.
- Desempenho (Chromium sem placa de vídeo, 1440×860): a saída tinha quadros de 50 ms; a tela em perspectiva passou a usar
  uma miniatura feita uma vez só (`miniatura`) e os brilhos dos nós e dos cubinhos têm tamanho máximo (perto da câmera
  ficavam enormes). Agora 17–33 ms, como no resto da seção.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) em toda a abertura, sem erro de página.

### 15/11/2026 — Claude — Abertura do motor: túnel mais longo, letras legíveis e paredes de quadradinhos

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: dentro do túnel as letras passavam rápido demais e se desfaziam sem dar para ver; as paredes eram
  linhas lisas, diferentes dos fios da rede vistos de fora (fileiras de quadradinhos).
- `src/pages/Algoritmo.tsx` e `algoritmo.css`: a seção cresceu (700vh → 820vh; celular 660vh → 780vh) e a abertura fica
  com 32% da rolagem (`ABERTURA`; `porCena` e `daRolagem` convertem entre a rolagem e o andamento por cena, que o
  desenho continua usando em quintos). `desm` passou a ser linear (o smoothstep deixava o meio, o túnel, mais rápido).
  `ATRAVESSA` 0,3 e `SAI` 0,8: o túnel tem metade da abertura. As paredes são fileiras de quadradinhos em perspectiva
  (a cada 5 unidades, 16 em volta) sobre uma linha fraca, como os fios da rede. Cada linha lida entra logo atrás da
  câmera na sua vez e escorrega, desacelerando, até passar pelo corte; o corte fica a 62 unidades à frente da câmera e as
  letras viram cubinhos ao longo de uma faixa (cada pedacinho na sua vez), não num ponto.
- `src/pages/algoritmoConsultor.ts`: os tempos da fresta (escurecer e a luz) acompanharam o novo `ATRAVESSA`.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) da abertura e das outras cenas, sem erro de página; quadros do túnel em 17 ms.

### 15/11/2026 — Claude — Abertura do motor: o fio do túnel bem mais longo

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: o texto ainda sumia rápido demais; ele pediu esticar o túnel, com o fim dele mais longe.
- `src/pages/Algoritmo.tsx`: a tela do Consultor não fica mais logo antes da entrada da rede, e sim longe e mais para o
  fundo (`TELA_C`), virada de costas para a entrada (`TELA_D`; o fio sai reto das costas dela). O fio do túnel passou de
  ~330 para ~900 unidades, e de fora tudo cabe na cena (posição achada calculando a projeção da tela e da rede). As
  linhas lidas entram a cada 0,042 do túnel e levam 0,58 dele para escorregar até o corte (95 unidades à frente da
  câmera, numa faixa de 80). A abertura ficou com 38% da rolagem (`ABERTURA`) e `SAI` 0,83. Dentro do túnel a lente é
  a dele (foco sem o zoom da cena), passando para a da vista de fora durante a saída. A vista de fora olha mais de lado
  (`CAM[0]`: yaw 0,45). A tela só some depois que a câmera termina de sair.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) da abertura, sem erro de página; quadros do túnel em 17 ms.

### 15/11/2026 — Claude — Abertura do motor: o túnel é a própria teia (não um tubo a mais)

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Problema apontado pelo Edigar: o túnel era um tubo de trilhos à parte, e ao sair dele aparecia a teia de verdade (os
  fios da tela até a rede) ao lado, como "um túnel dentro do túnel". Ele quer reaproveitar o que já existe.
- `src/pages/Algoritmo.tsx`: saiu `desenharTunel`. A teia (`fiosTeia`, `montarTeia`) são 31 fios: 30 pontos das costas
  da tela, cada um ligado ao nó da entrada na posição correspondente (o de cima no de cima; o lado escolhido é o que
  deixa os fios mais curtos), sem se cruzar, formando um funil; mais o fio da fresta. A câmera atravessa a fresta e anda
  pelo meio desse funil (da fresta para o meio da camada de entrada): os fios são as paredes do túnel. `desenharTeia`
  desenha cada fio como uma linha fraca com quadradinhos em perspectiva (a cada 10 unidades; 18 quando o fio está longe,
  para pesar menos) e dados correndo; é a mesma coisa por dentro e por fora. As linhas lidas (`desenharLinhasNaTeia`)
  andam em cima dos fios, letra por letra na direção deles, e viram cubinhos numa faixa à frente da câmera. A tela
  (`desenharTelaNaRede`) só aparece quando a câmera sai; vista por trás, os fios ficam por cima dela.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium (1440×860 e
  390×844) da abertura, sem erro de página; quadros em 17 ms (picos de 33–50 ms na saída, no Chromium sem placa de vídeo).

### 15/11/2026 — Claude — Motor do OpusCash no modo claro

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a seção "O motor do OpusCash" ficava escura e com a tela do Consultor escura também no modo claro.
- Como foi feito: o desenho do motor é luz somada sobre o escuro; no claro, o canvas é invertido pelo CSS
  (`invert(1) hue-rotate(180deg)`, `algoritmo.css`): o dourado vira dourado escuro sobre creme, no mesmo tom. O que
  precisa aparecer com a cor de verdade é desenhado já compensado (`paraClaro` e `canvasParaClaro` em
  `algoritmoConsultor.ts`: 255 − H·c, sendo H o hue-rotate de 180°; o CSS desfaz). Compensados: a foto da tela do
  Consultor, a faixa nítida da fresta e a cor do painel; o papel do PDF e da planilha; as cores de cada tipo (textos,
  esteiras, cubinhos, colunas e legenda do gráfico, a luz que lê os documentos). O amarelo puro não sobrevive à
  inversão (sai bege): no claro as dívidas são amarelo-mostarda (`MOSTARDA`). A tela final do Consultor fica invertida
  (creme com âmbar), de propósito.
- Fotos: `scripts/motor/capturar-consultor.cjs` também tira as do tema claro (`-claro` no nome); a abertura carrega as
  do tema da página. As do escuro foram refeitas junto (iguais na prática).
- CSS: no claro, o fundo da seção é creme, os textos escuros e as etiquetas, o contador, os selos e o véu atrás do
  texto têm versões claras. Trocar o tema com a página aberta refaz fotos, documentos e cores (MutationObserver).
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844), sem erro de página.

### 15/11/2026 — Claude — Motor no modo claro: estúdio grafite depois da fresta

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: no claro, o motor invertido (preto com laranja sobre creme) ficou feio; ele quer que, ao atravessar
  a fresta, escureça num tom equilibrado, como o fundo dos cartões dos fundadores no claro.
- Agora, no claro, só a abertura (a tela do Consultor até a fresta) usa a inversão com a tela compensada. Da fresta em
  diante a seção ganha a classe `ag-estudio` (posta pelo componente quando `desm` passa de `ATRAVESSA`): o fundo vira o
  grafite-azulado dos fundadores (`#343b49`, luz no meio, azul e verde-água nas laterais; `algoritmo.css`), o canvas
  deixa de ser invertido e o motor é desenhado como no escuro (dourado, papel branco, verde/vermelho/amarelo). Na hora da
  troca a fresta já está pintada no grafite (`desenharConsultor` recebe `corFresta`), então não há emenda; no fim da seção
  o grafite volta para a cor da página pelo degradê do fundo.
- Saíram as compensações que não são mais usadas (paleta, gráfico, documentos e o amarelo-mostarda do claro). A tela
  presa na rede usa a foto como é (`iaVista`, `corFundoVista`), já que o estúdio não é invertido.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844), sem erro de página; o escuro continua igual.

### 15/11/2026 — Claude — Motor no modo claro com paleta própria (sai a inversão e o estúdio)

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: o estúdio grafite (e o cartão final marrom-escuro) ainda era um tema escuro; ele quer um modo claro
  de verdade, com cores bonitas e realçadas.
- Saíram a inversão por CSS, as compensações (`paraClaro`, `canvasParaClaro`) e o estúdio (`ag-estudio`). O motor tem
  uma paleta por tema (`paleta` em `Algoritmo.tsx`, trocada junto com o tema): no escuro, a de sempre (luz dourada
  somada, 'lighter'); no claro, cores por cima do fundo claro ('source-over'): rede, teia e túnel no azul e verde-água da
  marca, poeira de dados do azul ao verde-água (`TONS_CLARO`), cores de cada tipo mais fortes (`CORES_GRAF_CLARO` e
  `COR_TIPO_CLARO`: verde, vermelho e âmbar), cubinhos sem clarear para o branco (`PALETA_CLARO`), gráfico, legenda,
  meses, linha de luz e média nas cores do claro. A fresta clareia em vez de escurecer, com brilho azul.
- `algoritmoTela.ts`: a tela final do Consultor tem as duas versões (`CORES`): no claro, vidro branco, texto escuro, nota
  e números no verde-água e azul, pilares em cores fortes.
- `algoritmoDocs.ts`: o texto das linhas lidas no claro tem o nome escuro e o valor na cor forte do tipo.
- `algoritmo.css`: no claro, o fundo da seção é claro com toques de azul e verde-água, e as peças em HTML (rótulo,
  trilho, etiquetas, contador, selos, véu) seguem a marca.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844), sem erro de página; o escuro continua igual.

### 15/11/2026 — Claude — Motor: o túnel por dentro, o modo claro e o celular

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a cena de dentro (a câmera no meio da teia) não agradava; o claro continuava feio; no celular a
  cena de dentro não estava boa. Ele pediu para pegar o que existe e melhorar, não trocar.
- Problema visto nas fotos: por dentro, os 31 fios pontilhados se juntavam num único ponto, como um asterisco branco,
  sem parede nem profundidade. No celular, os fios passavam por cima do título e o texto das linhas andava em pé.
- `src/pages/Algoritmo.tsx`, `desenharTeia` (ganhou `dentro`, de 0 a 1): cada fio é uma linha mais fina e mais fraca
  quanto mais longe (`P.tunel`, quatro níveis); os quadradinhos de longe somem na névoa; por dentro há costelas (30
  voltas pela beirada do feixe, `BEIRADA`), poeira parada no ar (`POEIRA`), três sinais por fio com rastro e a luz no fim
  do túnel. Os fios do miolo do feixe viram um risco fino (as linhas lidas continuam andando neles). A câmera vai para o
  eixo do funil logo depois da fresta, então as paredes ficam em volta dela. A rede já aparece apagada no fim do túnel
  (`oculto`).
- Celular: do mergulho até a saída do túnel a cena ocupa a tela inteira (`--imerso` no `.ag-sticky`: o texto e o véu
  somem, `algoritmo.css`), o ponto de fuga vai para o meio da tela e as linhas lidas usam só os fios das laterais
  (`FIOS_DEITADOS`), onde o texto anda deitado.
- Claro: túnel em azul até azul-marinho (`tunel`, `tunelQuad`), fios e poeira da rede mais fortes (`TONS_CLARO`,
  `fioFundo`, `fioFrente`) e nós com fundo branco e contorno azul (`noFundo`). O escuro da rede não mudou.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844) da abertura e das outras cenas, sem erro de página. Fluidez do movimento não foi medida.

### 16/11/2026 — Claude — Motor: por dentro do túnel, as camadas do que está por trás do conselho

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: a cena de dentro continuava sem agradar. Diagnóstico combinado com ele: o túnel não mostrava nada
  (o título promete "por trás de cada conselho" e a cena entregava fios). Ele aprovou trocar o vazio por camadas, com
  duas condições: tudo feito de quadradinhos que se juntam e formam as coisas, e nada de imagem entrando por cima.
- `src/pages/algoritmoCamadas.ts` (novo): três camadas, na ordem em que a câmera passa: os lançamentos do mês (as linhas
  de `LIDAS_PDF`), as dívidas (quanto já foi pago e quando acabam) e as contas do motor (42% em parcelas, 8% guardado,
  R$ 1.937 de sobra, os mesmos números da tela do Consultor). Cada camada é desenhada uma vez num quadriculado pequeno
  (216×116 casas no computador, 112×196 no celular, em pé) e cada casa pintada vira um quadradinho, do tamanho da tinta
  que tem nela; a cor vai codificada no vermelho do desenho.
- `src/pages/Algoritmo.tsx`: `desenharCamadas` no lugar de `desenharLinhasNaTeia` (que saiu). Cada quadradinho nasce num
  fio da beirada do túnel, logo à frente da câmera, voa para a casa dele (a camada se escreve da esquerda para a
  direita), fica enquanto a câmera chega perto e se solta de volta para o fio, por onde corre até a rede. Uma camada de
  cada vez (`FATIAS`). O túnel fica mais apagado por dentro (`calma`), para as camadas se lerem; o ponto de fuga vai para
  o meio da área da cena enquanto a câmera está lá dentro.
- Rolagem: a abertura passou de 38% para 50% da seção (`ABERTURA`), a seção de 820vh para 1010vh (celular: 780 para 970)
  e `desm` anda em três trechos: a fresta e a saída com a rolagem de antes, o túnel com o resto. As outras cenas ficaram
  com o mesmo tamanho.
- Traduções: oito textos novos em `traducoes.json` (pt, en, es); `extrair.cjs --faltando` dá 0.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844) da abertura e da seção inteira, sem erro de página. Inglês e espanhol não foram fotografados.
  Fluidez do movimento não foi medida.

### 16/11/2026 — Claude — Motor: a rede passa a flutuar numa sala de servidores

**Estado:** veja a entrada de publicação junto com a da "sexta tela" (as duas foram feitas ao mesmo tempo e publicadas juntas).

- Pedido do Edigar: a rede flutuava no vazio, sem dar para ver em que ambiente estava. Ideia aprovada: uma sala de
  servidores, desenhada na mesma linguagem de quadradinhos (nada de rack realista, que fica com cara de banco de imagem).
- `src/pages/Algoritmo.tsx`, `desenharSala`: um corredor fixo no mundo (não gira com a rede; ela flutua dentro dele).
  `RACKS`: uma fileira de cada lado (x = ±`LADO_SALA`), em grupos de 6 com um vão, sumindo na névoa até `LONGE`. Cada rack
  é uma placa de frente para o corredor, com `GAVETAS` (as unidades do servidor) e dois LEDs na ponta de cada uma, quase
  todos apagados; uns piscam sozinhos e, cada vez que o sinal chega na saída da rede, uma onda acende os racks de perto da
  rede até o fundo. Chão em `CHAO` com grade (em faixas de névoa) e o reflexo dos nós da rede; duas faixas de luz no teto;
  uma luz fraca no fim do corredor. Cores na paleta (`P.sala`): no escuro, dourado fraco somado; no claro, racks brancos
  com LEDs azuis.
- A sala aparece quando a câmera sai do túnel (antes ela está na tela do Consultor e dentro do fio) e fica mais apagada
  na tela final.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium nos dois temas
  (1440×860 e 390×844) da saída do túnel até a tela final, sem erro de página. Fluidez não foi medida.

### 16/11/2026 — Claude — A sexta tela: o carrossel desemboca no motor sem recorte

**Estado:** commit local no branch `sexta-tela` (não publicado; o agente principal junta e publica). Só a página
inicial mudou; sem migração. Precisa de versão nova do app Android só se a página inicial for para lá também.

- Pedido do Edigar: entre o carrossel e o motor havia um recorte (o carrossel terminava, vinha uma faixa de fundo e a
  tela do Consultor surgia de baixo). Solução aprovada por ele: "a sexta tela".
- `src/pages/Apresentacao.tsx`: o progresso do palco vai de 0 a `FIM` (1,2). Até 1 é o carrossel de antes; de 1 a
  `PARA` (1,165) o cilindro gira mais um passo até a sexta face (`.td-sexta`, em `lugar(5)`), as cinco telas se
  apagam, o balanço da câmera para e o fundo, a luz e o véu viram os do motor (`--fim`); a legenda sai
  (`--fim-texto`). A câmera para de frente na face, com escala e foco calculados em `medir()` para a face cair no
  retângulo exato do motor (no plano z = 0 a perspectiva não altera nada; `cx`/`cy` em px inteiros). De `PARA` a
  `FIM` ela fica parada; na reta final o palco se apaga (opacidade do `.ap-palco-sticky`) por cima do motor, que já
  está preso embaixo dele. A opacidade usa o menor entre o scroll e o progresso desenhado: descendo rápido o palco só
  some com a câmera já parada; subindo, ele volta antes de o motor se soltar.
- `src/pages/passagem.ts` (novo): o motor publica a foto carregada (`ConsultorReal`, no tema, idioma e aparelho dele)
  e o retângulo (`realX`, `realY`, `realS`); a sexta face usa o mesmo canvas (`real.ia`, com as beiradas já apagadas)
  e a mesma máscara de cima e de baixo do canvas do motor. O carrossel pede a foto a partir da metade do palco
  (`pedirConsultor`), antes de o motor estar perto.
- `src/pages/Algoritmo.tsx`: só duas coisas — `publicarPassagem` no fim do cálculo de `realX/realY/realS` em
  `medir()` e o registro de `aoPedirConsultor`. Nada da rede, túnel, camadas, gráfico ou tela final mudou.
- CSS: `.ag` sobe 116vh por baixo do palco (`margin-top: calc(-100vh - 16vh)`, `z-index: 1`; `.ap-palco` tem
  `z-index: 2`) e o topo do fundo dela começa no breu (não aparece mais). Palco: 1180vh (celular 1084vh), as mesmas
  proporções de antes para as cinco telas. `.ap-motor` e `.ap-palco-sticky::before` copiam o fundo e o véu do motor
  nos dois temas e no celular (se mudarem em `algoritmo.css`, mudar também em `apresentacao.css`).
- Armadilha achada: a face escrevia `visibility: visible`, que aparece mesmo com o palco escondido; ficou `inherit`.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício. Chromium, fotos do fim do carrossel
  ao começo do mergulho em 1440×860 (escuro e claro), 390×844 com toque (escuro e claro), 1100×800, 1440×700 e com
  animações reduzidas (computador e celular), sem erro de página. No ponto da troca, com os dois presos, foto só do
  palco × só do motor: a face fica no mesmo retângulo (diferença < 0,02 px no `getBoundingClientRect`) e o melhor
  alinhamento entre as duas fotos é dx = 0, dy = 0 em todos os tamanhos (diferença média de 0,6 a 1,9 de 255, só
  nas bordas, pela reamostragem do canvas × textura 3D). Não conferido: inglês e espanhol, telas com
  `devicePixelRatio` > 1,5 (o canvas do motor é limitado a 1,5 e a face 3D não: pode haver diferença de nitidez, não
  de posição), troca de tema com a página parada na sexta face e celular de verdade (barra do navegador mudando a
  altura). Fluidez do movimento não foi medida.

### 16/11/2026 — Claude — Passagem sem a cópia subindo e a rede do modo claro em preto

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Bug apontado pelo Edigar: na passagem do carrossel para o motor, aparecia uma cópia da tela do Consultor subindo e
  sumindo enquanto a outra ficava parada. Causa: o palco se apagava aos poucos seguindo o progresso suavizado da câmera
  (`Math.min(p, alvo)`), que anda atrás da rolagem; rolando rápido, a página já levava o palco para cima enquanto ele
  ainda estava meio visível. Correção em `src/pages/Apresentacao.tsx`: o palco some de uma vez (`visibility: hidden`)
  assim que a rolagem de verdade (`alvo`) passa de `pPega`, quando o motor já está preso embaixo com a mesma imagem no
  mesmo lugar. Testado rolando 180px por quadro nos dois temas: uma tela só em cada quadro.
- Pedido do Edigar: no modo claro, a rede em azul não agradava; ele quis preto forte, com as cores do app se destacando
  e tingindo as linhas. `src/pages/Algoritmo.tsx`, paleta do claro: fios, nós, poeira (`TONS_CLARO`), túnel e camadas em
  tinta preta; os sinais que correm nos fios e os nós acesos levam uma das cores do app (`SINAIS_CLARO`: azul, verde,
  vermelho, laranja; cada fio e cada nó sempre a mesma), com brilho da mesma cor (`P.pontos`). No túnel os sinais também
  são coloridos. Sala do claro: traços em cinza-escuro e LEDs acesos verdes. O escuro não mudou (os sinais continuam
  dourados).
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium no claro (1440×860 e
  390×844) da abertura até a rede, e a passagem com rolagem rápida nos dois temas, sem erro de página.

### 16/11/2026 — Claude — Motor no modo claro: papel creme, nanquim e laranja

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Só a página inicial mudou; sem migração.

- Pedido do Edigar: o claro (preto com azul, verde, vermelho e laranja nos sinais) não combinava e não tinha a estética
  do escuro (laranja com preto). Diagnóstico: o escuro tem uma cor só no desenho (o dourado) e usa verde, vermelho e
  amarelo só nos dados; o claro espalhava quatro cores pela rede inteira, sobre um fundo azulado. Combinado: o claro é o
  escuro invertido.
- `src/pages/Algoritmo.tsx`: `NANQUIM` (preto quente) para fios, nós, poeira, túnel, camadas, chão e racks; `LARANJA`
  como a única cor de destaque (sinais, nós acesos, LEDs, linha da média, luz da tela final); papel creme
  (`rgb(246,240,228)`) no lugar do azul-gelo. Dados: verde, vermelho e mostarda (`CORES_GRAF_CLARO`; a dívida virou
  mostarda para não se confundir com o laranja), também em `COR_TIPO_CLARO` (`algoritmoDocs.ts`).
- `src/pages/algoritmoTela.ts`: a tela final do Consultor no claro em papel, nanquim e laranja.
- CSS: `algoritmo.css` (fundo, véu, etiquetas, rótulo, trilho, selos) e a cópia do fundo da passagem em
  `apresentacao.css` (`--motor-breu`, `.ap-motor`), para o carrossel continuar desembocando no motor sem emenda.
- O escuro não mudou.
- Validação: `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício; fotos no Chromium no claro (1440×860
  e 390×844) da abertura até a tela final, e a passagem do carrossel, sem erro de página.

### 16/11/2026 — GPT/Codex — Início detalhada no celular

**Estado:** implementação e validação locais; publicação registrada separadamente quando confirmada.

- Reorganizada a Início detalhada em resumo, indicadores, contas prioritárias, evolução, comparação,
  dívidas/contas/cartões/metas e diagnóstico. Navegação por seletor não fixo; seções recolhíveis usam
  `useArrumacao`, com resumo visível e preferência persistida. Mantidos os blocos completos e ações existentes.
- Cabeçalho e navegação inferior compactados por classe restrita à Início detalhada. Controles secundários
  ficam em Mais, incluindo idioma. Registrar abre o formulário existente; o FAB deixa de ocupar essa página.
- Resultado realizado, previsão, saldo bancário e dívida têm identificação separada. A composição original da
  previsão continua em EntenderMes, sem modificar suas regras. Removida a apresentação de um saldo de dívida
  futuro como redução garantida: o cálculo dia a dia não projeta todos os juros futuros.
- Investigação da divergência de dívidas: `dividaDiaADia` parte de `restante`, enquanto `resumoMes.divida`
  soma `restanteHoje`, incluindo `jurosAtraso`. O novo resumo, painel mensal e linha de dívidas usam a segunda
  base, com juros estimados identificados. Também alinhado o valor do anel do equilibrado a `restanteHoje`,
  sem alterar sua organização. O bloco de dívidas do simples já usa esse critério.
  Os dois valores citados pelo usuário não puderam ser reproduzidos: capturas anexadas e dados reais não
  estavam disponíveis nesta sessão. Não se inferiu nem alterou um registro para forçar coincidência.
- `Contas cadastradas a pagar` cobre somente contas fixas sem baixa; a previsão também inclui faturas,
  parcelas e lançamentos futuros. Saldo nas contas usa caixa bancário, separado de investimentos, sem
  presumir que todo dinheiro seja reserva de emergência. Diagnóstico explica essa limitação do motor existente.
- Novo `EvolucaoDetalhada`: movimentações em barras agrupadas e saldos em visualização separada, seleção
  de séries, 3/6/12 meses, seleção por toque ou seletor, valores completos e lista alternativa. Sem segundo
  eixo. Saldos futuros desconhecidos ficam em branco. Moedas adicionais mostram registros nativos sem
  conversão nova. Consulta ao saldo acumulado e edição do ponto de partida continuam disponíveis.
- Comparação detalhada mantém períodos, totais e percentuais, explicita diferença monetária, mostra cinco
  categorias e permite expandir categorias e todos os lançamentos. Metodologia fica em Como calculamos.
  Sua base de consumo (inclui compras no cartão pela parcela) difere da previsão de caixa; isso está explicado.
  Não se alterou o motor de comparação, transferências ou baixas nesta entrega.
- Diagnóstico passa a lista expansível, mantendo ações e dispensa de avisos; composição da nota 0–100
  e pesos foram conferidos em `analise.ts`. Acrescentadas traduções em inglês e espanhol.

**Validação:** TypeScript/build com Supabase fictício, lint (sem erros, avisos existentes), painel 20/20,
`testar-inicio-detalhado.cjs` no Chromium com dados fictícios. Larguras 320/360/390/430 e fonte raiz 150%/200%
sem rolagem horizontal; Registrar, consulta sem pagamento, seleção mensal, séries, alternativa textual,
recolhimento após reload e privacidade da previsão/gráfico verificados. Simples e equilibrado renderizam
suas próprias estruturas sem erros de página. Capturas em `/workspace/artifacts`; script e instruções
reproduzíveis em `scripts/app-de-demonstracao/`.

**Limites:** não foram acessados dados financeiros reais nem fornecidas capturas anexadas. Datas de atualização
individual de saldos não existem no contexto atual; a interface distingue a data do período da atualização
indisponível. Estados globais de carregamento/erro continuam com os componentes existentes, sem nova
injeção de falhas nesta validação. Não gerado pacote Android assinado, nem aplicada migração de banco.

### 16/11/2026 — Claude — Início do jeito simples reorganizada para o celular

**Estado:** implementado e validado localmente; publicação no site registrada na conversa da sessão (PR e deploy). Sem
migração. O app Android ainda não recebeu (precisa de versão nova, assinada pelo dono).

- O que mudou: a Início do jeito simples virou uma tela própria (`src/components/InicioSimples.tsx`,
  `src/components/inicio-simples.css`), na ordem: saudação curta, resultado do mês até hoje com Entrou/Saiu, previsão
  para o fim do mês ("Pode sobrar/Pode faltar", "Ver cálculo"), Registrar entrada/saída, Contas a pagar (até 3, com
  lugar guardado para a próxima a vencer), uma orientação, 3 últimos lançamentos (agendados marcados) e acessos curtos
  (gastos por categoria em janela, dívidas, metas, contas e investimentos). Rodapé "Modo simples · Alterar".
- Topo do simples no celular (`Painel.tsx`, classe `simples-movel`; CSS no fim de `src/index.css`): só mês, olho e sino;
  idioma (`BotaoIdioma emLista`), suporte, tema e menu da conta foram para o "Mais". Sem o "+" na Início do simples.
- "Paguei" com outro valor/dia saiu de `pages/Contas.tsx` para `components/FormBaixa.tsx` e ganhou a escolha do banco
  (`lancamentoDaBaixa` aceita `banco_id`). A Início usa o mesmo formulário no "Marcar como paga".
- Cálculos não mudaram: o resumo usa `comporPrevisao` (a mesma conta do "Ver cálculo"); o total das categorias é
  `r.saidas`, e a janela explica por que difere do "Saiu" do resumo no mês de hoje.
- Equilibrado e detalhado: sem mudança visível (o `BlocoParaFazer` continua em `Simples.tsx`; o `ResumoSimples` saiu).
- Validação: `npx tsc -b`, `npm run lint` (só avisos antigos), build, `scripts/painel/testar.mjs` 20/20,
  `scripts/extrato/testar.mjs` 54/54, `scripts/invest/testar.mjs` 27/27, `testar-correcoes.cjs` passou e o novo
  `scripts/app-de-demonstracao/testar-inicio-simples.cjs` 31/31. Lápis da tela Contas do mês conferido à parte.
- Limite: a alça que esconde a barra de baixo continua com 52×22 px (controle antigo, fora desta mudança).
  **Resolvido em 16/11/2026 (Claude):** no celular a alça saiu; a barra encolhe ao rolar (entrada "Celular com moldura e Início próprias").
### 16/11/2026 — Claude — Início do modo equilibrado reestruturada para o celular

### 16/11/2026 — Claude — Início do jeito simples: ajustes com as capturas reais

**Estado:** publicado no site (veja o PR e o deploy na conversa da sessão). Sem migração; o app Android ainda não recebeu.

- O dono mandou as capturas da tela antiga com os dados dele. Duas coisas que a conta de demonstração não mostrava:
  a orientação "Mercado Pago cobra juros muito altos" tinha 3 frases (o conselheiro junta "juros altos" e "a mais cara"),
  e "Mercado Pago: 6 parcelas · R$ 659,46 · venceu há 259 dias" não dizia que o valor é a soma de 6 parcelas atrasadas.
- `components/InicioSimples.tsx`: a orientação mostra as 2 primeiras frases; a linha de várias parcelas mostra o nome da
  dívida, "soma de N parcelas" e "a mais antiga venceu há N dias". `lib/paraFazer.ts`: a tarefa de dívida leva
  `divida: { nome, parcelas }` (campo novo, opcional; os outros jeitos não usam).
- Validação: `npx tsc -b`, lint, build, `scripts/painel/testar.mjs` 20/20 e `testar-inicio-simples.cjs` 33/33 (com caso
  novo de 3 parcelas atrasadas da mesma dívida e a conferência das 2 frases).
**Estado:** veja a conversa da sessão para PR e deploy. Sem migração de banco. O app Android **não** foi gerado nesta
sessão (sem Android SDK e sem a chave de upload no ambiente): precisa de versão nova com `versionCode` 12.

- Pedido do Edigar: equilibrado que permita entender o mês, ver as contas prioritárias e o que mudou desde o mês anterior,
  com pouca leitura e página mais curta; detalhes por toque. Simples e detalhado mantêm a organização própria.
- Ordem nova e regras: `docs/arquitetura-do-painel.md`, seção 4.0.2 (reescrita). Peças em `components/InicioEquilibrado.tsx`
  (`ResumoEq`, `RegistrarEq`, `ContasEq`, `ComparacaoEq`, `ComoCalculamos`, `PrincipaisGastos`, `OrientacaoEq`,
  `ResumosCompactos`, `SeletorDoJeito`) e o ramo `equilibrado` de `pages/Inicio.tsx`.
- Compartilhado com os outros jeitos (de propósito, só cromo do celular): cabeçalho com marca, mês, olho, sino e "Mais
  opções" (suporte, idioma, tema e configurações foram para o menu; `BotaoIdioma` ganhou o modo `semBotao`) e barra de abas
  mais baixa e discreta. O botão "+" flutuante só some na Início do equilibrado (lá há o "+ Registrar").
- Cálculos: nada da previsão mudou. `lib/comparacao.ts` ganhou `destaqueDaComparacao` (uma categoria, na direção do total;
  queda em "Sem categoria" vira "reclassificação", não economia), `fatiasDoPeriodo` (participação no total, mesma escala) e
  `faturaEmDobro` (pagamento de fatura lançado como saída junto com compras no cartão). `lib/paraFazer.ts`: a `Tarefa`
  carrega origem, conta, dívida, nº de parcelas, vencidas e saldo da dívida (a lista do simples não mudou).
- Divergência investigada (não é erro): o "Saiu" do resumo exclui compras em fatura aberta (estão em "A pagar"); a
  comparação e os principais gastos contam a compra na data dela. Agora isso aparece escrito no resumo e no "Como calculamos".
- "Paguei" da Início equilibrada virou "Marcar como paga/recebida" e abre a conferência (`FormBaixa` de `pages/Contas.tsx`,
  exportada com `conferir`); sem mudar valor nem data, segue o caminho normal (pergunta pelo lançamento já existente).
- Removida a sugestão "N meses de histórico / Ver mais detalhes" (`lib/adaptacao.ts`); o jeito de ver muda só em
  "Modo equilibrado · Alterar" (`Ctx.mudarDetalhe`, gravado no perfil).
- "Abrir em Lançamentos" filtra a categoria (`pedirCategoriaNosLancamentos` em `lib/busca.ts`). Compras no cartão continuam
  na tela Cartões, não em Lançamentos; a janela de categorias da Início lista as duas.
- Junção com a Início detalhada do GPT/Codex (#195), publicada antes: o "Falta pagar" das dívidas no equilibrado segue o
  critério combinado lá (`restanteHoje`, com juros de atraso estimados, e o aviso quando há juros); o "% quitado" usa o valor
  registrado. O botão "+" flutuante some nas duas Inícios; o menu "Mais opções" mostra "Mais" escrito na detalhada.
- Junção com a Início do simples (#196): o `FormBaixa` agora mora em `components/FormBaixa.tsx` (com banco); a opção
  `conferir` foi para lá. O simples mantém o topo dele (`simples-movel`, idioma e suporte no "Mais" de baixo); nos outros
  jeitos e telas do celular vale o topo com "Mais opções" (⋯). Os dois caminhos levam aos mesmos destinos; unificar fica
  como decisão do Edigar. **Resolvido em 16/11/2026 (Claude):** o Edigar pediu o celular redesenhado; agora há um topo só
  (foto → menu da conta) e a aba "Mais" para os três jeitos (entrada "Celular com moldura e Início próprias").
- Validação: `npx tsc -b`, `npm run lint` (sem erros; avisos antigos), build, `node scripts/painel/testar.mjs` (23 de 23,
  com 3 casos novos), app de demonstração em 320/360/390/430 px e com zoom de 130%: sem rolagem horizontal, sem valor
  cortado, sem rolagem interna, último conteúdo acima da barra de abas; 22 checagens de interação no Playwright (registrar,
  ver cálculo, conferência antes da baixa, comparação, metodologia, categorias e filtro, menu Mais/idioma, valores ocultos,
  troca e persistência do jeito, mês futuro), sem erro de página.
- Atenção: `node scripts/traducao/extrair.cjs --limpar …` também extrai textos de todos os arquivos que recebe (mexeu em
  12 arquivos fora do escopo). Foi desfeito; as traduções novas entraram direto no `traducoes.json`.

### 16/11/2026 — Claude — Celular com moldura e Início próprias (fase 1 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração de banco. O app Android **não** foi gerado nesta
sessão: precisa de versão nova para receber a mudança.

- Pedido do Edigar: telas do celular totalmente diferentes das do computador, no esqueleto de um app de banco que ele
  mandou em capturas (número grande no topo que desliza, ações redondas, cartões empilhados, abas em pílula). Só o
  esqueleto: cores, ícones e ações são do OpusCash. Decisões dele: redesenhar todas as telas (por fases), topo da Início
  com os resumos do mês, os três jeitos viram modelos de partida dos cartões, escolha dos cartões salva na conta.
- Regras e fases: `docs/arquitetura-do-painel.md`, seção 4.25 (nova); 4.4 e 6 ganharam a nota de que valem para o que
  ainda abre a versão do computador.
- `components/Painel.tsx`: os avisos do topo, as telas e as janelas viraram pedaços compartilhados; com `mobile` sai a
  moldura do celular (`src/movel/Casca.tsx`: topo, fundo em degradê, quatro abas fixas, folhas "Mais", conta e meses).
  O HTML do computador não mudou: 24 capturas (3 jeitos, 10 telas, 1280 e 1024 px) iguais byte a byte às do código anterior.
- `lib/useMesDaInicio.ts` (novo): o cálculo do mês que estava dentro de `pages/Inicio.tsx` (dia a dia com parcelas,
  tarefas, previsão, estado do mês, comparação, metas). As duas Inícios usam o mesmo.
- `lib/widgets.ts` (novo, puro): os cartões, os modelos de cada jeito e a grade (pequenos em par). `src/movel/widgets.tsx`
  desenha cada um; `src/movel/telas/InicioMovel.tsx` é a Início do celular; `src/movel/primitivas.tsx` as peças.
- Telas sem versão de celular ainda (todas menos a Início) abrem a do computador dentro da moldura nova, com o "+".
- Saíram `testar-inicio-simples.cjs` e `testar-inicio-detalhado.cjs` (conferiam a Início antiga do celular); entrou
  `scripts/app-de-demonstracao/testar-movel.cjs`.
- Validação: `npx tsc -b`, `npm run lint` (só avisos), build, `node scripts/painel/testar.mjs` 26/26 (3 casos novos),
  `testar-movel.cjs` 97/97, `testar-correcoes.cjs` passou; textos novos com `en` e `es` em `traducoes.json`.
- Pendente (próximas fases): escolher/tirar/reordenar cartões com a coluna `perfis.celular` (migração nova), e as versões de
  celular de Lançamentos, Contas, Cartões, Dívidas, Metas, Guardado, Consultor, Invest e Ano; por fim, limpar o código de
  celular antigo que ficou sem uso.

### 16/11/2026 — Claude — Celular: escolher, tirar e arrumar os cartões da Início (fase 2 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. **Migração nova: `supabase/migracao-35-widgets-do-celular.sql`**
(só acrescenta a coluna `perfis.celular`; sem ela a arrumação fica só no aparelho). O app Android ainda não recebeu
nem a fase 1.

- Pedido do Edigar (plano aprovado): a Início do celular parte do modelo do jeito e a pessoa adiciona, tira e muda a ordem
  dos cartões, gravado na conta.
- `lib/widgets.ts`: `cartoesDaInicio`, `adicionarCartao`, `removerCartao`, `moverCartao`, `normCelular`, `maisRecente`
  (puros). `src/movel/FolhaDeCartoes.tsx`: a folha com as prévias. `src/movel/telas/InicioMovel.tsx`: botões "+ Adicionar
  cartões" e "Arrumar" (Subir, Descer, Tirar, "Voltar ao modelo"). `src/movel/widgets.tsx`: nome, ícone, descrição e
  módulo de cada cartão.
- `lib/useDados.ts`: `celular` e `salvarCelular` (aparelho + `perfis.celular`, 400 ms depois do último toque, erro de
  coluna ausente engolido; ao carregar vale a cópia mais recente e a do aparelho na frente sobe). `salvarPerfil` não envia
  `celular`. `Ctx` ganhou `celular` e `salvarCelular`.
- Com uma folha aberta, a barra de abas e o "+" do celular saem da frente (a folha grande ficava por baixo deles).
- Regras: `docs/arquitetura-do-painel.md`, seção 4.25.
- Validação: `npx tsc -b`, lint (só avisos), build, `scripts/painel/testar.mjs` 31/31 (5 casos novos),
  `testar-movel.cjs` 112/112 (com e sem a coluna, recarregando e em "outro aparelho"), `testar-correcoes.cjs` passou.
  Capturas do computador comparadas com a versão anterior: só diferenças de serrilhado de 1 px que também aparecem entre
  duas rodadas da mesma versão (sem diferença visível).

### 16/11/2026 — Claude — Celular: Lançamentos e Contas do mês com tela própria (fase 3 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android ainda não recebeu as fases 1 a 3.

- Pedido do Edigar (plano aprovado): seguir o redesenho do celular tela por tela; esta fase faz Lançamentos e Contas do mês.
- `pages/lancamentos/useLancamentos.ts` (novo): os filtros e as contas que estavam dentro de `pages/Lancamentos.tsx`
  (tipo, banco, forma, categoria, dia, ordem, busca, grupos por dia, categorias, formas, totais, compras no cartão).
  `Lancamentos.tsx` passou a usar o hook e exporta `CalorDoMes`, `NoDia` e `SEMANA`.
- `pages/Contas.tsx`: `useEdicaoDeConta` (abrir cadastro, inclusive a "entrada fixa" pedida por outro formulário),
  `FormConta`, `LinhaDoMes`, `SemContas` e `ENTRADA_FIXA` exportados; a rosca por categoria saiu para
  `contasPorCategoria` em `lib/contasFixas.ts`.
- `src/movel/telas/LancamentosMovel.tsx` e `ContasMovel.tsx` (novos); o `Painel` escolhe as telas do celular pela lista
  `TELAS_DO_CELULAR` (topo colorido e sem o "+").
- Regras: `docs/arquitetura-do-painel.md`, seção 4.25. Rótulos do topo escritos como frases inteiras em cada caso (busca,
  filtros, mês todo), como pede o guia de idiomas.
- Validação: `npx tsc -b`, lint (sem erro), build, `scripts/painel/testar.mjs` 31/31, `testar-movel.cjs` com as duas telas
  novas (larguras 320–430, temas, filtros, edição, conferência sem baixa, "Todas"). Computador comparado com a produção:
  só serrilhado de 3 pixels na Início e o gráfico da tela Ano capturado em outro momento da animação (tela não tocada).

### 16/11/2026 — Claude — Celular: Cartões e Dívidas com tela própria (fase 4 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android ainda não recebeu as fases 1 a 4.

- Pedido do Edigar: seguir com Cartões e Dívidas.
- `pages/Cartoes.tsx`: as faturas atrasadas e o histórico do `Detalhe` viraram `FaturasAtrasadas` e `FaturasResolvidas`
  (mesmo HTML); `FaturaDoMes`, `Limite`, `Proximas`, `Parcelada`, `ResultadoDaBusca`, `SemCartoes` e os três formulários
  passaram a ser exportados.
- `lib/dividas.ts`: `estadoDaDivida` e `resumoDasDividas` (o que estava dentro de `pages/Dividas.tsx`); `Ficha`, `corDe`
  e `VazioLado` exportados.
- `src/movel/telas/CartoesMovel.tsx` e `DividasMovel.tsx` (novos). O topo do celular ganhou o tom `cor` (degradê da cor do
  cartão), a página inicial (`inicial`) e a fileira de ações se ajusta ao número de botões.
- Traduções: textos novos e quatro avisos de erro de Cartões que estavam sem `en`/`es`.
- Regras: `docs/arquitetura-do-painel.md`, seção 4.25.

### 16/11/2026 — Claude — Início detalhada redesenhada (computador)

**Estado:** implementado e validado localmente; publicação no site registrada na conversa da sessão (PR e deploy). Sem
migração. O celular não usa esta tela (tem a sua Início em `src/movel`), então o app Android não precisa de versão nova
por causa dela.

- Pedido do Edigar: a Início detalhada da entrada "Início detalhada no celular" (GPT/Codex, acima) ficou feia; recriar
  igual a 6 imagens que ele mandou e, no gráfico da Evolução, pôr a linha da dívida passando entre as barras.
- Substitui a organização em seções recolhíveis (`SecaoDetalhada`, seletor "Ir para seção", listas `det-linha`) por seis
  seções no layout das imagens: Visão geral, Contas prioritárias, Evolução financeira, Comparação entre períodos, Dívidas/
  contas/cartões/metas e Diagnóstico (`components/InicioDetalhadoTelas.tsx`, `EvolucaoDetalhada.tsx`, CSS reescrito em
  `inicio-detalhado.css`). Saíram `InicioDetalhado.tsx` e `SecaoDetalhada.tsx` (ninguém mais usava).
- Nenhum cálculo mudou: tudo vem de `useMesDaInicio`, `c.porMes`, `c.previsto`, `compararGastos`, `c.conselhos` e
  `c.analise`. Mantidos: Saldo devedor com juros estimados, contas abrindo a janela com a ação, peças abrindo o bloco
  completo, "Agora não" dos conselhos, pilares da nota, saldos futuros em branco.
- Gráfico novo `GraficoEvolucao` (`Graficos.tsx`): dívida no mesmo eixo das barras; plugins `destaqueMes` (agora com
  moldura) e `baloes` (valores do mês escolhido) em `lib/charts.ts`.
- Ficaram fora da tela (estão no Resumo do ano): composição da dívida mês a mês, saldo de um mês para o outro e lista
  alternativa dos números.

**Validação:** `npx tsc -b`, `npm run lint` (sem erros), build com Supabase fictício, `scripts/painel/testar.mjs` 31/31,
`testar-movel.cjs` todo OK. App de demonstração em 1586 e 1100 px, escuro e claro: sem rolagem lateral nem erro de página;
trocar mês no gráfico, Previsto, Saldos, 12 meses, abrir peça, categoria, conselho, "Como calculamos" e a janela da conta.

- 16/11/2026, ajustes pedidos depois: tudo cerca de 30% menor (textos com no mínimo 13 px) e a Evolução financeira
  passou a ser a primeira seção, logo depois do topo ("Olá", Visão geral, Modo detalhado, Novo lançamento), que virou o
  componente `TopoDetalhado`.

### 16/11/2026 — Claude — Celular: Metas e Dinheiro guardado com tela própria (fase 5 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android ainda não recebeu as fases 1 a 5.

- Pedido do Edigar (plano aprovado): seguir com Metas e Dinheiro guardado. Antes, o branch foi refeito sobre a produção,
  que já tinha #203–#205 (Início detalhada do computador, de outra sessão; nada no celular).
- `lib/metas.ts`: `resumoDasMetas` (totais na moeda principal e o progresso), usado também pela tela Metas e por
  `lib/useMesDaInicio.ts` (antes a Início repetia a conta). `pages/Metas.tsx` exporta `estadoMeta`, `linhasDeChegada`,
  `FichaMeta`, `FormMeta` e `FormMovimento`.
- `pages/Patrimonio.tsx`: `useGuardado` (saldos, gravar, confirmar herdados, lançamentos por banco, totais, reserva) e as
  peças `FaixaHerdado`, `SaldosDoBanco`, `CartoesDoBanco`, `ReservaDeEmergencia`, `ExtrasDoGuardado` (mesmo HTML);
  `FormBanco` exportado.
- `src/movel/telas/MetasMovel.tsx` e `GuardadoMovel.tsx` (novos); as duas entram em `TELAS_DO_CELULAR`.
- Regras: `docs/arquitetura-do-painel.md`, seção 4.25.

### 16/11/2026 — Claude — Início equilibrada redesenhada (computador)

**Estado:** implementado e validado localmente; publicação no site registrada na conversa da sessão (PR e deploy). Sem
migração. O celular não usa esta tela (tem a sua Início em `src/movel`), então o app Android não precisa de versão nova.

- Pedido do Edigar: recriar a Início equilibrada igual a 3 imagens (Visão geral, Seu dinheiro em perspectiva, Seu próximo
  passo), coerente com a detalhada. Feita direto na escala da detalhada depois do "tudo menor" (#204, ~70% das imagens).
- `components/InicioEquilibrado.tsx` reescrito: `TopoEq`, `PilulaDoJeito` (a pílula "Modo equilibrado" substitui o
  "Modo equilibrado · Alterar" do fim), `RegistrarEq` (opções num menu sob o botão), `ResultadoEq`, `AteOFimEq`, `ContasEq`
  (duas colunas), `CabecalhoEq`, `ComparacaoEq`, `PrincipaisGastos`, `FaixaEq`, `OrientacaoEq`, `SaudeEq` (nota em anel) e
  `ResumosCompactos`. Saíram `SaudacaoEq`, `ResumoEq` e `SeletorDoJeito`. CSS reescrito em `inicio-equilibrado.css`.
- Nenhum cálculo mudou. Novo só `maiorCategoria` (`lib/comparacao.ts`): a frase "Em novembro, moradia concentra a maior
  parte das suas despesas." (nome no meio da frase; sigla fica como está; "sem categoria" tem frase própria). Caso novo em
  `scripts/painel/casos.ts`. Ícones novos: `diag-sobe`, `diag-desce`, `barras`, `balanca`, `exclamacao`.
- Saiu da tela (fica por toque ou em outra página): o grupo "Restante do mês" (está em "Ver contas do mês") e a linha
  "Compras no cartão ficam em A pagar" (foi para o título do (i) do resultado e para o "Como calculamos").

**Validação:** `npx tsc -b`, `npm run lint` (sem erros; nenhum aviso novo), build com Supabase fictício,
`scripts/painel/testar.mjs` 32/32, `testar-movel.cjs` sem falha. App de demonstração em 1586, 1440, 1100 e 900 px, escuro e
claro, meses passado/atual/futuro: sem rolagem lateral nem erro de página; 12 cliques conferidos (Registrar e Saída, pílula
do jeito, Ver mais atrasadas, Marcar como paga e linha dos próximos abrem a conferência, Explorar comparação, Como
calculamos, Todas as categorias, (i), Ver diagnóstico, faixa → Lançamentos).

### 16/11/2026 — Claude — Celular: o arrasto do topo colorido travava

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração.

- Relato do Edigar: arrastar o topo para o lado (ex.: Dívidas, "Você deve" → "Me devem") dava uma travada e às vezes não
  completava.
- Causa medida no app de demonstração (processador 4× mais lento, dedo simulado): o `HeroDeslizante` avisava a página nova
  assim que o arrasto passava da metade. Isso redesenhava o painel (cor do topo) e, em Dívidas, trocava a lista de baixo
  com o dedo na tela: 54 mudanças e a página saindo do lugar no meio do gesto. Somava-se o `backdrop-filter` dos botões
  sobre o degradê, que o celular refazia a cada quadro da troca de cor.
- Correção (`src/movel/primitivas.tsx`, `src/movel/movel.css`): durante o arrasto só os pontos mudam; a página nova é
  avisada quando a rolagem para (`scrollend`, ou 120 ms sem rolar), em `startTransition`. Sobre o degradê, fundo translúcido
  sem desfoque; as camadas do degradê com `will-change: opacity`.
- Depois: 4 mudanças com o dedo na tela (só os pontos), deslocamento zero, a página troca e encaixa.
  `scripts/app-de-demonstracao/testar-arrasto.cjs` (novo) cobre todas as telas com topo que desliza.

### 16/11/2026 — Claude — Celular: Consultor e Invest com tela própria (fase 6 de 7)

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android ainda não recebeu as fases do celular.

- Pedido do Edigar: seguir com a fase 6, cuidando que o Consultor monta a própria tela.
- Decisão: no Consultor o celular só põe o topo (a nota e o plano do próprio Consultor) e as ações. A tela que ele monta
  (`useTelaViva`, `Manchete`, `Faixas` e os blocos de `AnaliseTopo`) vem inteira e na mesma ordem do computador; nada do
  sistema de cartões da Início entra aqui. Teste: mesma lista de cartões, na mesma ordem, a 390 px e a 1280 px.
- `pages/Analise.tsx`: `PlanoDeAcao`, `OQueMudou` e `useDesdeAUltimaVisita` exportados. `pages/Invest.tsx`:
  `useInvestTela` (aba, ativo aberto, janelas e ações) e `ABAS` exportados; a tela do computador usa o mesmo.
- `src/movel/telas/ConsultorMovel.tsx` e `InvestMovel.tsx` (novos). `testar-arrasto.cjs` passou a cobrir as duas.
- `scripts/invest/testar.mjs`: 27/27.

### 16/11/2026 — Claude — Início simples no mesmo layout da equilibrada (computador)

**Estado:** implementado e validado localmente; publicação registrada na conversa da sessão. Sem migração; o celular tem a
sua Início (`src/movel`), então o app Android não precisa de versão nova.

- Pedido do Edigar: "faz o mesmo no modo simples" depois da equilibrada (#207). Sem imagens próprias: o simples usa o mesmo
  layout e as mesmas peças, com menos coisa (sem comparação, gráfico, nota ou faixas). Seções: Visão geral (resultado,
  previsão em palavras, Registrar entrada/saída e Contas a pagar em duas colunas) e Seu próximo passo (uma orientação,
  últimos lançamentos e quatro cartões de acesso). Regras em `docs/arquitetura-do-painel.md`, 4.1.
- `components/InicioSimples.tsx` reescrito (mesmos cálculos: previsão de `composicao`, `tarefasDoMes` com "Marcar como
  paga" que pergunta antes se o dinheiro já parece lançado, janela de gastos por categoria igual). Saíram `JanelaModo` e o
  rodapé "Modo simples · Alterar" (a pílula faz isso). `inicio-simples.css` reescrito, só com o que é do simples.
- `InicioEquilibrado.tsx`: `Tile` exportado; `ContasEq` ganhou `titulo`, `tituloProximas`, `botaoNasProximas`,
  `acaoDaConta` e `pe`; `OrientacaoEq` ganhou `aoAnalise` (duas frases e "Ver análise"); `ResumosCompactos` com 4 itens
  vira 4 colunas. A equilibrada não mudou.

**Validação:** `npx tsc -b`, lint sem aviso novo, build, `scripts/painel/testar.mjs` 32/32, `testar-movel.cjs` sem falha.
App de demonstração no simples em 1586, 1100 (claro) e 900 px, meses passado, atual e futuro, sem rolagem lateral nem erro;
10 cliques conferidos (Registrar saída, pílula, Ver mais atrasadas, Marcar como paga na próxima, Ver cálculo, Gastos por
categoria, lançamento, Ver análise, valores a receber, troca para o equilibrado). Equilibrado: os mesmos 13 cliques de antes.

### 16/11/2026 — Claude — Dívidas: juros por dia, valor fixo por dia, valor recebido e o bloco "Juros" reorganizado

**Estado:** implementado e validado localmente; publicação registrada na conversa da sessão. **Precisa da migração 36**
(`supabase/migracao-36-juros-por-dia-e-valor-recebido.sql`); sem ela o app funciona como antes e as opções novas ficam
escondidas. O formulário também roda no app Android: ele só recebe com uma versão nova do app.

- Pedido do Edigar: credor que cobra juros por dia no atraso, empréstimo em que a pessoa recebe menos do que devolve (pega
  R$ 250 e devolve R$ 270), sem dizer que é agiota, e reorganizar os campos de juros para não confundir.
- Banco (migração 36): `dividas.valor_recebido`, `atraso_periodo` ('mes' | 'dia') e `atraso_reais_dia`. `useDados` testa a
  coluna (`dividasSemCusto`) e tira os campos ao gravar quando ela não existe (`CAMPOS_36`).
- Motor: `lib/jurosAtraso.ts` (taxa por dia, valor fixo por dia repartido entre as parcelas atrasadas, `crescimentoPorDias`
  para o exemplo do formulário, `regraDoAtraso` com "% ao dia" e "R$ 20,00 por dia"); `lib/dividas.ts` (`jurosEmbutidos`,
  tabela Price por bisseção; `jurosQuePesam` converte o atraso por dia em % ao mês).
- Formulário (`components/Formularios.tsx`): bloco "Juros" com "Tem juros no que você paga?" (Sem juros / Sei quanto recebi /
  Sei a taxa) e "Se atrasar, a dívida aumenta?" (Não / Sim → % ao mês, % ao dia ou R$ por dia, multa opcional, exemplo
  calculado, "Ajustes avançados" fechado). A multa deixou de vir preenchida com 2% numa dívida nova (o padrão do banco era
  surpresa para quem pegou com pessoa física); dívidas antigas continuam com a delas. "Valores conferidos em" virou "Os juros
  contam desde". As quatro telas que abrem o formulário passam `semAtraso` e `semCusto` (a Início do computador e a do
  celular não passavam `semAtraso`, então a seção "Se atrasar" não aparecia por lá).
- Ficha da dívida (`pages/Dividas.tsx`): "Você recebeu R$ 250,00 e vai devolver R$ 270,00: R$ 20,00 de juros (8%)."

**Validação:** `npx tsc -b`, lint sem aviso novo, build, `scripts/painel/testar.mjs` 34/34 (2 casos novos: juros embutidos
e atraso por dia/valor fixo/multa/conferência/regra/peso ao mês), `testar-movel.cjs` sem falha, `testar-correcoes.cjs` OK. No
app de demonstração, em 1440 e 360 px: criar "Empréstimo do Zé" (R$ 270, recebeu R$ 250, R$ 20 por dia), ficha com o custo
e a regra, reabrir com os valores; dívida antiga com 13% ao mês composto reabre igual e muda para 1% ao dia; com a migração
36 simulada como ausente, as opções novas somem e nada quebra.

### 17/11/2026 — Claude — Celular: tela do Ano e limpeza do celular antigo (fase 7 de 7)

**Estado:** implementado e validado localmente; publicação registrada na conversa da sessão. Sem migração nova. O app
Android só recebe com uma versão nova.

- Ano no celular (`src/movel/telas/AnoMovel.tsx`): topo sobrou → entrou → saiu, ações ano anterior/próximo/mês atual,
  os meses, melhor mês, gasto médio e os gráficos conforme o jeito. As contas do ano saíram de `pages/Ano.tsx` para
  `resumoDoAno` (`lib/calc.ts`), usado pelas duas telas; `MesesDoAno` passou a ser exportado e o contexto ganhou
  `irParaAno`.
- Limpeza (`components/Painel.tsx`, `index.css`, `lib/useBarraLateral.ts`, `components/reanalise.css`, `movel/movel.css`):
  saíram o "+" fixo, a barra de abas antiga com a alça de esconder, a folha "Mais" antiga, o "⋯" do jeito simples
  (`menu-movel`, `simples-movel`) e os ramos `mobile` do topo do computador, que nunca mais eram desenhados.
- **Defeito corrigido:** no menu da conta do celular havia um item "Idioma" que acionava um seletor que só existia no topo
  do computador; tocar não fazia nada. O idioma já aparece no mesmo menu (`BotaoIdioma emLista`), então o item quebrado saiu.
- `lib/botaoMais.ts` ficou com `useRecolherAoRolar` (encolhe a barra de abas) e `useAcoesDeLancar` (ainda usado pelas
  Inícios); `useAcoesNaTela` não tem mais quem leia.

**Validação:** `npx tsc -b`, lint sem erro, build, `scripts/painel/testar.mjs` 34/34, `scripts/invest/testar.mjs` 27/27,
`testar-movel.cjs` 364/364 (Ano em 320–430 px nos dois temas, botões de ano, melhor mês abre a Início; o teste que esperava
o "+" foi trocado por "não existe mais"), `testar-arrasto.cjs` com o Ano (0 mudanças durante o arrasto). Computador: capturas
de 1280 e 1024 px contra a produção iguais ou com o ruído de captura conhecido (brilhos e animação do gráfico do Ano).

### 17/11/2026 — Claude — App Android 2.7.0 (código 12)

**Estado:** `.aab` gerado, assinado com a chave de upload e entregue ao Edigar; falta ele enviar no Play Console.

- Leva o celular redesenhado (fases 1 a 7, até o PR #213). `versionCode` 11 → 12, `versionName` 2.6.0 → 2.7.0.
- Feito com `npm run app` e `./gradlew bundleRelease` (JDK 21, Android SDK 36), assinado com `jarsigner` (README → App
  Android). A chave e a senha vieram do Drive do dono só para esta assinatura e foram apagadas da máquina em seguida.
- Conferido: `jarsigner -verify` ("jar verified") e a impressão SHA-256 do certificado igual à da chave de upload
  (A7:07:94:…:5D:9D).

### 18/11/2026 — Claude — Celular: troca de tela mais rápida e lente de arrastar na barra de abas

**Estado:** implementado e validado localmente; publicação registrada na conversa da sessão. Sem migração. O app Android só
recebe numa versão nova.

- Pedido do Edigar (com um vídeo da barra do WhatsApp no iOS 26): a troca de tela e de aba demorava; queria instantânea e
  fluida, e segurar a barra para arrastar a lente pelas abas, só no celular.
- Medição (app de demonstração, 390 px, processador 4× mais lento, rede 4G simulada), do toque até a tela nova na tela:
  antes, Início ~290 ms em toda troca, Consultor ~165–250, telas do "Mais" ~275 na primeira vez (as telas do celular não
  estavam na fila de pré-carga). Depois: Início ~175–220, Consultor ~150–225, telas do "Mais" ~100–145 já na primeira vez;
  a aba acende no próprio toque. O ruído entre rodadas é de ±50 ms.
- O que mudou: `components/Painel.tsx` (fila `telasMovel` baixada primeiro no celular; `irPara` no celular em
  `startTransition`, com `history.pushState` e volta ao topo num `useLayoutEffect`; tocar na aba aberta sobe ao topo),
  `movel/Casca.tsx` (aba acesa na hora e o gesto da lente), `movel/movel.css` (lente de vidro, entrada da tela em 0,3 s sem
  cascata, `content-visibility: auto` nos cartões).
- Tentado e desfeito: manter as telas abertas escondidas com `<Activity>`. Mediu pior (Início ~390 ms): o `ctx` é um objeto
  novo a cada desenho do Painel, então as telas guardadas eram redesenhadas do mesmo jeito.

**Validação:** `npx tsc -b`, lint sem erro, build, `scripts/painel/testar.mjs` 34/34, `testar-movel.cjs` 372/372 (8 novos:
segurar pega a lente, ela segue o dedo e fica centrada na aba, arrastando não troca a tela, soltar abre a aba, subir o
dedo cancela, toque normal abre, "voltar" do navegador volta, tela nova abre no topo), `testar-arrasto.cjs` 21/21,
`testar-correcoes.cjs` OK. Computador: 24 capturas iguais às da produção do mesmo dia (só o brilho animado da Início em
1024 px varia, como sempre).

### 18/11/2026 — Claude — App Android 2.7.1 (código 13)

**Estado:** `.aab` gerado, assinado com a chave de upload e entregue ao Edigar; falta ele enviar no Play Console. Substitui
a 2.7.0 (código 12) se ela ainda não foi enviada.

- Leva a troca de tela mais rápida e a lente de arrastar da barra de abas (PR #215). `versionCode` 12 → 13,
  `versionName` 2.7.0 → 2.7.1. Mesmo processo da 2.7.0 (README → App Android); chave e senha apagadas da máquina depois.
- Conferido: `jarsigner -verify` ("jar verified"), impressão SHA-256 igual à da chave de upload, e o código novo (lente)
  está dentro do pacote.

### 18/11/2026 — Claude — Início: gráfico do ano no Equilibrado e no celular, resumo do mês, contas a receber e atalho Cartões

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android precisa de versão nova para receber a
parte do celular.

- Pedido do Edigar: opinar sobre 7 sugestões que recebeu e fazer as que fizessem sentido. Decisões dele (plano aprovado):
  manter o número grande no topo do celular (a sugestão era trocá-lo pelo gráfico) e, no computador, gráfico só no
  Equilibrado (o Simples continua sem gráfico; o panorama segue só na Detalhada).
- **Defeito corrigido:** o cartão de contas da Início do celular tinha o título fixo "Contas a pagar", mas a lista
  (`tarefasDoMes`) traz contas de entrada; um valor a receber aparecia sob "Contas a pagar". Agora o título segue a lista
  ("Contas a pagar", "Contas a receber" ou "Contas a pagar e a receber"); `src/movel/widgets.tsx`, `tituloDasContas`. O
  computador já separava pagar e receber.
- Celular (`lib/widgets.ts`, `src/movel/widgets.tsx`): cartões novos `evolucao` (o `GraficoAnual` compacto com a opção nova
  `semPainel`, sem o painel do mês ao lado) e `resumo-mes` (Entradas, Saídas, Sobrou/Faltou até hoje e o mês anterior;
  futuro: Vai entrar, Vai sair, Deve sobrar/Pode faltar; janeiro: sem mês anterior). Os três modelos abrem com
  `evolucao, resumo-mes, contas, ultimos`; `entrou-saiu` e `gasto-dia` saíram dos modelos (continuam na folha).
- Celular, ações da Início: com o módulo de cartões, a quarta é **Cartões** (abre a tela); sem ele, continua o "Mais".
- Computador, Equilibrado (`pages/Inicio.tsx`): a `EvolucaoDetalhada` entra na Visão geral, entre o resultado do mês e as
  contas (à vista ao abrir: começa em ~477 px a 1586 e 1100 px de largura). `.sr-only` do `inicio-detalhado.css` passou a
  valer também em `.inicio-eq`.
- Regras: `docs/arquitetura-do-painel.md`, 4.0.2 e 4.25.

**Validação:** `npx tsc -b`, `npm run lint` (sem erros; 1 aviso novo do mesmo tipo do `GraficoDoGasto` no mesmo arquivo),
build com Supabase fictício, `scripts/painel/testar.mjs` 34/34 (casos dos modelos atualizados e um novo: os três abrem
igual), `testar-movel.cjs` (novos: título das contas com entrada, ordem do começo, gráfico, resumo com o mês anterior,
atalhos Gasto/Entrada/Contas/Cartões e o atalho abrindo Cartões; o limite do simples foi a 6 e entrou "equilibrado com mais
cartões que o simples"). Capturas a 390 px (escuro e claro) e 360 px em janeiro; computador a 1586, 1100 e 900 px, sem
rolagem lateral.

### 18/11/2026 — Claude — App Android 2.7.2 (código 14)

**Estado:** `.aab` gerado, assinado com a chave de upload e entregue ao Edigar; falta ele enviar no Play Console. Substitui
a 2.7.1 (código 13) se ela ainda não foi enviada.

- Leva a Início nova do celular (PR #217: gráfico mês a mês, resumo do mês com o mês anterior, título das contas a
  receber, atalho Cartões). `versionCode` 13 → 14, `versionName` 2.7.1 → 2.7.2. Mesmo processo das anteriores (README → App
  Android; JDK 21, Android SDK 36 instalado nesta máquina); chave e senha vieram do Drive do dono e foram apagadas em seguida.
- Conferido: `jarsigner -verify` ("jar verified"), impressão SHA-256 igual à da chave de upload (A7:07:94:…:5D:9D) e o
  código novo ("Contas a pagar e a receber") dentro do pacote.

### 18/11/2026 — Claude — Celular: gráfico "Mês a mês" maior

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android precisa de versão nova (2.7.3).

- Pedido do Edigar (com captura do celular): o gráfico do ano na Início do celular é bom, mas ficava pequeno; queria
  maior e completo sem ocupar a tela toda nem mudar o desenho.
- O que tomava o espaço: 220 px de altura, os dois seletores em duas linhas cheias, 16 px de borda de cada lado e, no
  `compacto`, barras de no máximo 10 px e letras 9/10.
- Mudou: altura 300 no cartão da Início (`src/movel/widgets.tsx`); seletores numa linha só e mais baixos, gráfico 10 px
  mais perto de cada borda (`src/movel/movel.css`, `.app.movel .grafico-moeda` e `.widget-evolucao .gcp > .grafico`; a
  tela Ano ganhou a classe `widget-evolucao` no cartão "Mês a mês"); no `compacto` (`components/Graficos.tsx`), barras até
  14 px, meses e eixo 10,5, legenda 11. Séries, linhas e cores iguais. Só o celular usa `compacto`.
- Medido no app de demonstração (com uma compra em USD, para aparecer o BRL/USD como na captura): área do gráfico a
  390 px de 324×220 para 344×300 (≈ +45%), cartão de 370 para 400 px; seletores numa linha a 390 e 360 px, quebrando
  sem cortar a 320; nada sai do cartão, sem rolagem lateral, nos dois temas. A tela Ano ganha o mesmo.

### 18/11/2026 — Claude — App Android 2.7.3 (código 15)

**Estado:** `.aab` gerado, assinado e entregue ao Edigar; falta ele enviar no Play Console. Substitui a 2.7.2 (código 14),
que ainda não tinha sido enviada.

- Leva a Início nova do celular (#217) e o gráfico "Mês a mês" maior (#219). `versionCode` 14 → 15, `versionName`
  2.7.2 → 2.7.3. Mesmo processo; chave do Drive do dono apagada da máquina logo depois de assinar.
- Conferido: `jarsigner -verify` ("jar verified"), SHA-256 da chave de upload (A7:07:94:…:5D:9D) e o CSS novo no pacote.

### 18/11/2026 — Claude — Celular: a cor do topo acompanha o dedo

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android precisa de versão nova.

- Relato do Edigar (captura da Início): ao trocar a página do topo, a cor demorava e não acompanhava a troca.
- Causa: desde a correção do arrasto (16/11), a tela só recebia o tom novo quando a rolagem parava (`scrollend` ou 120 ms
  sem rolar), e as camadas do degradê ainda levavam 0,7 s para trocar. De propósito, para não redesenhar com o dedo na tela.
- Correção (`src/movel/primitivas.tsx`, `HeroDeslizante`): a cada quadro do arrasto, as camadas de cor das duas páginas
  vizinhas recebem a opacidade na proporção do arrasto, direto no estilo (sem React); no tom `cor` (Cartões), a `--tom-cor`
  vira um `color-mix` das duas cores. Ao assentar, quando a classe `ativo` chega ao tom novo, o estilo é tirado (a cor do
  cartão fica com o valor exato que a tela põe). Um quadro de mistura na fila é cancelado ao parar, senão prendia a cor.
- `testar-arrasto.cjs`: as camadas de cor podem mudar com o dedo na tela (o resto continua não podendo); novos: a cor de
  antes já está abaixo de 0,5 no meio do gesto, nos Cartões a cor vira mistura, e depois de assentar não sobra estilo solto.
  41/41 com o processador 4× mais lento, nas 10 telas com topo que desliza.

### 18/11/2026 — Claude — App Android 2.7.4 (código 16)

**Estado:** `.aab` gerado, assinado e entregue ao Edigar; falta ele enviar no Play Console. Substitui a 2.7.2 e a 2.7.3
(nenhuma foi enviada).

- Leva #217 (Início nova), #219 (gráfico maior) e #221 (cor do topo acompanha o dedo). `versionCode` 15 → 16,
  `versionName` 2.7.3 → 2.7.4. Chave do Drive do dono apagada logo depois de assinar.
- Conferido: `jarsigner -verify`, SHA-256 da chave de upload (A7:07:94:…:5D:9D) e o código novo (`--tom-cor` em
  `primitivas`) dentro do pacote.

### 18/11/2026 — Claude — App Android 2.7.5 (código 17)

**Estado:** `.aab` gerado, assinado e entregue ao Edigar; falta ele enviar no Play Console (teste fechado).

- Motivo: ao enviar a 2.7.4 no teste fechado, o Play Console recusou ("O código de versão 16 já foi usado"), mas o 16 não
  aparecia em "Adicionar da biblioteca" (a lista ia só até o código 6). O 16 provavelmente está numa versão de outra faixa.
  Em vez de procurar, subiu o código: `versionCode` 16 → 17, `versionName` 2.7.4 → 2.7.5. Mesmo conteúdo da 2.7.4.
- Lição: código de versão enviado uma vez ao Play Console nunca mais pode ser usado, nem em outra faixa nem depois de
  descartar o rascunho. Na dúvida, suba o número.
- Conferido: `jarsigner -verify` ("jar verified"), SHA-256 da chave de upload (A7:07:94:…:5D:9D), "2.7.5" no manifesto e o
  endereço do Supabase de produção no pacote. Chave e senha do Drive apagadas da máquina logo depois de assinar.

### 18/11/2026 — Claude — App Android 2.8.1 (código 19)

**Estado:** `.aab` gerado (`OpusCash-2.8.1-codigo19.aab`, na Área de Trabalho do dono); a assinatura com a chave de upload
foi feita pelo próprio dono no terminal (a senha não passa pelo Claude). Falta ele enviar no Play Console.

- Leva o plano de ação em etapas (#238) e os favoritos em destaque no Consultor com o rodapé do plano corrigido (#239).
  `versionCode` 18 → 19, `versionName` 2.8.0 → 2.8.1. JDK 21 em `~/tools`, Android SDK com a plataforma 36 baixada pelo
  Gradle. Chave baixada do Drive do dono e apagada da máquina depois de assinar.

### 18/11/2026 — Claude — Início: faixa do topo sempre verde com selo do estado, e cartões redimensionáveis no computador

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração (o tamanho dos cartões vai na coluna `perfis.celular`,
que já é jsonb). O app Android precisa de versão nova para o selo no topo do celular e para guardar os tamanhos do
computador quando a pessoa arruma pelo celular (o app antigo lê `perfis.celular` sem `tamanhos` e, se a pessoa arrumar
pelo celular, a gravação dele apaga os tamanhos do computador; a ordem continua certa).

- Pedido do Edigar (1): não entendia a cor do topo da Início ("uma parte vermelha, depois verde"). Causa: a cor seguia o
  estado do mês (a previsão), mas o número grande é o de até hoje; ficava coral com "Sobrou … até hoje" escrito, e o
  Resumo logo abaixo mostrava o mesmo número em verde. Decisão dele (entre 3 opções): a faixa fica **sempre verde** e o
  estado vai escrito num selo (`SeloDoMes` em `src/movel/primitivas.tsx`, dados em `resumosDaInicio.ts`: `selo` e
  `subAlerta`), com "Pode faltar … no fim do mês" em coral claro com ícone. Vale no computador e no celular.
- Pedido do Edigar (2): no computador, redimensionar os cartões puxando o canto, com eles se encaixando como bloquinhos,
  sem travar ("o sistema que redimensiona em tempo real", na linha do Pretext: calcular em vez de medir a tela a cada
  quadro). Feito: `src/movel/GradeDoComputador.tsx` (grade posicionada por conta, arrasto direto no estilo, React só ao
  soltar) e, puros em `lib/widgets.ts`, `GRADE`, `encaixar`, `limitarTamanho`, `MINIMO`, `reordenarCartoes`,
  `redimensionarCartao` e `tamanhos` na `ArrumacaoInicio` (as funções de antes passaram a guardá-los). `CartaoWidget`
  ganhou o `widget-corpo` (`display: contents` no celular). Detalhes e regras: `docs/arquitetura-do-painel.md`, 4.0.0.

**Validação:** `npx tsc -b`, `npm run lint` (sem erros; 1 aviso novo de `react(immutability)` por escrever no estilo do
cartão no arrasto, de propósito), build com Supabase fictício, `scripts/painel/testar.mjs` 34/34, `testar-movel.cjs` 379 OK
sem falha, `testar-arrasto.cjs` 41/41 (uma rodada antes teve 1 falha intermitente em Metas, tela não tocada) e o novo
`testar-grade-pc.cjs` 46/46 nos dois temas: faixa verde com selo, nada sobreposto nem fora, o cartão segue o mouse no
arrasto, nenhuma tarefa longa (>50 ms) durante o arrasto, Contas 548×368 → 736×728 mostrando 4 → 10 contas, tamanho
guardado e de volta depois de recarregar, arrastar troca a ordem, setas e Delete na alça, Resumo largo com 4 colunas e
nada sobreposto a 1000 px.

### 18/11/2026 — Claude — App Android 2.8.2 (código 20)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.2-codigo20.aab`, na Área de Trabalho do dono). Falta o dono
assinar com a chave de upload (ele digita a senha; o Claude não digita senhas) e enviar no Play Console. Ele preferiu
assinar depois; a chave baixada do Drive foi apagada da máquina.

- Leva a faixa do topo sempre verde com o selo do estado do mês e os tamanhos dos cartões do computador guardados quando a
  pessoa arruma pelo celular (#241). `versionCode` 19 → 20, `versionName` 2.8.1 → 2.8.2.
- Conferido: o código novo (`selo-do-mes`, `alca-tamanho`), "2.8.2" no manifesto e o Supabase de produção no pacote.
- Para assinar: baixar `opuscash-upload.keystore` do Drive e rodar
  `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore opuscash-upload.keystore OpusCash-2.8.2-codigo20.aab opuscash`
  (o `jarsigner` está em `~/tools/jdk-21.0.12.1+1/bin`); depois apagar a chave.

### 18/11/2026 — Claude — Cartões do computador: linhas cortadas na borda e redimensionar mais firme

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração.

- Relato do Edigar (capturas do Consultor e do Dinheiro guardado): no fim de cada linha aparecia um pedaço de ícone
  cortado e as linhas não acompanhavam o tamanho. Causa: as linhas que não cabiam iam, por `flex-wrap`, para uma coluna à
  direita, e a margem de 10 px das linhas deixava o começo dessa coluna à vista. Correção: sem `flex-wrap`; a grade
  calcula quais linhas cabem inteiras (`recortar` em `GradeDoComputador.tsx`, alturas medidas só quando o conteúdo muda) e
  esconde as outras com `visibility`, quadro a quadro durante o arrasto (a ideia do Pretext: medir uma vez, depois só conta).
- Outros defeitos achados na revisão: (1) puxar o canto podia fazer o cartão pular para outro lugar (o encaixe o
  reposicionava): agora fica preso onde estava (`encaixar(..., preso)`) e, ao soltar, guarda a ordem de leitura do que se
  vê; (2) esticar só para o lado (mouse ou ← →) travava a altura, e o cartão podia virar uma caixa alta e vazia: a altura
  só trava com movimento vertical; (3) o Mês a mês largo deixava uma faixa vazia à direita (coluna do painel do mês, que a
  Início não usa); (4) animações de encaixe de 0,5 s para 0,3 s e o cartão na mão sem atraso.
- `testar-grade-pc.cjs` 70/70 nos dois temas (novos: cartão preso enquanto cresce, nenhuma linha cortada no meio do
  arrasto e depois, diminuindo as linhas somem junto, Consultor e Dinheiro guardado largos e baixos sem corte, esticar só
  para o lado não trava a altura). `scripts/painel/testar.mjs` 34/34, `npx tsc -b`, lint e build.

### 18/11/2026 — Claude — Topo da Início: contraste do "Pode faltar"

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração.

- Relato do Edigar (capturas nos dois temas): o aviso "Pode faltar … no fim do mês" no topo verde ficava rosa sobre rosa no
  claro e escuro avermelhado no escuro. Causa: a linha usava a classe `alerta`, que já é a das caixas de aviso do app
  (`index.css`, fundo rosa com texto `--alerta-texto`) e pintava por cima. Agora é `vai-faltar` (`cartoes.css`): texto
  branco num vidro escuro com borda e ícone coral, igual nos dois temas e numa linha só no celular. Lição: não usar nomes
  de classe genéricos que já existam no `index.css`.
- Conferido no app de demonstração com uma saída futura que deixa a previsão negativa: computador e celular (390 px), claro
  e escuro, texto branco.
- Nota da máquina: com pouca memória livre, o `npm run build` falhou alocando memória no rolldown; com
  `RAYON_NUM_THREADS=1` passou.

### 19/11/2026 — Claude — "Entender previsão" e o resumo de Lançamentos redesenhados

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O celular abre a mesma janela "Entender previsão",
então o app Android só a recebe numa versão nova (a 2.8.2 sem assinatura na Área de Trabalho do dono é de antes disto).

- Pedido do Edigar (3 capturas): as duas telas estavam feias e muito textuais. Decisões e detalhes em
  `docs/arquitetura-do-painel.md` (parágrafos "Entender previsão" e "Resumo do topo de Lançamentos").
- `components/EntenderMes.tsx` + `entender.css` reescritos: resposta primeiro, cascata em SVG, barras por grupo, quanto
  já venceu, grupos fechados com os itens a um clique, explicações recolhidas. Mesmos números de antes (`comporPrevisao`).
- `pages/lancamentos/ResumoDoMes.tsx` + `resumo.css` (novos) no lugar da `Vitrine` em Lançamentos: número, balança e o mês
  dia a dia. `Vitrine`/`AnelVivo` continuam nas outras telas.
- Conferido no app de demonstração (com lançamentos de novembro e uma saída futura que deixa a previsão negativa), claro e
  escuro, computador e 390 px: sem erro na página, sem rolagem de lado. Lição: o tema da demonstração vem de
  `localStorage['opuscash-tema']` (o `tema` do perfil não basta para as capturas).

### 19/11/2026 — Claude — Cartões de dívida montados por um compositor

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. Só o computador (o celular tem o cartão próprio).

- Pedido do Edigar (captura da grade "Cada dívida"): usar "o algoritmo do Consultor" para montar o miolo de cada cartão
  conforme o tipo da dívida (parcelada, valor único, com juros, renegociação, empréstimo, sem data), mantendo o topo.
- Feito: `lib/cartaoDaDivida.ts` (puro: `tracosDe` + `montarCartao`, destaque e peças por nota de aptidão, orçamento de
  espaço, uma peça por família) e `components/CartaoDaDivida.tsx` + `cartao-divida.css` (o desenho de cada peça).
  `CartaoDivida` em `pages/Dividas.tsx` usa o miolo montado; saiu o `Pips` de lá (foi para a peça `parcelas`). Regras em
  `docs/arquitetura-do-painel.md`, 4.13.
- Defeito pego na conferência: a raiz do miolo recebia a classe `dvm-<destaque>` (ex.: `dvm-dias`), a mesma do círculo do
  destaque, e herdava a altura de 62 px: o conteúdo saía por cima do cartão. Agora o destaque vai em `data-destaque`.
- Validação: `scripts/painel/testar.mjs` 35/35 (caso novo com 10 tipos de dívida e as regras de espaço e família), tsc,
  lint, build; app de demonstração com 9 dívidas parecidas com as do dono, claro e escuro, sem erro na página.

### 19/11/2026 — Claude — Planejamento do mês no Consultor

**Objetivo.** O dono pediu uma opção no Consultor para dizer com qual dinheiro sai cada conta, como um jogo, inclusive
pagando parte agora e o resto com outra entrada, e que o Consultor use isso nas dicas. Antes de construir, foram feitos
dois protótipos clicáveis; ele escolheu o de "fatiar cada entrada" e pediu animações e visual caprichado.

**O que mudou.**
- `src/lib/planejamento.ts` (novo, puro): monta o quadro do mês a partir do planejador de pagamentos, põe e ajusta partes,
  "Montar pra mim", placar, dicas e os conselhos para o plano de ação; confere o plano guardado contra o quadro de agora.
- `src/lib/analise.ts`: `a.quadros` (este mês e o próximo) e os passos `planejamento:*` no plano de ação.
- `src/lib/useDados.ts`: `planejamento` e `salvarPlanejamento` (aparelho na hora; banco em `perfis.consultor.planejamento`
  depois de parar de mexer). As gravações da memória e do gosto passaram a levar o plano junto, para uma não apagar a outra.
- `src/components/Planejamento.tsx` e `planejamento.css` (novos): a mesa e o cartão do Consultor.
- `src/pages/Analise.tsx` e `src/movel/telas/ConsultorMovel.tsx`: o cartão, o botão Planejar e os passos que abrem a mesa.
- `src/components/Painel.tsx`: passa o plano para a análise e não trata mexer no plano como mudança nos dados.
- Traduções em inglês e espanhol; documentação em `docs/arquitetura-do-painel.md` (4.7.1).

**Banco.** Nenhuma migração: usa a coluna `perfis.consultor` (migração 24).

**Validação.** `npx tsc -b`, `npm run lint` (sem erro), `node scripts/painel/testar.mjs` (36 de 36, com o caso novo do
planejamento) e `scripts/app-de-demonstracao/testar-planejamento.cjs` (40 verificações, temas escuro e claro, computador e
celular).

**Observação.** O trabalho foi feito num worktree próprio (`claude/planejamento`) porque outra sessão estava editando os
mesmos arquivos na pasta principal ao mesmo tempo.
### 19/11/2026 — Claude — App Android 2.8.3 (código 21)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.3-codigo21.aab`, na Área de Trabalho do dono). Falta o dono
assinar com a chave de upload (ele digita a senha; o Claude não digita senhas) e enviar no Play Console. Substitui a 2.8.2
(código 20) se ela ainda não foi enviada.

- Leva a abertura nova e a montagem ao vivo do Consultor (#248). `versionCode` 20 → 21, `versionName` 2.8.2 → 2.8.3.
- Conferido: o código novo (`abertura-orbita`, `an-varredura`), "2.8.3" no manifesto e o Supabase de produção no pacote.
- Para assinar: baixar `opuscash-upload.keystore` do Drive e rodar
  `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore opuscash-upload.keystore OpusCash-2.8.3-codigo21.aab opuscash`
  (o `jarsigner` está em `~/tools/jdk-21.0.12.1+1/bin`); depois apagar a chave.

### 19/11/2026 — Claude — Abertura em 3D: o infinito com as peças do app em órbita

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android leva a abertura dentro dele: só recebe
numa versão nova (esta sessão rodou na nuvem, sem o SDK do Android; o `.aab` fica para uma sessão na máquina do dono).

- Relato do Edigar: a abertura nova (#248) "travava" e estava feia; pediu algo em 3D, usando as peças que flutuam no topo
  da página inicial, e algo em 3D também na saída.
- Causa do travamento: ela animava `clip-path`, `filter: blur` e um giro dentro de um SVG. O navegador só mexe nisso no
  mesmo trabalho (main thread) que monta o painel, então a animação parava justo durante o carregamento.
- Agora (`components/Abertura.tsx` + `abertura.css`): o símbolo do infinito com espessura (10 camadas da mesma imagem) chega
  girando e fica balançando; as peças da página inicial (`PecaOpus`, exportada de `pages/FundoOpus.tsx`) saem de dentro
  dele e giram numa órbita inclinada, sempre de frente para quem olha, passando por trás e pela frente do símbolo. Na
  saída a órbita recua, se abre e as peças voam para fora; o infinito recua e vem para cima de quem olha; o fundo some.
  Só `transform` e `opacity`. Nada de opacidade no meio da cadeia 3D (achataria a cena) nem `drop-shadow` em camada 3D
  (é cortado num retângulo): o brilho atrás do símbolo é um degradê. Celular: órbita menor e mais inclinada.
- Lógica de quando entra e sai (lib/abertura.ts, `MINIMO`, `FOLGA`) igual; `MINIMO` 1,5 s → 1,6 s e `SAIDA` 0,76 s → 1 s.
- **Validação:** `npx tsc -b`, `npm run lint` (sem erro), build com Supabase fictício. App de demonstração com os dados
  atrasados de propósito, 1440×860 e 390×844, escuro e claro: quadros da entrada e da saída (a saída congelada em
  0/250/450/650/850 ms), sem erro na página. Trava proposital do JavaScript da página: com 1,2 s de trava no meio do
  carregamento saíram 29 quadros diferentes, e com 0,7 s de trava na saída, 17 (a animação segue mexendo).
  Animações reduzidas: cena parada e a abertura sai quando carrega.

### 19/11/2026 — Claude — Abertura em 3D: sem engasgos no caminho

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android só recebe numa versão nova.

- Relato do Edigar: a abertura em 3D (#252) estava boa, mas "não ta liso", com pequenos engasgos no caminho.
- Medido com o rastro do Chrome (app de demonstração, abertura inteira): a luz atrás do símbolo (`.ab-luz`, 980 px) era
  redesenhada o tempo todo (3.755 tarefas de raster, ~2 s de raster numa abertura de 5 s). Causa: duas animações de
  `transform` no mesmo elemento (acender + respirar), que o navegador não passa para a placa de vídeo. Agora a caixa acende
  e o `::before` respira (uma animação por elemento, com `will-change`). Lição: nunca duas animações de transform no mesmo
  elemento.
- Saída: as 9 camadas de trás do infinito somem logo no começo (antes, dez imagens do tamanho da tela empilhadas) e ele
  avança até 840 px em vez de 1000.
- Fontes: a cena espera as fontes do nome e das peças (`fontesProntas`, no máximo 0,5 s) para não trocar de fonte no
  meio da animação; o tempo mínimo conta a partir daí.
- **Validação:** raster total 1.971 ms → 248 ms (zero durante a órbita), quadros perdidos 26 → 4 (os que sobram são da
  carga da página, antes da abertura), sem buracos entre quadros na saída. Trava proposital do JavaScript: 29 quadros
  diferentes em 1,2 s no carregamento e 22 em 0,7 s na saída. Animações reduzidas: sai quando carrega. `npx tsc -b`, lint
  sem erro, build, `scripts/painel/testar.mjs` 36/36. Fotos da entrada e da saída nos dois temas, computador e 390 px.

### 19/11/2026 — Claude — Abertura em 3D: pulinhos no celular

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração. O app Android só recebe numa versão nova.

- Relato do Edigar: depois de #253 melhorou, mas ainda havia pulinhos, pelo menos no celular.
- Medido no app de demonstração como celular (390×844, densidade 3, processador 4× mais lento), com marcas das fases da
  abertura no rastro. A órbita já não perdia quadros; os 22 quadros perdidos estavam todos na **saída**, e vinham do
  painel embaixo: (1) os gráficos (Chart.js) e os números que contam (`Numero`) animavam quadro a quadro em JavaScript,
  escondidos atrás da cortina; (2) transições de cor do topo do celular (fundo e texto dos botões) duravam ~0,9 s. Cor e
  canvas não andam na placa de vídeo: cada quadro deles fazia a página recalcular, pintar e reenviar tudo, roubando
  quadros da saída.
- `lib/abertura.ts`: `marcarAberturaNaTela` (só a abertura chama, de entrar até sair de vez) e `depoisDaAbertura(f)`.
  `CaixaDoGrafico` (Graficos.tsx) e `Numero` esperam a abertura sair para começar: agora a entrada deles é vista. Enquanto
  ela está na tela, `html[data-abertura]` desliga as transições do painel (`abertura.css`); as cores mudam na hora.
- Saída mais leve no celular: a perspectiva lá é 900, e avançar o símbolo 840 px o deixava ~15× maior (camadas de
  milhares de pixels). Agora `--sai-z`, `--abre-z` e `--abre-esc` por aparelho (celular: 600 px, 90 px e 2,3). A entrada
  das peças e do símbolo não cresce mais a partir de quase nada (isso obrigava a redesenhá-las); a luz no celular tem
  150vmin em vez de 980 px.
- **Validação:** saída no celular simulado: quadros perdidos 22 → 0/1, maior intervalo entre quadros 31 → 17–19 ms,
  envios de quadro 157 → 35–48 ms; os quadros perdidos que sobram são do painel depois que a abertura sai. Depois da
  abertura: o atributo sai, o gráfico é criado e os números contam até o valor certo (computador e 390 px, sem erro de
  página). Animações reduzidas: sai quando carrega. `npx tsc -b`, lint sem erro, build, `scripts/painel/testar.mjs` 36/36,
  `testar-movel.cjs` 379 OK.
- Lição de teste: esperar `.abertura` sumir sem antes esperar ela aparecer passa na hora (a página ainda nem montou).

### 19/11/2026 — Claude — Abertura: o infinito não desce mais

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração.

- Relato do Edigar (duas capturas do celular): o infinito "dá uma descida" perceptível. Causa: o balanço (`ab-balanca`)
  começava 1,1 s depois, sem `fill` para trás, e o primeiro quadro dele vinha 4 px abaixo e inclinado 6°: no começo do
  balanço o símbolo pulava para baixo, e depois subia e descia o tempo todo. Agora o balanço é só `rotateY(±22°)`,
  com `both`, começando da posição em que o símbolo para.
- **Validação:** posição vertical do símbolo medida a cada 60 ms no app de demonstração (390×844) depois da chegada:
  variação 0 px. `npx tsc -b`, build.

### 19/11/2026 — Claude — Planejamento: dívida do Mercado Pago aparecia repetida

**Problema (relatado pelo dono, testando no celular).** No Planejamento apareciam várias fichas "Mercado Pago" iguais.
Conferido nos dados dele (só leitura): é uma dívida só, feita de 5 compras parceladas, com 16 parcelas atrasadas que vencem
em 6 dias diferentes. O calendário da dívida junta as parcelas por dia, e cada dia virava uma ficha com o mesmo nome. Além
disso, a mesma dívida aparecia de novo como "adiantar a dívida": por não ter parcela fixa, o motor a tratava também como
dívida aberta.

**Correção.** `lib/planejamento.ts`: as parcelas atrasadas da mesma dívida viram uma ficha só (`juntas`: quantas parcelas
de verdade e o vencimento médio pelo valor, de onde conta o custo); a do mês fica à parte. As parcelas levam o id da dívida
(`grupo`) e quantas compras vencem no dia (`pecas`) de `lib/analise.ts` até `lib/planejador.ts`. Dívida com compras
parceladas (`partes`) não conta mais como dívida aberta (`semParcelaFixa` em `lib/analise.ts`), no Planejamento e no
planejador de pagamentos.

**Validação.** `npx tsc -b`, `npm run lint` (sem erro), `node scripts/painel/testar.mjs` 37/37 (caso novo com uma dívida de
várias compras), `testar-planejamento.cjs` 40/40, `testar-movel.cjs` sem falha e o app de demonstração com uma dívida
fictícia no formato da dele: uma ficha só, "8 parcelas atrasadas, desde 2 de mar".

### 19/11/2026 — Claude — Abertura congelada no computador

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração.

- Relato do Edigar: a animação acontecia no celular e ficava congelada no computador. Causa: `abertura.css` desligava
  tudo com `@media (prefers-reduced-motion: reduce)`, e no Windows esse aviso vem de "Efeitos de animação" desligado. O
  app já tinha decidido não obedecer o aviso do sistema (`lib/tema.ts`): quem quer menos movimento escolhe em
  Configurações. Agora a abertura só para com `data-movimento='reduzido'`.
- **Validação:** app de demonstração com `reducedMotion: 'reduce'` (como o Windows assim): a órbita gira; com
  "Animações reduzidas" do app, para; a abertura sai nos dois casos.

### 19/11/2026 — Claude — App Android 2.8.5 (código 23)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.5-codigo23.aab`), entregue ao dono pela conversa da sessão.
Falta ele assinar com a chave de upload e enviar no Play Console. Substitui a 2.8.3 e a 2.8.4 se ainda não foram enviadas.

- Primeira versão gerada na nuvem: Android SDK instalado na sessão (`platforms;android-36`, build-tools 35 e 36) e
  `sdk.dir=/opt/android-sdk` em `android/local.properties` (fora do git). `npm run app` e `./gradlew bundleRelease`.
- Leva a abertura em 3D e as correções de fluidez, da descida do símbolo e do congelamento (#252 a #255 e o PR desta
  entrada), além do Planejamento (#250, #256). `versionCode` 22 → 23, `versionName` 2.8.4 → 2.8.5.
- Conferido dentro do pacote: o CSS novo da abertura (balanço só de lado, sem o bloqueio do sistema), o `data-abertura`
  no código e o Supabase de produção.
- Para assinar: baixar `opuscash-upload.keystore` do Drive e rodar
  `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore opuscash-upload.keystore OpusCash-2.8.5-codigo23.aab opuscash`
  (o `jarsigner` está em `~/tools/jdk-21.0.12.1+1/bin`); depois apagar a chave.

### 19/11/2026 — Claude — Planejamento: usar o dinheiro guardado

**Estado:** veja a conversa da sessão para PR e deploy. Sem migração (a escolha fica em `perfis.consultor.planejamento`,
migração 24).

- Pedido do Edigar: no Planejamento do mês (Consultor), poder usar o dinheiro guardado para abater dívidas, se quiser.
- `lib/planejamento.ts`: `Quadro.guardados` (uma barra por banco com caixinha ou reserva, e os investimentos; só em Este
  mês), `comGuardado()`/`quadroDoPlano()` põem essas barras nas `fontes` quando o plano do mês tem `comGuardado`. Guardado
  não vai para meta nem para "Guardar" (`podeIr`). "Montar pra mim" tira do guardado só o que o dinheiro do mês não paga a
  tempo e não adianta dívida com ele (à mão pode). `placar.doGuardado`; o guardado que sobra não é "sem destino". Dicas
  `usar-guardado` (com o botão de ligar) e `tirou-do-guardado`. `lib/analise.ts` monta os guardados de `ef.caixa`
  (caixinha + reserva) e `investido`, com o nome do banco (`bancos` novo em `EntradaAnalise`, passado pelo Painel).
- `components/Planejamento.tsx`: o interruptor "Usar o dinheiro guardado" entre o dinheiro do mês e as barras do guardado
  (tracejadas, ícone de cofre); desligar tira do plano o que saía dele. Regras em `docs/arquitetura-do-painel.md` (4.7.1).
- **Validação:** `scripts/painel/testar.mjs` 38/38 (caso novo "usar o dinheiro guardado"), `testar-planejamento.cjs` 40 OK,
  `npx tsc -b`, lint sem erro, build, traduções completas. App de demonstração (1440 escuro e 390 claro): o interruptor
  aparece com o total, ligado entram "Guardado: Nubank" e "Investimentos", o plano lembra a escolha depois de recarregar,
  desligar tira as barras, sem erro de página.

### 19/11/2026 — Claude — App Android 2.8.6 (código 24)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.6-codigo24.aab`), entregue ao dono pela conversa da sessão.
Substitui a 2.8.5 (código 23), que não chegou a ser assinada. Falta assinar com a chave de upload (o dono digita a senha)
e enviar no Play Console.

- Leva tudo da 2.8.5 mais o dinheiro guardado no Planejamento. `versionCode` 23 → 24, `versionName` 2.8.5 → 2.8.6.
- Conferido dentro do pacote: o texto "Usar o dinheiro guardado", nenhum `fake.supabase` e o manifesto com 24 / 2.8.6.

### 19/11/2026 — Claude — Planejamento: Consultor no canto esquerdo e Salvar/Descartar

**Pedido do dono.** No computador sobrava espaço à esquerda da mesa; ele pediu para pôr ali o que o Consultor diz, e
botões de salvar e descartar.

**O que mudou** (`components/Planejamento.tsx`, `planejamento.css`).
- A grade da mesa ganhou áreas: de 1360 px para cima, três colunas (Consultor à esquerda, fixo na rolagem; dinheiro;
  bandeja). Abaixo, o Consultor vai para baixo da bandeja; no celular, depois das entradas. O quadro do Consultor ganhou
  um avatar com um anel pulsando.
- O plano deixou de se gravar sozinho: a mesa é rascunho até **Salvar plano**. **Descartar** volta ao último salvo.
  Fechar ou trocar de mês com mudança pergunta (Salvar e sair, Continuar mexendo, Sair sem salvar); recarregar avisa pelo
  navegador.

**Validação.** `npx tsc -b`, `npm run lint` (sem erro), `node scripts/painel/testar.mjs` 38/38 e
`testar-planejamento.cjs` 54/54 (novos: o Consultor à esquerda em 1440 px, a pergunta ao fechar, Continuar mexendo,
Salvar, Recomeçar + Descartar volta ao salvo, X fecha direto sem mudança), `testar-movel.cjs` sem falha.

### 21/11/2026 — Claude — Backup: quebrava em todos os aparelhos ("[object Object]") e não dava sinal no iPhone

**Problema (relatado pelo dono, no iPhone).** Tocar em Baixar backup não fazia nada; ao voltar apareceu "Detalhe: [object Object]".

**Causa.** `exportarBackup` (`lib/planilha.ts`) lia `meses` ordenando por `id`, coluna que a tabela não tem (a chave é `user_id, ano, mes`;
conferido no banco de produção). O Supabase respondia 42703 e o erro, um objeto simples, virava "[object Object]". Quebrava desde o #210
(computador, Android e iPhone). O servidor falso ignorava `order`, por isso nenhum teste pegou. Além disso o aviso geral ficava por trás da
janela de Configurações, então a pessoa só o via ao fechá-la.

**O que mudou.** `buscarTudo` aceita as colunas de ordem (`meses`: `ano, mes`) e repete uma vez só em falha de rede; `lib/textoDoErro.ts`
(novo) lê `message/details/hint/code` e substitui `e instanceof Error ? e.message : String(e)` em Painel, Configurações, Extrato, Suporte,
Importar e `ArquivoPronto`; Configurações mostra "Preparando o backup…" e o erro dentro da própria janela. No iPhone/iPad o arquivo fica pronto
e a folha "Backup pronto" (`lib/arquivoPronto.ts`, `components/ArquivoPronto.tsx`) abre o compartilhar no segundo toque (o download tardio é
ignorado pelo iOS). Servidor falso: opção `ordemEstrita` (liga o 42703 de ordem por coluna inexistente); teste novo `testar-backup.cjs`.

**Validação.** `tsc -b`, lint, `testar.mjs` 38/38, `testar-backup.cjs`, e as suítes planejamento, contas, correções e móvel sem falha.
Com o `planilha.ts` antigo o `testar-backup.cjs` falha; com o novo passa. **Não testado em iPhone de verdade.**


### 21/11/2026 — Claude — Dívidas: histórico das conferências com o banco e ícone novo

**Pedido do dono.** Quando ele usa "Conferi com o banco" e a dívida mudou (diminuiu ou aumentou), isso precisa ficar
registrado: estava tanto, o banco mostrou tanto, em tal dia; o consultor também precisa saber. E o ícone de Dívidas era
igual ao de Cartões.

**O que mudou.**
- `supabase/migracao-37-conferencias-da-divida.sql` (tabela `divida_conferencias`: dia, `antes`, `depois`, origem).
  **Precisa rodar no Supabase**; sem ela o app funciona como antes e mostra um aviso na ficha da dívida.
- `useDados.conferirDivida` grava uma linha a cada conferência (`antes` = o que o app mostrava, com juros estimados;
  `depois` = o valor do banco). No modo `pagar` (acerto antes de um pagamento) só grava se o valor mudou.
- `lib/conferencias.ts` (puro) e `components/ConferenciasDaDivida.tsx`: lista na ficha da dívida (PC e celular usam a
  mesma `Ficha`), com "caiu/subiu R$ X (−Y%)" e botão de excluir.
- `lib/conselheiro.ts`: regra `divida-mudou:<id>` (conferência dos últimos 45 dias com mudança de 3% ou mais; caiu =
  elogio, subiu = atenção). Entrada nova opcional `conferencias`.
- Ícone `divida` virou um recibo (era um cartão, igual ao de Cartões). Backup em planilha ganhou a aba "Conferências".
- Pendente: o Consultor completo (`lib/analise.ts`) ainda não lê o histórico; só o conselheiro lê.

**Validação.** `npx tsc -b`, lint sem erro, build, traduções completas, `testar.mjs` 38/38; app de demonstração: conferir
R$ 9.000 numa dívida estimada em R$ 7.697 gravou e mostrou "subiu R$ 1.302,95 (+16,9%)".

### 21/11/2026 — Claude — "Quem está usando?": a tela de contas virou uma escolha de perfis com cenas do app

**Pedido do dono.** Redesenhar a tela de escolher a conta inspirada na escolha de perfis de um serviço de vídeo (fotos
de tela do computador e do celular): o símbolo do OpusCash no canto e, no fundo, no lugar do pôster, animações em 3D em
loop mostrando o que o app faz (lançamentos com o calendário e várias moedas, consultor montando a tela, contas do mês com o
pote enchendo, cartões e faturas, dívidas, metas, dinheiro guardado, resumo do ano e investimentos).

**O que mudou.**
- `components/EscolherConta.tsx` + `perfis.css`: a tela nova (antes era a lista no cartão de login, em `Contas.tsx`).
  Computador: fileira de quadros + "Gerenciar contas"; celular: folha curva com três por linha, "Outra conta" e "Editar".
  Editar mostra a lixeira; tocar tira a conta do aparelho (mesmo `esquecerConta` de antes). Sessão vencida: selo "Pede a senha".
- `components/CenasDoOpus.tsx` + `cenas-opus.css` (arquivo à parte, carregado só nessa tela): as nove cenas, com marcas
  clicáveis e o nome de cada cena. Valores inventados. Respeita as animações reduzidas.
- `lib/abrirConta.ts`: `nomeDe`, `iniciaisDe` e `abrir` saíram de `Contas.tsx` (usados pelo menu e pela tela nova).
- Armadilha encontrada: `.so-largo` já existe no `index.css` (`display: contents`); a classe das cenas é `cn-so-largo`.
- `scripts/app-de-demonstracao/testar-contas.cjs` atualizado para a tela nova, com o "Editar" do celular.

**Validação.** `npx tsc -b`, lint sem erro novo, build, traduções completas (0 faltando), `testar-contas.cjs` 40/40.
Fotos no app de demonstração em 1600×900, 1366×768 (cinco contas, tema claro, editando) e 390×844 (escuro, claro e
animações reduzidas), as nove cenas sem erro no console. **Não testado em celular de verdade** (desempenho do 3D em
aparelho fraco não medido).

### 21/11/2026 — Claude — App Android 2.8.7 (código 25)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.7-codigo25.aab`), entregue ao dono pela conversa da sessão.
Falta assinar com a chave de upload e enviar no Play Console. Substitui a 2.8.6 (código 24) se ela ainda não foi enviada.

- Leva a tela "Quem está usando?" com as cenas (#265) e tudo o que entrou desde a 2.8.6 (#262 a #264: backup e dívidas).
- `versionCode` 24 → 25, `versionName` 2.8.6 → 2.8.7. SDK instalado na sessão como na 2.8.5 (`/opt/android-sdk`).
- Conferido dentro do pacote: os arquivos `CenasDoOpus`, o texto "Quem está usando?" e nenhum `fake.supabase`.

### 21/11/2026 — Claude — Perfis: "Sair" volta aos perfis, "Manter conectado", tela de senha e transições

**Pedido do dono.** "Sair" no painel volta para a tela de perfis e a conta continua lá; tirar a conta só pelo "Gerenciar
contas". Nos perfis, um botão para a apresentação. No login, "Manter conectado": ligado, o perfil abre direto; desligado, tocar
no perfil abre uma tela própria pedindo só a senha (e-mail já preenchido, peças do OpusCash em 3D no fundo, resposta visual).
Escolher o perfil: o quadro vai para o centro em 3D, some e entra a abertura. Sem contas no aparelho, ir para o login.
Transições entre perfis, login/criar conta e apresentação.

**O que mudou.**
- `lib/contas.ts`: `manter` em cada conta, `manterNaEntrada` (a escolha feita no login vale para a conta que entrar),
  `pedeSenha`, `sairParaOsPerfis` (com manter: tira a sessão só deste aparelho e recarrega; sem: encerra e marca "pede a
  senha"), `trocarPara(id, antesDeRecarregar)`, `esperarAntesDeRecarregar` e `aoMudarSessao` devolvendo se vai recarregar.
  Sem manter, a lista não guarda os tokens e, ao reabrir o app (aba nova, sem sinal de outra aba em 45 s), a sessão sai
  antes de o Supabase lê-la. Contas antigas (sem o campo) ficam conectadas.
- `components/SenhaDaConta.tsx` + `senha-da-conta.css` (tela de senha); `EscolherConta.tsx` (voo do quadro com verso do
  símbolo, botão "Início"); `Entrada.tsx` (`ChaveManter`); menu da conta sem o "x"; `App.tsx` (`trocarDeTela` com
  View Transitions, apresentação a partir dos perfis, login quando a última conta sai, limpeza da marca de login no histórico).
- Defeitos achados no caminho: sair sem manter não recarregava (o painel aparecia cortando a animação de acerto); o histórico
  guardava "estava no login" depois de entrar e sair, e o voltar a partir da apresentação caía no login.
- Ficou como antes: visitante sem nenhuma conta no aparelho continua vendo a apresentação em `opuscash.com.br`.

**Validação.** `npx tsc -b`, lint sem erro, build, traduções completas, `testar-contas.cjs` 48/48 (inclui sair e voltar sem
senha, manter desligado, senha errada e certa, reabrir o app, sessão vencida, Início e voltar, Gerenciar e a última conta).
Fotos no app de demonstração (PC 1440×900 e celular 390×844): voo, tela de senha, transição para o login e login com a chave.
**Não testado em celular de verdade.**

### 21/11/2026 — Claude — App Android 2.8.8 (código 26)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.8-codigo26.aab`), entregue ao dono pela conversa da sessão.
Substitui a 2.8.7 (código 25) se ela ainda não foi enviada. Falta assinar com a chave de upload e enviar no Play Console.

- Leva os perfis com "Manter conectado", tela de senha e transições (#270), além de #267 a #269 (sino, Invest).
- `versionCode` 25 → 26, `versionName` 2.8.7 → 2.8.8. Conferido no pacote: o texto "Manter conectado" e nenhum `fake.supabase`.

### 21/11/2026 — Claude — Abrir o app: login para quem não tem conta; perfis com duas ou mais contas

**Pedido do dono.** Visitante novo vai direto para o login. Com duas contas ou mais no aparelho, abrir o app cai sempre nos
perfis; se o sistema perceber que uma conta é quase sempre a usada, entra direto nela; se a pessoa alterna, mostra os perfis.

**O que mudou.** `lib/contas.ts`: `escolherAoAbrir` (na abertura do app, antes de o Supabase ler a sessão) e `contaDeSempre`
(70% das últimas 10 aberturas, com pelo menos 5). As aberturas ficam em `opuscash.aberturas` (escolha de perfil, entrada com
senha, abertura direta). "Acabou de abrir" é a mesma regra do "Manter conectado": aba nova e nenhuma outra com sinal em 45 s;
recarregar não conta. `App.tsx`: sem contas, o login (com "Início" para a apresentação; no app Android, sem botão).

**Validação.** `npx tsc -b`, build, `testar-contas.cjs` 53/53 (visitante novo no login, "Início" do login, alternando abre os
perfis, quase sempre a mesma abre direto).

### 21/11/2026 — Claude — App Android 2.8.9 (código 27)

**Estado:** `.aab` gerado **sem assinatura** (`OpusCash-2.8.9-codigo27.aab`), entregue ao dono pela conversa da sessão.
Substitui a 2.8.7 e a 2.8.8 se ainda não foram enviadas. Leva a abertura com perfis (duas ou mais contas) e o login direto
sem contas. `versionCode` 26 → 27, `versionName` 2.8.8 → 2.8.9. Conferido no pacote: `opuscash.aberturas` e nenhum `fake.supabase`.

### 21/11/2026 — Claude — Perfis no celular: sem a barra de rolagem; app 2.9.0 (código 28)

**Pedido do dono** (foto do iPhone): a barra branca de rolagem aparecia por cima da tela de perfis. A tela passava 20 a 30 px
da altura útil quando o Safari mostra as barras dele (o palco tinha altura mínima de 330 px). Agora a tela tem a altura do
celular (`100dvh`), o palco encolhe até 250 px, em celular baixo o texto da cena some e os espaços diminuem; se ainda assim
não couber (muitas contas), rola por dentro sem a barra. Medido em 390×844, 390×664, 375×667 e 430×932 com 2, 3 e 5 contas:
a página não rola mais. `testar-contas.cjs` 53/53. App 2.9.0 (código 28), `.aab` sem assinatura entregue pela conversa;
substitui a 2.8.7, 2.8.8 e 2.8.9 se ainda não foram enviadas.
