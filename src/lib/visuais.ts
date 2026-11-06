/**
 * Gerador de visuais do consultor: olha a análise (lib/analise.ts) e decide quais gráficos, tabelas e medidores a pessoa
 * precisa ver, em ordem de importância, cada um com um título curto e uma frase só, em palavras simples.
 *
 * É puro como o motor: só monta os dados de cada visual. Quem desenha (e anima) é pages/AnaliseGraficos.tsx.
 * Cada tipo de visual serve a um tipo de pergunta:
 *  - medidor e escada: "como estou?"
 *  - cascata: "como o mês fecha?" (o que entra, o que sai, o que fica)
 *  - calendario e curva: "quando o dinheiro entra e sai, e quanto sobra na conta a cada dia?"
 *  - rosca: "para onde vai o que entra?" (com o ideal 50/30/20 por dentro)
 *  - radar: "qual parte do meu dinheiro está mais fraca?"
 *  - barras: "onde mais gasto?", "quanto pago no total?", "o que se repete todo mês?"
 *  - halteres: "o que mudou?" (antes × agora)
 *  - colunas: "quanto sobrou em cada mês?"
 *  - linhaDoTempo: "quando cada dívida acaba?"
 *  - pote: "quanto tenho guardado para imprevistos?"
 *  - aneis: "como estão as minhas metas?"
 *  - tabela: "quanto posso gastar em cada coisa?"
 */
import type { Analise, IdPilar, Tom } from './analise'
import { fmtMeses } from './analise'
import { doMesChave, chaveMes } from './cartoes'
import type { Destino } from './conselheiro'
import { fmtDataCurta, fmtMesAno, fmtPct, fmtValor, LOCAL_DAS_DATAS, MESES_CURTO, moedaAtual, valoresEstaoOcultos } from './format'
import { bonusDoJeito, tracosDe } from './jeito'
import type { Objetivo } from './memoria'
import { tx } from './textos'

export const COR = {
  entrada: 'var(--an-bom)', saida: 'var(--an-ruim)', divida: 'var(--an-atencao)', caixa: 'var(--an-destino)', violeta: 'var(--violeta)',
  neutro: 'var(--preench-1)', destaque: 'var(--destaque)',
} as const

const formatos = new Map<string, Intl.NumberFormat>()
/** Valor curto para caber num gráfico: "R$ 6,5 mil". */
export function fmtCurto(n: number) {
  if (valoresEstaoOcultos()) return '•••'
  const moeda = moedaAtual()
  let f = formatos.get(moeda)
  if (!f) {
    f = new Intl.NumberFormat(LOCAL_DAS_DATAS, { style: 'currency', currency: moeda, notation: 'compact', maximumFractionDigits: 1 })
    formatos.set(moeda, f)
  }
  return f.format(n)
}

interface Base {
  id: string
  /** Maior = mais importante (vem antes no feed). */
  prioridade: number
  /** Até 5 palavras. */
  titulo: string
  /** Uma frase curta, em palavras simples. */
  frase: string
  tom?: Tom
  destino?: Destino
}

export interface Ponto { rotulo: string; valor: number }
export interface Fatia { rotulo: string; valor: number; cor: string }

export type Visual = Base & (
  | { tipo: 'cascata'; passos: { rotulo: string; valor: number; tipo: 'entra' | 'sai' | 'fica' }[] }
  | { tipo: 'calendario'; ano: number; mes: number; hoje: number; dias: { dia: number; entra: number; sai: number }[]; marcados: { dia: number; tom: Tom }[] }
  | { tipo: 'curva'; pontos: Ponto[]; zero: boolean; tracejadoDesde?: number }
  | { tipo: 'rosca'; fatias: Fatia[]; ideal?: Fatia[]; centro: { valor: string; rotulo: string } }
  | { tipo: 'radar'; eixos: { rotulo: string; valor: number }[] }
  | { tipo: 'barras'; barras: { rotulo: string; valor: number; cor?: string; icone?: string; nota?: string }[] }
  | { tipo: 'halteres'; itens: { rotulo: string; icone: string; antes: number; agora: number }[] }
  | { tipo: 'colunas'; colunas: Ponto[] }
  | { tipo: 'linhaDoTempo'; inicio: number; fim: number; itens: { rotulo: string; fim: number; fimComPlano: number | null }[] }
  | { tipo: 'pote'; atual: number; maximo: number; marcos: { rotulo: string; valor: number }[] }
  | { tipo: 'aneis'; itens: { rotulo: string; icone: string; progresso: number; legenda: string; tom: Tom }[] }
  | { tipo: 'tabela'; colunas: string[]; linhas: { icone: string; rotulo: string; valores: number[]; corta: boolean }[] }
  | { tipo: 'fluxo'; grupos: GrupoDoFluxo[]; semDinheiro: { rotulo: string; valor: number; custo: number }[] }
)

