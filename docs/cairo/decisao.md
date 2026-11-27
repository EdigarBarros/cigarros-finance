# Cairo: parte de decisão (Claude 2)

Custos, planejamento de pagamentos e consequências. Consome a parte de dados (Claude 1) pelo contrato
([`contrato.md`](contrato.md)); quem faz o quê e os pedidos estão em [`coordenacao.md`](coordenacao.md).

Estado: **etapa 1 publicada** (27/11/2026). O que está abaixo como "ativo" muda o que a pessoa vê no Consultor.

## 1. O que está ativo no app

| Recomendação | Onde a pessoa vê | O que mudou |
|---|---|---|
| Quitar dívida com o guardado (`quitar-com-reserva`) | Consultor → plano de ação | O desconto de quitar sai **só do juro do contrato** (nunca do juro do atraso). Sem o juro do contrato, o passo vira pergunta ("Peça o valor para quitar…") e não promete economia. Com o juro do contrato mas sem saber o que o contrato diz sobre adiantar (hoje sempre), a economia é "pode deixar de pagar… se o credor der o desconto" e o mínimo garantido é zero. Com a oferta do credor ("para quitar hoje") de até 30 dias, vale o valor dele. |
| Estratégias de dívida (avalanche × bola de neve, "adiantar") | Consultor → dívidas | A simulação desconta parcelas adiantadas só pelo juro do contrato; sem ele, adiantar abate o valor cheio (não inventa economia). `jurosEmbutidos` deixa de contar juro de atraso como "juros embutidos". |
| Ordem de pagamento quando o dinheiro não dá (`escolha:*`) | Consultor, Kairo, Planejar o mês | Primeiro o que **a pessoa** priorizou; depois as contas **essenciais** (política do app: moradia, água, luz, gás, saúde, escola, mercado, pela categoria); depois o que cobra mais caro pelo atraso. Quando a política custa mais que a ordem pelo custo, a dica diz quanto. |
| Essencial do dia a dia | Consultor (`pagar-em:*`) | Com o saldo de hoje informado, conta não essencial não usa o dinheiro do mercado/farmácia/transporte até o próximo dinheiro. A dica diz quando é por isso e quanto custaria não esperar. |
| Depois do fim do plano | Consultor (`adiantar-aberta:*`) | O plano vai até o fim do mês que vem; o essencial entre esse fim e o primeiro dinheiro depois dele fica separado. "Adiantar dívida" só usa o que sobra além disso. |
| Falta mínima e saídas (`sem-dinheiro`) | Consultor | Quanto faltaria hoje para nada atrasar (busca no próprio plano) e de onde pode vir: o guardado (escolha da pessoa), quem te deve (condicional; o plano não conta com isso), negociar datas. |
| "E se" (`e-se:*`) | Consultor (prioridade abaixo do que já acontece) | Só com o que o **Cairo aprendeu** da renda da pessoa (`aprendizado.entradas`: atraso p90 e falta). Sem histórico que mostre atraso ou falta, não há "e se". A frase diz "como já aconteceu", nunca "chance" (calibração ainda null). |
| Parcela nova | Formulário de compra parcelada e de dívida nova (fala do Kairo) | Além do peso na renda, o plano é refeito com as parcelas nas datas delas: alguma conta passa a atrasar? Tira o essencial de depois do fim? Até quanto por mês caberia sem atrasar nada. Sem o saldo de hoje, diz que falta o dado. |
| Decisão explicada | Consultor → plano de ação → "por quê" | Selo (Recomendação, A escolha é sua, Depende de acontecer, Pode mudar com um dado que falta, Segue a sua prioridade), "Com base em" (premissas) e "Também pensei em" (alternativas). |

## 2. Arquivos

| Arquivo | O que faz |
|---|---|
| `src/lib/decisoes/custos.ts` | Juro do contrato (`jurosDoContrato`, `custosDasCondicoes` lê as condições do Cairo), quitação por datas (`quitacaoHoje`: vencido + encargos do atraso à parte + a vencer com desconto só do contrato; estados `confirmado`, `calculado`, `estimado`, `sem-desconto`, `desconhecido`; `minimoGarantido`), economia de adiantar (`null` quando desconhecida). |
| `src/lib/decisoes/taxaImplicita.ts` | Taxa dos fluxos por datas (TIR, bisseção). Diz o que falta para ser o CET (`faltaParaCET`: IOF, tarifas, seguro, data do recebimento). Nunca vira desconto sozinha. |
| `src/lib/decisoes/decisao.ts` | `Decisao`: estado, regra (app × pessoa), premissas, alternativas. |
| `src/lib/decisoes/cenarios.ts` | Traduz `analise.cairo.aprendizado.entradas` em cenários do planejador. Não prevê nada. |
| `src/lib/decisoes/parcelaNova.ts` | Avaliação de parcela nova pelo calendário de caixa. |
| `src/lib/decisoes/observado.ts` | `Observado` do Cairo (`revelar`) → entrada do planejador. É o que deixa o planejador rodar nos mundos do Cairo sem ver o futuro. |
| `src/lib/planejador.ts` | `simularPagamentos` (núcleo), `planejar` (dicas), `faltaMinimaDe`, `aplicarCenario`. Campos novos são opcionais: quem não os passa tem o comportamento anterior. |
| `src/components/DecisaoExplicada.tsx` | O bloco do "por quê". |

