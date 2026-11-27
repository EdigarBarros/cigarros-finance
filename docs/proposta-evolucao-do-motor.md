# Proposta: mapa das fontes de dados e evolução do motor financeiro

Estado: **proposta, nada implementado.** Escrita em 27/11/2026 a partir da leitura do código (branch
`claude/gallant-ptolemy-rxpscd`), de `GPT.md` e de `docs/arquitetura-do-painel.md`. Não rodei a suíte de testes
(o checkout não tinha `node_modules`); onde digo "não encontrei", é resultado de busca no código, não prova de ausência.

"Motor" aqui é o conjunto puro que decide os números do Consultor: `lib/analise.ts` (`analisar()`), `lib/conselheiro.ts`,
`lib/sinais.ts`, `lib/previsao.ts`, `lib/planejador.ts`, `lib/planejamento.ts`, `lib/dividas.ts`, `lib/mudaDeBolso.ts`.
O motor do Invest (`lib/invest/`) é separado e só se liga ao resto por `lib/invest/saldos.ts`.

---

## Parte 1. Mapa das fontes de dados

Legenda: **Chega** = entra em `analisar()` com o significado completo. **Parcial** = entra só em parte, por outro
caminho, ou só em alguns módulos do motor. **Ausente** = existe no banco ou no app mas não chega, ou nem existe.

### 1.1 Resumo

| Fonte | Tabela / origem | Situação |
| --- | --- | --- |
| Lançamentos (12 meses fechados + atual) | `lancamentos` | Chega |
| Compras no cartão (todos os anos) | `lancamentos` com `cartao_id` | Chega |
| Faturas pagas e renegociadas | `faturas_pagas` | Chega |
| Pagamentos parciais de fatura | `faturas_parciais` (mig. 38) | Chega |
| Cartões e limite | `cartoes` | Chega |
| Contas fixas (boletos, salário) | `contas_fixas` + adiantadas em `perfis` | Chega |
| Dívidas, saldos, partes, conferências | `dividas`, `divida_saldos`, `divida_partes`, `divida_conferencias` | Chega |
| Pagamentos de dívida | `lancamentos` com `divida_id` | Chega |
| Metas e movimentos | `metas`, `meta_movimentos` | Chega |
| Dinheiro guardado por banco, moedas | `meses` (`caixa`, `moedas`) | Chega |
| Bancos, categorias, perfil | `bancos`, `categorias`, `perfis` | Chega |
| Cotações de moeda de hoje | API externa (`lib/moedas.ts`) | Chega (só a de hoje) |
| Memória e plano do mês | `perfis.consultor` | Chega (como retroalimentação) |
| Carteira do Invest | `invest_*` | **Parcial**: só o valor de fim de mês |
| Promessas de pagamento | `divida_promessas` | **Parcial**: só `sinais.ts` |
| Dívidas em espera | `dividas.em_espera` | **Parcial**: excluídas de propósito |
| "Me devem" | `dividas.sentido = 'me_devem'` | **Parcial**: agenda e plano; fora da previsão do mês |
| Saldo de um mês para o outro | `perfis.saldo_inicial` + `lib/saldoCorrido.ts` | **Parcial**: fora do motor |
| Valor original em outra moeda | `valor_original`, `moeda_original` | **Parcial**: só convertido |
| Essencial × estilo de vida | nome da categoria (regex) | **Parcial**: inferido, não declarado |
| Saldo real do banco | nenhuma | **Ausente** |
| Inflação e juros de mercado | `lib/invest/indices.ts` (BCB) | **Ausente** no Consultor |
| Calendário anual (IPVA, IPTU, matrícula, 13º, férias) | nenhuma | **Ausente** |
| Renda bruta × líquida, impostos | nenhuma | **Ausente** |
| Limite de cheque especial | nenhuma | **Ausente** |
| Histórico de quando as contas foram de fato pagas | derivável de `data` × vencimento | **Ausente** (não é calculado) |
| Cotação histórica por dia | nenhuma | **Ausente** |

### 1.2 Detalhe por fonte

Cada linha responde: origem, significado, atualização, confiabilidade e relações (o que impede dupla contagem).

#### Lançamentos (`lancamentos`) — Chega
- **Origem:** digitação, importação de extrato (`lib/extrato.ts`), planilha (`lib/planilha.ts`), baixa de conta fixa
  ("Paguei"/"Recebi"), pagamento de dívida, compra no cartão.
