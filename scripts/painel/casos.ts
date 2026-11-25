/**
 * Cenários de teste da Início (rodar: `node scripts/painel/testar.mjs`): a situação do mês, a previsão e a sua composição,
 * a comparação com o mês anterior e a separação das contas em atrasadas / próximas / depois. Os números esperados foram
 * feitos à mão, não tirados das próprias funções. Achou uma conta errada? Monte o caso aqui antes de consertar.
 */
import { compararGastos, destaqueDaComparacao, fatiasDoPeriodo, maiorCategoria } from '../../src/lib/comparacao'
import { situacoesDoMes } from '../../src/lib/contasFixas'
import { aReceberPrevisto, calendarioDe, jurosEmbutidos, jurosQuePesam, parcelasDoMes, parcelasPorDia, situacaoDividas } from '../../src/lib/dividas'
import { regraDoAtraso } from '../../src/lib/jurosAtraso'
import { agruparTarefas, tarefasDoMes } from '../../src/lib/paraFazer'
import { comporPrevisao, diaADiaDoMes } from '../../src/lib/previsao'
import { situacaoDoMes } from '../../src/lib/situacaoDoMes'
import { adicionarCartao, cartoesDaInicio, linhasDaGrade, maisRecente, MODELOS, moverCartao, normCelular, removerCartao, TAMANHO, type ArrumacaoInicio } from '../../src/lib/widgets'
import { comParcelasDoMes } from '../../src/lib/useMesDaInicio'
import { montarCartao, ORCAMENTO, type TracosDaDivida } from '../../src/lib/cartaoDaDivida'
import {
  contaNasSaidas, efeitoNaCaixinha, faturaDoMes, garantidoDo, limiteDoCartao, pularParcela, situacaoCartao, taxaParaPular, textoStatus, totalFaturasAPagar, voltarParcela,
  type SituacaoCartao,
} from '../../src/lib/cartoes'
import { ajustarMesesComEfeitos } from '../../src/lib/guardado'
import { fmtValor } from '../../src/lib/format'
import { previstosDoMes } from '../../src/lib/previstos'
import { pagoDaFatura } from '../../src/lib/cartoes'
import { previsaoDoAno } from '../../src/lib/previsao'
import { chaveDoMes, sobrasPorMes } from '../../src/lib/saldoCorrido'
import { atrasoDa, comExtras, comFeitos, irmaPaga, comGuardado, fotosDe, travada, conselhosDoPlanejamento, custoDa, dicasDe, falta, montarPraMim, mudarParte, normPlanejamentos, placarDe, por, quadroDoMes, sobra, valerPartes } from '../../src/lib/planejamento'
import { planejar, type PagamentoPlanejado, type Plano } from '../../src/lib/planejador'
import type { CartaoCredito, ContaFixa, Divida, FaturaParcial, Lancamento, Mes, SaldoDivida } from '../../src/lib/types'
import { aprenderJuros, descontoParaQuitar, pistaDaConferencia } from '../../src/lib/jurosAprendido'
import { historicoDaDivida } from '../../src/lib/conferencias'
import { compromissoDe, emDiasDeRenda, sinaisDe, type EntradaSinais } from '../../src/lib/sinais'
import { naHoraDaPromessa, naHoraDeParcelar, naHoraDePagarParte, naHoraDePular } from '../../src/lib/naHora'
import { lerPlano, type Quadro } from '../../src/lib/planejamento'
import type { Analise } from '../../src/lib/analise'
import type { ConferenciaDivida, PromessaDivida } from '../../src/lib/types'

