/**
 * Pessoas inventadas para testar o Cairo, cada uma com um caso difícil e a resposta conhecida (quem gerou sabe a verdade).
 * Nada aqui vem de dado real. Tudo é determinístico: a mesma persona sai igual em toda rodada.
 *
 * Hoje das personas: 2026-11-27 (sexta-feira). A janela é de 12 meses fechados (nov/2025 a out/2026) e o mês atual.
 */
import type { EntradaCairo, LancBruto } from '../../src/cairo/entrada'
import { sorteio } from '../../src/cairo/aprendizado/aleatorio'
import { diasNoMes, diaIso, diaDaSemana, doNumero, numero, somarDias, type DiaISO } from '../../src/cairo/contrato/unidades'

export const HOJE = '2026-11-27'

interface Opcoes {
  semente: number
  /** Gasto médio do dia a dia num dia útil e no fim de semana (reais). */
  diaUtil?: number
  fimDeSemana?: number
  /** A partir deste mês (AAAA-MM), o dia a dia multiplica por este fator (mudança de comportamento). */
  mudanca?: { desde: string; fator: number }
  /** Meses (AAAA-MM) em que quase nada foi lançado. */
  malLancados?: string[]
  /** Meses sem nenhum lançamento. */
  vazios?: string[]
  /** Fração dos lançamentos registrados dias depois. */
  lancaDepois?: number
}

