import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface ItemEncaixe {
  chave: string
  no: ReactNode
  /** Cartão que pode crescer à vontade para preencher a sobra (banner, "Acompanhe mais"). */
  elastico?: boolean
  /** Elástico que prefere ficar nas colunas a ir para a faixa de baixo. */
  fixarNasColunas?: boolean
}

interface Plano { esq: string[]; dir: string[]; baixo: string[] }

const VAO = 16
/** Até quanto um elástico pode esticar além do próprio tamanho sem "custo". */
const ESTICA_LIVRE = 280

/**
 * Melhor divisão dos blocos em duas colunas: as duas terminam na mesma altura e quem estica para isso é,
 * de preferência, um cartão elástico. Testa todas as divisões (são poucos blocos), mantendo a ordem de
 * leitura dentro de cada coluna.
 */
function planejar(itens: ItemEncaixe[], altura: Record<string, number>): Plano {
  const fixos = itens.filter((i) => !i.elastico)
  const elasticos = itens.filter((i) => i.elastico)
  if (itens.length <= 1) return { esq: itens.map((i) => i.chave), dir: [], baixo: [] }
  let melhor: { plano: Plano; custo: number } | null = null
  const somar = (ks: string[]) => ks.reduce((a, k) => a + (altura[k] ?? 0), 0) + Math.max(0, ks.length - 1) * VAO
  // o primeiro bloco fixo fica sempre na esquerda (espelhar não muda nada)
  const combFixos = fixos.length ? 1 << (fixos.length - 1) : 1
  const combElasticos = 3 ** elasticos.length
  for (let m = 0; m < combFixos; m++) {
    for (let e = 0; e < combElasticos; e++) {
      const esq: string[] = []
      const dir: string[] = []
      const baixo: string[] = []
      fixos.forEach((f, i) => (i === 0 || !(m & (1 << (i - 1))) ? esq : dir).push(f.chave))
      let resto = e
      let custo = 0
      for (const el of elasticos) {
        const lugar = resto % 3
        resto = Math.floor(resto / 3)
        if (lugar === 0) esq.push(el.chave)
        else if (lugar === 1) dir.push(el.chave)
        else {
          baixo.push(el.chave)
          custo += el.fixarNasColunas ? 400 : 90
        }
      }
      if (!esq.length || !dir.length) continue
      const he = somar(esq)
      const hd = somar(dir)
      const curta = he < hd ? esq : dir
      const dif = Math.abs(he - hd)
      const ultimo = itens.find((i) => i.chave === curta[curta.length - 1])
      // quem estica: o último da coluna mais curta. Elástico estica de graça (até um limite); bloco comum custa caro.
      custo += ultimo?.elastico ? Math.max(0, dif - ESTICA_LIVRE) : dif * 3
      custo += Math.max(he, hd) * 0.02
      if (!melhor || custo < melhor.custo) melhor = { plano: { esq, dir, baixo }, custo }
    }
  }
  return melhor?.plano ?? { esq: itens.map((i) => i.chave), dir: [], baixo: [] }
}

/** Antes da primeira medida: blocos alternados, para medir já na largura de coluna. */
const ingenuo = (itens: ItemEncaixe[]): Plano => ({
  esq: itens.filter((_, i) => i % 2 === 0).map((i) => i.chave),
  dir: itens.filter((_, i) => i % 2 === 1).map((i) => i.chave),
  baixo: [],
})

const larguraMinima = '(min-width: 901px)'

/**
 * Duas colunas que se encaixam sem vãos: os blocos se dividem para as colunas terminarem juntas, e o último
 * de cada coluna estica até o fim (de preferência um cartão elástico). No celular, uma coluna na ordem dada.
 * `versao` muda quando o conteúdo muda de tamanho de verdade (outro mês, outro jeito de ver); só aí os blocos
 * trocam de coluna, para nada pular de lugar enquanto a pessoa mexe num bloco.
 */
export function Encaixe({ itens, versao }: { itens: ItemEncaixe[]; versao: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [larga, setLarga] = useState(() => window.matchMedia(larguraMinima).matches)
  const [plano, setPlano] = useState<Plano | null>(null)
  const [largura, setLargura] = useState(0)
  const chaves = itens.map((i) => i.chave).join('|')

  useLayoutEffect(() => {
    const mq = window.matchMedia(larguraMinima)
    const aoMudar = () => setLarga(mq.matches)
    mq.addEventListener('change', aoMudar)
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width / 40)))
    if (caixa.current) ro.observe(caixa.current)
    return () => { mq.removeEventListener('change', aoMudar); ro.disconnect() }
  }, [])

  // mede o tamanho natural de cada bloco (sem esticar) e escolhe a divisão, antes de a tela ser pintada
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el || !larga) return
    el.classList.add('medindo')
    const altura: Record<string, number> = {}
    el.querySelectorAll<HTMLElement>('[data-encaixe]').forEach((n) => { altura[n.dataset.encaixe!] = n.offsetHeight })
    el.classList.remove('medindo')
    const novo = planejar(itens, altura)
    if (JSON.stringify(novo) !== JSON.stringify(plano)) setPlano(novo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves, versao, larga, largura])

  const porChave = new Map(itens.map((i) => [i.chave, i]))
  const item = (k: string) => {
    const i = porChave.get(k)
    return i ? <div key={k} data-encaixe={k} className={`encaixe-item ${i.elastico ? 'elastico' : ''}`}>{i.no}</div> : null
  }
  const valido = plano && [...plano.esq, ...plano.dir, ...plano.baixo].sort().join('|') === [...porChave.keys()].sort().join('|')
  if (!larga || itens.length < 2) {
    return <div className="encaixe uma" ref={caixa}><div className="encaixe-pilha">{itens.map((i) => item(i.chave))}</div></div>
  }
  const atual = valido ? plano : ingenuo(itens)
  return (
    <div className="encaixe" ref={caixa}>
      <div className="encaixe-colunas">
        <div className="encaixe-pilha">{atual.esq.map(item)}</div>
        <div className="encaixe-pilha">{atual.dir.map(item)}</div>
      </div>
      {atual.baixo.length > 0 && <div className="encaixe-baixo">{atual.baixo.map(item)}</div>}
    </div>
  )
}
