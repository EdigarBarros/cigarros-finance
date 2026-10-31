/**
 * Conselheiro financeiro: olha os números da pessoa e devolve, em ordem de importância, o que vale a pena ela saber
 * ("Está saindo mais do que entrando", "Sua reserva cobre 1,5 mês de gastos"…).
 *
 * É um motor de regras PURO: sem React, sem banco, sem relógio escondido (a data entra por `hoje`). Os mesmos dados dão
 * sempre os mesmos conselhos. Fala só de comportamento (gastar, dever, guardar): nunca recomenda produto de investimento.
 *
 * Uso: `conselhos({ hoje, lancs, compras, categorias, categoriaDe, dividas, saldos, pagamentos, taxas, meses, metas,
 * movimentosMeta, perfil })` devolve `Conselho[]`, do mais para o menos importante (já sem os que a pessoa dispensou).
 *
 * Bom senso embutido:
 *  - "Meses fechados" são os 3 meses antes do mês atual (o mês atual, que ainda está andando, só entra no "gasto que
 *    disparou"). Um mês só conta se tiver entradas E saídas lançadas; sem pelo menos 2 deles, as regras de fluxo
 *    (gastar mais do que ganha, sobra, reserva, parcelas, cartão, gasto que disparou, elogio) ficam caladas: quem só não
 *    lançou o salário não leva bronca.
 *  - Cada regra fica calada quando falta o dado de que precisa (sem saldo de banco, sem dívida, sem meta com prazo…).
 *  - Dinheiro emprestado a mais (empréstimo recebido, ou emprestado a alguém) não entra como entrada nem como saída:
 *    não é renda nem gasto.
 *  - Regras de módulos desligados no perfil (dívidas, cartões, bancos, metas) não falam.
 */
import { caixaDoBanco, mesEfetivo } from './calc'
import { doMesChave, chaveMes, hojeLocal } from './cartoes'
import { aumentaDivida, meDevem, situacaoDividas } from './dividas'
import { fmtMesAno, fmtMoeda, fmtValor, LOCAL_DAS_DATAS, MESES_NOME, noMeioDaFrase } from './format'
import type { Taxas } from './moedas'
import { situacaoMeta } from './metas'
import { visao } from './perfil'
import { tx } from './textos'
import type { Categoria, Divida, Lancamento, Mes, Meta, MovimentoMeta, Pagamento, Perfil, SaldoDivida } from './types'
import { TIPOS_CAIXA } from './types'

// ---------- limites ----------
// São referências comuns de educação financeira (regra do dedão), não regra rígida: servem para puxar uma conversa.

/** Quantos meses fechados entram na média. */
export const MESES_NA_MEDIA = 3
/** Mínimo de meses fechados com entradas e saídas lançadas para as regras de fluxo falarem. */
export const MIN_MESES_COM_DADOS = 2
/** Sobrou menos que isso das entradas (e não é negativo): "quase nada sobra". */
export const SOBRA_MINIMA = 0.05
/** Parcelas das dívidas (por mês) acima dessa fração do que entra: atenção. */
export const PARCELAS_ATENCAO = 0.3
/** E acima desta: urgente. */
export const PARCELAS_URGENTE = 0.5
/** A dívida precisa ter crescido mais que isso em 3 meses para contar (ignora ruído). */
export const DIVIDA_CRESCEU_MIN = 0.02
/** Há quantos meses se compara o total que a pessoa deve. */
export const MESES_DA_DIVIDA = 3
/** Reserva abaixo disto, em meses de gastos, merece um aviso. */
export const RESERVA_MIN_MESES = 3
/** O que o texto cita como ideal para imprevistos (3 a 6 meses). */
export const RESERVA_IDEAL_MESES = [3, 6] as const
/** Categoria acima disto sobre a média dos meses anteriores: "disparou". */
export const DISPAROU_ACIMA = 0.4
/** E a diferença precisa pesar pelo menos esta fração do gasto médio mensal total (ignora trocados). */
export const DISPAROU_RELEVANTE = 0.1
/** Parcelas de compras no cartão do mês seguinte acima dessa fração do que entra: atenção. */
export const CARTAO_ATENCAO = 0.3
/** Meta com prazo: guardar menos que esta fração do necessário por mês conta como atrasada. */
export const META_TOLERANCIA = 0.9
/** Meta sem nenhum aporte só é cobrada depois de existir há tantos dias. */
export const META_DIAS_DE_CARENCIA = 30
/** Sobrou mais que isto das entradas em cada um dos 3 meses: elogio. */
export const ELOGIO_SOBRA = 0.2

