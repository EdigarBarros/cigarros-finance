/**
 * Como está o mês, numa palavra só para os três jeitos de ver: **favorável**, **atenção**, **crítico** ou **sem dados**.
 *
 * Antes, a saudação dizia "Você está no caminho certo! 🚀" só porque entrou mais do que saiu até hoje, mesmo com a
 * previsão do fim do mês no vermelho; e o simples tinha a sua própria regra do "Mês apertado". Agora há uma conta só, com
 * critérios que dá para conferir (cada motivo traz o número), e a tela escolhe só o quanto mostra:
 *
 *  - **Crítico**: no mês que está correndo, a previsão do fim do mês (o que já entrou − o que já saiu + o que ainda vai
 *    entrar − o que ainda vai sair) é negativa; num mês que já acabou, saiu mais do que entrou.
 *  - **Atenção**: a sobra (prevista ou que ficou) é menor que 5% do que entra; ou até hoje saiu mais do que entrou, mas o
 *    que ainda vai entrar cobre; ou há conta, fatura ou parcela atrasada; ou a previsão só fecha contando com um
 *    recebimento que já devia ter caído; ou ainda não há nenhuma entrada lançada nem prevista no mês.
 *  - **Favorável**: nada disso.
 *  - **Sem dados**: nada entrou, saiu nem está previsto; ou o mês ainda não começou.
 *
 * Não julga a vida de ninguém: só diz o que os números lançados mostram. É puro (não lê data nem tela).
 */
import { fmtValor } from './format'
import { tx } from './textos'

export type EstadoDoMes = 'favoravel' | 'atencao' | 'critico' | 'sem_dados'
/** Mês que já acabou, o de hoje, ou um que ainda não começou. */
export type Momento = 'passado' | 'atual' | 'futuro'

export type IdMotivo =
  | 'previsto_negativo' | 'resultado_negativo' | 'negativo_ate_agora' | 'margem_pequena' | 'recebimento_atrasado'
  | 'atrasadas' | 'sem_entradas' | 'previsto_positivo' | 'resultado_positivo' | 'sem_movimento' | 'futuro'

export interface Motivo {
  id: IdMotivo
  /** O quanto este motivo pesa sozinho. */
  peso: EstadoDoMes
  texto: string
}

export interface SituacaoDoMes {
  estado: EstadoDoMes
  momento: Momento
  /** O que já entrou menos o que já saiu. */
  resultado: number
  /** Só no mês de hoje: como o mês deve terminar com o que está lançado e previsto. */
  previsto: number | null
  /** Do mais para o menos grave. O primeiro é a frase do mês. */
  motivos: Motivo[]
  /** Nome curto do estado para o selo ("Mês apertado", "Contas atrasadas"…). */
  selo: string
}

/** Abaixo disto (da parte do que entra), sobrou pouco: o mesmo corte que o "Mês apertado" do simples sempre usou. */
export const MARGEM_APERTADA = 0.05

const PESO: Record<EstadoDoMes, number> = { critico: 3, atencao: 2, favoravel: 1, sem_dados: 0 }
const centavos = (n: number) => Math.round(n * 100) / 100