- **Significado:** fato de caixa com `data`; `valor` sempre na moeda principal; `tipo` entrada/saída.
- **Atualização:** a cada ação da pessoa; o painel refaz a análise inteira (`useMemo`). Não há sincronização com banco.
- **Confiabilidade:** digitada ou importada; categoria muitas vezes adivinhada na importação. O aviso de repetido na
  importação usa só `dia|tipo|valor` (`chaveDeRepetido`), sem descrição: duas compras iguais no mesmo dia são
  tratadas como repetidas e a mesma compra com valor ligeiramente diferente passa.
- **Relações:** `divida_id` (pagamento de dívida), `conta_fixa_id` (baixa), `cartao_id`/`compra_id`/`parcela`
  (compra em parcelas), `guardado_banco_id`/`guardado_saldo` (dinheiro guardado), `estorno_valor`, `pago_por`.
- **Dupla contagem (regras que existem hoje):**
  - guardar não é gastar (`mudaDeBolso.ts`: por descrição/categoria **e** por `guardado_banco_id`);
  - estorno já vem líquido em `valor`;
  - compra de fatura renegociada sai das saídas (vira dívida);
  - `pago_por` fica na fatura e no limite, fora dos gastos;
  - compra no cartão só vira "saiu" quando a fatura é paga (ou se o mês já passou).

#### Compras, faturas e cartões — Chega
- **Origem:** `lancamentos` com `cartao_id`, `faturas_pagas`, `faturas_parciais`, `cartoes`.
- **Significado:** cada parcela é um lançamento com `data` no vencimento da fatura; a fatura paga/renegociada fecha o ciclo.
- **Atualização:** ação da pessoa. Histórico de faturas já é paginado (correção de 14/11).
- **Confiabilidade:** boa para o que foi lançado; depende de a pessoa marcar a fatura como paga.
- **Relações:** renegociação cria `divida_id`; juros pagos criam `juros_lanc_id`; pagamento da fatura **não** pode
  contar de novo as compras dela.

#### Contas fixas — Chega
- **Origem:** cadastro (`contas_fixas`) + `adiantadas` guardadas nas preferências do perfil.
- **Significado:** compromisso mensal previsto (saída ou entrada) com dia e vigência.
- **Atualização:** cadastro manual; "adiantada" é anotada na baixa.
- **Confiabilidade:** valor "de costume"; muda na baixa.
- **Relações:** a baixa vira lançamento (`conta_fixa_id`). Parcela cadastrada **também** como dívida é deduplicada por
  `mesmoCompromisso` em `analise.ts` (mesmo mês, valor dentro de 5% e mesmo dia **ou** nome parecido). É heurística:
  funciona, mas é o ponto mais frágil da regra "uma vez só".

#### Dívidas — Chega (com três ressalvas)
- **Origem:** `dividas`, `divida_saldos`, `divida_partes`, `divida_conferencias`, pagamentos em `lancamentos`.
- **Significado:** saldo devedor, parcelas, juros do contrato (`juros_mes`) e de atraso, conferências com o banco
  (de onde `jurosAprendido.ts` aprende o que o banco cobra de verdade).
- **Atualização:** pagamento, saldo informado, conferência.
- **Confiabilidade:** a melhor do app quando conferida; estimada quando não há `juros_mes` (o texto avisa).
- **Ressalvas:** (a) `em_espera` sai do consultor, mas a dívida continua correndo juros e comprometendo o futuro
  (decisão intencional do dono; fica registrada como risco de a capacidade parecer maior); (b) **promessas**
  (`divida_promessas`) só chegam em `sinais.ts`, não na previsão nem no planejador; (c) "me devem" entra na agenda
  e no Planejamento, mas a previsão do mês só conta recebimento que está em conta fixa/recorrência.

#### Dinheiro guardado e Invest — Parcial
- **Origem:** `meses.caixa` (por banco: conta, caixinha, reserva), `meses.investimentos`, `meses.moedas`; carteira em `invest_*`.
- **Significado:** estoque (saldo) no fim do mês, digitado. Com o Invest ligado, `mesesComCarteira` troca
  `investimentos` pelo valor da carteira no fim de cada mês.
- **Atualização:** a pessoa digita; a carteira é recalculada das operações.
- **Confiabilidade:** saldo digitado envelhece (vale "de um mês para o outro até atualizar"); preço da carteira é
  informado/importado, nunca inventado (selo de idade).
