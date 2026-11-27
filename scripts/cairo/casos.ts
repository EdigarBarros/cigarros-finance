/**
 * Casos do Cairo (parte de dados). Rodados por scripts/cairo/testar.mjs. Personas em ./personas.ts.
 */
import { lerCairo, revelar, trocarFuturo, type Fluxo, type Mundo } from '../../src/cairo'
import {
  centavosDe, converterTaxa, diaDaSemana, doNumero, ErroDeUnidade, lerDia, numero, somar, type DiaISO, type MesISO, type Moeda,
} from '../../src/cairo/contrato/unidades'
import { lerTaxaFracao, lerTaxaPercentual, lerValor } from '../../src/cairo/contrato/validar'
import { qualidadeDosMeses, mesEntraNoFluxo } from '../../src/cairo/qualidade/meses'
import { detectarQuebra } from '../../src/cairo/aprendizado/quebras'
import { proporcao, suavizar } from '../../src/cairo/aprendizado/evidencia'
import { avaliarDiaADia } from '../../src/cairo/regua/regua'
import { montarHistorico } from '../../src/cairo/fatos/historico'
import { personas, type Persona } from './personas'

let falhas = 0
let ok = 0
const igual = <T>(nome: string, obtido: T, esperado: T) => {
  const a = JSON.stringify(obtido); const b = JSON.stringify(esperado)
  if (a === b) ok++
  else { falhas++; console.error(`  FALHOU ${nome}\n    obtido:   ${a}\n    esperado: ${b}`) }
}
const certo = (nome: string, v: unknown) => igual(nome, Boolean(v), true)
const perto = (nome: string, obtido: number | null | undefined, esperado: number, tol = 0.005) => {
  if (typeof obtido === 'number' && Math.abs(obtido - esperado) <= tol) ok++
  else { falhas++; console.error(`  FALHOU ${nome}: ${obtido} ≠ ${esperado} (±${tol})`) }
}
const lanca = (nome: string, f: () => unknown) => { try { f(); falhas++; console.error(`  FALHOU ${nome}: não lançou`) } catch (e) { if (e instanceof ErroDeUnidade) ok++; else { falhas++; console.error(`  FALHOU ${nome}: lançou outro erro`, e) } } }

const P = () => new Map(personas().map((p) => [p.nome, p] as const))
const leitura = (p: Persona) => lerCairo(p.e)
const BRL = 'BRL' as Moeda

