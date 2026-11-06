/**
 * O jeito de cada pessoa com o dinheiro, lido da análise (lib/analise.ts): gasta muito, é controlada, está endividada,
 * tem renda que varia, usa muito o cartão ou está começando agora. Cada traço sobe na tela os gráficos que mais servem a
 * quem tem esse jeito (lib/visuais.ts), e a aba Consultor mostra os traços no topo.
 *
 * Os traços são leituras dos números, não rótulos fixos: mudam sozinhos quando os lançamentos mudam.
 *
 * A tela do Consultor mostra o perfil em destaque (`perfilDe`: o traço que mais diz sobre a pessoa, com a cor e o número
 * dele) e as réguas (`reguasDe`): onde a pessoa está entre gastar tudo e guardar muito, sem dívidas e dívidas pesadas,
 * anotar pouco e anotar tudo, renda que varia e renda estável.
 */
import type { Analise, Tom } from './analise'
import { fmtPct, fmtValor } from './format'
import { tx } from './textos'

export type IdTraco = 'iniciante' | 'gastador' | 'controlado' | 'endividado' | 'renda-varia' | 'cartao'
  | 'poupador' | 'credito' | 'apertado' | 'estavel' | 'minucioso'

export interface Traco {
  id: IdTraco
  icone: string
  nome: string
  /** O número que resume o traço, em poucas palavras ("Guarda 32% do que entra"). */
  curto: string
  /** Por que o motor acha isso, com o número que levou a essa leitura. */
  porque: string
}

/** Quanto do que entra vai para parcelas: das dívidas e das compras parceladas no cartão (o mesmo número em todo lugar). */
const pesoDasParcelas = (a: Analise) => (a.renda > 0 ? ((a.dividas?.parcelasMes ?? 0) + a.categorias.reduce((s, c) => s + c.parcelado, 0)) / a.renda : 0)

