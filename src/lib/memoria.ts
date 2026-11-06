/**
 * A memória do consultor: o que ele aprende com cada pessoa para ajudar melhor (não para prendê-la no app).
 *
 *  - O **objetivo** que a pessoa escolheu ("sair das dívidas", "gastar sem culpa"…) muda a ordem do plano e o tom do resumo.
 *  - Cada passo do plano que dá para medir é **acompanhado**: o app anota o número do dia em que sugeriu ("você gasta
 *    R$ 6.500 por mês, corte R$ 300") e, quando o mês que decide fecha, confere se aconteceu. Deu certo: vira uma vitória
 *    na tela. Não deu: da próxima vez o passo vem menor; duas vezes sem dar, ele para de insistir.
 *
 * É puro, como o motor: `atualizarMemoria` recebe a memória e a análise e devolve a memória nova (a mesma, se nada mudou).
 * Fica em `perfis.consultor` (migração 24) e, sem a coluna, no aparelho.
 */
import type { Analise } from './analise'
import { chaveMes, doMesChave } from './cartoes'
import { fmtMesAno, fmtValor } from './format'
import { tx } from './textos'

export type Objetivo = 'dividas' | 'guardar' | 'tranquilo' | 'controle' | 'crescer' | 'fechar-mes'

export const OBJETIVOS: { id: Objetivo; icone: string; nome: () => string; descricao: () => string }[] = [
  { id: 'dividas', icone: 'divida', nome: () => tx('Sair das dívidas'), descricao: () => tx('Quitar o que devo, começando pelo que custa mais.') },
  { id: 'fechar-mes', icone: 'calendario', nome: () => tx('Fechar o mês sem aperto'), descricao: () => tx('Chegar ao fim do mês sem faltar dinheiro.') },
  { id: 'guardar', icone: 'cofre', nome: () => tx('Juntar dinheiro'), descricao: () => tx('Ter uma reserva e guardar todo mês.') },
  { id: 'controle', icone: 'lista', nome: () => tx('Saber para onde vai o dinheiro'), descricao: () => tx('Ver cada gasto e onde dá para melhorar.') },
  { id: 'tranquilo', icone: 'estrela', nome: () => tx('Gastar sem culpa'), descricao: () => tx('Saber quanto posso aproveitar sem me prejudicar.') },
  { id: 'crescer', icone: 'investir', nome: () => tx('Fazer o dinheiro render'), descricao: () => tx('Pôr o que sobra para trabalhar pelo futuro.') },
]

export const nomeDoObjetivo = (o: Objetivo) => OBJETIVOS.find((x) => x.id === o)?.nome() ?? o

/** Um passo do plano que o app está acompanhando para saber se deu certo. */
export interface Acompanhado {
  /** O id da ação (estável entre análises: 'corte', 'subiu:<categoria>', 'reserva'…). */
  id: string
  /** O dia em que foi sugerido. */
  desde: string
  /** O mês (chaveMes) cujo fechamento diz se deu certo. */
  avaliar: number
  /** A medida no dia (gasto do mês, total das dívidas, reserva…). */
  base: number
  /** Quanto o passo pediu (o corte, o valor por mês…). */
  alvo: number
  /** Parcelas por mês das dívidas no dia (só para as dívidas: o que cairia mesmo sem nada a mais). */
  esperado?: number
  /** O que foi pedido, como apareceu na tela. */
  titulo: string
  resultado?: 'funcionou' | 'nao'
  medido?: number
  conferidoEm?: string
}

export interface MemoriaConsultor {
  objetivo: Objetivo | null
  objetivoEm: string | null
  acompanhados: Acompanhado[]
}

export const MEMORIA_VAZIA: MemoriaConsultor = { objetivo: null, objetivoEm: null, acompanhados: [] }

const IDS_OBJETIVO = new Set(OBJETIVOS.map((o) => o.id))

/** Garante a forma, mesmo vindo de uma versão antiga ou de um JSON estranho. */
export function normMemoria(x: unknown): MemoriaConsultor {
  const m = (x && typeof x === 'object' ? x : {}) as Partial<MemoriaConsultor>
  return {
    objetivo: m.objetivo && IDS_OBJETIVO.has(m.objetivo) ? m.objetivo : null,
    objetivoEm: typeof m.objetivoEm === 'string' ? m.objetivoEm : null,
    acompanhados: Array.isArray(m.acompanhados)
      ? m.acompanhados.filter((a): a is Acompanhado => Boolean(a && typeof a.id === 'string' && typeof a.desde === 'string' && typeof a.base === 'number' && typeof a.avaliar === 'number'))
      : [],
  }
}

// ---------- como medir cada passo ----------

const centavos = (n: number) => Math.round(n * 100) / 100
const tipoDe = (id: string) => id.split(':')[0]
const resto = (id: string) => id.slice(id.indexOf(':') + 1)
const mesDaSerie = (a: Analise, k: number) => a.serie.find((m) => chaveMes(m.ano, m.mes) === k)