/** Um dinheiro que entra (ou o saldo de hoje) e o que ele paga, com o atraso de cada um. */
export interface GrupoDoFluxo {
  fonte: string
  data: string
  valor: number
  itens: { rotulo: string; valor: number; atraso: number; custo: number }[]
}

/** Os nomes curtos dos pilares, para caber num gráfico. */
export const NOME_CURTO: Record<IdPilar, () => string> = {
  sobra: () => tx('Sobra'), reserva: () => tx('Reserva'), dividas: () => tx('Dívidas'), cartao: () => tx('Cartão'),
  controle: () => tx('Controle'), metas: () => tx('Metas'),
}

const mesCurto = (k: number) => {
  const { mes } = doMesChave(k)
  return MESES_CURTO[mes - 1].slice(0, 3)
}

/** Quanto cada objetivo sobe cada gráfico do feed. */
const BONUS_DO_OBJETIVO: Record<Objetivo, Record<string, number>> = {
  dividas: { 'linha-dividas': 40, 'barras-estrategias': 36, 'rosca-juros': 30, fluxo: 10 },
  'fechar-mes': { calendario: 34, 'curva-saldo': 34, fluxo: 28, 'tabela-orcamento': 14 },
  guardar: { 'pote-reserva': 42, 'aneis-metas': 32, 'colunas-sobra': 26, 'tabela-orcamento': 10 },
  controle: { categorias: 42, 'tabela-orcamento': 34, halteres: 30, 'rosca-503020': 24, 'barras-fixas': 16 },
  tranquilo: { 'colunas-sobra': 30, 'pote-reserva': 22, 'aneis-metas': 18, calendario: 8 },
  crescer: { 'curva-patrimonio': 44, 'aneis-metas': 26, 'pote-reserva': 14, 'colunas-sobra': 14 },
}

