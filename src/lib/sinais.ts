/**
 * Os sinais de comportamento: o que o consultor percebe no JEITO de a pessoa usar o dinheiro, e não só na foto do mês.
 * Puro, como o motor (lib/analise.ts chama no fim da análise; lib/achados.ts mostra cada sinal como uma descoberta).
 *
 * - Ritmo da dívida: quanto de dívida nova entrou contra quanto foi pago, mês a mês.
 * - Dívida sobre dívida: dívida ou parcelamento novo enquanto já há atraso ou dívida cara.
 * - Futuro já gasto: quanto do que entra nos próximos meses já sai para parcelas.
 * - Gasto miúdo contra dívida cara: o pouco que se repete muito (app de corrida, padaria) lado a lado com o atrasado.
 * - Promessas: pagamento remarcado ou não cumprido (e, em "me devem", quem cumpre o combinado).
 * - Pular compra e pagar só parte da fatura: sinais de aperto que empurram a conta para a frente.
 * - Juros de verdade (lib/jurosAprendido.ts) e o desconto para quitar.
 * - Frescor: há quanto tempo nada é lançado (os números podem estar velhos).
 *
 * Cada sinal traz o fato, o que ele custa (traduzido em dias do que a pessoa ganha, quando dá) e uma ação. A FIRMEZA, que a
 * pessoa escolhe, muda só o "chamado" no fim: gentil, direto ou sem filtro. O fato é o mesmo nos três.
 */
import type { Dado } from './achados'
import type { Acao, Tom } from './analise'
import type { Destino } from './conselheiro'
import { aumentaDivida, calendarioDe, promessasDe, situacaoDividas, type Calendario } from './dividas'
import type { Taxas } from './moedas'
import { fmtDataCurta, fmtTaxa, fmtValor, MESES_NOME } from './format'
import { diasEntre } from './jurosAtraso'
import { aprenderJuros, descontoParaQuitar } from './jurosAprendido'
import { tx } from './textos'
import type { ConferenciaDivida, Divida, FaturaPaga, FaturaParcial, Lancamento, Pagamento, SaldoDivida } from './types'

/** Como o consultor fala: a pessoa escolhe (fica na memória do consultor). */
export type Firmeza = 'gentil' | 'direto' | 'sem-filtro'
export const FIRMEZAS: { id: Firmeza; nome: () => string; descricao: () => string }[] = [
  { id: 'gentil', nome: () => tx('Gentil'), descricao: () => tx('Mostro os números com calma, sem pressionar.') },
  { id: 'direto', nome: () => tx('Direto'), descricao: () => tx('Falo o que vejo e o que eu faria no seu lugar.') },
  { id: 'sem-filtro', nome: () => tx('Sem filtro'), descricao: () => tx('Falo na lata, como um amigo que não passa pano.') },
]
export const FIRMEZA_PADRAO: Firmeza = 'direto'

export interface Sinal {
  id: string
  tema: 'dividas' | 'gastos' | 'mes' | 'como'
  tom: Tom
  /** 0 a 100: quanto vale dizer isso hoje. */
  forca: number
  titulo: string
  /** O fato, com o número (e a tradução, quando dá). */
  frase: string
  /** O que fazer, no tom que a pessoa escolheu. */
  chamado: string
  destino: Destino
  dado: Dado
  /** O passo que entra no plano de ação (sem ele, o sinal é só uma descoberta). */
  acao?: Omit<Acao, 'id' | 'destino'> & { destino?: Destino }
  /** Os números por trás, para "Por que estou vendo isso?". */
  dados: { rotulo: string; valor: string }[]
  periodo: string
  confianca: 'alta' | 'media' | 'baixa'
}

export interface EntradaSinais {
  hojeIso: string
  /** A média do que entra por mês (0 sem fluxo conhecido). */
  renda: number
  /** Lançamentos dos meses da análise (com os empréstimos). */
  lancs: Lancamento[]
  /** Compras no cartão (cada parcela é uma linha), sem as de outra pessoa. */
  compras: Lancamento[]
  faturasPagas: FaturaPaga[]
  faturasParciais: FaturaParcial[]
  /** Todas as dívidas (as suas e "me devem"), com as promessas. */
  dividas: Divida[]
  saldos: SaldoDivida[]
  pagamentos: Pagamento[]
  taxas: Taxas
  conferencias: ConferenciaDivida[]
  firmeza: Firmeza
  /** O primeiro nome da pessoa, para o "sem filtro". */
  nome: string
  /** Lançamentos por mês, em média: para saber se ela costuma lançar. */
  lancamentosPorMes: number
  /** Juros ao mês a partir do qual uma dívida é cara. */
  jurosCaro: number
}

const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const chave = (ano: number, mes: number) => ano * 12 + (mes - 1)
const doChave = (k: number) => ({ ano: Math.floor(k / 12), mes: (k % 12) + 1 })
const peso = (valor: number, base: number, cheio: number) => (base > 0 ? Math.min(1, Math.abs(valor) / base / cheio) : 0)
const nomeMes = (mes: number) => MESES_NOME[mes - 1].toLowerCase()
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\d+\s*\/\s*\d+/g, '').replace(/\s+/g, ' ').trim()

