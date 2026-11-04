/**
 * O jeito de cada pessoa com o dinheiro, lido da análise (lib/analise.ts): gasta muito, é controlada, está endividada,
 * tem renda que varia, usa muito o cartão ou está começando agora. Cada traço sobe na tela os gráficos que mais servem a
 * quem tem esse jeito (lib/visuais.ts), e a aba Consultor mostra os traços no topo.
 *
 * Os traços são leituras dos números, não rótulos fixos: mudam sozinhos quando os lançamentos mudam.
 */
import type { Analise } from './analise'
import { fmtPct, fmtValor } from './format'
import { tx } from './textos'

export type IdTraco = 'iniciante' | 'gastador' | 'controlado' | 'endividado' | 'renda-varia' | 'cartao'

export interface Traco {
  id: IdTraco
  icone: string
  nome: string
  /** Por que o motor acha isso, com o número que levou a essa leitura. */
  porque: string
}

export function tracosDe(a: Analise): Traco[] {
  const t: Traco[] = []
  if (!a.temFluxo || a.mesesAnalisados < 3) {
    t.push({ id: 'iniciante', icone: 'bussola', nome: tx('Começando agora'), porque: tx('Com {0} meses lançados, a leitura ainda é curta. Ela fica mais certa a cada mês.', a.mesesAnalisados) })
  }
  const estilo = a.regra ? a.regra.estilo + a.regra.outros : 0
  if (a.temFluxo && (a.sobra < 0 || estilo > 0.4)) {
    t.push({
      id: 'gastador', icone: 'carteira', nome: tx('Gasta bastante'),
      porque: a.sobra < 0 ? tx('Nos últimos meses saíram {0} a mais do que entrou, por mês.', fmtValor(-a.sobra))
        : tx('{0} do que entra vai para estilo de vida (o ideal é até 30%).', fmtPct(estilo)),
    })
  } else if (a.temFluxo && a.sobraFracao >= 0.15) {
    t.push({ id: 'controlado', icone: 'escudo', nome: tx('Controlado'), porque: tx('Você guarda {0} do que entra, por mês.', fmtPct(a.sobraFracao)) })
  }
  const d = a.dividas
  if (d && d.total > 0 && (d.temCara || (a.renda > 0 && d.parcelasMes / a.renda >= 0.25) || (a.renda > 0 && d.total >= a.renda * 3))) {
    t.push({
      id: 'endividado', icone: 'divida', nome: tx('Com dívidas pesando'),
      porque: a.renda > 0 && d.parcelasMes > 0 ? tx('As parcelas levam {0} do que entra por mês.', fmtPct(d.parcelasMes / a.renda)) : tx('Você deve {0} no total.', fmtValor(d.total)),
    })
  }
  if (a.rendaVaria) {
    t.push({ id: 'renda-varia', icone: 'ano', nome: tx('Renda que varia'), porque: tx('O que entra muda bastante de um mês para o outro: vale olhar o caixa dia a dia.') })
  }
  if (a.cartao && a.cartao.fracaoDasSaidas >= 0.45) {
    t.push({ id: 'cartao', icone: 'cartao', nome: tx('Usa muito o cartão'), porque: tx('{0} do que sai passa pelo cartão.', fmtPct(a.cartao.fracaoDasSaidas)) })
  }
  return t
}

/** Quanto cada traço sobe cada gráfico do feed (somado à prioridade que o motor dá). */
const BONUS: Record<IdTraco, Record<string, number>> = {
  iniciante: { calendario: 10, 'rosca-503020': 8, radar: -10, halteres: -10, 'curva-patrimonio': -10 },
  gastador: { categorias: 16, halteres: 14, 'tabela-orcamento': 16, 'rosca-503020': 10, 'barras-fixas': 8 },
  controlado: { 'pote-reserva': 12, 'aneis-metas': 14, 'curva-patrimonio': 16, 'colunas-sobra': 8 },
  endividado: { fluxo: 12, 'linha-dividas': 14, 'rosca-juros': 12, 'barras-estrategias': 12 },
  'renda-varia': { 'curva-saldo': 14, fluxo: 10, 'colunas-sobra': 12, calendario: 6 },
  cartao: { calendario: 8, fluxo: 8, 'barras-fixas': 6, categorias: 6 },
}

export function bonusDoJeito(tracos: Traco[], idVisual: string) {
  return tracos.reduce((s, t) => s + (BONUS[t.id][idVisual] ?? 0), 0)
}