// ---------- tipos ----------

export type Gravidade = 'urgente' | 'atencao' | 'elogio'
/** Página do painel para onde o botão leva (mesmos ids de `Pagina` em pages/contexto.ts). */
export type Destino = 'inicio' | 'lancamentos' | 'contas' | 'cartoes' | 'dividas' | 'metas' | 'patrimonio' | 'ano'

export interface Conselho {
  /**
   * Estável: serve para dispensar e para a tela reconhecer o conselho. Vale o texto fixo de cada regra, e as regras
   * que falam de uma coisa só levam o id dela depois dos dois pontos: 'gasto-disparou:<categoria_id>', 'meta-atrasada:<meta_id>'.
   */
  id: string
  gravidade: Gravidade
  /** Maior = mais importante. Urgentes ficam sempre acima dos de atenção, e elogio por último. */
  prioridade: number
  /** Nome de ícone que existe em components/Icone.tsx. */
  icone: string
  /** Frase curta (cabe no balão do menu), já traduzida. */
  titulo: string
  /** 1 ou 2 frases com o número por trás, em linguagem simples, já traduzidas. */
  porque: string
  destino: Destino
  /** Verbo, já traduzido. */
  botao: string
}

export interface EntradaConselheiro {
  /** O dia de hoje (padrão: agora). O mês dele é o "mês atual". */
  hoje?: Date
  /**
   * Lançamentos de qualquer ano, pelo menos dos 3 meses fechados e do mês atual (veja `mesesDoConselheiro`).
   * Já sem as compras de fatura renegociada (que viraram dívida). `valor` na moeda principal, como sempre.
   */
  lancs: Lancamento[]
  /** Compras no cartão de todos os anos (as parcelas dos meses que vêm). Vazio se o módulo de cartões está desligado. */
  compras: Lancamento[]
  categorias: Categoria[]
  /** id da categoria do lançamento ('' = sem categoria). */
  categoriaDe: (l: Lancamento) => string
  dividas: Divida[]
  saldos: SaldoDivida[]
  pagamentos: Pagamento[]
  taxas: Taxas
  meses: Mes[]
  metas: Meta[]
  movimentosMeta: MovimentoMeta[]
  /** Dá os módulos ligados (`visao`) e a lista de `dispensadas`. */
  perfil: Perfil
}

// ---------- apoio ----------

const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const pct = (fracao: number) => Math.round(fracao * 100)
const numeroDecimal = new Intl.NumberFormat(LOCAL_DAS_DATAS, { maximumFractionDigits: 1 })

/** Os meses (ano e mês) cujos lançamentos o conselheiro lê: os 3 fechados e o atual. Serve para saber o que carregar. */
export function mesesDoConselheiro(hoje = new Date()) {
  const atual = chaveMes(hoje.getFullYear(), hoje.getMonth() + 1)
  return Array.from({ length: MESES_NA_MEDIA + 1 }, (_, i) => doMesChave(atual - MESES_NA_MEDIA + i))
}