- **O que não chega:** operações, proventos, rentabilidade, vencimentos, liquidez, risco, aporte planejado
  (`invest_config`), CDI/Selic/IPCA. O Consultor só enxerga **um número por mês**.
- **Dupla contagem:** o saldo do banco só anda no sentido contrário se a operação marcar "tirar do saldo dessa
  conta". **Se não marcar, o mesmo dinheiro pode aparecer na conta e na carteira.** A regra existe, mas depende de
  a pessoa marcar; vale um teste de invariante (ver Etapa 1). Provento só vira entrada se a pessoa pedir
  (`lancamento_id`).

#### Saldo de um mês para o outro — Parcial
- `saldosDoAno` (`lib/saldoCorrido.ts`) calcula um saldo corrido a partir de um ponto de partida informado. O motor
  não o usa: para a agenda ele parte do saldo da **conta corrente** informado em `meses.caixa[*].cc`. Há dois
  conceitos de "saldo" convivendo, sem reconciliação entre eles.

#### Moedas e cotações — Parcial
- `valor` já está na moeda principal; o original fica em `valor_original`/`moeda_original`. As cotações são as de
  **hoje** (`lib/moedas.ts`, sem histórico). Patrimônio em moeda estrangeira reflete o câmbio de hoje também nos meses
  passados.

#### Essencial × estilo de vida — Parcial
- O grupo (`essencial`, `estilo`, `dividas`, `outros`) sai de `RE_ESSENCIAL` aplicada ao **nome** da categoria. A
  pessoa não declara o que é essencial. Isso alimenta a regra 50/30/20, o corte sugerido e a ordem do que cortar.
  Para uma regra rígida de "necessidades essenciais nunca cedem", inferência por nome é frágil.

#### Ausentes
- **Saldo real do banco / Open Finance:** tudo parte de lançamento digitado; "acertar com o banco" está registrado
  como "fica para depois" (§4.15.1). Sem conciliação, o erro de lançamento acumula.
- **Inflação e juros de mercado no Consultor:** o Invest já baixa CDI/Selic/IPCA do Banco Central; o Consultor
  projeta patrimônio e reserva sem inflação.
- **Calendário anual:** despesas que vêm uma vez por ano só aparecem se a recorrência tiver 3+ ocorrências em 12 meses.
- **Renda bruta/líquida, 13º, férias, impostos:** a renda é "o que entrou".
- **Limite de cheque especial / crédito pré-aprovado:** o motor trata saldo negativo como "vermelho", mas não sabe o
  teto nem o custo do dia.
- **Pontualidade histórica:** o app tem vencimento e data de pagamento, mas não mede o atraso típico de cada conta
  nem o atraso típico de cada entrada (útil para incerteza).

### 1.3 Regras de não duplicar (consolidadas)

Hoje essas regras estão espalhadas em `analise.ts`, `conselheiro.ts`, `previsao.ts`, `mudaDeBolso.ts` e `Painel.tsx`
(`contaNasSaidas`, `lancsComGuardados`). O que a proposta pede é **um lugar só** e **testes de invariante**:

1. Transferência interna soma zero no patrimônio e não é renda nem gasto.
2. Cada compra no cartão conta **uma** vez: como compra/parcela, ou como pagamento da fatura, nunca os dois.
3. Pagamento de dívida conta **uma** vez: lançamento, parcela em conta fixa, ou parcela da dívida.
4. Aporte em investimento sai da conta e entra na carteira, sem criar patrimônio.
5. Provento que virou entrada não conta de novo como rendimento da carteira.
6. Estorno reduz o gasto original, não vira renda.

---

## Parte 2. Evolução proposta do motor

### 2.1 Diagnóstico do motor atual

O que ele faz bem e deve ser **preservado**: é puro e determinístico, tem regras de precisão cuidadosas (guardar não é
gastar, salário em duas partes, parcela assumida nunca é "dá para cortar"), explica cada número ("Por quê?") e tem
suíte de cenários.

Onde ele tem teto:

