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
- A preparação do commit e do branch de correções foi iniciada. O estado de envio deve ser conferido no GitHub.
- A API do GitHub (`api.github.com`) e a conferência do site (`www.opuscash.com.br/versao.json`) retornaram bloqueio
  da rede do ambiente. O acesso Git ao origin funcionou. Isso ainda não confirma acesso à API nem publicação.
- Foram adicionados ao rascunho de rede os domínios `api.github.com` e `www.opuscash.com.br`, preservando
  `cdn.sheetjs.com`; aplicar as configurações é necessário para tentar abrir/mesclar o PR e verificar o site.
- Nenhum PR, merge ou deploy foi confirmado neste registro. Não considerar a correção publicada só porque há commit.
