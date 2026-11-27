/**
 * A ponte entre o app e o Cairo (src/cairo): monta a `EntradaCairo` com os registros que a análise já tem e chama o núcleo.
 * É o único lugar que conhece os dois lados. O núcleo não importa nada de src/lib; quem importa é este arquivo.
 *
 * Reaproveita o que o app já calcula e está certo (a agenda dos compromissos, as promessas avaliadas, o que te devem e o
 * aprendizado de juros), para o Cairo não ter uma segunda versão disso. O que o Cairo devolve vai em `analise.cairo`.
 */
import { contaValeNoMes, lerCairo, mesIso, type ClasseDoLancamento, type EntradaCairo, type LeituraDoCairo, type ResumoDoMes } from '../cairo'
import { chaveMes, doMesChave } from './cartoes'
import type { Evento } from './analise'
import { aReceberPrevisto, calendarioDe, meDevem, promessasDe, situacaoDividas } from './dividas'
import { aprenderJuros } from './jurosAprendido'
import type { Taxas } from './moedas'
import type {
  Categoria, ConferenciaDivida, ContaFixa, Divida, FaturaPaga, Lancamento, Pagamento, SaldoDivida,
} from './types'

export interface EntradaDaPonte {
  hojeIso: string
  moeda: string
  fimDoHorizonte: string
  lancs: Lancamento[]
  categorias: Categoria[]
  categoriaDe: (l: Lancamento) => string
  contas: ContaFixa[]
  dividas: Divida[]
  saldos: SaldoDivida[]
  pagamentos: Pagamento[]
  conferencias: ConferenciaDivida[]
  faturasPagas: FaturaPaga[]
  taxas: Taxas
  /** O saldo da conta corrente somado (null sem bancos informados) e o mês de onde ele veio. */
  saldoContaCorrente: { valor: number; mes: string } | null
  /** A agenda do app, de hoje até o fim do horizonte (lib/analise.ts). */
  eventos: Evento[]
  comDividas: boolean
}

export function entradaDoCairo(p: EntradaDaPonte): EntradaCairo {
  const catPorId = new Map(p.categorias.map((c) => [c.id, c]))
  const [ano, mes] = [Number(p.hojeIso.slice(0, 4)), Number(p.hojeIso.slice(5, 7))]
  const dividas = p.comDividas ? p.dividas.filter((d) => !d.em_espera) : []
  const situacoes = dividas.length ? situacaoDividas(dividas, p.saldos, p.pagamentos, ano, mes, p.taxas, p.hojeIso) : []
  const devo = situacoes.filter((s) => !meDevem(s.divida))
  const receber = situacoes.filter((s) => meDevem(s.divida))
  return {
    hoje: p.hojeIso,
    moeda: p.moeda,
    horizonteAte: p.fimDoHorizonte,
    lancamentos: p.lancs.map((l) => {
      const c = catPorId.get(p.categoriaDe(l))
      return {
        id: l.id, ano: l.ano, mes: l.mes, tipo: l.tipo, descricao: l.descricao, valor: l.valor, data: l.data,
        categoria: c?.id ?? '', categoriaNome: c?.nome ?? '', cartao_id: l.cartao_id, parcelas: l.parcelas, data_compra: l.data_compra,
        conta_fixa_id: l.conta_fixa_id, divida_id: l.divida_id, guardado_banco_id: l.guardado_banco_id, pago_por: l.pago_por,
        created_at: l.created_at ?? null,
      }
    }),
    contasFixas: p.contas.map((c) => ({
      id: c.id, tipo: c.tipo, descricao: c.descricao, valor: c.valor, dia: c.dia, inicio: c.inicio, fim: c.fim, ativa: c.ativa, moeda: c.moeda,
    })),
    dividas: dividas.map((d) => ({
      id: d.id, descricao: d.descricao, sentido: d.sentido, pessoa: d.pessoa, valor_parcela: d.valor_parcela, total_parcelas: d.total_parcelas,
      inicio: d.inicio, moeda: d.moeda, juros_mes: d.juros_mes, atraso_juros_mes: d.atraso_juros_mes, atraso_tipo: d.atraso_tipo,
      atraso_multa: d.atraso_multa, atraso_base: d.atraso_base, atraso_periodo: d.atraso_periodo, atraso_reais_dia: d.atraso_reais_dia,
      valor_recebido: d.valor_recebido, em_espera: d.em_espera,
      partes: d.partes?.map((x) => ({ vencimento: x.vencimento, valor: x.valor, inicio: x.inicio ?? null })),
    })),
    conferencias: p.conferencias.map((c) => ({
      id: c.id, divida_id: c.divida_id, data: c.data, antes: c.antes, depois: c.depois, origem: c.origem, qual_valor: c.qual_valor, created_at: c.created_at,
    })),
    faturasPagas: p.faturasPagas.map((f) => ({ id: f.id, cartao_id: f.cartao_id, ano: f.ano, mes: f.mes, valor: f.valor, pago_em: f.pago_em, juros: f.juros, tipo: f.tipo })),
    saldoContaCorrente: p.saldoContaCorrente,
    compromissos: p.eventos.map((ev) => ({
      data: ev.data, vence: ev.vence ?? null, tipo: ev.tipo, descricao: ev.descricao, valor: ev.valor, origem: ev.origem, atrasada: ev.atrasada, grupo: ev.grupo,
    })),
    promessas: receber.flatMap((s) => promessasDe(s, p.pagamentos, p.hojeIso).lista.map((x) => ({
      divida_id: s.divida.id, data: x.promessa.data, estado: x.estado, created_at: x.promessa.created_at,
    }))),
    aReceber: receber.flatMap((s) => aReceberPrevisto(s, p.pagamentos, p.hojeIso, p.fimDoHorizonte)
      .filter((x) => x.data).map((x) => ({ divida_id: s.divida.id, data: x.data!, valor: x.valor, descricao: x.nome }))),
    jurosAprendidos: devo.flatMap((s) => {
      const a = aprenderJuros(s, calendarioDe(s, p.hojeIso), p.conferencias)
      return a ? [{ divida_id: s.divida.id, amostras: a.amostras, modelo: a.modelo, taxaDia: a.taxaDia, reaisDia: a.reaisDia, confianca: a.confianca }] : []
    }),
  }
}

