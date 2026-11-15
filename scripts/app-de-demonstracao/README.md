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
