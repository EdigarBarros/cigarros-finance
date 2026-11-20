/**
 * A grade de cartões da Início do computador, com os cartões que se encaixam como bloquinhos (docs/arquitetura-do-painel.md,
 * 4.0.0). No modo Arrumar a pessoa arrasta um cartão para mudar o lugar e puxa o canto para mudar o tamanho.
 *
 * Por que não trava: a posição de cada cartão é só conta (lib/widgets.ts, `encaixar`, com os números de `GRADE`). Durante o
 * arrasto nada passa pelo React: a cada quadro a conta é refeita e o resultado vai direto para o estilo dos cartões
 * (`transform` para o lugar, que a placa de vídeo anima sozinha; largura e altura só mudam de verdade no cartão que está
 * sendo puxado). A tela só é medida quando o conteúdo de um cartão muda (ResizeObserver, que o navegador entrega já com a
 * página calculada) e na largura da grade; nunca no meio do quadro. O React só entra quando a pessoa solta o mouse, para
 * guardar a arrumação.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { tx } from '../lib/textos'
import {
  alturaDe, encaixar, GRADE, limitarTamanho, linhasDaGradeToda, linhasDoComputador, linhasPara, minimoDe,
  type Bloco, type IdWidget, type TamanhoNoComputador, type TamanhosNoComputador,
} from '../lib/widgets'

/** O arrasto em andamento: mudar o tamanho (canto) ou o lugar (o cartão inteiro). */
type Arrasto =
  | { tipo: 'tamanho'; id: IdWidget; x0: number; y0: number; w0: number; h0: number; esquerda: number; tamanhos: TamanhosNoComputador; x: number; y: number; hAgora: number; mexeuAltura: boolean }
  | { tipo: 'lugar'; id: IdWidget; x0: number; y0: number; dx: number; dy: number; rolagem0: number; topo0: number; esquerda0: number; ordem: IdWidget[]; alvo: IdWidget | null; andou: boolean }

