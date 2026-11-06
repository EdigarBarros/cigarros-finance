# Arquitetura do painel e guia de linguagem

Este documento explica **o que a Início mostra, em que ordem e por quê**, e fixa o vocabulário do app inteiro.
Vale para quem nunca controlou dinheiro e para quem quer ver cada número.

## 1. Diagnóstico (como estava)

| Problema | Onde | Efeito na pessoa |
| --- | --- | --- |
| Rótulos em CAIXA ALTA e jargão de planilha: "FLUXO DE CAIXA", "MÉTRICAS - OUTUBRO", "QUADRO", "CAIXA", "RESTANTE", "QUITAÇÃO" | `Blocos.tsx`, `Inicio.tsx`, `Graficos.tsx`, `index.css` (`text-transform: uppercase`) | Parece contabilidade. O leigo não sabe o que é "caixa" nem "fluxo". Texto em maiúsculas é mais lento de ler e soa como grito |
| Até 7 indicadores no topo (Entrou, Saiu, Guardado, Falta pagar, Investido, Outras moedas, Metas) com o mesmo peso | `kpis` em `Inicio.tsx` | Nenhum se destaca. Passa de 4 itens, a pessoa deixa de comparar e só varre |
| Muitos blocos do mesmo tamanho e da mesma cor, sem ordem por importância (dívidas, por banco, caixa, moedas, metas empilhados) | `essencial` e `completo` em `Inicio.tsx` | Sem hierarquia, tudo pede atenção ao mesmo tempo |
| O resultado do mês mistura duas ideias ("Sobrou R$ X no mês. Dívidas: R$ Y.") e o rótulo muda de nome conforme o modo ("Fluxo de caixa" / "Resultado de") | `hero` | A frase mais importante da tela carrega ruído |
| Gráfico anual com 6 séries (2 barras e 4 linhas em escalas diferentes), valores de patrimônio e de fluxo no mesmo eixo | `GraficoAnual` | Ilegível. A linha de dívida domina e esconde as barras que importam |
| Tabela do ano repetida na Início e na página Ano; quadros de Entradas e Saídas repetem a página Lançamentos | `TabelaAnual`, `QuadroLancamentos` | Mesma informação em dois lugares: a tela cresce sem a pessoa saber mais |
| Três blocos para o mesmo assunto "bancos" (Por banco, Caixa, Outras moedas) | `PorBanco`, `QuadroCaixa`, `BlocoMoedas` | Fragmenta o que a pessoa lê como uma coisa só |
| Dívida no topo como indicador vermelho/amarelo e na frase principal | `Kpi` "Falta pagar", `hero-sub` | Ansiedade logo na primeira olhada, sem mostrar o progresso nem o que fazer |
| Sugestão roxa e cheia de brilho acima do resultado do mês | `CartaoSugestao` antes do `hero` | Rouba o primeiro olhar da informação principal |
| "Visão geral" no menu e "Início" na aba; "Entradas/Entrou", "Apagar/Excluir", "Caixa/Guardado", "pagar/Registrar pagamento" misturados | `Painel.tsx`, formulários | A mesma coisa com dois nomes obriga a pessoa a traduzir |
| Datas "2-out", "mar/27", "11-out" | `format.ts`, blocos | Formato de planilha, não de conversa |
| Estado vazio mostra caixas zeradas (indicadores, gráfico, listas) | `Inicio.tsx` | Conta nova vê um painel cheio de zeros e nada a fazer |

## 2. Princípios e regras práticas

1. **Hierarquia visual e leitura em F/Z.** O olhar começa no canto superior esquerdo, desce pela borda esquerda e só entra nos blocos se algo prender.
   Regra: um único elemento gigante por tela (o resultado do mês, no alto à esquerda); as ações ficam no canto oposto da mesma linha (Z); cada zona abaixo tem um título de tamanho único.
2. **Lei de Hick (menos escolhas, decisão mais rápida).** Regra: no máximo 1 botão principal por bloco; a primeira tela do modo simples tem 3 números, não 7; o que não é decisão de hoje fica em "Ver tudo".
3. **Lei de Miller e carga cognitiva.** Regra: no máximo 4 indicadores no topo (6 só no detalhado, em duas linhas de 3); blocos do mesmo assunto viram um (3 de bancos viram "Dinheiro guardado"); nunca mais de 4 zonas visíveis ao mesmo tempo.
4. **Cada jeito de ver atende uma pessoa.** O **simples** é para quem não entende de finanças e tem a sua própria tela (o mês em palavras, uma lista única do que fazer, nenhum gráfico; veja 4.1). Entre o **equilibrado** e o **detalhado** vale a revelação progressiva: cada bloco tem o mesmo nome e a mesma posição nos dois, e subir de nível só acrescenta linhas, colunas, comparações e gráficos *dentro do mesmo bloco*.
5. **Proximidade e semelhança (Gestalt).** Regra: blocos que respondem à mesma pergunta ficam juntos, com espaço menor entre si (14 px) e maior entre perguntas diferentes (28 px); todo número de dinheiro usa a mesma fonte; verde é só entrada/progresso, vermelho só saída, amarelo só atenção; o gradiente índigo → verde-água do símbolo OpusCash é o destaque do app.
6. **Aversão à perda e enquadramento.** Regra para dívida e atraso: mostrar o problema **inteiro** (valor, prazo) mas junto do progresso e do próximo passo. "Você já pagou 42%" antes de "faltam R$ 4.800"; "Venceu dia 5" com botão "Pagar", nunca "ATRASADA!" nem vermelho saturado cobrindo o bloco. Resultado negativo vira "Faltou R$ 340" com a frase "saiu R$ 340 a mais do que entrou" e um atalho para ver onde.
7. **Posição serial (primeiro e último são lembrados).** Topo: o resultado do mês e o que vence. Fim: metas (o que a pessoa está construindo). O meio fica com a análise. O que é opcional (sugestão, personalizar) nunca ocupa topo nem fim: a sugestão vem logo abaixo dos indicadores, em faixa fina, e "Personalizar" é um rodapé discreto.
8. **Lei de Fitts (alvos grandes e alcançáveis).** Regra: no computador, as duas ações (Lançar entrada, Lançar saída) ficam no mesmo cartão do resultado, a um movimento do olhar; no celular, o botão "+" fixo de 58 px na zona do polegar (canto inferior direito, acima da barra de abas) faz o papel de ação principal; linhas clicáveis têm 44 px ou mais; "Pagar" e "Guardar" são botões de verdade, não links.
9. **Ancoragem.** Um número só faz sentido perto de uma referência. Regra: o resultado vem com "22% do que entrou" e, a partir do equilibrado, com "R$ 120 a mais que em set"; cada indicador compara com o mês anterior; cada categoria, no detalhado, também.
10. **Controle e otimismo ("o que fazer agora").** Regra: toda zona de alerta termina com um verbo (Pagar, Lançar, Guardar, Adicionar); estados vazios dizem o primeiro passo; contas a vencer aparecem antes de gráficos.
11. **Pico-fim.** A tela termina com algo positivo e acionável: progresso das metas ("27% da viagem, chega em jul de 2027"). Em estado vazio, termina no botão de lançar.

## 3. As perguntas que a Início responde, nesta ordem

1. **Como estou este mês?** Resultado do mês (Sobrou/Faltou) + Entrou + Saiu.
2. **O que preciso fazer, o que vem por aí?** Contas do mês, fatura do cartão, dívidas (próxima parcela e progresso).
3. **Para onde está indo meu dinheiro?** Gastos por categoria + últimos lançamentos.

Depois, só depois: **evolução no tempo** (mês a mês no ano). E por último, **o que a pessoa tem e está construindo**: dinheiro guardado e metas.

Por que essa ordem: a primeira pergunta é a que a pessoa abre o app para responder; a segunda é a única que pede uma ação com prazo; a terceira é análise, útil mas sem pressa; o histórico e o patrimônio mudam devagar e não exigem decisão hoje.

## 4. Especificação por modo

### 4.0 Layout OpusCash (grade da Início)

A grade abaixo é a da **conta nova** (boas-vindas e blocos); cada jeito tem a sua tela: simples (seção 5), equilibrado (4.0.2) e detalhado (4.0.1). A ordem das perguntas continua a mesma; a grade segue o layout do OpusCash:

| Linha | Computador | Celular |
| --- | --- | --- |
| Saudação | "Olá, Nome!" (nome no verde da marca) + resumo do mês à esquerda; data de hoje e **Lançar entrada / Lançar saída** à direita | Só a saudação; lançar fica no "+" |
| Indicadores | Cartões com ícone: **Sobrou/Faltou** (cartão em destaque, com a frase ou a comparação), **Entrou no mês**, **Saiu no mês**, `kpisExtras`; sobrando lugar na linha de 4, a meta mais adiantada entra como 4º cartão | 2 por linha |
| O que fazer | Contas, cartões, dívidas (igual) | Igual |
| Fluxo | **Fluxo financeiro** (barras Entrou e Saiu lado a lado e a linha brilhante do que sobrou, nos últimos 6 meses, a partir do equilibrado) + **Últimos lançamentos** (5; detalhado: Lançamentos do mês) | Um embaixo do outro |
| Análise | **Para onde foi o dinheiro** (rosca + legenda com %; lista com barras no simples e ao tocar em "Ver valores") + **Suas metas** + banner "Planeje hoje, conquiste amanhã" | Sem banner |
| Guardado | Dinheiro guardado | Igual |

Encaixe sem vãos (`components/Encaixe.tsx`): "O que fazer" e a análise (categorias, metas, dinheiro guardado) ficam em duas
colunas que terminam na mesma altura. O componente mede cada bloco, testa as divisões possíveis (mantendo a ordem de leitura em
cada coluna) e escolhe a que deixa a menor sobra; quem estica para alinhar o fim das colunas é, de preferência, um cartão
**elástico**: o banner "Planeje hoje, conquiste amanhã" (junto do "O que fazer") e o cartão **Acompanhe mais** (módulos
desligados em blocos com ícone, que crescem junto). Os blocos só trocam de coluna quando muda o mês, o jeito de ver ou a quantidade
de itens, para nada pular de lugar enquanto a pessoa mexe. O gráfico de fluxo estica até a altura dos lançamentos ao lado.
Na Início as listas têm teto (dívidas: 3 no simples, 4 nos outros; lançamentos: 5, ou 7 no detalhado) e "Ver todas" leva à página
completa. Com 5 ou 6 indicadores, os cartões ficam mais baixos, 3 por linha.