/** Passos que se medem pelo mês fechado (o fluxo) e os que se medem pelo saldo de hoje (o estoque). */
interface Regra {
  /** A medida hoje, quando o passo aparece. */
  base: (a: Analise, id: string) => number | null
  /** Quanto o passo pede. */
  alvo: (a: Analise, id: string) => number
  /** A medida no mês que decide (ou hoje, para o que é saldo). */
  medir: (a: Analise, x: Acompanhado) => number | null
  /** Deu certo? `meses`: quantos meses passaram desde a sugestão (pelo menos 1). */
  ok: (x: Acompanhado, medido: number, meses: number) => boolean
  /** Meses a mais de espera antes de conferir (a assinatura cancelada demora a sair das que se repetem). */
  espera?: number
  /** Só acompanha quando a ação diz quanto pede (a categoria que subiu por parcelas já assumidas não dá para cobrar). */
  soComPedido?: boolean
}

const REGRAS: Record<string, Regra> = {
  corte: {
    base: (a) => a.gastos || null, alvo: (a) => a.corte,
    medir: (a, x) => mesDaSerie(a, x.avaliar)?.saidas ?? null,
    ok: (x, m) => m <= x.base - Math.max(1, x.alvo * 0.5),
  },
  vermelho: {
    base: (a) => (a.temFluxo ? a.sobra : null), alvo: (a) => Math.max(0, -a.sobra),
    medir: (a, x) => mesDaSerie(a, x.avaliar)?.sobra ?? null,
    ok: (x, m) => m >= 0 || m >= x.base + Math.abs(x.base) * 0.5,
  },
  subiu: {
    base: (a, id) => a.categorias.find((c) => c.id === resto(id))?.media ?? null,
    alvo: (a, id) => { const c = a.categorias.find((x) => x.id === resto(id)); return c && c.antes !== null ? Math.max(0, c.media - c.antes) : 0 },
    medir: (a, x) => { const m = mesDaSerie(a, x.avaliar); return m ? m.porCategoria[resto(x.id)] ?? 0 : null },
    ok: (x, m) => m <= x.base - Math.max(1, x.alvo * 0.5),
    soComPedido: true,
  },
  'pode-gastar': {
    base: (a) => a.gastos || null, alvo: (a) => a.podeGastar,
    medir: (a, x) => mesDaSerie(a, x.avaliar)?.saidas ?? null,
    // para quem tem medo de gastar, dar certo é se permitir um pouco
    ok: (x, m) => m >= x.base + x.alvo * 0.3,
  },
  'adiantar-divida': {
    base: (a) => a.dividas?.total ?? null, alvo: (a) => (a.dividas && !a.dividas.extraExemplo ? a.dividas.extra : 0),
    medir: (a) => a.dividas?.total ?? 0,
    ok: (x, m, meses) => m <= x.base - meses * ((x.esperado ?? 0) + Math.max(1, x.alvo * 0.5)),
  },
  'quitar-com-reserva': {
    base: (a, id) => a.dividas?.ordem.find((d) => d.id === resto(id))?.restante ?? null, alvo: () => 0,
    medir: (a, x) => a.dividas?.ordem.find((d) => d.id === resto(x.id))?.restante ?? 0,
    ok: (x, m) => m <= x.base * 0.1,
  },
  'juros-altos': {
    base: (a, id) => a.dividas?.ordem.find((d) => d.id === resto(id))?.juros ?? null, alvo: () => 0,
    medir: (a, x) => a.dividas?.ordem.find((d) => d.id === resto(x.id))?.juros ?? 0,
    ok: (x, m) => m < x.base,
  },
  reserva: {
    base: (a) => a.reserva?.tem ?? null, alvo: (a) => a.reserva?.porMes ?? 0,
    medir: (a) => a.reserva?.tem ?? null,
    ok: (x, m, meses) => (x.alvo > 0 ? m >= x.base + x.alvo * meses * 0.5 : m > x.base * 1.03),
  },
  cartao: {
    base: (a) => (a.cartao ? a.cartao.proximas.reduce((s, p) => s + p.valor, 0) : null), alvo: () => 0,
    medir: (a) => (a.cartao ? a.cartao.proximas.reduce((s, p) => s + p.valor, 0) : 0),
    ok: (x, m) => m <= x.base * 0.85,
  },
  atrasos: {
    base: (a) => a.atrasoTotal || null, alvo: (a) => a.atrasoTotal,
    medir: (a) => a.atrasoTotal,
    ok: (_x, m) => m < 1,
  },
  'sem-novas-parcelas': {
    base: (a) => a.dividas?.parcelasMes ?? null, alvo: () => 0,
    medir: (a) => a.dividas?.parcelasMes ?? 0,
    ok: (x, m) => m <= x.base + 0.5,
  },
  assinaturas: {
    base: (a) => a.assinaturasPorMes || null, alvo: () => 0,
    medir: (a) => a.assinaturasPorMes,
    ok: (x, m) => m <= x.base * 0.9,
    espera: 2,
  },
}
REGRAS.colchao = REGRAS.reserva

