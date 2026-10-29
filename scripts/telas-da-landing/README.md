# Capturas da landing page

A landing page (`src/pages/Apresentacao.tsx`) mostra as **telas reais do app** flutuando em 3D. Elas são imagens em
`public/landing` (`<tema>-<tela>.webp` para computador e `<tema>-<tela>-m.webp` para celular), feitas com uma conta de
demonstração inventada (`dados-de-demonstracao.cjs`) e um Supabase falso em memória (`servidor-falso.cjs`). Nada vem do banco de verdade.

Quando o visual do app mudar, gere de novo:

```bash
VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build
npm i --no-save playwright && npx playwright install chromium
node scripts/telas-da-landing/capturar.cjs
python3 scripts/telas-da-landing/converter.py
```

O `npm run build` acima só serve para as capturas; o site de verdade usa as variáveis do Supabase reais na Vercel.
Para mudar quais telas aparecem, edite `PAGINAS` aqui e `CENAS` em `Apresentacao.tsx`.
