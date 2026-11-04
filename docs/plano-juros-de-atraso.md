# Plano: juros de atraso automáticos nas dívidas (OpusCash)

Documento de passagem de trabalho. Quem for executar: leia tudo antes de começar, siga o `CLAUDE.md` do repositório (fluxo
de publicação, traduções, linguagem) e responda ao Edigar em português, no tom do "Seu Adenor" (as preferências dele já
estão na conta).

---

## 1. O que o Edigar pediu

> "Queria que o próprio sistema do OpusCash conseguisse acompanhar e atualizasse, aumentasse a dívida igual como aumentou
> no banco. Por isso que eu lhe dei as informações dos juros."

Hoje o app **não** aumenta dívida nenhuma sozinho. Os juros (`dividas.juros_mes`) só servem para conselho e prioridade
(qual dívida pagar primeiro, custo do atraso no planejador). O valor fica parado no último saldo registrado. O objetivo
é que cada dívida atrasada **cresça dia a dia pela regra do credor**. O valor estimado deve ficar visível, entrar nos
totais e poder ser corrigido com o valor real do banco a qualquer momento.

---

## 2. Onde as coisas estão (estado em 04/11/2026)

### Repositório e publicação
- Repo `edigarbarros/cigarros-finance`. **Branch de produção: `claude/practical-mccarthy-qt2qoa`** (não é o `main`).
- Último commit publicado: `391537e` (PR #82, "Dívidas: partes (mini-dívidas)…"). Confira em
  `https://www.opuscash.com.br/versao.json`.
- Fluxo (do `CLAUDE.md`):
  1. Branch novo a partir da produção.
  2. `npx tsc -b`, `npm run lint` e `npm run build`.
  3. Teste no app de demonstração.
  4. PR para `claude/practical-mccarthy-qt2qoa`, merge **squash**.
  5. Acompanhe o deploy na Vercel (projeto `cigarros-finance`) até `READY` e confira o `versao.json`.
  6. Antes do merge, traga para o seu branch o que tiver chegado na produção.

### Banco (Supabase)
- Projeto: `jyadqrepdueiiyskexmq`.
- Usuário do Edigar: `3227d8c7-4de6-4d78-9d6c-f8d776aca0ed` (e-mail edigarbarros14@gmail.com).
- Já existe e já está aplicada a **migração 21** (`supabase/migracao-21-partes-da-divida.sql`), com a tabela
  `divida_partes`: uma linha por parcela de cada parte, com `nome`, `valor`, `vencimento`, `parcela` e `parcelas`.
- Tabelas de dívida:
  - `dividas`: `descricao`, `pessoa`, `sentido`, `valor_parcela`, `total_parcelas`, `inicio`, `juros_mes`, `moeda`, `obs`.
  - `divida_saldos`: marcos "em tal data o saldo era X".
  - `lancamentos.divida_id`: pagamentos e aumentos.
- **Cuidado ao gravar pelo MCP do Supabase:** comandos com `DELETE` disparam um pedido de aprovação para o Edigar que
  costuma expirar (60 s) sem resposta. Prefira `UPDATE`/`INSERT`; se precisar apagar, avise antes e peça para ele ficar
  com o app aberto. Sempre filtre por `user_id`.
- A regra do `CLAUDE.md`: mudança de banco não se aplica sozinha; diga quais migrações rodar. O Edigar autorizou
  aplicar a migração 21 pelo MCP; para a 22, aplique do mesmo jeito (`apply_migration`) e diga que aplicou.

### Código que importa
| Arquivo | O que tem |
|---|---|
| `src/lib/dividas.ts` | `situacaoDividas()` (restante, saldoInicial, ajustes por mês), `saldoEm()`, `calendarioDe()` (calendário fixo) e `calendarioDasPartes()` (calendário a partir das partes), `fecharCalendario()`, `gruposDasPartes()`, `gerarParcelasDaParte()`, `projecaoMensal()`, `jurosAoAno()`. |
| `src/lib/useDados.ts` | Carrega dívidas, saldos, pagamentos e partes; `addSaldo`, `ajustarValorDivida`, `addPartes`/`updParte`/`delPartes` (estas já acertam o saldo pela soma das partes em `acertarSaldoDasPartes`), `dividasComPartes`. |
| `src/lib/types.ts` | `Divida` (com `partes?`), `ParteDivida`, `SaldoDivida`, `Pagamento`. |
| `src/pages/Dividas.tsx` | Cartões, `Ficha` (detalhe), `CartaoDivida`, KPIs da página. |
| `src/components/PartesDaDivida.tsx` | Seção "Do que é feita" da ficha (lista, corrige, apaga e adiciona partes). |
| `src/components/Formularios.tsx` | `FormDivida` (campo "Juros por mês" já existe, ~linha 990). |
| `src/components/Painel.tsx` | Monta `situacao` e `aReceber`, `r.divida`, `pagarDivida` (sugere valor). |
| `src/lib/analise.ts`, `src/lib/conselheiro.ts`, `src/lib/planejador.ts` | Consultor e planejador: usam `restante`, `calendarioDe` e `juros_mes`. |
| `docs/arquitetura-do-painel.md` §4.13 | Documentação da página Dívidas (atualizar no fim). |
| `scripts/app-de-demonstracao/` | `servidor-falso.cjs` (Supabase em memória; `semColunas` simula migração faltando) e `dados-de-demonstracao.cjs`. |

Como o pagamento abate hoje:
- `calendarioDe`/`calendarioDasPartes` calculam `pago = total − restante` e cobrem as parcelas da mais antiga para a
  mais nova.
- **Não misture os juros estimados no `restante` registrado**: isso quebraria essa cobertura. Ver a seção 4.

---

## 3. Como cada credor faz a dívida crescer (medido nos prints do Edigar)

Os valores de referência foram conferidos com os bancos em **04/11/2026**.

| Dívida (id) | Regra observada | Como medi |
|---|---|---|
| **Mercado Pago** `0a81ea4f-2436-4fbf-ac04-b18e9428535e` | **Juros simples sobre o valor original da parcela + multa de 2%**: ≈ 0,58% a 0,62% **ao dia** (≈ 17,5% a.m. linear). Não há juros sobre juros. Contrato: 18,25% a.m. (Cabo: 20%). | Microfone, parcela de 30,75: venceu 02/03 → 78,50; venceu 29/06 → 54,21. (78,50/30,75 − 1,02)/247 dias = 0,62%/dia; (54,21/30,75 − 1,02)/128 = 0,58%/dia. Mouse pad 17,43 (30/03) → 39,90 dá 0,58%/dia. |
| **InfinitePay** `2a4a0ff2-3e26-4db6-a040-893e3d9ad20f` | Multa de 2% + ≈ 0,44%/dia simples (≈ 13% a.m.). | Pix de 114,59 vencido em 13/10 → 128,08 em 04/11 (22 dias). O Pix de 112,22 (venceu 09/10) aparece sem acréscimo no app do banco. **Confirmar com o Edigar** se ele cresce ou não. |
| **Empréstimo PicPay** `686e03e4-ab27-4233-b4b4-2c75392e68d5` | Multa de 2% + ≈ 0,147%/dia simples (≈ 4,4% a.m.: contrato 3,3% + mora). | 1ª parcela 44,50 (venceu 09/10) → 47,12 em 26 dias. |
| **Nubank** `723b5b56-1e0c-453b-a7e4-9512f7b8b6ac` | Cresce sobre o **saldo inteiro**, pouco: ≈ 0,25% a.m. (+1,89 em set, +1,67 em out sobre ~717). Multa já aplicada. | Faturas: 715,14 → 717,03 → 718,70 (vencida 26/10). |
| **Acordo Vivo** `80037b88-41cd-4b8e-969b-58a8de822fa9` | **Sem juros.** Se uma parcela atrasar, o acordo é cancelado e a dívida volta inteira. Só precisa de alerta, não de juros. | Termo do acordo de 16/10/2026. |
| **Atlética Yawara** `f18cfa79-9621-46e4-b97f-b3b2494d016f` | Sem juros (dinheiro da Atlética usado por ele). | — |

Valor original de cada parcela do Mercado Pago (contratos):

| Compra | Parcela original |
|---|---|
| Mouse sem fio | 20,40 |
| Microfone | 30,75 |
| Cabo do controle | 4,76 |
| Vivo Móvel | 12,19 |
| Mouse pad | 17,43 |

A parcela **4/5 do Mouse (7,51 em 04/11)** foi paga em parte. Estime o original que resta como
`7,51 / (1,02 + 0,006 × 247) ≈ 3,0`.

Conferência: com essa regra, o Mercado Pago cresce **≈ R$ 50 por mês**. Base: soma dos originais em aberto ≈ R$ 293,
vezes 0,58%/dia, vezes 30 dias.

---

## 4. Desenho da solução

### 4.1 Migração 22 (`supabase/migracao-22-juros-de-atraso.sql`)
Tudo `add column if not exists`, rodável de novo, com `notify pgrst, 'reload schema'` no fim e o mesmo cuidado das
migrações anteriores. Sem a migração, o app funciona como antes: detecte a coluna faltando como em `dividasSemJuros`.

Em `dividas`:
- `atraso_juros_mes numeric`: % ao mês cobrado **no atraso**. É diferente de `juros_mes`, que é o do contrato. Null =
  não cresce.
- `atraso_tipo text check (atraso_tipo in ('simples','composto'))`, padrão `'simples'`.
- `atraso_multa numeric`: % aplicado uma vez quando a parcela vence. Padrão 2.
- `atraso_base text check (atraso_base in ('parcela','saldo'))`. `parcela` = cada parcela atrasada cresce (Mercado
  Pago, PicPay, InfinitePay); `saldo` = o saldo inteiro cresce (Nubank).
- `conferido_em date`: dia em que os valores foram conferidos com o banco. Os juros contam **a partir daqui** (ou do
  vencimento, se for depois).

Em `divida_partes`:
- `valor_original numeric`: valor da parcela no contrato, que é a base dos juros simples. Null = usar `valor`.

### 4.2 Motor (função pura, sem React, data injetada)
Arquivo novo `src/lib/jurosAtraso.ts`, exportando
`jurosDoAtraso(s: SituacaoDivida, cal: Calendario | null, hoje: string)`, que devolve:

```ts
{
  total: number                 // acréscimo estimado até hoje
  porParcela: Map<number, number> // por ParcelaDivida.n
  porParte: Map<string, number>   // por ParteDivida.id
  desde: string | null            // conferido_em
  diario: number                  // quanto cresce por dia hoje
}
```

Regras:
- Só parcela **atrasada e com algo faltando** cresce (use `falta` do calendário). O pagamento já cobre da mais antiga
  para a mais nova.
- Início da contagem de cada parcela: `max(conferido_em, vencimento + 1 dia)`. Sem `conferido_em`, use o vencimento.
- **Multa**: entra uma vez para a parcela que venceu **depois** de `conferido_em`. As que já venciam no dia da
  conferência já trazem a multa no valor.
- **Simples**: `base × (taxa/100/30) × dias`, com `base = valor_original ?? valor`, proporcional ao que falta da parcela.
- **Composto**: `falta × ((1 + taxa/100)^(dias/30) − 1)`.
- **Base 'saldo'** (Nubank): aplicar sobre `restante` desde `conferido_em`.
- Moeda: a dívida já vem na moeda principal dentro de `SituacaoDivida`. Mantenha.
- Arredonde em centavos só no fim de cada parcela.

### 4.3 Onde usar
- Em `situacaoDividas` (ou num helper ao lado), **não** altere `restante`. Acrescente dois campos:
  - `jurosAtraso`: acréscimo estimado.
  - `restanteHoje = restante + jurosAtraso`.
  
  Calcule só quando o mês olhado contém hoje. Meses passados ficam como estão.
- Calendário da ficha: cada parcela atrasada mostra `falta + juros` com "(com juros)".
- `PartesDaDivida`: cada parcela atrasada mostra o valor estimado de hoje e o registrado riscado ou menor.
- Cartão e ficha: "Falta pagar **hoje**: R$ X", com o selo "com juros, estimado" e a linha "cresce ~R$ Y por dia".
  Use `tx()` em tudo, com frases inteiras.
- KPIs da página Dívidas, `r.divida` no Painel, Início, "Para fazer", Consultor (`analise.ts`, `conselheiro.ts`) e
  planejador: usem `restanteHoje` onde hoje usam `restante` para "quanto deve agora". Para o **custo do atraso**,
  prefiram `atraso_juros_mes` quando houver e caiam para `juros_mes`.
- Botão "Pagar": sugerir o atrasado **com juros**.

### 4.4 Corrigir com o valor real ("Conferi com o banco")
Botão na ficha (e no cartão quando há juros estimados). Pede "Quanto o banco mostra hoje?", já preenchido com o
estimado. Ao salvar:
- **Dívida com partes:**
  1. Distribua a diferença (real − registrado) entre as partes atrasadas, proporcional ao estimado de cada uma, e
     grave com `updParte` (o saldo acompanha sozinho por `acertarSaldoDasPartes`).
  2. Ao gravar, guarde o valor anterior (sem juros) em `valor_original` se ele estiver vazio.
  3. `updDivida(id, { conferido_em: hoje })`.
- **Dívida sem partes:** `addSaldo(id, hoje, valorReal)` (vira um "ajuste de saldo", que já aparece na ficha) e
  `conferido_em = hoje`.
- **Ao lançar pagamento** numa dívida com juros estimados, faça o mesmo antes de gravar o pagamento: cristalize os juros
  até a data do pagamento. Senão o pagamento abate só o valor sem juros.

### 4.5 Formulário (`FormDivida`)
Seção "Se atrasar", só para "Eu devo", recolhida por padrão:
- **Juros do atraso (% ao mês)**, com ajuda leiga: "quanto a dívida cresce por mês enquanto está atrasada".
- **Multa (%)**, padrão 2.
- **Como cresce**: "sobre a parcela (simples)" × "juros sobre juros (composto)", com uma frase de exemplo cada. Prefira
  rótulos leigos a "simples/composto" (ver o guia de linguagem em `docs/arquitetura-do-painel.md`).
- **Cresce sobre**: "cada parcela atrasada" × "o saldo inteiro".
- **Valores conferidos em** (data).

### 4.6 Traduções, docs e demonstração
- Todo texto novo passa por `tx('…')`, com `en` e `es` em `src/i18n/traducoes.json`.
- Depois rode `node scripts/traducao/extrair.cjs <arquivos>` e `--faltando`, que precisa dar 0.
- Atualize `docs/arquitetura-do-painel.md` §4.13 e o `README.md` (migração 22 na lista; a 20 continua por último).
- Adicione as colunas novas aos dados de demonstração se quiser exibir o recurso. Para simular a migração faltando, use
  `semColunas: { dividas: ['atraso_juros_mes'] }`.

---

## 5. Depois de publicar: configurar as dívidas do Edigar

Rodar só depois da migração 22, com `UPDATE` filtrando por `user_id`. `conferido_em` = **2026-11-04**, exceto onde
indicado.

| Dívida | Configuração |
|---|---|
| Mercado Pago | `atraso_juros_mes=17.5`, `atraso_tipo='simples'`, `atraso_multa=2`, `atraso_base='parcela'`. Em `divida_partes`, `valor_original` de cada parte pela tabela da seção 3. Na parte "Mouse sem fio Bluetooth" 4/5, use 3,0. |
| InfinitePay | `atraso_juros_mes=13`, `'simples'`, multa 2, `'parcela'`. `valor_original`: 114,59 na parte de 13/10 e 112,22 na de 09/10 (confirmar com ele se esta cresce). |
| Empréstimo PicPay | `atraso_juros_mes=4.4`, `'simples'`, multa 2, `'parcela'`. `valor_original` da parcela 1 = 44,50; das outras, 44,51. |
| Nubank | `atraso_juros_mes=0.25`, `'composto'`, multa 0, `'saldo'`, `conferido_em='2026-10-26'`. |
| Acordo Vivo, Atlética | Não configurar juros (ficam null). |

Depois de configurar, abra o app (ou rode o motor com os dados dele) e confira:
- Em 04/11, cada dívida tem que dar **o mesmo valor do banco**, porque `conferido_em` é hoje e não há acréscimo.
- Simulando hoje = 04/12/2026: Mercado Pago ≈ 630 + ~50; PicPay: a parcela 1 cresce e as parcelas 2 (09/11) e 3 (09/12)
  ganham multa e juros se não forem pagas; Nubank ≈ +1,80.

---

## 6. Testes antes de publicar

1. **Motor isolado**. Empacote um `.ts` de teste com `npx rolldown arquivo.ts -d saida -f esm --platform node` e rode
   com um stub de `document`/`localStorage` (o módulo de idioma lê `document.cookie`):
   ```js
   globalThis.document = { cookie: '', documentElement: { lang: 'pt-BR' } }
   globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
   await import('./saida/teste.js')
   ```
   Casos mínimos:
   - Microfone 30,75, venceu 02/03, conferido 02/03 com 30,75 → em 04/11 (simples, 17,5% + 2%) ≈ 77–79.
   - Parcela em dia não cresce.
   - Parcela paga pela metade cresce só sobre o que falta.
   - Composto vs simples.
   - Base 'saldo'.
   - Sem `conferido_em`.
   - "Conferi com o banco" zera a diferença.
   - Pagamento depois de juros: cristaliza e abate.
2. **App de demonstração**:
   - Build com `VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npm run build`.
   - Suba `scripts/app-de-demonstracao/servidor-falso.cjs` com Playwright. Já existem exemplos de uso nos scripts
     dessa pasta: `iniciar({ perfil, dados, porta })` devolve `{ page, db, msgs, url, fechar }`.
   - Teste em 1280px e em 390px:
     - dívida atrasada mostrando "falta pagar hoje";
     - "Conferi com o banco";
     - pagar com juros;
     - formulário "Se atrasar";
     - sem a migração (o app abre, o campo some).
   - Zero erros no console.
3. `npx tsc -b`, `npm run lint` (só os avisos que já existem) e `npm run build`.

---

## 7. Pendências que o Edigar ainda não respondeu (não bloqueiam este trabalho)
- InfinitePay: o Pix de 112,22 (09/10) cresce com o atraso? A taxa de 13% é estimada.
- Dívidas "Laize" (R$ 26) e "Facio" (R$ 147,90): sem data nem detalhe. Rebeca Laize aparece nos extratos; pode ser que
  "Laize" não seja dívida.
- Duas faturas do PicPay ficaram sem as compras no cartão: a de julho (59,57, só o pagamento pelo Itaú). Na de
  setembro, a origem dos 110,99 pagos não foi identificada.

---

## 8. Como responder ao Edigar no fim
Em português, direto, com números. Diga:
- o que foi feito e publicado (com o commit do `versao.json`);
- quais migrações foram aplicadas;
- quanto cada dívida dele cresce por dia e por mês agora;
- como usar o "Conferi com o banco";
- que é uma **estimativa** (diferença de ~1 a 3% em relação ao banco) e que conferir de vez em quando zera o erro.
