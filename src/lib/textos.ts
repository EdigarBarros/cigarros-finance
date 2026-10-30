import traducoes from '../i18n/traducoes.json'
import { IDIOMAS_NATIVOS, idiomaAtual } from './idioma'

/**
 * Textos de tela em inglês e espanhol, traduzidos por nós (src/i18n/traducoes.json). O código continua escrito em
 * português: tx('Lançar entrada') devolve "Add income" em inglês e "Registrar ingreso" em espanhol. Sem tradução, fica o
 * português. Os outros idiomas são do tradutor do Google (lib/idioma.ts).
 * Valores no meio do texto entram por posição: tx('Resumo de {0} de {1}', mes, ano).
 * Trocar de idioma recarrega a página, então o idioma não muda com a página aberta.
 * Para tirar os textos de um arquivo novo: node scripts/traducao/extrair.cjs <arquivo>.
 */
const lista = traducoes as Record<string, Partial<Record<(typeof IDIOMAS_NATIVOS)[number], string>>>
const idioma = idiomaAtual()
export const nativo = (IDIOMAS_NATIVOS as readonly string[]).includes(idioma)

export function tx(pt: string, ...valores: (string | number)[]): string {
  const texto = (nativo && lista[pt]?.[idioma as 'en' | 'es']) || pt
  return valores.length ? texto.replace(/\{(\d+)\}/g, (_, i: string) => String(valores[+i] ?? '')) : texto
}
