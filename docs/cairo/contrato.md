# Cairo: contrato entre a parte de dados e a parte de decisão

Versão do contrato: **1.0.0** (`CONTRATO_VERSAO` em `src/cairo/contrato/tipos.ts`). Dono: parte de dados (Claude 1).
Coordenação, quem faz o quê e migrações: [`coordenacao.md`](coordenacao.md).

O Cairo é o motor financeiro novo do OpusCash, em `src/cairo/`. Ele tem duas partes:

- **Dados** (Claude 1): transforma os registros do app em fatos com qualidade, aprende o padrão da pessoa, separa as
  condições de custo, prevê com faixa e gera os cenários. Pastas `contrato/`, `fatos/`, `qualidade/`, `aprendizado/`,
  `custos/condicoes.ts`, `cenarios/`, `previsao/`, `regua/`.
- **Decisão** (Claude 2): calcula custos (atraso, antecipação, TIR), planeja caixa e pagamentos, dívidas e metas, aplica
  restrições e prioridades, compara alternativas e explica. Ele consome `LeituraDoCairo` e não reimplementa a parte de dados.

## 1. Onde o app liga o Cairo

- `src/lib/analise.ts` chama `leituraDoCairo` (de `src/lib/cairo.ts`) no fim de `analisar` e devolve em **`analise.cairo`**
  (`LeituraDoCairo | null`). Toda tela que recebe a análise tem o Cairo. `null` = o núcleo falhou; o Consultor segue igual.
- `src/lib/cairo.ts` é a **ponte**: o único arquivo que conhece os tipos do app (`lib/types.ts`) e os do Cairo. Reaproveita
  o que o app já calcula certo: a agenda (`Evento[]` de `analise.ts`), as promessas avaliadas (`promessasDe`), o que te devem
  (`aReceberPrevisto`) e o aprendizado de juros (`aprenderJuros`).
- `globalThis.__cairo`: diagnóstico da última leitura, sem dado financeiro (`ok`, `ms`, `avisos`, `violacoes`, `mesesNoFluxo`).

## 2. Regras do núcleo (valem para as duas partes)

- `src/cairo/**` **não importa** React, Supabase, Capacitor nem `src/lib` (regra de lint em `.oxlintrc.json` e teste de
  pureza em `scripts/cairo/testar.mjs`). `src/lib` pode importar `src/cairo`, nunca o contrário.
- Checagem estrita: `tsconfig.cairo.json` (`strict`, sem DOM). `npx tsc -b` roda as duas checagens.
- **Sem relógio**: `hoje` sempre entra por parâmetro. **Sem texto**: o núcleo devolve `Motivo` (código + números); a tela
  traduz com `tx`.
- Sorteios só com semente (`aprendizado/aleatorio.ts`): mesma semente, mesmos mundos, em qualquer aparelho.

## 3. Unidades (`contrato/unidades.ts`)

| Tipo | O que é | Regra |
|---|---|---|
| `Centavos` | inteiro de centavos | `Number.isSafeInteger`; nunca número com vírgula |
| `Moeda` | código ISO 4217 (`BRL`) | `somar` de moedas diferentes lança `ErroDeUnidade`; conversão só com `Cotacao` |
| `Valor` | `{ centavos, moeda }` | |
| `DiaISO` | `AAAA-MM-DD`, data civil | sem `Date`, sem fuso; contas por `numero(dia)` |
| `MesISO` | `AAAA-MM` | |
| `Taxa` | `{ fracao, periodo, regime }` | `0,025` = 2,5%; período `dia`/`mes`/`ano`; regime `simples`/`composta`. Mês = 30 dias, ano = 12 meses. Mudar de período só com `converterTaxa` (30 × a diária só vale no regime simples) |

**Atenção:** a chave de mês do app (`chaveMes` em `lib/cartoes.ts`) é `ano × 12 + mês − 1`; a do Cairo (`chaveDoMes`) é
`ano × 12 + mês`. Entre os dois, use `MesISO`.

Percentual só existe na fronteira: `contrato/validar.ts` converte uma vez (`lerTaxaPercentual`, `lerTaxaFracao`) e recusa
juro de contrato acima de 100% ao mês (troca de unidade ou digitação). Regra de atraso aceita até 1.000% ao mês
(`TETO_ATRASO_MENSAL`: "5% ao dia" existe), com aviso acima de 25%.

## 4. Fato, declaração, estimativa, desconhecido (`contrato/tipos.ts`)

