/**
 * As descobertas do consultor: o que a análise (lib/analise.ts) tem a dizer para esta pessoa, hoje.
 *
 * Uma descoberta não é um gráfico: é uma **mensagem** ("Mercado subiu 30%", "5 meses seguidos no azul") com o **dado** que
 * a sustenta, descrito pelo formato dele e não pelo desenho:
 *  - `partes`: um todo dividido (para onde vai o que entra);
 *  - `serie`: um valor ao longo do tempo (sobra mês a mês);
 *  - `ranking`: itens do maior para o menor (onde mais gasta);
 *  - `comparacao`: dois valores frente a frente (até hoje × o costume);
 *  - `pares`: vários "antes × agora";
 *  - `progresso`: quanto já andou até um alvo (reserva, limite do cartão, meta);
 *  - `numero`: um número só, que fala sozinho (juros pagos em 12 meses);
 *  - `pronto`: desenhos que só fazem sentido de um jeito (calendário, de onde sai o dinheiro, radar…).
 *
 * Quem escolhe o desenho de cada uma, e como a tela é montada, é lib/composicao.ts. Aqui só se decide **o que vale a pena
 * dizer** e quanto (`forca`): cada pessoa tem descobertas diferentes, porque só aparece o que os números dela sustentam.
 *
 * É puro, como o motor. As descobertas que já existiam como gráfico (lib/visuais.ts) mantêm o mesmo id.
 */
import type { Analise, Tom } from './analise'
import type { Destino } from './conselheiro'
import { fmtMesAno, fmtPct, fmtValor, MESES_CURTO } from './format'
import type { Objetivo } from './memoria'
import { tx } from './textos'
import { COR, visuais, type Fatia, type FormatoDoNumero, type Ponto, type Visual } from './visuais'

export type Tema = 'mes' | 'gastos' | 'dividas' | 'guardado' | 'como'

export interface ItemDoRanking { rotulo: string; valor: number; cor?: string; icone?: string; nota?: string }
export interface Par { rotulo: string; icone: string; antes: number; agora: number }
export interface LadoDaComparacao { rotulo: string; valor: number }

export type Dado =
  | { forma: 'pronto'; visual: Visual }
  | { forma: 'partes'; partes: Fatia[]; ideal?: Fatia[]; centro: { valor: string; rotulo: string } }
  | { forma: 'serie'; pontos: Ponto[]; tracejadoDesde?: number; /** A série é de dias seguidos ou saldo (curva) e não de meses soltos. */ continua: boolean }
  | { forma: 'ranking'; itens: ItemDoRanking[] }
  | { forma: 'comparacao'; antes: LadoDaComparacao; agora: LadoDaComparacao; /** Subir é bom (sobra) ou ruim (gasto)? */ subirEBom: boolean }
  | { forma: 'pares'; itens: Par[] }
  | { forma: 'progresso'; atual: number; alvo: number; marcos: { rotulo: string; valor: number }[]; /** O que o número é: "guardado", "usado". */ legenda: string; /** É dinheiro que se junta (cabe num pote) e não um limite que se gasta. */ junta: boolean }
  | { forma: 'numero'; valor: number; formato: FormatoDoNumero; legenda: string; historia?: Ponto[] }

export interface Achado {
  id: string
  tema: Tema
  /** Quanto vale a pena dizer isso a esta pessoa, hoje (maior = mais importante). */
  forca: number
  /** Até 5 palavras. */
  titulo: string
  /** Uma frase curta, com o número. É também a "versão" da descoberta: quando ela muda, é novidade. */
  frase: string
  tom?: Tom
  destino?: Destino
  dado: Dado
}

const TEMA_DO_VISUAL: Record<string, Tema> = {
  calendario: 'mes', 'curva-saldo': 'mes', fluxo: 'mes', 'colunas-sobra': 'mes',
  'rosca-503020': 'gastos', categorias: 'gastos', halteres: 'gastos', 'tabela-orcamento': 'gastos', 'barras-fixas': 'gastos',
  'linha-dividas': 'dividas', 'rosca-juros': 'dividas', 'barras-estrategias': 'dividas',
  'pote-reserva': 'guardado', 'aneis-metas': 'guardado', 'curva-patrimonio': 'guardado',
  radar: 'como',
}

/** Quanto cada objetivo sobe as descobertas novas de cada assunto (as antigas já sobem em lib/visuais.ts). */
const TEMAS_DO_OBJETIVO: Record<Objetivo, Partial<Record<Tema, number>>> = {
  dividas: { dividas: 14 }, 'fechar-mes': { mes: 14 }, guardar: { guardado: 14 }, controle: { gastos: 14 },
  tranquilo: { mes: 6, guardado: 6 }, crescer: { guardado: 12 },
}