**Mês de hoje conta só até hoje.** Nos três jeitos (o resumo do simples, o cartão do mês do equilibrado e do detalhado), o mês que está correndo
mostra **Sobrou/Faltou até hoje**, **Entrou até hoje** e **Saiu até hoje**: lançamento com data depois de hoje (parcela de
cartão, conta lançada antes de vencer), fatura em aberto e conta fixa sem a baixa ainda não aconteceram (`diaADiaDoMes` em
`lib/previsao.ts`, mesma regra do "Já aconteceu" dos gráficos). Antes, no dia 4 o mês já aparecia com as contas do dia 20 e
um "Faltou" que não tinha acontecido. A comparação com o mês passado some no mês de hoje (até hoje contra o mês inteiro não é
justo).

### 4.0.2 Equilibrado: o mês num olhar (`components/InicioEquilibrado.tsx`)

O meio-termo: tem visual, mas sem gráfico com eixo e sem lista comprida.

| Parte | O que mostra |
| --- | --- |
| O mês | **Sobrou/Faltou até hoje** em número grande, duas barras (entrou e saiu), a pílula do ritmo (gastando menos ou mais que no mês passado) e o quadro **Até o fim do mês** (falta pagar, falta receber, deve sobrar) |
| Próximos 7 dias | O `BlocoParaFazer` do simples só com o que vence até daqui a 7 dias (o atrasado entra), com Paguei/Recebi na linha. Em outro mês, tudo o que está em aberto |
| Resumos com anel | **Dívidas** (quanto já foi pago), **Metas** (média do progresso e a que está na frente) e **Dinheiro guardado**. Tocar leva para a página |
| Embaixo | **Para onde foi o dinheiro** (barras, como no simples) e **Saúde do seu dinheiro** só com o conselho mais importante ("Ver todos" abre o resto) |

Saíram do equilibrado: os indicadores com minilinha, os blocos completos de contas, cartões e dívidas, o fluxo de 6 meses, os
últimos lançamentos, o banner e o "Acompanhe mais".

**A previsão do fim do mês é a mesma nos três jeitos**: o que ainda vai entrar e sair (`diaADiaDoMes`) mais as parcelas de
dívida que vencem no mês, com as atrasadas e os juros de atraso (`parcelasPorDia`).

### 4.0.1 Detalhado: o mês em gráfico e o mosaico (`components/InicioDetalhado.tsx`)

Para o detalhado não virar uma parede de cartões e frases, a tela se lê olhando: ícone, número e cor.

| Parte | O que mostra |
| --- | --- |
| Cartão do mês | **Sobrou/Faltou até hoje** em número grande, **Previsto no dia 30**, a linha **Dívidas: hoje → no dia 30** e o **gráfico do mês** (`GraficoDoMes`): o mesmo gráfico do Resumo do ano, só que com um ponto por **dia** no lugar de um por mês. Entrou e Saiu em barras; a chave **Já aconteceu / O que vem aí** (a mesma do ano, só aparece quando há algo previsto) põe o que ainda vai entrar e sair listrado em cima (as parcelas de dívida já estão em "Vai sair"); a linha **Sobrou no mês** (o que sobrou até cada dia, reta de um dia para o outro, tracejada depois de hoje) e a linha **Dívidas** com a sombra, que começa **escondida** (é muito maior que o dia a dia e achataria as barras; um toque na legenda mostra). Sem balão: tocar (ou passar o mouse) num dia escolhe o dia do **painel ao lado** (embaixo em tela estreita), com setas para andar de um dia para o outro: Entrou, Saiu, Vai entrar, Vai sair, quanto sobrou no mês até ali e as dívidas. Abre em hoje; num mês que já acabou, no último dia com movimento. No eixo, só o dia 1, os redondos (5, 10…; no celular 10, 20…), hoje e o último dia. |
| Números | **Entrou**, **Saiu** (até hoje) e **Gasto por dia** (com as compras no cartão, como o antigo "Gasto médio por dia") |
| O que vem aí | Até 4 contas, faturas e parcelas na ordem do vencimento (atrasadas primeiro), de `tarefasDoMes` |
| Mosaico | Peças **Gastos do mês, Contas do mês, Cartões, Dívidas, Dinheiro guardado, Metas** (só as ligadas), cada uma com ícone, número e bolinha: verde tudo certo, amarela pede atenção, vermelha precisa de você. Tocar abre o bloco completo logo abaixo (Gastos abre categorias e lançamentos), tocar de novo fecha |
| Saúde do seu dinheiro | Igual aos outros jeitos |

Bolinhas: Gastos compara o gasto por dia com o do mês passado (até igual: verde; até 20% a mais: amarela; mais: vermelha).
Contas e Cartões: vermelha com algo atrasado, amarela vencendo em até 3 dias. Dívidas: vermelha com parcela atrasada.

Arrumação (por largura do conteúdo, com container query): **celular** uma coluna e peças 2 por linha; **tablet** gráfico na
largura toda e peças 3 por linha; **computador** gráfico à esquerda, números e "o que vem aí" à direita, peças numa fileira só.
O **Fluxo financeiro** de 6 meses, o banner e o "Acompanhe mais" saíram do detalhado: o fluxo do ano fica no Resumo do ano.

Menos texto, mais sinais: minilinha com os valores reais dos últimos 6 meses nos indicadores (Sobrou, Entrou, Saiu e, no
detalhado, Gasto médio por dia e Maior saída; passando o ponteiro ou o dedo aparece o valor de cada mês), anel com quanto das dívidas já foi
pago, parcela/valor/fim de cada dívida em selos curtos, o dia do vencimento das contas em bloco colorido pela situação, um
cartãozinho na cor de cada cartão de crédito e a variação de cada categoria num selo ao lado do nome.

Animações: o app tem a própria escolha (Configurações → Painel → Aparência → Animações: Completas ou Reduzidas). O "reduzir
movimento" do sistema não desliga mais as animações sozinho. A troca de tema espalha o tema novo como uma mancha de tinta de borda
ondulada a partir do botão (View Transitions; sem elas, uma camada da cor do tema novo faz o mesmo caminho).

**Saúde do seu dinheiro** (`components/BlocoConselhos.tsx`, estilos em `components/conselhos.css`): bloco em largura total, logo
abaixo dos indicadores (e do convite e da sugestão, se houver), antes do "O que fazer". Mostra **todos** os conselhos ativos do
conselheiro (`lib/conselheiro.ts`; o `Painel` calcula uma vez e passa por `Ctx.conselhos`, o mesmo que alimenta o balão do menu
lateral). Cada conselho é um cartão com ícone, selo da gravidade em palavras (**Importante**, **Fique de olho**, **Parabéns**),
o título, o "porque" com os números, um botão com verbo que leva à página de destino e o "Agora não", discreto, que esconde o
aviso até o mês que vem (`Ctx.dispensarConselho`, a mesma regra do "x" do balão). A cor segue a gravidade com as variáveis do app
(urgente = `--saida`, atenção = `--divida`, elogio = `--entrada`) e uma faixa na borda esquerda, para não depender só da cor. Os
urgentes vêm primeiro (o motor já ordena); no computador os cartões ficam em 2 colunas, no celular em 1, com o botão em largura
cheia. No jeito **simples** aparecem os 2 primeiros e "Ver todos" abre o resto; no equilibrado e no detalhado, todos. Sem
conselhos: com dados, "Tudo em ordem por aqui." (e, se a pessoa escondeu avisos neste mês, o lembrete de que voltam no mês que
vem); sem dados (menos de 2 meses fechados com entradas e saídas, `faltamDadosParaConselhos` em `lib/conselheiro.ts`, com o mesmo critério do motor), a frase
que explica o que lançar. Conta nova não vê o bloco. O rodapé diz, em palavras simples, que são orientações gerais calculadas
com o que foi lançado, e não recomendação de investimento.
No canto do cabeçalho do bloco, o selo com a **nota do consultor** (ex.: "66 Razoável", na cor do tom) leva à aba Consultor (4.7).

O resultado do mês deixou de ser um "hero" separado: virou o primeiro cartão, em destaque, mantendo a frase de ancoragem.
O gráfico de 12 meses com as linhas extras continua na página **Resumo do ano**.


Ordem vertical, igual no computador e no celular. A diferença entre as telas é só a grade (veja 4.4).

Legenda: **[M]** só aparece se o módulo estiver ligado. **(slot)** é preenchido por outro componente através do `Ctx`.

### 4.1 Simples: "está tudo bem? o que eu faço hoje?"

Tela própria, para quem não entende de finanças: poucas palavras, números com nome, nenhum gráfico. Código em
`components/Simples.tsx` (resumo e "Para fazer"), `lib/paraFazer.ts` (a lista) e `components/simples.css`; o resto
reaproveita os blocos de `Blocos.tsx`.

| # | Zona | Conteúdo |
| - | --- | --- |
| 0 | Cabeçalho | "Olá, Nome" e "Resumo de outubro de 2026" (sem os botões de lançar: eles ficam no resumo) |
| 1 | **Resumo do mês** (cartão grande) | Selo em palavras: **Mês no azul** (verde), **Mês apertado** (amarelo: sobrou menos de 5% do que entrou ou, pagando o que falta, não fecha) ou **Mês no vermelho** (saiu mais do que entrou). "Sobrou em outubro" (ou "Faltou") em número grande, a frase de ancoragem e uma barra só: a barra inteira é o que entrou, o que saiu pinta por cima (listrado quando passa do que entrou). Ao lado (embaixo no celular), só no mês atual: **Até o fim do mês**: "Ainda falta pagar" (contas e parcelas do mês), "Ainda falta receber" (contas que entram) e **Deve sobrar / Pode faltar**. Botões **Lançar entrada** e **Lançar saída**, grandes, também no celular |
| 2 | Convite para importar e sugestão (se houver) | Como nos outros jeitos |
| 3 | **Para fazer** [M contas, cartões ou dívidas] | Uma lista só, na ordem do vencimento: contas em aberto ("Paguei"/"Recebi"), faturas a pagar ("Ver fatura") e parcelas de dívida que vencem até o fim do mês ("Pagar"). Dia do vencimento em bloco colorido, selo "N com atraso" no topo, 5 linhas e "Ver mais". Tudo pago: "Tudo em dia neste mês! 🎉" |
| 4 | **Últimos lançamentos** | 5 linhas |
| 5 | **Para onde foi o dinheiro** | As 4 maiores categorias em lista com barra; "Ver todas as N categorias" |
| 6 | **Dívidas** [M] | Só o progresso: anel com quanto já pagou, quanto falta e quando acaba; "Ver dívidas" (as parcelas do mês estão no "Para fazer") |
| 7 | **Metas** [M] | 2 metas com barra de progresso |
| 8 | **Dinheiro guardado** [M] | Uma linha por módulo ligado |
| 9 | Rodapé | "Quer ver gráficos e comparar com o mês passado? **Mudar o jeito de ver**" (abre Configurações → Painel) |