- `Fato<T>` (`tipo: 'fato' | 'declarado'`): aconteceu e está registrado, ou a pessoa disse. Tem `Proveniencia`.
- `Estimativa<T>`: o Cairo calculou sem certeza. Sempre com `Distribuicao`, `metodo`, `nEf` (tamanho efetivo da amostra) e
  `pesoDoHistorico` (0 = só a referência, 1 = só o histórico).
- `Desconhecido`: não dá para saber; tem `motivo` e se a pessoa pode resolver (`resolvivelPelaPessoa`).
- **Decisão** é tipo da parte de decisão (`contrato/decisao.ts`, dela). Uma decisão do Cairo nunca volta como entrada da
  parte de dados; só a decisão **declarada** pela pessoa volta.

`Proveniencia`: `refs` (`{ tabela, id, versao }`, versão null até as tabelas terem versão por linha), `conhecidoEm` (quando o
app soube: `created_at`) e `atualizadoEm` (até quando vale com certeza).

## 5. Incerteza

`Distribuicao<T>`: quantis `p05 … p95`, `pNaoOcorre` (o evento pode não acontecer) e `calibracao`.

- Os quantis são **preditivos**: "p90 = R$ 2.100" quer dizer que, em 9 de cada 10 situações como esta, o valor fica abaixo.
- Isso só vale depois de calibrar. `calibracao.cobertura80` é a fração medida em que o real caiu entre p10 e p90. **Hoje é
  `null` em produção** (ainda não há registro de previsões com dados reais). Enquanto for null, a tela não usa a palavra "chance".

## 6. Qualidade dos dados (`QualidadeDosDados`)

- `meses[]` (`QualidadeDoMes`): `gastos` = `conta` | `parcial` (bem menos saídas que o costume da pessoa) | `sem_registros`;
  `renda` = `conta` | `zero_real` (mês bem registrado sem entrada, de quem costuma lançar o que recebe e sem conta fixa de
  entrada esperando baixa) | `nao_registrada` | `sem_registros`. `mesEntraNoFluxo` decide se o mês entra nas médias.
  **O Consultor antigo (`analise.ts`, `conselheiro.ts`) usa exatamente esta regra desde esta versão.**
- `lancadosDepois`: lançamentos registrados mais de 3 dias depois da data deles (fração e mediana).
- `semDataDeCriacao`: registros sem `created_at`.
- `saldo`: o saldo da conta corrente é "do mês" (o próprio ou herdado de um mês anterior): `validoAte` = fim desse mês;
  `idadeMaximaDias` = dias desde o começo dele. O app não guarda o dia em que o saldo foi atualizado.

## 7. O que cada lançamento é (`fatos/movimentos.ts`)

`classeDoLancamento`: `renda`, `gasto`, `credito_recebido` (entrada ligada a dívida sua), `emprestimo_concedido` (saída ligada
a "me devem"), `devolucao_recebida` (entrada ligada a "me devem"), `transferencia_propria` (caixinha, poupança, entre contas
suas: pelo campo `guardado_banco_id` ou pela descrição) e `pago_por_outro`. Só `renda` e `gasto` entram nas somas.

Contagem única (`fatos/contagem.ts`): `violacoes` (defeito nosso; tem de ser vazio) e `avisos` (a pessoa pode ter lançado em
dobro: fatura paga também lançada como saída comum; conta fixa paga ainda na agenda).

## 8. Condições de custo (`CondicaoDeCusto`, `custos/condicoes.ts`)

Cada dívida tem uma lista, separada pelo que cada condição É. As contas com elas são da parte de decisão.

| `tipo` | O que é | Pode usar para |
|---|---|---|
| `contratual` | juro do contrato (`juros_mes`), `Taxa` composta ao mês | descontar parcelas futuras numa antecipação (se a regra de antecipação permitir) |
| `fluxo_do_contrato` | recebido (`valor_recebido`), parcelas (vencimento e valor) e `recebidoEm` | TIR / custo efetivo total. **`recebidoEm` é null quando o app não sabe o dia em que o dinheiro foi recebido**: a taxa implícita sai num intervalo. Ela inclui IOF e tarifas: é o limite de cima do desconto, não a taxa do contrato |
| `atraso` (`fonte: 'informada'` ou `'aprendida'`) | como a dívida cresce ENQUANTO atrasada: multa (fração), `mora` (`Taxa`) ou `porDia` (`Valor`), `base` | custo de atrasar. **Nunca** para desconto de antecipação |
| `antecipacao` | o que o contrato diz sobre adiantar. Hoje sempre `desconhecida` (o app não pergunta) | decidir se existe desconto; com `desconhecida`, a economia mínima de antecipar é zero |
| `encargo` | juros, tarifa ou IOF já pagos (hoje: os juros pagos junto da fatura) | fato, não taxa |
| `oferta_quitacao` | "para quitar hoje, R$ X" de uma conferência | cotação de um dia; não ensina juros |

