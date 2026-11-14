/**
 * Cenários de teste da Início (rodar: `node scripts/painel/testar.mjs`): a situação do mês, a previsão e a sua composição,
 * a comparação com o mês anterior e a separação das contas em atrasadas / próximas / depois. Os números esperados foram
 * feitos à mão, não tirados das próprias funções. Achou uma conta errada? Monte o caso aqui antes de consertar.
 */
import { compararGastos } from '../../src/lib/comparacao'
import { situacoesDoMes } from '../../src/lib/contasFixas'
import { parcelasDoMes, parcelasPorDia, situacaoDividas } from '../../src/lib/dividas'
import { agruparTarefas, tarefasDoMes } from '../../src/lib/paraFazer'
import { comporPrevisao, diaADiaDoMes } from '../../src/lib/previsao'
import { situacaoDoMes } from '../../src/lib/situacaoDoMes'
import type { SituacaoCartao } from '../../src/lib/cartoes'
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