**Por que em `src/lib/decisoes` e não em `src/cairo/decisao`** (como a coordenação sugeria): esta etapa precisava mudar o que
já está na tela (o planejador e a análise de hoje) e escreve explicações com `tx`, o que o núcleo puro não permite. As contas
puras (`custos.ts`, `taxaImplicita.ts`) não dependem de React nem de banco e podem ir para `src/cairo/custo/` numa próxima
etapa, devolvendo `Motivo` em vez de frase. Fica registrado em `coordenacao.md`.

## 3. O que consome da parte de dados

- `analise.cairo.condicoes`: `contratual`, `fluxo_do_contrato`, `antecipacao`, `oferta_quitacao`. A condição `atraso` não é
  lida aqui de propósito (o custo do atraso continua no planejador, pela regra da dívida, como antes).
- `analise.cairo.aprendizado.entradas` (atraso e falta por fonte de renda) → "e se".
- `revelar`, `trocarFuturo`, `cenarios.gerar` e as personas → testes de integração.
- O Cairo passou a ser lido logo depois da agenda (mesmos argumentos), porque o planejador e a quitação usam o que ele lê.

## 4. Como foi validado

- `node scripts/decisoes/testar.mjs` (21 casos, números feitos à mão): juros do contrato × atraso, quitação (desconto só no
  que não venceu, estados, oferta velha, antecipação desconhecida), TIR por datas, condições do Cairo, cenários só do
  aprendizado, análise inteira com dívida atrasada (antes, o desconto saía pelo juro do atraso), planejador (essencial,
  prioridade da pessoa, reserva do dia a dia, pós-horizonte, falta mínima, "e se"), parcela nova, não-antecipação.
- `node scripts/cairo/integracao/testar.mjs` (4 casos, sobre as personas do Claude 1): condições → quitação, "e se" só para a
  persona cuja renda atrasa, **não-antecipação com `trocarFuturo`** (36 pares de mundos, cortes em 3, 10 e 20 dias), e em
  nenhum dos 40 mundos executados o plano manda pagar sem dinheiro.
- `node scripts/decisoes/testar.mjs avaliar`: 500 mundos sintéticos (semente 11), executados dia a dia vendo só o que se sabe
  em cada dia. Política antiga (ordem pelo custo do atraso) × nova:

| Medida (soma dos 500 mundos) | Antiga | Só a ordem do essencial | Nova (ordem + reserva do dia a dia) |
|---|---|---|---|
| Dias com conta essencial atrasada | 5.593 | 947 | **487** |
| Contas essenciais que ficaram sem pagar | 170 | 27 | **7** |
| Dias sem dinheiro para o essencial do dia | 3.638 | 3.295 | **1.509** |
| Contas atrasadas (qualquer) | 628 | 600 | 656 |
| Contas sem pagar até o fim | 296 | 280 | 312 |
| Multa e juros | R$ 27,1 mil | R$ 33,4 mil | R$ 47,0 mil |
| Dias de cautela (conta atrasada com dinheiro para ela) | 1.125 | 851 | 1.831 |
| Alarme falso | 1 | 1 | 0 |
| Risco não avisado | 76 | 76 | 39 |
| "E se" que não aconteceu / que aconteceu | – | – | 51 / 33 |

**Leitura honesta:** a proteção do essencial funciona (dias de essencial atrasado −91%, essenciais sem pagar 170 → 7), e o
preço é dinheiro: a reserva do dia a dia empurra faturas para o rotativo, e multa e juros sobem 74%. Só a ordem do essencial
já ganha nos dois lados da gravidade com custo menor (+24%). A versão publicada é a "nova" porque proteger o essencial é o
pedido; o custo aparece para a pessoa (a dica diz quanto custaria não esperar) e ela pode inverter no Planejar o mês.
Em 1 dos 500 mundos a nova protegeu menos o essencial que a antiga. São mundos inventados: mostram que a política faz o
que promete nas regras deles, não que o mundo real é assim, e uma melhora observada depois de uma recomendação não prova
que a recomendação causou a melhora.

## 5. Limites conhecidos

- **Essencial é inferido** pelo nome da categoria (a mesma regra do 50/30/20). Pedido ao Claude 1 em `coordenacao.md`.
- **Prioridade da pessoa** existe no planejador (`prioridadePessoa`), mas ainda não há onde a pessoa a declarar fora do
  plano manual do Planejar o mês (que já é respeitado). Pedido registrado.
- **`juros_mes` vazio** é ambíguo no banco ("sem juros" e "não sei" gravam igual): tratado como desconhecido. Pedido registrado.
- **Regra de antecipação** sempre desconhecida: o desconto pelo contrato é o que dá para pedir, nunca garantido.
- **Taxa dos fluxos sem a data do recebimento**: convenção de 1 mês antes da 1ª parcela, dita na premissa.
- O "e se" e a parcela nova olham só até o fim do mês que vem (o horizonte dos cenários).
- **Registro das decisões** para avaliar depois (qual foi a sugestão, com que dados, o que aconteceu): depende da migração 49
  do Claude 1. Até lá, a memória do consultor (`lib/memoria.ts`) segue conferindo os passos como antes, sem afirmar causa.