export function tracosDe(a: Analise): Traco[] {
  const t: Traco[] = []
  const peso = pesoDasParcelas(a)
  if (!a.temFluxo || a.mesesAnalisados < 3) {
    t.push({
      id: 'iniciante', icone: 'bussola', nome: tx('Começando agora'),
      curto: a.mesesAnalisados === 1 ? tx('1 mês completo lançado') : tx('{0} meses completos lançados', a.mesesAnalisados),
      porque: tx('Com {0} meses lançados, a leitura ainda é curta. Ela fica mais certa a cada mês.', a.mesesAnalisados) })
  }
  const estilo = a.regra ? a.regra.estilo + a.regra.outros : 0
  if (a.temFluxo && (a.sobra < 0 || estilo > 0.4)) {
    t.push({
      id: 'gastador', icone: 'carteira', nome: tx('Gasta bastante'),
      curto: a.sobra < 0 ? tx('Sai {0} a mais do que entra', fmtValor(-a.sobra)) : tx('{0} do que entra vai para estilo de vida', fmtPct(estilo)),
      porque: a.sobra < 0 ? tx('Nos últimos meses saíram {0} a mais do que entrou, por mês.', fmtValor(-a.sobra))
        : tx('{0} do que entra vai para estilo de vida (o ideal é até 30%).', fmtPct(estilo)),
    })
  } else if (a.jeito.poupador) {
    t.push({ id: 'poupador', icone: 'cofre', nome: tx('Guarda muito'), curto: tx('Guarda {0} do que entra', fmtPct(a.sobraFracao)), porque: tx('Você guarda {0} do que entra e gasta pouco com você. Não precisa cortar mais: o consultor mostra quanto dá para aproveitar sem culpa.', fmtPct(a.sobraFracao)) })
  } else if (a.temFluxo && a.sobraFracao >= 0.15) {
    t.push({ id: 'controlado', icone: 'escudo', nome: tx('Controlado'), curto: tx('Guarda {0} do que entra', fmtPct(a.sobraFracao)), porque: tx('Você guarda {0} do que entra, por mês.', fmtPct(a.sobraFracao)) })
  } else if (a.jeito.apertado) {
    t.push({ id: 'apertado', icone: 'calendario', nome: tx('Orçamento justo'), curto: tx('O essencial leva {0} do que entra', fmtPct(a.regra ? a.regra.essencial + a.regra.parcelas : 0)), porque: tx('Quase tudo o que entra vai para o essencial e as parcelas. O foco agora é fechar o mês sem faltar, não guardar 20%.') })
  } else if (a.jeito.estavel) {
    t.push({ id: 'estavel', icone: 'check', nome: tx('Estável'), curto: tx('Mês no azul, sem sustos'), porque: tx('O mês fecha no azul, sem atraso nem dívida cara. O consultor fala pouco e avisa quando algo fugir do normal.') })
  }
  const d = a.dividas
  if (d && d.total > 0 && (d.temCara || (a.renda > 0 && d.parcelasMes / a.renda >= 0.25) || (a.renda > 0 && d.total >= a.renda * 3))) {
    t.push({
      id: 'endividado', icone: 'divida', nome: tx('Com dívidas pesando'),
      curto: peso > 0 ? tx('Parcelas levam {0} do que entra', fmtPct(peso)) : tx('Deve {0} no total', fmtValor(d.total)),
      porque: peso > 0 ? tx('As parcelas levam {0} do que entra por mês.', fmtPct(peso)) : tx('Você deve {0} no total.', fmtValor(d.total)),
    })
  }
  if (a.jeito.credito) {
    t.push({ id: 'credito', icone: 'acordo', nome: tx('Usa crédito com controle'), curto: tx('Parcelas baratas e em dia'), porque: tx('Você tem parcelas, mas baratas e dentro do limite seguro, sem atraso. Sem sermão: o consultor só mostra até onde dá para ir.') })
  }
  if (a.jeito.minucioso) {
    t.push({ id: 'minucioso', icone: 'lista', nome: tx('Anota tudo'), curto: tx('Cerca de {0} lançamentos por mês', a.lancamentosPorMes), porque: tx('Você lança cerca de {0} coisas por mês, quase todas com categoria. Os gráficos de detalhe vêm primeiro.', a.lancamentosPorMes) })
  }
  if (a.rendaVaria) {
    t.push({ id: 'renda-varia', icone: 'ano', nome: tx('Renda que varia'), curto: tx('A renda muda de um mês para o outro'), porque: tx('O que entra muda bastante de um mês para o outro: vale olhar o caixa dia a dia.') })
  }
  if (a.cartao && a.cartao.fracaoDasSaidas >= 0.45) {
    t.push({ id: 'cartao', icone: 'cartao', nome: tx('Usa muito o cartão'), curto: tx('{0} do que sai passa pelo cartão', fmtPct(a.cartao.fracaoDasSaidas)), porque: tx('{0} do que sai passa pelo cartão.', fmtPct(a.cartao.fracaoDasSaidas)) })
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
  poupador: { 'curva-patrimonio': 22, 'aneis-metas': 18, 'pote-reserva': 10, 'colunas-sobra': 12, calendario: -14 },
  credito: { 'linha-dividas': 10, calendario: 8, 'barras-fixas': 8 },
  apertado: { calendario: 16, 'curva-saldo': 14, fluxo: 10, 'rosca-503020': 6, 'curva-patrimonio': -12, 'aneis-metas': -8 },
  estavel: { 'colunas-sobra': 8, 'curva-patrimonio': 8 },
  minucioso: { categorias: 12, 'tabela-orcamento': 12, halteres: 10, radar: 8 },
}

export function bonusDoJeito(tracos: Traco[], idVisual: string) {
  return tracos.reduce((s, t) => s + (BONUS[t.id][idVisual] ?? 0), 0)
}

// ---------- o perfil em destaque e as réguas ----------

/** A cor de cada traço na tela: verde vai bem, laranja pede atenção, vermelho pesa, azul é neutro. */
export type CorDoTraco = Tom | 'neutro'
const COR: Record<IdTraco, CorDoTraco> = {
  iniciante: 'neutro', gastador: 'medio', endividado: 'ruim', apertado: 'medio', poupador: 'bom', credito: 'neutro',
  controlado: 'bom', estavel: 'bom', minucioso: 'neutro', cartao: 'medio', 'renda-varia': 'medio',
}
/** Qual traço diz mais sobre a pessoa, quando ela tem vários: o que mais muda o que o consultor precisa falar. */
const ORDEM: IdTraco[] = ['iniciante', 'endividado', 'gastador', 'apertado', 'poupador', 'credito', 'controlado', 'estavel', 'minucioso', 'cartao', 'renda-varia']

export interface Perfil {
  principal: Traco & { cor: CorDoTraco }
  outros: (Traco & { cor: CorDoTraco })[]
}

/** O perfil que a tela mostra em destaque e os outros traços, em ordem de importância (null sem nenhum traço). */
export function perfilDe(tracos: Traco[]): Perfil | null {
  const lista = [...tracos].sort((x, y) => ORDEM.indexOf(x.id) - ORDEM.indexOf(y.id)).map((t) => ({ ...t, cor: COR[t.id] }))
  return lista.length ? { principal: lista[0], outros: lista.slice(1) } : null
}

export interface Regua {
  id: 'guardar' | 'dividas' | 'controle' | 'ritmo'
  icone: string
  esquerda: string
  direita: string
  /** De 0 (lado esquerdo) a 1 (lado direito). */
  valor: number
  tom: Tom
  /** O número por trás da posição, curto ("guarda 12%"). */
  numero: string
}

const entre = (n: number) => Math.min(1, Math.max(0, n))

/** Onde a pessoa está em cada régua do jeito com o dinheiro (só as réguas que os números permitem medir). */
export function reguasDe(a: Analise): Regua[] {
  const r: Regua[] = []
  if (a.temFluxo && a.renda > 0) {
    r.push({
      id: 'guardar', icone: 'cofre', esquerda: tx('Gasta tudo'), direita: tx('Guarda muito'),
      // de faltar 20% a guardar 40% do que entra
      valor: entre((a.sobraFracao + 0.2) / 0.6), tom: a.sobraFracao < 0 ? 'ruim' : a.sobraFracao < 0.1 ? 'medio' : 'bom',
      numero: a.sobra < 0 ? tx('falta {0}', fmtPct(-a.sobraFracao)) : tx('guarda {0}', fmtPct(a.sobraFracao)),
    })
  }
  if (a.renda > 0 || a.dividas) {
    const peso = a.renda > 0 ? pesoDasParcelas(a) : 0.5
    const atrasado = a.atrasoTotal > 0
    r.push({
      id: 'dividas', icone: 'divida', esquerda: tx('Sem dívidas'), direita: tx('Dívidas pesadas'),
      // de nada a metade do que entra em parcelas; atraso já põe perto do fim
      valor: atrasado ? Math.max(0.85, entre(peso / 0.5)) : entre(peso / 0.5),
      tom: atrasado || peso > 0.3 ? 'ruim' : peso > 0.15 ? 'medio' : 'bom',
      numero: peso > 0 && a.renda > 0 ? tx('parcelas: {0}', fmtPct(peso)) : a.dividas ? fmtValor(a.dividas.total) : tx('nenhuma'),
    })
  }
  if (a.lancamentosPorMes > 0) {
    const valor = entre(a.lancamentosPorMes / 40) * (1 - Math.min(0.5, a.semCategoria))
    r.push({
      id: 'controle', icone: 'lista', esquerda: tx('Anota pouco'), direita: tx('Anota tudo'), valor,
      tom: valor >= 0.5 ? 'bom' : 'medio', numero: tx('{0} por mês', a.lancamentosPorMes),
    })
  }
  if (a.variacaoRenda !== null) {
    const valor = entre(1 - a.variacaoRenda / 0.5)
    r.push({
      id: 'ritmo', icone: 'ano', esquerda: tx('Renda varia'), direita: tx('Renda estável'), valor,
      tom: a.rendaVaria ? 'medio' : 'bom', numero: a.rendaVaria ? tx('muda bastante') : tx('quase igual'),
    })
  }
  return r
}
