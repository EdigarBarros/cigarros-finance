/**
 * Cenários de teste da Início (rodar: `node scripts/painel/testar.mjs`): a situação do mês, a previsão e a sua composição,
 * a comparação com o mês anterior e a separação das contas em atrasadas / próximas / depois. Os números esperados foram
 * feitos à mão, não tirados das próprias funções. Achou uma conta errada? Monte o caso aqui antes de consertar.
 */
import { compararGastos, destaqueDaComparacao, fatiasDoPeriodo, maiorCategoria } from '../../src/lib/comparacao'
import { situacoesDoMes } from '../../src/lib/contasFixas'
import { jurosEmbutidos, jurosQuePesam, parcelasDoMes, parcelasPorDia, situacaoDividas } from '../../src/lib/dividas'
import { regraDoAtraso } from '../../src/lib/jurosAtraso'
import { agruparTarefas, tarefasDoMes } from '../../src/lib/paraFazer'
import { comporPrevisao, diaADiaDoMes } from '../../src/lib/previsao'
import { situacaoDoMes } from '../../src/lib/situacaoDoMes'
import { adicionarCartao, cartoesDaInicio, linhasDaGrade, maisRecente, MODELOS, moverCartao, normCelular, removerCartao, TAMANHO, type ArrumacaoInicio } from '../../src/lib/widgets'
import { comParcelasDoMes } from '../../src/lib/useMesDaInicio'
import { montarCartao, ORCAMENTO, type TracosDaDivida } from '../../src/lib/cartaoDaDivida'
import type { SituacaoCartao } from '../../src/lib/cartoes'
import { atrasoDa, conselhosDoPlanejamento, custoDa, dicasDe, falta, montarPraMim, mudarParte, normPlanejamentos, placarDe, por, quadroDoMes, sobra, valerPartes } from '../../src/lib/planejamento'
import type { PagamentoPlanejado, Plano } from '../../src/lib/planejador'
import type { ContaFixa, Divida, Lancamento, SaldoDivida } from '../../src/lib/types'

