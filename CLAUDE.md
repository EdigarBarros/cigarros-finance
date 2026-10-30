# OpusCash: como trabalhar neste repositório

## Publicar (combinado com o dono do projeto)

Toda alteração pedida vai direto para o site, sem perguntar antes:

1. Desenvolva no branch da sessão, rode `npx tsc -b`, `npm run lint` e o build, e teste no app de demonstração
   (`scripts/app-de-demonstracao/`).
2. Commit e push no branch da sessão.
3. Abra o PR com base em **`claude/practical-mccarthy-qt2qoa`** (é o branch de produção da Vercel, não o `main`) e faça o
   merge (squash).
4. Acompanhe o deploy na Vercel (projeto `cigarros-finance`) até ficar `READY` e confira em
   `https://www.opuscash.com.br/versao.json` que o commit publicado é o novo.

Antes do merge, confira se o branch de produção andou (outra sessão pode ter publicado) e traga as mudanças para o seu
branch. Mudanças no banco (arquivos em `supabase/`) não se aplicam sozinhas: avise quais migrações rodar no Supabase.

## Onde está cada coisa

- `README.md`: o que o app faz e como colocar no ar.
- `docs/arquitetura-do-painel.md`: a lógica de cada tela e o guia de linguagem (textos sem jargão, botões com verbo).

## Idiomas

Inglês e espanhol têm tradução nossa; os outros idiomas vêm do tradutor do Google (`src/lib/idioma.ts`).

- O app inteiro tem tradução nossa (página inicial, login, assinatura e todo o painel), menos as páginas legais
  (`components/Legal.tsx`, `lib/legal.ts`), que ainda usam o Google.
- Todo texto de tela novo passa por `tx('texto em português')` e ganha as versões `en` e `es` em
  `src/i18n/traducoes.json`. Valores entram por posição: `tx('Faltam {0} dias', n)`. Escreva a frase inteira em cada
  caso (`n === 1 ? tx('1 conta') : tx('{0} contas', n)`), nunca juntando pedaços (`${n} ${'conta'}s atrasada`).
- Meses e datas: use `MESES_NOME`, `fmtDataCurta`, `fmtDataLonga`, `fmtMesAno` e `LOCAL_DAS_DATAS` de `lib/format.ts`
  (já saem no idioma). `MESES` fica em português maiúsculo de propósito: é como a planilha de importação escreve.
- Não passe por `tx` o que vira dado ou serve para reconhecer dado (nomes de bancos e categorias em `lib/rotulos.ts`,
  `lib/categorias.ts`, `lib/bancos.ts`, leitura de extrato e planilha). Linha com `// sem-tx` o script não toca. Para tirar os textos de uma tela inteira: `node scripts/traducao/extrair.cjs <arquivo>`
  (confira a lista que ele imprime). `node scripts/traducao/extrair.cjs --faltando` mostra o que está sem tradução.
- Para conferir antes de trocar: `--simular`. Para tirar da lista o que ninguém usa mais:
  `node scripts/traducao/extrair.cjs --limpar $(grep -rl "tx(" src --include=*.ts --include=*.tsx)`.
