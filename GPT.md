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