Computador: o resumo ocupa a largura toda; embaixo, duas colunas: à esquerda Para fazer e Últimos lançamentos, à direita
Para onde foi, Dívidas, Metas e Dinheiro guardado. Celular: uma coluna, na ordem Para fazer, Para onde foi, Últimos
lançamentos, Dívidas, Metas, Dinheiro guardado.

Casos especiais: mês sem lançamentos mostra "Seu mês" com a frase "Nada lançado em outubro ainda…" e os botões; mês que
ainda não começou não ganha selo ("Já sai em novembro" + "Novembro ainda não começou…"), sem barra. Conta nova vê as
mesmas boas-vindas dos outros jeitos.

Não aparecem: indicadores em cartões, gráficos, comparação com o mês anterior, banner, "Acompanhe mais", página Ano no menu.

### 4.2 Equilibrado: o painel com comparação e gráficos

A grade de 4.0. Em relação ao que o simples mostrava antes de ganhar tela própria, acrescenta, **dentro dos mesmos blocos**:

| Zona | O que muda |
| --- | --- |
| 1 Resultado | Chip "R$ 120 a mais que em set" |
| 2 Indicadores | Variação ("16% a mais que em set") em Entrou e Saiu, com cor boa/ruim |
| 4 Dívidas | A linha de cada dívida ganha o valor da parcela: "Parcela R$ 300 · acaba em jun de 2027" |
| 5 Para onde foi | Rosca com o total no centro à esquerda da lista; 5 categorias; Últimos lançamentos com 6 linhas |
| **5b Evolução** (novo, depois da pergunta 3) | **Mês a mês em 2026**: barras de Entrou e Saiu (só 2 séries) com link "Ver o ano" |
| 6 Dinheiro guardado | "Nas contas" se abre em uma linha por banco; "Em outras moedas" em uma linha por moeda com o equivalente na sua moeda |
| 7 Metas | 4 metas, com valor guardado e previsão |

### 4.3 Detalhado: tudo, na mesma ordem

Acrescenta ao equilibrado:

| Zona | O que muda |
| --- | --- |
| 1 Resultado | Igual ao equilibrado |
| 2 Indicadores (até 6) | + **Gasto médio por dia** e **Maior saída**. No computador, a partir de 5 cartões a grade passa a 3 por linha, então nunca sobra um cartão esticado sozinho |
| 4 Dívidas | + "pago neste mês" por dívida |
| 5 Para onde foi | **Todas** as categorias, com valor, % e, quando a mudança contra o mês anterior é de 10% ou mais, a variação (abaixo disso é ruído). **Lançamentos do mês** (em vez de "Últimos"): 10 linhas com filtro Tudo / Entradas / Saídas e "Ver todos os N" |
| 5b Evolução | Mesmas barras; as linhas extras (Guardado nas contas, Dívidas, Investido, Em outras moedas) começam **escondidas** e entram ao tocar na legenda |
| 6 Dinheiro guardado | Cada banco mostra "entrou / saiu neste mês" |
| 7 Metas | Todas as metas em andamento (até 6) |

Saíram da Início: quadros de Entradas e Saídas (a página **Lançamentos** lista tudo, com filtros) e a tabela do ano (a página **Ano** tem a tabela completa).

### 4.4 Computador × celular

| Aspecto | Computador (≥ 861 px) | Celular |
| --- | --- | --- |
| Colunas | Zonas 4 e 6: cartões lado a lado, o último sozinho ocupa a linha inteira. Zona 5: duas colunas. Zona 5b: largura total | Uma coluna, na mesma ordem |
| Ações de lançar | Dois botões no cartão do resultado, à direita. Conta nova: também no cartão de boas-vindas | Botão "+" fixo (polegar). Conta nova: dois botões grandes no cartão de boas-vindas |
| Indicadores | Linha de cartões (até 3 por linha no detalhado) | 2 por linha; o último, se ímpar, ocupa a linha inteira |
| Rosca (equilibrado e detalhado) | Ao lado da lista | Acima da lista, menor |
| Últimos lançamentos | 6 linhas (detalhado: 10) | 5 linhas (detalhado: 8) |
| Evolução | 320 px de altura, legenda embaixo | 230 px, eixo em "mil" |

### 4.5 Slots para outros componentes

- `Ctx.kpisExtras?: ReactNode` → um ou mais `<Kpi>` (ex.: "Falta pagar no mês", "Fatura do cartão"), logo depois de Saiu, em **todos** os modos.
- `Ctx.blocos.contas?: ReactNode` → um único elemento raiz (`<section className="bloco">` ou `Cartao`), 1ª posição da zona "O que fazer".
- `Ctx.blocos.cartoes?: ReactNode` → um único elemento raiz, 2ª posição da zona "O que fazer".
- Quem preenche o slot pode ler `c.perfil.detalhe` para mostrar menos itens no simples (sugestão: 3), equilibrado (5) e detalhado (todos).
- Sem slots, nada aparece e o layout fecha sozinho.

### 4.6 Estados especiais

- **Conta nova** (sem nenhum dado): cabeçalho, cartão "Tudo pronto para começar" (com os botões), e só os blocos de módulos ligados com o primeiro passo ("Adicionar dívida", "Criar a primeira meta"). Sem indicadores zerados, sem rosca, sem gráfico.
- **Mês sem lançamentos** (conta antiga): resultado com "Nada lançado em outubro ainda", indicadores só se houver `kpisExtras`, cartão único com os botões no lugar de "Para onde foi" e "Últimos".
- **Resultado negativo**: número em coral (não vermelho puro), "Faltou", frase "Saiu R$ X a mais do que entrou" e atalho "Ver para onde foi".

### 4.7 Consultor (a aba de análise financeira)

A aba **Consultor** (`pages/Analise.tsx`, estilos em `pages/analise.css`) é a análise completa do dinheiro da pessoa, como
alguém que cuida de tudo e entende de finanças. Vem no menu logo depois de Lançamentos (lançar e consultar andam juntos),
em todos os jeitos de ver e sem depender de módulo.

**O motor** (`lib/analise.ts`, `analisar()`) é puro como o conselheiro: sem React, sem banco, com a data entrando por `hoje`.
Lê os **12 meses fechados e o atual** (`mesesDaAnalise` em `lib/conselheiro.ts`; `useDados` carrega os meses de outros anos
que faltam), mais compras no cartão, faturas, contas do mês, dívidas, metas e saldos dos bancos. Faz quatro coisas:

| Etapa | O que calcula |
| --- | --- |
| Analisar | Nota de 0 a 100 pela média ponderada de 6 pilares (sobra 25, reserva 20, dívidas 20, controle 15, cartão 10, metas 10; o que não se aplica sai e os pesos se refazem). Fase na escada: sair do vermelho → colchão de 1 mês → quitar dívidas acima de 3% ao mês → reserva completa (6 meses, ou 12 com renda que varia) → fazer o dinheiro crescer |
| Comparar | Previsão de como o mês fecha (o que entrou e saiu, contas e parcelas pendentes, faturas, gastos que se repetem e o dia a dia, misturando o costume com o ritmo do mês), quanto dá para gastar por dia guardando a sobra-alvo, o mesmo ponto dos outros meses, tendência de 12 meses (reta de mínimos quadrados) e categorias que subiram ou caíram |
| Revisar | Regra 50/30/20 pelo nome das categorias, gastos que se repetem todo mês e assinaturas (custo no ano), gastos formiga, juros e tarifas pagos, renda que varia e a principal fonte, gastos sem categoria. Parcela de compra no cartão já assumida nunca entra como "dá para cortar" |
| Planejar | Para onde mandar a sobra conforme a fase, orçamento por categoria para o mês que vem, plano das dívidas (só parcelas × avalanche × bola de neve, simulado mês a mês pelo calendário de parcelas, com o desconto dos juros ao adiantar), reserva, se as metas cabem, patrimônio daqui a 12 meses e o **plano de ação** em ordem de prioridade |

Regras de precisão (para os números não mentirem):

- **Guardar não é gastar.** Passar dinheiro para a caixinha, a poupança, um investimento ou outra conta sua (e o resgate) não
  entra como renda nem como gasto, no Consultor e no conselheiro (`lib/mudaDeBolso.ts`). O reconhecimento é estrito:
  "Reserva do hotel" e "Aplicação de botox" continuam sendo gasto. O resumo diz quanto foi guardado por mês, porque a Início
  conta essas transferências como saída. No mês atual, o que já foi guardado conta para a sobra-alvo do "por dia".
- **Salário em duas partes** (adiantamento e salário, mesma descrição): a recorrência de entrada aceita até 2 vezes no mês;
  a previsão espera só a parte que ainda não caiu, e a agenda põe cada parte no seu dia.
- **Reserva**: caixinha, reserva e investido contam inteiros; a conta corrente só pelo que sobra depois do que ainda vence no
  mês (contas, parcelas, faturas e o dia a dia previsto, menos o que ainda entra).
- **Sem duplicata**: a parcela cadastrada como dívida e também como conta do mês sai uma vez só, na previsão e na agenda; as
  parcelas atrasadas de meses anteriores (com o juro do atraso) entram no que falta pagar.
- **Gasto de hoje uma vez só**: o "por dia" do mês conta a partir do começo de hoje, e o "quanto dá hoje" desconta o que já
  saiu hoje.
- **Até este dia nos outros meses**: lançamento sem data entra pela parte do mês que já tinha passado.
- **Próxima fatura** é a que ainda vai vencer, mesmo que seja a deste mês.

O plano de ação segue a escada: atrasos primeiro, depois sair do vermelho, dívida de juros muito altos, usar parte de uma reserva
gorda para quitar dívida cara (sempre deixando 3 meses guardados), colchão, adiantar a dívida da vez, corte para a sobra-alvo,
parcelas e cartão, reserva, metas e, por último, os ajustes de dados (informar juros, dar categoria, atualizar saldos).

**Reanálise a cada mudança.** O Painel calcula a análise num `useMemo` sobre os dados: qualquer lançamento, compra, dívida, conta,
meta ou saldo novo refaz tudo. Depois de cada mudança, `retratoDe` + `compararRetratos` dizem o que mudou (nota, fase, previsão do
mês, dívidas, data sem dívidas, reserva, passos que entraram ou saíram do plano). A pessoa vê isso em dois lugares: o aviso
"Analisei a mudança" no canto (`components/AvisoReanalise.tsx`; some sozinho, "Não avisar mais" grava `aviso-reanalise` em
`perfil.dispensadas`, e o interruptor no pé da aba liga de novo) e o bloco "O que mudou" no topo da aba. Troca de ano, virada do
dia, cotação nova e dados chegando do banco não contam como mudança: só renovam a base de comparação. Sem mudança nesta visita,
"O que mudou" compara com o retrato da última visita (guardado no navegador, só números).

