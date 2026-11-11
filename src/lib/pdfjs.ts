/**
 * Leitor de PDF (pdf.js), que vem junto do app em arquivos à parte, baixados só quando alguém importa um PDF (antes vinha
 * de outro site, e sem ele nenhum PDF abria). É a versão "legacy": funciona nos celulares e navegadores mais antigos, onde
 * a versão comum falha ao abrir qualquer PDF. A parte pesada roda fora da tela (worker), para o app não travar.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import Trabalhador from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'

try {
  pdfjs.GlobalWorkerOptions.workerPort = new Trabalhador()
} catch { /* sem worker (navegador muito antigo ou bloqueado): o pdf.js lê na própria tela, mais devagar */ }

export { pdfjs }