// ---------- dados de mentira ----------
let seq = 0
const lanc = (data: string, tipo: 'entrada' | 'saida', valor: number, mais: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${++seq}`, ano: +data.slice(0, 4), mes: +data.slice(5, 7), tipo, descricao: `${tipo} ${seq}`, valor, data, ...mais,
})
const conta = (descricao: string, tipo: 'entrada' | 'saida', valor: number, dia: number, mais: Partial<ContaFixa> = {}): ContaFixa => ({
  id: `c${++seq}`, tipo, descricao, valor, categoria_id: null, banco_id: null, dia, inicio: '2026-01-01', fim: null, ativa: true, ...mais,
})
const nada = () => {}

// ---------- conferir ----------
class Falha extends Error {}
const perto = (nome: string, obtido: number | null | undefined, esperado: number, tolerancia = 0.005) => {
  if (obtido === null || obtido === undefined || !Number.isFinite(obtido) || Math.abs(obtido - esperado) > tolerancia) throw new Falha(`${nome}: esperava ${esperado}, deu ${obtido}`)
}
const igual = <T>(nome: string, obtido: T, esperado: T) => {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) throw new Falha(`${nome}: esperava ${JSON.stringify(esperado)}, deu ${JSON.stringify(obtido)}`)
}
const certo = (nome: string, condicao: unknown) => { if (!condicao) throw new Falha(nome) }

interface Caso { nome: string; rodar: () => void }

const HOJE = new Date(2026, 10, 14) // 14 de novembro de 2026
const base = { faturasPagas: [], comFaturas: true, taxas: {}, hoje: HOJE }

export const CASOS: Caso[] = [
  // ==================== situação do mês ====================
  {
    nome: 'conta nova / mês sem nada: sem dados, sem elogio',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 0, saiu: 0, vaiEntrar: 0, vaiSair: 0 })
      igual('estado', s.estado, 'sem_dados')
      igual('selo vazio', s.selo, '')
    },
  },
  {
    nome: 'até hoje sobrou, mas a previsão fecha negativa: crítico, nunca "caminho certo"',
    rodar() {
      // entrou 3.000, saiu 1.000; ainda vem 800 e vão sair 3.445,56 → 2.000 + 800 − 3.445,56 = −645,56
      const s = situacaoDoMes({ momento: 'atual', entrou: 3000, saiu: 1000, vaiEntrar: 800, vaiSair: 3445.56 })
      igual('estado', s.estado, 'critico')
      perto('previsto', s.previsto, -645.56)
      igual('motivo principal', s.motivos[0].id, 'previsto_negativo')
      certo('nenhum motivo favorável junto', !s.motivos.some((m) => m.peso === 'favoravel'))
    },
  },
  {
    nome: 'exemplo do pedido: 212,67 + 800 − 3.445,56 = −2.432,89',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 212.67, saiu: 0, vaiEntrar: 800, vaiSair: 3445.56 })
      perto('previsto', s.previsto, -2432.89)
      igual('estado', s.estado, 'critico')
    },
  },
  {
    nome: 'sobra prevista menor que 5% do que entra: atenção (mês apertado)',
    rodar() {
      // entra 6.850 no mês (0 + 6.850), sobra 160,70 → 2,3%
      const s = situacaoDoMes({ momento: 'atual', entrou: 0, saiu: 0, vaiEntrar: 6850, vaiSair: 6689.3 })
      igual('estado', s.estado, 'atencao')
      igual('motivo', s.motivos[0].id, 'margem_pequena')
    },
  },
  {
    nome: 'previsão positiva só com o salário atrasado: atenção (recebimento atrasado)',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 0, saiu: 1000, vaiEntrar: 6500, vaiSair: 1000, receberAtrasado: 6500 })
      // 0 − 1.000 + 6.500 − 1.000 = 4.500 (69%): sem o salário atrasado seria −2.000
      igual('estado', s.estado, 'atencao')
      certo('avisa o recebimento atrasado', s.motivos.some((m) => m.id === 'recebimento_atrasado'))
      certo('avisa que até hoje saiu mais', s.motivos.some((m) => m.id === 'negativo_ate_agora'))
    },
  },
  {
    nome: 'conta atrasada deixa um mês bom em atenção',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 5000, saiu: 1000, vaiEntrar: 0, vaiSair: 500, atrasadas: 2 })
      igual('estado', s.estado, 'atencao')
      igual('motivo', s.motivos[0].id, 'atrasadas')
    },
  },
  {
    nome: 'mês bom de verdade: favorável',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 5000, saiu: 1000, vaiEntrar: 0, vaiSair: 500 })
      igual('estado', s.estado, 'favoravel')
      perto('previsto', s.previsto, 3500)
    },
  },
  {
    nome: 'mês que acabou: no vermelho pelo que aconteceu, sem previsão',
    rodar() {
      const s = situacaoDoMes({ momento: 'passado', entrou: 2000, saiu: 2300, vaiEntrar: 0, vaiSair: 0 })
      igual('estado', s.estado, 'critico')
      igual('sem previsão', s.previsto, null)
      igual('motivo', s.motivos[0].id, 'resultado_negativo')
    },
  },
  {
    nome: 'mês que ainda não começou: sem dados (não julga)',
    rodar() {
      igual('estado', situacaoDoMes({ momento: 'futuro', entrou: 0, saiu: 0, vaiEntrar: 100, vaiSair: 900 }).estado, 'sem_dados')
    },
  },
  {
    nome: 'mês de hoje sem nenhuma entrada lançada nem prevista: atenção, não crítico',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 0, saiu: 1800, vaiEntrar: 0, vaiSair: 300 })
      igual('estado', s.estado, 'atencao')
      igual('motivo', s.motivos[0].id, 'sem_entradas')
    },
  },
  {
    nome: 'valores altos não perdem centavos',
    rodar() {
      const s = situacaoDoMes({ momento: 'atual', entrou: 12_345_678.91, saiu: 2_345_678.9, vaiEntrar: 0.01, vaiSair: 1_000_000 })
      perto('previsto', s.previsto, 9_000_000.02)
    },
  },

  // ==================== previsão e composição ====================
  {
    nome: 'composição: nada contado duas vezes e soma igual ao previsto',
    rodar() {
      const aluguel = conta('Aluguel', 'saida', 1800, 5)
      const luz = conta('Luz', 'saida', 200, 20)
      const salario = conta('Salário', 'entrada', 5000, 5)
      const lancs = [
        lanc('2026-11-05', 'saida', 1800, { conta_fixa_id: aluguel.id, descricao: 'Aluguel' }), // baixa do aluguel: já saiu
        lanc('2026-11-10', 'saida', 300, { descricao: 'Mercado' }), // já saiu
        lanc('2026-11-25', 'saida', 150, { descricao: 'Academia (agendado)' }), // data à frente: vem aí
        lanc('2026-11-20', 'saida', 400, { cartao_id: 'k1', descricao: 'Compra no cartão' }), // fatura de novembro em aberto
      ]
      const dd = diaADiaDoMes({ ...base, lancs, contas: [aluguel, luz, salario], ano: 2026, mes: 11 })
      perto('entrou', dd.entrou, 0)
      perto('saiu', dd.saiu, 2100)
      // luz 200 + academia 150 + cartão 400
      perto('vaiSair', dd.vaiSair, 750)
      perto('vaiEntrar (salário sem baixa)', dd.vaiEntrar, 5000)
      const c = comporPrevisao(dd)
      perto('total a pagar = vaiSair', c.totalPagar, dd.vaiSair)
      perto('total a receber = vaiEntrar', c.totalReceber, dd.vaiEntrar)
      perto('resultado', c.resultado, 0 - 2100 + 5000 - 750)
      certo('aluguel pago não aparece como pendente', !dd.pendentes.some((i) => i.descricao === 'Aluguel'))
      igual('grupos a pagar', c.pagar.map((g) => g.chave), ['conta', 'fatura:k1', 'lancamento'])
      perto('salário atrasado (era dia 5)', c.receberAtrasado, 5000)
    },
  },
  {
    nome: 'previsão: fatura já paga não é pendente, a compra vira "saiu"',
    rodar() {
      const lancs = [lanc('2026-11-10', 'saida', 400, { cartao_id: 'k1' })]
      const dd = diaADiaDoMes({ ...base, faturasPagas: [{ cartao_id: 'k1', ano: 2026, mes: 11 } as never], lancs, contas: [], ano: 2026, mes: 11 })
      perto('saiu', dd.saiu, 400)
      perto('vaiSair', dd.vaiSair, 0)
      igual('pendentes', dd.pendentes.length, 0)
    },
  },
  {
    nome: 'parcelas de dívida: lista nomeada e soma por dia dão o mesmo total, a atrasada cai em hoje',
    rodar() {
      const d: Divida = { id: 'd1', descricao: 'Empréstimo', valor_parcela: 500, inicio: '2026-09-10', total_parcelas: 6 }
      const saldos: SaldoDivida[] = [{ id: 's1', divida_id: 'd1', data: '2026-09-01', saldo: 3000 }]
      // pagou só a de setembro: outubro (10/10) está atrasada; novembro vence dia 10 (já passou: atrasada também)
      const sit = situacaoDividas([d], saldos, [{ id: 'p1', divida_id: 'd1', data: '2026-09-10', valor: 500, tipo: 'saida' }], 2026, 11, {}, '2026-11-14')
      const args = { situacao: sit, ano: 2026, mes: 11, dias: 30, hoje: 14, diaRef: '2026-11-14' }
      const lista = parcelasDoMes(args)
      igual('parcelas', lista.map((p) => p.n), [2, 3])
      certo('as duas atrasadas', lista.every((p) => p.atrasada))
      const porDia = parcelasPorDia(args)
      perto('mesmo total', porDia.reduce((t, n) => t + n, 0), lista.reduce((t, p) => t + p.valor, 0))
      perto('caem no dia de hoje', porDia[13], 1000)
      // num mês que ainda não começou, só a que vence nele (a atrasada já está no mês de hoje)
      const dez = parcelasDoMes({ ...args, mes: 12, dias: 31, hoje: 0, soDoMes: true })
      igual('dezembro', dez.map((p) => p.n), [4])
    },
  },

  {
    nome: 'empréstimo com juros já combinados: pegou 250 e devolve 270; em parcelas, a taxa da tabela Price',
    rodar() {
      const a = jurosEmbutidos(250, { total: 270, dias: 30 })
      perto('juros', a?.juros, 20)
      perto('8% sobre o que recebeu', a?.sobreRecebido, 0.08)
      perto('8% ao mês em 30 dias', a?.aoMes, 8)
      perto('em 15 dias, 16,64% ao mês', jurosEmbutidos(250, { total: 270, dias: 15 })?.aoMes, 16.64)
      igual('sem prazo, sem taxa ao mês', jurosEmbutidos(250, { total: 270, dias: null })?.aoMes, null)
      // R$ 1.000 em 12 × R$ 100: cerca de 2,92% ao mês
      perto('Price', jurosEmbutidos(1000, { parcela: 100, parcelas: 12 })?.aoMes, 2.92)
      igual('devolve o mesmo: sem juros', jurosEmbutidos(300, { total: 300, dias: 30 }), { juros: 0, sobreRecebido: 0, aoMes: 0 })
      igual('sem valor recebido', jurosEmbutidos(0, { total: 300, dias: 30 }), null)
    },
  },
  {
    nome: 'juros de atraso por dia: % ao dia (simples e composto) e valor fixo por dia, com multa',
    rodar() {
      const base: Divida = {
        id: 'z1', descricao: 'Zé', valor_parcela: 270, inicio: '2026-11-01', total_parcelas: 1,
        atraso_juros_mes: 5, atraso_periodo: 'dia', atraso_multa: 0, atraso_tipo: 'simples', atraso_base: 'parcela', conferido_em: '2026-10-01',
      }
      const saldos: SaldoDivida[] = [{ id: 'zs', divida_id: 'z1', data: '2026-10-01', saldo: 270 }]
      const juros = (d: Divida) => situacaoDividas([d], saldos, [], 2026, 11, {}, '2026-11-11')[0]
      // venceu 01/11, hoje 11/11: 10 dias
      perto('5% ao dia, 10 dias: 270 × 5% × 10', juros(base).jurosAtraso, 135)
      perto('1% ao dia, juros sobre juros', juros({ ...base, atraso_juros_mes: 1, atraso_tipo: 'composto' }).jurosAtraso, 28.25)
      perto('% ao mês continua como antes (30 dias = 1 mês)', juros({ ...base, atraso_periodo: 'mes', atraso_juros_mes: 30 }).jurosAtraso, 27)
      const fixo = { ...base, atraso_juros_mes: 0, atraso_reais_dia: 20 }
      perto('R$ 20 por dia, 10 dias', juros(fixo).jurosAtraso, 200)
      perto('com multa de 2%', juros({ ...fixo, atraso_multa: 2 }).jurosAtraso, 205.4)
      perto('falta pagar hoje', juros(fixo).restanteHoje, 470)
      // os juros contam desde a conferência, se ela for depois do vencimento
      perto('conferido em 06/11: 5 dias', juros({ ...fixo, conferido_em: '2026-11-06' }).jurosAtraso, 100)
      igual('regra por dia', regraDoAtraso(base), 'No atraso: 5% ao dia sobre cada parcela atrasada · conferido em 1 de out')
      igual('regra em reais', regraDoAtraso(fixo)?.replace(/\s/g, ' '), 'No atraso: R$ 20,00 por dia · conferido em 1 de out')
      // para os conselhos: o mesmo em % ao mês
      perto('5% ao dia pesam 150% ao mês', jurosQuePesam(juros(base)), 150)
      perto('R$ 20 por dia em R$ 270 pesam cerca de 222% ao mês', jurosQuePesam(juros(fixo)), 222.22)
    },
  },

  // ==================== comparação ====================
  {
    nome: 'comparação do mês correndo: mesmo intervalo do mês anterior',
    rodar() {
      const lancs = [
        lanc('2026-11-02', 'saida', 300, { categoria_id: 'mercado' }),
        lanc('2026-11-12', 'saida', 200, { categoria_id: 'transporte' }),
        lanc('2026-11-20', 'saida', 999, { categoria_id: 'mercado' }), // depois de hoje: fora
        lanc('2026-10-03', 'saida', 100, { categoria_id: 'mercado' }),
        lanc('2026-10-14', 'saida', 300, { categoria_id: 'transporte' }), // dia 14 entra (até o dia 14)
        lanc('2026-10-25', 'saida', 5000, { categoria_id: 'mercado' }), // depois do dia 14 de outubro: fora
      ]
      const c = compararGastos({ lancs, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: (l) => l.categoria_id ?? undefined })!
      igual('corte', [c.ateDia, c.ateDiaAnterior], [14, 14])
      perto('atual', c.atual, 500)
      perto('anterior', c.anterior, 400)
      perto('variação', c.variacao, 0.25)
      igual('maior alta', c.maiorAlta?.id, 'mercado')
      perto('alta de mercado', c.maiorAlta?.diferenca, 200)
      igual('maior queda', c.maiorQueda?.id, 'transporte')
      igual('lançamentos da alta', c.maiorAlta?.lancsAtual.map((l) => l.valor), [300])
    },
  },
  {
    nome: 'comparação: dia 31 contra mês de 30 dias corta no dia 30',
    rodar() {
      const lancs = [lanc('2026-12-31', 'saida', 10), lanc('2026-11-30', 'saida', 20)]
      const c = compararGastos({ lancs, ano: 2026, mes: 12, hoje: '2026-12-31', categoriaDe: () => undefined })!
      igual('corte', [c.ateDia, c.ateDiaAnterior], [31, 30])
      perto('anterior', c.anterior, 20)
    },
  },
  {
    nome: 'comparação: sem gasto no anterior não vira porcentagem; sem lançamento no anterior não compara',
    rodar() {
      const soEntrada = [lanc('2026-10-05', 'entrada', 1000), lanc('2026-11-05', 'saida', 120, { categoria_id: 'lazer' })]
      const c = compararGastos({ lancs: soEntrada, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: (l) => l.categoria_id ?? undefined })!
      igual('sem porcentagem', c.variacao, null)
      igual('tem base', c.semBase, false)
      const vazio = compararGastos({ lancs: [lanc('2026-11-05', 'saida', 120)], ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: () => undefined })!
      igual('sem base', vazio.semBase, true)
      igual('sem destaque', vazio.maiorAlta, null)
    },
  },
  {
    nome: 'comparação: janeiro olha dezembro do ano anterior; mês fechado compara inteiro; mês futuro não compara',
    rodar() {
      const lancs = [lanc('2026-01-20', 'saida', 100), lanc('2025-12-28', 'saida', 80)]
      const jan = compararGastos({ lancs, ano: 2026, mes: 1, hoje: '2026-11-14', categoriaDe: () => undefined })!
      igual('mês anterior', [jan.anoAnterior, jan.mesAnterior], [2025, 12])
      igual('inteiro', jan.ateDia, null)
      perto('anterior inteiro', jan.anterior, 80)
      igual('futuro', compararGastos({ lancs, ano: 2026, mes: 12, hoje: '2026-11-14', categoriaDe: () => undefined }), null)
    },
  },

  // ==================== contas: atrasadas, próximas, depois ====================
  {
    nome: 'fatura de outubro não entra em "próximos 7 dias": vai para atrasadas, com os dias',
    rodar() {
      const internet = conta('Internet', 'saida', 120, 9)
      const agua = conta('Água', 'saida', 90, 18)
      const iptu = conta('IPTU', 'saida', 300, 28)
      const contas = situacoesDoMes([internet, agua, iptu], [], 2026, 11, '2026-11-14')
      const cartao = {
        cartao: { id: 'k1', nome: 'Itaú' }, valor: 960, status: 'aberta', vencimento: '2026-11-20',
        atrasadas: [{ ano: 2026, mes: 10, valor: 1400, vencimento: '2026-10-27' }],
      } as unknown as SituacaoCartao
      const { lista } = tarefasDoMes({
        ano: 2026, mes: 11, contas, faturas: [cartao], dividas: [], diaRef: '2026-11-14', hoje: '2026-11-14',
        aoPagarConta: nada, aoPagarDivida: nada, aoVerCartoes: nada,
      })
      const g = agruparTarefas(lista, '2026-11-21')
      igual('atrasadas', g.atrasadas.map((t) => [t.titulo.includes('Itaú') ? 'fatura' : t.titulo, t.diasAtraso]), [['fatura', 18], ['Internet', 5]])
      igual('próximos 7 dias', g.proximas.map((t) => t.titulo.includes('Itaú') ? 'fatura' : t.titulo), ['Água', 'fatura'])
      igual('depois', g.depois.map((t) => t.titulo), ['IPTU'])
      igual('cada uma em um grupo só', g.atrasadas.length + g.proximas.length + g.depois.length, lista.length)
    },
  },
  {
    nome: 'conta paga não fica pendente',
    rodar() {
      const internet = conta('Internet', 'saida', 120, 9)
      const contas = situacoesDoMes([internet], [lanc('2026-11-09', 'saida', 120, { conta_fixa_id: internet.id })], 2026, 11, '2026-11-14')
      const { lista } = tarefasDoMes({
        ano: 2026, mes: 11, contas, faturas: [], dividas: [], diaRef: '2026-11-14', hoje: '2026-11-14',
        aoPagarConta: nada, aoPagarDivida: nada, aoVerCartoes: nada,
      })
      igual('nada a fazer', lista.length, 0)
    },
  },
  {
    nome: 'comparação: o destaque segue a direção do total; queda em "sem categoria" é reclassificação, não economia',
    rodar() {
      const cat = (l: Lancamento) => l.categoria_id ?? undefined
      const sobe = [lanc('2026-10-03', 'saida', 100, { categoria_id: 'mercado' }), lanc('2026-11-03', 'saida', 400, { categoria_id: 'mercado' }),
        lanc('2026-10-04', 'saida', 50, { categoria_id: 'lazer' }), lanc('2026-11-04', 'saida', 30, { categoria_id: 'lazer' })]
      const d1 = destaqueDaComparacao(compararGastos({ lancs: sobe, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: cat }))
      igual('alta', [d1?.tipo, d1?.id], ['alta', 'mercado'])
      perto('diferença', d1?.diferenca, 300)
      const cai = [lanc('2026-10-03', 'saida', 900), lanc('2026-11-03', 'saida', 100), lanc('2026-10-05', 'saida', 100, { categoria_id: 'lazer' }), lanc('2026-11-05', 'saida', 120, { categoria_id: 'lazer' })]
      const d2 = destaqueDaComparacao(compararGastos({ lancs: cai, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: cat }))
      igual('reclassificação', [d2?.tipo, d2?.id], ['reclassificacao', ''])
      const semBase = compararGastos({ lancs: [lanc('2026-11-03', 'saida', 100)], ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: cat })
      igual('sem base, sem destaque', destaqueDaComparacao(semBase), null)
    },
  },
  {
    nome: 'principais gastos: partes do mesmo total, demais categorias somam o resto',
    rodar() {
      const cat = (l: Lancamento) => l.categoria_id ?? undefined
      const lancs = [lanc('2026-10-03', 'saida', 10), ...[['a', 610], ['b', 200], ['c', 100], ['d', 60], ['e', 30]].map(([id, v]) => lanc('2026-11-03', 'saida', v as number, { categoria_id: id as string })),
        lanc('2026-11-20', 'saida', 999, { categoria_id: 'a' })]
      const f = fatiasDoPeriodo(compararGastos({ lancs, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: cat })!)
      igual('as 3 maiores', f.principais.map((x) => x.id), ['a', 'b', 'c'])
      perto('a é 61% do total (o lançamento do dia 20 ainda não aconteceu)', f.principais[0].parte, 0.61)
      igual('demais', [f.demais?.quantas, f.demais?.valor], [2, 90])
      perto('tudo soma 100%', f.principais.reduce((t, x) => t + x.parte, 0) + (f.demais?.parte ?? 0), 1)
    },
  },
  {
    nome: 'a frase da categoria que mais pesou: nome no meio da frase, sigla intacta, sem categoria e mês sem gastos',
    rodar() {
      const cat = (l: Lancamento) => l.categoria_id ?? undefined
      const comp = (lancs: Lancamento[]) => compararGastos({ lancs, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: cat })
      const cats = [{ id: 'm', nome: 'Moradia' }, { id: 'p', nome: 'PIX enviados' }]
      const a = maiorCategoria(comp([lanc('2026-10-03', 'saida', 10), lanc('2026-11-03', 'saida', 700, { categoria_id: 'm' }), lanc('2026-11-04', 'saida', 300, { categoria_id: 'p' })]), cats, 'novembro')
      igual('moradia', a, { id: 'm', frase: 'Em novembro, moradia concentra a maior parte das suas despesas.' })
      const b = maiorCategoria(comp([lanc('2026-11-03', 'saida', 900, { categoria_id: 'p' }), lanc('2026-11-04', 'saida', 100, { categoria_id: 'm' })]), cats, 'novembro')
      igual('sigla fica como está', b?.frase, 'Em novembro, PIX enviados concentra a maior parte das suas despesas.')
      const c = maiorCategoria(comp([lanc('2026-11-03', 'saida', 500)]), cats, 'novembro')
      igual('sem categoria', c?.frase, 'Em novembro, a maior parte das suas despesas está sem categoria.')
      igual('sem gastos, sem frase', maiorCategoria(comp([lanc('2026-11-03', 'entrada', 500)]), cats, 'novembro'), null)
      igual('sem comparação, sem frase', maiorCategoria(null, cats, 'novembro'), null)
    },
  },
  {
    nome: 'comparação: pagamento de fatura lançado como saída junto com compras no cartão avisa dupla contagem',
    rodar() {
      const lancs = [lanc('2026-10-03', 'saida', 100), lanc('2026-11-03', 'saida', 300, { cartao_id: 'k1' }),
        lanc('2026-11-10', 'saida', 300, { descricao: 'Pagamento fatura Nubank' })]
      igual('em dobro', compararGastos({ lancs, ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: () => undefined })!.faturaEmDobro, true)
      igual('sem cartão, não', compararGastos({ lancs: [lancs[0], lancs[2]], ano: 2026, mes: 11, hoje: '2026-11-14', categoriaDe: () => undefined })!.faturaEmDobro, false)
    },
  },

  // ==================== Início do celular ====================
  {
    nome: 'celular: pequenos vizinhos viram par, pequeno sem vizinho fica sozinho, ordem da lista mantida',
    rodar() {
      igual('linhas', linhasDaGrade(['entrou-saiu', 'gasto-dia', 'contas', 'nota', 'metas', 'comparacao']), [
        { tipo: 'par', ids: ['entrou-saiu', 'gasto-dia'] }, { tipo: 'grande', ids: ['contas'] }, { tipo: 'sozinho', ids: ['nota'] },
        { tipo: 'grande', ids: ['metas'] }, { tipo: 'sozinho', ids: ['comparacao'] },
      ])
      igual('três pequenos: par e sozinho', linhasDaGrade(['nota', 'gasto-dia', 'comparacao']).map((l) => l.tipo), ['par', 'sozinho'])
      igual('vazio', linhasDaGrade([]), [])
    },
  },
  {
    nome: 'celular: os modelos dos três jeitos só usam cartões que existem e não repetem',
    rodar() {
      for (const [jeito, ids] of Object.entries(MODELOS)) {
        certo(`${jeito}: todos existem`, ids.every((id) => id in TAMANHO))
        igual(`${jeito}: sem repetir`, new Set(ids).size, ids.length)
      }
      certo('simples mostra menos que o detalhado', MODELOS.simples.length < MODELOS.detalhado.length)
      // os três abrem igual: gráfico, resumo do mês, contas por data e últimos lançamentos
      for (const ids of Object.values(MODELOS)) igual('começo', ids.slice(0, 4), ['evolucao', 'resumo-mes', 'contas', 'ultimos'])
    },
  },
  {
    nome: 'celular e computador: sem parcela no mês, o dia a dia volta igual',
    rodar() {
      const dd = diaADiaDoMes({ ...base, lancs: [lanc('2026-11-03', 'saida', 100)], contas: [], ano: 2026, mes: 11 })
      igual('mesmo objeto', comParcelasDoMes(dd, { situacao: [], ano: 2026, mes: 11, diaRef: '2026-11-14' }) === dd, true)
    },
  },
  {
    nome: 'celular: sem arrumação, ou arrumada em outro jeito, vale o modelo do jeito',
    rodar() {
      igual('sem nada', cartoesDaInicio(undefined, 'simples'), MODELOS.simples)
      const outra: ArrumacaoInicio = { base: 'detalhado', ordem: ['metas'], removidos: [], em: '2026-11-16T10:00:00Z' }
      igual('outro jeito', cartoesDaInicio(outra, 'simples'), MODELOS.simples)
    },
  },
  {
    nome: 'celular: tirar, pôr de volta (no fim) e o tirado não volta sozinho',
    rodar() {
      const a = removerCartao(undefined, 'simples', 'ultimos', '1')
      igual('sem últimos', cartoesDaInicio(a, 'simples'), ['evolucao', 'resumo-mes', 'contas', 'orientacao', 'metas'])
      igual('lembra que tirou', a.removidos, ['ultimos'])
      const b = adicionarCartao(a, 'simples', 'ultimos', '2')
      igual('volta no fim', cartoesDaInicio(b, 'simples'), ['evolucao', 'resumo-mes', 'contas', 'orientacao', 'metas', 'ultimos'])
      igual('sai dos tirados', b.removidos, [])
      const c = adicionarCartao(b, 'simples', 'guardado', '3')
      igual('cartão de fora do modelo entra no fim', cartoesDaInicio(c, 'simples').at(-1), 'guardado')
    },
  },
  {
    nome: 'celular: subir e descer pulam os cartões escondidos; nas pontas não fazem nada',
    rodar() {
      // 'ultimos' escondido (sem nada para mostrar): descer 'contas' troca com 'orientacao', o próximo que está na tela
      const d = moverCartao(undefined, 'simples', 'contas', 1, ['contas', 'orientacao', 'metas'], '1')!
      igual('trocou com o visível', cartoesDaInicio(d, 'simples'), ['evolucao', 'resumo-mes', 'orientacao', 'ultimos', 'contas', 'metas'])
      igual('primeiro não sobe', moverCartao(undefined, 'simples', 'contas', -1, ['contas', 'metas'], '1'), null)
      igual('último não desce', moverCartao(undefined, 'simples', 'metas', 1, ['contas', 'metas'], '1'), null)
    },
  },
  {
    nome: 'celular: cartão novo do app entra junto do vizinho do modelo; id desconhecido e repetido somem',
    rodar() {
      // arrumação antiga, de quando o equilibrado não tinha 'categorias' (e com lixo de outra versão)
      const a = { base: 'equilibrado', ordem: ['metas', 'contas', 'gasto-mes', 'gasto-mes', 'cartao-que-nao-existe'], removidos: ['entrou-saiu', 'gasto-dia', 'orientacao', 'ultimos', 'dividas', 'guardado'], em: '1' } as unknown as ArrumacaoInicio
      // 'evolucao' e 'resumo-mes' (novos, no começo do modelo) entram antes de 'contas', o primeiro vizinho que a pessoa tem
      igual('categorias depois de gasto-mes', cartoesDaInicio(a, 'equilibrado'), ['metas', 'evolucao', 'resumo-mes', 'contas', 'gasto-mes', 'categorias'])
      const n = normCelular({ v: 1, inicio: a })!
      igual('normalizado', n.inicio!.ordem, ['metas', 'contas', 'gasto-mes'])
      igual('formato errado vira vazio', normCelular({ inicio: { base: 'outro', ordem: 3 } }), { v: 1 })
      igual('nada', normCelular(null), null)
    },
  },
  {
    nome: 'celular: entre o aparelho e o banco vale a arrumação mais recente',
    rodar() {
      const velha = { v: 1 as const, inicio: { base: 'simples' as const, ordem: [], removidos: [], em: '2026-11-16T10:00:00Z' } }
      const nova = { v: 1 as const, inicio: { ...velha.inicio, em: '2026-11-16T11:00:00Z' } }
      igual('banco mais novo', maisRecente(velha, nova) === nova, true)
      igual('aparelho mais novo', maisRecente(nova, velha) === nova, true)
      igual('só o banco', maisRecente(null, velha) === velha, true)
      igual('só o aparelho', maisRecente(velha, { v: 1 }) === velha, true)
    },
  },

  // ---------- cartão de cada dívida (lib/cartaoDaDivida.ts): cada tipo ganha o seu desenho ----------
  {
    nome: 'dívida: cada tipo ganha o destaque e as peças que servem a ele',
    rodar() {
      const base: TracosDaDivida = {
        recebe: false, quitada: false, restanteHoje: 1000, restante: 1000, inicial: 1000, pago: 0, parcelas: null, proxima: null,
        temData: false, vencido: null, jurosContrato: null, jurosAtraso: null, emprestimo: null, partes: [], quitacao: null,
        mesesRestantes: null, hoje: '2026-11-19',
      }
      const t = (x: Partial<TracosDaDivida>) => montarCartao({ ...base, ...x })
      const parcelas = (total: number, pagas: number, atrasadas = 0) => ({
        total, pagas, atrasadas, estados: Array.from({ length: total }, (_, i) => (i < pagas ? 'paga' : i < pagas + atrasadas ? 'atrasada' : 'aberta') as 'paga' | 'atrasada' | 'aberta'),
      })

      // valor único sem data (Facio): "paga quando puder", anel de progresso, nada de data
      const livre = t({})
      igual('sem data: peça livre', livre.pecas.includes('livre'), true)
      igual('sem data: sem próxima nem atraso', livre.pecas.some((p) => p === 'proxima' || p === 'atraso'), false)

      // valor único com data e no prazo (Agiota sem juros altos): a folhinha do dia, e a próxima não se repete
      const folhinha = t({ temData: true, proxima: { data: '2026-11-25', valor: 390 } })
      igual('data única: folhinha', folhinha.destaque, 'folhinha')
      igual('data única: sem repetir a próxima', folhinha.pecas.includes('proxima'), false)

      // juros do contrato altos (100% ao mês): a taxa no destaque e o "hoje × em 1 mês"
      const agiota = t({ temData: true, proxima: { data: '2026-11-25', valor: 390 }, jurosContrato: 100 })
      igual('agiota: taxa', agiota.destaque, 'taxa')
      igual('agiota: hoje × em 1 mês', agiota.pecas.includes('jurosContrato'), true)

      // atrasada sem nada pago (Inconveniência): dias de atraso no lugar de um anel em 0%
      const atrasada = t({ temData: true, vencido: { valor: 30, desde: '2026-11-10' } })
      igual('atrasada sem pagar: dias', atrasada.destaque, 'dias')
      igual('atrasada: peça do atraso', atrasada.pecas.includes('atraso'), true)

      // atrasada com juros de atraso (Cartão Nubank): as barrinhas subindo e o "Conferi com o banco"
      const juros = t({ temData: true, vencido: { valor: 720, desde: '2026-07-27' }, jurosAtraso: { total: 20, porDia: 0.06 } })
      igual('juros do atraso: peça', juros.pecas.includes('crescendo'), true)
      igual('juros do atraso: conferir', juros.conferir, true)

      // parcelada em dia, com parcelas pagas (Acordo Vivo): anel de fatias, próxima e quando termina; sem tracinhos repetidos
      const vivo = t({ temData: true, parcelas: parcelas(5, 3), pago: 600, proxima: { data: '2026-11-26', valor: 31 }, quitacao: [2027, 2], mesesRestantes: 3 })
      igual('parcelada: fatias', vivo.destaque, 'fatias')
      igual('parcelada: sem os tracinhos (as fatias já mostram)', vivo.pecas.includes('parcelas'), false)
      igual('parcelada: próxima', vivo.pecas.includes('proxima'), true)
      igual('parcelada: termina em', vivo.pecas.includes('chegada'), true)

      // parcelada toda atrasada, nada pago (Atlética, 15 de 15): dias e os tracinhos com a legenda
      const atletica = t({ temData: true, parcelas: parcelas(15, 0, 15), vencido: { valor: 478, desde: '2026-09-20' } })
      igual('parcelas atrasadas sem pagar: dias', atletica.destaque, 'dias')
      igual('parcelas atrasadas: tracinhos', atletica.pecas.includes('parcelas'), true)

      // feita de partes: a barra das partes
      igual('partes', t({ partes: [{ nome: 'Microfone', valor: 300 }, { nome: 'Mouse', valor: 120 }] }).pecas.includes('partes'), true)

      // empréstimo com o valor recebido: recebeu × devolve
      igual('empréstimo', t({ emprestimo: { recebido: 250, total: 270 } }).pecas.includes('emprestimo'), true)

      // quitada: festa e a linha de tudo pago, nada mais
      const quitada = t({ quitada: true, restante: 0, restanteHoje: 0, pago: 1000 })
      igual('quitada: festa', quitada.destaque, 'festa')
      igual('quitada: só a linha', quitada.pecas, ['quitada'])
      igual('quitada: sem conferir', quitada.conferir, false)

      // regras de montagem: nunca passa do espaço, nunca duas da mesma família
      const cheia = t({ temData: true, parcelas: parcelas(6, 1, 2), pago: 100, vencido: { valor: 50, desde: '2026-10-01' }, jurosContrato: 12,
        jurosAtraso: { total: 5, porDia: 0.2 }, emprestimo: { recebido: 800, total: 1000 }, partes: [{ nome: 'a', valor: 1 }, { nome: 'b', valor: 2 }] })
      const ALTURA: Record<string, number> = { crescendo: 2, jurosContrato: 2, emprestimo: 2, partes: 2 }
      certo('cabe no espaço', cheia.pecas.reduce((a, p) => a + (ALTURA[p] ?? 1), 0) <= ORCAMENTO)
      certo('uma de custo só', cheia.pecas.filter((p) => ['crescendo', 'jurosContrato', 'emprestimo'].includes(p)).length <= 1)
      igual('mesmos traços, mesmo cartão', JSON.stringify(cheia), JSON.stringify(t({ temData: true, parcelas: parcelas(6, 1, 2), pago: 100, vencido: { valor: 50, desde: '2026-10-01' }, jurosContrato: 12,
        jurosAtraso: { total: 5, porDia: 0.2 }, emprestimo: { recebido: 800, total: 1000 }, partes: [{ nome: 'a', valor: 1 }, { nome: 'b', valor: 2 }] })))
    },
  },
  {
    nome: 'planejamento do mês: fatiar cada entrada',
    rodar: () => {
      // hoje 19/11, R$ 300 na conta; Salário 3.200 no dia 20, Freela 800 no dia 25, Pensão 600 no dia 28 e um dinheiro de dezembro
      const pg = (descricao: string, valor: number, vence: string, mais: Partial<PagamentoPlanejado> = {}): PagamentoPlanejado => ({
        descricao, valor, vence, origem: 'conta', pagarEm: null, atraso: 0, custo: 0, taxaMes: 1, multa: 0.02, estimada: true, fonte: null, fonteData: null, ...mais,
      })
      const plano = {
        comSaldo: true,
        fontes: [
          { data: '2026-11-19', valor: 300, descricao: 'o saldo de hoje' }, { data: '2026-11-20', valor: 3200, descricao: 'Salário' },
          { data: '2026-11-25', valor: 800, descricao: 'Freela' }, { data: '2026-11-28', valor: 600, descricao: 'Pensão' },
          { data: '2026-12-05', valor: 3200, descricao: 'Salário' },
        ],
        pagamentos: [pg('Aluguel', 1400, '2026-11-22'), pg('Internet', 119.9, '2026-11-21'), pg('Luz', 180, '2026-11-30'), pg('Aluguel', 1400, '2026-12-22')],
        semDinheiro: [pg('Fatura do Nubank', 1170.73, '2026-11-10', { origem: 'cartao', taxaMes: 14 }), pg('Agiota', 500, '2026-11-24', { origem: 'parcela', taxaMes: 20, estimada: false })],
      } as unknown as Plano
      const q = quadroDoMes(plano, '2026-11-19', 'este', { metas: [{ id: 'm1', nome: 'Reserva' }], abertas: [{ nome: 'Cheque especial', saldo: 400, juros: 8 }] })
      igual('fontes do mês (com o saldo, sem dezembro)', q.fontes.map((f) => `${f.nome}:${f.valor}`), ['O que está na conta:300', 'Salário:3200', 'Freela:800', 'Pensão:600'])
      igual('contas do mês (atrasada entra, dezembro não)', q.destinos.filter((d) => d.tipo === 'conta').map((d) => d.nome), ['Fatura do Nubank', 'Internet', 'Aluguel', 'Agiota', 'Luz'])
      igual('nubank atrasada', q.destinos[0].atrasada, true)
      igual('dívida aberta e meta entram', q.destinos.filter((d) => d.tipo !== 'conta').map((d) => `${d.tipo}:${d.nome}`), ['divida:Cheque especial', 'meta:Reserva'])
      const proximo = quadroDoMes(plano, '2026-11-19', 'proximo')
      igual('mês que vem: só o de dezembro', proximo.fontes.map((f) => f.nome), ['Salário'])
      igual('mês que vem: aluguel de dezembro e o Guardar', proximo.destinos.map((d) => d.nome), ['Aluguel', 'Guardar'])

      const id = (nome: string) => q.destinos.find((d) => d.nome === nome)!.id
      const fid = (nome: string) => q.fontes.find((f) => f.nome === nome)!.id
      // pôr o aluguel no Freela: cabe 800 de 1.400 e atrasa 3 dias
      let r = por(q, [], id('Aluguel'), fid('Freela'))
      perto('coube só o que tinha', r.valor, 800)
      perto('falta do aluguel', falta(r.partes, q.destinos.find((d) => d.nome === 'Aluguel')!), 600)
      igual('atrasa 3 dias', atrasoDa(q, r.partes[0]), 3)
      perto('custo do atraso: 2% + 1% × 3/30', custoDa(q, r.partes[0]), 800 * 0.02 + 800 * 0.01 * 0.1, 0.01)
      // o resto no Salário (chega a tempo): conta fechada
      r = por(q, r.partes, id('Aluguel'), fid('Salário'))
      perto('o resto', r.valor, 600)
      perto('sobra do salário', sobra(r.partes, q.fontes[1]), 2600)
      // puxar a borda: Freela paga 500, não passa do máximo
      let partes = mudarParte(q, r.partes, fid('Freela'), id('Aluguel'), 500)
      perto('diminuiu', partes.find((p) => p.entrada === fid('Freela'))!.valor, 500)
      partes = mudarParte(q, partes, fid('Freela'), id('Aluguel'), 99999)
      perto('não passa do que falta', partes.find((p) => p.entrada === fid('Freela'))!.valor, 800)
      partes = mudarParte(q, partes, fid('Freela'), id('Aluguel'), 0)
      igual('zero tira a parte', partes.length, 1)

      // montar pra mim: Nubank (atrasada) e Agiota (20%) primeiro, cada conta com o dinheiro que chega a tempo
      const m = montarPraMim(q)
      const pl = placarDe(q, m)
      igual('tudo coberto', pl.pct, 100)
      igual('nada atrasa', pl.atrasos, 0)
      igual('fechado', pl.fechado, true)
      igual('nubank sai do saldo e do salário', m.filter((p) => p.conta === id('Fatura do Nubank')).map((p) => p.entrada), [fid('O que está na conta'), fid('Salário')])
      certo('internet sai de quem chega antes do dia 21', m.filter((p) => p.conta === id('Internet')).every((p) => p.entrada === fid('Salário') || p.entrada === fid('O que está na conta')))
      igual('o que sobra adianta a dívida cara', m.some((p) => p.conta === id('Cheque especial')), true)
      perto('o dinheiro todo tem destino', pl.semDestino, 0)

      // o plano guardado contra um quadro que mudou: a conta sumiu (foi paga), a parte sai; valor maior que o que falta encolhe
      const certas = valerPartes(q, [{ entrada: fid('Salário'), conta: 'c:2026-11-01:sumiu', valor: 100 }, { entrada: fid('Salário'), conta: id('Internet'), valor: 500 }])
      igual('valer: tira e encolhe', certas, [{ entrada: fid('Salário'), conta: id('Internet'), valor: 119.9 }])

      // dicas: sem plano, o convite; com atraso, o aviso e o atalho para quem chega a tempo
      const fmt = (n: number) => `R$ ${n.toFixed(2)}`, data = (iso: string) => iso.slice(8)
      igual('dica de começar', dicasDe(q, [], fmt, data).map((d) => d.id), ['comecar'])
      const comAtraso = por(q, [], id('Aluguel'), fid('Freela')).partes
      const ds = dicasDe(q, comAtraso, fmt, data)
      certo('dica do atraso', ds.some((d) => d.id === `atraso:${id('Aluguel')}` && d.acao?.entrada === fid('Salário')))
      certo('dica da atrasada cara primeiro', ds[0].tom === 'ruim')
      igual('fechado: a dica boa', dicasDe(q, m, fmt, data).map((d) => d.id), ['fechado'])

      // o Consultor lendo o plano
      igual('consultor sem plano: convite', conselhosDoPlanejamento(q, undefined, fmt, data).map((c) => c.id), ['planejar'])
      igual('consultor com atraso e falta', conselhosDoPlanejamento(q, { partes: comAtraso, em: '' }, fmt, data).map((c) => c.id), [`atraso:${id('Aluguel')}`, 'sem-dinheiro'])
      igual('consultor com plano fechado: nada', conselhosDoPlanejamento(q, { partes: m, em: '' }, fmt, data), [])

      // guardar: só o mês de hoje e o próximo, partes estranhas saem
      const n = normPlanejamentos({ '2026-10': { partes: [], em: 'x' }, '2026-11': { partes: [{ entrada: 'a', conta: 'b', valor: 10 }, { entrada: 1, conta: 'b', valor: 5 }, { entrada: 'a', conta: 'b', valor: -1 }], em: 'y' }, lixo: 3 }, '2026-11-19')
      igual('norm', n, { '2026-11': { em: 'y', partes: [{ entrada: 'a', conta: 'b', valor: 10 }] } })
    },
  },
  {
    nome: 'planejamento do mês: parcelas atrasadas da mesma dívida numa ficha só',
    rodar: () => {
      // a dívida do Mercado Pago feita de várias compras: 3 dias de vencimento atrasados (6 parcelas) e 1 deste mês
      const pg = (descricao: string, valor: number, vence: string, mais: Partial<PagamentoPlanejado> = {}): PagamentoPlanejado => ({
        descricao, valor, vence, origem: 'parcela', pagarEm: null, atraso: 0, custo: 0, taxaMes: 17.5, multa: 0.02, estimada: false, fonte: null, fonteData: null, ...mais,
      })
      const plano = {
        comSaldo: false,
        fontes: [{ data: '2026-11-20', valor: 1000, descricao: 'Salário' }],
        pagamentos: [],
        semDinheiro: [
          pg('Mercado Pago', 87.82, '2026-03-02', { grupo: 'mp', pecas: 2 }), pg('Mercado Pago', 189.04, '2026-03-30', { grupo: 'mp', pecas: 4 }),
          pg('Mercado Pago', 100, '2026-04-28', { grupo: 'mp', pecas: 1 }), pg('Mercado Pago', 50, '2026-11-28', { grupo: 'mp', pecas: 1 }),
          pg('Acordo Vivo', 31.04, '2026-10-26', { grupo: 'vivo', pecas: 1 }), pg('Aluguel', 900, '2026-11-22', { origem: 'conta' }),
        ],
      } as unknown as Plano
      const q = quadroDoMes(plano, '2026-11-19', 'este')
      const mp = q.destinos.filter((d) => d.nome === 'Mercado Pago')
      igual('mercado pago: a ficha das atrasadas e a deste mês', mp.length, 2)
      perto('a ficha soma as atrasadas', mp[0].valor, 376.86)
      igual('conta as parcelas de verdade', mp[0].juntas?.parcelas, 7)
      igual('desde a mais antiga', mp[0].vence, '2026-03-02')
      igual('atrasada', mp[0].atrasada, true)
      certo('vencimento médio entre a mais antiga e a mais nova', mp[0].juntas!.venceMedio > '2026-03-02' && mp[0].juntas!.venceMedio < '2026-04-28')
      igual('a deste mês fica separada', mp[1].juntas, undefined)
      igual('uma atrasada sozinha não vira grupo', q.destinos.find((d) => d.nome === 'Acordo Vivo')?.juntas, undefined)
      // pagar a ficha: entra o que cabe, uma vez só
      const r = por(q, [], mp[0].id, q.fontes[0].id)
      perto('paga a ficha inteira', r.valor, 376.86)
      certo('o custo conta do vencimento médio', custoDa(q, r.partes[0]) > 0)
    },
  },
]

export function rodar(filtro?: string): number {
  let falhas = 0
  const casos = CASOS.filter((c) => !filtro || c.nome.includes(filtro))
  for (const c of casos) {
    try {
      c.rodar()
      if (filtro) console.log(`✓ ${c.nome}`)
    } catch (e) {
      falhas++
      console.log(`✗ ${c.nome}\n    ${e instanceof Falha ? e.message : e instanceof Error ? e.stack : e}`)
    }
  }
  console.log(`\n${casos.length - falhas} de ${casos.length} casos certos`)
  return falhas
}