**Agenda do dinheiro.** O motor também monta, dia a dia, de hoje até o fim do mês que vem, o que tem data certa: contas do mês,
parcelas das dívidas (pelo calendário de cada uma), faturas de cada cartão, lançamentos marcados para depois e o que se repete
todo mês. Com o saldo da conta corrente informado, desconta também o gasto do dia a dia entre um dia e outro. Dessa agenda saem
os **detalhes que pouca gente percebe**:
- **Dinheiro que já chega com dono**: a entrada cai no mesmo dia em que vencem parcelas ou contas. Pode ser de propósito ou
  coincidência, e o texto diz isso: é boa ideia, mas um dia de atraso no dinheiro atrasa tudo junto.
- **Quanto do dinheiro já tem destino** até a próxima entrada.
- **Aperto**: conta que vence antes de o dinheiro entrar, com quanto precisa ter na conta até lá. Também vira passo do plano,
  logo depois dos atrasos.
- **Mês que vem mais pesado ou mais leve** que este.
- **Vencimentos amontoados** na mesma semana.
- **Última parcela chegando**: dinheiro que volta a ser seu, e a sugestão de decidir antes para onde ele vai.

**Planejador de pagamentos** (`lib/planejador.ts`, `planejar()`, puro como o motor). Pega cada conta, parcela e fatura da
agenda, com o **vencimento de verdade** (a atrasada aparece hoje na agenda, mas o atraso conta do dia em que venceu) e os juros,
e anda dia a dia, do saldo de hoje até o fim do mês que vem, decidindo **de qual dinheiro sai cada uma e em que dia pagar**:
- No dia em que o dinheiro entra, paga o que já venceu, primeiro o que cobra mais caro pelo atraso. Guarda para o que vence
  antes do próximo dinheiro e cobra mais caro (não paga a luz hoje se isso fizer o empréstimo de 8% atrasar amanhã).
- O custo do atraso é a multa uma vez mais os juros proporcionais aos dias. Juros informados na dívida (`juros_mes`) valem; sem
  eles, estima: 2% de multa (o máximo do CDC) mais 1% ao mês em contas e boletos, ou 14% ao mês em fatura de cartão (rotativo).
  A estimativa é dita no texto.
- Saem quatro dicas, que viram passos do plano de ação (no lugar do aviso genérico de aperto): **qual pagar primeiro** quando o
  dinheiro não dá para as duas, e quanto a outra vai valer quando chegar a vez dela; **em que dia pagar** a que vence antes de o
  dinheiro chegar, e quanto vai custar; **falta dinheiro** até o fim do mês que vem; e **quitar ou adiantar** a dívida aberta mais
  cara com a sobra que fica livre de uma entrada (a sobra só é livre se o caixa não precisar dela depois).
- Uma entrada nova refaz o plano. O retrato (`retratoDe`) guarda o dia planejado de cada pagamento, e "O que mudou" mostra
  "Agora dá para pagar Empréstimo em 20/nov (antes, 25/nov)".
- **Hoje você pode gastar** (`plano.hoje`): o menor entre o que o mês aguenta (`mes.porDia`, guardando a sobra-alvo) e o que o
  saldo aguenta por dia sem atrasar nenhuma conta até o próximo dinheiro. É o primeiro cartão da aba, com quanto já saiu hoje
  (gasto do dia a dia lançado hoje) e quanto ainda dá. O "Por quê?" diz qual dos dois mandou no número e lembra que ele vale se o
  que entra e sai estiver lançado.

**O jeito de cada pessoa** (`lib/jeito.ts`, `tracosDe()`). Lê os números e dá traços: começando agora, gasta bastante,
controlado, com dívidas pesando, renda que varia, usa muito o cartão. Aparecem no topo da aba ("Seu jeito", tocar mostra o
porquê) e cada traço soma pontos à prioridade dos gráficos que mais servem a ele (`bonusDoJeito`): quem gasta bastante vê
primeiro onde gasta e o teto de cada gasto; quem está endividado, o fluxo e as dívidas; quem é controlado, reserva, metas e
patrimônio. Os traços mudam sozinhos com os lançamentos.

**De onde sai o dinheiro** (visual `fluxo`): cada dinheiro que entra (e o saldo de hoje) vira uma barra dividida no que ele
paga, com o atraso em laranja e o custo; o que não tem dinheiro fica em vermelho no fim. Sobe para o topo quando há atraso.

**O feed aprende com o uso.** Cada gráfico tem estrela (favorito: vai para o topo) e olho (esconder: vai para "N gráficos
escondidos", no fim, com "Mostrar de novo"). Cada toque num cartão sobe um pouco o gráfico na próxima visita (não na hora, para o
cartão não pular debaixo do dedo). A memória fica no navegador, por pessoa (`opuscash:feed:<id>`); sem armazenamento, vale só a
ordem do motor.

**As cores da aba** (definidas em `.analise`, `pages/analise.css`) têm um significado só cada, igual em todos os gráficos:
**verde** = dinheiro livre ou está bem; **azul** = dinheiro que já tem destino (conta no prazo); **laranja** = atenção, sai com
atraso e custa mais; **vermelho** = falta, problema; **cinza** = referência neutra. Não há amarelo (ele se confundia com o laranja e
com a cor de dívida do resto do app). Quem usa mais de uma cor mostra a legenda embaixo, e nenhum número depende só da cor:
"De onde sai o dinheiro" diz em palavras quanto de cada entrada já tem destino, quanto sobra livre e quanto vai para contas
atrasadas, com as atrasadas no topo da lista.

**Gráficos no lugar de texto.** A aba é feita de gráficos, com pouco texto e linguagem simples: cada cartão tem título de
até 5 palavras e uma frase só. Explicação longa fica atrás de "Por quê?".

**Quem escolhe os gráficos é o motor.** `lib/visuais.ts` (`visuais()`) olha a análise e decide quais visuais a pessoa
precisa ver, em ordem de importância. Um aperto na conta, por exemplo, sobe a curva do saldo para o topo. Os 15 tipos:
- **Como estou**: velocímetro da nota, escada das fases e radar dos 6 pilares.
- **O mês**: cascata (entra, sai, fica), calendário do mês com o dinheiro que entra e sai e os dias marcados pela agenda, e
  curva do saldo dia a dia.
- **Para onde vai o dinheiro**: rosca 50/30/20 com o ideal por dentro, barras de onde mais gasta e halteres "antes × agora".
- **O tempo**: colunas da sobra mês a mês e linha do tempo de quando cada dívida acaba, com e sem o plano.
- **Dívidas**: rosca de quanto do que se deve é juros e barras do total pago com e sem adiantar.
- **O que se guarda**: pote da reserva, anéis das metas, tabela de teto por gasto, barras das contas fixas no ano e curva de
  tudo o que é seu, com 12 meses de projeção tracejados.

O desenho fica em `pages/AnaliseGraficos.tsx`: SVG e HTML próprios, sem biblioteca de gráficos. O apoio (cor do tom, o
gatilho da animação) está em `pages/analiseApoio.ts`.

**Animação.** Barras crescem, linhas se desenham, a bolinha do velocímetro corre até a nota, o pote enche, o radar abre e os
números contam. Cada animação só começa quando o cartão aparece na tela (`useEmVista`). Com Configurações → Animações:
Reduzidas, tudo aparece pronto.

**Cada jeito de ver tem a sua montagem.** Em todos, o topo é a **vitrine** "Hoje você pode gastar" (`components/Vitrine.tsx`):
o velocímetro mostra quanto do dia já foi, o número grande é o que dá para gastar e as pílulas dizem quanto já saiu hoje e
quanto ainda dá. Sem o plano (falta saldo ou agenda), a vitrine mostra a nota no lugar.

| Jeito | Montagem |
| --- | --- |
| Simples | Vitrine; **Faça agora** (um passo por vez) ao lado de dois quadros pequenos: **Sua nota** (velocímetro e os 5 degraus em tracinhos) e **Como o mês fecha** numa balança de duas barras (entra × sai); 2 gráficos e "Ver mais"; no fim, o convite para mudar o jeito de ver. Sem "Seu jeito" |
| Equilibrado | Vitrine com a pílula do fim do mês; três quadros lado a lado (**Como estou** com a escada, **Faça agora**, **Como o mês fecha** com a cascata); o feed com **abas por assunto** (Tudo, O mês, Gastos, Dívidas, Guardado, Como estou), 4 gráficos na frente em "Tudo" |
| Detalhado | Vitrine com mais pílulas (fim do mês e o quanto daria pelo mês inteiro); **Como estou** e **Como o mês fecha** lado a lado; o **plano de ação inteiro** em lista numerada (cor pela urgência, ganho em verde, tocar mostra o porquê, botão com verbo); o feed inteiro em **seções por assunto**, com um índice preso no topo para pular direto (favoritos primeiro, e cada seção sobe pelo gráfico mais importante dela) |

"O que mudou" aparece como uma faixa logo abaixo da vitrine (até 2 mudanças; 4 no detalhado), com setas em bolinhas coloridas.

"De onde sai o dinheiro" ficou visual: cada entrada mostra a barra e três etiquetas (quanto tem destino, quanto fica livre,
quanto vai com atraso); a lista do que ela paga abre ao tocar.

**No computador**, o feed encaixa os cartões em colunas (2; 3 no detalhado a partir de 1600 px), sem buracos embaixo do mais
baixo, e o dia do calendário fica achatado. "Como estou" se arruma pela própria largura (container query): estreito, o
velocímetro fica em cima do degrau.

No celular, tudo fica numa coluna só, na mesma ordem. Na cascata, o espaço acima das barras é dos rótulos, para o valor da
primeira não encostar no número grande do cartão.

Sem dados suficientes (menos de 2 dos 3 últimos meses com entradas e saídas), não há nota: a frase explica o que lançar e a aba
mostra o que já dá. Conta nova vê o convite para o primeiro lançamento.

## 5. Guia de linguagem

### 5.1 Regras

1. **Frases curtas, voz ativa, segunda pessoa.** "Você pagou 42%", não "42% do saldo foi quitado".
2. **Títulos em sentença**: só a primeira letra maiúscula ("Para onde foi o dinheiro"). Nada de CAIXA ALTA, nem em gráficos e tabelas.
3. **Botões começam com verbo no infinitivo** e dizem o que acontece: Lançar entrada, Pagar, Guardar, Adicionar dívida, Criar meta, Salvar, Excluir. Um verbo por ação em todo o app: **Lançar** (entrada/saída), **Adicionar** (item de lista: dívida, banco), **Criar** (meta, conta, categoria), **Pagar**, **Guardar/Retirar** (metas), **Excluir** (nunca "apagar/remover").
4. **Números sempre com moeda** ("R$ 1.200,00"); variação em palavras ("12% a mais que em set"), não em siglas ("vs").
5. **Datas**: "5 de nov"; mês e ano "nov de 2026" (nunca "nov/26"); mês inteiro só no título ("outubro de 2026").
6. **Passado para o que já aconteceu no mês** (Entrou, Saiu, Sobrou), **substantivo para tipo de lançamento** (entrada, saída).
7. **Atraso e dívida, tom calmo e acionável**: dizer o fato, o valor e o próximo passo. "Venceu dia 5 · R$ 120 · Pagar". Proibido: "ATRASADA", "URGENTE", "cuidado!", pontos de exclamação em alertas. Progresso antes de saldo ("Você já pagou 42%").
8. **Erros**: dizer o que aconteceu, que não foi culpa da pessoa e o que fazer. "Não deu para salvar. Tente de novo." + detalhe técnico depois.
9. **Sem jargão**: não usar fluxo, caixa, saldo devedor, quitação, métricas, patrimônio.
10. Emoji só em momentos positivos (meta batida, sem dívidas) e nas categorias.

