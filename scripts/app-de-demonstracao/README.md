# App com dados de demonstração

Para ver e testar o app de verdade sem tocar no banco: um Supabase falso em memória (`servidor-falso.cjs`) serve o
`dist` e responde como o Supabase, com a conta inventada de `dados-de-demonstracao.cjs` (Marina, 10 meses de histórico).
Nada vem do banco de verdade.

```bash
VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build
npm i --no-save playwright && npx playwright install chromium
```

```js
const { iniciar } = require('./scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require('./scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4800, dpr: 2 })
await t.page.goto(`${t.url}#/cartoes`) // a página já entra logada como a Marina
await t.fechar()
```

`semColunas: { dividas: ['juros_mes'] }` simula uma migração que ainda não rodou (ler ou gravar a coluna dá o mesmo erro do Supabase).
Para os juros de atraso (migração 22): `semColunas: { dividas: ['atraso_juros_mes'] }`.

`assinatura: 'pix'` (ou outro status) muda a assinatura da conta; um objeto completo dá as datas: `assinatura: { status: 'pix', periodo_fim: '2026-12-01T00:00:00Z' }`.

`toque: true` abre como celular com tela de toque (para testar `page.touchscreen.tap`).

O `npm run build` acima é só para os testes; o site de verdade usa as variáveis do Supabase reais na Vercel.

## Regressões de metas e histórico de faturas

Depois do build com `fake.supabase.co` acima, rode:

```bash
node scripts/app-de-demonstracao/testar-correcoes.cjs
```

O teste cobre falhas de gravação e nova tentativa em metas, bloqueio de envio duplicado e carregamento de mais
de 1.000 faturas pagas, usando somente dados fictícios. Precisa do Playwright e de um Chromium disponível.
Para usar o Chromium do sistema em vez do navegador instalado pelo Playwright:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/app-de-demonstracao/testar-correcoes.cjs
```

## Início detalhada no celular

Depois do build com Supabase fictício:

```bash
node scripts/app-de-demonstracao/testar-inicio-detalhado.cjs
```

Verifica 320/360/390/430 px, fonte raiz a 150% e 200%, ausência de rolagem horizontal, consulta de conta
sem pagamento, Registrar, seleção mensal, séries de saldos, alternativa em lista, recolhimento persistido,
privacidade e estruturas independentes dos modos simples e equilibrado. Usa Chromium do sistema por padrão;
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pode substituí-lo. `OPUS_CAPTURAS` define a pasta das capturas
(padrão `/workspace/artifacts`). Dados e autenticação são fictícios. Ampliar a fonte raiz não substitui
uma validação manual de todas as configurações de acessibilidade de iOS/Android.

## Início do jeito simples no celular

Depois do mesmo build, rode:

```bash
node scripts/app-de-demonstracao/testar-inicio-simples.cjs
```

Com a data presa em 16/11/2026 (contas atrasadas e próximas), confere em 320, 360, 390 e 430 px que nada fica cortado,
fora da tela ou atrás da barra de baixo e que os toques têm 44 px; depois o topo enxuto, o "Mais", a previsão igual ao
"Ver cálculo", as barras dos gastos por categoria na escala do total, o "Marcar como paga" (grava valor, dia e banco) e a
troca de modo gravada no perfil.
