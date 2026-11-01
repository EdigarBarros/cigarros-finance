import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Número desta publicação: o commit na Vercel ou a hora do build. Vai embutido no app (__VERSAO__) e num arquivo à parte
 * (/versao.json); o app compara os dois para saber que saiu versão nova e se atualizar sozinho (veja src/lib/atualizacao.ts).
 */
const VERSAO = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12) || String(Date.now())

const arquivoDeVersao = (): Plugin => ({
  name: 'versao-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao: VERSAO }) })
  },
})

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), arquivoDeVersao()],
  build: {
    rolldownOptions: {
      output: {
        // Bibliotecas em arquivos próprios: só mudam quando a versão muda, então ficam no cache do navegador entre uma
        // publicação e outra (só o código do app é baixado de novo). O Chart.js só vem junto das telas que têm gráfico.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            { name: 'graficos', test: /node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  define: { __VERSAO__: JSON.stringify(command === 'build' ? VERSAO : 'dev') },
}))