### 5.2 Termo antigo → termo novo

| Antes | Agora |
| --- | --- |
| Visão geral (menu), Início (aba) | **Início** |
| Fluxo de caixa / Resultado de outubro | **Sobrou em outubro** / **Faltou em outubro** |
| Caixa | **Guardado nas contas** (bloco: **Dinheiro guardado**) |
| Meu dinheiro / Patrimônio (menu) | **Dinheiro guardado** |
| Métricas / Métricas - outubro | **Para onde foi o dinheiro** |
| Quadro, Entradas / Saídas (quadros) | **Últimos lançamentos**, **Lançamentos do mês** |
| Por banco | linhas dentro de **Dinheiro guardado** |
| Falta pagar (indicador de dívidas) | **Dívidas** (indicador) e "Falta pagar" só dentro de cada dívida |
| Restante / Quitação | **Falta pagar** / **Acaba em** |
| Saldo devedor atualizado | **Quanto falta pagar agora** |
| Total devendo / Livre de dívidas em | **Você deve no total** / **Sem dívidas em** |
| Registrar pagamento / pagar | **Lançar pagamento** / **Pagar** |
| Evolução de 2026 / Resumo de 2026 | **Mês a mês em 2026** / **Resumo de 2026** (só na página Ano) |
| Ano (menu) | **Resumo do ano** (aba: Ano) |
| Entradas no ano / Saídas no ano | **Entrou no ano** / **Saiu no ano** |
| Resultado no mês (banco) | **Sobrou no mês** |
| 12% vs mês anterior | **12% a mais que em set** |
| ENTRADAS, SAÍDAS, CAIXA, DÍVIDA (séries do gráfico) | **Entrou**, **Saiu**, **Guardado nas contas**, **Dívidas** |
| Apagar / Apagar mesmo | **Excluir** / **Sim, excluir** |
| Nova (categoria), + nova, + banco | **Criar categoria**, **+ Nova categoria**, **+ Novo banco** |
| Ligar dívidas / Ligar metas (sugestões) | **Acompanhar dívidas** / **Acompanhar metas** |
| Cadastrar uma dívida / Cadastrar banco | **Adicionar dívida** / **Adicionar banco** |
| Informe um valor maior que zero | **Digite um valor maior que zero** |
| Exportar backup | **Baixar backup** |
| 2-out, mar/27 | **2 de out**, **mar de 2027** |
| JAN FEV MAR (barra de meses) | **Jan Fev Mar** |
| Algo deu errado: … | **Não deu certo. Tente de novo.** Detalhe: … |

### 5.3 Microcopy de exemplo

**Estados vazios**
- Mês sem lançamentos: "Nada lançado em outubro ainda. Comece pelo que entrou ou pelo que saiu."
- Dívidas ligadas e vazias: "Tem parcela ou empréstimo? Adicione para ver quanto falta e quando acaba." (sem comemorar: numa conta nova "sem dívidas" não é conquista)
- Todas as metas batidas: "Todas as metas batidas! 🎉"
- Sem bancos: "Adicione seus bancos para ver quanto tem em cada um."
- Sem metas: "Junte dinheiro para uma viagem, um carro ou uma reserva."
- Sem gastos: "Quando você lançar saídas, aparece aqui em que você mais gasta."

**Confirmações**
- Excluir lançamento: "Excluir este lançamento?" com "Excluir" e "Cancelar".
- Excluir dívida: "Excluir "Notebook" e todo o histórico dela?"
- Importar planilha: "Encontrei 3 meses. Os dados desses meses no app serão substituídos pelos da planilha. Quer continuar?"
- Lançamento salvo em sequência: "2 lançamentos salvos. Pode lançar o próximo."

**Erros**
- Campo: "Digite um valor maior que zero."
- Rede: "Não deu certo. Tente de novo. Detalhe: …"
- Login: "E-mail ou senha incorretos."

**Dívida e atraso**
- Dívida: "Você já pagou 42%. Faltam R$ 4.800 e a última parcela é em mar de 2027."
- Atraso (conta): "Venceu dia 5 · R$ 120,00 · Pagar"
- Mês no vermelho: "Saiu R$ 340,00 a mais do que entrou. Ver para onde foi."

## 6. Menu

Ordem dos itens (computador), por frequência e por pergunta respondida:

1. **Início** (sempre)
2. **Lançamentos** (sempre)
3. **Contas do mês** [M contas] *(outro componente)*
4. **Cartões** [M cartões] *(outro componente)*
5. **Dívidas** [M dívidas]
6. **Metas** [M metas]
7. **Dinheiro guardado** [M bancos, investimentos ou outras moedas]
8. **Resumo do ano** (equilibrado e detalhado)

Justificativa: o que se usa todo dia primeiro (Início, Lançamentos); depois o que tem prazo, do mais próximo para o mais distante (contas, cartões, dívidas); depois o que se constrói (metas, dinheiro guardado); a retrospectiva por último, porque é a menos urgente.

**Celular (barra de abas, no máximo 5)**: se houver até 5 páginas, aparecem todas. Com mais de 5, aparecem as **4 primeiras** da ordem acima e a quinta aba é **Mais**, que abre uma folha com as demais. A ordem do menu é também a prioridade das abas, então Dívidas e Contas ganham lugar antes de Resumo do ano. "Mais" fica ativa quando a página aberta está dentro dela. Configurações (Personalizar painel, Importar, Baixar backup, Sair) continuam no menu do topo.

| Quem liga o quê | Abas |
| --- | --- |
| Nada ligado, simples | Início · Lançamentos |
| Equilibrado, sem módulos | Início · Lançamentos · Resumo do ano |
| Dívidas, metas e bancos, equilibrado | Início · Lançamentos · Dívidas · Metas · Mais (Dinheiro guardado, Resumo do ano) |
| Tudo ligado | Início · Lançamentos · Contas do mês · Cartões · Mais (Dívidas, Metas, Dinheiro guardado, Resumo do ano) |

### 4.7 Gráficos no Safari

O Safari (iPhone, iPad e Mac) descarta o desenho dos gráficos (canvas) quando a aba ou o app vai para segundo plano, e pode não
repintar um canvas dentro de um bloco animado com desfoque. Por isso (`lib/charts.ts` e `index.css`): todos os gráficos se
redesenham ao voltar para a aba, à página ou à janela; blocos com gráfico entram sem desfoque; a resolução dos gráficos vai até 2×
(menos memória no iPhone); e o crescimento a partir do zero acontece só no primeiro desenho, depois o gráfico só transiciona.

### 4.8 Gráficos que não travam

O Chart.js tem um único motor de animação para a página. Se um quadro de animação de qualquer gráfico dá erro, o motor fica
marcado como ocupado e nunca mais roda: todos os gráficos, inclusive os criados depois, ficam em branco até recarregar a página.
`lib/charts.ts` protege isso: o motor pega o erro, termina as animações desenhando tudo no estado final e registra o erro no
console (`[OpusCash] erro num gráfico…`; os últimos ficam em `__opuscashErrosGraficos`). Uma animação sem interpolador pula para
o valor final, e um vigia desenha sem animação o gráfico que não se desenhou até 1,8 s depois de criado.

**Causa raiz do sumiço (corrigida):** `lib/charts.ts` trocava o objeto `Chart.defaults.animation` inteiro. O Chart.js usa os
nomes que existem nesse objeto (`delay`, `from`, `type`…) para saber o que ler de cada animação; trocando-o, passava a ignorar
`type`, `from` e `delay`. Sem o `type`, a animação de cor de um degradê não tinha como misturar as cores e dava erro
("`_fn is not a function`"), travando o motor. Agora os campos são ajustados um a um, sem trocar o objeto.

### 4.9 Gráficos de barras e linhas (base da planilha)

Os três gráficos de evolução seguem o gráfico da planilha antiga (`components/Graficos.tsx`, cores em `PALETA` de
`lib/charts.ts`): barras de Entrou (verde) e Saiu (vermelho) lado a lado, com degradê, e linhas vivas com brilho por cima.

- **Fluxo financeiro** (Início): 6 meses, barras Entrou/Saiu e a linha do que sobrou.
- **Mês a mês** (Resumo do ano): 12 meses, barras Entrou/Saiu e as linhas dos módulos ligados (guardado nas contas, dívidas,
  investido, outras moedas). Tocar na legenda esconde ou mostra uma série; tocar num mês abre o mês.
- **Quanto sobrou em cada mês** (Resumo do ano): barra verde quando sobrou e vermelha (para baixo) quando faltou, e a linha do
  acumulado no ano num eixo próprio à direita, para as barras do mês não ficarem achatadas.

Linhas finas e suaves (curva monotônica), sem brilho, com bolinhas discretas em cada mês. O gráfico não troca de mês ao ser
tocado (isso pegava a pessoa de surpresa); o mês aberto fica marcado por uma faixa clarinha atrás dele.
No Fluxo financeiro, uma **régua com os 12 meses** logo abaixo do gráfico escolhe o mês e troca a página inteira (como o seletor
do topo, que também ficou em destaque, na cor da marca).

Animação de entrada (só no primeiro desenho): as barras sobem da linha do zero numa onda suave (atraso pequeno entre elas) e as
linhas são reveladas por uma cortina que corre da esquerda para a direita com aceleração suave (plugin `revelar`).

Menu lateral: o cartão do pé alterna dicas úteis, cada uma com um botão (contas que pedem atenção, lançar o gasto de hoje,
quanto falta nas dívidas, metas, personalizar, backup, tema). Troca a cada 7 s, para sob o ponteiro, e os pontinhos escolhem a dica.

