/**
 * Cenários de teste do Kairo na parte de custos, decisões e planejamento (rodar: `node scripts/decisoes/testar.mjs`).
 * Os números esperados foram feitos à mão (a conta está no comentário de cada caso), não tirados das próprias funções.
 * A avaliação por consequências (o placar das políticas) fica em `avaliacao.ts`.
 */
import { analisar, type EntradaAnalise } from '../../src/lib/analise'
import { custosDasCondicoes, economiaDeAdiantar, jurosDoContrato, quitacaoHoje, type JurosDoContrato } from '../../src/lib/decisoes/custos'
import { cenariosDaPrevisao } from '../../src/lib/decisoes/cenarios'
import type { CondicaoDeCusto, LeituraDoCairo } from '../../src/cairo'
import { taxaDosFluxos } from '../../src/lib/decisoes/taxaImplicita'
import { avaliarParcelaNova } from '../../src/lib/decisoes/parcelaNova'
import { decisaoDe } from '../../src/lib/decisoes/decisao'
import { aplicarCenario, custoDoAtraso, faltaMinimaDe, planejar, simularPagamentos, type EntradaPlanejador } from '../../src/lib/planejador'
import type { ContaFixa, Divida, Lancamento, Perfil, SaldoDivida } from '../../src/lib/types'
import { avaliar, executar, cenarioDeExemplo, visaoNoDia } from './avaliacao'

class Falha extends Error {}
const perto = (nome: string, obtido: number | null | undefined, esperado: number, tolerancia = 0.011) => {
  if (obtido === null || obtido === undefined || !Number.isFinite(obtido) || Math.abs(obtido - esperado) > tolerancia) throw new Falha(`${nome}: esperava ${esperado}, deu ${obtido}`)
}
const igual = <T>(nome: string, obtido: T, esperado: T) => {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) throw new Falha(`${nome}: esperava ${JSON.stringify(esperado)}, deu ${JSON.stringify(obtido)}`)
}
const certo = (nome: string, condicao: unknown) => { if (!condicao) throw new Falha(nome) }

interface Caso { nome: string; rodar: () => void }

const divida = (mais: Partial<Divida>): Divida => ({ id: 'd1', descricao: 'Empréstimo', valor_parcela: 100, sentido: 'devo', ...mais })
const informado = (mes: number): JurosDoContrato => ({ mes, origem: 'informada', zeroConfirmado: mes === 0, nota: '' })
const desconhecido: JurosDoContrato = { mes: null, origem: 'desconhecida', zeroConfirmado: false, nota: '' }
const HOJE = '2026-11-27'
// 100 atrasada (dia 10), 100 daqui a 30 dias e 100 daqui a 60 dias
const PARCELAS = [{ vence: '2026-11-10', valor: 100 }, { vence: '2026-12-27', valor: 100 }, { vence: '2027-01-26', valor: 100 }]

