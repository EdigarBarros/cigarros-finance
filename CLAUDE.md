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