Ordem das dicas: primeiro os alertas de hoje (contas, faturas, parcelas atrasadas, te devem); depois até 3 **conselhos** do
conselheiro financeiro (`lib/conselheiro.ts`); as dicas genéricas (lançar, importar, metas, personalizar, backup, tema) só
aparecem quando o conselheiro não tem nada a dizer. O conselheiro é um motor de regras puro e determinístico: recebe os dados
já carregados e devolve `Conselho[]` ordenado por prioridade (id estável, gravidade, ícone, título curto, "porque" com o número,
página de destino e botão). Regras (limites como constantes no topo do arquivo, são referências de educação financeira, não
regra rígida): gasta mais do que ganha (urgente), sobra menos de 5% das entradas, parcelas de dívidas acima de 30% das entradas
(acima de 50% é urgente), dívida maior que há 3 meses, reserva abaixo de 3 meses de gastos, categoria do mês atual mais de 40%
acima da média, parcelas do cartão no mês que vem acima de 30% das entradas, meta com prazo em ritmo menor que o necessário, e
o elogio por sobrar mais de 20% nos 3 meses. Três regras usam os **juros por mês** de cada dívida (`dividas.juros_mes`, migração 19,
campo opcional "Juros por mês (%)" no formulário da dívida, só em "Eu devo"; olham só dívidas que a pessoa deve e que ainda têm
saldo): `juros-altos:<dívida>` (urgente, prioridade 92: a pior dívida cobra 8% ao mês ou mais, `JUROS_ALTOS_MES`; mostra o
equivalente ao ano), `pagar-a-mais-cara` (atenção, 80, logo abaixo de "gasta mais do que ganha" e acima das outras regras de
atenção: com juros informados em 2 ou mais dívidas, a de maior juros cobra pelo menos 0,5 ponto a mais que a segunda,
`JUROS_DIFERENCA_MIN`; aconselha adiantar primeiro essa) e `informe-juros` (atenção, 20, só acima do elogio: há dívida em aberto e
nenhuma tem juros informados; some assim que uma tiver). Sem a migração 19, `dividasSemJuros` (de `useDados`) esconde o campo,
silencia o convite e as gravações vão sem a coluna. Equivalente ao ano = juros compostos, `(1 + i)^12 − 1` (`jurosAoAno`). As regras de fluxo usam a média dos últimos 3 meses **fechados** com entradas e
saídas lançadas e só falam com pelo menos 2 deles. O "x" do canto dispensa o conselho até o mês que vem (grava
`id@AAAA-MM` em `perfil.dispensadas`; o `id` puro na lista esconde de vez). Os lançamentos dos meses fechados que caem fora do
ano aberto vêm de `lancsRecentes` em `useDados`.

### 4.10 Visual: ícones, bandeiras, paisagens e Configurações

- **Ícones de categoria** (`components/IconeCategoria.tsx`): cada emoji que o app oferece vira um ícone de traço no estilo do
  app, num quadradinho arredondado na cor da categoria (`Selo`). O emoji continua sendo o que fica salvo; emoji sem desenho
  aparece como emoji.
- **Bandeiras** (`components/Bandeira.tsx`): as 18 moedas têm bandeira desenhada em SVG, redonda (no Windows os emojis de
  bandeira viravam só as letras do país).
- **Paisagens** (`components/Paisagem.tsx`): montanhas, mar, cidade, floresta e dunas, à noite no tema escuro e de dia no
  claro. Usadas no banner da Início, que alterna mensagens (planejar, viagem, destino do dinheiro, reserva, dívidas) a cada 8 s,
  e no cartão de dicas do menu lateral, que estica de logo abaixo do menu até o pé.
- **Configurações** em tela cheia: menu de seções com pílula deslizante (Perfil, Aparência, Painel, Categorias, Dados, Conta) e
  cartões em grade: moedas com bandeira, tema e jeito de ver com miniatura do app, animações com prévia, módulos com
  interruptor e ações grandes. No celular, seções em abas roláveis e grades de duas colunas.
- **Seletor de mês do topo**: o mês é uma pílula sólida da marca, sem brilho.


### 4.11 Cartões de crédito (página redesenhada)

- **Carteira:** cada cartão ativo é desenhado (`CartaoIlustrado`): plástico na cor do cartão, desenho de fundo escolhido
  pelo nome, chip, aproximação, selo do banco (`BancoIcone`, monograma em SVG na cor da marca, sem logos reais), a fatura
  do mês e os dias de fechamento/vencimento. Inclina em 3D e brilha seguindo o ponteiro; um reflexo passa ao aparecer e ao
  ser escolhido. No celular os cartões deslizam de lado. Tocar num cartão abre o detalhe dele.
- **Detalhe do cartão:** faturas que venceram sem pagar (até 12 meses para trás, com "Paguei", "Renegociei" e "Já paguei
  todas"), fatura do mês (valor que conta, linha do tempo abriu → fecha → vence com o "hoje" pulsando, divisão por
  categoria, ações), anel do limite (usado na cor do cartão; o garantido num arco dourado por fora), barras das próximas
  faturas, parceladas com um tracinho por parcela e o histórico das faturas resolvidas (toque para ajeitar).
- **Pagar / ajeitar:** dia, valor, banco e juros/multa. Pago depois do vencimento aparece "com N dias de atraso"; os
  juros viram uma saída na categoria de dívidas, no mês do pagamento (`juros_lanc_id`). Ajeitar atualiza, cria ou apaga
  essa saída; desfazer apaga também.
- **Renegociar:** o banco parcelou a fatura. Cria uma dívida (total do acordo, parcelas) e marca a fatura como
  `renegociada`. As compras dela saem das saídas do mês (`contaNasSaidas`, aplicado em `Painel` antes de `resumoMes`), e o
  que passa a contar é cada parcela paga da dívida: nada conta duas vezes. Também saem do total de faturas e do "falta
  pagar". Desfazer devolve as compras e apaga a dívida se nenhuma parcela foi paga.
- **Limite garantido:** dinheiro numa caixinha que vira limite. Valor fixo, ou ligado à caixinha do banco do cartão
  (tela Dinheiro guardado, valor de hoje). Limite total = limite do banco + garantido.
- **Sem a migração 9** (`supabase/migracao-09-cartoes-extras.sql`), a página funciona como antes e mostra um aviso;
  renegociar, juros e limite garantido ficam desligados e os campos novos não são gravados.
- **Alerta:** fatura vencida sem pagar entra nas dicas do menu lateral ("Resolver").
- **Compras no cartão moram aqui, não em Lançamentos.** Cada parcela é uma saída com `cartao_id`; `ehCompraNoCartao`
  (`lib/cartoes.ts`) as reconhece. "Compras desta fatura" lista a fatura do mês aberto (com o total ao lado) e "Nova
  compra" lança no cartão. A busca do topo, quando alguém digita nela, abre **Resultado da busca nos cartões** (todos os
  cartões e meses). Lançar a compra pela tela Lançamentos (forma "Crédito") também vale: ao **fechar** o formulário
  (com "Salvar e lançar outro" ele fica aberto), o painel leva para Cartões, no cartão e no mês da fatura em que a compra
  caiu (`cartaoAberto`, `compraDestacada` no `Ctx`); quando a compra aparece na fatura (a gravação pode demorar), a tela
  rola até ela uma vez e a destaca por alguns segundos. Se a gravação falhar, o formulário continua aberto e nada redireciona. Só no cartão existe
  esse tipo de lançamento: compra no cartão é sempre saída.

### 4.12 Foto de perfil

Configurações → Perfil: a foto escolhida é recortada no quadrado do meio e reduzida no aparelho (192 px, JPEG) e aparece
no avatar do topo e das Configurações. Fica guardada neste aparelho e, com a migração 9 (`perfis.foto`), também no banco.

### 4.13 Dívidas: "Eu devo" e "Me devem"

- **Dois lados, um jeito só.** A página tem a chave **Eu devo | Me devem**. "Me devem" é o mesmo modelo de dívida com
  `sentido = 'me_devem'` (venda parcelada, empréstimo que você fez). Pagar o que você deve é uma **saída** ligada pelo
  `divida_id`; receber de quem te deve é uma **entrada** ligada do mesmo jeito: os dois abatem do que falta.
  O que te devem fica fora de `r.divida` e dos indicadores do mês (`Painel` separa `situacao` de `aReceber`).
- **Calendário de parcelas** (`calendarioDe`): com `inicio` (vencimento da 1ª), cada parcela vence no mesmo dia dos meses
  seguintes. O total pago (maior saldo − o que falta) cobre as parcelas da mais antiga para a mais nova: pagou metade, a
  parcela fica **pela metade**; pulou uma, ela fica **atrasada** quando vence; pagou a mais, adianta as próximas. Sem
  parcela fixa, `inicio` é a data combinada. O formulário pergunta "a próxima vence em" e calcula `inicio`
  (`inicioPelaProxima`). Dívida antiga sem data mostra "Quando vence a próxima?" na ficha.
- **Um botão por dívida:** "Pagar R$ X" / "Receber R$ X" já sugere o atrasado (ou a próxima parcela); o valor pode ser
  trocado. Sem parcela nem data, o valor fica em branco ("Lançar pagamento").
- **Visual:** cartão por dívida com o selo de quem (banco conhecido vira `BancoIcone`; pessoa vira as iniciais num
  círculo colorido), anel do quanto já foi pago, um tracinho por parcela (verde paga, vermelho atrasada, metade pintada
  quando parcial) e a próxima data. Em cima: anel do total já pago com "livre em" e as barras dos próximos 12 meses
  (`projecaoMensal`). A ficha (toque no cartão) mostra cada parcela e os pagamentos/recebimentos (toque para editar).
- **Recebe todo mês** (aluguel, mesada): não é dívida, é conta fixa de entrada em Contas do mês. Em "Me devem" elas
  aparecem com o botão "Recebi", e um atalho leva para cadastrar.
- **Alertas:** parcelas atrasadas (suas e de quem te deve) entram nas dicas do menu lateral.
- **Na Início:** o bloco Dívidas termina com a linha **A receber** (quanto falta receber, quantos em aberto e o que já
  venceu); tocar nela abre a página Dívidas já em "Me devem" (`pedirLadoDividas`).
- **Sem a migração 10** (`supabase/migracao-10-dividas-e-a-receber.sql`) a página funciona só com "Eu devo", sem pessoa e
  sem calendário, e mostra o aviso.
- **Juros por mês** (opcional, só "Eu devo"): o formulário pergunta "Juros por mês (%)" com uma ajuda leiga e mostra o
  equivalente ao ano ("2,5% ao mês ≈ 34% ao ano"); aceita vírgula. O cartão e a ficha mostram a taxa discretamente ao lado do
  banco ("Banco Itaú · parcela 10 de 48 · 1,8% ao mês"). Os conselhos que usam isso estão na seção do menu lateral. Sem a
  migração 19 (`supabase/migracao-19-juros-das-dividas.sql`) o campo some e nada mais muda. O `FormDivida` só mostra o campo
  quando recebe `semJuros={c.d.dividasSemJuros}`.