/**
 * O dinheiro traduzido em algo que se sente: "4 dias do que você ganha". Só com renda conhecida e quando o número é grande o
 * bastante para fazer sentido (a partir de meio dia).
 */
export function emDiasDeRenda(valor: number, renda: number): string | null {
  if (!(renda > 0) || !(valor > 0)) return null
  const dias = valor / (renda / 30)
  if (dias < 0.5) return null
  if (dias >= 45) {
    const meses = Math.round((dias / 30) * 10) / 10
    return meses === 1 ? tx('um mês inteiro do que você ganha') : tx('{0} meses do que você ganha', fmtTaxa(meses))
  }
  const n = Math.max(1, Math.round(dias))
  return n === 1 ? tx('1 dia do que você ganha') : tx('{0} dias do que você ganha', n)
}

/** O chamado no tom escolhido. */
export const chamar = (f: Firmeza, gentil: string, direto: string, semFiltro: string) => (f === 'gentil' ? gentil : f === 'sem-filtro' ? semFiltro : direto)

/** As compras parceladas no cartão, uma por compra: quando foi feita, quanto custa no total e o valor de cada parcela. */
function parcelamentos(compras: Lancamento[]) {
  const porCompra = new Map<string, { descricao: string; feita: string; parcela: number; parcelas: number; total: number; ultima: number }>()
  for (const l of compras) {
    if (!l.compra_id || (l.parcelas ?? 1) <= 1) continue
    const feita = l.data_compra ?? l.data ?? `${l.ano}-${String(l.mes).padStart(2, '0')}-01`
    const k = chave(l.ano, l.mes)
    const c = porCompra.get(l.compra_id)
    if (!c) porCompra.set(l.compra_id, { descricao: l.descricao.replace(/\s*\(?\d+\s*\/\s*\d+\)?\s*$/, '').trim(), feita, parcela: l.valor, parcelas: l.parcelas ?? 1, total: 0, ultima: k })
    const x = porCompra.get(l.compra_id)!
    x.total = centavos(x.total + l.valor)
    x.ultima = Math.max(x.ultima, k)
    if (feita < x.feita) x.feita = feita
  }
  return [...porCompra.values()]
}

