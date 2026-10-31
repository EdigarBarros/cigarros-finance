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

`toque: true` abre como celular com tela de toque (para testar `page.touchscreen.tap`).

O `npm run build` acima é só para os testes; o site de verdade usa as variáveis do Supabase reais na Vercel.
