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
import { entradaDoObservado, idDeBase } from '../../../src/lib/decisoes/observado'
import { simularPagamentos } from '../../../src/lib/planejador'
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
      if (f.sentido === 'entra' && f.natureza === 'renda' && f.dia <= dia && !recebidos.has(f.id)) { caixa += f.valor.centavos / 100; recebidos.add(f.id) }
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

interface Caso { nome: string; rodar: () => void }

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