const casos: { nome: string; rodar: () => void }[] = [
  {
    nome: 'unidades: dinheiro, datas e taxas',
    rodar() {
      igual('meio centavo arredonda para longe do zero', [centavosDe(0.005), centavosDe(-0.005), centavosDe(10.1)], [1, -1, 1010])
      lanca('somar moedas diferentes é erro', () => somar({ centavos: centavosDe(1), moeda: BRL }, { centavos: centavosDe(1), moeda: 'USD' as Moeda }))
      igual('30/02 não existe', lerDia('2026-02-30'), null)
      igual('29/02 de ano bissexto existe', lerDia('2028-02-29'), '2028-02-29')
      let voltas = true
      for (let n = numero('1999-12-25' as DiaISO); n < numero('2031-03-01' as DiaISO); n += 37) if (numero(doNumero(n)) !== n) voltas = false
      certo('número do dia vai e volta', voltas)
      igual('27/11/2026 é sexta', diaDaSemana('2026-11-27' as DiaISO), 5)
      perto('0,7% ao dia simples = 21% ao mês', converterTaxa({ fracao: 0.007, periodo: 'dia', regime: 'simples' }, 'mes').fracao, 0.21, 1e-9)
      perto('1% ao dia composta ≈ 34,78% ao mês', converterTaxa({ fracao: 0.01, periodo: 'dia', regime: 'composta' }, 'mes').fracao, 0.347849, 1e-5)
      perto('4,55% ao mês composta = 1,0455^12 − 1 ≈ 70,56% ao ano', converterTaxa({ fracao: 0.0455, periodo: 'mes', regime: 'composta' }, 'ano').fracao, 0.705644, 1e-5)
    },
  },
  {
    nome: 'validar: a fronteira converte percentual uma vez e recusa troca de unidade',
    rodar() {
      const t = lerTaxaPercentual(2.5, 'mes', 'composta')
      igual('2,5 (percentual) vira 0,025', t.ok && t.valor.fracao, 0.025)
      const errada = lerTaxaPercentual(250, 'mes', 'composta')
      igual('250% ao mês é recusada (percentual lido como fração)', errada.ok ? 'passou' : errada.erros[0].codigo, 'taxa.implausivel')
      const dia = lerTaxaFracao(0.007, 'dia', 'simples')
      igual('0,7% ao dia (fração) passa', dia.ok && dia.valor.fracao, 0.007)
      const alta = lerTaxaPercentual(14, 'mes', 'composta')
      igual('14% ao mês passa, mas pede confirmação? (não: abaixo de 25%)', alta.ok && alta.avisos.length, 0)
      const rot = lerTaxaPercentual(30, 'mes', 'composta')
      igual('30% ao mês passa com aviso', rot.ok && rot.avisos[0].codigo, 'taxa.alta-confirmar')
      const dia5 = lerTaxaPercentual(5, 'dia', 'simples', '', 10)
      igual('regra de atraso de 5% ao dia passa com aviso (é cobrança de verdade)', dia5.ok && dia5.avisos[0]?.codigo, 'taxa.alta-confirmar')
      igual('mas como juro de contrato, 5% ao dia é recusado', lerTaxaPercentual(5, 'dia', 'simples').ok, false)
      const v = lerValor(10.005, BRL)
      igual('fração de centavo vira aviso', v.ok && v.avisos[0]?.codigo, 'valor.fracao-de-centavo')
      igual('valor não numérico é erro', lerValor('12' as unknown as number, BRL).ok, false)
    },
  },
  {
    nome: 'qualidade: mês sem registro, mês sem renda, mês mal lançado',
    rodar() {
      const r = (chave: number, nEntradas: number, nSaidas: number, esperavaEntradaFixa = false) => ({ chave, mes: `2026-0${chave}` as MesISO, nEntradas, nSaidas, esperavaEntradaFixa })
      const q = qualidadeDosMeses([r(1, 1, 30), r(2, 1, 28), r(3, 0, 31), r(4, 1, 3), r(5, 0, 0), r(6, 0, 29, true)])
      igual('as classes', q.map((x) => `${x.gastos}/${x.renda}`), ['conta/conta', 'conta/conta', 'conta/zero_real', 'parcial/conta', 'sem_registros/sem_registros', 'conta/nao_registrada'])
      igual('entram no fluxo: os bons e o mês sem renda', q.map(mesEntraNoFluxo), [true, true, true, false, false, false])
      // quem nunca lança renda: mês sem entrada não é "sem renda"
      const nunca = qualidadeDosMeses([1, 2, 3].map((k) => r(k, 0, 20)))
      igual('sem costume de lançar renda: não registrada', nunca.map((x) => x.renda), ['nao_registrada', 'nao_registrada', 'nao_registrada'])
      const ps = P()
      const semRenda = leitura(ps.get('mes-sem-renda')!).qualidade.meses.find((m) => m.mes === '2026-06')!
      igual('persona: junho sem freela e com gastos = renda zero de verdade', semRenda.renda, 'zero_real')
      const mal = leitura(ps.get('mal-lancado')!).qualidade.meses
      igual('persona: março mal lançado', mal.find((m) => m.mes === '2026-03')?.gastos, 'parcial')
      igual('persona: março, salário sem baixa: não registrada', mal.find((m) => m.mes === '2026-03')?.renda, 'nao_registrada')
      igual('persona: dezembro vazio', mal.find((m) => m.mes === '2025-12')?.gastos, 'sem_registros')
      const mudou = leitura(ps.get('mudou')!).qualidade
      certo('persona: muito lançado dias depois é visto', mudou.lancadosDepois.fracao > 0.3)
      certo('persona: e vira aviso', mudou.avisos.some((a) => a.codigo === 'dados.muitos-lancados-depois'))
      const est = leitura(ps.get('estavel')!).qualidade.saldo
      igual('saldo "de novembro" vale até 30/11 e tem até 26 dias', [est.validoAte, est.idadeMaximaDias], ['2026-11-30', 26])
    },
  },
  {
    nome: 'contagem: cada real uma vez',
    rodar() {
      for (const p of personas()) {
        const c = leitura(p).contagem
        igual(`${p.nome}: nenhuma violação`, c.violacoes, [])
      }
      const ps = P()
      const div = leitura(ps.get('dividas')!).contagem
      certo('fatura paga e lançada também como saída: aviso', div.avisos.some((a) => a.codigo === 'contagem.fatura-lancada-como-gasto' && a.refs.includes('lancamentos:dobro')))
      const h = montarHistorico(ps.get('me-devem')!.e)
      igual('emprestar e receber de volta não é gasto nem renda', ['emprestei', 'devolveu'].map((id) => h.lancs.find((l) => l.id === id)?.classe), ['emprestimo_concedido', 'devolucao_recebida'])
      const b = montarHistorico(ps.get('bolsos')!.e)
      igual('caixinha e transferência: fora; reserva do hotel: gasto', ['cx', 'tr', 'hotel'].map((id) => b.lancs.find((l) => l.id === id)?.classe), ['transferencia_propria', 'transferencia_propria', 'gasto'])
      certo('"Padaria 123" várias vezes no mês é dia a dia, não recorrência', b.lancs.filter((l) => l.descricao.startsWith('Padaria')).every((l) => l.diaADia))
      certo('aluguel de conta fixa não é dia a dia', montarHistorico(ps.get('estavel')!.e).lancs.filter((l) => l.descricao === 'Aluguel').every((l) => !l.diaADia))
    },
  },
  {
    nome: 'aprendizado: suavização, proporção e mudança de comportamento',
    rodar() {
      const s = suavizar([{ valor: 10, peso: 1 }, { valor: 10, peso: 1 }], 0, 4)
      perto('2 observações com k = 4: o histórico pesa 1/3', s.pesoDoHistorico, 1 / 3, 1e-9)
      perto('e o valor fica a 1/3 do caminho', s.valor, 10 / 3, 1e-9)
      const p = proporcao(1, 3, 0.5, 2)
      perto('1 de 3 com prior 0,5 e força 2 = 0,4', p.p, 0.4, 1e-9)
      certo('faixa larga com pouca evidência', p.p90 - p.p10 > 0.3)
      igual('série plana: sem mudança', detectarQuebra([100, 104, 98, 101, 99, 102, 100, 97]), null)
      const q = detectarQuebra([100, 104, 98, 101, 99, 200, 205, 198, 202])
      igual('o nível dobrou: mudança no 6º mês', q?.inicio, 5)
      igual('um mês fora da curva sozinho não é mudança', detectarQuebra([100, 104, 98, 101, 300, 102, 100, 97]), null)
      const ps = P()
      const mud = leitura(ps.get('mudou')!).aprendizado.diaADia!
      igual('persona: o dia a dia mudou em junho/2026', mud.quebra?.mes, '2026-06')
      igual('persona estável: sem mudança', leitura(ps.get('estavel')!).aprendizado.diaADia!.quebra, null)
      const est = leitura(ps.get('estavel')!).aprendizado.diaADia!
      certo('persona estável: muitos dias de evidência', est.nEf > 100)
    },
  },
  {
    nome: 'aprendizado: renda que atrasa e quem te deve',
    rodar() {
      const ps = P()
      const est = leitura(ps.get('estavel')!).aprendizado.entradas.find((f) => f.chave === 'conta:cf-sal')!
      igual('estável: cai no dia (p50 = p90 = 0)', [est.atraso.dist.quantis.p50, est.atraso.dist.quantis.p90], [0, 0])
      certo('estável: chance pequena de não vir', est.pNaoOcorre < 0.05)
      const atr = leitura(ps.get('renda-atrasa')!).aprendizado.entradas.find((f) => f.chave === 'conta:cf-sal')!
      igual('renda que atrasa: a mediana ainda é no dia', atr.atraso.dist.quantis.p50, 0)
      certo('renda que atrasa: o p90 mostra o atraso (2 dias ou mais)', (atr.atraso.dist.quantis.p90 ?? 0) >= 2)
      // 12 meses, mas os antigos pesam menos (meia-vida de 180 dias): a massa fica perto de 7, contra a força 3 da referência
      certo('o histórico já pesa mais que a referência', atr.atraso.pesoDoHistorico > 0.6 && atr.atraso.pesoDoHistorico < 0.8)
      const fr = leitura(ps.get('mes-sem-renda')!).aprendizado.entradas.find((f) => f.chave.startsWith('desc:'))
      certo('freela sem conta fixa é reconhecido pela descrição', fr && fr.origem === 'detectada')
      certo('e o mês em que não veio aumenta a chance de faltar', fr && fr.pNaoOcorre > 0.05)
      const joao = leitura(ps.get('me-devem')!).aprendizado.pontualidade[0]
      igual('João: cumpriu 1 de 3 (pagar depois não é no combinado)', [joao.cumpridas, joao.vencidas], [1, 3])
      perto('chance de pagar no dia, puxada para 0,5', joao.p, 0.4, 1e-9)
    },
  },
  {
    nome: 'condições de custo: contrato, atraso, antecipação e quitação separados',
    rodar() {
      const c = leitura(P().get('dividas')!)
      const emp = c.condicoes.filter((x) => x.divida === 'emp')
      const contratual = emp.find((x) => x.tipo === 'contratual')
      perto('juros do contrato 4,55% viram fração ao mês', contratual?.tipo === 'contratual' ? contratual.taxa.fracao : null, 0.0455, 1e-12)
      const fluxo = emp.find((x) => x.tipo === 'fluxo_do_contrato')
      igual('fatos do contrato: recebeu 1000, 12 parcelas, sem a data do recebimento', fluxo?.tipo === 'fluxo_do_contrato' ? [fluxo.recebido.centavos, fluxo.parcelas.length, fluxo.recebidoEm] : null, [100000, 12, null])
      igual('antecipar: o app não sabe o que o contrato diz', emp.find((x) => x.tipo === 'antecipacao')?.tipo === 'antecipacao' ? (emp.find((x) => x.tipo === 'antecipacao') as { regra: string }).regra : null, 'desconhecida')
      const mp = c.condicoes.filter((x) => x.divida === 'mp')
      igual('Mercado Pago: atraso informado e aprendido, nenhum contratual', mp.map((x) => `${x.tipo}:${'fonte' in x ? x.fonte : ''}`).sort(), ['antecipacao:', 'atraso:aprendida', 'atraso:informada', 'oferta_quitacao:'])
      const inf = mp.find((x) => x.tipo === 'atraso' && x.fonte === 'informada')
      igual('regra informada: 0,4% ao dia simples, multa 2%', inf?.tipo === 'atraso' ? [inf.mora?.fracao, inf.mora?.periodo, inf.mora?.regime, inf.multa] : null, [0.004, 'dia', 'simples', 0.02])
      const of = mp.find((x) => x.tipo === 'oferta_quitacao')
      igual('oferta de quitação: 1000 de 1260', of?.tipo === 'oferta_quitacao' ? [of.valor.centavos, of.total.centavos] : null, [100000, 126000])
      certo('juros da fatura viram encargo', c.condicoes.some((x) => x.tipo === 'encargo' && x.valor.centavos === 3540))
      certo('250% ao mês: recusado, sem condição contratual', !c.condicoes.some((x) => x.divida === 'agiota' && x.tipo === 'contratual'))
      certo('e vira aviso com o motivo', c.avisos.some((a) => a.codigo === 'taxa.implausivel' && a.refs.includes('dividas:agiota')))
      const usd = leitura(P().get('bolsos')!).condicoes.find((x) => x.divida === 'usd' && x.tipo === 'contratual')
      certo('moeda da dívida em minúsculas é lida (usd → USD) e a taxa não depende dela', usd && usd.tipo === 'contratual' && usd.taxa.fracao === 0.012)
    },
  },
  {
    nome: 'cenarios: compromisso, previsão e o que se revela',
    rodar() {
      const ps = P()
      const c = leitura(ps.get('renda-atrasa')!)
      const g = c.cenarios
      const a = g.gerar(50, 42)
      igual('mesma semente, mesmos mundos', JSON.stringify(g.gerar(50, 42)) === JSON.stringify(a), true)
      certo('semente diferente, mundos diferentes', JSON.stringify(g.gerar(50, 43)) !== JSON.stringify(a))
      const salarios = a.map((m) => m.fluxos.find((f) => f.tipo === 'conta-fixa' && f.sentido === 'entra')?.dia ?? 'nao-veio')
      certo('em alguns mundos o salário atrasa', salarios.some((d) => d !== 'nao-veio' && d > '2026-12-05'))
      certo('na maioria cai no dia', salarios.filter((d) => d === '2026-12-05').length > 25)
      const aluguel = a.map((m) => m.fluxos.find((f) => f.descricao === 'Aluguel'))
      certo('aluguel é compromisso conhecido desde hoje em todo mundo', aluguel.every((f) => f && f.origem === 'compromisso' && f.reveladoEm === '2026-11-27' && f.dia === '2026-12-10'))
      // a política no dia 03/12 não pode saber se o salário do dia 05 vai atrasar
      const dia = '2026-12-03' as DiaISO
      for (const m of a.slice(0, 10)) {
        const o = revelar(m, g.esperados, dia)
        certo(`mundo ${m.indice}: só vê o que já se revelou`, o.conhecidos.every((f) => f.reveladoEm <= dia))
        igual(`mundo ${m.indice}: os esperados são iguais em todo mundo`, JSON.stringify(o.esperados), JSON.stringify(revelar(a[0], g.esperados, dia).esperados))
      }
      // depois do dia 05, quem não recebeu continua esperando o salário (atrasado)
      const atrasado = a.find((m) => (m.fluxos.find((f) => f.tipo === 'conta-fixa' && f.sentido === 'entra')?.dia ?? '9') > '2026-12-06')
      if (atrasado) {
        const o = revelar(atrasado, g.esperados, '2026-12-06' as DiaISO)
        const sal = o.esperados.find((f) => f.tipo === 'conta-fixa')
        igual('o salário atrasado continua esperado, a partir de amanhã', [sal?.dia, sal?.esperadoEm], ['2026-12-07', '2026-12-05'])
      }
      // o par do teste de não-antecipação: igual até o dia, diferente depois
      const [m1, m2] = [a[0], a.find((m) => JSON.stringify(m.fluxos) !== JSON.stringify(a[0].fluxos))!]
      const t = trocarFuturo(m1, m2, dia)
      igual('trocar o futuro não muda o que se sabe até o dia', JSON.stringify(revelar(t, g.esperados, dia)), JSON.stringify(revelar(m1, g.esperados, dia)))
      certo('e muda depois', JSON.stringify(t.fluxos) !== JSON.stringify(m1.fluxos))
      // me devem: nunca disponível antes de cair, e com a chance da pessoa
      const md = leitura(ps.get('me-devem')!)
      const mundos: Mundo[] = md.cenarios.gerar(400, 7)
      const joao = mundos.map((m) => m.fluxos.find((f) => f.natureza === 'a_receber'))
      perto('o João paga no dia em ~40% dos mundos', joao.filter(Boolean).length / 400, 0.4, 0.07)
      certo('quando paga, só se sabe no dia', joao.filter(Boolean).every((f) => (f as Fluxo).reveladoEm === (f as Fluxo).dia))
      const esp = md.cenarios.esperados.find((f) => f.natureza === 'a_receber')
      perto('nos esperados, o João vem com a chance dele', esp?.pOcorre, 0.4, 1e-9)
      // o dia a dia: só de amanhã em diante, e o pico depois do salário anda junto com ele
      certo('dia a dia só depois de hoje', a.every((m) => m.fluxos.filter((f) => f.natureza === 'dia_a_dia').every((f) => f.dia > '2026-11-27')))
    },
  },
  {
    nome: 'previsoes: faixas em ordem e sem calibração declarada',
    rodar() {
      const c = leitura(P().get('estavel')!)
      const pr = c.previsoes().diaADiaRestoDoMes!
      const q = pr.dist.quantis
      certo('p05 ≤ p10 ≤ p50 ≤ p90 ≤ p95', q.p05! <= q.p10! && q.p10! <= q.p50! && q.p50! <= q.p90! && q.p90! <= q.p95!)
      igual('sem calibração com dados reais, a cobertura fica nula', pr.dist.calibracao.cobertura80, null)
      certo('o mês que vem também tem faixa', c.previsoes().diaADiaMesQueVem !== null)
      igual('a previsão é a mesma em duas leituras (semente do dia)', JSON.stringify(lerCairo(P().get('estavel')!.e).previsoes()), JSON.stringify(c.previsoes()))
    },
  },
  {
    nome: 'regua: só usa o que se sabia, e a ficha diz os limites',
    rodar() {
      const p = P().get('mudou')!
      const r = avaliarDiaADia(p.e, ['2026-09-15' as DiaISO], 100)
      certo('um ponto avaliado', r.pontos.length === 1)
      certo('a ficha registra o lançado depois', r.ficha.lancadosDepoisFracao > 0.3)
      igual('a ficha avisa que não há histórico de edições', r.ficha.semHistoricoDeEdicoes, true)
      // vazamento: o que foi criado depois do corte não pode entrar
      const h = montarHistorico({ ...p.e, hoje: '2026-09-15' }, '2026-09-15' as DiaISO)
      certo('nada criado depois do corte entra no histórico do corte', h.lancs.every((l) => !l.conhecidoEm || l.conhecidoEm <= '2026-09-15'))
    },
  },
]