const meses = () => {
  const out: { ano: number; mes: number }[] = []
  for (let k = 2025 * 12 + 11; k <= 2026 * 12 + 11; k++) out.push({ ano: Math.floor((k - 1) / 12), mes: ((k - 1) % 12) + 1 })
  return out
}
const mesStr = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`

/** Gera o dia a dia (padaria, mercado, app de corrida) de todos os meses, até ontem. */
function diaADia(o: Opcoes, id: { n: number }): LancBruto[] {
  const r = sorteio(o.semente)
  const out: LancBruto[] = []
  const nomes = ['Padaria', 'Mercado', 'Uber', 'Farmácia', 'Lanche', 'Feira', 'Posto']
  for (const { ano, mes } of meses()) {
    const ms = mesStr(ano, mes)
    if (o.vazios?.includes(ms)) continue
    const mal = o.malLancados?.includes(ms)
    const fator = o.mudanca && ms >= o.mudanca.desde ? o.mudanca.fator : 1
    for (let d = 1; d <= diasNoMes(ano, mes); d++) {
      const dia = diaIso(ano, mes, d)
      if (dia >= HOJE) break
      const fds = [0, 6].includes(diaDaSemana(dia))
      const media = (fds ? o.fimDeSemana ?? 90 : o.diaUtil ?? 40) * fator
      // 0 a 3 compras por dia; alguns dias sem gasto
      const n = r() < 0.2 ? 0 : 1 + Math.floor(r() * 3)
      for (let i = 0; i < n; i++) {
        if (mal && r() < 0.93) continue
        const v = Math.round(((media / 2) * (0.3 + r() * 1.4)) * 100) / 100
        const criado = o.lancaDepois && r() < o.lancaDepois ? somarDias(dia, 4 + Math.floor(r() * 10)) : dia
        out.push({ id: `d${id.n++}`, ano, mes, tipo: 'saida', descricao: `${nomes[Math.floor(r() * nomes.length)]} ${Math.floor(r() * 900)}`, valor: v, data: dia, categoria: 'cat-dia', categoriaNome: 'Alimentação', created_at: `${criado}T12:00:00Z` })
      }
    }
  }
  return out
}

function base(): EntradaCairo {
  return {
    hoje: HOJE, moeda: 'BRL', horizonteAte: '2026-12-31', lancamentos: [], contasFixas: [], dividas: [], conferencias: [], faturasPagas: [],
    saldoContaCorrente: { valor: 2500, mes: '2026-11' }, compromissos: [], promessas: [], aReceber: [], jurosAprendidos: [],
  }
}

/** Salário de conta fixa no dia 5, com baixa; `atraso(ano, mes)` dá os dias de atraso de cada mês (null = não veio). */
function salario(e: EntradaCairo, valor: number, atraso: (a: number, m: number) => number | null, id: { n: number }) {
  e.contasFixas.push({ id: 'cf-sal', tipo: 'entrada', descricao: 'Salário', valor, dia: 5, inicio: '2025-01-01', fim: null, ativa: true })
  for (const { ano, mes } of meses()) {
    const d = atraso(ano, mes)
    if (d === null) continue
    const dia = somarDias(diaIso(ano, mes, 5), d)
    if (dia >= HOJE) continue
    e.lancamentos.push({ id: `s${id.n++}`, ano, mes, tipo: 'entrada', descricao: 'Salário', valor, data: dia, categoria: 'cat-sal', categoriaNome: 'Salário', conta_fixa_id: 'cf-sal', created_at: `${dia}T12:00:00Z` })
  }
  e.compromissos.push({ data: '2026-12-05', tipo: 'entrada', descricao: 'Salário', valor, origem: 'conta' })
}

function aluguel(e: EntradaCairo, id: { n: number }) {
  e.contasFixas.push({ id: 'cf-alu', tipo: 'saida', descricao: 'Aluguel', valor: 1200, dia: 10, inicio: '2025-01-01', fim: null, ativa: true })
  for (const { ano, mes } of meses()) {
    const dia = diaIso(ano, mes, 10)
    if (dia >= HOJE) continue
    e.lancamentos.push({ id: `a${id.n++}`, ano, mes, tipo: 'saida', descricao: 'Aluguel', valor: 1200, data: dia, categoria: 'cat-casa', categoriaNome: 'Casa', conta_fixa_id: 'cf-alu', created_at: `${dia}T12:00:00Z` })
  }
  e.compromissos.push({ data: '2026-12-10', tipo: 'saida', descricao: 'Aluguel', valor: 1200, origem: 'conta' })
}

export type Persona = { nome: string; e: EntradaCairo; verdade: Record<string, unknown> }

export function personas(): Persona[] {
  const lista: Persona[] = []

  // 1. estável: salário no dia, gasto com fim de semana mais caro
  {
    const id = { n: 0 }; const e = base()
    salario(e, 5000, () => 0, id); aluguel(e, id)
    e.lancamentos.push(...diaADia({ semente: 1, diaUtil: 40, fimDeSemana: 120 }, id))
    lista.push({ nome: 'estavel', e, verdade: { atrasoP50: 0, fimDeSemanaMaisCaro: true, quebra: false } })
  }
  // 2. a renda atrasa: em 5 dos 12 meses o salário caiu 2 a 4 dias depois
  {
    const id = { n: 0 }; const e = base()
    const atrasos: Record<number, number> = { 1: 3, 3: 2, 6: 4, 8: 2, 10: 3 }
    salario(e, 4200, (_a, m) => atrasos[m] ?? 0, id); aluguel(e, id)
    e.lancamentos.push(...diaADia({ semente: 2 }, id))
    lista.push({ nome: 'renda-atrasa', e, verdade: { atrasoP90Min: 2, atrasoP50: 0 } })
  }
  // 3. mês sem renda: freela que se repete por descrição; em junho/2026 não entrou nada, mas os gastos foram lançados
  {
    const id = { n: 0 }; const e = base()
    for (const { ano, mes } of meses()) {
      const dia = diaIso(ano, mes, 15)
      if (dia >= HOJE || mesStr(ano, mes) === '2026-06') continue
      e.lancamentos.push({ id: `f${id.n++}`, ano, mes, tipo: 'entrada', descricao: 'Freela design', valor: 3000, data: dia, categoria: 'cat-freela', categoriaNome: 'Trabalho', created_at: `${dia}T12:00:00Z` })
    }
    e.lancamentos.push(...diaADia({ semente: 3 }, id))
    lista.push({ nome: 'mes-sem-renda', e, verdade: { zeroReal: '2026-06' } })
  }
  // 4. mês mal lançado (março/2026) e mês vazio (dezembro/2025); salário de conta fixa sem baixa em março
  {
    const id = { n: 0 }; const e = base()
    salario(e, 5000, (a, m) => (a === 2026 && m === 3 ? null : 0), id)
    e.lancamentos.push(...diaADia({ semente: 4, malLancados: ['2026-03'], vazios: ['2025-12'] }, id))
    e.lancamentos = e.lancamentos.filter((l) => !(l.ano === 2025 && l.mes === 12))
    lista.push({ nome: 'mal-lancado', e, verdade: { parcial: '2026-03', vazio: '2025-12', rendaNaoRegistrada: '2026-03' } })
  }
  // 5. cartão e dívidas: juros do contrato, regra de atraso, juros aprendidos, oferta de quitação, fatura lançada em dobro
  {
    const id = { n: 0 }; const e = base()
    salario(e, 6000, () => 0, id)
    e.lancamentos.push(...diaADia({ semente: 5 }, id))
    e.dividas.push(
      { id: 'emp', descricao: 'Empréstimo', sentido: 'devo', valor_parcela: 110, total_parcelas: 12, inicio: '2026-06-10', juros_mes: 4.55, valor_recebido: 1000 },
      { id: 'mp', descricao: 'Mercado Pago', sentido: 'devo', valor_parcela: 1000, total_parcelas: 1, inicio: '2026-10-01', atraso_juros_mes: 0.4, atraso_periodo: 'dia', atraso_tipo: 'simples', atraso_multa: 2, atraso_base: 'saldo' },
      { id: 'agiota', descricao: 'Juros digitado errado', sentido: 'devo', valor_parcela: 100, total_parcelas: 3, inicio: '2026-11-01', juros_mes: 250 },
    )
    e.jurosAprendidos.push({ divida_id: 'mp', amostras: 2, modelo: 'pct', taxaDia: 0.007, reaisDia: 0, confianca: 'media' })
    e.conferencias.push({ id: 'q1', divida_id: 'mp', data: '2026-11-05', antes: 1260, depois: 1000, origem: 'conferir', qual_valor: 'quitar', created_at: '2026-11-05T12:00:00Z' })
    e.faturasPagas.push({ id: 'fp1', cartao_id: 'nu', ano: 2026, mes: 10, valor: 850, pago_em: '2026-10-12', juros: 35.4, tipo: 'paga' })
    e.lancamentos.push({ id: 'dobro', ano: 2026, mes: 10, tipo: 'saida', descricao: 'Pagamento fatura Nubank', valor: 850, data: '2026-10-12', categoria: 'cat-x', categoriaNome: 'Outros', created_at: '2026-10-12T12:00:00Z' })
    lista.push({ nome: 'dividas', e, verdade: { contratualEmp: 0.0455, faturaEmDobro: true, implausivel: 'agiota' } })
  }
  // 6. me devem: João cumpriu 1 de 3 promessas; deve 400 em 08/12
  {
    const id = { n: 0 }; const e = base()
    salario(e, 3000, () => 0, id)
    e.lancamentos.push(...diaADia({ semente: 6 }, id))
    e.dividas.push({ id: 'joao', descricao: 'Empréstimo ao João', sentido: 'me_devem', pessoa: 'João', valor_parcela: 400, total_parcelas: 3, inicio: '2026-10-08' })
    e.promessas.push(
      { divida_id: 'joao', data: '2026-09-20', estado: 'cumprida' },
      { divida_id: 'joao', data: '2026-10-08', estado: 'nao_cumprida' },
      { divida_id: 'joao', data: '2026-11-08', estado: 'pagou_depois' },
    )
    e.aReceber.push({ divida_id: 'joao', data: '2026-12-08', valor: 400, descricao: 'João' })
    // emprestou 1200 em setembro e recebeu 400 de volta em outubro: nada disso é gasto ou renda
    e.lancamentos.push(
      { id: 'emprestei', ano: 2026, mes: 9, tipo: 'saida', descricao: 'Pix João', valor: 1200, data: '2026-09-02', categoria: 'c', categoriaNome: 'Outros', divida_id: 'joao', created_at: '2026-09-02T12:00:00Z' },
      { id: 'devolveu', ano: 2026, mes: 10, tipo: 'entrada', descricao: 'Pix João', valor: 400, data: '2026-10-20', categoria: 'c', categoriaNome: 'Outros', divida_id: 'joao', created_at: '2026-10-20T12:00:00Z' },
    )
    lista.push({ nome: 'me-devem', e, verdade: { pJoao: (0.5 * 2 + 1) / (2 + 3) } })
  }
  // 7. mudança de comportamento: a partir de junho/2026 o dia a dia dobrou; muito lançado dias depois
  {
    const id = { n: 0 }; const e = base()
    salario(e, 7000, () => 0, id)
    e.lancamentos.push(...diaADia({ semente: 7, mudanca: { desde: '2026-06', fator: 2 }, lancaDepois: 0.4 }, id))
    lista.push({ nome: 'mudou', e, verdade: { quebraDesde: '2026-06', lancaDepois: true } })
  }
  // 8. transferências entre bolsos e outra moeda
  {
    const id = { n: 0 }; const e = base()
    salario(e, 5000, () => 0, id)
    e.lancamentos.push(...diaADia({ semente: 8 }, id))
    e.lancamentos.push(
      { id: 'cx', ano: 2026, mes: 10, tipo: 'saida', descricao: 'Pix pro porquinho', valor: 800, data: '2026-10-06', categoria: 'c', categoriaNome: 'Outros', guardado_banco_id: 'picpay', created_at: '2026-10-06T12:00:00Z' },
      { id: 'tr', ano: 2026, mes: 10, tipo: 'saida', descricao: 'Transferência entre contas', valor: 1500, data: '2026-10-07', categoria: 'c', categoriaNome: 'Outros', created_at: '2026-10-07T12:00:00Z' },
      { id: 'hotel', ano: 2026, mes: 10, tipo: 'saida', descricao: 'Reserva do hotel', valor: 600, data: '2026-10-09', categoria: 'c', categoriaNome: 'Viagem', created_at: '2026-10-09T12:00:00Z' },
    )
    e.dividas.push({ id: 'usd', descricao: 'Curso nos EUA', sentido: 'devo', valor_parcela: 100, total_parcelas: 10, inicio: '2026-08-01', moeda: 'usd', juros_mes: 1.2 })
    lista.push({ nome: 'bolsos', e, verdade: { foraDoFluxo: ['cx', 'tr'], gasto: ['hotel'] } })
  }
  // 9. cartão: compras quase todo dia (algumas parceladas, uma paga por outra pessoa), e empréstimos marcados para o futuro
  {
    const id = { n: 0 }; const e = base()
    salario(e, 6000, () => 0, id)
    e.lancamentos.push(...diaADia({ semente: 9 }, id))
    const r = sorteio(99)
    e.comprasNoCartao = []
    for (let n = numero('2025-12-01' as DiaISO); n < numero(HOJE as DiaISO); n++) {
      if (r() < 0.35) continue
      const d = doNumero(n)
      const parcelas = r() < 0.15 ? 3 : 1
      e.comprasNoCartao.push({ cartao_id: 'nu', valor: Math.round((20 + r() * 80) * 100) / 100, data_compra: d, parcela: 1, parcelas })
      for (let k = 2; k <= parcelas; k++) e.comprasNoCartao.push({ cartao_id: 'nu', valor: 10, data_compra: d, parcela: k, parcelas })
    }
    e.comprasNoCartao.push({ cartao_id: 'nu', valor: 5000, data_compra: '2026-11-20', parcela: 1, parcelas: 1, pago_por: 'Mãe' })
    // Nubank: fecha dia 3, vence dia 10 (os ciclos que o app calcula)
    e.cartoes = [{ id: 'nu', ciclos: [
      { fechamento: '2026-12-03', vencimento: '2026-12-10' }, { fechamento: '2027-01-03', vencimento: '2027-01-10' }, { fechamento: '2027-02-03', vencimento: '2027-02-10' },
    ] }]
    e.compromissos.push({ data: '2026-12-10', tipo: 'saida', descricao: 'Fatura Nubank', valor: 900, origem: 'cartao' })
    // empréstimos marcados: o banco libera 2.000 em 03/12; a pessoa empresta 300 ao Caio em 12/12; a Bia devolve 250 em 15/12
    e.dividas.push(
      { id: 'banco', descricao: 'Empréstimo do banco', sentido: 'devo', valor_parcela: 250, total_parcelas: 10, inicio: '2027-01-05', juros_mes: 3 },
      { id: 'caio', descricao: 'Caio', sentido: 'me_devem', pessoa: 'Caio', valor_parcela: null },
      { id: 'bia', descricao: 'Bia', sentido: 'me_devem', pessoa: 'Bia', valor_parcela: null },
    )
    e.compromissos.push(
      { data: '2026-12-03', tipo: 'entrada', descricao: 'Empréstimo do banco', valor: 2000, origem: 'lancamento', natureza: 'credito_recebido', divida_id: 'banco' },
      { data: '2026-12-12', tipo: 'saida', descricao: 'Pix Caio', valor: 300, origem: 'lancamento', natureza: 'emprestimo_concedido', divida_id: 'caio' },
      { data: '2026-12-15', tipo: 'entrada', descricao: 'Bia devolve', valor: 250, origem: 'lancamento', natureza: 'devolucao', divida_id: 'bia' },
      { data: '2026-12-11', tipo: 'saida', descricao: 'Mercado do mês', valor: 600, origem: 'lancamento', essencial: true },
    )
    e.promessas.push({ divida_id: 'bia', data: '2026-10-01', estado: 'cumprida' }, { divida_id: 'bia', data: '2026-11-01', estado: 'cumprida' })
    // o app também prevê a parcela da Bia para 14/12: é a mesma devolução, não pode contar duas vezes
    e.aReceber.push({ divida_id: 'bia', data: '2026-12-14', valor: 250, descricao: 'Bia' })
    lista.push({ nome: 'cartao', e, verdade: {} })
  }
  return lista
}

export const DIA_DA_PERSONA = HOJE as DiaISO