- A renegociação de fatura do cartão cria a dívida já com o banco, o total de parcelas e o vencimento da 1ª parcela.
- **Partes da dívida (mini-dívidas)**: uma dívida pode ser feita de várias partes, cada uma com as suas parcelas de valores e
  datas diferentes (o crédito de uma loja com várias compras parceladas: mouse 5x, microfone 6x, cabo 6x). Tabela
  `divida_partes` (migração 21), uma linha por parcela de cada parte (`nome`, `valor`, `vencimento`, `parcela`, `parcelas`);
  `useDados` junta as partes em `divida.partes`. Com partes, `calendarioDe` monta o calendário delas: uma parcela por **dia
  de vencimento**, que soma as partes daquele dia (`ParcelaDivida.partes`), e o que foi pago cobre os dias do mais antigo
  para o mais novo, como nas outras. Por isso atraso, botão "Pagar", Início, "Para fazer", Consultor e o planejador de
  pagamentos já enxergam as partes sem mudar nada. O **saldo** continua em `divida_saldos`: ao acrescentar, corrigir ou
  apagar partes (`addPartes`, `updParte`, `delPartes`), o saldo acompanha a diferença da soma (`ajustarValorDivida`); dívida
  sem saldo nasce com a soma, no dia mais cedo entre hoje e o primeiro vencimento. Na ficha, **Do que é feita**
  (`PartesDaDivida`) lista cada parte com o total e, aberta, as parcelas com a situação do dia em que vencem; o lápis corrige
  valor e data de uma parcela (o credor costuma somar juros e multa) e "Adicionar parte" pede o nome, o valor de cada
  parcela, o vencimento da primeira que falta e "da parcela X até a Y" (`gerarParcelasDaParte`), mostrando antes o que vai
  criar. No calendário da ficha, dívida com partes mostra o dia ("2 de mar"), não só o mês. Sem a migração 21, a ficha
  mostra o aviso e o resto funciona como antes (`partesSemTabela`).