// ---------- dados de mentira ----------
let seq = 0
const lanc = (data: string, tipo: 'entrada' | 'saida', valor: number, mais: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${++seq}`, ano: +data.slice(0, 4), mes: +data.slice(5, 7), tipo, descricao: `${tipo} ${seq}`, valor, data, ...mais,
})
const conta = (descricao: string, tipo: 'entrada' | 'saida', valor: number, dia: number, mais: Partial<ContaFixa> = {}): ContaFixa => ({
  id: `c${++seq}`, tipo, descricao, valor, categoria_id: null, banco_id: null, dia, inicio: '2026-01-01', fim: null, ativa: true, ...mais,
})
const nada = () => {}
/** Cartão de mentira no jeito do PicPay: fecha dia 25, vence dia 5, limite de 1.000, garantido ligado à caixinha do banco b1. */
const PICPAY: CartaoCredito = {
  id: 'pp', nome: 'PicPay', cor: '#21c25e', banco_id: 'b1', limite: 1000, dia_fechamento: 25, dia_vencimento: 5, ativo: true,
  limite_garantido: 0, garantia_caixinha: true,
}
const compra = (venc: string, valor: number, mais: Partial<Lancamento> = {}) => lanc(venc, 'saida', valor, { cartao_id: 'pp', data_compra: venc, ...mais })
const parcial = (ano: number, mes: number, valor: number, pago_em: string, mais: Partial<FaturaParcial> = {}): FaturaParcial => ({
  id: `p${++seq}`, cartao_id: 'pp', ano, mes, valor, pago_em, banco_id: 'b1', da_caixinha: false, saldo_mexido: false, ...mais,
})

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

  // ==================== cartão: pular compra, pagar parte, pagar com o cofrinho ====================
  {
    nome: 'cartão: pular compra tira 100 da fatura de 800 e põe na próxima; voltar desfaz',
    rodar() {
      const a = compra('2026-12-05', 700, { descricao: 'Mercado' })
      const b = compra('2026-12-05', 100, { descricao: 'Tênis' })
      const patch = pularParcela(b, PICPAY)
      igual('vai para janeiro, no vencimento dela, lembrando de onde saiu', patch, { ano: 2027, mes: 1, data: '2027-01-05', pulada_de: '2026-12-05' })
      const pulada = { ...b, ...patch }
      const dez = faturaDoMes(PICPAY, [a, pulada], [], 2026, 12, '2026-11-14')
      const jan = faturaDoMes(PICPAY, [a, pulada], [], 2027, 1, '2026-11-14')
      perto('dezembro fica com 700', dez.valor, 700)
      perto('janeiro ganha os 100', jan.valor, 100)
      igual('dezembro sabe o que pulou', dez.puladas.map((l) => l.descricao), ['Tênis'])
      igual('janeiro não acha que pulou dele', jan.puladas.length, 0)
      // pular de novo (de janeiro para fevereiro): continua lembrando de dezembro, e voltar leva direto para lá
      const deNovo = { ...pulada, ...pularParcela(pulada, PICPAY) }
      igual('pulou de novo', [deNovo.ano, deNovo.mes, deNovo.pulada_de], [2027, 2, '2026-12-05'])
      igual('voltar', voltarParcela(deNovo), { ano: 2026, mes: 12, data: '2026-12-05', pulada_de: null })
      igual('compra que não pulou não volta', voltarParcela(a), null)
      // a taxa do banco para pular entra como compra à vista na fatura seguinte
      const t = taxaParaPular(PICPAY, { ano: 2026, mes: 12 }, 4.9, '2026-11-14')
      igual('taxa na fatura de janeiro', [t.ano, t.mes, t.data, t.valor, t.parcelas, t.cartao_id], [2027, 1, '2027-01-05', 4.9, 1, 'pp'])
    },
  },
  {
    nome: 'cartão: pular uma parcela só muda aquela parcela; as outras ficam onde estão',
    rodar() {
      const ps = ['2026-11-05', '2026-12-05', '2027-01-05'].map((d, i) => compra(d, 100, { compra_id: 'fone', parcela: i + 1, parcelas: 3, data_compra: '2026-10-20' }))
      const movida = ps.map((l) => (l.parcela === 2 ? { ...l, ...pularParcela(l, PICPAY) } : l))
      igual('valores por fatura', [[2026, 11], [2026, 12], [2027, 1], [2027, 2]].map(([a, m]) => faturaDoMes(PICPAY, movida, [], a, m, '2026-11-14').valor), [100, 0, 200, 0])
      igual('a 3ª continua a 3ª', movida.filter((l) => l.mes === 1).map((l) => l.parcela).sort(), [2, 3])
    },
  },
  {
    nome: 'cartão: pagar parte deixa a fatura em aberto pelo que falta (status, limite e "falta pagar")',
    rodar() {
      const lancs = [compra('2026-12-05', 800)]
      const ps = [parcial(2026, 12, 300, '2026-11-10')]
      const s = situacaoCartao(PICPAY, lancs, [], 2026, 12, '2026-11-14', 0, ps)
      perto('pago em parte', s.pagoEmParte, 300)
      perto('falta', s.falta, 500)
      igual('continua aberta', s.status, 'aberta')
      igual('o selo diz quanto falta', textoStatus(s), `Faltam ${fmtValor(500)} · vence em 21 dias`)
      perto('limite usado só pelo que falta', s.limiteUsado, 500)
      perto('falta pagar no topo', totalFaturasAPagar([s]), 500)
      // sem o pagamento de parte, tudo como antes
      const antes = situacaoCartao(PICPAY, lancs, [], 2026, 12, '2026-11-14', 0)
      perto('sem parte: falta tudo', antes.falta, 800)
      perto('sem parte: limite usado inteiro', antes.limiteUsado, 800)
    },
  },
  {
    nome: 'cartão: fatura vencida paga em parte continua atrasada pelo resto; coberta, não fica atrasada',
    rodar() {
      const lancs = [compra('2026-10-05', 400)]
      const metade = faturaDoMes(PICPAY, lancs, [], 2026, 10, '2026-11-14', [parcial(2026, 10, 100, '2026-10-05')])
      igual('atrasada', metade.status, 'atrasada')
      perto('pelo resto', metade.falta, 300)
      perto('o limite conta o resto', limiteDoCartao(PICPAY, lancs, [], '2026-11-14', 0, [parcial(2026, 10, 100, '2026-10-05')]).usado, 300)
      const coberta = faturaDoMes(PICPAY, lancs, [], 2026, 10, '2026-11-14', [parcial(2026, 10, 400, '2026-10-05')])
      igual('coberta: não fica atrasada', coberta.status, 'fechada')
      perto('nada falta', coberta.falta, 0)
      // pagamento de outra fatura (ou de outro cartão) não entra
      const outra = faturaDoMes(PICPAY, lancs, [], 2026, 10, '2026-11-14', [parcial(2026, 9, 100, '2026-09-05'), { ...parcial(2026, 10, 100, '2026-10-05'), cartao_id: 'outro' }])
      perto('só os desta fatura', outra.falta, 400)
    },
  },
  {
    nome: 'cartão: pagar com o cofrinho tira da caixinha no mês do pagamento, e o limite garantido diminui junto',
    rodar() {
      const pago = { valor: 100, pago_em: '2026-11-10', banco_id: 'b1', da_caixinha: true, saldo_mexido: true }
      igual('tira', efeitoNaCaixinha(pago), [{ ano: 2026, mes: 11, efeitos: [{ banco: 'b1', tipo: 'caixinha', delta: -100 }] }])
      igual('desfazer devolve', efeitoNaCaixinha(pago, -1), [{ ano: 2026, mes: 11, efeitos: [{ banco: 'b1', tipo: 'caixinha', delta: 100 }] }])
      igual('da conta: não mexe na caixinha', efeitoNaCaixinha({ ...pago, da_caixinha: false }), [])
      igual('o app não mexeu: desfazer não devolve nada', efeitoNaCaixinha({ ...pago, saldo_mexido: false }, -1), [])
      igual('sem banco: nada', efeitoNaCaixinha({ ...pago, banco_id: null }), [])
      const meses: Mes[] = [{ ano: 2026, mes: 11, investimentos: 0, moedas: {}, meta_usd: 0, caixa: { b1: { cc: 50, caixinha: 300 } } }]
      const r = ajustarMesesComEfeitos(meses, efeitoNaCaixinha(pago), HOJE)
      const nov = r.meses.find((m) => m.ano === 2026 && m.mes === 11)!
      igual('caixinha 300 → 200, conta igual', nov.caixa.b1, { cc: 50, caixinha: 200 })
      perto('limite garantido acompanha a caixinha', garantidoDo(PICPAY, nov.caixa.b1?.caixinha), 200)
    },
  },
  {
    nome: 'cartão: compra que outra pessoa paga fica na fatura e no limite, fora dos seus gastos',
    rodar() {
      const prime = compra('2026-12-05', 19.9, { descricao: 'Amazon Prime', pago_por: 'Mãe' })
      const lancs = [compra('2026-12-05', 300, { descricao: 'Mercado' }), prime, compra('2026-12-05', 10, { pago_por: '  ' })]
      const f = faturaDoMes(PICPAY, lancs, [], 2026, 12, '2026-11-14')
      perto('a fatura do banco tem tudo', f.valor, 329.9)
      igual('de quem é', f.deOutros, [{ nome: 'Mãe', valor: 19.9 }])
      perto('o limite usa tudo', limiteDoCartao(PICPAY, lancs, [], '2026-11-14', 0).usado, 329.9)
      const conta = contaNasSaidas([])
      igual('nos seus gastos, só as suas (nome em branco é você)', lancs.filter(conta).map((l) => l.valor), [300, 10])
      // o mês: entra 3.000, a fatura é de 329,90 mas 19,90 é da mãe → sobra 3.000 − 310
      const mes = [lanc('2026-12-02', 'entrada', 3000), ...lancs]
      perto('sobra do mês', sobrasPorMes(mes, []).get(chaveDoMes(2026, 12)), 2690)
      const dd = diaADiaDoMes({ ...base, lancs: mes.filter(conta), contas: [], ano: 2026, mes: 12 })
      perto('a previsão não espera os 19,90', dd.vaiSair, 310)
    },
  },
  {
    nome: 'previsão: fatura paga em parte sai do "vem aí" e entra no "já saiu" (nada conta duas vezes)',
    rodar() {
      const lancs = [compra('2026-11-20', 800), lanc('2026-11-02', 'entrada', 3000)]
      const ps = [parcial(2026, 11, 300, '2026-11-10')]
      const dd = diaADiaDoMes({ ...base, lancs, faturasParciais: ps, contas: [], ano: 2026, mes: 11 })
      perto('já saiu', dd.saiu, 300)
      perto('vem aí', dd.vaiSair, 500)
      perto('saiu no dia do pagamento', dd.saiuDia[9], 300)
      const comp = comporPrevisao(dd)
      perto('fatura no "a pagar"', comp.totalPagar, 500)
      perto('resultado: 3.000 − 800', comp.resultado, 2200)
      const ano = previsaoDoAno({ ...base, lancs, faturasParciais: ps, contas: [], ano: 2026 })[10]
      igual('ano: saiu e vai sair', [ano.saiu, ano.vaiSair], [300, 500])
      // compra pulada depois do pagamento de parte: o "vem aí" não fica negativo
      const pouco = diaADiaDoMes({ ...base, lancs: [compra('2026-11-20', 200)], faturasParciais: ps, contas: [], ano: 2026, mes: 11 })
      igual('limitado ao que está em aberto', [pouco.saiu, pouco.vaiSair], [200, 0])
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
        cartao: { id: 'k1', nome: 'Itaú' }, valor: 960, falta: 960, status: 'aberta', vencimento: '2026-11-20',
        atrasadas: [{ ano: 2026, mes: 10, valor: 1400, falta: 1400, vencimento: '2026-10-27' }],
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
  {
    nome: 'planejamento do mês: usar o dinheiro guardado',
    rodar: () => {
      // R$ 1.000 de salário no dia 20 e R$ 1.500 de contas; R$ 2.000 na caixinha do Nubank e R$ 300 investidos
      const pg = (descricao: string, valor: number, vence: string, mais: Partial<PagamentoPlanejado> = {}): PagamentoPlanejado => ({
        descricao, valor, vence, origem: 'conta', pagarEm: null, atraso: 0, custo: 0, taxaMes: 1, multa: 0.02, estimada: true, fonte: null, fonteData: null, ...mais,
      })
      const plano = {
        comSaldo: false,
        fontes: [{ data: '2026-11-20', valor: 1000, descricao: 'Salário' }],
        pagamentos: [pg('Aluguel', 900, '2026-11-22')],
        semDinheiro: [pg('Luz', 200, '2026-11-25'), pg('Fatura', 400, '2026-11-26', { origem: 'cartao', taxaMes: 14 })],
      } as unknown as Plano
      const guardados = [{ id: 'nu', nome: 'Guardado: Nubank', valor: 2000 }, { id: 'investimentos', nome: 'Investimentos', valor: 300 }, { id: 'vazio', nome: 'x', valor: 0 }]
      const q = quadroDoMes(plano, '2026-11-19', 'este', { metas: [{ id: 'm1', nome: 'Viagem' }], abertas: [{ nome: 'Cheque especial', saldo: 1000, juros: 8 }], guardados })
      igual('guardado fica fora das entradas', q.fontes.map((f) => f.nome), ['Salário'])
      igual('os lugares com dinheiro guardado', q.guardados.map((f) => `${f.nome}:${f.valor}`), ['Guardado: Nubank:2000', 'Investimentos:300'])
      igual('mês que vem: sem guardado (seria contado duas vezes)', quadroDoMes(plano, '2026-11-19', 'proximo', { guardados }).guardados, [])

      // desligado: o dinheiro acaba e a dica oferece usar o guardado
      const fmt = (n: number) => `R$ ${n.toFixed(2)}`, data = (iso: string) => iso.slice(8)
      const sem = montarPraMim(q)
      const plSem = placarDe(q, sem)
      certo('sem o guardado falta dinheiro', plSem.pct < 100)
      igual('sem o guardado não tira nada dele', plSem.doGuardado, 0)
      const dicaUsar = dicasDe(q, sem, fmt, data).find((d) => d.id === 'usar-guardado')
      certo('dica de usar o guardado', !!dicaUsar && !!dicaUsar.acao && 'usarGuardado' in dicaUsar.acao)

      // ligado: paga o que falta com o guardado, nada a mais
      const qg = comGuardado(q, true)
      igual('ligado: as barras do guardado entram', qg.fontes.map((f) => f.nome), ['Salário', 'Guardado: Nubank', 'Investimentos'])
      igual('ligar duas vezes não duplica', comGuardado(qg, true).fontes.length, 3)
      igual('desligar tira', comGuardado(qg, false).fontes.map((f) => f.nome), ['Salário'])
      const m = montarPraMim(qg)
      const pl = placarDe(qg, m)
      igual('tudo coberto com o guardado', pl.pct, 100)
      perto('tira só o que falta das contas (1.500 − 1.000)', pl.doGuardado, 500)
      certo('guardado não adianta dívida nem vai para meta', m.filter((p) => p.entrada.startsWith('g:')).every((p) => qg.destinos.find((d) => d.id === p.conta)!.tipo === 'conta'))
      perto('guardado que sobra não conta como sem destino', pl.semDestino, 0)
      certo('dica: o plano tira do guardado', dicasDe(qg, m, fmt, data).some((d) => d.id === 'tirou-do-guardado'))

      // guardado não vai para meta, nem à mão
      const meta = qg.destinos.find((d) => d.tipo === 'meta')!
      igual('pôr meta no guardado: não entra', por(qg, [], meta.id, qg.guardados[0].id).valor, 0)
      // mas pode adiantar dívida à mão
      const cheque = qg.destinos.find((d) => d.tipo === 'divida')!
      perto('adiantar dívida com o guardado à mão', por(qg, [], cheque.id, qg.guardados[0].id).valor, 1000)

      // o plano guardado lembra a escolha; o Consultor lê o plano com o guardado
      const n = normPlanejamentos({ '2026-11': { partes: m, em: 'z', comGuardado: true }, '2026-12': { partes: [], em: 'w', comGuardado: 'sim' } }, '2026-11-19')
      igual('norm guarda a escolha', [n['2026-11'].comGuardado, n['2026-12'].comGuardado], [true, undefined])
      igual('consultor: plano com o guardado fechado', conselhosDoPlanejamento(q, { partes: m, em: '', comGuardado: true }, fmt, data), [])
      certo('consultor: sem a escolha, as partes do guardado não valem', conselhosDoPlanejamento(q, { partes: m, em: '' }, fmt, data).some((c) => c.id === 'sem-dinheiro'))
    },
  },

  {
    nome: 'planejamento do mês: a entrada que cai hoje continua no plano',
    rodar: () => {
      // meia-noite do dia 25: a pensão do dia 25 ainda não caiu (senão estaria lançada e não viria como prevista)
      const pl = planejar({
        hoje: '2026-11-25', fim: '2026-12-31', saldoInicial: 100, ritmoDia: 0, porDiaDoMes: null, gastouHoje: 0, abertas: [],
        entradas: [{ data: '2026-11-25', valor: 800, descricao: 'Pensão' }, { data: '2026-11-24', valor: 50, descricao: 'Velha' }],
        compromissos: [{ descricao: 'Fatura', valor: 187.08, vence: '2026-11-25', origem: 'cartao', jurosMes: null }],
      })
      igual('o saldo e a pensão de hoje são entradas', pl.fontes.map((f) => f.descricao), ['o saldo de hoje', 'Pensão'])
      const q = quadroDoMes(pl, '2026-11-25', 'este')
      igual('a mesa mostra a pensão', q.fontes.map((f) => f.nome), ['O que está na conta', 'Pensão'])
      igual('a fatura de hoje não fica sem dinheiro', pl.semDinheiro.length, 0)
    },
  },
  {
    nome: 'planejamento do mês: o que já aconteceu fica travado',
    rodar: () => {
      const hoje = '2026-11-25'
      const pg = (descricao: string, valor: number, vence: string): PagamentoPlanejado => ({
        descricao, valor, vence, origem: 'conta', pagarEm: null, atraso: 0, custo: 0, taxaMes: 1, multa: 0.02, estimada: true, fonte: null, fonteData: null,
      })
      const fmt = (n: number) => `R$ ${n.toFixed(2)}`, data = (iso: string) => iso.slice(8)
      // antes: a pensão (800, dia 25) paga a fatura (187,08) e o agiota (390); o freela (300, dia 28) paga a luz (200)
      const antes = {
        comSaldo: false, fontes: [{ data: hoje, valor: 800, descricao: 'Pensão' }, { data: '2026-11-28', valor: 300, descricao: 'Freela' }],
        pagamentos: [pg('Fatura', 187.08, hoje), pg('Agiota', 390, hoje), pg('Luz', 200, '2026-11-29')], semDinheiro: [],
      } as unknown as Plano
      const q0 = quadroDoMes(antes, hoje, 'este', { metas: [{ id: 'm1', nome: 'Viagem' }] })
      const id = (nome: string) => q0.fontes.find((f) => f.nome === nome)?.id ?? q0.destinos.find((d) => d.nome === nome)!.id
      const partes = [
        { entrada: id('Pensão'), conta: id('Fatura'), valor: 187.08 }, { entrada: id('Pensão'), conta: id('Agiota'), valor: 390 },
        { entrada: id('Freela'), conta: id('Luz'), valor: 200 },
      ]
      const salvo = { partes, em: 'x', fotos: fotosDe(q0, partes) }
      igual('as fotos guardam só o que tem fatia', [Object.keys(salvo.fotos.fontes).length, Object.keys(salvo.fotos.destinos).length], [2, 3])
      igual('norm guarda as fotos', normPlanejamentos({ '2026-11': salvo }, hoje)['2026-11'].fotos, salvo.fotos)

      // depois: a pensão foi lançada (caiu) e a fatura foi paga; o planejador não as prevê mais
      const depois = {
        comSaldo: false, fontes: [{ data: '2026-11-28', valor: 300, descricao: 'Freela' }],
        pagamentos: [pg('Agiota', 390, hoje), pg('Luz', 200, '2026-11-29')], semDinheiro: [],
      } as unknown as Plano
      const q = comFeitos(quadroDoMes(depois, hoje, 'este', { metas: [{ id: 'm1', nome: 'Viagem' }] }), salvo)
      const pensao = q.fontes.find((f) => f.nome === 'Pensão')!, fatura = q.destinos.find((d) => d.nome === 'Fatura')!
      certo('a pensão continua, como já caiu', !!pensao?.feito)
      certo('a fatura continua, como paga', !!fatura?.feito)
      const certas = valerPartes(q, partes)
      igual('nenhuma fatia some', certas.length, 3)
      certo('a fatia da fatura paga fica travada', travada(q, certas[0]) && mudarParte(q, certas, certas[0].entrada, certas[0].conta, 10) === certas)
      igual('na entrada que caiu não entra conta nova', por(q, certas, 'm:m1', pensao.id).valor, 0)
      igual('nem na conta paga', por(q, certas, fatura.id, id('Freela')).valor, 0)
      const re = montarPraMim(q, certas)
      certo('Montar pra mim mantém o que já aconteceu', re.some((p) => p.conta === fatura.id && p.valor === 187.08) && re.some((p) => p.entrada === pensao.id && p.conta === id('Agiota')))
      const pl = placarDe(q, certas)
      igual('placar: tudo coberto (a paga conta como coberta)', [pl.pct, pl.fechado], [100, true])
      perto('a sobra da pensão que já caiu não é "sem destino"', pl.semDestino, 100)
      igual('sem plano salvo, nada volta', comFeitos(quadroDoMes(depois, hoje, 'este'), undefined).fontes.length, 1)
      const l = lerPlano(q, salvo)!
      igual('o próximo passo do Consultor é o freela (a pensão já caiu)', l.proximo!.fonte.nome, 'Freela')
      igual('consultor: nada a reclamar', conselhosDoPlanejamento(quadroDoMes(depois, hoje, 'este', { metas: [{ id: 'm1', nome: 'Viagem' }] }), salvo, fmt, data), [])
    },
  },
  {
    nome: 'planejamento do mês: conta paga em parte fica travada na parte paga',
    rodar: () => {
      const hoje = '2026-11-20'
      const pg = (descricao: string, valor: number, vence: string, origem = 'cartao'): PagamentoPlanejado => ({
        descricao, valor, vence, origem, pagarEm: null, atraso: 0, custo: 0, taxaMes: 1, multa: 0.02, estimada: true, fonte: null, fonteData: null,
      } as PagamentoPlanejado)
      const fontes = [{ data: hoje, valor: 500, descricao: 'Pix' }, { data: '2026-11-25', valor: 800, descricao: 'Pensão' }]
      const plano = (fatura: number) => ({ comSaldo: false, fontes, pagamentos: [pg('Fatura do PicPay', fatura, '2026-11-25')], semDinheiro: [] } as unknown as Plano)
      // o plano: a fatura de 655,28 sai 400 do Pix (dia 20) e 255,28 da pensão (dia 25)
      const q0 = quadroDoMes(plano(655.28), hoje, 'este')
      const fat = q0.destinos.find((d) => d.nome === 'Fatura do PicPay')!.id
      const [pix, pensao] = q0.fontes.map((f) => f.id)
      const partes = [{ entrada: pensao, conta: fat, valor: 255.28 }, { entrada: pix, conta: fat, valor: 400 }]
      const salvo = { partes, em: 'x', fotos: fotosDe(q0, partes) }

      // pagou 468,20 em parte: a fatura passa a prever só 187,08
      const q = comFeitos(quadroDoMes(plano(187.08), hoje, 'este'), salvo)
      const irma = q.destinos.find((d) => d.id === irmaPaga(fat))!
      certo('a parte paga vira uma ficha travada', !!irma?.feito)
      perto('com o valor pago', irma.valor!, 468.2)
      const certas = valerPartes(q, partes)
      const de = (entrada: string, conta: string) => certas.find((p) => p.entrada === entrada && p.conta === conta)?.valor ?? 0
      perto('o Pix (que cai antes) vai todo para a parte paga', de(pix, irma.id), 400)
      perto('a pensão completa a parte paga', de(pensao, irma.id), 68.2)
      perto('e o resto da pensão fica na fatura, solto', de(pensao, fat), 187.08)
      certo('a parte paga não muda', travada(q, { entrada: pensao, conta: irma.id, valor: 68.2 }) && mudarParte(q, certas, pensao, irma.id, 0) === certas)
      certo('a parte solta muda', mudarParte(q, certas, pensao, fat, 100) !== certas)
      igual('placar: tudo coberto', placarDe(q, certas).pct, 100)

      // salvar de novo e pagar mais 87,08: a parte paga cresce, sem duplicar
      const salvo2 = { partes: certas, em: 'y', fotos: fotosDe(q, certas) }
      const q2 = comFeitos(quadroDoMes(plano(100), hoje, 'este'), salvo2)
      igual('uma ficha paga só', q2.destinos.filter((d) => d.id === irmaPaga(fat)).length, 1)
      perto('que agora tem 555,28', q2.destinos.find((d) => d.id === irmaPaga(fat))!.valor!, 555.28)
      perto('e a fatura solta fica com 100', valerPartes(q2, certas).filter((p) => p.conta === fat).reduce((s, p) => s + p.valor, 0), 100)

      // pagou tudo: a fatura some e a ficha original volta como paga, junto com a irmã
      const q3 = comFeitos(quadroDoMes({ comSaldo: false, fontes, pagamentos: [], semDinheiro: [] } as unknown as Plano, hoje, 'este'), salvo2)
      igual('paga inteira: as duas fichas pagas', q3.destinos.filter((d) => d.feito).map((d) => d.id).sort(), [fat, irmaPaga(fat)].sort())
      igual('e nada fica sem dinheiro', placarDe(q3, valerPartes(q3, certas)).pct, 100)
    },
  },
  {
    nome: 'fatura paga em parte: o dia a dia e o aviso mostram só o que falta',
    rodar: () => {
      const cartao = { id: 'pp', nome: 'PicPay' } as unknown as CartaoCredito
      const fatura = { cartao, ano: 2026, mes: 11, valor: 655.28, pagoEmParte: 468.2, falta: 187.08, paga: null, vencimento: '2026-11-25' }
      const prev = previstosDoMes({ ano: 2026, mes: 11, contas: [], dividas: [], faturas: [fatura as never], diaRef: '2026-11-25', hoje: '2026-11-25' })
      igual('no dia 25, sai só o que falta', [...prev.values()].flat().map((p) => p.valor), [187.08])
      const quitada = previstosDoMes({ ano: 2026, mes: 11, contas: [], dividas: [], faturas: [{ ...fatura, pagoEmParte: 655.28, falta: 0 } as never], diaRef: '2026-11-25', hoje: '2026-11-25' })
      igual('paga toda em partes, nada sai', [...quitada.values()].flat().length, 0)
      certo('o aviso diz quanto já pagou e quanto falta', /468,20.*187,08/.test(pagoDaFatura([fatura])))
      igual('sem pagamento em parte, o aviso não muda', pagoDaFatura([{ ...fatura, pagoEmParte: 0, falta: 655.28 }]), '')
    },
  },
  {
    nome: 'planejamento do mês: contar com quem me deve',
    rodar: () => {
      const hoje = '2026-11-19'
      // João: R$ 600 em 3 parcelas de R$ 200 desde 10/10 (pagou 1): a de 10/11 atrasada, a de 10/12 a vencer
      const joao: Divida = { id: 'jo', descricao: 'Empréstimo', pessoa: 'João', sentido: 'me_devem', valor_parcela: 200, total_parcelas: 3, inicio: '2026-10-10' }
      // Maria: R$ 300 sem data; Ana: R$ 500 com promessa para 28/11 de R$ 150
      const maria: Divida = { id: 'ma', descricao: 'Maria', sentido: 'me_devem', valor_parcela: null }
      const prom: PromessaDivida = { id: 'p1', divida_id: 'an', data: '2026-11-28', valor: 150, obs: null, created_at: '2026-11-15T10:00:00Z' }
      const ana: Divida = { id: 'an', descricao: 'Ana', sentido: 'me_devem', valor_parcela: null, inicio: '2026-11-01', promessas: [prom] }
      const saldos: SaldoDivida[] = [
        { id: 's1', divida_id: 'jo', data: '2026-10-01', saldo: 600 }, { id: 's2', divida_id: 'ma', data: '2026-10-01', saldo: 300 },
        { id: 's3', divida_id: 'an', data: '2026-10-01', saldo: 500 },
      ]
      const pags = [{ id: 'x1', divida_id: 'jo', data: '2026-10-10', valor: 200, tipo: 'entrada' as const }]
      const sits = situacaoDividas([joao, maria, ana], saldos, pags, 2026, 11, {}, hoje)
      const prev = sits.flatMap((s) => aReceberPrevisto(s, pags, hoje, '2026-12-31'))
      igual('João: o atrasado sem dia e a parcela de dezembro', prev.filter((r) => r.nome === 'João').map((r) => `${r.data}:${r.valor}`), ['null:200', '2026-12-10:200'])
      igual('Maria: tudo, sem dia', prev.filter((r) => r.nome === 'Maria').map((r) => `${r.data}:${r.valor}`), ['null:300'])
      igual('Ana: a promessa, no dia prometido', prev.filter((r) => r.nome === 'Ana').map((r) => `${r.data}:${r.valor}`), ['2026-11-28:150'])

      const pg = (descricao: string, valor: number, vence: string): PagamentoPlanejado => ({
        descricao, valor, vence, origem: 'conta', pagarEm: null, atraso: 0, custo: 0, taxaMes: 1, multa: 0.02, estimada: true, fonte: null, fonteData: null,
      })
      // a pensão (R$ 1.000 no dia 20) não paga o aluguel (900) e a luz (400, dia 30)
      const plano = {
        comSaldo: false, fontes: [{ data: '2026-11-20', valor: 1000, descricao: 'Pensão' }],
        pagamentos: [pg('Aluguel', 900, '2026-11-22')], semDinheiro: [pg('Luz', 400, '2026-11-30')],
      } as unknown as Plano
      const q = quadroDoMes(plano, hoje, 'este', { aReceber: prev })
      igual('o que te devem fica fora das entradas', q.fontes.map((f) => f.nome), ['Pensão'])
      igual('este mês: a promessa e os sem dia (no fim do mês)', q.aReceber.map((f) => `${f.nome}:${f.data}:${f.valor}`),
        ['A receber: Ana:2026-11-28:150', 'A receber: Maria:2026-11-30:300', 'A receber: João:2026-11-30:200'])
      certo('sem dia fica marcado', q.aReceber.filter((f) => f.semDia).length === 2)
      igual('mês que vem: só a parcela de dezembro', quadroDoMes(plano, hoje, 'proximo', { aReceber: prev }).aReceber.map((f) => `${f.data}:${f.valor}`), ['2026-12-10:200'])

      const fmt = (n: number) => `R$ ${n.toFixed(2)}`, data = (iso: string) => iso.slice(8)
      const sem = montarPraMim(q)
      const dica = dicasDe(q, sem, fmt, data).find((d) => d.id === 'usar-a-receber')
      certo('desligado: falta dinheiro e a dica oferece contar com quem deve', placarDe(q, sem).pct < 100 && !!dica?.acao && 'usarAReceber' in dica.acao)

      const qr = comExtras(q, { guardado: false, aReceber: true })
      igual('ligado: as barras entram depois do dinheiro do mês', qr.fontes.map((f) => f.nome), ['Pensão', 'A receber: Ana', 'A receber: Maria', 'A receber: João'])
      const m = montarPraMim(qr)
      const pl = placarDe(qr, m)
      igual('tudo coberto contando com quem deve', pl.pct, 100)
      perto('usa só o que a pensão não cobre (1.300 − 1.000)', pl.doAReceber, 300)
      certo('a luz sai primeiro da Ana, que paga antes do vencimento', m.some((p) => p.entrada.includes(':an:') && qr.destinos.find((d) => d.id === p.conta)!.nome === 'Luz'))
      certo('dica: o plano conta com quem deve', dicasDe(qr, m, fmt, data).some((d) => d.id === 'conta-com-a-receber'))

      const n = normPlanejamentos({ '2026-11': { partes: m, em: 'z', comAReceber: true } }, hoje)
      igual('norm guarda a escolha', n['2026-11'].comAReceber, true)
      igual('consultor: com a escolha, o plano fecha', conselhosDoPlanejamento(q, { partes: m, em: '', comAReceber: true }, fmt, data), [])
      certo('consultor: sem a escolha, as partes de quem deve não valem', conselhosDoPlanejamento(q, { partes: m, em: '' }, fmt, data).some((c) => c.id === 'sem-dinheiro'))
      igual('ligar o guardado não tira o que te devem', comGuardado(qr, true).fontes.filter((f) => f.aReceber).length, 3)
    },
  },

  // ==================== o consultor que aprende (juros de verdade, sinais, na hora, plano) ====================
  {
    nome: 'juros aprendidos: o banco cobra mais do que a regra informada',
    rodar() {
      // Mercado Pago: a regra informada é 0,4% ao dia sobre o saldo; o banco está cobrando ~0,7%
      const mp: Divida = {
        id: 'mp', descricao: 'Mercado Pago', valor_parcela: 1000, inicio: '2026-10-01', total_parcelas: 1,
        atraso_juros_mes: 0.4, atraso_periodo: 'dia', atraso_multa: 0, atraso_tipo: 'simples', atraso_base: 'saldo', conferido_em: '2026-10-31',
      }
      const saldos: SaldoDivida[] = [{ id: 's1', divida_id: 'mp', data: '2026-09-01', saldo: 1000 }, { id: 's2', divida_id: 'mp', data: '2026-10-31', saldo: 1220 }]
      const hoje = '2026-11-11'
      const s = situacaoDividas([mp], saldos, [], 2026, 11, {}, hoje)[0]
      const cal = calendarioDe(s, hoje)
      perto('pela regra informada cresce 1220 × 0,4% por dia', s.atraso!.diario, 4.88)
      const conf = (id: string, data: string, antes: number, depois: number, mais: Partial<ConferenciaDivida> = {}): ConferenciaDivida =>
        ({ id, divida_id: 'mp', data, antes, depois, origem: 'conferir', created_at: `${data}T12:00:00Z`, ...mais })
      const cs = [
        // antiga, sem a pista (antes da migração 44): com regra informada, não ensina
        conf('c0', '2026-10-05', 1000, 1010),
        // 20 dias sobre 1000: o app estimou 80 (0,4%), o banco mostrou 1140 → cobrou 140 = 0,7% ao dia
        conf('c1', '2026-10-21', 1080, 1140, { juros_estimado: 80, base_juros: 1000, dias_juros: 20 }),
        // 10 dias sobre 1140: o app estimou 45,60, o banco mostrou 1220 → cobrou 80 ≈ 0,7018% ao dia
        conf('c2', '2026-10-31', 1185.6, 1220, { juros_estimado: 45.6, base_juros: 1140, dias_juros: 10 }),
        // o valor para quitar hoje não ensina juros
        conf('q1', '2026-11-05', 1260, 1000, { qual_valor: 'quitar' }),
      ]
      const a = aprenderJuros(s, cal, cs)!
      certo('aprendeu', a)
      igual('2 conferências serviram', a.amostras, 2)
      // o acerto antes de um pagamento é a estimativa do próprio app: não ensina
      igual('"pagar" não ensina', aprenderJuros(s, cal, [...cs, conf('pg', '2026-11-08', 1250, 1200, { origem: 'pagar', juros_estimado: 30, base_juros: 1220, dias_juros: 8 })])!.amostras, 2)
      igual('o valor para quitar fica fora do histórico', historicoDaDivida(cs, 'mp').map((m) => m.conferencia.id), ['c2', 'c1', 'c0'])
      igual('modelo: percentual por dia', a.modelo, 'pct')
      // média pesada pelos dias: (0,7% × 20 + 0,70175% × 10) ÷ 30 = 0,700585%
      perto('taxa por dia', a.taxaDia, 0.00700585, 0.0000001)
      perto('cresce hoje 1220 × 0,700585%', a.porDiaHoje, 8.55)
      igual('o banco cobra mais', a.diverge, 'mais')
      igual('sugere a regra de 0,7006% ao dia', a.sugestao, { atraso_juros_mes: 0.7006, atraso_periodo: 'dia', atraso_tipo: 'simples', atraso_reais_dia: null })
      // erro do app: 10 ÷ 1010 = 0,990%; 60 ÷ 1140 = 5,263%; 34,40 ÷ 1220 = 2,820% → média 3,024%
      perto('erro médio das estimativas', a.erroMedio, 0.030243, 0.00001)
      igual('confiança média com 2', a.confianca, 'media')
      perto('equivale a ~21% ao mês', a.taxaMes, 21.02)
      perto('IOF diário possível: 1220 × 0,0082%', a.iofDia, 0.1)
      const q = descontoParaQuitar(cs)!
      perto('desconto para quitar', q.desconto, 260)
      // com a regra já certa, não sugere trocar
      const certa = situacaoDividas([{ ...mp, atraso_juros_mes: 0.7006 }], saldos, [], 2026, 11, {}, hoje)[0]
      const b = aprenderJuros(certa, calendarioDe(certa, hoje), cs)!
      igual('regra certa: bate', [b.diverge, b.sugestao], [null, null])
      // sem regra nenhuma: as conferências antigas servem (o app não estimava nada)
      const semRegra = situacaoDividas([{ ...mp, atraso_juros_mes: null, conferido_em: null }], saldos, [], 2026, 11, {}, hoje)[0]
      const c = aprenderJuros(semRegra, calendarioDe(semRegra, hoje), [conf('a', '2026-10-01', 1000, 1000), conf('b', '2026-10-11', 1000, 1050)])!
      perto('sem regra: 50 em 10 dias sobre 1000 = 0,5% ao dia', c.taxaDia, 0.005, 0.0000001)
      igual('sem regra: avisa que cresce', c.diverge, 'mais')
    },
  },
  {
    nome: 'juros aprendidos: a pista pesa cada parcela atrasada pelos dias dela',
    rodar() {
      // duas parcelas de 100: venceram em 01/10 e 01/11; conferido em 01/10; hoje 11/11
      // exposição = 100 × 41 + 100 × 10 = 5.100 real-dias em 41 dias → base média 124,39
      const d: Divida = { id: 'e2', descricao: 'Loja', valor_parcela: 100, inicio: '2026-10-01', total_parcelas: 2, atraso_juros_mes: 1, atraso_periodo: 'dia', atraso_multa: 0, atraso_tipo: 'simples', atraso_base: 'parcela', conferido_em: '2026-10-01' }
      const s = situacaoDividas([d], [{ id: 'x', divida_id: 'e2', data: '2026-09-15', saldo: 200 }], [], 2026, 11, {}, '2026-11-11')[0]
      const cal = calendarioDe(s, '2026-11-11')
      const p = pistaDaConferencia(s, cal, '2026-11-11')
      igual('41 dias', p.dias_juros, 41)
      perto('base média', p.base_juros, 124.39)
      // 1% ao dia: 100 × 1% × 41 + 100 × 1% × 10 = 51, e 51 ÷ (124,39 × 41) = 1% ao dia
      perto('juros estimados', p.juros_estimado, 51)
      perto('a taxa volta certa', p.juros_estimado / (p.base_juros * p.dias_juros!), 0.01, 0.00002)
    },
  },
  {
    nome: 'sinais: ritmo da dívida, dívida sobre dívida, futuro já gasto, pular compra, fatura pela metade e promessas',
    rodar() {
      const hoje = '2026-11-11'
      const mp: Divida = { id: 'mp', descricao: 'Mercado Pago', valor_parcela: 1000, inicio: '2026-10-01', total_parcelas: 1 }
      const nova: Divida = {
        id: 'loja', descricao: 'Crédito da loja', valor_parcela: 300, inicio: '2026-12-10', total_parcelas: 6,
        promessas: [
          { id: 'p1', divida_id: 'loja', data: '2026-10-10', valor: null, obs: null, created_at: '2026-10-01T10:00:00Z' },
          { id: 'p2', divida_id: 'loja', data: '2026-10-20', valor: null, obs: null, created_at: '2026-10-12T10:00:00Z' },
        ] as PromessaDivida[],
      }
      const saldos: SaldoDivida[] = [{ id: 's1', divida_id: 'mp', data: '2026-09-01', saldo: 1000 }, { id: 's2', divida_id: 'loja', data: '2026-11-08', saldo: 1800 }]
      // compra de 3x 100 feita em 05/11 (dezembro, janeiro, fevereiro) e duas compras puladas para a fatura de dezembro
      const compras: Lancamento[] = [
        ...[12, 1, 2].map((m, i) => lanc(`${m === 12 ? 2026 : 2027}-${String(m).padStart(2, '0')}-05`, 'saida', 100, { cartao_id: 'pp', compra_id: 'c1', parcela: i + 1, parcelas: 3, data_compra: '2026-11-05', descricao: 'Fone' })),
        lanc('2026-12-05', 'saida', 80, { cartao_id: 'pp', compra_id: 'c2', parcela: 1, parcelas: 1, data_compra: '2026-10-20', pulada_de: '2026-11-05' }),
        lanc('2026-12-05', 'saida', 70, { cartao_id: 'pp', compra_id: 'c3', parcela: 1, parcelas: 1, data_compra: '2026-10-22', pulada_de: '2026-11-05' }),
      ]
      const e: EntradaSinais = {
        hojeIso: hoje, renda: 1000, lancs: [], compras, faturasPagas: [],
        faturasParciais: [parcial(2026, 9, 200, '2026-09-05'), parcial(2026, 10, 150, '2026-10-05'), parcial(2026, 11, 90, '2026-11-05'), parcial(2026, 10, 50, '2026-10-06', { cartao_id: 'outro' })],
        dividas: [mp, nova], saldos, pagamentos: [], taxas: {}, conferencias: [], firmeza: 'direto', nome: 'Edigar Teste', lancamentosPorMes: 0, jurosCaro: 3,
      }
      const ss = sinaisDe(e)
      const ids = ss.map((x) => x.id.split(':')[0])
      const de = (id: string) => ss.find((x) => x.id.startsWith(id))!
      for (const id of ['ritmo-divida', 'divida-sobre-divida', 'futuro-comprometido', 'pulou-compra', 'fatura-parcial', 'promessas']) certo(`tem ${id} (veio: ${ids.join(', ')})`, ids.includes(id))
      certo('sem lançamentos frequentes, não fala de dados velhos', !ids.includes('dados-velhos'))
      // ritmo: set 1000 (Mercado Pago nasceu) + nov 1800 (loja) + 300 (fone) = 3100 de dívida nova, nada pago
      certo('ritmo: 3.100 novas, 0 pagas', de('ritmo-divida').dado.forma === 'comparacao' && (de('ritmo-divida').dado as { agora: { valor: number } }).agora.valor === 3100)
      certo('ritmo entra no plano', de('ritmo-divida').acao)
      // dívida sobre dívida: a loja (1.800) e o fone (300) enquanto o Mercado Pago está atrasado
      igual('dívida sobre dívida: 2 novas, 2.100', [(de('divida-sobre-divida').dado as { valor: number }).valor, de('divida-sobre-divida').frase.includes('Mercado Pago')], [2100, true])
      // futuro: dezembro = 100 (fone) + 300 (loja) = 40% de 1.000
      certo('futuro: 40% em dezembro', de('futuro-comprometido').frase.includes('40%'))
      igual('futuro: tom médio', de('futuro-comprometido').tom, 'medio')
      certo('pulou 2 compras (150)', de('pulou-compra').frase.includes('2 compras') && de('pulou-compra').frase.includes('150'))
      // setembro e outubro no PicPay; a de novembro ainda está sendo paga; o outro cartão não emenda a sequência
      igual('2 faturas seguidas pela metade', (de('fatura-parcial').dado as { valor: number }).valor, 2)
      // um amigo devolvendo dinheiro ("me devem") não é dívida nova
      const amigo: Divida = { id: 'amigo', descricao: 'Rafa', valor_parcela: null, sentido: 'me_devem' }
      const devolveu = sinaisDe({ ...e, dividas: [mp], saldos: [saldos[0], { id: 'sa', divida_id: 'amigo', data: '2026-08-01', saldo: 300 }], compras: [],
        lancs: [lanc('2026-11-09', 'entrada', 300, { divida_id: 'amigo' })] }).concat(sinaisDe({ ...e, dividas: [mp, amigo], compras: [],
        saldos: [saldos[0], { id: 'sa', divida_id: 'amigo', data: '2026-08-01', saldo: 300 }], lancs: [lanc('2026-11-09', 'entrada', 300, { divida_id: 'amigo' })] }))
      certo('devolução de quem te deve não vira dívida nova', !devolveu.some((x) => x.id === 'divida-sobre-divida'))
      // dívida quitada: as promessas antigas não voltam
      const quitada = sinaisDe({ ...e, saldos: [...saldos, { id: 'zero', divida_id: 'loja', data: '2026-11-10', saldo: 0 }] })
      certo('promessas de dívida quitada não aparecem', !quitada.some((x) => x.id.startsWith('promessas')))
      // em espera: o Mercado Pago (atrasado) e a loja saem dos sinais e do compromisso, mas o fone (cartão) continua
      const espera = { ...e, dividas: [{ ...mp, em_espera: true }, { ...nova, em_espera: true }] }
      const se = sinaisDe(espera)
      certo('em espera: sem dívida sobre dívida (nada atrasado que conte)', !se.some((x) => x.id === 'divida-sobre-divida'))
      certo('em espera: sem promessas', !se.some((x) => x.id.startsWith('promessas')))
      const ce = compromissoDe(espera)
      igual('em espera: dezembro só com o fone', ce.meses[0].valor, 100)
      igual('em espera: nada atrasado', ce.atrasadas, [])
      igual('promessas: 2 não cumpridas', (de('promessas').dado as { valor: number }).valor, 2)
      // a firmeza muda só o chamado
      const gentil = sinaisDe({ ...e, firmeza: 'gentil' }).find((x) => x.id === 'ritmo-divida')!
      const semFiltro = sinaisDe({ ...e, firmeza: 'sem-filtro' }).find((x) => x.id === 'ritmo-divida')!
      igual('mesmo fato nos três', [gentil.frase, semFiltro.frase], [de('ritmo-divida').frase, de('ritmo-divida').frase])
      certo('chamados diferentes', gentil.chamado !== semFiltro.chamado && gentil.chamado !== de('ritmo-divida').chamado)
      certo('sem filtro chama pelo primeiro nome', semFiltro.chamado.startsWith('Edigar,'))
      // compromisso: 3 parcelas correndo (o fone, a loja com parcela e o Mercado Pago atrasado)
      const cp = compromissoDe(e)
      igual('compromisso de dezembro', cp.meses[0], { ano: 2026, mes: 12, valor: 400 })
      igual('o atrasado aparece', cp.atrasadas.map((x) => x.descricao), ['Mercado Pago'])

      // gasto miúdo: Uber 4× 20 e Padaria 3× 15 neste mês, com o Mercado Pago atrasado
      const miudos = [1, 3, 6, 9].map((d) => lanc(`2026-11-0${d}`, 'saida', 20, { descricao: 'Uber' }))
        .concat([2, 4, 8].map((d) => lanc(`2026-11-0${d}`, 'saida', 15, { descricao: 'Padaria' })))
      const m = sinaisDe({ ...e, renda: 3000, lancs: miudos }).find((x) => x.id === 'miudo-x-divida')!
      certo(`miúdo contra a dívida (${m?.frase})`, m && m.frase.replace(/\s/g, ' ').includes('R$ 125,00') && m.frase.includes('Uber') && m.frase.includes('Mercado Pago'))
      // dados velhos: costuma lançar 10 por mês e o último foi em 01/11
      const velhos = sinaisDe({ ...e, lancamentosPorMes: 10, lancs: [lanc('2026-11-01', 'saida', 10, { created_at: '2026-11-01T09:00:00Z' })], compras: [] })
      certo('10 dias sem lançar', velhos.find((x) => x.id === 'dados-velhos')?.frase.includes('10 dias'))
    },
  },
  {
    nome: 'consultor na hora: parcelar, pular compra, pagar parte da fatura e promessa',
    rodar() {
      const a = {
        firmeza: 'direto', renda: 1000, dividas: null,
        compromisso: { meses: [12, 1, 2, 3, 4, 5].map((m) => ({ ano: m === 12 ? 2026 : 2027, mes: m, valor: 400 })), esteMes: 0, parcelasAtivas: 3, atrasadas: [] },
      } as unknown as Analise
      const f = naHoraDeParcelar(a, [{ ano: 2026, mes: 12, valor: 100 }, { ano: 2027, mes: 1, valor: 100 }])!
      certo('4ª parcela', f.texto.includes('4ª'))
      certo('dezembro com 50%', f.texto.includes('50%') && f.texto.includes('dezembro'))
      igual('50% é ruim', f.tom, 'ruim')
      igual('à vista e sem atraso: nada a dizer', naHoraDeParcelar(a, [{ ano: 2026, mes: 12, valor: 100 }]), null)
      certo('pagar parte: 500 no rotativo, uns 60 em 30 dias', naHoraDePagarParte(a, 500)!.texto.replace(/\s/g, ' ').includes('R$ 60,00'))
      igual('pular de novo é ruim', naHoraDePular(a, 300, 'dezembro', 1)!.tom, 'ruim')
      igual('promessa: 2 falhas', naHoraDaPromessa(a, { cumpridas: 1, falhas: 2 }, false)!.tom, 'ruim')
      igual('promessa: sem falha, nada a dizer', naHoraDaPromessa(a, { cumpridas: 2, falhas: 0 }, false), null)
      igual('100 de 3.000 por mês: 1 dia', emDiasDeRenda(100, 3000), '1 dia do que você ganha')
      igual('500 de 3.000: 5 dias', emDiasDeRenda(500, 3000), '5 dias do que você ganha')
      igual('6.000 de 3.000: 2 meses', emDiasDeRenda(6000, 3000), '2 meses do que você ganha')
      igual('pouco demais: nada', emDiasDeRenda(10, 3000), null)
    },
  },
  {
    nome: 'o consultor lê o plano: o próximo passo que a pessoa decidiu',
    rodar() {
      const destino = (id: string, nome: string, valor: number, vence: string, i: number) => ({
        id, nome, tipo: 'conta' as const, valor, vence, atrasada: false, juros: null, multa: 0, estimada: false, origem: 'conta' as const, indice: i,
      })
      const q: Quadro = {
        qual: 'este', mes: '2026-11', hoje: '2026-11-19', guardados: [], aReceber: [],
        fontes: [{ id: 'sal', nome: 'Salário', valor: 1000, data: '2026-11-25' }, { id: 'extra', nome: 'Freela', valor: 300, data: '2026-11-28' }],
        destinos: [destino('luz', 'Luz', 200, '2026-11-27', 0), destino('mp', 'Mercado Pago', 500, '2026-11-26', 1), destino('net', 'Internet', 100, '2026-11-30', 2)],
      }
      igual('sem plano: nada', lerPlano(q, undefined), null)
      const l = lerPlano(q, { em: 'x', partes: [{ entrada: 'extra', conta: 'net', valor: 100 }, { entrada: 'sal', conta: 'mp', valor: 500 }, { entrada: 'sal', conta: 'luz', valor: 200 }] })!
      igual('próximo dinheiro com conta: o Salário', l.proximo!.fonte.nome, 'Salário')
      igual('paga o Mercado Pago e a Luz, o maior primeiro', l.proximo!.pagar.map((x) => x.nome), ['Mercado Pago', 'Luz'])
      perto('total do passo', l.proximo!.total, 700)
      igual('placar: tudo com dinheiro e nada atrasa', [l.placar.pct, l.placar.fechado], [100, true])
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