/**
 * O que a última leitura fez, sem nenhum dado financeiro: a versão, se deu certo, quanto tempo levou e quantos avisos e
 * cenários. Fica em `globalThis.__cairo` para conferir no app (testes do app de demonstração, console).
 */
export interface DiagnosticoDoCairo { versao: string; ok: boolean; ms: number; avisos: number; violacoes: number; mesesNoFluxo: number; erro?: string }

/**
 * A leitura do Cairo, ou null se algo der errado lá dentro. Um defeito no núcleo novo não pode derrubar o Consultor: ele
 * continua com o motor de sempre, e o erro fica no diagnóstico (e no console de desenvolvimento).
 */
export function leituraDoCairo(p: EntradaDaPonte): LeituraDoCairo | null {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  try {
    const l = lerCairo(entradaDoCairo(p))
    diagnosticar({
      versao: l.versao.dados, ok: true, ms: Math.round(agora()), avisos: l.avisos.length, violacoes: l.contagem.violacoes.length,
      mesesNoFluxo: l.qualidade.meses.filter((m) => m.gastos === 'conta' && (m.renda === 'conta' || m.renda === 'zero_real')).length,
    })
    return l
  } catch (erro) {
    if (import.meta.env?.DEV) console.error('Cairo:', erro)
    diagnosticar({ versao: '', ok: false, ms: Math.round(agora()), avisos: 0, violacoes: 0, mesesNoFluxo: 0, erro: erro instanceof Error ? erro.message : String(erro) })
    return null
  }
}

function diagnosticar(d: DiagnosticoDoCairo) {
  (globalThis as { __cairo?: DiagnosticoDoCairo }).__cairo = d
}

/**
 * O resumo de cada mês fechado para a qualidade dos meses (src/cairo/qualidade/meses.ts), com os lançamentos que a análise e o
 * conselheiro já filtraram e a mesma classificação. Os dois motores antigos e o Cairo usam isto: os três dão o mesmo mês.
 * `fechados` vem na numeração do app (`chaveMes`: ano × 12 + mês − 1).
 */
export function resumosDosMeses(
  lancs: Lancamento[], fechados: number[], cl: (l: Lancamento) => ClasseDoLancamento, contas: Pick<ContaFixa, 'tipo' | 'inicio' | 'fim' | 'ativa'>[],
): ResumoDoMes[] {
  return fechados.map((k) => {
    const { ano, mes } = doMesChave(k)
    const iso = mesIso(ano, mes)
    const doMes = lancs.filter((l) => chaveMes(l.ano, l.mes) === k && l.valor > 0)
    return {
      chave: k, mes: iso,
      nEntradas: doMes.filter((l) => cl(l) === 'renda').length,
      nSaidas: doMes.filter((l) => cl(l) === 'gasto').length,
      esperavaEntradaFixa: contas.some((c) => c.tipo === 'entrada' && contaValeNoMes(c, iso)),
    }
  })
}