- **Juros de atraso (a dívida cresce sozinha)**: com a migração 22 (`supabase/migracao-22-juros-de-atraso.sql`), cada
  dívida "Eu devo" pode ter a regra do credor para o atraso: `atraso_juros_mes` (% ao mês no atraso, diferente de
  `juros_mes`, que é o do contrato), `atraso_tipo` (`simples` ou `composto`), `atraso_multa` (% uma vez, padrão 2),
  `atraso_base` (`parcela`: cada parcela atrasada cresce; `saldo`: o saldo inteiro cresce, como num cartão) e
  `conferido_em` (dia em que os valores batiam com o banco). Em `divida_partes`, `valor_original` é o valor da parcela no
  contrato, base dos juros simples.
  - **Motor**: `jurosDoAtraso(s, cal, hoje)` em `lib/jurosAtraso.ts` (função pura, data injetada). Só parcela atrasada e com
    algo faltando cresce; cada uma conta a partir de `max(conferido_em, vencimento)`; a multa entra uma vez na parcela que
    venceu no dia da conferência ou depois; simples = `base × taxa/30 × dias` (base = `valor_original` proporcional ao que
    falta); composto = `falta × ((1 + taxa)^(dias/30) − 1)`; base `saldo` aplica sobre o `restante` desde a primeira parcela
    atrasada. Devolve o total, o detalhe por parcela (`porParcela`) e por parte (`porParte`) e quanto cresce por dia.
  - **Onde entra**: `situacaoDividas(…, hoje)` não muda `restante` (é o valor registrado, que o pagamento cobre parcela por
    parcela). Só no mês que contém hoje, acrescenta `jurosAtraso`, `restanteHoje = restante + jurosAtraso` e `atraso` (o
    detalhe). Meses passados ficam como foram registrados. "Quanto deve agora" usa `restanteHoje`: KPIs da página, `r.divida`
    do resumo (e a origem "juros do atraso (estimado)" no gráfico), Início, "Para fazer", Consultor e planejador. O custo do
    atraso usa `jurosQuePesam(s)`: o juro do atraso quando a dívida está atrasada e tem a regra, senão `juros_mes`.
  - **Telas**: cartão e ficha mostram "falta pagar hoje", o selo "com juros, estimado" e "cresce ~R$ X por dia"; o
    calendário mostra cada parcela atrasada com os juros ("atrasada, com juros"); "Do que é feita" mostra o valor de hoje com
    o registrado riscado. O botão "Pagar" sugere o atrasado com juros (`sugeridoParaPagar`).
  - **Conferi com o banco** (`ConferirComBanco`, `conferirDivida` em `useDados`): pede "Quanto o banco mostra hoje?", já com o
    estimado. Com partes, a diferença é repartida entre as parcelas atrasadas pelo juro estimado de cada uma (`updPartes`, um
    acerto de saldo só) e o valor antigo vira `valor_original` se estiver vazio; sem partes, vira um ajuste de saldo no dia.
    Nos dois casos `conferido_em = hoje`.
  - **Pagamento com juros** (`salvarLancamento` no Painel): antes de gravar o pagamento de uma dívida com juros estimados, os
    juros até o dia do pagamento viram valor real. Com partes, entram nas parcelas (como no "Conferi"); com parcela fixa (o
    calendário não tem onde guardar juros de uma parcela), os juros pagos viram uma saída à parte ("Juros do atraso –
    Dívida", sem dívida ligada, como os juros de fatura) e só o resto abate a dívida.
  - **Formulário**: seção "Se atrasar" no `FormDivida`, só para "Eu devo", recolhida até a pessoa abrir: juros do atraso,
    multa, "Como cresce" ("Só sobre o valor devido" × "Juros sobre juros"), "Cresce sobre" ("Cada parcela atrasada" × "O
    saldo inteiro") e "Valores conferidos em" (abre com hoje). Só aparece com `semAtraso={c.d.dividasSemAtraso}`; sem a
    migração 22 os campos somem e as dívidas não crescem sozinhas.

### 4.14 Metas (potes)

- Cada meta é um **pote de vidro** (`PoteMeta`, SVG) que enche com a cor da meta até o progresso: ao aparecer o líquido
  sobe do fundo, a superfície tem uma onda lenta, os marcos de 25/50/75% acendem na lateral e, batida, sobem bolhas.
- Topo: anel do total guardado em todas as metas (com o que falta, quanto guardar por mês e quantas foram batidas) e o
  cartão **"Sobrou R$ X em <mês>: guardar numa meta?"** (sobra do mês aberto, `r.fluxo`), com um atalho por meta que já
  abre o "Guardar" com o valor. Sem sobra, uma dica de quanto guardar por mês.
- Selo de cada meta: No ritmo, Abaixo do ritmo, Prazo passou, Sem prazo, Começando, Batida.
- Ficha (toque no cartão): números, dicas de prazo/ritmo, a linha do que foi guardado mês a mês com o alvo tracejado e o
  histórico (cada registro pode ser excluído).
- Guardar/Retirar: atalhos "+R$ 50/100/200" (somam ao valor digitado), "Do mês", "A sobra" e "O que falta".

### 4.15 Dinheiro guardado

- **Tudo o que você tem:** bancos + investimentos + outras moedas (convertidas), com a comparação com o mês anterior, a
  minilinha dos últimos meses e a barra de composição (conta corrente, caixinha, reserva, investimentos, moedas).
- **Reserva de emergência:** quantos meses de gastos a reserva cobre (média das saídas), num anel com o ideal de 6
  meses; abaixo disso, atalho para criar a meta.
- Bancos com o selo (`BancoIcone`), o guardado, a divisão conta/caixinha/reserva numa barrinha, entrou/saiu no mês e,
  quando a caixinha é limite garantido de um cartão, o aviso "caixinha vira limite no …". No detalhe do banco, cada tipo
  de saldo é um cartão com ícone e campo, e aparecem os cartões de crédito daquele banco (desenhados, com a fatura).
- Investimentos com a minilinha da evolução; outras moedas com as bandeiras em SVG e o valor convertido.
- Investimentos passam a valer de um mês para o outro até serem atualizados (como caixa e moedas, em `mesEfetivo`):
  sem isso, o patrimônio parecia cair a zero em todo mês novo.

### 4.16 Lançamentos

Duas colunas no computador. A lista com selos redondos saiu; cada lançamento agora é um **cartão**.

- **Coluna da esquerda** (presa ao rolar): no alto o **calendário do mês** (cada dia pinta mais forte quanto mais saiu
  nele, com um pontinho verde quando entrou dinheiro; tocar num dia mostra só ele, tocar de novo volta; o "dia que mais
  saiu" no cabeçalho). Embaixo, **Para onde foi** (ou **De onde veio** com o filtro Entradas): as categorias em barras,
  da maior para a menor, com valor e %; tocar filtra a categoria e apaga as outras. Mostra 5 e "Ver todas as N".
- **Coluna da direita**: o **resumo** (Entrou / Saiu / Sobrou lado a lado, com a régua "Saiu 88% do que entrou"), a
  **barra de filtros** (busca, tipo, ordem **Por dia** ou **Maiores**, e banco e forma de pagamento em listas de escolha
  em vez de fileiras de botões) e os lançamentos.
- **Linha do tempo**: cada dia tem o quadradinho da data preso à esquerda, ligado aos outros por um fio (tocar nele filtra
  o dia), o nome do dia ("Hoje"/"Ontem"), quantos lançamentos e o saldo; ao lado, os cartões do dia em grade.
- **Cartão do lançamento** (`CartaoLancamento`, só nesta página): uma faixa na cor da categoria, o nome da categoria em
  cima na mesma cor (sem ícone), a descrição, o valor grande e etiquetas em texto: banco (com o pontinho da cor dele),
  "Cartão Nubank", "Parcela 2 de 6", a forma, "Pagamento de dívida" / "Recebido de quem devia" e "Todo mês".
- Tablet: o resumo vai para o topo e o calendário e as categorias ficam lado a lado embaixo dele. Celular: tudo em uma
  coluna (resumo, calendário, categorias, filtros, lista) e o cartão fica numa linha só, com o valor à direita.
- `ItemLancamento` (lista com selo e etiquetas) continua na Início e no Dinheiro guardado.
- **Sem as compras no cartão de cartões ativos** (com o módulo de cartões ligado): elas ficam na tela Cartões (4.11) para
  não se misturar com o que entrou e saiu da conta. A compra de um cartão que a pessoa deixou de usar continua aqui, porque
  a tela Cartões só mostra os ativos. O resumo, o calendário e as categorias desta página não contam o que saiu daqui. Uma
  faixa avisa "N compras no cartão na fatura de outubro (R$ …) ficam na tela Cartões" com o botão "Ver em Cartões"; com algo
  digitado na busca, ela diz quantas compras (não parcelas) combinam, com o mesmo texto de busca da tela Cartões
  (`casaCompraNoCartao`, que procura a data pelo dia da compra). O total do mês na Início (Saiu) continua contando as
  parcelas da fatura.

### 4.17 Contas do mês (boletos)

- Topo: **pote do mês** (`PoteMeta`, enche com o que já foi pago das contas a pagar) com o que falta, as atrasadas e o
  que há a receber; e a **linha do mês**: os dias numa trilha, um alfinete por dia de vencimento (verde paga, azul a
  vencer, amarelo vence hoje, vermelho atrasada) e o "hoje".
- Cada conta é um **boleto**: canhoto com o dia (picote com dois furos), ícone e nome, valor, a situação e o botão
  "Paguei"/"Recebi" (lápis para outro valor ou data). Paga, ganha o carimbo **PAGO** animado. Uma grade só, da mais urgente
  para a já paga.
- Sem contas: pilha de boletos de exemplo e os atalhos (Aluguel, Luz, Internet, Celular, Academia, Streaming, Salário).
- **Lançamento que é de uma conta** (`conta_fixa_id`, sem migração nova): o dinheiro da conta pode já estar num lançamento
  (veio do extrato, foi lançado à mão). O app reconhece pelo nome (igual ao de um lançamento já ligado à conta, ou com uma
  palavra em comum que não seja "Pix", "transferência"…), pelo valor e pelo dia (`parecencaComConta` em `lib/contasFixas.ts`)
  e aprende com cada vínculo, também dos outros anos (`vinculosOutrosAnos` em `useDados`).
  - No boleto: "Parece que já caiu: Pix de João · R$ 800 · 6 de out" com **É esse** / **Não é**. "Recebi"/"Paguei" com um
    candidato pergunta antes de lançar de novo.
  - No formulário do lançamento: "É de uma conta do mês?" (uma por mês; a conta que já tem lançamento no mês fica indisponível).
    Digitando um nome já ligado ("Pix de João Silva"), a conta vem escolhida.
  - Ligou um? O app procura os parecidos dos outros meses e pergunta "Mais lançamentos da Pensão?" (`ParecidosConta`): os certos
    vêm marcados, os duvidosos não. Só pelo valor, só nos meses em que a conta vale.
  - "Não é" e os desmarcados ficam em `perfil.dispensadas` (`conta:<conta>:<lançamento>`) e não são sugeridos de novo.

### 4.18 Perguntas do primeiro acesso

- Tela cheia: à esquerda a marca, uma paisagem por passo e a lista dos passos (com check nos feitos; dá para voltar
  tocando); à direita uma pergunta por vez, entrando de lado. No celular, só a pergunta com a barra de progresso.
- Escolhas visuais: avatar com as iniciais ao digitar o nome, moedas com as bandeiras em SVG, módulos como cartões com
  ícone, jeito de ver com as miniaturas do painel (`Previas.tsx`, as mesmas das Configurações) e, no fim, o resumo em
  selos.

### 4.19 Importar extrato e organizar nomes

- **Importar extrato** (Lançamentos, menu do avatar e Configurações → Dados): PDF, CSV/TXT, Excel (.xlsx/.xls/.ods), Word
  (.docx) e OFX. `lib/extrato.ts` acha em cada linha a data, o valor e se entrou ou saiu (sinal, "C"/"D", colunas de
  crédito/débito ou palavras como "recebido"/"enviado"), ignora linhas de saldo e junta nomes quebrados em duas linhas.
  - PDF: texto pelo pdf.js, carregado da CDN (cdnjs, versão fixa) só quando alguém importa um PDF; as palavras são
    agrupadas por linha na página. PDF com senha pede para exportar sem senha.
  - Word: `lib/zip.ts` abre o .docx com o `DecompressionStream` do navegador (sem biblioteca) e lê tabelas e parágrafos.
  - Excel: a biblioteca de planilhas que já existe, com as células cruas (datas e números).
  - Tabelas: o cabeçalho é reconhecido ("Data", "Descrição"/"Histórico", "Valor", "Crédito"/"Débito", "Tipo",
    "Tipo de transação", "Movimentação"); sem cabeçalho, as colunas são adivinhadas pelo conteúdo.
  - Entrou ou saiu: um número sem sinal ("40.90") não diz nada sozinho. Se a coluna de valor tem negativos, o sem sinal é
    entrada; se não tem, decide a coluna "Tipo" ("D", "Débito", "Saída", "Compra no débito"…) ou o texto da linha. "-1.200"
    é mil e duzentos.
  - Contas do mês (só no ano aberto): a linha que parece ser de uma conta sem baixa no mês vem ligada a ela (etiqueta com a
    conta, toque para desligar) e vira a baixa ao importar; a que repete uma baixa já dada vem desmarcada.
- **Limpeza dos nomes** (`limparDescricao`): tira CPF/CNPJ (inclusive a raiz de CNPJ de MEI, "51.365.272 Fulano"),
  documentos mascarados, ids de transação, agência/conta, horários, datas grudadas e nomes de banco; transforma
  "TRANSFERENCIA RECEBIDA PELO PIX - FULANO - …" em "Pix de Fulano", "Pagamento de boleto X" em "Boleto X", reconhece
  lojas (iFood, Uber, Netflix…) e corrige TUDO MAIÚSCULO. É idempotente (limpar duas vezes dá o mesmo). O que fica sem
  nome (só números) vira "Entrada"/"Saída" marcado para revisar.
- **Revisão antes de gravar:** nome editável com o original embaixo, entrada/saída trocável, categoria sugerida, filtros
  "para revisar" e "já lançados" (mesmo dia, valor e tipo: vêm desmarcados), banco reconhecido (cria o banco do catálogo
  se a pessoa ainda não tem). Grava tudo de uma vez (`addLancs`, em lotes).
- **Organizar nomes:** a mesma limpeza nos lançamentos do ano aberto, agrupados por nome igual, com antes → depois para
  aceitar ou editar; os que eram só número aparecem em branco, com a data e o valor para lembrar (`renomearLancs`).

### 4.20 Tela de entrada (login e cadastro)

- **Tela inteira dividida** (`Entrada.tsx`): formulário de um lado, painel da marca do outro. O painel é claro e calmo
  (tom neutro com brilhos leves da marca) para a logo completa, grande e cercada de anéis, ser o destaque; embaixo dela
  uma frase em Sora com o final no gradiente da marca. "Entrar" fica à esquerda; "Criar conta", à direita.
- **Lâmina:** ao trocar de modo, o painel é recortado por um polígono cujas quatro bordas (`--en-a`, `--en-b`, `--en-c`, `--en-d`,
  registradas com `@property`) se animam em dois tempos: primeiro avança a borda de um lado (o painel cobre a tela
  inteira) e depois recua a do outro. Um fio com o gradiente da marca acompanha a diagonal.
- **Campos com linha:** o rótulo começa dentro e sobe ao focar ou preencher; a linha se acende com o gradiente. Senha
  com olho para mostrar e, no cadastro, medidor de força. O nome do cadastro vai em `user_metadata.nome` e já aparece
  preenchido na primeira pergunta do painel.
- **Celular:** o painel vira uma faixa diagonal no alto e só o formulário troca.

### 4.21 As telas em cada jeito de ver (a vitrine)

Todas as telas seguem a mesma ideia da Início: **um desenho grande no topo, menos frase e mais sinal**. O topo é a
**vitrine** (`components/Vitrine.tsx`, estilos em `components/vitrine.css`): um desenho (anel, pote, rosca ou velocímetro), o
rótulo, um número só e **pílulas** (ícone, nome curto e valor). Embaixo, os gráficos pequenos que se repetem pelas telas, todos
em SVG e HTML próprios: `Colunas` (meses, com a de agora brilhando; com muitas colunas, o valor aparece só na de destaque e na
maior), `Trilha` (o caminho até a chegada, com a bolinha de hoje e a bandeira no fim), `LinhaDoTempo` (uma barra por item, do
começo ao fim), `BarraDividida` (as partes de um todo, com legenda), `Rosquinha` e `AnelVivo`. Tudo anima ao aparecer na tela
(`useEmVista`) e para com Configurações → Animações: Reduzidas.

| Tela | Simples | Equilibrado | Detalhado |
| --- | --- | --- | --- |
| **Dívidas** | Vitrine (anel do quanto já foi pago, quanto deve, "Sem dívidas em", parcelas por mês e o atrasado se houver) e cada dívida num quadro grande com um botão só ("Pagar R$ X") | + a **trilha** até ficar livre dentro da vitrine, **Quanto sai nos próximos meses** (colunas) e **Do que é feita a sua dívida** (rosca e barra dividida, na cor do banco), e os cartões completos de cada dívida | + **Quando cada dívida acaba** (linha do tempo, pintada até o que já foi pago) e a pílula do total já pago |
| **Metas** | Vitrine (pote de todas as metas) e um **pote grande por meta** com "Guardar" | Vitrine com "Guardar por mês" e os cartões completos (Guardar e Retirar) | + **Quando cada meta chega** (linha do tempo até o prazo ou a previsão) e **Quanto guardar por mês** (barra dividida por meta) |
| **Cartões** | Vitrine (rosca das faturas por cartão, falta pagar, limite livre, em atraso), a carteira e, do cartão escolhido, só a fatura e as compras | + limite e próximas faturas, e as parceladas | + **Quanto do limite cada cartão usa** (com 2 cartões ou mais), as parceladas e as faturas resolvidas |
| **Contas do mês** | Vitrine (pote do que já foi pago, falta pagar, atrasadas, a receber) e os boletos | + a linha do mês | + **Para onde vão as contas** (rosca e barra por categoria) e a lista de contas fixas aberta |
| **Lançamentos** | Vitrine (anel do quanto do que entrou já saiu, sobrou, entrou e saiu), só busca e tipo nos filtros, sem a coluna do lado | + o calendário de calor e as categorias ao lado, e a ordem (por dia ou maiores) | + filtros de banco e de forma de pagamento e a pílula com o número de lançamentos |
| **Dinheiro guardado** | Vitrine (rosca de onde está o dinheiro e uma pílula por parte) e a reserva | + **Como tem mudado** (colunas dos últimos meses) | + **Onde está cada parte** (barra dividida) |
| **Resumo do ano** | Vitrine (anel do quanto do que entrou ficou) e os **12 meses em quadros** (verde sobrou, vermelho faltou, mais forte quanto maior; tocar abre o mês) | + o gráfico mês a mês | + a tabela de cada mês e o gráfico do que sobrou |

No simples, as listas de contas fixas viram um botão "Ver e editar todas as contas fixas (N)" e o fim de cada tela traz o
convite para mudar o jeito de ver.

A vitrine tomou o lugar dos indicadores e do quadro do topo descritos em 4.11 (Cartões), 4.13 (Dívidas), 4.14 (Metas),
4.15 (Dinheiro guardado), 4.16 (Lançamentos) e 4.17 (Contas do mês); o resto de cada tela segue como lá.