/** O dado de um gráfico antigo, pelo formato (para o compositor poder desenhar de outro jeito). */
function dadoDe(v: Visual): Dado {
  switch (v.tipo) {
    case 'rosca': return { forma: 'partes', partes: v.fatias, ideal: v.ideal, centro: v.centro }
    case 'curva': return { forma: 'serie', pontos: v.pontos, tracejadoDesde: v.tracejadoDesde, continua: true }
    case 'colunas': return { forma: 'serie', pontos: v.colunas, continua: false }
    case 'pote': return { forma: 'progresso', atual: v.atual, alvo: v.maximo, marcos: v.marcos, legenda: tx('guardado'), junta: true }
    case 'halteres': return { forma: 'pares', itens: v.itens }
    case 'barras':
      // duas barras são uma comparação ("só as parcelas" × "adiantando")
      return v.barras.length === 2 && !v.barras.some((b) => b.icone)
        ? { forma: 'comparacao', antes: v.barras[0], agora: v.barras[1], subirEBom: false }
        : { forma: 'ranking', itens: v.barras }
    default: return { forma: 'pronto', visual: v }
  }
}

const mesCurto = (_ano: number, mes: number) => MESES_CURTO[mes - 1].slice(0, 3)
/** 0 a 1: quanto `valor` pesa perto de `base` (satura em `cheio`). */
const peso = (valor: number, base: number, cheio: number) => (base > 0 ? Math.min(1, Math.abs(valor) / base / cheio) : 0)

