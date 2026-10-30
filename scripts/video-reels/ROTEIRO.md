# Reels do OpusCash: roteiro de locução

Vídeo vertical 1080×1920, 30 fps, **53 segundos**. As telas são capturas do app de verdade (conta de demonstração da
Marina, tema escuro, celular), animadas em 3D no estilo da página inicial: a tela gira, os blocos se soltam em camadas e
a câmera aproxima de cada ferramenta.

**Tom:** voz animada, mas próxima, como quem mostra um app para um amigo. Ritmo ágil, sem correr. Cada fala cabe na
janela dela com folga: se sobrar tempo, respire. Não estique a frase.

**Trilha:** batida eletrônica leve ou lo-fi animado, entre 100 e 120 BPM, baixinha embaixo da voz. As trocas de tela
caem nos tempos da tabela: dá para alinhar com o compasso.

| Tempo | Tela | Fala (locução) | Texto que aparece |
|---|---|---|---|
| 0:00 – 0:03,6 | Abertura (texto grande) | **Você sabe pra onde foi o seu dinheiro esse mês?** | Pra onde foi o seu dinheiro esse mês? |
| 0:03,6 – 0:08,6 | Início | **No OpusCash, você abre e já vê: quanto entrou, quanto saiu e quanto sobrou.** | Tudo num relance |
| 0:08,6 – 0:13,0 | Lançamentos | **Cada gasto fica no lugar certo, separado por categoria.** | Cada gasto no lugar |
| 0:13,0 – 0:17,6 | Contas do mês | **As contas do mês ficam em ordem. Pagou? Um toque e pronto.** | Nada de conta esquecida |
| 0:17,6 – 0:22,4 | Cartões | **Nos cartões, você vê a fatura, o limite livre e cada parcela.** | Fatura e limite na mão |
| 0:22,4 – 0:27,6 | Dívidas | **Nas dívidas, quanto falta pagar e quando você fica livre.** | Quanto falta pagar |
| 0:27,6 – 0:32,0 | Metas | **Suas metas enchem como um pote, conforme você guarda.** | Potes que enchem |
| 0:32,0 – 0:36,0 | Dinheiro guardado | **E o dinheiro guardado, banco por banco.** | Tudo o que você tem |
| 0:36,0 – 0:39,6 | Resumo do ano (gráfico desenhando) | **No resumo do ano, você vê mês a mês o que entrou e o que saiu.** | O ano inteiro |
| 0:39,6 – 0:42,2 | Resumo do ano (linha da dívida acende) | **E acompanha a linha da dívida caindo, até zerar.** | A linha da dívida |
| 0:42,2 – 0:45,0 | Resumo do ano (quanto sobrou) | **Sem falar no quanto sobrou em cada mês.** | Quanto sobrou |
| 0:45,0 – 0:48,6 | As 8 telas girando em carrossel | **Tudo isso num lugar só.** | Tudo num lugar só |
| 0:48,6 – 0:53,0 | Logo + chamada | **OpusCash. Teste grátis por 7 dias em opuscash ponto com ponto br.** | Teste grátis por 7 dias · opuscash.com.br |

Texto corrido, para gravar de uma vez (cerca de 125 palavras):

> Você sabe pra onde foi o seu dinheiro esse mês?
> No OpusCash, você abre e já vê: quanto entrou, quanto saiu e quanto sobrou.
> Cada gasto fica no lugar certo, separado por categoria.
> As contas do mês ficam em ordem. Pagou? Um toque e pronto.
> Nos cartões, você vê a fatura, o limite livre e cada parcela.
> Nas dívidas, quanto falta pagar e quando você fica livre.
> Suas metas enchem como um pote, conforme você guarda.
> E o dinheiro guardado, banco por banco.
> No resumo do ano, você vê mês a mês o que entrou e o que saiu.
> E acompanha a linha da dívida caindo, até zerar.
> Sem falar no quanto sobrou em cada mês.
> Tudo isso num lugar só.
> OpusCash. Teste grátis por 7 dias em opuscash ponto com ponto br.

## Legenda sugerida para o post

> Você sabe pra onde foi o seu dinheiro esse mês? 👀
> Contas, cartões, dívidas, metas e o resumo do ano inteiro, num lugar só.
> Teste grátis por 7 dias: opuscash.com.br
>
> #financaspessoais #organizacaofinanceira #controlefinanceiro #dinheiro #educacaofinanceira

## Áreas seguras do Reels

Os textos ficam entre 196 e 420 px do topo, longe da barra de cima do Instagram. Embaixo, a parte que o Instagram
cobre (nome, legenda, botões) só pega o rodapé do celular animado, nunca um texto.

## Como refazer o vídeo

Precisa do build de demonstração (veja `scripts/app-de-demonstracao/README.md`) e do `ffmpeg`.

```bash
VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build
node scripts/video-reels/capturar.cjs    # fotografa as 8 telas em cap/
node scripts/video-reels/preparar.cjs    # marca, linha da dívida e dados.js
node scripts/video-reels/render.cjs previa 5,20,40   # quadros soltos em previa/, para conferir
node scripts/video-reels/render.cjs video 30         # todos os quadros em quadros/
ffmpeg -framerate 30 -i scripts/video-reels/quadros/q%05d.jpg -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart opuscash-reels.mp4
```

O roteiro da animação (tempo de cada cena, câmera, quais blocos sobem) fica em `CENAS` no `reels.html`. Se mudar um
tempo lá, mude aqui também.