export function visuais(a: Analise): Visual[] {
  const v: Visual[] = []
  const atual = chaveMes(a.hoje.ano, a.hoje.mes)

  // ---- o mês dia a dia ----
  const g = a.agenda
  if (g) {
    const destaque = g.percepcoes.find((p) => p.data && p.data.slice(0, 7) === `${a.hoje.ano}-${String(a.hoje.mes).padStart(2, '0')}`)
    const marcados = g.percepcoes.filter((p) => p.data && p.data.slice(0, 7) === `${a.hoje.ano}-${String(a.hoje.mes).padStart(2, '0')}`)
      .map((p) => ({ dia: Number(p.data!.slice(8, 10)), tom: p.tom }))
    if (g.calendario.dias.some((d) => d.entra || d.sai)) {
      v.push({
        id: 'calendario', tipo: 'calendario', prioridade: destaque ? 92 : 70, ...g.calendario, marcados,
        titulo: tx('Seu mês, dia a dia'), tom: destaque?.tom,
        frase: destaque ? destaque.titulo : tx('Verde: dinheiro que entra. Vermelho: o que sai.'),
      })
    }
    if (g.dias.length >= 2) {
      const aperto = g.percepcoes.find((p) => p.id === 'aperto')
      const pontos = g.dias.map((d) => ({ rotulo: fmtDataCurta(d.data), valor: d.saldo }))
      if (g.saldoInicial !== null) pontos.unshift({ rotulo: tx('Hoje'), valor: g.saldoInicial })
      v.push({
        id: 'curva-saldo', tipo: 'curva', prioridade: aperto ? 96 : 52, pontos, zero: pontos.some((p) => p.valor < 0), tom: aperto ? 'ruim' : undefined,
        titulo: g.saldoInicial !== null ? tx('Quanto vai ter na conta') : tx('Como o dinheiro anda'),
        frase: aperto ? aperto.titulo
          : g.menorSaldo ? tx('Ponto mais baixo: {0} em {1}.', fmtValor(g.menorSaldo.valor), fmtDataCurta(g.menorSaldo.data)) : '',
      })
    }
  }

  // ---- de onde sai o dinheiro (o plano de pagamentos) ----
  const pl = a.plano
  if (pl && pl.pagamentos.length + pl.semDinheiro.length >= 2) {
    const grupos: GrupoDoFluxo[] = pl.fontes.map((f, i) => ({
      fonte: i === 0 && pl.comSaldo ? tx('Saldo de hoje') : f.descricao, data: f.data, valor: f.valor,
      // as que atrasam vêm primeiro: são as que pedem atenção
      itens: pl.pagamentos.filter((p) => p.fonteData === f.data).sort((x, y) => y.atraso - x.atraso)
        .map((p) => ({ rotulo: p.descricao, valor: p.valor + p.custo, atraso: p.atraso, custo: p.custo })),
    })).filter((x) => x.itens.length)
    const escolha = pl.dicas.find((x) => x.id.startsWith('escolha:') || x.id.startsWith('pagar-em:'))
    const antesDoDinheiro = pl.pagamentos.some((p) => p.fonteData && p.vence < p.fonteData)
    v.push({
      id: 'fluxo', tipo: 'fluxo', prioridade: pl.atrasos ? 94 : antesDoDinheiro ? 86 : 55, destino: 'contas', grupos,
      semDinheiro: pl.semDinheiro.map((p) => ({ rotulo: p.descricao, valor: p.valor, custo: p.custo })),
      titulo: tx('De onde sai o dinheiro'), tom: pl.semDinheiro.length ? 'ruim' : pl.atrasos ? 'medio' : 'bom',
      frase: pl.semDinheiro.length ? (pl.dicas.find((x) => x.id === 'sem-dinheiro')?.titulo ?? '')
        : escolha ? escolha.titulo
          : pl.comSaldo ? tx('Tudo o que vence até o fim do mês que vem cabe no dinheiro que entra.')
            : tx('As contas com data cabem no dinheiro que entra. O gasto do dia a dia fica de fora: informe o saldo dos bancos para eu contar com ele.'),
    })
  }

  // ---- os 6 pilares ----
  if (a.pilares.length >= 3) {
    const pior = [...a.pilares].sort((x, y) => x.nota - y.nota)[0]
    v.push({
      id: 'radar', tipo: 'radar', prioridade: 60, eixos: a.pilares.map((p) => ({ rotulo: NOME_CURTO[p.id](), valor: p.nota })),
      titulo: tx('Seu dinheiro em 6 partes'), frase: tx('Quanto mais cheio, melhor. O ponto fraco é {0}.', NOME_CURTO[pior.id]().toLowerCase()),
    })
  }

  // ---- para onde vai o que entra (50/30/20) ----
  const r = a.regra
  if (r) {
    const nec = r.essencial + r.parcelas
    const estilo = r.estilo + r.outros
    const total = Math.max(1, nec + estilo + r.sobra)
    const pior = nec > 0.5 ? tx('Necessidades: {0} (o ideal é até 50%).', fmtPct(nec))
      : estilo > 0.3 ? tx('Estilo de vida: {0} (o ideal é até 30%).', fmtPct(estilo))
        : r.sobra < 0.2 ? tx('Sobra: {0} (o ideal é 20% ou mais).', fmtPct(r.sobra))
          : tx('Dentro do ideal 50/30/20. Muito bem.')
    v.push({
      id: 'rosca-503020', tipo: 'rosca', prioridade: 66, destino: 'lancamentos',
      fatias: [
        { rotulo: tx('Necessidades'), valor: nec / total, cor: COR.caixa },
        { rotulo: tx('Estilo de vida'), valor: estilo / total, cor: COR.violeta },
        { rotulo: tx('Sobra'), valor: r.sobra / total, cor: COR.entrada },
      ],
      ideal: [
        { rotulo: tx('Necessidades'), valor: 0.5, cor: COR.caixa }, { rotulo: tx('Estilo de vida'), valor: 0.3, cor: COR.violeta },
        { rotulo: tx('Sobra'), valor: 0.2, cor: COR.entrada },
      ],
      centro: { valor: fmtCurto(a.renda), rotulo: tx('entra por mês') },
      titulo: tx('Para onde vai o que entra'), frase: pior,
    })
  }

  // ---- onde mais gasta ----
  const cats = a.categorias.filter((c) => c.media > 0).slice(0, 6)
  if (cats.length >= 2) {
    v.push({
      id: 'categorias', tipo: 'barras', prioridade: 58, destino: 'lancamentos',
      barras: cats.map((c) => ({ rotulo: c.nome, valor: c.media, cor: c.cor, icone: c.icone, nota: c.parcelado / c.media >= 0.5 ? tx('parcelas') : undefined })),
      titulo: tx('Onde mais gasta'), frase: tx('{0} leva {1} por mês.', cats[0].nome, fmtValor(cats[0].media)),
    })
  }

  // ---- o que mudou nos gastos ----
  const mudou = [...a.subiram, ...a.cairam].filter((c) => c.antes !== null).slice(0, 4)
  if (mudou.length) {
    const c = mudou[0]
    v.push({
      id: 'halteres', tipo: 'halteres', prioridade: a.subiram.length ? 62 : 40, destino: 'lancamentos',
      itens: mudou.map((x) => ({ rotulo: x.nome, icone: x.icone, antes: x.antes!, agora: x.media })),
      titulo: tx('O que mudou nos gastos'),
      frase: tx('{0}: de {1} para {2} por mês.', c.nome, fmtValor(c.antes!), fmtValor(c.media)),
      tom: a.subiram.length ? 'medio' : 'bom',
    })
  }

  // ---- sobra mês a mês ----
  const meses = a.serie.filter((s) => !s.atual)
  const primeiro = meses.findIndex((s) => s.comDados)
  if (primeiro >= 0 && meses.length - primeiro >= 3) {
    const usados = meses.slice(primeiro)
    v.push({
      id: 'colunas-sobra', tipo: 'colunas', prioridade: 48, destino: 'ano',
      colunas: usados.map((s) => ({ rotulo: mesCurto(chaveMes(s.ano, s.mes)), valor: s.comDados ? s.sobra : 0 })),
      titulo: tx('Sobra mês a mês'),
      frase: a.sobra >= 0 ? tx('Nos últimos meses, sobram {0} por mês.', fmtValor(a.sobra)) : tx('Nos últimos meses, faltam {0} por mês.', fmtValor(-a.sobra)),
      tom: a.sobra >= 0 ? 'bom' : 'ruim',
    })
  }

  // ---- dívidas ----
  const d = a.dividas
  if (d) {
    const recom = d.estrategias.find((x) => x.id === d.recomendada)!
    const base = d.estrategias[0]
    const comFim = d.ordem.filter((x) => x.quitaSemExtra || x.quitaEm)
    if (comFim.length) {
      const fins = comFim.flatMap((x) => [x.quitaSemExtra, x.quitaEm].filter(Boolean).map((m) => chaveMes(m!.ano, m!.mes)))
      v.push({
        id: 'linha-dividas', tipo: 'linhaDoTempo', prioridade: d.temCara ? 80 : 56, destino: 'dividas', inicio: atual, fim: Math.max(...fins),
        itens: comFim.map((x) => ({
          rotulo: x.nome,
          fim: x.quitaSemExtra ? chaveMes(x.quitaSemExtra.ano, x.quitaSemExtra.mes) : chaveMes(x.quitaEm!.ano, x.quitaEm!.mes),
          fimComPlano: x.quitaEm ? chaveMes(x.quitaEm.ano, x.quitaEm.mes) : null,
        })),
        titulo: tx('Quando cada dívida acaba'),
        frase: recom.fim && base.fim && chaveMes(recom.fim.ano, recom.fim.mes) < chaveMes(base.fim.ano, base.fim.mes)
          ? tx('Com o plano, sem dívidas em {0} (e não em {1}).', fmtMesAno(recom.fim.ano, recom.fim.mes), fmtMesAno(base.fim.ano, base.fim.mes))
          : base.fim ? tx('Sem dívidas em {0}.', fmtMesAno(base.fim.ano, base.fim.mes)) : '',
      })
    }
    if (d.jurosEmbutidos > 0) {
      v.push({
        id: 'rosca-juros', tipo: 'rosca', prioridade: d.temCara ? 74 : 46, destino: 'dividas',
        fatias: [
          { rotulo: tx('O que você pegou'), valor: d.total - d.jurosEmbutidos, cor: COR.caixa },
          { rotulo: tx('Juros'), valor: d.jurosEmbutidos, cor: COR.saida },
        ],
        centro: { valor: fmtCurto(d.total), rotulo: tx('falta pagar') },
        titulo: tx('Quanto do que deve é juros'),
        frase: tx('{0} do que falta são só juros.', fmtValor(d.jurosEmbutidos)), tom: 'medio',
      })
    }
    if (recom.economia && recom.economia > 0 && recom.meses !== null) {
      v.push({
        id: 'barras-estrategias', tipo: 'barras', prioridade: d.temCara ? 72 : 50, destino: 'dividas',
        barras: [
          { rotulo: tx('Só as parcelas'), valor: base.totalPago, cor: COR.neutro },
          { rotulo: tx('Com {0} a mais por mês', fmtValor(d.extra)), valor: recom.totalPago, cor: COR.entrada },
        ],
        titulo: tx('Quanto você paga no total'), frase: tx('Adiantando, você economiza {0}.', fmtValor(recom.economia)), tom: 'bom',
      })
    }
  }

  // ---- reserva ----
  const res = a.reserva
  if (res) {
    v.push({
      id: 'pote-reserva', tipo: 'pote', prioridade: res.meses < 1 ? 78 : res.falta > 0 ? 64 : 38, destino: 'patrimonio',
      atual: res.tem, maximo: Math.max(res.alvo, res.tem),
      marcos: [{ rotulo: tx('1 mês'), valor: res.colchao }, { rotulo: tx('{0} meses', res.alvoMeses), valor: res.alvo }],
      titulo: tx('Sua reserva'), tom: res.meses < 1 ? 'ruim' : res.falta > 0 ? 'medio' : 'bom',
      frase: res.falta > 0 ? tx('Cobre {0} de gastos. Ideal: {1} meses.', fmtMeses(res.meses), res.alvoMeses) : tx('Completa: cobre {0} de gastos.', fmtMeses(res.meses)),
    })
  }

  // ---- metas ----
  const m = a.metas
  if (m && m.metas.length) {
    const noRitmo = m.metas.filter((x) => x.noRitmo).length
    v.push({
      id: 'aneis-metas', tipo: 'aneis', prioridade: 50, destino: 'metas',
      itens: m.metas.slice(0, 6).map((x) => ({
        rotulo: x.nome, icone: x.icone, progresso: x.alvo > 0 ? Math.min(1, x.guardado / x.alvo) : 0, tom: x.noRitmo ? 'bom' : 'medio',
        legenda: x.previsao ? tx('chega em {0}', fmtMesAno(x.previsao.ano, x.previsao.mes)) : x.noRitmo ? tx('no ritmo') : tx('parada'),
      })),
      titulo: tx('Suas metas'), frase: tx('{0} de {1} no ritmo para chegar no prazo.', noRitmo, m.metas.length),
    })
  }

  // ---- teto para cada gasto (orçamento) ----
  const corta = a.categorias.filter((c) => c.grupo !== 'dividas' && c.media > 0).slice(0, 7)
  if (a.temFluxo && corta.length >= 2) {
    v.push({
      id: 'tabela-orcamento', tipo: 'tabela', prioridade: a.corte > 0 ? 54 : 34, destino: 'lancamentos',
      colunas: [tx('Gasto'), tx('Hoje'), tx('Teto')],
      linhas: corta.map((c) => ({ icone: c.icone, rotulo: c.nome, valores: [c.media, c.sugestao], corta: c.media - c.sugestao >= 1 })),
      titulo: tx('Teto para cada gasto'),
      frase: a.corte > 0 ? tx('Para guardar {0}, corte {1} por mês.', fmtPct(a.sobraAlvo), fmtValor(Math.ceil(a.corte / 10) * 10)) : tx('Você já guarda bem: a média é o teto.'),
    })
  }

  // ---- o que se repete todo mês ----
  if (a.recorrentes.length >= 2) {
    v.push({
      id: 'barras-fixas', tipo: 'barras', prioridade: a.assinaturasPorMes > 0 ? 44 : 30, destino: 'contas',
      barras: a.recorrentes.slice(0, 6).map((x) => ({ rotulo: x.descricao, valor: x.valor * 12, cor: x.assinatura ? COR.violeta : COR.caixa, nota: x.assinatura ? tx('assinatura') : undefined })),
      titulo: tx('Contas fixas no ano'),
      frase: a.assinaturasPorMes > 0 ? tx('Só as assinaturas: {0} por ano.', fmtValor(a.assinaturasPorMes * 12)) : tx('Somam {0} por ano.', fmtValor(a.recorrentesPorMes * 12)),
    })
  }

  // ---- tudo o que é seu ----
  const p = a.patrimonio
  if (p && p.serie.length >= 2) {
    const pontos = p.serie.map((x) => ({ rotulo: mesCurto(chaveMes(x.ano, x.mes)), valor: x.valor }))
    const tracejadoDesde = pontos.length - 1
    pontos.push({ rotulo: tx('+12 meses'), valor: p.em12 })
    v.push({
      id: 'curva-patrimonio', tipo: 'curva', prioridade: 36, destino: 'patrimonio', pontos, tracejadoDesde, zero: pontos.some((x) => x.valor < 0),
      titulo: tx('Tudo o que é seu'), frase: tx('Hoje {0}. Em 12 meses, {1}.', fmtValor(p.hoje), fmtValor(p.em12)),
      tom: p.em12 >= p.hoje ? 'bom' : 'ruim',
    })
  }

  // O jeito da pessoa (lib/jeito.ts) sobe o que mais serve a ela: quem gasta muito vê primeiro onde gasta.
  const tracos = tracosDe(a)
  for (const x of v) x.prioridade += bonusDoJeito(tracos, x.id)
  // E o objetivo que ela escolheu (lib/memoria.ts) sobe os gráficos que mostram o caminho até ele.
  const objetivo = a.aprendizado.objetivo
  if (objetivo) for (const x of v) x.prioridade += BONUS_DO_OBJETIVO[objetivo][x.id] ?? 0
  return v.sort((x, y) => y.prioridade - x.prioridade)
}

/** A cascata do mês: o que entra, o que sai em cada parte e o que fica. Vai no cartão "Seu mês". */
export function cascataDoMes(a: Analise): { rotulo: string; valor: number; tipo: 'entra' | 'sai' | 'fica' }[] | null {
  const m = a.mes
  if (!m) return null
  return [
    { rotulo: tx('Entra'), valor: m.entradasPrevistas, tipo: 'entra' },
    ...([
      { rotulo: tx('Já saiu'), valor: m.saiuAteAgora, tipo: 'sai' as const },
      { rotulo: tx('Contas'), valor: m.aPagar, tipo: 'sai' as const },
      { rotulo: tx('Dia a dia'), valor: m.diaADiaPrevisto, tipo: 'sai' as const },
    ].filter((p) => p.valor >= 0.5)),
    { rotulo: m.resultadoPrevisto >= 0 ? tx('Sobra') : tx('Falta'), valor: m.resultadoPrevisto, tipo: 'fica' },
  ]
}
