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