export function sinaisDe(e: EntradaSinais): Sinal[] {
  const hoje = e.hojeIso
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  const atual = chave(ano, mes)
  const f = e.firmeza
  const nome = e.nome.trim().split(/\s+/)[0] ?? ''
  const comNome = (frase: string) => (nome ? tx('{0}, {1}', nome, frase) : frase.charAt(0).toUpperCase() + frase.slice(1))
  const out: Sinal[] = []
  // a dívida em espera (a pessoa não vai pagar agora) não entra nos sinais
  const devo = e.dividas.filter((d) => (d.sentido ?? 'devo') === 'devo' && !d.em_espera)
  const situacoesDe = (k: number) => {
    const m = doChave(k)
    return situacaoDividas(devo, e.saldos, e.pagamentos, m.ano, m.mes, e.taxas, hoje).filter((s) => !s.semCotacao)
  }
  const abertas = situacoesDe(atual).filter((s) => s.restante > 0)
  const calendarios = new Map<string, Calendario | null>(abertas.map((s) => [s.divida.id, calendarioDe(s, hoje)]))
  const atrasadas = abertas.filter((s) => (calendarios.get(s.divida.id)?.atrasadas.length ?? 0) > 0)
  const caras = abertas.filter((s) => (s.divida.juros_mes ?? 0) >= e.jurosCaro || (s.atraso?.diario ?? 0) > 0)
  const compras = parcelamentos(e.compras)
  const traduz = (v: number) => emDiasDeRenda(v, e.renda)

  // ---------- ritmo da dívida: dívida nova × dívida paga, nos últimos 3 meses ----------
  {
    const meses = [atual - 2, atual - 1, atual].map((k) => {
      const sits = situacoesDe(k)
      const m = doChave(k)
      const noMes = (iso: string | null | undefined) => Boolean(iso && chave(Number(iso.slice(0, 4)), Number(iso.slice(5, 7))) === k)
      // dívida que nasceu no mês (não existia no fim do anterior) entra pelo que valia, mais o que já foi pago dela
      const nasceu = soma(sits.filter((s) => s.restanteAntes === null && noMes(s.inicioEm)).map((s) => s.restante + s.pagoNoMes))
      const aumentou = soma(sits.filter((s) => s.restanteAntes !== null).map((s) => s.aumentoNoMes))
      const parcelou = soma(compras.filter((c) => noMes(c.feita)).map((c) => c.total))
      const pagouDividas = soma(sits.map((s) => s.pagoNoMes))
      // parcelas do cartão que venceram numa fatura já paga: é dívida de compra parcelada indo embora
      const pagouCartao = soma(e.compras.filter((l) => l.compra_id && (l.parcelas ?? 1) > 1 && l.ano === m.ano && l.mes === m.mes
        && e.faturasPagas.some((p) => p.cartao_id === l.cartao_id && p.ano === l.ano && p.mes === l.mes)).map((l) => l.valor))
      return { ...m, nova: centavos(nasceu + aumentou + parcelou), paga: centavos(pagouDividas + pagouCartao) }
    })
    const nova = centavos(soma(meses.map((x) => x.nova)))
    const paga = centavos(soma(meses.map((x) => x.paga)))
    const cresce = nova - paga
    const relevante = Math.max(50, e.renda * 0.05)
    if (nova + paga >= relevante && Math.abs(cresce) >= relevante * 0.5) {
      const mesesCrescendo = meses.filter((x) => x.nova > x.paga).length
      const sobe = cresce > 0
      const t = traduz(Math.abs(cresce))
      out.push({
        id: 'ritmo-divida', tema: 'dividas', tom: sobe ? 'ruim' : 'bom',
        forca: sobe ? 72 + 20 * peso(cresce, e.renda || nova, 0.5) : 46 + 12 * peso(-cresce, e.renda || paga, 0.5),
        titulo: sobe ? tx('A dívida entra mais rápido do que sai') : tx('Você paga mais do que faz de dívida'),
        frase: sobe
          ? (t ? tx('Nos últimos 3 meses, entraram {0} de dívida nova e você pagou {1}. A diferença, {2}, é {3}.', fmtValor(nova), fmtValor(paga), fmtValor(cresce), t)
            : tx('Nos últimos 3 meses, entraram {0} de dívida nova e você pagou {1}. A dívida cresceu {2}.', fmtValor(nova), fmtValor(paga), fmtValor(cresce)))
          : tx('Nos últimos 3 meses, você pagou {0} de dívidas e fez só {1} de dívida nova. O total caiu {2}.', fmtValor(paga), fmtValor(nova), fmtValor(-cresce)),
        chamado: sobe
          ? chamar(f, tx('Se der, segure dívidas novas por um tempo: cada parcela que termina passa a ser dinheiro seu.'),
            tx('Pare de fazer dívida nova até as de agora começarem a cair. Senão você fica pagando parcela para sempre.'),
            comNome(tx('você está tirando água do barco com um copo e abrindo outro furo. Nada de dívida nova enquanto essa conta não virar.')))
          : chamar(f, tx('Bonito de ver. Continue nesse passo.'), tx('Continue assim: nesse ritmo, as dívidas acabam.'), comNome(tx('isso aqui é virada de jogo. Não estraga agora.'))),
        destino: 'dividas',
        dado: { forma: 'comparacao', antes: { rotulo: tx('Você pagou'), valor: paga }, agora: { rotulo: tx('Dívida nova'), valor: nova }, subirEBom: false },
        acao: sobe && mesesCrescendo >= 2 ? {
          urgencia: 'importante', prioridade: 90, icone: 'sobe', botao: tx('Ver dívidas'),
          titulo: tx('Segure dívidas novas: elas entram mais rápido do que saem.'),
          porque: tx('Nos últimos 3 meses entraram {0} de dívida nova e saíram {1}. Enquanto isso não virar, o total só cresce.', fmtValor(nova), fmtValor(paga)),
        } : undefined,
        dados: meses.map((x) => ({ rotulo: `${MESES_NOME[x.mes - 1]} ${x.ano}`, valor: tx('{0} novas · {1} pagas', fmtValor(x.nova), fmtValor(x.paga)) })),
        periodo: tx('Últimos 3 meses'), confianca: 'media',
      })
    }
  }

  // ---------- dívida sobre dívida: algo novo enquanto já há atraso ou dívida cara ----------
  {
    const desde = diasAntes(hoje, 30)
    const novasCompras = compras.filter((c) => c.feita > desde && c.feita <= hoje)
    const novasDividas = abertas.filter((s) => s.inicioEm && s.inicioEm > desde && s.inicioEm <= hoje)
    // empréstimo a mais numa dívida que já existia (o "pegar mais")
    // (só dívida sua: o dinheiro que alguém te devolve, em "me devem", não é dívida nova)
    const maisEmprestimo = e.lancs.filter((l) => {
      const d = l.divida_id ? devo.find((x) => x.id === l.divida_id) : undefined
      return Boolean(d && l.data && l.data > desde && l.data <= hoje && l.valor > 0 && aumentaDivida(l.tipo, d) && !novasDividas.some((s) => s.divida.id === l.divida_id))
    })
    const n = novasCompras.length + novasDividas.length + maisEmprestimo.length
    const valor = centavos(soma(novasCompras.map((c) => c.total)) + soma(novasDividas.map((s) => s.restante + s.pagoNoMes)) + soma(maisEmprestimo.map((l) => l.valor)))
    const pesoAtras = atrasadas[0]
    const pesoCara = caras.find((s) => !novasDividas.includes(s))
    if (n > 0 && valor > 0 && (pesoAtras || pesoCara)) {
      const ref = pesoAtras ?? pesoCara!
      const porque = pesoAtras
        ? tx('com "{0}" em atraso', ref.divida.descricao)
        : tx('enquanto {0} cobra juros', ref.divida.descricao)
      out.push({
        id: 'divida-sobre-divida', tema: 'dividas', tom: 'ruim', forca: 80 + 12 * peso(valor, e.renda || valor, 0.5),
        titulo: tx('Dívida nova em cima de dívida'),
        frase: n === 1
          ? tx('Nos últimos 30 dias você fez 1 dívida ou parcelamento novo ({0}) {1}.', fmtValor(valor), porque)
          : tx('Nos últimos 30 dias você fez {0} dívidas ou parcelamentos novos ({1}) {2}.', n, fmtValor(valor), porque),
        chamado: chamar(f, tx('Antes da próxima compra parcelada, vale olhar se ela cabe junto com o que já está aberto.'),
          tx('Primeiro tire do vermelho o que já existe. Parcela nova agora só empurra o problema para o mês que vem.'),
          comNome(tx('você já devia e foi lá fazer mais dívida. Assim a conta não fecha nunca.'))),
        destino: 'dividas',
        dado: { forma: 'numero', valor, formato: 'dinheiro', legenda: n === 1 ? tx('em 1 dívida nova') : tx('em {0} dívidas novas', n) },
        acao: pesoAtras ? {
          urgencia: 'importante', prioridade: 92, icone: 'alerta', botao: tx('Ver dívidas'),
          titulo: tx('Nada de dívida nova até {0} sair do atraso.', ref.divida.descricao),
          porque: tx('Nos últimos 30 dias entraram {0} em dívidas novas enquanto uma conta já estava atrasada e cobrando juros.', fmtValor(valor)),
        } : undefined,
        dados: [
          ...novasCompras.slice(0, 4).map((c) => ({ rotulo: c.descricao || tx('Compra parcelada'), valor: tx('{0}x de {1}, em {2}', c.parcelas, fmtValor(c.parcela), fmtDataCurta(c.feita)) })),
          ...novasDividas.slice(0, 3).map((s) => ({ rotulo: s.divida.descricao, valor: fmtValor(s.restante + s.pagoNoMes) })),
          ...maisEmprestimo.slice(0, 3).map((l) => ({ rotulo: l.descricao, valor: fmtValor(l.valor) })),
        ],
        periodo: tx('Últimos 30 dias'), confianca: 'alta',
      })
    }
  }

  // ---------- futuro já gasto: quanto do que entra nos próximos meses já sai para parcelas ----------
  if (e.renda > 0) {
    const porMes = Array.from({ length: 6 }, (_, i) => {
      const k = atual + 1 + i
      const m = doChave(k)
      const cartao = soma(e.compras.filter((l) => l.compra_id && (l.parcelas ?? 1) > 1 && l.ano === m.ano && l.mes === m.mes).map((l) => l.valor))
      const dividas = soma(abertas.map((s) => {
        const cal = calendarios.get(s.divida.id)
        return soma((cal?.parcelas ?? []).filter((p) => p.falta > 0 && chave(Number(p.vencimento.slice(0, 4)), Number(p.vencimento.slice(5, 7))) === k).map((p) => p.falta))
      }))
      return { ...m, valor: centavos(cartao + dividas) }
    })
    const prox = porMes[0]
    const fracao = prox.valor / e.renda
    if (fracao >= 0.3) {
      const livre = porMes.find((x) => x.valor / e.renda < 0.3)
      out.push({
        id: 'futuro-comprometido', tema: 'mes', tom: fracao >= 0.5 ? 'ruim' : 'medio', forca: 58 + 34 * peso(fracao, 1, 0.8),
        titulo: tx('Seu futuro já tem dono'),
        frase: livre
          ? tx('Em {0}, {1} do que entra já sai para parcelas ({2}%). Isso só cai para menos de 30% em {3}.', nomeMes(prox.mes), fmtValor(prox.valor), Math.round(fracao * 100), nomeMes(livre.mes))
          : tx('Em {0}, {1} do que entra já sai para parcelas ({2}%), e continua acima de 30% pelos próximos 6 meses.', nomeMes(prox.mes), fmtValor(prox.valor), Math.round(fracao * 100)),
        chamado: chamar(f, tx('Quando der, espere algumas parcelas terminarem antes de assumir outra.'),
          tx('Não assuma parcela nova até esse número baixar: ela sai de um dinheiro que você ainda nem recebeu.'),
          comNome(tx('você está gastando o salário de meses que nem chegaram. Para de parcelar.'))),
        destino: 'dividas',
        dado: { forma: 'serie', pontos: porMes.map((x) => ({ rotulo: MESES_NOME[x.mes - 1].slice(0, 3), valor: x.valor })), continua: false },
        dados: porMes.map((x) => ({ rotulo: `${MESES_NOME[x.mes - 1]} ${x.ano}`, valor: tx('{0} ({1}% do que entra)', fmtValor(x.valor), Math.round((x.valor / e.renda) * 100)) })),
        periodo: tx('Próximos 6 meses'), confianca: 'alta',
      })
    }
  }

  // ---------- gasto miúdo contra dívida cara ----------
  {
    const limite = e.renda > 0 ? Math.max(15, e.renda * 0.015) : 60
    const grupos = new Map<string, { descricao: string; vezes: number; valor: number }>()
    // da conta e do cartão (compra à vista feita este mês: o app de corrida quase sempre vai no cartão)
    const doCartao = e.compras.filter((l) => (l.parcelas ?? 1) <= 1 && (l.data_compra ?? '').slice(0, 7) === hoje.slice(0, 7))
    for (const l of [...e.lancs.filter((x) => x.ano === ano && x.mes === mes && !x.cartao_id), ...doCartao]) {
      if (l.tipo !== 'saida' || l.divida_id || l.conta_fixa_id || !(l.valor > 0) || l.valor > limite) continue
      const k = normal(l.descricao)
      if (!k) continue
      const g = grupos.get(k) ?? { descricao: l.descricao.trim(), vezes: 0, valor: 0 }
      g.vezes++
      g.valor = centavos(g.valor + l.valor)
      grupos.set(k, g)
    }
    const miudos = [...grupos.values()].filter((g) => g.vezes >= 3).sort((a, b) => b.valor - a.valor).slice(0, 3)
    const total = centavos(soma(miudos.map((g) => g.valor)))
    const alvo = atrasadas[0] ?? caras[0]
    if (miudos.length && alvo && total >= Math.max(30, e.renda * 0.02)) {
      const cal = calendarios.get(alvo.divida.id)
      const atrasado = centavos((cal?.emAtraso ?? 0) + alvo.jurosAtraso)
      const porDia = alvo.atraso?.diario ?? 0
      const nomes = miudos.map((g) => g.descricao).join(', ')
      const comparacao = atrasado > 0 && total >= atrasado
        ? tx('Isso já pagaria o atrasado de {0} ({1}), que cresce com juros.', alvo.divida.descricao, fmtValor(atrasado))
        : atrasado > 0 ? tx('É {0}% do atrasado de {1} ({2}), que cresce com juros.', Math.round((total / atrasado) * 100), alvo.divida.descricao, fmtValor(atrasado))
          : tx('Enquanto isso, {0} cobra juros de {1}% ao mês.', alvo.divida.descricao, fmtTaxa(alvo.divida.juros_mes ?? 0))
      const t = traduz(total)
      out.push({
        id: 'miudo-x-divida', tema: 'gastos', tom: 'medio', forca: 66 + 20 * peso(total, atrasado || total, 1),
        titulo: tx('O miúdo que pagaria a dívida'),
        frase: `${t ? tx('Este mês: {0} em {1} ({2}).', fmtValor(total), nomes, t) : tx('Este mês: {0} em {1}.', fmtValor(total), nomes)} ${comparacao}`,
        chamado: chamar(f, tx('Não é para cortar tudo: só trocar parte disso pela dívida, até ela sair do atraso.'),
          tx('Corte metade disso este mês e mande para a dívida. É o dinheiro mais fácil de achar.'),
          comNome(tx('cada corrida e cada pão de hoje estão sendo pagos com juros amanhã. Corta.'))),
        destino: 'lancamentos',
        dado: { forma: 'comparacao', antes: { rotulo: tx('Miúdos do mês'), valor: total }, agora: { rotulo: atrasado > 0 ? tx('Atrasado com juros') : tx('Parcela da dívida'), valor: atrasado > 0 ? atrasado : alvo.divida.valor_parcela ?? alvo.restante }, subirEBom: true },
        acao: atrasado > 0 ? {
          urgencia: 'importante', prioridade: 86, icone: 'ideia', botao: tx('Ver lançamentos'), destino: 'lancamentos',
          titulo: tx('Troque parte dos gastos miúdos pelo atrasado de {0}.', alvo.divida.descricao),
          porque: porDia > 0
            ? tx('Este mês saíram {0} em {1}. O atrasado de {2} cresce uns {3} por dia.', fmtValor(total), nomes, alvo.divida.descricao, fmtValor(porDia))
            : tx('Este mês saíram {0} em {1}, com "{2}" em atraso.', fmtValor(total), nomes, alvo.divida.descricao),
        } : undefined,
        dados: miudos.map((g) => ({ rotulo: g.descricao, valor: tx('{0} vezes · {1}', g.vezes, fmtValor(g.valor)) })),
        periodo: tx('Este mês'), confianca: 'alta',
      })
    }
  }

  // ---------- promessas: remarcadas ou não cumpridas ----------
  {
    // a situação de verdade (com a cotação da moeda da dívida); dívida quitada não tem mais o que remarcar
    const comPromessa = e.dividas.filter((d) => d.promessas?.length && !d.em_espera)
    const sits = comPromessa.length ? situacaoDividas(comPromessa, e.saldos, e.pagamentos, ano, mes, e.taxas, hoje) : []
    for (const s of sits) {
      const d = s.divida
      if (s.semCotacao || s.restante <= 0) continue
      const recebe = (d.sentido ?? 'devo') === 'me_devem'
      const p = promessasDe(s, e.pagamentos, hoje)
      const vencidas = p.lista.filter((x) => x.estado !== 'aguardando' && x.estado !== 'hoje')
      const falhou = vencidas.filter((x) => x.estado === 'nao_cumprida' || x.estado === 'trocada').length
      const cumpridas = vencidas.filter((x) => x.estado === 'cumprida').length
      if (vencidas.length < 2 || falhou < 2) continue
      const quem = d.pessoa?.trim() || d.descricao
      out.push({
        id: `promessas:${d.id}`, tema: 'dividas', tom: recebe ? 'medio' : 'ruim', forca: recebe ? 52 + falhou * 4 : 60 + falhou * 5,
        titulo: recebe ? tx('Promessa que não se cumpre') : tx('Pagamento sempre remarcado'),
        frase: recebe
          ? (cumpridas === 0 ? tx('{0} não cumpriu nenhuma das {1} promessas de pagamento.', quem, vencidas.length)
            : cumpridas === 1 ? tx('{0} cumpriu só 1 de {1} promessas de pagamento.', quem, vencidas.length)
              : tx('{0} cumpriu {1} de {2} promessas de pagamento.', quem, cumpridas, vencidas.length))
          : tx('Você remarcou ou não cumpriu {0} das {1} datas combinadas para pagar {2}.', falhou, vencidas.length, d.descricao),
        chamado: recebe
          ? chamar(f, tx('Talvez valha combinar valores menores, que caibam no bolso de quem deve.'),
            tx('Não conte com esse dinheiro para pagar suas contas até ele cair de verdade.'),
            tx('Esse dinheiro só existe quando cair na conta. Não planeje nada com ele.'))
          : chamar(f, tx('Uma data mais realista, mesmo que mais longe, costuma funcionar melhor.'),
            tx('Combine uma data que você consegue cumprir, ou um valor menor. Remarcar de novo só soma juros.'),
            comNome(tx('promessa que não se cumpre vira juros. Combina o que dá para pagar e paga.'))),
        destino: 'dividas',
        dado: { forma: 'numero', valor: falhou, formato: 'inteiro', legenda: recebe ? tx('promessas não cumpridas') : tx('datas remarcadas ou perdidas') },
        dados: vencidas.slice(-5).map((x) => ({ rotulo: fmtDataCurta(x.promessa.data), valor: x.estado === 'cumprida' ? tx('cumprida') : x.estado === 'trocada' ? tx('remarcada') : x.estado === 'em_parte' ? tx('em parte') : x.estado === 'pagou_depois' ? tx('paga depois') : tx('não cumprida') })),
        periodo: tx('Todas as promessas'), confianca: 'alta',
      })
    }
  }

  // ---------- pular compra para a fatura seguinte ----------
  {
    const puladas = e.compras.filter((l) => l.pulada_de && chave(l.ano, l.mes) >= atual && chave(l.ano, l.mes) <= atual + 1)
    const valor = centavos(soma(puladas.map((l) => l.valor)))
    if (puladas.length >= 2 || (puladas.length && valor >= Math.max(100, e.renda * 0.05))) {
      const fat = doChave(Math.max(...puladas.map((l) => chave(l.ano, l.mes))))
      out.push({
        id: 'pulou-compra', tema: 'dividas', tom: 'medio', forca: 60 + 20 * peso(valor, e.renda || valor, 0.3),
        titulo: tx('Conta empurrada para a frente'),
        frase: puladas.length === 1
          ? tx('Você empurrou 1 compra ({0}) para a fatura seguinte. A fatura de {1} já nasce mais pesada.', fmtValor(valor), nomeMes(fat.mes))
          : tx('Você empurrou {0} compras ({1}) para a fatura seguinte. A fatura de {2} já nasce mais pesada.', puladas.length, fmtValor(valor), nomeMes(fat.mes)),
        chamado: chamar(f, tx('Pular uma vez ajuda; virar costume pesa. Vale reservar esse valor desde já.'),
          tx('Separe esse valor agora: a fatura que vem vai cobrar tudo junto, e pular de novo costuma ter taxa.'),
          comNome(tx('empurrar conta não paga conta. No mês que vem ela volta maior.'))),
        destino: 'cartoes',
        dado: { forma: 'numero', valor, formato: 'dinheiro', legenda: tx('empurrados para a próxima fatura') },
        dados: puladas.slice(0, 5).map((l) => ({ rotulo: l.descricao, valor: fmtValor(l.valor) })),
        periodo: tx('Esta fatura e a próxima'), confianca: 'alta',
      })
    }
  }

  // ---------- fatura paga só em parte, mês após mês ----------
  {
    // por cartão: faturas que ficaram em parte (sem o pagamento que completa), contando só as que já passaram: a deste mês
    // pode estar sendo paga em partes antes do vencimento
    const porCartao = new Map<string, Set<number>>()
    for (const p of e.faturasParciais) {
      if (e.faturasPagas.some((x) => x.cartao_id === p.cartao_id && x.ano === p.ano && x.mes === p.mes)) continue
      const k = chave(p.ano, p.mes)
      if (k >= atual) continue
      porCartao.set(p.cartao_id, (porCartao.get(p.cartao_id) ?? new Set()).add(k))
    }
    let seguidas = 0
    for (const meses of porCartao.values()) {
      let n = 0
      for (let k = atual - 1; meses.has(k) && n < 24; k--) n++
      seguidas = Math.max(seguidas, n)
    }
    if (seguidas >= 2) {
      out.push({
        id: 'fatura-parcial', tema: 'dividas', tom: 'ruim', forca: 74 + Math.min(16, seguidas * 4),
        titulo: tx('Fatura paga pela metade'),
        frase: tx('São {0} faturas seguidas pagas só em parte. O que fica para trás entra no rotativo, o juro mais caro que existe.', seguidas),
        chamado: chamar(f, tx('Se não der para pagar inteira, um parcelamento da fatura costuma sair mais barato que o rotativo.'),
          tx('Pare de usar o cartão até conseguir pagar a fatura inteira. Se precisar, parcele a fatura: sai mais barato que o rotativo.'),
          comNome(tx('o rotativo é o pior juro do país. Corta o cartão até pagar a fatura cheia.'))),
        destino: 'cartoes',
        dado: { forma: 'numero', valor: seguidas, formato: 'inteiro', legenda: tx('faturas seguidas pagas em parte') },
        acao: {
          urgencia: 'importante', prioridade: 91, icone: 'cartao', botao: tx('Ver cartões'), destino: 'cartoes',
          titulo: tx('Volte a pagar a fatura inteira.'),
          porque: tx('São {0} faturas seguidas pagas só em parte, e o que sobra paga o juro do rotativo.', seguidas),
        },
        dados: [{ rotulo: tx('Faturas seguidas'), valor: String(seguidas) }],
        periodo: tx('Últimas faturas'), confianca: 'alta',
      })
    }
  }

  // ---------- juros de verdade (o que as conferências com o banco ensinaram) e desconto para quitar ----------
  for (const s of abertas) {
    const cs = e.conferencias.filter((c) => c.divida_id === s.divida.id)
    if (!cs.length) continue
    const cal = calendarios.get(s.divida.id) ?? null
    const a = aprenderJuros(s, cal, cs)
    // com regra informada, só fala com pelo menos 2 conferências; sem regra nenhuma, uma já mostra que a dívida cresce
    if (a && a.diverge && (a.confianca !== 'baixa' || !s.atraso?.diario)) {
      const mais = a.diverge === 'mais'
      const mes30 = centavos(a.porDiaHoje * 30)
      const t = traduz(mes30)
      out.push({
        id: `juros-real:${s.divida.id}`, tema: 'dividas', tom: mais ? 'ruim' : 'bom', forca: mais ? 78 : 50,
        titulo: mais ? tx('O banco cobra mais do que você acha') : tx('O banco cobra menos do que você acha'),
        frase: a.porDiaInformado > 0
          ? tx('{0} cresce uns {1} por dia, e não {2} como você informou. Em 30 dias, são {3}.', s.divida.descricao, fmtValor(a.porDiaHoje), fmtValor(a.porDiaInformado), t ? `${fmtValor(mes30)} (${t})` : fmtValor(mes30))
          : tx('{0} cresce uns {1} por dia. Em 30 dias, são {2}.', s.divida.descricao, fmtValor(a.porDiaHoje), t ? `${fmtValor(mes30)} (${t})` : fmtValor(mes30)),
        chamado: mais
          ? chamar(f, tx('Vale atualizar a regra da dívida para as estimativas ficarem certas.'),
            tx('Atualize a regra da dívida e coloque ela no topo da fila: ela é mais cara do que parecia.'),
            comNome(tx('essa dívida te morde mais do que você pensava. Ela vai para o topo da fila.')))
          : chamar(f, tx('Boa notícia: dá para atualizar a regra e ver a conta mais leve.'), tx('Atualize a regra da dívida para o plano usar o número certo.'), tx('Pelo menos aqui o banco pegou leve. Atualiza a regra.')),
        destino: 'dividas',
        dado: { forma: 'comparacao', antes: { rotulo: tx('Você informou'), valor: a.porDiaInformado }, agora: { rotulo: tx('O banco cobra'), valor: a.porDiaHoje }, subirEBom: false },
        acao: {
          urgencia: mais ? 'importante' : 'sugestao', prioridade: mais ? 88 : 40, icone: 'calculadora', botao: tx('Ver dívidas'),
          titulo: tx('Atualize os juros de {0}: o banco cobra {1} por dia.', s.divida.descricao, fmtValor(a.porDiaHoje)),
          porque: tx('Pelas {0} conferências com o banco, a dívida cresce {1} por dia ({2}% ao mês). Abra a dívida e toque em "Usar a taxa que calculei".', a.amostras, fmtValor(a.porDiaHoje), fmtTaxa(a.taxaMes)),
        },
        dados: [
          { rotulo: tx('Conferências usadas'), valor: String(a.amostras) },
          { rotulo: tx('Cresce por dia (banco)'), valor: fmtValor(a.porDiaHoje) },
          { rotulo: tx('Cresce por dia (sua regra)'), valor: fmtValor(a.porDiaInformado) },
          ...(a.iofDia > 0.009 ? [{ rotulo: tx('Dos quais pode ser IOF'), valor: fmtValor(a.iofDia) }] : []),
        ],
        periodo: tx('Desde a primeira conferência'), confianca: a.confianca,
      })
    }
    const q = descontoParaQuitar(cs)
    if (q && diasEntre(q.data, hoje) <= 30 && q.desconto >= Math.max(20, q.total * 0.05)) {
      out.push({
        id: `quitar-desconto:${s.divida.id}`, tema: 'dividas', tom: 'bom', forca: 62 + 20 * peso(q.desconto, q.total, 0.4),
        titulo: tx('Desconto para quitar'),
        frase: tx('Em {0}, o banco pedia {1} para quitar {2}: {3} a menos que o total.', fmtDataCurta(q.data), fmtValor(q.quitar), s.divida.descricao, fmtValor(q.desconto)),
        chamado: chamar(f, tx('Se um dia sobrar esse valor, vale pensar nisso.'), tx('Se você tem esse dinheiro guardado, quitar agora pode valer mais que deixar rendendo.'), tx('Desconto assim não dura. Se tem o dinheiro, quita.')),
        destino: 'dividas',
        dado: { forma: 'comparacao', antes: { rotulo: tx('Total'), valor: q.total }, agora: { rotulo: tx('Para quitar'), valor: q.quitar }, subirEBom: false },
        dados: [{ rotulo: tx('Desconto'), valor: fmtValor(q.desconto) }],
        periodo: fmtDataCurta(q.data), confianca: 'alta',
      })
    }
  }

  // ---------- frescor: há quanto tempo nada é lançado ----------
  if (e.lancamentosPorMes >= 8) {
    const dias = diasSemLancar([...e.lancs, ...e.compras], hoje)
    if (dias >= 7) {
      const ultima = diasAntes(hoje, dias)
      out.push({
        id: 'dados-velhos', tema: 'como', tom: 'medio', forca: 54 + Math.min(30, dias),
        titulo: tx('Meus números podem estar velhos'),
        frase: tx('Faz {0} dias que nada é lançado. Você costuma lançar umas {1} coisas por mês, então o que eu digo pode estar otimista.', dias, e.lancamentosPorMes),
        chamado: chamar(f, tx('Quando puder, lance o que ficou para trás.'), tx('Lance o que ficou para trás para eu voltar a acertar.'), tx('Sem lançamento eu chuto. Lança o que ficou para trás.')),
        destino: 'lancamentos',
        dado: { forma: 'numero', valor: dias, formato: 'inteiro', legenda: tx('dias sem lançar') },
        dados: [{ rotulo: tx('Último lançamento'), valor: fmtDataCurta(ultima) }],
        periodo: tx('Hoje'), confianca: 'alta',
      })
    }
  }

  return out.sort((a, b) => b.forca - a.forca)
}