export function GradeDoComputador({ ids, tamanhos, arrumando, tituloDe, conteudo, barra, aoReordenar, aoRedimensionar }: {
  ids: IdWidget[]
  tamanhos?: TamanhosNoComputador
  arrumando: boolean
  tituloDe: (id: IdWidget) => string
  /** O cartão. `fixo`: a altura é a escolhida pela pessoa (a lista pode trazer mais linhas). */
  conteudo: (id: IdWidget, fixo: boolean) => ReactNode
  /** A barra do modo Arrumar (nome, subir, descer, tirar). */
  barra: (id: IdWidget) => ReactNode
  aoReordenar: (ordem: IdWidget[]) => void
  /** `ordem`: quando puxar o canto mudou a ordem de leitura dos cartões (os outros se encaixaram em volta). */
  aoRedimensionar: (id: IdWidget, t: TamanhoNoComputador | null, ordem?: IdWidget[]) => void
}) {
  const refGrade = useRef<HTMLDivElement>(null)
  const refVaga = useRef<HTMLDivElement>(null)
  const celulas = useRef(new Map<IdWidget, HTMLDivElement>())
  /** A altura do conteúdo de cada cartão (px), medida quando ele muda. */
  const alturas = useRef(new Map<IdWidget, number>())
  const largura = useRef(0)
  const blocos = useRef<Bloco[]>([])
  const arrasto = useRef<Arrasto | null>(null)
  const ponteiro = useRef({ x: 0, y: 0 })
  const quadro = useRef(0)
  // o que vale agora (o desenho lê daqui: muda sem esperar o React)
  const atual = useRef({ ids, tamanhos })
  /** O cartão que está sendo puxado pelo canto: já se desenha como de altura escolhida (a lista cresce junto). */
  const [ampliando, setAmpliando] = useState<IdWidget | null>(null)

  const colunaPx = () => (largura.current - GRADE.vao * (GRADE.colunas - 1)) / GRADE.colunas
  const xPx = (x: number) => x * (colunaPx() + GRADE.vao)
  const larguraPx = (w: number) => w * colunaPx() + (w - 1) * GRADE.vao
  const yPx = (y: number) => y * (GRADE.linha + GRADE.vao)

  /** A conta: onde fica cada cartão, com a ordem e os tamanhos dados (os do arrasto, se houver). */
  const montar = (ordem: IdWidget[], tams: TamanhosNoComputador | undefined, preso?: { id: IdWidget; x: number; y: number }) => {
    const larguras = new Map(linhasDoComputador(ordem, tams).flat().map((k) => [k.id, k.colunas]))
    return encaixar(ordem.map((id) => {
      const l = tams?.[id]?.l
      // o cartão puxado pelo canto tem a largura que a pessoa está dando (sem a sobra da linha)
      const w = preso?.id === id ? tams?.[id]?.c ?? 6 : larguras.get(id) ?? 6
      return { id, w, h: l ?? linhasPara(alturas.current.get(id) ?? 240), fixo: l !== undefined }
    }), undefined, preso)
  }

  /**
   * As linhas da lista de um cartão de altura escolhida: aparecem só as que cabem inteiras. É conta com as alturas
   * medidas quando o conteúdo mudou (`partes`), então dá para fazer a cada quadro do arrasto sem medir nada; esconder é
   * `visibility`, que não recalcula a página.
   */
  const partes = useRef(new Map<IdWidget, { fixas: number; itens: number[] }>())
  const recortar = (id: IdWidget, altura: number, fixo: boolean) => {
    const corpo = celulas.current.get(id)?.querySelector<HTMLElement>('.widget-corpo')
    const m = partes.current.get(id)
    if (!corpo || !m) return
    const filhos = corpo.children
    // um bloco só (gráfico, resumo, número) se ajusta sozinho ao espaço
    const lista = fixo && filhos.length > 1 && !corpo.closest('.widget-evolucao')
    let usado = m.fixas
    for (let i = 0; i < filhos.length; i++) {
      usado += m.itens[i] ?? 0
      const some = lista && usado > altura + 0.5
      const el = filhos[i] as HTMLElement
      if ((el.style.visibility === 'hidden') !== some) el.style.visibility = some ? 'hidden' : ''
    }
  }
  /** Mede as partes de um cartão (rodapé, título e cada linha da lista), para o recorte acima. */
  const medirPartes = (id: IdWidget) => {
    const w = celulas.current.get(id)?.querySelector<HTMLElement>('.widget')
    const corpo = w?.querySelector<HTMLElement>('.widget-corpo')
    if (!w || !corpo) return
    const cs = getComputedStyle(w)
    let fixas = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    for (const f of w.children) if (f !== corpo && getComputedStyle(f).position !== 'absolute') fixas += (f as HTMLElement).offsetHeight
    const itens = [...corpo.children].map((f) => {
      const c = getComputedStyle(f)
      return (f as HTMLElement).offsetHeight + parseFloat(c.marginTop) + parseFloat(c.marginBottom)
    })
    partes.current.set(id, { fixas, itens })
  }

  /** Refaz a conta e escreve o resultado no estilo dos cartões. Só escreve: não lê nada da tela. */
  const desenhar = () => {
    const grade = refGrade.current
    if (!grade || !largura.current) return
    const a = arrasto.current
    const ordem = a?.tipo === 'lugar' ? a.ordem : atual.current.ids
    const tams = a?.tipo === 'tamanho' ? a.tamanhos : atual.current.tamanhos
    // puxando o canto, o cartão fica preso onde estava (não foge do mouse); os outros se encaixam em volta
    const novos = montar(ordem, tams, a?.tipo === 'tamanho' ? { id: a.id, x: a.x, y: a.y } : undefined)
    blocos.current = novos
    for (const b of novos) {
      const el = celulas.current.get(b.id)
      if (!el) continue
      // as classes da célula são só daqui (o React não mexe nelas: trocar o className de uma vez apagaria estas)
      el.classList.toggle('fixo', b.fixo || b.id === ampliandoAgora.current)
      el.classList.toggle('puxando', a?.tipo === 'tamanho' && a.id === b.id)
      el.classList.toggle('pegando', a?.tipo === 'lugar' && a.andou && a.id === b.id)
      if (a?.id === b.id) {
        // o cartão na mão: o lugar segue o mouse (lugar) ou fica preso (tamanho); o tamanho segue o mouse (tamanho)
        if (a.tipo === 'tamanho') {
          el.style.transform = `translate3d(${xPx(b.x)}px, ${yPx(b.y)}px, 0)`
          // só para o lado: a altura é a da conta (a do conteúdo, alinhada com a fileira)
          if (!a.mexeuAltura) { a.hAgora = alturaDe(b.h); el.style.height = `${a.hAgora}px` }
          recortar(b.id, a.hAgora, b.fixo || a.mexeuAltura)
        }
        else { el.style.width = `${larguraPx(b.w)}px`; el.style.height = `${alturaDe(b.h)}px`; recortar(b.id, alturaDe(b.h), b.fixo) }
        const vaga = refVaga.current
        if (vaga) {
          vaga.style.transform = `translate3d(${xPx(b.x)}px, ${yPx(b.y)}px, 0)`
          vaga.style.width = `${larguraPx(b.w)}px`
          vaga.style.height = `${alturaDe(b.h)}px`
        }
        continue
      }
      el.style.transform = `translate3d(${xPx(b.x)}px, ${yPx(b.y)}px, 0)`
      el.style.width = `${larguraPx(b.w)}px`
      el.style.height = `${alturaDe(b.h)}px`
      recortar(b.id, alturaDe(b.h), b.fixo || b.id === ampliandoAgora.current)
    }
    grade.style.height = `${alturaDe(Math.max(1, linhasDaGradeToda(novos)))}px`
  }
  const ampliandoAgora = useRef<IdWidget | null>(null)

  /** A altura do conteúdo de um cartão: título + corpo + rodapé + as bordas (sem o que o cartão esticou). */
  const medir = (id: IdWidget) => {
    const cel = celulas.current.get(id)
    const w = cel?.querySelector<HTMLElement>('.widget')
    // o de altura escolhida tem o corpo esticado: a medida não seria a do conteúdo (e não é usada)
    if (!w || cel!.classList.contains('fixo')) return
    const cs = getComputedStyle(w)
    let h = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    for (const filho of w.children) if (getComputedStyle(filho).position !== 'absolute') h += (filho as HTMLElement).offsetHeight
    alturas.current.set(id, Math.ceil(h))
  }

  const observador = useRef<ResizeObserver | null>(null)
  const observarPartes = (ro: ResizeObserver, w: Element) => {
    for (const f of w.children) ro.observe(f)
    for (const f of w.querySelector('.widget-corpo')?.children ?? []) ro.observe(f)
  }
  // a cada desenho do React (dados novos, cartão novo, tamanho guardado, modo Arrumar): mede e posiciona, antes de pintar
  useLayoutEffect(() => {
    const grade = refGrade.current
    if (!grade) return
    atual.current = { ids, tamanhos }
    ampliandoAgora.current = ampliando
    grade.classList.toggle('arrumando', arrumando)
    if (!largura.current) largura.current = grade.clientWidth
    for (const id of ids) {
      medir(id)
      medirPartes(id)
      // as partes de cada cartão (título, corpo, rodapé, cada linha): quando uma muda de altura, mede de novo
      // (observar de novo o mesmo elemento não repete)
      const w = celulas.current.get(id)?.querySelector('.widget')
      if (w && observador.current) observarPartes(observador.current, w)
    }
    desenhar()
  })

  // a primeira vez: os cartões aparecem já no lugar; depois as mudanças deslizam e a entrada não se repete
  useLayoutEffect(() => {
    const grade = refGrade.current
    if (!grade) return
    grade.classList.add('instantaneo')
    const a = requestAnimationFrame(() => requestAnimationFrame(() => grade.classList.remove('instantaneo')))
    const t = window.setTimeout(() => grade.classList.add('montada'), 1700)
    return () => { cancelAnimationFrame(a); window.clearTimeout(t) }
  }, [])

  // o conteúdo de um cartão mudou de altura depois do desenho (gráfico, fonte, imagem), ou a grade mudou de largura
  useEffect(() => {
    const grade = refGrade.current
    if (!grade) return
    // o trabalho roda no quadro seguinte: mexer no layout dentro do próprio callback gera o aviso
    // "ResizeObserver loop completed with undelivered notifications"
    let pendentes: ResizeObserverEntry[] = []
    let quadroRO = 0
    const ro = new ResizeObserver((entradas) => {
      pendentes.push(...entradas)
      if (quadroRO) return
      quadroRO = requestAnimationFrame(() => {
        quadroRO = 0
        const lote = pendentes
        pendentes = []
        processar(lote)
      })
    })
    const processar = (entradas: ResizeObserverEntry[]) => {
      if (!grade.isConnected) return
      let mudou = false
      for (const e of entradas) {
        if (e.target === grade) {
          const w = Math.round(e.contentRect.width)
          if (w !== largura.current) {
            largura.current = w
            mudou = true
            // a janela mudou de tamanho: os cartões acompanham na hora, sem a animação de encaixe
            grade.classList.add('instantaneo')
            requestAnimationFrame(() => requestAnimationFrame(() => grade.classList.remove('instantaneo')))
          }
          continue
        }
        const id = (e.target as HTMLElement).closest<HTMLElement>('.widget-celula')?.dataset.cartao as IdWidget | undefined
        if (!id) continue
        const antes = alturas.current.get(id)
        medir(id)
        medirPartes(id)
        if (alturas.current.get(id) !== antes) mudou = true
        // a largura mudou no arrasto e as linhas mudaram de altura: o recorte do cartão na mão se refaz na hora
        const a = arrasto.current
        if (a?.tipo === 'tamanho' && a.id === id) recortar(id, a.hAgora, a.mexeuAltura || Boolean(a.tamanhos[id]?.l))
      }
      if (mudou) desenhar()
    }
    ro.observe(grade)
    for (const el of celulas.current.values()) { const w = el.querySelector('.widget'); if (w) observarPartes(ro, w) }
    observador.current = ro
    return () => { cancelAnimationFrame(quadroRO); ro.disconnect(); observador.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- o arrasto ----------
  const quadroDoArrasto = () => {
    quadro.current = 0
    const a = arrasto.current
    const el = a && celulas.current.get(a.id)
    if (!a || !el) return
    const { x, y } = ponteiro.current
    if (a.tipo === 'tamanho') {
      // o cartão segue o mouse em px (liso); a grade se reencaixa no tamanho arredondado
      const min = minimoDe(a.id)
      const w = Math.max(larguraPx(min.c), Math.min(largura.current - a.esquerda, a.w0 + x - a.x0))
      el.style.width = `${w}px`
      // só para o lado: a altura continua a do conteúdo (esticar para o lado não pode travar a altura)
      if (!a.mexeuAltura && Math.abs(y - a.y0) > 12) { a.mexeuAltura = true; setAmpliando(a.id) }
      const c = Math.round((w + GRADE.vao) / (colunaPx() + GRADE.vao))
      let t
      if (a.mexeuAltura) {
        const h = Math.max(alturaDe(min.l), Math.min(alturaDe(GRADE.maxLinhas), a.h0 + y - a.y0))
        el.style.height = `${h}px`
        a.hAgora = h
        // as linhas que cabem acompanham o mouse, quadro a quadro (conta pura, sem medir)
        recortar(a.id, h, true)
        t = limitarTamanho(a.id, { c, l: Math.round((h + GRADE.vao) / (GRADE.linha + GRADE.vao)) })
      } else t = limitarTamanho(a.id, { c })
      const antes = a.tamanhos[a.id]
      if (antes?.c !== t.c || antes?.l !== t.l) { a.tamanhos = { ...a.tamanhos, [a.id]: t }; desenhar() }
      return
    }
    // lugar: o cartão vai junto com o mouse; quando passa por cima de outro, os dois trocam de lugar na ordem
    if (!a.andou && Math.hypot(x - a.x0, y - a.y0) < 5) return
    if (!a.andou) { a.andou = true; refVaga.current?.classList.add('visivel'); desenhar() }
    const rolou = window.scrollY - a.rolagem0
    const gx = x - a.esquerda0, gy = y - a.topo0 + rolou
    el.style.transform = `translate3d(${gx - a.dx}px, ${gy - a.dy}px, 0)`
    const debaixo = blocos.current.find((b) => b.id !== a.id && gx >= xPx(b.x) && gx < xPx(b.x) + larguraPx(b.w) && gy >= yPx(b.y) && gy < yPx(b.y) + alturaDe(b.h))
    if (!debaixo) { a.alvo = null; return }
    if (debaixo.id === a.alvo) return
    const de = a.ordem.indexOf(a.id), para = a.ordem.indexOf(debaixo.id)
    const ordem = a.ordem.filter((id) => id !== a.id)
    ordem.splice(ordem.indexOf(debaixo.id) + (de < para ? 1 : 0), 0, a.id)
    a.ordem = ordem
    a.alvo = debaixo.id
    desenhar()
  }
  const aoMover = (e: PointerEvent) => {
    ponteiro.current = { x: e.clientX, y: e.clientY }
    if (!quadro.current) quadro.current = requestAnimationFrame(quadroDoArrasto)
  }
  const aoRolar = () => { if (arrasto.current?.tipo === 'lugar' && !quadro.current) quadro.current = requestAnimationFrame(quadroDoArrasto) }
  const terminar = () => {
    const a = arrasto.current
    window.removeEventListener('pointermove', aoMover)
    window.removeEventListener('pointerup', terminar)
    window.removeEventListener('pointercancel', terminar)
    window.removeEventListener('scroll', aoRolar)
    cancelAnimationFrame(quadro.current)
    quadro.current = 0
    if (!a) return
    arrasto.current = null
    celulas.current.get(a.id)?.classList.remove('pegando', 'puxando')
    refVaga.current?.classList.remove('visivel')
    document.documentElement.classList.remove('arrastando-cartao')
    if (a.tipo === 'tamanho') {
      const t = a.tamanhos[a.id]
      setAmpliando(null)
      // a ordem de leitura do que se vê agora (de cima para baixo, da esquerda para a direita): assim, sem o cartão preso,
      // a grade se monta do mesmo jeito
      const ordem = [...blocos.current].sort((p, q) => p.y - q.y || p.x - q.x).map((b) => b.id)
      const mudouOrdem = ordem.join() !== atual.current.ids.join()
      if (t && (mudouOrdem || t.c !== atual.current.tamanhos?.[a.id]?.c || t.l !== atual.current.tamanhos?.[a.id]?.l)) {
        if (mudouOrdem) atual.current = { ...atual.current, ids: ordem }
        aoRedimensionar(a.id, t, mudouOrdem ? ordem : undefined)
      } else desenhar()
    } else if (a.ordem.join() !== atual.current.ids.join()) {
      // desenha já na ordem nova (o cartão desliza do mouse para a vaga) e guarda
      atual.current = { ...atual.current, ids: a.ordem }
      desenhar()
      aoReordenar(a.ordem)
    } else desenhar()
  }
  const comecar = (a: Arrasto, e: React.PointerEvent) => {
    arrasto.current = a
    ponteiro.current = { x: e.clientX, y: e.clientY }
    document.documentElement.classList.add('arrastando-cartao')
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', terminar)
    window.addEventListener('pointercancel', terminar)
    window.addEventListener('scroll', aoRolar, { passive: true })
  }
  useEffect(() => () => terminar(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const puxarCanto = (id: IdWidget) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const b = blocos.current.find((k) => k.id === id)
    if (!b) return
    refVaga.current?.classList.add('visivel')
    // a altura só fica travada se a pessoa mexer nela (ou se já estava escolhida)
    const fixa = atual.current.tamanhos?.[id]?.l !== undefined
    const tams = { ...atual.current.tamanhos, [id]: fixa ? { c: b.w, l: b.h } : { c: b.w } }
    comecar({ tipo: 'tamanho', id, x0: e.clientX, y0: e.clientY, w0: larguraPx(b.w), h0: alturaDe(b.h), esquerda: xPx(b.x), tamanhos: tams, x: b.x, y: b.y, hAgora: alturaDe(b.h), mexeuAltura: fixa }, e)
    desenhar()
  }
  const pegar = (id: IdWidget) => (e: React.PointerEvent) => {
    if (!arrumando || e.button !== 0 || (e.target as Element).closest('button')) return
    const b = blocos.current.find((k) => k.id === id)
    const r = refGrade.current?.getBoundingClientRect()
    if (!b || !r) return
    e.preventDefault()
    comecar({
      tipo: 'lugar', id, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left - xPx(b.x), dy: e.clientY - r.top - yPx(b.y),
      rolagem0: window.scrollY, topo0: r.top, esquerda0: r.left, ordem: [...atual.current.ids], alvo: null, andou: false,
    }, e)
  }
  /** Pelo teclado: setas mudam o tamanho (← → a largura, ↑ ↓ a altura); Delete volta ao tamanho de sempre. */
  const teclaNoCanto = (id: IdWidget) => (e: React.KeyboardEvent) => {
    const b = blocos.current.find((k) => k.id === id)
    if (!b) return
    // ← → mudam só a largura (a altura continua a do conteúdo, se era); ↑ ↓ travam a altura a partir da de agora
    const t: TamanhoNoComputador = { c: b.w, l: tamanhos?.[id]?.l }
    if (e.key === 'ArrowRight') t.c++
    else if (e.key === 'ArrowLeft') t.c--
    else if (e.key === 'ArrowDown') t.l = (t.l ?? b.h) + 2
    else if (e.key === 'ArrowUp') t.l = (t.l ?? b.h) - 2
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); aoRedimensionar(id, null); return }
    else return
    e.preventDefault()
    aoRedimensionar(id, t)
  }

  return (
    // className fixo: 'arrumando', 'instantaneo' e 'montada' são postos pelos efeitos acima (trocar o className pelo
    // React apagaria 'montada' e a entrada dos cartões se repetiria)
    <div className="widgets-pc" ref={refGrade}>
      {arrumando && <div className="vaga-do-cartao" ref={refVaga} aria-hidden="true" />}
      {ids.map((id, i) => {
        const fixo = tamanhos?.[id]?.l !== undefined || ampliando === id
        return (
          <div key={id} className="widget-celula" data-cartao={id} style={{ '--i': i } as CSSProperties}
            ref={(el) => { if (el) celulas.current.set(id, el); else celulas.current.delete(id) }} onPointerDown={pegar(id)}>
            {arrumando && barra(id)}
            {arrumando && (
              <button type="button" className="alca-tamanho" onPointerDown={puxarCanto(id)} onKeyDown={teclaNoCanto(id)}
                onDoubleClick={() => aoRedimensionar(id, null)}
                aria-label={tx('Mudar o tamanho do cartão {0}. Use as setas; Delete volta ao tamanho de sempre.', tituloDe(id))}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M14 6 6 14M14 10l-4 4" /></svg>
              </button>
            )}
            {conteudo(id, fixo)}
          </div>
        )
      })}
    </div>
  )
}