| Limite | Onde está | Efeito |
| --- | --- | --- |
| Previsão do mês é **um número** | `analise.ts` ~1178: `peso·ritmo + (1−peso)·costume`, com `peso = dia/diasNoMes` | Não diz quão provável é fechar negativo |
| Estatística básica e global | `inclinacao`, `desvio`, `mediana` | Sem sazonalidade, sem outliers robustos, sem peso por quantidade de dados |
| Sem cenários | só "estratégias de dívida" simuladas | Não responde "e se eu perder a renda?" |
| Planejador é guloso | `planejador.ts`: paga o que cobra mais caro no dia da entrada | Bom na maioria dos casos; sem garantia de ótimo nem de provar que respeitou restrições |
| Essencial por regex | `RE_ESSENCIAL` | Restrição "essencial nunca atrasa" não tem base declarada |
| Dupla contagem por heurística espalhada | `mesmoCompromisso`, `mudaDeBolso`, filtros no `Painel.tsx` | Difícil de provar que nada conta duas vezes |
| Sem medida de acerto | testes são cenários, não histórico | Não dá para dizer "ficou X% melhor" |

### 2.2 Arquitetura

Novo diretório `src/lib/motor/` (puro: sem React, sem banco, data por `hoje`, sorteio com **semente**). O
`analisar()` continua com a mesma assinatura; cada camada nova entra **ao lado**, em modo sombra, até provar que melhora.

```
EntradaAnalise (a de hoje)
   │
   ▼
[1] Razão canônico        ← cada dinheiro vira um Fato com tipo, vínculo, confiança e "grupo de contagem"
   │                         invariantes: nada conta duas vezes; relatório do que foi excluído e por quê
   ▼
[2] Cálculos verificáveis ← juros, Price/SAC, valor presente, reconciliações; todo número leva sua "prova"
   │
   ▼
[3] Estatística individual← medianas robustas, sazonalidade (se houver ≥ 24 meses), encolhimento para poucos dados
   │
   ▼
[4] Previsão com incerteza← faixas P10/P50/P90 e probabilidade de ficar no vermelho
   │
   ▼
[5] Cenários              ← Monte Carlo reprodutível; cenários declarados como dados
   │
   ▼
[6] Regras explícitas  ───┐   essenciais, reserva mínima, ordem legal, teto de custo (dados versionados)
   │                      │
   ▼                      ▼
[7] Otimizador de pagamentos  (só escolhe entre planos que **cumprem** as regras)
```

**Ordem de autoridade (inegociável):** regras explícitas → otimizador → estatística. Modelo estatístico nunca
revoga uma restrição; ele só ajuda a escolher entre planos viáveis e a dizer o quanto confiar neles. Se nenhum plano
cumpre as regras, o motor diz que **não cabe**, mostra a falta mínima e o que negociar, e não "sacrifica" um essencial
em silêncio.

### 2.3 Regras explícitas (camada 6)

Dados, não código espalhado (`regras.ts`, cada uma com `id`, texto, e aparece no "Por quê?" quando decide algo):

| Regra | Efeito |
| --- | --- |
| Essencial não atrasa | Moradia, água, luz, gás, alimentação, saúde, transporte para trabalhar, pensão, educação obrigatória: pagos no prazo; só cede se **todas** as alternativas violam outra regra mais forte, e nesse caso o motor avisa e propõe negociar |
| Colchão de segurança | Saldo mínimo = gasto essencial até a próxima entrada (nunca zerar a conta para pagar não essencial) |
| Não pagar dívida barata com dívida cara | Nunca usar rotativo/cheque especial para quitar algo com juro menor |
| Reserva mínima | Respeita o colchão da fase (1 mês; depois 6 ou 12); só a parte acima dele entra em "adiantar dívida" |
| Ordem de prioridade legal | Pensão, tributos com restrição de bem e o que pode gerar corte/bloqueio vêm antes de crédito comum |
| Aviso, não ordem | Em tudo que for decisão da pessoa o motor recomenda; nunca move dinheiro sozinho |

**Decisão para o dono:** hoje "essencial" é inferido pelo nome da categoria. Para essas regras valerem, a categoria
precisaria de um campo **declarado** (`categorias.essencial`, nova migração). Sem a migração, a regra funciona com a
inferência atual e avisa quando o dado é inferido.

### 2.4 Previsão com incerteza (camada 4)

Substituir a previsão de ponto por uma distribuição, mantendo o número de hoje como mediana de comparação:

- **Parte determinística:** o que tem data e valor (contas, parcelas, faturas) entra como certo, **mais** a chance de
  atraso de cada entrada, medida do histórico da própria pessoa (quando há dados; senão, prior fraco e dito).
- **Parte incerta:** gasto do dia a dia dos dias que faltam, por **bootstrap em blocos** do histórico individual
  (preserva a correlação entre dias, como fim de semana e semana do pagamento).
