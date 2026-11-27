/**
 * Integração entre as duas partes do Cairo (docs/cairo/coordenacao.md): a parte de decisão (lib/decisoes, lib/planejador.ts)
 * sobre as personas e os cenários da parte de dados (src/cairo). Rodar: `node scripts/cairo/integracao/testar.mjs`.
 *
 *  1. Custos: as condições de custo do Cairo viram quitação sem usar o juro do atraso nem o juro implausível.
 *  2. Cenários: o "e se" do planejador sai do atraso de renda que o Cairo aprendeu, e só dele.
 *  3. Não-antecipação: com `revelar` e `trocarFuturo` (da parte de dados), dois mundos iguais até um dia dão as mesmas
 *     decisões até esse dia.
 *  4. Execução: em cada mundo, o planejador nunca paga mais do que tem; o que fica sem pagar é dito.
 */
import { lerCairo, revelar, somarDias, trocarFuturo, type DiaISO, type Fluxo, type Mundo } from '../../../src/cairo'
import { custosDasCondicoes, quitacaoHoje } from '../../../src/lib/decisoes/custos'
import { cenariosDaPrevisao } from '../../../src/lib/decisoes/cenarios'
import { entradaDoObservado, entraNoCaixa, idDeBase } from '../../../src/lib/decisoes/observado'
import { simularPagamentos } from '../../../src/lib/planejador'
import { analisar, type EntradaAnalise } from '../../../src/lib/analise'
import { qualidadeDosMeses, type ResumoDoMes } from '../../../src/cairo'
import type { Lancamento, Perfil } from '../../../src/lib/types'
import { personas, HOJE, type Persona } from '../personas'

class Falha extends Error {}
const igual = <T>(nome: string, obtido: T, esperado: T) => {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) throw new Falha(`${nome}: esperava ${JSON.stringify(esperado)}, deu ${JSON.stringify(obtido)}`)
}
const certo = (nome: string, condicao: unknown) => { if (!condicao) throw new Falha(nome) }

const lista = personas()
const persona = (nome: string): Persona => lista.find((p) => p.nome === nome)!

/** A política (o planejador) executada dia a dia num mundo, vendo só o que `revelar` entrega. */
export function executarNoMundo(m: Mundo, esperados: Fluxo[], hoje: DiaISO, ate: DiaISO, caixaInicial = 0) {
  let caixa = caixaInicial
  const pagos = new Set<string>()
  const recebidos = new Set<string>()
  const decisoes: { dia: string; pagar: string[] }[] = []
  let pagouSemTer = 0
  for (let dia = hoje; dia <= ate; dia = somarDias(dia, 1)) {
    const o = revelar(m, esperados, dia)
    for (const f of o.conhecidos) {
      // todo dinheiro que entra na mão conta no caixa: renda, crédito recebido e a devolução de quem te deve
      if (entraNoCaixa(f) && f.dia <= dia && !recebidos.has(f.id)) { caixa += f.valor.centavos / 100; recebidos.add(f.id) }
      if (f.natureza === 'dia_a_dia' && f.dia === dia) caixa -= f.valor.centavos / 100
    }
    const r = simularPagamentos(entradaDoObservado(o, { caixa, ate, pagos }))
    const hojeSim = r.pagamentos.filter((p) => p.pagarEm === dia)
    const ids: string[] = []
    for (const p of hojeSim) {
      const total = p.valor + p.custo
      if (caixa < total - 0.005) { pagouSemTer++; continue }
      caixa -= total
      pagos.add(idDeBase(p.grupo!))
      ids.push(idDeBase(p.grupo!))
    }
    decisoes.push({ dia, pagar: ids })
  }
  return { decisoes, pagouSemTer, caixa }
}

/**
 * `limitacao`: o caso descreve o comportamento CERTO, que a versão atual ainda não tem (pedido registrado em
 * docs/cairo/coordenacao.md). Falhando, aparece como limitação conhecida e não conta como falha; passando, avisa que a
 * limitação foi resolvida e o caso pode virar um caso comum.
 */
interface Caso { nome: string; rodar: () => void; limitacao?: string }