export function situacaoDoMes({ momento, entrou, saiu, vaiEntrar, vaiSair, atrasadas = 0, receberAtrasado = 0 }: {
  momento: Momento
  /** Já entrou / já saiu no mês (no de hoje, até hoje). */
  entrou: number
  saiu: number
  /** Ainda vai entrar / sair (contas sem baixa, parcelas, fatura em aberto, lançamentos com data à frente). */
  vaiEntrar: number
  vaiSair: number
  /** Contas, faturas e parcelas a pagar que já venceram e continuam em aberto. */
  atrasadas?: number
  /** Do que ainda vai entrar, quanto já devia ter entrado (salário cadastrado que ainda não foi marcado como recebido). */
  receberAtrasado?: number
}): SituacaoDoMes {
  const resultado = centavos(entrou - saiu)
  const atual = momento === 'atual'
  const previsto = atual ? centavos(resultado + vaiEntrar - vaiSair) : null
  const motivos: Motivo[] = []
  const add = (id: IdMotivo, peso: EstadoDoMes, texto: string) => motivos.push({ id, peso, texto })

  if (momento === 'futuro') {
    add('futuro', 'sem_dados', tx('Este mês ainda não começou: só aparece o que já está lançado ou previsto para ele.'))
    return { estado: 'sem_dados', momento, resultado, previsto: null, motivos, selo: '' }
  }
  const semMovimento = !entrou && !saiu && (!atual || (!vaiEntrar && !vaiSair))
  if (semMovimento) {
    add('sem_movimento', 'sem_dados', tx('Ainda não há lançamentos neste mês para avaliar.'))
    return { estado: 'sem_dados', momento, resultado, previsto, motivos, selo: '' }
  }

  // o número que diz como o mês fecha: a previsão no mês de hoje, o que ficou nos outros
  const final = atual ? previsto! : resultado
  const base = atual ? entrou + vaiEntrar : entrou
  if (atual && base <= 0) {
    add('sem_entradas', 'atencao', tx('Nenhuma entrada lançada nem prevista neste mês ainda. Se você recebe salário, cadastre em Contas do mês para ele entrar na previsão.'))
  } else if (final < 0) {
    if (atual) add('previsto_negativo', 'critico', tx('As saídas previstas passam do que entrou e do que ainda vai entrar: podem faltar {0} no fim do mês.', fmtValor(-final)))
    else add('resultado_negativo', 'critico', tx('Saiu {0} a mais do que entrou.', fmtValor(-final)))
  } else {
    const margem = base > 0 ? final / base : 0
    if (atual && resultado < 0) {
      add('negativo_ate_agora', 'atencao', tx('Até hoje saiu {0} a mais do que entrou; o que ainda vai entrar deve cobrir.', fmtValor(-resultado)))
    }
    if (margem < MARGEM_APERTADA) {
      add('margem_pequena', 'atencao', atual
        ? tx('Pelo previsto, sobra só {0}% do que entra no mês ({1}).', Math.round(margem * 100), fmtValor(final))
        : tx('Sobrou só {0}% do que entrou ({1}).', Math.round(margem * 100), fmtValor(final)))
    }
    // a previsão positiva depende de um dinheiro que já devia ter caído e não caiu
    if (atual && receberAtrasado > 0 && final - receberAtrasado < 0) {
      add('recebimento_atrasado', 'atencao', tx('A previsão conta com {0} que já devia ter entrado e ainda não foi marcado como recebido.', fmtValor(receberAtrasado)))
    }
  }
  if (atrasadas > 0) {
    add('atrasadas', 'atencao', atrasadas === 1 ? tx('Existe 1 conta vencida que precisa da sua atenção.') : tx('Existem {0} contas vencidas que precisam da sua atenção.', atrasadas))
  }
  if (!motivos.some((m) => m.peso === 'critico' || m.peso === 'atencao')) {
    if (atual) add('previsto_positivo', 'favoravel', tx('Seu resultado previsto para o fim do mês está positivo: {0}.', fmtValor(final)))
    else add('resultado_positivo', 'favoravel', tx('Você conseguiu preservar {0}% da sua receita ({1}).', Math.round((final / base) * 100), fmtValor(final)))
  }
  motivos.sort((a, b) => PESO[b.peso] - PESO[a.peso])
  const estado = motivos[0].peso
  return { estado, momento, resultado, previsto, motivos, selo: seloDe(estado, motivos[0].id) }
}

/** O nome do estado, pelo motivo principal (o simples mostra num selo; os outros jeitos, numa pílula). */
function seloDe(estado: EstadoDoMes, principal: IdMotivo) {
  if (estado === 'favoravel') return tx('Mês no azul')
  if (principal === 'resultado_negativo') return tx('Mês no vermelho')
  if (principal === 'previsto_negativo') return tx('Previsão no vermelho')
  if (principal === 'margem_pequena') return tx('Mês apertado')
  if (principal === 'atrasadas') return tx('Contas atrasadas')
  return tx('Pede atenção')
}

/** Os critérios em palavras, para o "Por que este estado?" (o mesmo texto nos três jeitos). */
export const criteriosDoEstado = () => [
  tx('Crítico: no mês de hoje, a previsão do fim do mês é negativa; num mês que já acabou, saiu mais do que entrou.'),
  tx('Atenção: sobra menos de 5% do que entra, há conta vencida em aberto, até hoje saiu mais do que entrou ou a previsão depende de um recebimento atrasado.'),
  tx('No azul: nada disso aconteceu.'),
]