const PERFIL: Perfil = {
  nome: 'Teste', moeda: 'BRL', moedas: [], detalhe: 'detalhado',
  modulos: { dividas: true, contas: true, cartoes: true, bancos: true, investimentos: false, moedas: false, metas: true },
  dispensadas: [], onboarding_em: '2026-01-01T00:00:00Z',
}
const entradaAnalise = (dividas: Divida[], saldos: SaldoDivida[], mais: Partial<EntradaAnalise> = {}): EntradaAnalise => ({
  hoje: new Date(2026, 10, 27), lancs: [], compras: [], cartoes: [], faturasPagas: [], contas: [], categorias: [], categoriaDe: () => '',
  dividas, saldos, pagamentos: [], taxas: {}, meses: [], metas: [], movimentosMeta: [], perfil: PERFIL, ...mais,
})
let seq = 0
const lanc = (data: string, tipo: 'entrada' | 'saida', valor: number, mais: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${++seq}`, ano: +data.slice(0, 4), mes: +data.slice(5, 7), tipo, descricao: `${tipo} ${seq}`, valor, data, ...mais,
})
const contaFixa = (descricao: string, tipo: 'entrada' | 'saida', valor: number, dia: number, inicio = '2026-01-01'): ContaFixa => ({
  id: `c${++seq}`, tipo, descricao, valor, categoria_id: null, banco_id: null, dia, inicio, fim: null, ativa: true,
})

/** Planejador de base: começa em 1º de novembro, vai até 31 de dezembro. */
const plano = (mais: Partial<EntradaPlanejador>): EntradaPlanejador => ({
  hoje: '2026-11-01', fim: '2026-12-31', saldoInicial: 0, ritmoDia: 0, porDiaDoMes: null, gastouHoje: 0, abertas: [], entradas: [], compromissos: [], cenarios: [], ...mais,
})

export const CASOS: Caso[] = [
  // ==================== juros do contrato ====================
  {
    nome: 'juros do contrato: informado, zero confirmado, implícito e desconhecido',
    rodar() {
      igual('3% informado', [jurosDoContrato(divida({ juros_mes: 3 })).mes, jurosDoContrato(divida({ juros_mes: 3 })).origem], [3, 'informada'])
      certo('0% é zero confirmado', jurosDoContrato(divida({ juros_mes: 0 })).zeroConfirmado)
      // recebeu 250 e paga 2 × 135: 135x + 135x² = 250, x = 1/(1+i) → x = 0,949775 → i = 5,288% ao mês
      const imp = jurosDoContrato(divida({ juros_mes: null, valor_recebido: 250, valor_parcela: 135, total_parcelas: 2 }))
      igual('implícito', imp.origem, 'implicita')
      perto('5,29% ao mês', imp.mes, 5.29, 0.01)
      // vazio no banco é "sem juros" OU "não sei" (o formulário grava os dois igual): desconhecido, nunca zero
      const vazio = jurosDoContrato(divida({ juros_mes: null }))
      igual('vazio é desconhecido', [vazio.mes, vazio.zeroConfirmado], [null, false])
    },
  },
  {
    nome: 'juros do contrato: o juro do atraso nunca vira juro do contrato',
    rodar() {
      const d = divida({ juros_mes: null, atraso_juros_mes: 17.5, atraso_multa: 2, atraso_tipo: 'simples' })
      igual('atraso de 17,5% não entra', jurosDoContrato(d).mes, null)
      const q = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: jurosDoContrato(d), encargosDoAtraso: 10 })
      igual('sem taxa do contrato, desconto desconhecido', [q.estado, q.desconto, q.paraQuitar], ['desconhecido', null, null])
      perto('o teto: 300 + 10 de atraso', q.semDesconto, 310)
    },
  },

  // ==================== quitação ====================
  {
    nome: 'quitação: desconto só nas que não venceram, pela taxa do contrato',
    rodar() {
      // 2% ao mês: 100/1,02 = 98,0392 e 100/1,02^2 = 96,1169 → desconto 5,8439; atraso 5 entra à parte, sem desconto
      const q = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: informado(2), encargosDoAtraso: 5 })
      igual('estado', q.estado, 'calculado')
      perto('vencido', q.vencido, 100)
      perto('a vencer', q.aVencer, 200)
      perto('desconto', q.desconto, 5.84)
      perto('para quitar: 100 + 5 + 194,16', q.paraQuitar, 299.16)
      // o app não sabe o que o contrato diz sobre adiantar (Cairo: antecipação 'desconhecida'): o mínimo garantido é zero
      igual('antecipação desconhecida', [q.antecipacao, q.minimoGarantido], ['desconhecida', 0])
      const g = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: informado(2), encargosDoAtraso: 5, antecipacao: 'desconto_contratual' })
      perto('com a regra do contrato, o desconto é garantido', g.minimoGarantido, 5.84)
      const sem = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: informado(2), antecipacao: 'sem_desconto' })
      igual('contrato que diz "sem desconto": zero confirmado', [sem.estado, sem.desconto], ['sem-desconto', 0])
    },
  },
  {
    nome: 'quitação: zero confirmado, sem nada a vencer e valor do credor',
    rodar() {
      const z = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: informado(0) })
      igual('contrato sem juros', [z.estado, z.desconto, z.paraQuitar], ['sem-desconto', 0, 300])
      const so = quitacaoHoje({ hoje: HOJE, parcelas: [{ vence: '2026-11-10', valor: 100 }], contrato: desconhecido, encargosDoAtraso: 3 })
      igual('só o atrasado: nada a descontar, mesmo sem taxa', [so.estado, so.paraQuitar], ['sem-desconto', 103])
      const banco = { data: '2026-11-17', total: 305, quitar: 280, desconto: 25 }
      const c = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: desconhecido, encargosDoAtraso: 5, banco })
      igual('valor do credor de 10 dias atrás', [c.estado, c.paraQuitar, c.desconto], ['confirmado', 280, 25])
      const velho = quitacaoHoje({ hoje: HOJE, parcelas: PARCELAS, contrato: desconhecido, banco: { ...banco, data: '2026-10-01' } })
      igual('valor do credor velho não confirma', velho.estado, 'desconhecido')
      certo('e vira premissa', velho.premissas.some((p) => p.includes('280')))
    },
  },
  {
    nome: 'adiantar: economia desconhecida não é zero',
    rodar() {
      // 194,16 a 2% paga as duas que vencem (valem 98,04 + 96,12 hoje): abate 200, economia 5,84
      const e = economiaDeAdiantar({ hoje: HOJE, parcelas: PARCELAS, contrato: informado(2), dinheiro: 194.16 })
      perto('abate 200', e.abatido, 200, 0.02)
      perto('economia', e.economia, 5.84, 0.02)
      const d = economiaDeAdiantar({ hoje: HOJE, parcelas: PARCELAS, contrato: desconhecido, dinheiro: 150 })
      igual('sem taxa: economia null e abate pelo menos o que pagou', [d.economia, d.minimoAbatido], [null, 150])
    },
  },

  {
    nome: 'condições do Cairo: contrato, fluxos e oferta lidos sem tocar na regra de atraso',
    rodar() {
      const c: CondicaoDeCusto[] = [
        { tipo: 'contratual', divida: 'a', taxa: { fracao: 0.02, periodo: 'mes', regime: 'composta' }, fonte: 'informada', desde: null },
        { tipo: 'atraso', divida: 'a', multa: 0.02, mora: { fracao: 0.15, periodo: 'mes', regime: 'simples' }, porDia: null, base: 'parcela', fonte: 'informada' },
        { tipo: 'antecipacao', divida: 'a', regra: 'desconhecida' },
        { tipo: 'oferta_quitacao', divida: 'a', valor: { centavos: 28000, moeda: 'BRL' }, total: { centavos: 30500, moeda: 'BRL' }, dia: '2026-11-17', ref: { tabela: 'divida_conferencias', id: 'x', versao: null } },
        // só o que recebeu e as parcelas, com a data em que recebeu: 250 em 01/01, 135 em 31/01 e 02/03 → 5,288%
        { tipo: 'fluxo_do_contrato', divida: 'b', recebido: { centavos: 25000, moeda: 'BRL' }, recebidoEm: '2026-01-01', parcelas: [{ vence: '2026-01-31', valor: { centavos: 13500, moeda: 'BRL' } }, { vence: '2026-03-02', valor: { centavos: 13500, moeda: 'BRL' } }] },
        { tipo: 'atraso', divida: 'c', multa: 0.02, mora: { fracao: 0.175, periodo: 'mes', regime: 'simples' }, porDia: null, base: 'parcela', fonte: 'informada' },
      ]
      const a = custosDasCondicoes(c, 'a')
      igual('contrato 2%', [a.contrato.mes, a.contrato.origem], [2, 'informada'])
      igual('oferta de quitação', [a.banco?.quitar, a.banco?.desconto], [280, 25])
      igual('antecipação desconhecida', a.antecipacao, 'desconhecida')
      const b = custosDasCondicoes(c, 'b')
      igual('fluxos: implícita', b.contrato.origem, 'implicita')
      perto('fluxos: TIR por datas', b.contrato.mes, 5.288, 0.002)
      igual('só atraso: contrato desconhecido (o atraso não vira contrato)', custosDasCondicoes(c, 'c').contrato.mes, null)
    },
  },
  {
    nome: 'cenários: o "e se" vem do que o Cairo aprendeu, nunca de premissa fixa',
    rodar() {
      const fonte = (descricao: string, p90: number, peso: number, pNaoOcorre: number) => ({
        chave: `desc:${descricao}`, descricao, diaPrevisto: 5, origem: 'detectada', meses: 8, pNaoOcorre,
        atraso: { tipo: 'estimativa', dist: { quantis: { p10: 0, p50: 0, p90 }, calibracao: { versao: 'x', cobertura80: null } }, prov: { refs: [], conhecidoEm: null, atualizadoEm: null }, metodo: 'suavizado', nEf: 8, pesoDoHistorico: peso },
      })
      const leitura = (fs: unknown[]) => ({ aprendizado: { entradas: fs } }) as unknown as LeituraDoCairo
      const entradas = [{ data: '2026-11-05', valor: 3000, descricao: 'Salário' }, { data: '2026-11-20', valor: 400, descricao: 'Freela' }]
      igual('sem Cairo, nenhum', cenariosDaPrevisao(null, entradas, '2026-11-01', '2026-12-31'), [])
      igual('histórico sem atraso, nenhum', cenariosDaPrevisao(leitura([fonte('Salário', 0, 0.8, 0.01)]), entradas, '2026-11-01', '2026-12-31'), [])
      igual('pouco histórico, nenhum', cenariosDaPrevisao(leitura([fonte('Salário', 4, 0.2, 0.01)]), entradas, '2026-11-01', '2026-12-31'), [])
      const c = cenariosDaPrevisao(leitura([fonte('Salário', 4, 0.8, 0.12)]), entradas, '2026-11-01', '2026-12-31')
      igual('atraso de 4 dias e falta, do Salário', c.map((x) => [x.id, x.adiar?.dias ?? null, x.origem]), [['atraso:desc:Salário', 4, 'previsao'], ['falta:desc:Salário', null, 'previsao']])
      certo('premissa sem a palavra chance', c.every((x) => !/chance/i.test(x.premissa)))
      igual('sem cenários, o planejador não testa nada', planejar(plano({ entradas, cenarios: undefined })).estresse, [])
    },
  },

  // ==================== taxa dos fluxos ====================
  {
    nome: 'taxa dos fluxos: TIR por datas, sem chamar de CET',
    rodar() {
      // 1.000 hoje, 1.100 em 30 dias: 10% ao mês
      const t = taxaDosFluxos([{ data: '2026-01-01', valor: 1000 }, { data: '2026-01-31', valor: -1100 }])!
      perto('10% ao mês', t.mes, 10, 0.001)
      certo('avisa o que falta para o CET', t.faltaParaCET.includes('iof') && t.faltaParaCET.includes('tarifas'))
      // 250 hoje, 135 em 30 e em 60 dias: 5,288% (o mesmo da tabela Price acima)
      const p = taxaDosFluxos([{ data: '2026-01-01', valor: 250 }, { data: '2026-01-31', valor: -135 }, { data: '2026-03-02', valor: -135 }])!
      perto('Price por datas', p.mes, 5.288, 0.002)
      perto('resíduo perto de zero', p.residuo, 0, 0.01)
      igual('pagou menos do que recebeu: não é custo', taxaDosFluxos([{ data: '2026-01-01', valor: 1000 }, { data: '2026-02-01', valor: -900 }]), null)
      igual('um sinal só', taxaDosFluxos([{ data: '2026-01-01', valor: -100 }, { data: '2026-02-01', valor: -100 }]), null)
    },
  },

  // ==================== integração com a análise ====================
  {
    nome: 'análise: dívida atrasada com regra de atraso não ganha desconto pelo juro do atraso',
    rodar() {
      // 6 × 100 desde 27/08, nada pago: agosto, setembro e outubro atrasados; 15% ao mês no atraso; contrato sem taxa
      const d = divida({ inicio: '2026-08-27', total_parcelas: 6, juros_mes: null, atraso_juros_mes: 15, atraso_multa: 2, atraso_tipo: 'simples', atraso_base: 'parcela' })
      const s: SaldoDivida[] = [{ id: 's1', divida_id: 'd1', data: '2026-08-01', saldo: 600 }]
      const a = analisar(entradaAnalise([d], s))
      const x = a.dividas!.ordem[0]
      igual('o juro que pesa é o do atraso', x.jurosDoAtraso, true)
      igual('contrato desconhecido', x.contrato.origem, 'desconhecida')
      igual('desconto desconhecido', x.quitacao.estado, 'desconhecido')
      perto('nada de juros "embutidos" inventados', a.dividas!.jurosEmbutidos, 0)
      perto('quitar hoje é o teto (sem desconto)', x.quitarHoje, x.quitacao.semDesconto)
      certo('quitar hoje inclui o atraso', x.quitarHoje > 600)
    },
  },
  {
    nome: 'análise: com a taxa do contrato, o desconto usa só ela',
    rodar() {
      // mesma dívida com 2% no contrato: desconto só em 27/12 (30 dias) e 27/01 (61 dias):
      // 100 − 100/1,02 = 1,9608; 100 − 100/1,02^(61/30) = 3,9467 → 5,91 (hoje, 27/11, vence e não tem desconto)
      const d = divida({ inicio: '2026-08-27', total_parcelas: 6, juros_mes: 2, atraso_juros_mes: 15, atraso_multa: 2, atraso_tipo: 'simples', atraso_base: 'parcela' })
      const a = analisar(entradaAnalise([d], [{ id: 's1', divida_id: 'd1', data: '2026-08-01', saldo: 600 }]))
      const x = a.dividas!.ordem[0]
      igual('calculado', x.quitacao.estado, 'calculado')
      perto('desconto pelos 2%', x.quitacao.desconto, 5.91, 0.02)
      certo('e não pelos 15% do atraso (daria uns 35)', (x.quitacao.desconto ?? 99) < 7)
    },
  },

  // ==================== empréstimos e devoluções: no caixa, fora de renda e consumo ====================
  {
    nome: 'caixa: o empréstimo que vai cair paga o aluguel, sem virar renda nem ir ao Cairo como renda',
    rodar() {
      // dívida com o banco; o dinheiro emprestado (2.000) cai em 01/12 e o aluguel (1.500, desde dezembro) vence em 03/12
      const banco = divida({ id: 'bco', descricao: 'Empréstimo do banco', valor_parcela: null, juros_mes: 3 })
      const pegou = lanc('2026-12-01', 'entrada', 2000, { descricao: 'Crédito do banco', divida_id: 'bco' })
      const a = analisar(entradaAnalise([banco], [{ id: 's', divida_id: 'bco', data: '2026-11-01', saldo: 3000 }], {
        lancs: [pegou], contas: [contaFixa('Aluguel', 'saida', 1500, 3, '2026-12-01')],
      }))
      const e = a.entradaDoPlano!
      certo('o planejador conta com os 2.000 em 01/12', e.entradas.some((x) => x.data === '2026-12-01' && x.valor === 2000))
      igual('o aluguel de dezembro é pago no dia, com ele', a.plano!.pagamentos.find((x) => x.descricao === 'Aluguel' && x.vence === '2026-12-03')?.pagarEm, '2026-12-03')
      igual('não é renda', a.renda, 0)
      certo('não vai ao Cairo como renda', !a.cairo!.cenarios.esperados.some((f) => f.natureza === 'renda' && f.valor.centavos === 200000))
      // sem o empréstimo, o aluguel de dezembro ficaria sem dinheiro: o caixa dependia dele
      const sem = analisar(entradaAnalise([banco], [{ id: 's', divida_id: 'bco', data: '2026-11-01', saldo: 3000 }], { contas: [contaFixa('Aluguel', 'saida', 1500, 3, '2026-12-01')] }))
      certo('sem ele, falta dinheiro', sem.plano!.semDinheiro.some((x) => x.descricao === 'Aluguel'))
    },
  },
  {
    nome: 'caixa: emprestar a alguém sai do caixa, sem multa se esperar, e a devolução entra',
    rodar() {
      const joao = divida({ id: 'jo', descricao: 'Empréstimo ao João', sentido: 'me_devem', valor_parcela: null })
      const empresta = lanc('2026-12-02', 'saida', 500, { descricao: 'Pix para o João', divida_id: 'jo' })
      const devolve = lanc('2026-12-10', 'entrada', 300, { descricao: 'João devolve', divida_id: 'jo' })
      const a = analisar(entradaAnalise([joao], [{ id: 's', divida_id: 'jo', data: '2026-11-01', saldo: 800 }], { lancs: [empresta, devolve] }))
      const c = a.entradaDoPlano!.compromissos.find((x) => x.descricao === 'Pix para o João')!
      certo('emprestar é saída do caixa, sem custo de esperar', c && c.semCusto)
      certo('a devolução marcada é entrada do caixa', a.entradaDoPlano!.entradas.some((x) => x.data === '2026-12-10' && x.valor === 300))
      const p = a.plano!.pagamentos.find((x) => x.descricao === 'Pix para o João') ?? a.plano!.semDinheiro.find((x) => x.descricao === 'Pix para o João')!
      igual('esperar para emprestar não tem multa nem juros', p.custo, 0)
      igual('nada disso é gasto nem renda', [a.renda, a.gastos], [0, 0])
    },
  },

  // ==================== planejador ====================
  {
    nome: 'planejador: a conta essencial vai antes, e diz quanto isso custa',
    rodar() {
      // 300 hoje; luz 200 (essencial, 1% + 2%) e fatura 250 (14% + 2%) vencem dia 5; salário 1.000 dia 10
      const e = plano({
        saldoInicial: 300,
        entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }],
        compromissos: [
          { descricao: 'Luz', valor: 200, vence: '2026-11-05', origem: 'conta', essencial: true, essencialPor: 'categoria' },
          { descricao: 'Fatura', valor: 250, vence: '2026-11-05', origem: 'cartao' },
        ],
      })
      const p = planejar(e)
      igual('luz no dia', p.pagamentos.find((x) => x.descricao === 'Luz')!.pagarEm, '2026-11-05')
      igual('fatura com o salário', p.pagamentos.find((x) => x.descricao === 'Fatura')!.pagarEm, '2026-11-10')
      // fatura 5 dias: 250 × 2% + 250 × 14% × 5/30 = 5 + 5,83 = 10,83; luz 5 dias: 4 + 200 × 1% × 5/30 = 4,33
      perto('custo do plano', p.custoTotal, 10.83)
      const sem = simularPagamentos(e, { semPolitica: true })
      perto('sem a política, a luz atrasaria', sem.custoTotal, 4.33)
      const d = p.dicas.find((x) => x.id === 'escolha:Luz')!
      certo('dica diz que é essencial', d && d.porque.includes('essencial'))
      igual('regra do app', d.regra, 'app')
      certo('alternativa com o custo da troca (6,50)', d.alternativas!.some((x) => x.includes('6,50')))
      certo('premissa: essencial pela categoria', d.premissas!.some((x) => x.includes('categoria')))
    },
  },
  {
    nome: 'planejador: a prioridade da pessoa passa na frente da política do app',
    rodar() {
      const e = plano({
        saldoInicial: 300,
        entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }],
        compromissos: [
          { descricao: 'Luz', valor: 200, vence: '2026-11-05', origem: 'conta', essencial: true },
          { descricao: 'Fatura', valor: 250, vence: '2026-11-05', origem: 'cartao', prioridadePessoa: 1 },
        ],
      })
      const p = planejar(e)
      igual('fatura no dia', p.pagamentos.find((x) => x.descricao === 'Fatura')!.pagarEm, '2026-11-05')
      igual('regra da pessoa', p.dicas.find((x) => x.id === 'escolha:Fatura')?.regra, 'pessoa')
    },
  },
  {
    nome: 'planejador: não usa o dinheiro do mercado para conta não essencial',
    rodar() {
      // 500 hoje, gasto de 20/dia (15 essencial); internet 300 vence hoje; salário só dia 21 (20 dias): o mercado pede 300
      const base = plano({
        saldoInicial: 500, ritmoDia: 20,
        entradas: [{ data: '2026-11-21', valor: 1000, descricao: 'Salário' }],
        compromissos: [{ descricao: 'Internet', valor: 300, vence: '2026-11-01', origem: 'conta' }],
      })
      igual('sem a parte essencial: paga hoje', planejar(base).pagamentos[0].pagarEm, '2026-11-01')
      const p = planejar({ ...base, essencialDia: 15 })
      // 500 − 300 = 200 < 15 × 20 = 300: espera o salário
      igual('com a parte essencial: espera o salário', p.pagamentos[0].pagarEm, '2026-11-21')
      const d = p.dicas.find((x) => x.id === 'pagar-em:Internet')!
      certo('a dica diz que espera pelo essencial do dia a dia', d.premissas!.some((x) => x.includes('essencial do dia a dia')))
      // pagar hoje: 0; pagar dia 21: 300 × 2% + 300 × 1% × 20/30 = 6 + 2 = 8 a mais
      certo('e quanto custa não esperar (8,00)', d.alternativas!.some((x) => x.includes('8,00')))
    },
  },
  {
    nome: 'planejador: o fim do plano não libera o dinheiro do essencial que vem depois',
    rodar() {
      const base = plano({
        saldoInicial: 0,
        entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }],
        abertas: [{ nome: 'Agiota', saldo: 2000, juros: 20 }],
      })
      const solto = planejar(base).dicas.find((x) => x.id === 'adiantar-aberta:Agiota')!
      certo('sem reserva: adianta os 1.000', solto.titulo.includes('1.000'))
      const comReserva = planejar({ ...base, depoisDoFim: { ate: '2027-01-05', valor: 400 } }).dicas.find((x) => x.id === 'adiantar-aberta:Agiota')!
      certo('com reserva: adianta 600', comReserva.titulo.includes('600'))
      const comCartao = planejar({ ...base, semComprasFuturasDoCartao: true }).dicas.find((x) => x.id === 'adiantar-aberta:Agiota')!
      igual('quem usa cartão: adiantar é condicional', comCartao.estado, 'condicional')
      certo('porque as compras futuras do cartão não estão no plano', comCartao.premissas!.some((x) => x.includes('cartão')))
      certo('e diz por quê', comReserva.premissas!.some((x) => x.includes('400')))
    },
  },
  {
    nome: 'planejador: falta mínima e saídas quando não dá para tudo',
    rodar() {
      // nada hoje; luz 200 vence dia 5; o dinheiro só entra dia 10: falta 200 hoje para nada atrasar
      const e = plano({
        saldoInicial: 0,
        entradas: [{ data: '2026-11-10', valor: 150, descricao: 'Freela' }],
        compromissos: [{ descricao: 'Luz', valor: 200, vence: '2026-11-05', origem: 'conta', essencial: true }],
        alternativas: { guardado: 500, aReceber: [{ nome: 'Rafael', valor: 100, data: '2026-11-08' }] },
      })
      perto('falta mínima', faltaMinimaDe(e), 200, 1)
      const p = planejar(e)
      igual('luz sem dinheiro', p.semDinheiro.map((x) => x.descricao), ['Luz'])
      igual('essencial atrasada', p.essenciaisAtrasadas, ['Luz'])
      const d = p.dicas.find((x) => x.id === 'sem-dinheiro')!
      certo('guardado como saída', d.alternativas!.some((x) => x.includes('guardado')))
      certo('quem deve: condicional, sem contar com isso', d.alternativas!.some((x) => x.includes('Rafael') && x.includes('não conta')))
    },
  },
  {
    nome: 'planejador: e se o salário atrasar como já atrasou (condicional, com premissa)',
    rodar() {
      // 100 hoje; aluguel 900 (essencial) dia 11; salário 1.000 dia 10. Fecha, mas com 3 dias de atraso o aluguel atrasa.
      const e = plano({
        saldoInicial: 100,
        entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }],
        compromissos: [{ descricao: 'Aluguel', valor: 900, vence: '2026-11-11', origem: 'conta', essencial: true }],
        // o que o Cairo passaria para quem tem salário que já atrasou 3 dias (lib/decisoes/cenarios.ts)
        cenarios: [{ id: 'renda-atrasa', origem: 'previsao', premissa: 'Se Salário cair 3 dias depois, como já aconteceu', adiar: { dias: 3, descricao: 'Salário' } }],
      })
      const p = planejar(e)
      igual('o plano normal não atrasa', p.atrasos, 0)
      const r = p.estresse!.find((x) => x.id === 'renda-atrasa')!
      igual('aluguel atrasa no cenário', r.essenciaisAtrasadas, ['Aluguel'])
      perto('separar 800 cobre (900 − 100)', r.faltaMinima, 800, 1)
      const d = p.dicas.find((x) => x.id === 'e-se:renda-atrasa')!
      igual('condicional', d.estado, 'condicional')
      certo('premissa: o histórico', d.premissas!.some((x) => x.includes('histórico')))
      // o cenário da previsão (Claude 1) entra no lugar dos do app
      const q = planejar({ ...e, cenarios: [{ id: 'aprendido', origem: 'previsao', premissa: 'Se o Salário cair no dia 12', adiar: { dias: 2, descricao: 'Salário' } }] })
      igual('usa só o cenário recebido', q.estresse!.map((x) => x.id), ['aprendido'])
    },
  },
  {
    nome: 'planejador: custo do atraso e cenário aplicado sem mexer no original',
    rodar() {
      perto('1.000 por 15 dias a 3% + 2%', custoDoAtraso(1000, 15, 3), 35)
      const e = plano({ entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }] })
      const c = aplicarCenario(e, { id: 'x', origem: 'app', premissa: '', adiar: { dias: 3 } })
      igual('adiou a maior', c.entradas[0].data, '2026-11-13')
      igual('o original não muda', e.entradas[0].data, '2026-11-10')
    },
  },

  // ==================== parcela nova ====================
  {
    nome: 'parcela nova: pelo calendário, o que atrasa e quanto caberia',
    rodar() {
      // 300 hoje; aluguel 900 dia 11; salário 1.000 dia 10. Sobra 400 depois do aluguel.
      const e = plano({
        saldoInicial: 300,
        entradas: [{ data: '2026-11-10', valor: 1000, descricao: 'Salário' }, { data: '2026-12-10', valor: 1000, descricao: 'Salário' }],
        compromissos: [
          { descricao: 'Aluguel', valor: 900, vence: '2026-11-11', origem: 'conta', essencial: true },
          { descricao: 'Aluguel', valor: 900, vence: '2026-12-11', origem: 'conta', essencial: true },
        ],
      })
      // parcelas de 500 no dia 10: o aluguel (essencial) é protegido e quem fica sem dinheiro é a própria fatura nova
      // (dia 10: 1.300 − 500 = 800 < 900 guardados para o aluguel do dia 11)
      const ruim = avaliarParcelaNova(e, [{ data: '2026-11-10', valor: 500 }, { data: '2026-12-10', valor: 500 }])!
      igual('a fatura nova não tem dinheiro', ruim.novasAtrasadas, ['Compra nova'])
      igual('o aluguel não atrasa', ruim.essenciaisAtrasadas, [])
      // nov.: 1.300 − p ≥ 900 → p ≤ 400; dez.: (400 − p) + 1.000 − p ≥ 900 → p ≤ 250
      const ok = avaliarParcelaNova(e, [{ data: '2026-11-10', valor: 100 }, { data: '2026-12-10', valor: 100 }])!
      igual('100 não atrasa nada', ok.novasAtrasadas, [])
      perto('cabe até 250 por mês', ok.cabePorMes, 250, 1.01)
      const semSaldo = avaliarParcelaNova({ ...e, saldoInicial: null }, [{ data: '2026-11-10', valor: 100 }, { data: '2026-12-10', valor: 100 }])!
      igual('sem saldo, faltam dados', [semSaldo.estado, semSaldo.cabePorMes], ['faltam-dados', null])
      igual('com saldo e sem cartão, recomenda', ok.estado, 'recomenda')
      // quem usa cartão: as compras que ainda vai fazer não estão no plano, então "cabe" depende delas
      const comCartao = avaliarParcelaNova({ ...e, semComprasFuturasDoCartao: true }, [{ data: '2026-11-10', valor: 100 }, { data: '2026-12-10', valor: 100 }])!
      igual('com cartão, condicional', comCartao.estado, 'condicional')
      certo('e diz o porquê', comCartao.premissas.some((x) => x.includes('compras que você ainda vai fazer no cartão')))
    },
  },

  // ==================== decisão ====================
  {
    nome: 'decisão: só guarda quando diz algo além de "recomenda"',
    rodar() {
      igual('recomenda sem nada', decisaoDe({ estado: 'recomenda' }), undefined)
      igual('pergunta guarda', decisaoDe({ estado: 'pergunta', premissas: ['x', ''] }), { estado: 'pergunta', premissas: ['x'], alternativas: [] })
      igual('escolha da pessoa guarda', decisaoDe({ regra: 'pessoa' })?.regra, 'pessoa')
    },
  },

  // ==================== simulação sem conhecer o futuro ====================
  {
    nome: 'simulação: o mesmo passado observado dá as mesmas decisões até a informação se separar',
    rodar() {
      // dois mundos iguais até o dia 10; no B o salário só cai no dia 13
      const a = cenarioDeExemplo({ salarioCai: '2026-11-10' })
      const b = cenarioDeExemplo({ salarioCai: '2026-11-13' })
      for (const dia of ['2026-11-01', '2026-11-05', '2026-11-09']) {
        igual(`a mesma visão em ${dia}`, JSON.stringify(visaoNoDia(a, dia)), JSON.stringify(visaoNoDia(b, dia)))
      }
      const ra = executar(a, 'nova'), rb = executar(b, 'nova')
      igual('as mesmas decisões até o dia 9', ra.decisoes.filter((x) => x.dia < '2026-11-10'), rb.decisoes.filter((x) => x.dia < '2026-11-10'))
      certo('no dia 10, a informação se separa e as decisões podem mudar', JSON.stringify(visaoNoDia(a, '2026-11-10')) !== JSON.stringify(visaoNoDia(b, '2026-11-10')))
    },
  },
  {
    nome: 'avaliação: a política nova não deixa essencial a descoberto mais que a antiga',
    rodar() {
      const r = avaliar(200, 7)
      certo('dias de essencial atrasado não aumentam', r.nova.diasEssencialAtrasado <= r.antiga.diasEssencialAtrasado)
      certo('dias do mercado sem dinheiro não aumentam', r.nova.diasSemEssencialDoDia <= r.antiga.diasSemEssencialDoDia)
      certo('reprodutível com a mesma semente', JSON.stringify(avaliar(30, 7)) === JSON.stringify(avaliar(30, 7)))
    },
  },
]

export function rodar(filtro?: string): number {
  if (filtro === 'avaliar') {
    const r = avaliar(500, 11)
    console.log(JSON.stringify(r, null, 2))
    return 0
  }
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
