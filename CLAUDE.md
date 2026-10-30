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

- Telas já traduzidas: página inicial (`pages/Apresentacao.tsx`), login e nova senha (`components/Entrada.tsx`), assinatura
  (`components/Assinatura.tsx`, `components/VitrinePlanos.tsx`). O painel e as páginas legais ainda usam o Google.
- Nessas telas, todo texto novo passa por `tx('texto em português')` e ganha as versões `en` e `es` em
  `src/i18n/traducoes.json`. Para tirar os textos de uma tela inteira: `node scripts/traducao/extrair.cjs <arquivo>`
  (confira a lista que ele imprime). `node scripts/traducao/extrair.cjs --faltando` mostra o que está sem tradução.
- Para passar uma tela do Google para a tradução nossa: rode o script nela, traduza o que ele listar e marque a tela como
  traduzida (em `App.tsx`, `comIdioma`; no painel, `translate="no"` na raiz quando `nativo`).
