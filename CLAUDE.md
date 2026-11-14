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

O app Android (`android/`, Capacitor) leva o código do site dentro dele e **não** recebe o que vai para o site. Mudou tela,
texto ou banco de um jeito que o app precise? Gere a versão nova do app (README → App Android), aumentando o `versionCode`,
entregue o `.aab` assinado ao dono e diga que ele precisa enviar à loja.

Antes do merge, confira se o branch de produção andou (outra sessão pode ter publicado) e traga as mudanças para o seu
branch. Mudanças no banco (arquivos em `supabase/`) não se aplicam sozinhas: avise quais migrações rodar no Supabase.

## Novidades (pop-up depois de uma atualização)

O pop-up "Novidade" é publicado pelo dono no painel de suporte (tela Novidades); não é parte do seu trabalho. Se a mudança
for algo novo que a pessoa vê, no fim só ofereça um rascunho pronto (não publique): um `insert` em `public.novidades` com
`titulo`, até 4 `itens` (ícone do `components/Icone.tsx` + até 40 letras, em `pt`, `en` e `es`), `icone`, `cor` e `tela`,
sem `publicada_em`. Ele revisa e publica pelo painel.

## Onde está cada coisa

- `README.md`: o que o app faz e como colocar no ar.
- `docs/arquitetura-do-painel.md`: a lógica de cada tela e o guia de linguagem (textos sem jargão, botões com verbo).
- Início (seção 4.0.3 do mesmo documento): estado do mês, previsão explicada, comparação com o mês anterior e contas
  atrasadas/próximas saem de funções puras (`lib/situacaoDoMes.ts`, `lib/previsao.ts`, `lib/comparacao.ts`,
  `lib/paraFazer.ts`). Mexeu nelas? Rode `node scripts/painel/testar.mjs`.
- Invest (seção 4.22 do mesmo documento): o motor fica em `src/lib/invest/` (puro) e tem testes próprios. Mexeu em conta
  de carteira, rentabilidade, importação ou saldo? Rode `node scripts/invest/testar.mjs` e, se mexeu na migração,
  `scripts/invest/isolamento.sh`.

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