/** Dá para acompanhar este passo? */
export const acompanhavel = (id: string) => tipoDe(id) in REGRAS

const iguais = (a: MemoriaConsultor, b: MemoriaConsultor) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A memória depois desta análise: confere os passos cujo mês já fechou e começa a acompanhar os passos novos do plano.
 * Devolve o mesmo objeto quando nada mudou (para não gravar à toa).
 */
export function atualizarMemoria(m: MemoriaConsultor, a: Analise, hoje = new Date()): MemoriaConsultor {
  const atual = chaveMes(hoje.getFullYear(), hoje.getMonth() + 1)
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  // 1. confere o que já pode ser conferido
  let lista = m.acompanhados.map((x) => {
    const r = REGRAS[tipoDe(x.id)]
    if (x.resultado || !r || atual <= x.avaliar + (r.espera ?? 0)) return x
    const medido = r.medir(a, x)
    if (medido === null) return x
    const desde = chaveMes(Number(x.desde.slice(0, 4)), Number(x.desde.slice(5, 7)))
    const meses = Math.max(1, atual - desde)
    return { ...x, medido: centavos(medido), conferidoEm: hojeIso, resultado: r.ok(x, medido, meses) ? 'funcionou' as const : 'nao' as const }
  })
  // 2. começa a acompanhar o que entrou no plano (um passo por vez: o mesmo id só volta depois de conferido)
  const abertos = new Set(lista.filter((x) => !x.resultado).map((x) => x.id))
  for (const acao of a.acoes) {
    const r = REGRAS[tipoDe(acao.id)]
    if (!r || abertos.has(acao.id) || (r.soComPedido && acao.pedido === undefined)) continue
    // já conferido neste mês: espera o mês que vem para não medir duas vezes a mesma coisa
    if (lista.some((x) => x.id === acao.id && x.conferidoEm?.slice(0, 7) === hojeIso.slice(0, 7))) continue
    const base = r.base(a, acao.id)
    if (base === null) continue
    lista.push({
      id: acao.id, desde: hojeIso,
      // sugerido depois do dia 10: o mês que decide é o que vem (não dá tempo de mudar este)
      avaliar: hoje.getDate() > 10 ? atual + 1 : atual,
      base: centavos(base), alvo: centavos(acao.pedido ?? r.alvo(a, acao.id)), titulo: acao.titulo,
      ...(tipoDe(acao.id) === 'adiantar-divida' ? { esperado: centavos(a.dividas?.parcelasMes ?? 0) } : {}),
    })
  }
  // 3. não cresce para sempre: os 40 mais recentes
  if (lista.length > 40) lista = lista.slice(-40)
  const nova = { ...m, acompanhados: lista }
  return iguais(nova, m) ? m : nova
}

// ---------- o que a análise usa ----------

export interface Licao {
  /** Quantas vezes seguidas (das mais recentes) o passo não deu certo. */
  falhas: number
  /** O último resultado conferido. */
  ultimo: Acompanhado | null
}

/** O que a memória ensina sobre um passo do plano. */
export function licaoDe(m: MemoriaConsultor | undefined, id: string): Licao {
  const conferidos = (m?.acompanhados ?? []).filter((x) => x.id === id && x.resultado)
  let falhas = 0
  for (let i = conferidos.length - 1; i >= 0 && conferidos[i].resultado === 'nao'; i--) falhas++
  return { falhas, ultimo: conferidos[conferidos.length - 1] ?? null }
}

/** Uma linha sobre um passo conferido, para a pessoa ver o que aconteceu. */
export function fraseDoResultado(x: Acompanhado): string {
  const mes = (() => { const d = doMesChave(x.avaliar); return fmtMesAno(d.ano, d.mes) })()
  const medido = x.medido ?? 0
  const dif = centavos(Math.abs(x.base - medido))
  const tipo = tipoDe(x.id)
  if (x.resultado === 'funcionou') {
    if (tipo === 'corte' || tipo === 'subiu') return tx('Em {0} você gastou {1} a menos do que costumava. Deu certo.', mes, fmtValor(dif))
    if (tipo === 'vermelho') return tx('{0} fechou com {1} de sobra.', mes, fmtValor(medido))
    if (tipo === 'pode-gastar') return tx('Em {0} você se permitiu gastar {1} a mais, sem sair do plano.', mes, fmtValor(dif))
    if (tipo === 'reserva' || tipo === 'colchao') return tx('Sua reserva cresceu {0} desde a sugestão.', fmtValor(dif))
    if (tipo === 'adiantar-divida') return tx('Suas dívidas caíram {0} desde a sugestão, mais do que só as parcelas.', fmtValor(dif))
    if (tipo === 'atrasos') return tx('O que estava atrasado foi colocado em dia.')
    return tx('Deu certo: {0}', x.titulo)
  }
  if (tipo === 'corte' || tipo === 'subiu') return tx('Em {0} o gasto não caiu como o combinado.', mes)
  if (tipo === 'vermelho') return tx('{0} ainda fechou no vermelho.', mes)
  return tx('Ainda não aconteceu: {0}', x.titulo)
}