- **Saída:** P10/P50/P90 do resultado do mês, probabilidade de saldo negativo antes de cada vencimento relevante,
  e uma etiqueta honesta de confiança (poucos dados → faixa larga e dita).
- **Poucos dados:** encolhimento (empirical Bayes) em direção a um comportamento de referência, com peso da pessoa
  crescendo com o número de meses. Nunca finge precisão: abaixo de um mínimo, mostra "ainda poucos dados".

### 2.5 Simulação de cenários (camada 5)

Cenário = dado declarativo (`{ rende: -100% por 2 meses }`, `{ nova parcela: 450 por 12 }`, `{ corte: estilo −15% }`,
`{ juros +2 p.p. }`, `{ adiantar dívida X em R$ Y }`). O simulador roda a agenda 1.000 a 5.000 vezes com PRNG de
semente fixa (mesmo resultado em qualquer aparelho) e devolve: probabilidade de faltar dinheiro, meses de reserva
(P10/P50), data de quitação (P50/P90), custo total de juros. Os cenários reaproveitam a mesma agenda do motor (uma
única fonte da verdade), não uma conta paralela.

### 2.6 Otimização de pagamentos (camada 7)

O problema: dadas as obrigações (valor, vencimento, custo do atraso, essencial ou não) e as entradas (valor, dia,
incerteza), escolher **em que dia pagar cada uma** para minimizar o custo total (multa + juros) sujeito às regras da
camada 6.

- **Escala pequena** (dezenas de obrigações, ~60 dias): dá para resolver de forma **exata** (busca com poda para os
  itens críticos; heurística + busca local para o resto), sem biblioteca externa, 100% em TypeScript puro.
- **Verificação:** em instâncias pequenas, comparar com força bruta; em todas, conferir que o plano **cumpre cada
  regra** (verificador independente do otimizador).
- **Comparação com o guloso atual:** o planejador de hoje vira a linha de base; o novo só entra se custo ≤ guloso
  em 100% dos casos e menor em parte deles, com zero violação de regra.
- **Adiantar dívida:** avalanche é ótima para custo de juros, mas só com folga de caixa; o otimizador decide com o
  colchão e a incerteza, não só com a taxa.
- **Robustez:** na versão com incerteza, o plano é avaliado em vários cenários de entrada (ex.: salário atrasa 3
  dias) e escolhido o que mantém os essenciais em dia em todos, ou o de menor custo esperado se houver empate.

---

## Parte 3. Etapas, problema que resolve e como provar a melhora

Princípio: **medir antes de mexer.** Sem uma régua do motor atual, "melhorou" vira opinião.