export async function rodar(filtro?: string) {
  for (const c of casos) {
    if (filtro && !c.nome.includes(filtro)) continue
    const antes = falhas
    try { c.rodar() } catch (e) { falhas++; console.error(`  ERRO em "${c.nome}":`, e) }
    console.log(`${falhas === antes ? 'ok  ' : 'FALHA'} ${c.nome}`)
  }
  console.log(`\n${ok} verificações certas, ${falhas} falhas`)
  return falhas
}

/** A régua nas personas: imprime o erro de cada método e a ficha de vazamento. */
export async function regua() {
  const fmt = (c: number) => `R$ ${(c / 100).toFixed(0)}`
  for (const p of personas()) {
    const r = avaliarDiaADia(p.e)
    const linhas = Object.entries(r.metodos).map(([n, m]) => `${n.padEnd(13)} erro médio ${fmt(m.erroMedio).padStart(8)} (${(m.erroRelativo * 100).toFixed(1)}%)`)
    console.log(`\n${p.nome} — ${r.pontos.length} cortes`)
    for (const l of linhas) console.log(`  ${l}`)
    if (r.cobertura80 !== null) console.log(`  faixa de 80% do Cairo: cobriu ${(r.cobertura80 * 100).toFixed(0)}% dos casos, largura ${(r.larguraRelativa! * 100).toFixed(0)}% do gasto`)
    console.log(`  ficha: ${r.ficha.aviso}; lançado depois ${(r.ficha.lancadosDepoisFracao * 100).toFixed(0)}%; ordem estável: ${r.ficha.ordemEstavel}`)
  }
  return 0
}