/** Marca de "agora não" para um conselho: vale só no mês dela, depois o conselho pode voltar (se ainda for verdade). */
const chaveDeDispensaDoMes = (id: string, hoje: Date) => `${id}@${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
const MARCA_DE_MES = /@\d{4}-\d{2}$/

/**
 * A lista `perfil.dispensadas` depois de a pessoa dizer "agora não" a um conselho: ele some até o mês que vem. (Para
 * esconder de vez, basta pôr o `id` puro na lista.) Já tira da lista as marcas de meses que passaram.
 */
export function dispensarPorUmMes(dispensadas: string[], id: string, hoje = new Date()): string[] {
  const deHoje = chaveDeDispensaDoMes('', hoje)
  return [...new Set([...dispensadas.filter((x) => !MARCA_DE_MES.test(x) || x.endsWith(deHoje)), chaveDeDispensaDoMes(id, hoje)])]
}

interface MesAnalisado {
  entradas: number
  saidas: number
  porCategoria: Record<string, number>
}

/** Entradas, saídas e saídas por categoria de cada mês pedido (chave = `chaveMes`). Empréstimo não conta. */
function analisarMeses(
  lancs: Lancamento[], dividas: Divida[], categoriaDe: (l: Lancamento) => string, chaves: number[],
): Map<number, MesAnalisado> {
  const mapa = new Map(chaves.map((k) => [k, { entradas: 0, saidas: 0, porCategoria: {} } as MesAnalisado]))
  const dividaPorId = new Map(dividas.map((d) => [d.id, d]))
  for (const l of lancs) {
    const m = mapa.get(chaveMes(l.ano, l.mes))
    if (!m || !(l.valor > 0)) continue
    const d = l.divida_id ? dividaPorId.get(l.divida_id) : undefined
    if (d && aumentaDivida(l.tipo, d)) continue // dinheiro emprestado a mais: não é renda nem gasto
    if (l.tipo === 'entrada') m.entradas += l.valor
    else {
      m.saidas += l.valor
      const k = categoriaDe(l)
      m.porCategoria[k] = (m.porCategoria[k] ?? 0) + l.valor
    }
  }
  return mapa
}

const mesesTexto = (n: number) => numeroDecimal.format(n)

const chaveDaData = (iso: string) => chaveMes(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))

/**
 * Quanto a pessoa guardou por mês numa meta, olhando só os meses fechados (até 3, ou desde o primeiro aporte se for mais
 * recente). Parecido com o `ritmo` de `situacaoMeta`, que conta o mês atual (ainda pela metade) e por isso engana no começo do mês.
 */
function ritmoDosMesesFechados(movimentos: MovimentoMeta[], atual: number) {
  if (!movimentos.length) return 0
  const primeiro = Math.min(...movimentos.map((m) => chaveDaData(m.data)))
  const janela = Math.min(MESES_NA_MEDIA, atual - primeiro)
  if (janela <= 0) return 0
  const guardado = soma(movimentos.filter((m) => atual - chaveDaData(m.data) >= 1 && atual - chaveDaData(m.data) <= janela).map((m) => m.valor))
  return Math.max(0, guardado / janela)
}

// ---------- o motor ----------

export function conselhos(e: EntradaConselheiro): Conselho[] {
  const hoje = e.hoje ?? new Date()
  const v = visao(e.perfil)
  const atual = chaveMes(hoje.getFullYear(), hoje.getMonth() + 1)
  const fechados = Array.from({ length: MESES_NA_MEDIA }, (_, i) => atual - MESES_NA_MEDIA + i) // do mais antigo ao mais novo
  const analise = analisarMeses(e.lancs, e.dividas, e.categoriaDe, [...fechados, atual])

  // Meses fechados com entradas E saídas: a base de toda regra de fluxo.
  const comDados = fechados.map((k) => analise.get(k)!).filter((m) => m.entradas > 0 && m.saidas > 0)
  const temFluxo = comDados.length >= MIN_MESES_COM_DADOS
  const entradasMedia = temFluxo ? centavos(soma(comDados.map((m) => m.entradas)) / comDados.length) : 0
  const saidasMedia = temFluxo ? centavos(soma(comDados.map((m) => m.saidas)) / comDados.length) : 0
  const sobraMedia = centavos(entradasMedia - saidasMedia)
  const sobraFracao = entradasMedia > 0 ? sobraMedia / entradasMedia : 0

  const lista: Conselho[] = []
  const nova = (c: Conselho) => lista.push(c)

  // 1 e 2. Gasta mais do que ganha / quase nada sobra
  if (temFluxo && entradasMedia > 0) {
    if (sobraMedia < 0) {
      nova({
        id: 'gasta-mais-que-ganha', gravidade: 'urgente', prioridade: 100, icone: 'desce', destino: 'lancamentos', botao: tx('Ver gastos'),
        titulo: tx('Está saindo mais do que entrando.'),
        porque: tx('Nos últimos meses fechados, entraram em média {0} por mês e saíram {1}: {2} a mais do que entrou.',
          fmtValor(entradasMedia), fmtValor(saidasMedia), fmtValor(-sobraMedia)),
      })
    } else if (sobraFracao < SOBRA_MINIMA) {
      nova({
        id: 'sobra-pouco', gravidade: 'atencao', prioridade: 75, icone: 'carteira', destino: 'lancamentos', botao: tx('Ver gastos'),
        titulo: tx('Quase nada está sobrando.'),
        porque: tx('De cada {0} que entram, sobram só {1}. É a média dos últimos meses fechados.',
          fmtValor(100), fmtValor(centavos(Math.max(0, sobraFracao) * 100))),
      })
    }
  }

  // 3. Parcelas das dívidas pesando (só dívidas que a pessoa deve)
  const devo = e.dividas.filter((d) => !meDevem(d))
  const dividasHoje = v.dividas ? situacaoDividas(devo, e.saldos, e.pagamentos, hoje.getFullYear(), hoje.getMonth() + 1, e.taxas) : []
  if (v.dividas && temFluxo && entradasMedia > 0) {
    const parcelas = centavos(soma(dividasHoje.filter((s) => s.restante > 0).map((s) => s.divida.valor_parcela ?? 0)))
    const peso = parcelas / entradasMedia
    if (peso > PARCELAS_ATENCAO) {
      const urgente = peso > PARCELAS_URGENTE
      nova({
        id: 'parcelas-pesando', gravidade: urgente ? 'urgente' : 'atencao', prioridade: urgente ? 90 : 70, icone: 'divida', destino: 'dividas', botao: tx('Ver dívidas'),
        titulo: urgente ? tx('As parcelas levam mais da metade do que você recebe.') : tx('As parcelas estão pesando.'),
        porque: tx('Suas parcelas somam {0} por mês, {1}% do que você recebe. O ideal é ficar abaixo de {2}%.',
          fmtValor(parcelas), pct(peso), pct(PARCELAS_ATENCAO)),
      })
    }
  }

  // 4. Dívida crescendo: o que se devia há 3 meses (só as dívidas que já existiam) contra hoje
  if (v.dividas) {
    const k = doMesChave(atual - MESES_DA_DIVIDA)
    const antes = situacaoDividas(devo, e.saldos, e.pagamentos, k.ano, k.mes, e.taxas).filter((s) => s.restante > 0)
    const totalAntes = centavos(soma(antes.map((s) => s.restante)))
    const restanteHoje = new Map(dividasHoje.map((s) => [s.divida.id, s.restante]))
    const totalHoje = centavos(soma(antes.map((s) => restanteHoje.get(s.divida.id) ?? 0)))
    if (totalAntes > 0 && totalHoje > totalAntes * (1 + DIVIDA_CRESCEU_MIN)) {
      nova({
        id: 'divida-crescendo', gravidade: 'atencao', prioridade: 72, icone: 'sobe', destino: 'dividas', botao: tx('Ver dívidas'),
        titulo: tx('As dívidas estão aumentando.'),
        porque: tx('Há {0} meses você devia {1}. Hoje são {2}: {3} a mais.',
          MESES_DA_DIVIDA, fmtValor(totalAntes), fmtValor(totalHoje), fmtValor(centavos(totalHoje - totalAntes))),
      })
    }
  }

  // 5. Sem reserva: dinheiro guardado nos bancos contra o gasto médio por mês (só com saldo de banco preenchido)
  if (v.bancos && temFluxo && saidasMedia > 0) {
    const caixa = mesEfetivo(e.meses, hoje.getFullYear(), hoje.getMonth() + 1, hoje).caixa
    const preencheu = Object.values(caixa).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number'))
    const guardado = centavos(Math.max(0, soma(Object.keys(caixa).map((id) => caixaDoBanco(caixa, id)))))
    const meses = guardado / saidasMedia
    if (preencheu && meses < RESERVA_MIN_MESES) {
      const [de, ate] = RESERVA_IDEAL_MESES
      const abaixoDeUm = Math.floor(meses * 10) / 10
      const base = { id: 'sem-reserva', gravidade: 'atencao' as const, prioridade: 60, icone: 'escudo', destino: 'patrimonio' as const, botao: tx('Ver o guardado') }
      if (guardado <= 0) {
        nova({
          ...base, titulo: tx('Você ainda não tem reserva.'),
          porque: tx('Você gasta cerca de {0} por mês. Para imprevistos, o ideal é ter de {1} a {2} meses guardados.', fmtValor(saidasMedia), de, ate),
        })
      } else {
        nova({
          ...base,
          titulo: abaixoDeUm < 1 ? tx('Sua reserva não chega a 1 mês de gastos.')
            : abaixoDeUm === 1 ? tx('Sua reserva cobre 1 mês de gastos.')
              : tx('Sua reserva cobre {0} meses de gastos.', mesesTexto(abaixoDeUm)),
          porque: tx('Você tem {0} guardados e gasta cerca de {1} por mês. Para imprevistos, o ideal é ter de {2} a {3} meses guardados.',
            fmtValor(guardado), fmtValor(saidasMedia), de, ate),
        })
      }
    }
  }

  // 6. Gasto que disparou: no mês atual, a categoria que mais subiu sobre a média dos meses fechados
  if (temFluxo) {
    const mesAtual = analise.get(atual)!
    const nomeDe = new Map(e.categorias.filter((c) => c.tipo === 'saida' && c.papel !== 'divida').map((c) => [c.id, c.nome]))
    let pior: { id: string; nome: string; agora: number; base: number } | null = null
    for (const [id, agora] of Object.entries(mesAtual.porCategoria)) {
      const nome = nomeDe.get(id)
      if (!nome) continue // sem categoria ou pagamento de dívida: outras regras cuidam
      const base = centavos(soma(comDados.map((m) => m.porCategoria[id] ?? 0)) / comDados.length)
      const diferenca = agora - base
      if (base > 0 && agora > base * (1 + DISPAROU_ACIMA) && diferenca >= saidasMedia * DISPAROU_RELEVANTE && (!pior || diferenca > pior.agora - pior.base)) {
        pior = { id, nome, agora: centavos(agora), base }
      }
    }
    if (pior) {
      nova({
        id: `gasto-disparou:${pior.id}`, gravidade: 'atencao', prioridade: 55, icone: 'sobe', destino: 'lancamentos', botao: tx('Ver lançamentos'),
        titulo: tx('Você gastou mais que o normal em {0}.', pior.nome),
        porque: tx('Em {0} saíram {1} este mês, contra {2} por mês em média nos meses anteriores.', pior.nome, fmtValor(pior.agora), fmtValor(pior.base)),
      })
    }
  }

  // 7. Cartão comprometido: parcelas de compras no cartão que já estão marcadas para o mês que vem
  if (v.cartoes && temFluxo && entradasMedia > 0) {
    const prox = doMesChave(atual + 1)
    const parcelas = centavos(soma(e.compras
      .filter((l) => l.cartao_id && l.tipo === 'saida' && l.ano === prox.ano && l.mes === prox.mes && (l.parcelas ?? 1) > 1 && l.valor > 0)
      .map((l) => l.valor)))
    const peso = parcelas / entradasMedia
    if (peso > CARTAO_ATENCAO) {
      nova({
        id: 'cartao-comprometido', gravidade: 'atencao', prioridade: 65, icone: 'cartao', destino: 'cartoes', botao: tx('Ver cartões'),
        titulo: tx('As parcelas do cartão estão pesando.'),
        porque: tx('Em {0} já estão marcados {1} em compras parceladas no cartão, {2}% do que você recebe. O ideal é ficar abaixo de {3}%.',
          noMeioDaFrase(MESES_NOME[prox.mes - 1]), fmtValor(parcelas), pct(peso), pct(CARTAO_ATENCAO)),
      })
    }
  }

  // 8. Meta atrasada (a mais atrasada de todas)
  if (v.metas) {
    const hojeIso = hojeLocal(hoje)
    const inicioMesAtual = `${hojeIso.slice(0, 7)}-01`
    type Atrasada = { meta: Meta; peso: number; passou: boolean; falta: number; porMes: number; ritmo: number }
    let pior: Atrasada | null = null
    for (const meta of e.metas) {
      if (!meta.prazo || !(meta.alvo > 0)) continue
      const s = situacaoMeta(meta, e.movimentosMeta, hojeIso)
      if (s.batida || s.porMesNoPrazo === null) continue
      // O ritmo dos meses fechados (o mês atual está pela metade e enganaria), ou o já guardado este mês, o que for maior.
      const ritmo = Math.max(ritmoDosMesesFechados(s.movimentos, atual), soma(s.movimentos.filter((m) => m.data >= inicioMesAtual).map((m) => m.valor)), 0)
      const novaDemais = !s.movimentos.length && meta.created_at !== undefined
        && (hoje.getTime() - new Date(meta.created_at).getTime()) / 86400000 < META_DIAS_DE_CARENCIA
      if (novaDemais) continue
      if (!s.atrasada && ritmo >= s.porMesNoPrazo * META_TOLERANCIA) continue
      const peso = (s.atrasada ? 2 : 0) + (s.porMesNoPrazo - ritmo) / s.porMesNoPrazo
      if (!pior || peso > pior.peso) pior = { meta, peso, passou: s.atrasada, falta: s.falta, porMes: s.porMesNoPrazo, ritmo }
    }
    if (pior) {
      const { meta } = pior
      const [pa, pm] = meta.prazo!.split('-').map(Number)
      const prazo = fmtMesAno(pa, pm)
      const base = { id: `meta-atrasada:${meta.id}`, gravidade: 'atencao' as const, prioridade: 50, icone: 'meta', destino: 'metas' as const, botao: tx('Ver metas') }
      if (pior.passou) {
        nova({
          ...base, titulo: tx('A meta “{0}” passou do prazo.', meta.nome),
          porque: tx('Faltam {0} para juntar {1}, e o prazo acabou em {2}.', fmtMoeda(pior.falta, meta.moeda), fmtMoeda(meta.alvo, meta.moeda), prazo),
        })
      } else {
        nova({
          ...base, titulo: tx('A meta “{0}” não vai chegar a tempo.', meta.nome),
          porque: pior.ritmo > 0
            ? tx('Para chegar em {0}, o ideal é guardar {1} por mês. Hoje você guarda cerca de {2} por mês.', prazo, fmtMoeda(pior.porMes, meta.moeda), fmtMoeda(pior.ritmo, meta.moeda))
            : tx('Para chegar em {0}, o ideal é guardar {1} por mês. Nos últimos meses, nada foi guardado.', prazo, fmtMoeda(pior.porMes, meta.moeda)),
        })
      }
    }
  }

  // 9. Elogio: sobrou mais de 20% das entradas em cada um dos 3 meses fechados
  if (comDados.length === MESES_NA_MEDIA && comDados.every((m) => (m.entradas - m.saidas) / m.entradas > ELOGIO_SOBRA)) {
    const sobraPorMes = centavos(soma(comDados.map((m) => m.entradas - m.saidas)) / comDados.length)
    nova({
      id: 'guardando-bem', gravidade: 'elogio', prioridade: 10, icone: 'cofre', destino: v.metas ? 'metas' : 'lancamentos',
      botao: v.metas ? tx('Ver metas') : tx('Ver lançamentos'),
      titulo: tx('Você está guardando todo mês. Continue assim!'),
      porque: tx('Nos últimos {0} meses, sobraram mais de {1}% do que entrou: em média {2} por mês.',
        MESES_NA_MEDIA, pct(ELOGIO_SOBRA), fmtValor(sobraPorMes)),
    })
  }

  const dispensadas = new Set(e.perfil.dispensadas)
  return lista
    .filter((c) => !dispensadas.has(c.id) && !dispensadas.has(chaveDeDispensaDoMes(c.id, hoje)))
    .sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id))
}