| # | Etapa | Problema que resolve | Entrega | Como será demonstrado |
| --- | --- | --- | --- | --- |
| 0 | **Régua e linha de base** | Hoje só há testes de cenário (20 do painel); ninguém mede erro de previsão nem custo do plano | Harness de *walk-forward* (`scripts/motor/medir.mjs`): em cada mês de um histórico, roda o motor como se fosse o dia 5, 15, 25 e compara com o que aconteceu | Tabela de números do **motor atual**: MAE/MAPE da previsão do resultado do mês, % de avisos de aperto que aconteceram, custo de atraso do plano guloso. Esse é o placar a bater |
| 1 | **Razão canônico e invariantes** | Dupla contagem evitada por heurísticas espalhadas; risco conhecido no Invest sem "tirar do saldo" | `motor/razao.ts` + relatório "o que foi excluído e por quê"; invariantes 1–6 da seção 1.3 como testes | Zero violação em todos os casos existentes **e** num gerador de histórico sintético com 1.000 combinações (propriedade: somas batem). O relatório aponta os casos em que `mesmoCompromisso` decidiu por heurística |
| 2 | **Cálculos verificáveis** | Números sem prova; juros e saldos recalculados em vários lugares | `motor/calculo.ts`: juros, Price/SAC, valor presente, reconciliação (patrimônio = ativos − passivos; Δ saldo = fluxo) com a "prova" anexada a cada número | Testes com resposta conhecida (tabelas Price/SAC de referência, casos do `GPT.md`/painel), mais teste de propriedade (soma das partes = total) |
| 3 | **Estatística individual** | Média/desvio sensíveis a um mês atípico; sem sazonalidade; mesma confiança com 3 ou 12 meses | `motor/estatistica.ts`: mediana e MAD, outliers, sazonalidade com ≥ 24 meses, encolhimento por quantidade de dados | No walk-forward, o erro da previsão central **não piora** frente à linha de base e melhora em meses com outlier; teste de que poucos dados geram "dados insuficientes" |
| 4 | **Regras explícitas** | "Essencial" é regex; restrições não são verificáveis | `motor/regras.ts` + (se aprovada) migração `categorias.essencial` | Verificador de plano: nenhum plano de teste viola regra; casos "infeasible" devolvem falta mínima e o que negociar |
| 5 | **Previsão com incerteza** | Um número só; sem probabilidade de ficar no vermelho | Faixas P10/P50/P90 e probabilidade de saldo negativo | **Calibração:** a faixa de 80% cobre ~80% dos meses reais (aceito 75–85%); *pinball loss* menor que a previsão de ponto; alertas de aperto com mais acerto e antecedência |
| 6 | **Simulação de cenários** | Não responde "e se…?" | Cenários declarativos + Monte Carlo com semente | Mesmo resultado em duas execuções; casos extremos (renda zero) batem com cálculo à mão; desempenho dentro do orçamento no celular (meta: < 300 ms para 2.000 simulações, a confirmar) |
| 7 | **Otimizador de pagamentos** | Planejador guloso sem garantia de ótimo nem de restrições | `motor/otimizar.ts` com verificador independente | Em instâncias pequenas = força bruta; em geral custo ≤ guloso em 100% dos casos; zero violação de regra; relatório de economia em R$ |
| 8 | **Modo sombra → tela** | Entregar sem arriscar o que já funciona | Motor novo roda ao lado do atual, só registra diferenças (localmente); depois, textos sem jargão na tela ("entre R$ X e R$ Y, mais provável R$ Z") atrás de chave | Critérios de aceite abaixo; só então vai ao site pelo fluxo do `CLAUDE.md` (PR → branch de produção → Vercel → `versao.json`). Se mudar tela ou banco de um jeito que o app precise, gerar nova versão Android |

**Ordem e dependências:** 0 → 1 → 2 (fundação); 3 e 4 em paralelo; 5 depende de 1 e 3; 7 depende de 4; 6 depende de 5;
8 por último. Cada etapa termina com testes passando e **nada muda na tela** até a 8.

### Critérios de aceite (definidos antes de implementar, para não ajustar a régua ao resultado)

1. **Zero** violação das invariantes de dupla contagem e das regras explícitas, em todos os testes e no gerador.
2. Previsão central: erro absoluto médio **não maior** que o da linha de base, e **menor** em pelo menos metade das
   famílias de histórico testadas (renda estável, variável, com atraso de salário, com outlier).
3. Faixas: cobertura de 80% entre 75% e 85% no walk-forward.
4. Plano de pagamentos: custo ≤ guloso em 100% das instâncias; economia média reportada em R$ e em % do custo.
5. Reprodutível: mesma entrada e mesma semente dão o mesmo resultado.
6. Sem regressão: os 101 casos existentes (20 painel, 54 extrato, 27 invest) continuam passando.

### Honestidade sobre os dados de teste

- **Sintéticos com verdade conhecida** (gerador com semente): provam correção e calibração, mas não que o mundo real
  se parece com eles.
- **Histórico real** pesa mais. Se o Edigar autorizar, uso o dele (exportado e anonimizado, **fora do repositório**:
  o `GPT.md` proíbe registrar dados financeiros reais). Sem isso, a prova de melhora fica limitada ao sintético, e eu
  vou escrever isso no relatório em vez de vender como validação completa.

---

## Decisões que preciso do Edigar antes de começar

1. **Essencial declarado:** posso criar `categorias.essencial` (migração 47, a rodar no Supabase por você), ou fico com
   a inferência por nome e deixo o aviso na tela?
2. **Dados reais para a régua:** autoriza usar um histórico real anonimizado (fora do repositório) ou ficamos só com
   sintético, assumindo o limite acima?
3. **Dívida em espera:** continua fora do motor (como decidido), mas posso mostrar, só no relatório de risco, quanto ela
   cresce enquanto isso?
4. **Linguagem da incerteza:** "entre R$ X e R$ Y" e "chance de faltar dinheiro: 1 em 5" servem, ou prefere só uma
   faixa sem probabilidade?
5. **Invest:** na primeira rodada, o Consultor continua vendo só o valor do mês da carteira (com o teste de invariante
   da dupla contagem), e proventos/rentabilidade ficam para uma fase seguinte?