export function achados(a: Analise): Achado[] {
  const lista: Achado[] = visuais(a).map((v) => ({
    id: v.id, tema: TEMA_DO_VISUAL[v.id] ?? 'como', forca: v.prioridade, titulo: v.titulo, frase: v.frase, tom: v.tom, destino: v.destino, dado: dadoDe(v),
  }))
  const novos: Achado[] = []
  const fechados = a.serie.filter((s) => !s.atual)
  const comDados = fechados.filter((s) => s.comDados)

  // ---- o ritmo deste mês contra o costume ----
  const m = a.mes
  if (m && m.ateHojeNormal !== null && m.ateHojeNormal > 0 && m.dia >= 3 && m.saiuAteAgora > 0) {
    const dif = m.saiuAteAgora - m.ateHojeNormal
    const fracao = dif / m.ateHojeNormal
    if (Math.abs(fracao) >= 0.08) {
      novos.push({
        id: 'ritmo-do-mes', tema: 'mes', forca: 50 + 34 * peso(fracao, 1, 0.6), tom: dif > 0 ? 'medio' : 'bom', destino: 'lancamentos',
        titulo: dif > 0 ? tx('Mês mais caro que o costume') : tx('Mês mais leve que o costume'),
        frase: dif > 0
          ? tx('Até hoje saíram {0}. Nos outros meses, até este dia, costumam sair {1}.', fmtValor(m.saiuAteAgora), fmtValor(m.ateHojeNormal))
          : tx('Até hoje saíram {0}: menos que os {1} de costume até este dia.', fmtValor(m.saiuAteAgora), fmtValor(m.ateHojeNormal)),
        dado: { forma: 'comparacao', antes: { rotulo: tx('De costume'), valor: m.ateHojeNormal }, agora: { rotulo: tx('Este mês'), valor: m.saiuAteAgora }, subirEBom: false },
      })
    }
  }

  // ---- o que já passou do normal neste mês ----
  if (m && m.acimaDoNormal.length) {
    const c = m.acimaDoNormal[0]
    novos.push({
      id: 'acima-do-normal', tema: 'gastos', forca: 56 + 26 * peso(c.atual - c.media, a.gastos, 0.12), tom: 'medio', destino: 'lancamentos',
      titulo: tx('Já passou do normal'),
      frase: tx('{0}: {1} este mês. O costume é {2} no mês inteiro.', c.nome, fmtValor(c.atual), fmtValor(c.media)),
      dado: m.acimaDoNormal.length === 1
        ? { forma: 'comparacao', antes: { rotulo: tx('De costume'), valor: c.media }, agora: { rotulo: tx('Este mês'), valor: c.atual }, subirEBom: false }
        : { forma: 'pares', itens: m.acimaDoNormal.map((x) => ({ rotulo: x.nome, icone: x.icone, antes: x.media, agora: x.atual })) },
    })
  }

  // ---- meses seguidos no azul (ou no vermelho) ----
  if (comDados.length >= 3) {
    const ultimo = comDados[comDados.length - 1]
    const noAzul = ultimo.sobra >= 0
    let seguidos = 0
    for (let i = comDados.length - 1; i >= 0 && (comDados[i].sobra >= 0) === noAzul; i--) seguidos++
    if (seguidos >= 2) {
      novos.push({
        id: 'sequencia', tema: 'como', forca: (noAzul ? 44 : 62) + Math.min(18, seguidos * 3), tom: noAzul ? 'bom' : 'ruim', destino: 'ano',
        titulo: noAzul ? tx('Meses seguidos no azul') : tx('Meses seguidos no vermelho'),
        frase: noAzul
          ? tx('{0} meses seguidos fechando com sobra. O último: {1}.', seguidos, fmtValor(ultimo.sobra))
          : tx('{0} meses seguidos saindo mais do que entra. O último: {1} a menos.', seguidos, fmtValor(-ultimo.sobra)),
        dado: {
          forma: 'numero', valor: seguidos, formato: 'inteiro', legenda: noAzul ? tx('meses seguidos com sobra') : tx('meses seguidos faltando'),
          historia: comDados.slice(-8).map((s) => ({ rotulo: mesCurto(s.ano, s.mes), valor: s.sobra })),
        },
      })
    }
  }

  // ---- os gastos estão subindo ou caindo ----
  if (a.tendenciaGastos !== null && Math.abs(a.tendenciaGastos) >= 0.02 && comDados.length >= 4) {
    const sobe = a.tendenciaGastos > 0
    novos.push({
      id: 'tendencia-gastos', tema: 'gastos', forca: (sobe ? 52 : 40) + 26 * peso(a.tendenciaGastos, 1, 0.08), tom: sobe ? 'medio' : 'bom', destino: 'ano',
      titulo: sobe ? tx('Seus gastos estão subindo') : tx('Seus gastos estão caindo'),
      frase: sobe
        ? tx('Em média, sobem {0} a cada mês.', fmtPct(a.tendenciaGastos))
        : tx('Em média, caem {0} a cada mês.', fmtPct(-a.tendenciaGastos)),
      dado: { forma: 'serie', pontos: comDados.slice(-12).map((s) => ({ rotulo: mesCurto(s.ano, s.mes), valor: s.saidas })), continua: false },
    })
  }

  // ---- a categoria que mais subiu, mês a mês ----
  const subiu = a.subiram.find((c) => c.id !== '' && c.variacao !== null)
  if (subiu && comDados.length >= 4) {
    const pontos = comDados.slice(-8).map((s) => ({ rotulo: mesCurto(s.ano, s.mes), valor: s.porCategoria[subiu.id] ?? 0 }))
    if (pontos.filter((p) => p.valor > 0).length >= 3) {
      novos.push({
        id: `categoria:${subiu.id}`, tema: 'gastos',
        // "O que mudou nos gastos" já fala dela: esta é o detalhe, e vem depois
        forca: 36 + 30 * peso(subiu.variacao!, 1, 0.8), tom: 'medio', destino: 'lancamentos',
        titulo: tx('{0}, mês a mês', subiu.nome),
        frase: tx('Subiu {0}: hoje leva {1} por mês.', fmtPct(subiu.variacao!), fmtValor(subiu.media)),
        dado: { forma: 'serie', pontos, continua: false },
      })
    }
  }

  // ---- pequenos gastos que somam ----
  if (a.formigas.length) {
    const f = a.formigas[0]
    const noAno = a.formigas.reduce((s, x) => s + x.porAno, 0)
    novos.push({
      id: 'formigas', tema: 'gastos', forca: 42 + 30 * peso(noAno / 12, a.renda || a.gastos, 0.08), destino: 'lancamentos',
      titulo: tx('Pequenos gastos que somam'),
      frase: tx('{0}: cerca de {1} vezes por mês. No ano, {2}.', f.descricao, Math.round(f.vezesPorMes), fmtValor(f.porAno)),
      dado: a.formigas.length >= 2
        ? { forma: 'ranking', itens: a.formigas.map((x) => ({ rotulo: x.descricao, valor: x.porAno, cor: COR.violeta, nota: tx('no ano') })) }
        : { forma: 'numero', valor: f.porAno, formato: 'dinheiro', legenda: tx('por ano em {0}', f.descricao) },
    })
  }

  // ---- juros, multas e tarifas pagos ----
  if (a.jurosPagos > 0 && a.jurosPagos >= Math.max(20, (a.renda || a.gastos) * 0.01)) {
    novos.push({
      id: 'juros-pagos', tema: 'dividas', forca: 46 + 34 * peso(a.jurosPagos / 12, a.renda || a.gastos, 0.04), tom: 'ruim', destino: 'lancamentos',
      titulo: tx('Dinheiro que foi em juros'),
      frase: tx('Em 12 meses: {0} em juros, multas e tarifas.', fmtValor(a.jurosPagos)),
      dado: { forma: 'numero', valor: a.jurosPagos, formato: 'dinheiro', legenda: tx('em juros, multas e tarifas em 12 meses') },
    })
  }

  // ---- quanto a pessoa guarda por mês ----
  if (a.guardando > 0 && a.renda > 0) {
    novos.push({
      id: 'guardando', tema: 'guardado', forca: 40 + 28 * peso(a.guardando, a.renda, 0.25), tom: 'bom', destino: 'patrimonio',
      titulo: tx('Você guarda todo mês'),
      frase: tx('Cerca de {0} por mês vão para o que é seu: {1} do que entra.', fmtValor(a.guardando), fmtPct(a.guardando / a.renda)),
      dado: { forma: 'numero', valor: a.guardando * 12, formato: 'dinheiro', legenda: tx('guardados em um ano, nesse ritmo') },
    })
  }

  // ---- de onde vem a renda ----
  const fonte = a.principalFonte
  if (fonte && a.renda > 0 && fonte.fracao >= 0.5 && fonte.fracao < 0.97) {
    novos.push({
      id: 'fonte-da-renda', tema: 'como', forca: 34 + (a.rendaVaria ? 14 : 0), destino: 'lancamentos',
      titulo: tx('De onde vem o que entra'),
      frase: tx('{0} do que entra vem de {1}.', fmtPct(fonte.fracao), fonte.nome),
      dado: {
        forma: 'partes', centro: { valor: fmtPct(fonte.fracao), rotulo: fonte.nome },
        partes: [{ rotulo: fonte.nome, valor: fonte.fracao, cor: COR.entrada }, { rotulo: tx('Outras fontes'), valor: 1 - fonte.fracao, cor: COR.caixa }],
      },
    })
  }

  // ---- o limite do cartão ----
  const cartao = a.cartao
  if (cartao && cartao.limite !== null && cartao.limite > 0 && cartao.uso !== null && cartao.usado > 0) {
    const alto = cartao.uso >= 0.7
    novos.push({
      id: 'limite-do-cartao', tema: 'dividas', forca: alto ? 68 + 16 * peso(cartao.uso - 0.7, 0.3, 1) : 36, tom: alto ? 'ruim' : cartao.uso >= 0.3 ? 'medio' : 'bom', destino: 'cartoes',
      titulo: tx('Quanto do limite está tomado'),
      frase: tx('{0} do limite dos cartões já está usado.', fmtPct(cartao.uso)),
      dado: { forma: 'progresso', atual: cartao.usado, alvo: cartao.limite, marcos: [{ rotulo: tx('Até 30% é saudável'), valor: cartao.limite * 0.3 }, { rotulo: tx('Limite'), valor: cartao.limite }], legenda: tx('usado'), junta: false },
    })
  }

  // ---- a meta que está mais perto ----
  const metas = a.metas?.metas.filter((x) => x.alvo > 0 && x.guardado > 0 && x.guardado < x.alvo) ?? []
  const perto = [...metas].sort((x, y) => y.guardado / y.alvo - x.guardado / x.alvo)[0]
  if (perto && perto.guardado / perto.alvo >= 0.5) {
    const p = perto.guardado / perto.alvo
    novos.push({
      id: `meta-perto:${perto.id}`, tema: 'guardado', forca: 44 + 30 * (p - 0.5) * 2, tom: 'bom', destino: 'metas',
      titulo: tx('Falta pouco: {0}', perto.nome),
      frase: perto.previsao
        ? tx('Já tem {0} da meta. No ritmo de hoje, chega em {1}.', fmtPct(p), fmtMesAno(perto.previsao.ano, perto.previsao.mes))
        : tx('Já tem {0} da meta.', fmtPct(p)),
      dado: { forma: 'numero', valor: p, formato: 'pct', legenda: tx('da meta {0}', perto.nome) },
    })
  }

  // ---- o melhor mês ----
  if (comDados.length >= 5) {
    const melhor = [...comDados].sort((x, y) => y.sobra - x.sobra)[0]
    if (melhor.sobra > 0 && a.sobra < melhor.sobra * 0.7) {
      novos.push({
        id: 'melhor-mes', tema: 'como', forca: 36, tom: 'bom', destino: 'ano',
        titulo: tx('Seu melhor mês'),
        frase: tx('Em {0}, sobraram {1}. Dá para repetir.', fmtMesAno(melhor.ano, melhor.mes), fmtValor(melhor.sobra)),
        dado: { forma: 'comparacao', antes: { rotulo: tx('Média de hoje'), valor: Math.max(0, a.sobra) }, agora: { rotulo: mesCurto(melhor.ano, melhor.mes), valor: melhor.sobra }, subirEBom: true },
      })
    }
  }

  const objetivo = a.aprendizado.objetivo
  if (objetivo) for (const x of novos) x.forca += TEMAS_DO_OBJETIVO[objetivo][x.tema] ?? 0
  return [...lista, ...novos].sort((x, y) => y.forca - x.forca)
}
