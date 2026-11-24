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

`ordemEstrita: true` recusa `order` por coluna que a tabela não tem (erro 42703, como o Supabase): pegou o backup que ordenava `meses` por `id`.

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

## Planejamento do mês

Depois do build com Supabase fictício: `node scripts/app-de-demonstracao/testar-planejamento.cjs` (o cartão no Consultor
abre a mesa; arrastar uma conta para dentro de uma entrada, puxar a borda da fatia, o ajuste, "Montar pra mim", o
Consultor à esquerda na tela larga, Salvar plano, Descartar, a pergunta ao fechar sem salvar, o plano salvo depois de
recarregar, Esc e X; no celular, tocar na conta e depois na entrada, a bandeja presa embaixo e sem
rolagem de lado; nos temas escuro e claro, sem erro na página). Com `FOTOS=pasta`, salva capturas.

## Várias contas no mesmo aparelho

Depois do build com Supabase fictício: `node scripts/app-de-demonstracao/testar-contas.cjs` (limpeza de sessões antigas, troca com
senha, isolamento entre abas, recuperação, saída e perfis no PC e no celular).

## Celular (moldura e Início)

Depois do build com Supabase fictício:

```bash
node scripts/app-de-demonstracao/testar-movel.cjs
```

Com a data presa em 16/11/2026, nos três jeitos, em 320, 360, 390 e 430 px e nos temas escuro e claro: sem rolagem de
lado, nada fora da tela, toques do topo, das ações e das abas com 44 px e o fim da tela acima da barra de baixo; a fonte
a 150% e 200%; o topo que desliza (ponto e cor), a conta que abre a conferência, as folhas "Mais", da conta e dos meses,
a busca do topo, os alvos do tutorial e o computador sem nada do celular. (Os antigos `testar-inicio-simples.cjs` e
`testar-inicio-detalhado.cjs` saíram: conferiam a Início dos três jeitos no celular, que deu lugar a esta.)

## Arrasto do topo colorido no celular

```bash
node scripts/app-de-demonstracao/testar-arrasto.cjs
```

Com o processador 4× mais lento, arrasta o topo de cada tela do celular com um dedo simulado: com o dedo na tela, nada além
dos pontos pode mudar (nem a lista de baixo, nem a posição da página); ao soltar, a página troca e encaixa.

## Parcela adiantada (entrada ou conta fixa)

Depois do build com Supabase fictício: `node scripts/app-de-demonstracao/testar-adiantada.cjs` (a mesma entrada fixa lançada
duas vezes em novembro vira a de dezembro, "recebido adiantado"; Desfazer reabre dezembro).

## Cartões redimensionáveis da Início do computador

Depois do build com Supabase fictício: `node scripts/app-de-demonstracao/testar-grade-pc.cjs` (com `FOTOS=pasta` salva
capturas). Faixa do topo verde com o selo do estado, nada sobreposto, puxar o canto (o cartão segue o mouse, a lista ganha
linhas, sem tarefa longa), arrastar troca a ordem, teclado na alça, tamanhos guardados depois de recarregar e a 1000 px.

## Cartões no computador (carteira 3D)

Depois do build com Supabase fictício: `node scripts/app-de-demonstracao/testar-carteira-pc.cjs` (os cartões aparecendo pela
fenda, o cartão saindo com animação, as cinco abas e as setas, trocar de cartão mantendo a aba, Esc e "Guardar na carteira",
a faixa de atraso, a aba lembrada, 1000 px sem rolagem de lado, o jeito simples com 2 abas e Animações: Reduzidas sem voo).
Com `FOTOS=pasta`, salva capturas.