// ---------- redução de gastos de verdade (análise inteira, 12 meses fechados) ----------
const PERFIL: Perfil = {
  nome: 'Teste', moeda: 'BRL', moedas: [], detalhe: 'detalhado',
  modulos: { dividas: true, contas: true, cartoes: true, bancos: true, investimentos: false, moedas: false, metas: true },
  dispensadas: [], onboarding_em: '2025-01-01T00:00:00Z',
}
/** Salário de 5.000 todo dia 5; `compras(ano, mes)` diz quantas compras e de quanto cada uma, no mês. */
function historico(compras: (ano: number, mes: number) => { n: number; valor: number }): EntradaAnalise {
  const lancs: Lancamento[] = []
  let id = 0
  for (let k = 2025 * 12 + 10; k <= 2026 * 12 + 9; k++) { // nov/2025 a out/2026
    const ano = Math.floor(k / 12), mes = (k % 12) + 1
    const d = (dia: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    lancs.push({ id: `e${id++}`, ano, mes, tipo: 'entrada', descricao: 'Salário', valor: 5000, data: d(5), created_at: `${d(5)}T12:00:00Z` })
    const c = compras(ano, mes)
    for (let i = 0; i < c.n; i++) {
      const dia = 1 + ((i * 7) % 28)
      lancs.push({ id: `s${id++}`, ano, mes, tipo: 'saida', descricao: `Compra ${i % 9}`, valor: c.valor, data: d(dia), created_at: `${d(dia)}T12:00:00Z` })
    }
  }
  return {
    hoje: new Date(2026, 10, 27), lancs, compras: [], cartoes: [], faturasPagas: [], contas: [], categorias: [], categoriaDe: () => '',
    dividas: [], saldos: [], pagamentos: [], taxas: {}, meses: [], metas: [], movimentosMeta: [], perfil: PERFIL,
  }
}
/** Os 3 últimos meses fechados (ago, set, out/2026) são os que mudam. */
const reduziu = (ano: number, mes: number) => ano === 2026 && mes >= 8


export const CASOS: Caso[] = [
  {
    nome: 'custos: as condições do Cairo na persona "dividas"',
    rodar() {
      const l = lerCairo(persona('dividas').e)
      const emp = custosDasCondicoes(l.condicoes, 'emp')
      igual('empréstimo: contrato informado de 4,55%', [emp.contrato.mes, emp.contrato.origem], [4.55, 'informada'])
      igual('antecipação: desconhecida (o app não pergunta)', emp.antecipacao, 'desconhecida')
      const mp = custosDasCondicoes(l.condicoes, 'mp')
      igual('Mercado Pago: só regra de atraso, contrato desconhecido', mp.contrato.mes, null)
      igual('Mercado Pago: oferta do credor (1.000 de 1.260)', [mp.banco?.quitar, mp.banco?.total], [1000, 1260])
      igual('juro de 250% ao mês recusado na fronteira: não vira contrato', custosDasCondicoes(l.condicoes, 'agiota').contrato.mes, null)
      // a oferta tem 22 dias em 27/11: confirmada com validade de 30 dias
      const q = quitacaoHoje({ hoje: HOJE, parcelas: [{ vence: '2026-10-01', valor: 1000 }], contrato: mp.contrato, encargosDoAtraso: 260, banco: mp.banco, antecipacao: mp.antecipacao })
      igual('quitação do Mercado Pago: o valor do credor', [q.estado, q.paraQuitar], ['confirmado', 1000])
      // o empréstimo: 12 × 110 desde 10/06; as que vencem depois de hoje têm desconto pelos 4,55%, nunca garantido
      const parcelas = Array.from({ length: 12 }, (_, i) => {
        const k = 2026 * 12 + 5 + i // junho/2026 em diante
        return { vence: `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}-10`, valor: 110 }
      })
      const qe = quitacaoHoje({ hoje: HOJE, parcelas: parcelas.filter((p) => p.vence > HOJE), contrato: emp.contrato, antecipacao: emp.antecipacao })
      igual('empréstimo: calculado e não garantido', [qe.estado, qe.minimoGarantido], ['calculado', 0])
      certo('empréstimo: desconto maior que zero', (qe.desconto ?? 0) > 0)
    },
  },
  {
    nome: 'cenários: o "e se" vem do atraso aprendido pelo Cairo',
    rodar() {
      const entradasDe = (nome: string) => {
        const l = lerCairo(persona(nome).e)
        const esperadas = l.cenarios.esperados.filter((f) => f.sentido === 'entra' && f.natureza === 'renda')
        return { l, entradas: esperadas.map((f) => ({ data: f.dia, valor: f.valor.centavos / 100, descricao: f.descricao })) }
      }
      const a = entradasDe('renda-atrasa')
      const ca = cenariosDaPrevisao(a.l, a.entradas, HOJE, a.l.cenarios.horizonte.ate)
      const atraso = ca.find((c) => c.adiar)
      certo(`renda que atrasa: tem cenário de atraso (${JSON.stringify(ca.map((c) => c.id))})`, atraso)
      certo(`de pelo menos 2 dias (deu ${atraso?.adiar?.dias})`, (atraso?.adiar?.dias ?? 0) >= 2)
      igual('origem: previsão', atraso?.origem, 'previsao')
      const e = entradasDe('estavel')
      igual('renda estável: nenhum cenário', cenariosDaPrevisao(e.l, e.entradas, HOJE, e.l.cenarios.horizonte.ate), [])
    },
  },
  {
    nome: 'caixa: devolução, crédito e transferência entre bolsos no formato do Cairo',
    rodar() {
      const f = (natureza: Fluxo['natureza'], sentido: Fluxo['sentido'], origem: Fluxo['origem'] = 'compromisso'): Fluxo => ({
        id: `${natureza}`, dia: '2026-12-05' as DiaISO, reveladoEm: '2026-12-05' as DiaISO, valor: { centavos: 40000, moeda: 'BRL' } as Fluxo['valor'],
        sentido, natureza, origem, ref: { refs: [], conhecidoEm: null, atualizadoEm: null }, tipo: 'x', descricao: natureza,
      })
      certo('a devolução de quem te deve entra no caixa quando cai', entraNoCaixa(f('a_receber', 'entra', 'previsto')))
      certo('o crédito recebido entra no caixa', entraNoCaixa(f('credito_recebido', 'entra')))
      certo('a transferência entre bolsos não', !entraNoCaixa(f('transferencia_propria', 'entra')))
      const o = { hoje: '2026-11-27' as DiaISO, conhecidos: [f('transferencia_propria', 'sai')], esperados: [f('a_receber', 'entra', 'previsto'), f('credito_recebido', 'entra'), f('renda', 'entra')] }
      const e = entradaDoObservado(o, { caixa: 0, ate: '2026-12-31' as DiaISO, pagos: new Set() })
      igual('o plano conta com renda e crédito contratado, não com o "me devem"', e.entradas.map((x) => x.descricao).sort(), ['credito_recebido', 'renda'])
      igual('transferência entre bolsos não vira conta a pagar', e.compromissos.length, 0)
      // na persona do João: nos mundos em que ele paga, o caixa final tem os 400 a mais
      const l = lerCairo(persona('me-devem').e)
      const { hoje, ate } = l.cenarios.horizonte
      const mundos = l.cenarios.gerar(40, 3)
      const paga = mundos.find((m) => m.fluxos.some((x) => x.natureza === 'a_receber'))
      const naoPaga = mundos.find((m) => !m.fluxos.some((x) => x.natureza === 'a_receber'))
      certo('há mundos em que o João paga e em que não paga', paga && naoPaga)
      const comJoao = { ...paga!, fluxos: paga!.fluxos }
      const semJoao = { ...paga!, fluxos: paga!.fluxos.filter((x) => x.natureza !== 'a_receber') }
      const dif = executarNoMundo(comJoao, l.cenarios.esperados, hoje, ate, 2000).caixa - executarNoMundo(semJoao, l.cenarios.esperados, hoje, ate, 2000).caixa
      certo(`a devolução muda o caixa (diferença ${dif.toFixed(2)})`, Math.abs(dif) > 1)
    },
  },
  {
    nome: 'redução de gastos: mesmas compras, mais baratas (60 → 30 cada)',
    rodar() {
      const a = analisar(historico((ano, mes) => ({ n: 40, valor: reduziu(ano, mes) ? 30 : 60 })))
      igual('os meses da redução contam', a.cairo!.qualidade.meses.filter((m) => m.mes >= '2026-08').map((m) => m.gastos), ['conta', 'conta', 'conta'])
      igual('o gasto médio é o de agora (40 × 30)', a.gastos, 1200)
      igual('a renda não muda', a.renda, 5000)
    },
  },
  {
    nome: 'redução de gastos: metade das compras (40 → 20 por mês)',
    rodar() {
      const a = analisar(historico((ano, mes) => ({ n: reduziu(ano, mes) ? 20 : 40, valor: 60 })))
      igual('os meses da redução contam', a.cairo!.qualidade.meses.filter((m) => m.mes >= '2026-08').map((m) => m.gastos), ['conta', 'conta', 'conta'])
      igual('o gasto médio é o de agora (20 × 60)', a.gastos, 1200)
    },
  },
  {
    nome: 'redução de gastos: corte forte e real (40 → 10 compras por mês, com o salário lançado)',
    limitacao: 'Mês com menos de 35% das saídas de um mês típico vira "parcial" (fora das médias), mesmo com a renda lançada e por 3 meses seguidos; o Consultor fica sem fluxo (sem nota nem plano). Pedido 7 em docs/cairo/coordenacao.md.',
    rodar() {
      const a = analisar(historico((ano, mes) => ({ n: reduziu(ano, mes) ? 10 : 40, valor: 60 })))
      igual('os meses da redução contam', a.cairo!.qualidade.meses.filter((m) => m.mes >= '2026-08').map((m) => m.gastos), ['conta', 'conta', 'conta'])
      igual('o gasto médio é o de agora (10 × 60)', a.gastos, 600)
      // hoje, com os 3 meses fora, o Consultor fica sem fluxo: sem nota, sem plano, para quem acabou de cortar gastos
      certo('o Consultor continua com nota e plano', a.temFluxo && a.acoes.length > 0)
    },
  },
  {
    nome: 'redução de gastos: um mês mal lançado continua fora (para comparar com o corte real)',
    rodar() {
      // 40 compras todo mês, menos setembro, em que só 5 foram lançadas
      const resumo = (mes: string, n: number): ResumoDoMes => ({ chave: Number(mes.replace('-', '')), mes: mes as ResumoDoMes['mes'], nEntradas: 1, nSaidas: n, esperavaEntradaFixa: false })
      const q = qualidadeDosMeses(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((m) => resumo(m, m === '2026-09' ? 5 : 40)))
      igual('setembro sai das médias', q.map((x) => x.gastos), ['conta', 'conta', 'conta', 'parcial', 'conta'])
    },
  },
  {
    nome: 'não-antecipação: o mesmo passado observado dá as mesmas decisões',
    rodar() {
      let pares = 0
      for (const nome of ['renda-atrasa', 'me-devem', 'dividas', 'estavel']) {
        const l = lerCairo(persona(nome).e)
        const { hoje, ate } = l.cenarios.horizonte
        const mundos = l.cenarios.gerar(6, 42)
        for (let i = 0; i + 1 < mundos.length; i += 2) {
          for (const corte of [somarDias(hoje, 3), somarDias(hoje, 10), somarDias(hoje, 20)]) {
            if (corte > ate) continue
            const a = mundos[i], c = trocarFuturo(mundos[i], mundos[i + 1], corte)
            const da = executarNoMundo(a, l.cenarios.esperados, hoje, ate, 2000)
            const dc = executarNoMundo(c, l.cenarios.esperados, hoje, ate, 2000)
            igual(`${nome}, mundos ${i}/${i + 1}, até ${corte}`, da.decisoes.filter((x) => x.dia <= corte), dc.decisoes.filter((x) => x.dia <= corte))
            pares++
          }
        }
      }
      certo(`pares conferidos (${pares})`, pares >= 20)
    },
  },
  {
    nome: 'execução: em nenhum mundo o plano manda pagar sem dinheiro',
    rodar() {
      let mundos = 0, pagamentos = 0
      for (const p of lista) {
        const l = lerCairo(p.e)
        const { hoje, ate } = l.cenarios.horizonte
        for (const m of l.cenarios.gerar(5, 7)) {
          const r = executarNoMundo(m, l.cenarios.esperados, hoje, ate, 1000)
          igual(`${p.nome} mundo ${m.indice}: pagou sem ter`, r.pagouSemTer, 0)
          pagamentos += r.decisoes.reduce((s, d) => s + d.pagar.length, 0)
          mundos++
        }
      }
      certo(`mundos executados (${mundos}) com pagamentos (${pagamentos})`, mundos >= 40 && pagamentos > 0)
    },
  },
]

export function rodar(filtro?: string): number {
  let falhas = 0
  const casos = CASOS.filter((c) => !filtro || c.nome.includes(filtro))
  let limitacoes = 0
  for (const c of casos) {
    try {
      c.rodar()
      if (c.limitacao) console.log(`✓ ${c.nome}\n    a limitação conhecida foi resolvida: transforme em caso comum (${c.limitacao})`)
      else if (filtro) console.log(`✓ ${c.nome}`)
    } catch (e) {
      if (c.limitacao && e instanceof Falha) {
        limitacoes++
        console.log(`⚠ limitação conhecida: ${c.nome}\n    ${e.message}\n    ${c.limitacao}`)
        continue
      }
      falhas++
      console.log(`✗ ${c.nome}\n    ${e instanceof Falha ? e.message : e instanceof Error ? e.stack : e}`)
    }
  }
  console.log(`\n${casos.length - falhas - limitacoes} de ${casos.length} casos certos${limitacoes ? `, ${limitacoes} limitação conhecida` : ''}`)
  return falhas
}