/** Quanto já sai para parcelas em cada um dos próximos meses, e quantas dívidas e compras parceladas estão correndo. */
export interface Compromisso {
  /** Do mês que vem em diante, 6 meses: as parcelas do cartão e das dívidas. */
  meses: { ano: number; mes: number; valor: number }[]
  /** Este mês: o que ainda vence de parcelas. */
  esteMes: number
  /** Compras parceladas e dívidas com parcela ainda correndo. */
  parcelasAtivas: number
  /** Dívidas atrasadas hoje. */
  atrasadas: { descricao: string; valor: number }[]
}

export function compromissoDe(e: Pick<EntradaSinais, 'hojeIso' | 'compras' | 'dividas' | 'saldos' | 'pagamentos' | 'taxas'>): Compromisso {
  const hoje = e.hojeIso
  const atual = chave(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)))
  const devo = e.dividas.filter((d) => (d.sentido ?? 'devo') === 'devo' && !d.em_espera)
  const abertas = situacaoDividas(devo, e.saldos, e.pagamentos, Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), e.taxas, hoje).filter((s) => !s.semCotacao && s.restante > 0)
  const cals = abertas.map((s) => ({ s, cal: calendarioDe(s, hoje) }))
  const doMes = (k: number) => {
    const m = doChave(k)
    const cartao = soma(e.compras.filter((l) => l.compra_id && (l.parcelas ?? 1) > 1 && l.ano === m.ano && l.mes === m.mes).map((l) => l.valor))
    const dividas = soma(cals.map(({ cal }) => soma((cal?.parcelas ?? []).filter((p) => p.falta > 0 && p.vencimento >= hoje && chave(Number(p.vencimento.slice(0, 4)), Number(p.vencimento.slice(5, 7))) === k).map((p) => p.falta))))
    return centavos(cartao + dividas)
  }
  const correndo = new Set(e.compras.filter((l) => l.compra_id && (l.parcelas ?? 1) > 1 && chave(l.ano, l.mes) >= atual).map((l) => l.compra_id!))
  const comParcela = cals.filter(({ s, cal }) => s.divida.valor_parcela && (cal?.parcelas.some((p) => p.falta > 0) ?? false)).length
  return {
    meses: Array.from({ length: 6 }, (_, i) => ({ ...doChave(atual + 1 + i), valor: doMes(atual + 1 + i) })),
    esteMes: doMes(atual),
    parcelasAtivas: correndo.size + comParcela,
    atrasadas: cals.filter(({ cal }) => (cal?.atrasadas.length ?? 0) > 0).map(({ s, cal }) => ({ descricao: s.divida.descricao, valor: centavos((cal?.emAtraso ?? 0) + s.jurosAtraso) })),
  }
}

/** Há quanto tempo nada é lançado (0 quando a pessoa lançou hoje ou não costuma lançar). */
export function diasSemLancar(lancs: Lancamento[], hoje: string): number {
  const ultima = lancs.reduce((m, l) => {
    const d = (l.created_at ?? '').slice(0, 10) || l.data || ''
    return d && d <= hoje && d > m ? d : m
  }, '')
  return ultima ? diasEntre(ultima, hoje) : 0
}

const diasAntes = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10)
}