**Juros aprendidos:** desde esta versão, uma conferência feita com a dívida EM DIA não ensina a regra de atraso
(`regimeDaConferencia` em `lib/jurosAprendido.ts`: pista com base 0, ou dívida aberta com juros do contrato e sem parcela
atrasada). Antes, o crescimento pelo juro do contrato virava "regra de atraso" sugerida.

## 9. Cenários (`GeradorDeCenarios`, `cenarios/gerador.ts`)

`analise.cairo.cenarios`: `gerar(n, semente)` dá `n` mundos (`Mundo`), `mediano()` o futuro mais provável e `esperados` a
agenda incerta, **igual em todos os mundos**. Horizonte: de hoje ao fim do mês que vem.

Cada `Fluxo` tem `dia` (quando o dinheiro se move) e `reveladoEm` (quando a pessoa fica sabendo), além de `origem`:

| O quê | `origem` | `natureza` | `reveladoEm` |
|---|---|---|---|
| conta fixa, parcela, fatura, lançamento futuro | `compromisso` | `obrigacao` (saída) / `renda` (entrada) | saída: hoje; entrada: o dia em que caiu no mundo |
| recorrência detectada (ninguém contratou) | `previsto` | `obrigacao` / `renda` | idem |
| me devem | `previsto` | `a_receber` | o dia em que caiu (só existe nos mundos em que a pessoa pagou) |
| dia a dia | `previsto` | `dia_a_dia` | o próprio dia |

- A renda de cada fonte atrasa ou falta conforme o aprendido (`aprendizado/entradas.ts`); o "me devem", conforme a
  pontualidade da pessoa (`aprendizado/pontualidade.ts`).
- O dia a dia é sorteado de dias reais da pessoa (`aprendizado/diaADia.ts`), com o pico depois de cada entrada QUE CAIU NAQUELE
  MUNDO (`dependeDe: { relacao: 'desloca_junto' }`).
- **Não-antecipação:** a política só pode receber `revelar(mundo, esperados, dia)` → `Observado { conhecidos, esperados }`.
  `conhecidos` tem só `reveladoEm <= dia`; `esperados` é igual em todo mundo (renda atrasada continua esperada com
  `esperadoEm`; cada esperado traz `pOcorre`). `trocarFuturo(a, b, dia)` monta o par do teste: dois mundos iguais até `dia`.
  O teste da parte de decisão deve mostrar que as ações até `dia` são as mesmas nos dois.
- Limitações desta versão: o gasto futuro no cartão (que entra na próxima fatura) não é sorteado, só as parcelas já
  conhecidas; o dia a dia não separa essencial de conforto (`dia_a_dia`), porque isso depende do que a pessoa declarar.

## 10. Aprendizado individual

Cada parâmetro parte de uma referência explícita (`contrato/politicas.ts`) e vai pesando o histórico:
`pesoDoHistorico = n / (n + k)`. O `n` é a massa das observações, cada uma com peso de qualidade × idade (meia-vida de 180 dias)
× mudança de comportamento (o que veio antes de uma quebra pesa 0,25). Os valores de `REGRAS` com classe
`parametro_estatistico` são ponto de partida, não garantia: a régua deve calibrá-los.

- `aprendizado.diaADia`: média diária, pico depois de entrada, quebra (mudança de nível mensal) e `nEf`.
- `aprendizado.entradas`: por fonte de renda (conta fixa ou detectada pela descrição), o atraso (quantis em dias) e `pNaoOcorre`.
- `aprendizado.pontualidade`: por pessoa que te deve, `p` de pagar no combinado com faixa `p10`–`p90`.

Os parâmetros são **recalculados** a cada leitura a partir dos registros (que já sincronizam entre aparelhos pelo banco): o
mesmo histórico dá o mesmo aprendizado em qualquer aparelho, sem conflito.

## 11. Previsões

`analise.cairo.previsoes()` (calculada na primeira chamada; 400 cenários): `diaADiaRestoDoMes` e `diaADiaMesQueVem`, como
`Estimativa<Centavos>`. Régua: `node scripts/cairo/testar.mjs --regua`.

## 12. Versionamento

- Campo opcional novo: sobe o número do meio de `CONTRATO_VERSAO`. Qualquer outra mudança: sobe o primeiro e atualiza os
  consumidores na mesma entrega.
- Versões gravadas na leitura: `versao.contrato` e `versao.dados` (`CAIRO_DADOS_VERSAO`); o gerador tem `GERADOR_VERSAO`.
