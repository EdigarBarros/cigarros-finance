/**
 * Planejamento do mês: cada dinheiro que entra é uma barra; a pessoa arrasta (ou toca) uma conta para dentro dela e a barra
 * vai sendo fatiada. Puxar a borda de uma fatia paga mais ou menos; tocar nela abre o ajuste (tudo, metade, outro valor).
 * O que falta de uma conta volta para a bandeja, pronto para ir para outra entrada. O Consultor comenta enquanto a pessoa
 * monta (dicas com atalho) e lê o plano depois, no plano de ação.
 *
 * Toda a conta é de lib/planejamento.ts (puro e testado); aqui só se desenha e se anima. O plano fica gravado por mês
 * (`c.salvarPlanejamento`). Veja docs/arquitetura-do-painel.md, seção 4.7.1.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ME, type PointerEvent as PE, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Analise } from '../lib/analise'
import { fmtDataCurta, fmtValor } from '../lib/format'
import {
  atrasoDa, comExtras, comFeitos, custoDa, fotosDe, travada, destinoDe, dicasDe, falta, fonteDe, maximoDa, montarPraMim, mudarParte, pago, placarDe, por, quadroDoPlano,
  sobra, valerPartes,
  type Destino, type Fonte, type Parte, type Planejamentos, type QualMes, type Quadro,
} from '../lib/planejamento'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import './planejamento.css'

/** As cores das fatias: tons frios para "dinheiro com destino" (o azul do Consultor e vizinhos), verde para guardar. */
const CORES = ['#4ea3ff', '#8b7cf6', '#22c3d6', '#6a7dff', '#b47cf0', '#3fb8ff', '#5f9bd8', '#9a8cff']
const corDe = (d: Destino) => (d.tipo === 'meta' || d.tipo === 'guardar' ? 'var(--entrada)' : d.tipo === 'divida' ? '#c084fc' : CORES[d.indice % CORES.length])

const vibrar = () => { try { navigator.vibrate?.(8) } catch { /* sem vibração */ } }
const centavos = (n: number) => Math.round(n * 100) / 100

/** Um número que corre até o valor novo (sem animação, pula direto). */
function useNumeroVivo(alvo: number, ms = 520) {
  const [v, setV] = useState(alvo)
  const atual = useRef(alvo)
  const pula = semMovimento() || !Number.isFinite(alvo)
  useEffect(() => {
    if (pula) { atual.current = alvo; return }
    const de = atual.current, t0 = performance.now()
    let id = 0
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3)
      atual.current = de + (alvo - de) * e
      setV(atual.current)
      if (k < 1) id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [alvo, ms, pula])
  return pula ? alvo : v
}

function Dinheiro({ valor, className }: { valor: number; className?: string }) {
  const v = useNumeroVivo(valor)
  return <b className={className}>{fmtValor(centavos(v))}</b>
}

/** Uma moedinha que voa da conta até a barra: o olho acompanha para onde o dinheiro foi. */
function voar(de: DOMRect | null, para: DOMRect | null, cor: string) {
  if (!de || !para || semMovimento()) return
  const el = document.createElement('span')
  el.className = 'pj-moeda'
  el.style.setProperty('--b', cor)
  document.body.append(el)
  const x0 = de.left + de.width / 2, y0 = de.top + de.height / 2
  const x1 = para.left + Math.min(para.width - 20, Math.max(20, para.width * 0.18)), y1 = para.top + para.height / 2
  const meio = { x: (x0 + x1) / 2, y: Math.min(y0, y1) - 90 }
  const a = el.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${meio.x}px, ${meio.y}px) scale(1.15)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${x1}px, ${y1}px) scale(.4)`, opacity: 0.2 },
  ], { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)' })
  a.onfinish = () => el.remove()
}

interface Aviso { id: number; texto: string; tom: 'bom' | 'atencao' | 'neutro' }

interface Props {
  a: Analise
  planejamento: Planejamentos
  salvar: (p: Planejamentos) => void
  aoFechar: () => void
  aoLancarEntrada: () => void
  inicial?: QualMes
  /** A conta é uma fatura de cartão com o que pagar: a chave dela (lib/faturasAPagar.ts), ou null. */
  faturaDe?: (d: Destino) => string | null
  /** Abre o pagamento da fatura (o mesmo da tela Cartões). */
  aoPagarFatura?: (chave: string) => void
}

export function Planejamento(props: Props) {
  const [qual, setQual] = useState<QualMes>(props.inicial ?? 'este')
  const q = props.a.quadros?.[qual] ?? null
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = antes }
  }, [])
  if (!q) return null
  // trocar de mês monta a mesa de novo, com o plano daquele mês
  return createPortal(<Mesa key={q.mes} {...props} q={q} qual={qual} setQual={setQual} />, document.body)
}

function Mesa({ q: base, qual, setQual, planejamento, salvar, aoFechar, aoLancarEntrada, faturaDe, aoPagarFatura }: Props & { q: Quadro; qual: QualMes; setQual: (q: QualMes) => void }) {
  // usar o dinheiro guardado é escolha da pessoa, guardada com o plano do mês: ligado, cada lugar com dinheiro guardado
  // vira mais uma barra (só para pagar contas e dívidas)
  const [usarGuardado, setUsarGuardado] = useState(() => planejamento[base.mes]?.comGuardado === true)
  // contar com quem te deve também é escolha da pessoa: ligado, cada dinheiro previsto de "me devem" vira uma barra
  const [usarAReceber, setUsarAReceber] = useState(() => planejamento[base.mes]?.comAReceber === true)
  // o que já aconteceu desde o plano salvo (a entrada que caiu, a conta paga) continua na mesa, travado
  const doMes = planejamento[base.mes]
  const q = useMemo(() => comFeitos(comExtras(base, { guardado: usarGuardado, aReceber: usarAReceber }), doMes), [base, usarGuardado, usarAReceber, doMes])
  const [partes, setPartes] = useState<Parte[]>(() => (planejamento[base.mes] ? valerPartes(quadroDoPlano(base, planejamento[base.mes]), planejamento[base.mes].partes) : []))
  // O que mexer na mesa é rascunho: só vale (e só o Consultor lê) depois de "Salvar plano". "Descartar" volta ao salvo.
  const [salvo, setSalvo] = useState(() => ({ partes, usarGuardado, usarAReceber }))
  const mudou = usarGuardado !== salvo.usarGuardado || usarAReceber !== salvo.usarAReceber || JSON.stringify(partes) !== JSON.stringify(salvo.partes)
  /** Sair (fechar ou trocar de mês) com mudança sem salvar pergunta antes; guarda aqui o que fazer depois da resposta. */
  const [pergunta, setPergunta] = useState<{ depois: () => void } | null>(null)
  const [salvou, setSalvou] = useState(0)

  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [mira, setMira] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [puxando, setPuxando] = useState(false)
  const [ajuste, setAjuste] = useState<{ entrada: string; conta: string } | null>(null)
  const [recem, setRecem] = useState<{ chave: string; valor: number; n: number } | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [festa, setFesta] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const fantasma = useRef<HTMLDivElement>(null)

  const avisar = useCallback((texto: string, tom: Aviso['tom'] = 'neutro') => setAviso({ id: Date.now(), texto, tom }), [])
  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 3200)
    return () => window.clearTimeout(t)
  }, [aviso])

  // Salvar: na hora no aparelho, no banco logo depois (useDados). Descartar: volta ao último salvo.
  const gravar = () => {
    salvar({ ...planejamento, [q.mes]: { partes, em: new Date().toISOString(), fotos: fotosDe(q, partes), ...(usarGuardado ? { comGuardado: true } : {}), ...(usarAReceber ? { comAReceber: true } : {}) } })
    setSalvo({ partes, usarGuardado, usarAReceber })
    setSalvou((n) => n + 1)
    avisar(tx('Plano salvo. O Consultor já está usando ele.'), 'bom')
    vibrar()
  }
  const descartar = () => {
    setPartes(salvo.partes)
    setUsarGuardado(salvo.usarGuardado)
    setUsarAReceber(salvo.usarAReceber)
    setAjuste(null)
    setEscolhida(null)
    setRecem(null)
    avisar(tx('Mudanças descartadas. O plano voltou ao último salvo.'))
  }
  const sair = (depois: () => void) => (mudou ? setPergunta({ depois }) : depois())
  // recarregar ou fechar a aba com mudança sem salvar: o navegador pergunta
  useEffect(() => {
    if (!mudou) return
    const segurar = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', segurar)
    return () => window.removeEventListener('beforeunload', segurar)
  }, [mudou])

  /** Liga ou desliga o dinheiro guardado. Desligar tira do plano o que saía dele (essas contas voltam para a bandeja). */
  const trocarGuardado = (usar: boolean) => {
    setUsarGuardado(usar)
    if (usar) {
      avisar(tx('O dinheiro guardado entrou no plano. Use só o que precisar: o resto continua guardado.'))
    } else {
      const sem = partes.filter((p) => !q.guardados.some((g) => g.id === p.entrada))
      if (sem.length !== partes.length) avisar(tx('O dinheiro guardado saiu do plano. O que ele pagava voltou para a bandeja.'))
      setPartes(sem)
    }
  }

  /** Liga ou desliga o dinheiro de quem te deve. Desligar tira do plano o que saía dele (essas contas voltam para a bandeja). */
  const trocarAReceber = (usar: boolean) => {
    setUsarAReceber(usar)
    if (usar) {
      avisar(tx('O dinheiro de quem te deve entrou no plano. Conte com ele só se for cair mesmo.'))
    } else {
      const sem = partes.filter((p) => !q.aReceber.some((r) => r.id === p.entrada))
      if (sem.length !== partes.length) avisar(tx('O dinheiro de quem te deve saiu do plano. O que ele pagava voltou para a bandeja.'))
      setPartes(sem)
    }
  }

  const placar = useMemo(() => placarDe(q, partes), [q, partes])
  const dicas = useMemo(() => dicasDe(q, partes, fmtValor, fmtDataCurta), [q, partes])

  // o mês fechou agora: festa (uma vez por fechamento)
  const fechado = placar.fechado
  const antes = useRef(fechado)
  useEffect(() => {
    if (fechado && !antes.current) {
      setFesta((n) => n + 1)
      avisar(tx('Mês fechado: tudo com dinheiro e nada atrasa.'), 'bom')
      vibrar()
    }
    antes.current = fechado
  }, [fechado, avisar])

  // Esc fecha o que estiver aberto
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pergunta) setPergunta(null)
      else if (ajuste) setAjuste(null)
      else if (escolhida) setEscolhida(null)
      else if (mudou) setPergunta({ depois: aoFechar })
      else aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ajuste, escolhida, aoFechar, pergunta, mudou])
  useEffect(() => { raiz.current?.focus({ preventScroll: true }) }, [])

  // ---------- pôr uma conta numa entrada ----------
  const colocar = (conta: string, entrada: string, de?: DOMRect | null, quanto?: number) => {
    const d = destinoDe(q, conta), f = fonteDe(q, entrada)
    if (!d || !f) return
    setAviso(null)
    const r = por(q, partes, conta, entrada, quanto)
    if (r.valor <= 0) {
      if (f.feito) { avisar(tx('{0} já caiu: o dinheiro está na conta. Use O que está na conta.', f.nome), 'atencao'); return }
      avisar(sobra(partes, f) <= 0 ? tx('{0} já tem destino para tudo.', f.nome) : tx('{0} já tem dinheiro para tudo.', d.nome), 'atencao')
      return
    }
    const barra = raiz.current?.querySelector(`[data-entrada="${CSS.escape(entrada)}"] .pj-barra`)?.getBoundingClientRect() ?? null
    voar(de ?? null, barra, corDe(d))
    setPartes(r.partes)
    setRecem((x) => ({ chave: `${entrada}|${conta}`, valor: r.valor, n: (x?.n ?? 0) + 1 }))
    vibrar()
    const p = r.partes.find((x) => x.entrada === entrada && x.conta === conta)!
    const dias = atrasoDa(q, p)
    if (dias) avisar(dias === 1 ? tx('{0} cai 1 dia depois do vencimento de {1}.', f.nome, d.nome) : tx('{0} cai {1} dias depois do vencimento de {2}.', f.nome, dias, d.nome), 'atencao')
    else if (d.valor !== null && falta(r.partes, d) > 0.009) avisar(tx('Coube {0}. Faltam {1} de {2}: coloque o resto em outra entrada.', fmtValor(r.valor), fmtValor(falta(r.partes, d)), d.nome))
  }

  // ---------- arrastar da bandeja (mouse e caneta) e tocar-e-tocar (todos) ----------
  const arrasto = useRef<{ conta: string; x0: number; y0: number; andou: boolean; el: HTMLElement } | null>(null)
  const arrastou = useRef<string | null>(null)
  const colocarRef = useRef(colocar)
  const entradaEm = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-entrada]') as HTMLElement | null)?.dataset.entrada ?? null
  const descer = (e: PE<HTMLButtonElement>, conta: string) => {
    if (e.button !== 0 || e.pointerType === 'touch') return
    arrasto.current = { conta, x0: e.clientX, y0: e.clientY, andou: false, el: e.currentTarget }
  }
  useEffect(() => {
    const mover = (e: PointerEvent) => {
      const g = arrasto.current
      if (!g) return
      if (!g.andou) {
        if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return
        g.andou = true
        setArrastando(g.conta)
        setEscolhida(null)
      }
      const f = fantasma.current
      if (f) {
        const inclina = Math.max(-6, Math.min(6, (e.movementX || 0) * 0.4))
        f.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -60%) rotate(${inclina}deg)`
        f.style.opacity = '1'
      }
      setMira(entradaEm(e.clientX, e.clientY))
    }
    const soltar = (e: PointerEvent) => {
      const g = arrasto.current
      arrasto.current = null
      if (!g) return
      if (!g.andou) return // virou clique: o onClick cuida
      setArrastando(null)
      setMira(null)
      const alvo = entradaEm(e.clientX, e.clientY)
      if (alvo) colocarRef.current(g.conta, alvo, fantasma.current?.getBoundingClientRect() ?? g.el.getBoundingClientRect())
      arrastou.current = g.conta
    }
    const cancelar = () => { arrasto.current = null; setArrastando(null); setMira(null) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelar)
    return () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('pointercancel', cancelar) }
  }, [])
  useLayoutEffect(() => { colocarRef.current = colocar })

  const tocarFicha = (e: ME<HTMLButtonElement>, conta: string) => {
    if (arrastou.current === conta) { arrastou.current = null; return }
    void e
    const nova = escolhida === conta ? null : conta
    setEscolhida(nova)
    if (nova) avisar(tx('Agora toque na entrada que vai pagar {0}.', destinoDe(q, nova)!.nome))
  }
  const tocarEntrada = (f: Fonte, el: HTMLElement) => {
    if (!escolhida) return
    const conta = escolhida
    setEscolhida(null)
    colocar(conta, f.id, document.querySelector(`[data-conta="${CSS.escape(conta)}"]`)?.getBoundingClientRect() ?? el.getBoundingClientRect())
  }

  // ---------- puxar a borda de uma fatia ----------
  const puxar = (e: PE<HTMLSpanElement>, p: Parte, f: Fonte) => {
    e.preventDefault(); e.stopPropagation()
    if (travada(q, p)) return
    const barra = (e.currentTarget.closest('.pj-barra') as HTMLElement).getBoundingClientRect()
    const x0 = e.clientX, v0 = p.valor, porPx = f.valor / barra.width
    const max = maximoDa(q, partes, p)
    const base = partes
    setPuxando(true)
    const alvo = e.currentTarget
    alvo.setPointerCapture(e.pointerId)
    let ultimo = v0
    const mover = (ev: PointerEvent) => {
      let v = v0 + (ev.clientX - x0) * porPx
      v = v >= max - 5 ? max : Math.max(10, Math.round(v / 10) * 10)
      v = Math.min(v, max)
      if (v === ultimo) return
      ultimo = v
      setPartes(mudarParte(q, base, p.entrada, p.conta, v))
    }
    const fim = () => {
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', fim)
      alvo.removeEventListener('pointercancel', fim)
      setPuxando(false)
      if (ultimo !== v0) vibrar()
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', fim)
    alvo.addEventListener('pointercancel', fim)
  }

  const montar = () => {
    const novo = montarPraMim(q, partes)
    setPartes(novo)
    setEscolhida(null)
    setRecem(null)
    if (!placarDe(q, novo).fechado) avisar(tx('Plano montado. Toque numa fatia ou puxe a borda dela para ajustar.'))
  }
  const recomecar = () => { setPartes(partes.filter((p) => travada(q, p) || fonteDe(q, p.entrada)?.feito)); setEscolhida(null); setAjuste(null); avisar(tx('Plano limpo. As contas voltaram para a bandeja.')) }

  const bandeja = q.destinos
    .filter((d) => falta(partes, d) > 0.009)
    .sort((x, y) => Number(y.atrasada) - Number(x.atrasada) || (x.tipo === 'conta' ? 0 : 1) - (y.tipo === 'conta' ? 0 : 1) || (x.vence ?? '9').localeCompare(y.vence ?? '9'))
  const faltaTotal = centavos(bandeja.filter((d) => d.tipo === 'conta').reduce((s, d) => s + falta(partes, d), 0))
  const dEscolhida = escolhida ? destinoDe(q, escolhida) : null
  const emJogo = arrastando ?? escolhida
  const dEmJogo = (emJogo ? destinoDe(q, emJogo) : null) ?? null
  const toque = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const nomeDoMes = qual === 'este' ? tx('este mês') : tx('o mês que vem')

  return (
    <div className={`pj ${semMovimento() ? 'parado' : ''} ${emJogo ? 'em-jogo' : ''} ${puxando ? 'puxando' : ''}`} ref={raiz} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tx('Planejar o mês')}>
      <div className="pj-palco">
        <header className="pj-cab">
          <button className="pj-fechar" onClick={() => sair(aoFechar)} aria-label={tx('Fechar')}><Icone nome="fechar" tamanho={18} /></button>
          <div className="pj-titulo">
            <h2>{tx('Planejar o mês')}</h2>
            <p>{tx('Divida cada dinheiro que entra entre as contas.')}</p>
          </div>
          <div className="pj-meses" role="tablist" style={{ '--i': qual === 'este' ? 0 : 1 } as CSSProperties}>
            <i aria-hidden="true" />
            <button role="tab" aria-selected={qual === 'este'} onClick={() => qual !== 'este' && sair(() => setQual('este'))}>{tx('Este mês')}</button>
            <button role="tab" aria-selected={qual === 'proximo'} onClick={() => qual !== 'proximo' && sair(() => setQual('proximo'))}>{tx('Mês que vem')}</button>
          </div>
          <div className={`pj-salvar ${mudou ? 'mudou' : ''}`} aria-live="polite">
            {mudou ? (
              <>
                <button className="btn pj-descartar" onClick={descartar}><Icone nome="desfazer" tamanho={15} /> {tx('Descartar')}</button>
                <button className="btn primario pj-gravar" onClick={gravar}><i aria-hidden="true" /> {tx('Salvar plano')}</button>
              </>
            ) : (
              <span key={salvou} className={`pj-salvo ${salvou ? 'agora' : ''}`}><Icone nome="check" tamanho={14} /> {tx('Plano salvo')}</span>
            )}
          </div>
        </header>

        <Placar placar={placar} festa={festa} temContas={q.destinos.some((d) => d.tipo === 'conta')}
          acoes={q.fontes.length > 0 && (
            <div className="pj-botoes">
              <button className="btn primario pj-montar" onClick={montar}><Icone nome="estrela" tamanho={16} /> {tx('Montar pra mim')}</button>
              <button className="btn pj-limpar" onClick={recomecar} disabled={!partes.length}><Icone nome="desfazer" tamanho={15} /> {tx('Recomeçar')}</button>
            </div>
          )} />

        {!q.fontes.length && !q.guardados.length && !q.aReceber.length ? (
          <section className="pj-vazio">
            <span className="pj-vazio-ic"><Icone nome="receber" tamanho={28} /></span>
            <h3>{tx('Nenhum dinheiro previsto para {0}', nomeDoMes)}</h3>
            <p>{tx('O plano usa as entradas que ainda vão cair (lançadas para depois ou que se repetem todo mês) e o saldo dos bancos. Lance a próxima entrada e ela aparece aqui.')}</p>
            <button className="btn primario" onClick={aoLancarEntrada}><Icone nome="mais" tamanho={16} /> {tx('Lançar uma entrada')}</button>
          </section>
        ) : (
          <div className="pj-mesa">
            <section className="pj-entradas" aria-label={tx('O dinheiro que entra')}>
              <p className="pj-instrucao">
                {dEscolhida ? tx('Toque na entrada que vai pagar {0}.', dEscolhida.nome)
                  : toque ? tx('Toque numa conta lá embaixo e depois no dinheiro que vai pagá-la. Toque numa fatia para pagar só uma parte.')
                    : tx('Arraste uma conta para dentro de um dinheiro (ou toque na conta e depois nele). Puxe a borda de uma fatia para pagar só uma parte.')}
              </p>
              {/* o dinheiro do mês; o interruptor de quem te deve e, ligado, as barras dele; o mesmo com o guardado */}
              {[...q.fontes.filter((f) => !f.guardado && !f.aReceber), 'aReceber' as const, ...q.fontes.filter((f) => f.aReceber), 'guardado' as const, ...q.fontes.filter((f) => f.guardado)].map((f, i) => (
                f === 'aReceber' ? q.aReceber.length > 0 && (
                  <Interruptor key="aReceber" icone="receber" ligado={usarAReceber} aoTrocar={trocarAReceber} titulo={tx('Contar com quem me deve')}
                    texto={usarAReceber && placar.doAReceber > 0.009
                      ? tx('O plano conta com {0} dos {1} que te devem.', fmtValor(placar.doAReceber), fmtValor(q.aReceber.reduce((s, x) => s + x.valor, 0)))
                      : q.aReceber.length === 1
                        ? tx('{0} que {1} te deve, para contar neste mês.', fmtValor(q.aReceber[0].valor), q.aReceber[0].quem ?? q.aReceber[0].nome)
                        : tx('{0} que {1} pessoas te devem, para contar neste mês.', fmtValor(q.aReceber.reduce((s, x) => s + x.valor, 0)), new Set(q.aReceber.map((x) => x.quem)).size)} />
                ) : f === 'guardado' ? q.guardados.length > 0 && (
                  <Interruptor key="guardado" icone="cofre" ligado={usarGuardado} aoTrocar={trocarGuardado} titulo={tx('Usar o dinheiro guardado')}
                    texto={usarGuardado && placar.doGuardado > 0.009
                      ? tx('O plano tira {0} dos {1} guardados.', fmtValor(placar.doGuardado), fmtValor(q.guardados.reduce((s, x) => s + x.valor, 0)))
                      : tx('{0} em caixinhas, reservas e investimentos, para pagar contas e adiantar dívidas.', fmtValor(q.guardados.reduce((s, x) => s + x.valor, 0)))} />
                ) : (
                  <BarraDaEntrada key={f.id} q={q} f={f} i={i} partes={partes} emJogo={dEmJogo} mira={mira === f.id} recem={recem}
                    aoTocar={tocarEntrada} aoAjustar={(p) => {
                      // a fatia travada (conta já paga) não muda: tocar nela diz qual conta é
                      if (!travada(q, p)) { setAjuste({ entrada: p.entrada, conta: p.conta }); return }
                      const d = destinoDe(q, p.conta)
                      if (d) avisar(tx('{0}: {1}, já paga. Fica travada no plano.', d.nome, fmtValor(p.valor)), 'bom')
                    }} aoPuxar={puxar} />
                )))}
            </section>

            <aside className="pj-consultor">
              <Dicas dicas={dicas} aoUsarGuardado={() => trocarGuardado(true)} aoUsarAReceber={() => trocarAReceber(true)}
                aoFazer={(conta, entrada) => colocar(conta, entrada, document.querySelector(`[data-conta="${CSS.escape(conta)}"]`)?.getBoundingClientRect())} />
            </aside>

            <aside className="pj-lado">
              <section className={`pj-bandeja ${emJogo ? 'ativa' : ''}`} aria-label={tx('Sem dinheiro ainda')}>
                <header>
                  <h3>{tx('Sem dinheiro ainda')}</h3>
                  {faltaTotal > 0 && <span className="pj-bandeja-total">{tx('faltam {0}', fmtValor(faltaTotal))}</span>}
                </header>
                <div className="pj-fichas">
                  {bandeja.filter((d) => d.tipo === 'conta').length === 0 && q.destinos.some((d) => d.tipo === 'conta') && (
                    <p className="pj-tudo"><Icone nome="check" tamanho={16} /> {tx('Todas as contas têm dinheiro.')}</p>
                  )}
                  {bandeja.map((d) => (
                    <Ficha key={d.id} d={d} partes={partes} escolhida={escolhida === d.id} arrastando={arrastando === d.id}
                      aoDescer={(e) => descer(e, d.id)} aoTocar={(e) => tocarFicha(e, d.id)} />
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>

      {arrastando && dEmJogo && (
        <div className="pj-fantasma" ref={fantasma} style={{ '--b': corDe(dEmJogo) } as CSSProperties} aria-hidden="true">
          <i /><b>{dEmJogo.nome}</b>{dEmJogo.valor !== null && <small>{fmtValor(falta(partes, dEmJogo))}</small>}
        </div>
      )}
      {ajuste && <Ajuste q={q} partes={partes} entrada={ajuste.entrada} conta={ajuste.conta}
        aoMudar={(v) => setPartes((ps) => mudarParte(q, ps, ajuste.entrada, ajuste.conta, v))}
        aoFechar={() => setAjuste(null)}
        aoPagarFatura={(() => {
          const d = destinoDe(q, ajuste.conta)
          const chave = d && aoPagarFatura ? faturaDe?.(d) ?? null : null
          // sair com o plano sem salvar pergunta antes, como fechar a mesa
          return chave ? () => { setAjuste(null); sair(() => aoPagarFatura!(chave)) } : undefined
        })()} />}
      {aviso && <div key={aviso.id} className={`pj-aviso ${aviso.tom}`} role="status">{aviso.texto}</div>}
      {pergunta && (
        <>
          <div className="pj-ajuste-fundo" onClick={() => setPergunta(null)} />
          <div className="pj-pergunta" role="alertdialog" aria-modal="true" aria-labelledby="pj-pergunta-titulo">
            <span className="pj-pergunta-ic"><Icone nome="lapis" tamanho={22} /></span>
            <h3 id="pj-pergunta-titulo">{tx('Salvar as mudanças do plano?')}</h3>
            <p>{tx('Você mexeu no plano e ainda não salvou. Sem salvar, o Consultor continua usando o plano de antes.')}</p>
            <span className="pj-pergunta-botoes">
              <button className="btn" onClick={() => setPergunta(null)}>{tx('Continuar mexendo')}</button>
              <button className="btn pj-descartar" onClick={() => { const d = pergunta.depois; setPergunta(null); d() }}>{tx('Sair sem salvar')}</button>
              <button className="btn primario" onClick={() => { const d = pergunta.depois; gravar(); setPergunta(null); d() }}>{tx('Salvar e sair')}</button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- o placar: o anel das contas e três números ----------

function Placar({ placar, festa, temContas, acoes }: { placar: NonNullable<ReturnType<typeof placarDe>>; festa: number; temContas: boolean; acoes: ReactNode }) {
  const pct = useNumeroVivo(placar.pct, 700)
  const R = 34, C = 2 * Math.PI * R
  return (
    <section className={`pj-placar ${placar.fechado ? 'fechado' : ''}`}>
      <div className="pj-anel" aria-label={tx('{0}% das contas com dinheiro', placar.pct)}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r={R} className="trilho" />
          <circle cx="40" cy="40" r={R} className="cheio" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - placar.pct / 100) }} />
        </svg>
        <span className="pj-anel-miolo">
          {placar.fechado ? <span className="pj-anel-ok"><Icone nome="check" tamanho={26} /></span> : <b>{Math.round(pct)}<small>%</small></b>}
        </span>
        {festa > 0 && <span key={festa} className="pj-festa" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--a': `${i * 22.5}deg`, '--d': `${(i % 4) * 40}ms` } as CSSProperties} />)}</span>}
      </div>
      <div className="pj-placar-texto">
        <strong>{!temContas ? tx('Nenhuma conta vence nesse mês') : placar.fechado ? tx('Mês fechado') : tx('Contas com dinheiro')}</strong>
        {temContas && <span>{tx('{0} de {1}', fmtValor(placar.coberto), fmtValor(placar.total))}</span>}
      </div>
      <dl className="pj-numeros">
        <div className={placar.semDestino > 0.009 ? 'livre' : ''}><dt>{tx('Sem destino')}</dt><dd><Dinheiro valor={placar.semDestino} /></dd></div>
        <div className={placar.atrasos ? 'atencao' : ''}><dt>{tx('Atrasam')}</dt><dd><b>{placar.atrasos}</b></dd></div>
        <div className={placar.custo > 0.009 ? 'atencao' : ''}><dt>{tx('Multa e juros')}</dt><dd><Dinheiro valor={placar.custo} /></dd></div>
      </dl>
      {acoes}
    </section>
  )
}

// ---------- uma entrada: a barra fatiada ----------

function BarraDaEntrada({ q, f, i, partes, emJogo, mira, recem, aoTocar, aoAjustar, aoPuxar }: {
  q: Quadro; f: Fonte; i: number; partes: Parte[]; emJogo: Destino | null; mira: boolean
  recem: { chave: string; valor: number; n: number } | null
  aoTocar: (f: Fonte, el: HTMLElement) => void; aoAjustar: (p: Parte) => void; aoPuxar: (e: PE<HTMLSpanElement>, p: Parte, f: Fonte) => void
}) {
  const minhas = partes.filter((p) => p.entrada === f.id)
  const livre = sobra(partes, f)
  const cabe = emJogo && !f.feito && !(f.guardado && (emJogo.tipo === 'meta' || emJogo.tipo === 'guardar')) ? Math.min(livre, falta(partes, emJogo)) : 0
  const cheia = livre <= 0.009
  const atrasaria = emJogo && emJogo.vence && !emJogo.atrasada && f.data > emJogo.vence
  return (
    <article className={`pj-entrada ${f.guardado ? 'guardado' : ''}  ${f.aReceber ? 'a-receber' : ''} ${f.feito ? 'caiu' : ''} ${cheia ? 'cheia' : ''} ${emJogo ? (cabe > 0 ? 'alvo' : 'sem-espaco') : ''} ${mira ? 'mira' : ''}`}
      data-entrada={f.id} style={{ '--i': i } as CSSProperties}
      onClick={(e) => emJogo && aoTocar(f, e.currentTarget)}
      onKeyDown={(e) => { if (emJogo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoTocar(f, e.currentTarget) } }}
      tabIndex={emJogo ? 0 : undefined} role={emJogo ? 'button' : undefined}
      aria-label={emJogo ? tx('Pagar {0} com {1}', emJogo.nome, f.nome) : undefined}>
      <div className="pj-entrada-topo">
        <span className="pj-entrada-ic"><Icone nome={f.feito ? 'check' : f.guardado ? 'cofre' : f.saldo ? 'banco' : 'receber'} tamanho={17} /></span>
        <span className="pj-entrada-nome">
          <b>{f.nome}</b>
          <small>{f.feito ? tx('já caiu') : f.guardado ? tx('dinheiro guardado: só para contas e dívidas')
            : f.aReceber ? (f.semDia ? tx('sem dia combinado: contei no fim do mês') : tx('ficou de pagar {0}', fmtDataCurta(f.data)))
              : f.saldo ? tx('já está disponível') : tx('cai {0}', fmtDataCurta(f.data))}</small>
        </span>
        <span className="pj-entrada-valor">
          {cheia && <span className="pj-cheia"><Icone nome="check" tamanho={14} /> {tx('tudo com destino')}</span>}
          {fmtValor(f.valor)}
        </span>
      </div>
      <div className="pj-barra" role="group" aria-label={tx('Para onde vai {0}', f.nome)}>
        {minhas.map((p) => {
          const d = destinoDe(q, p.conta)!
          const dias = atrasoDa(q, p)
          const parte = p.valor / f.valor
          const nova = recem && recem.chave === `${p.entrada}|${p.conta}`
          const paga = Boolean(d.feito)
          return (
            <button key={p.conta} className={`pj-fatia ${parte < 0.09 ? 'estreita' : ''} ${dias ? 'atrasa' : ''} ${nova ? 'nova' : ''} ${paga ? 'paga' : ''}`}
              style={{ '--b': corDe(d), flexBasis: `${parte * 100}%` } as CSSProperties}
              onClick={(e) => { e.stopPropagation(); if (!emJogo) aoAjustar(p) }}
              title={paga ? tx('{0}: {1}, já paga', d.nome, fmtValor(p.valor)) : `${d.nome}: ${fmtValor(p.valor)}${dias ? ` (${dias === 1 ? tx('atrasa 1 dia') : tx('atrasa {0} dias', dias)})` : ''}`}
              aria-label={paga ? tx('{0}, {1}, já paga.', d.nome, fmtValor(p.valor)) : tx('{0}, {1}. Toque para mudar.', d.nome, fmtValor(p.valor))}
              aria-disabled={paga || undefined}>
              {paga ? <span className="pj-relogio"><Icone nome="check" tamanho={13} /></span> : dias > 0 && <span className="pj-relogio"><Icone nome="relogio" tamanho={13} /></span>}
              <b>{d.nome}</b>
              <small>{paga ? tx('paga · {0}', fmtValor(p.valor)) : fmtValor(p.valor)}</small>
              {nova && <span key={recem!.n} className="pj-mais" aria-hidden="true">+{fmtValor(recem!.valor)}</span>}
              {!paga && <span className="pj-puxador" onPointerDown={(e) => aoPuxar(e, p, f)} onClick={(e) => e.stopPropagation()} aria-hidden="true"><i /></span>}
            </button>
          )
        })}
        <span className="pj-sobra">
          {emJogo && cabe > 0
            ? <span className={`pj-cabe ${atrasaria ? 'atrasa' : ''}`}>{atrasaria ? <Icone nome="relogio" tamanho={13} /> : <Icone nome="mais" tamanho={13} />} {tx('cabem {0}', fmtValor(cabe))}</span>
            : <span>{f.feito ? (livre > 0.009 ? tx('o resto ({0}) já está na conta', fmtValor(livre)) : '') : f.guardado ? (minhas.length ? tx('continuam guardados {0}', fmtValor(livre)) : tx('Use só se precisar'))
              : f.aReceber && !minhas.length ? tx('Conte só se for cair mesmo') : minhas.length ? tx('sobram {0}', fmtValor(livre)) : tx('Coloque uma conta aqui')}</span>}
        </span>
      </div>
    </article>
  )
}

// ---------- uma conta na bandeja ----------

function Ficha({ d, partes, escolhida, arrastando, aoDescer, aoTocar }: {
  d: Destino; partes: Parte[]; escolhida: boolean; arrastando: boolean
  aoDescer: (e: PE<HTMLButtonElement>) => void; aoTocar: (e: ME<HTMLButtonElement>) => void
}) {
  const ja = pago(partes, d)
  const f = falta(partes, d)
  const parcial = d.valor !== null && ja > 0
  const quando = d.tipo === 'meta' || d.tipo === 'guardar' ? tx('guardar o que sobrar')
    : d.tipo === 'divida' ? tx('adiantar a dívida')
      : d.juntas ? tx('{0} parcelas atrasadas, desde {1}', d.juntas.parcelas, fmtDataCurta(d.vence))
        : d.atrasada ? tx('venceu {0}', fmtDataCurta(d.vence)) : tx('vence {0}', fmtDataCurta(d.vence))
  const caro = d.tipo === 'divida' || (!d.estimada && (d.juros ?? 0) >= 5)
  return (
    <button className={`pj-ficha ${escolhida ? 'escolhida' : ''} ${arrastando ? 'saiu' : ''} ${d.tipo}`} data-conta={d.id}
      style={{ '--b': corDe(d), '--p': d.valor ? ja / d.valor : 0 } as CSSProperties}
      onPointerDown={aoDescer} onClick={aoTocar} aria-pressed={escolhida}>
      <i className="pj-ficha-cor" />
      <span className="pj-ficha-texto">
        <b>{d.nome}</b>
        <small>
          {d.valor !== null && <span className="pj-ficha-valor">{parcial ? tx('faltam {0} de {1}', fmtValor(f), fmtValor(d.valor)) : fmtValor(d.valor)}</span>}
          <span>{quando}</span>
        </small>
      </span>
      <span className="pj-selos">
        {d.atrasada && <em className="ruim">{tx('atrasada')}</em>}
        {caro && d.juros !== null && <em className="juros">{tx('{0}% ao mês', String(Math.round(d.juros * 10) / 10).replace('.', ','))}</em>}
      </span>
      {parcial && <span className="pj-ficha-barra" aria-hidden="true"><i /></span>}
    </button>
  )
}

// ---------- o Consultor comentando ----------

/** O interruptor embaixo das entradas: usar o dinheiro guardado, contar com quem te deve. */
function Interruptor({ icone, titulo, texto, ligado, aoTrocar }: { icone: string; titulo: string; texto: string; ligado: boolean; aoTrocar: (usar: boolean) => void }) {
  return (
    <label className={`pj-guardado ${icone === 'receber' ? 'a-receber' : ''} ${ligado ? 'ligado' : ''}`}>
      <span className="pj-guardado-ic"><Icone nome={icone} tamanho={18} /></span>
      <span className="pj-guardado-texto">
        <b>{titulo}</b>
        <small>{texto}</small>
      </span>
      <input type="checkbox" role="switch" checked={ligado} onChange={(e) => aoTrocar(e.target.checked)} />
      <i className="pj-guardado-chave" aria-hidden="true" />
    </label>
  )
}

function Dicas({ dicas, aoFazer, aoUsarGuardado, aoUsarAReceber }: {
  dicas: ReturnType<typeof dicasDe>; aoFazer: (conta: string, entrada: string) => void; aoUsarGuardado: () => void; aoUsarAReceber: () => void
}) {
  if (!dicas.length) return null
  return (
    <section className="pj-dicas" aria-live="polite">
      <header className="pj-dicas-cab">
        <span className="pj-dicas-avatar" aria-hidden="true"><Icone nome="bussola" tamanho={18} /></span>
        <span><h3>{tx('O Consultor diz')}</h3><small>{tx('Comenta enquanto você monta')}</small></span>
      </header>
      <ul>
        {dicas.map((d) => (
          <li key={d.id} className={d.tom}>
            <span className="pj-dica-ic"><Icone nome={d.icone} tamanho={15} /></span>
            <span className="pj-dica-texto">
              {d.texto}
              {d.acao && (
                <button className="pj-dica-acao" onClick={() => { const a = d.acao!; if ('usarGuardado' in a) aoUsarGuardado(); else if ('usarAReceber' in a) aoUsarAReceber(); else aoFazer(a.conta, a.entrada) }}>
                  {d.acao.rotulo} <Icone nome="seta" tamanho={13} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- ajustar uma fatia: tudo, metade, outro valor, tirar ----------

function Ajuste({ q, partes, entrada, conta, aoMudar, aoFechar, aoPagarFatura }: {
  q: Quadro; partes: Parte[]; entrada: string; conta: string; aoMudar: (v: number) => void; aoFechar: () => void
  /** Só para fatura de cartão: registrar o pagamento dela (a mesa volta depois, com a fatia travada como paga). */
  aoPagarFatura?: () => void
}) {
  const p = partes.find((x) => x.entrada === entrada && x.conta === conta)
  const f = fonteDe(q, entrada)!, d = destinoDe(q, conta)!
  const [max] = useState(() => (p ? maximoDa(q, partes, p) : 0))
  const [texto, setTexto] = useState(() => (p ? p.valor.toFixed(2).replace('.', ',') : ''))
  const caixa = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    const barra = document.querySelector(`[data-entrada="${CSS.escape(entrada)}"] .pj-barra`)?.getBoundingClientRect()
    const el = caixa.current
    if (!barra || !el || window.innerWidth < 761) return
    const w = el.offsetWidth, h = el.offsetHeight
    setPos({
      left: Math.max(16, Math.min(window.innerWidth - w - 16, barra.left + barra.width / 2 - w / 2)),
      top: barra.bottom + 10 + h > window.innerHeight - 16 ? Math.max(16, barra.top - h - 10) : barra.bottom + 10,
    })
  }, [entrada])
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('input[type=range]')?.focus() }, [])
  const valor = p?.valor ?? 0
  const mudar = (v: number, doCampo = false) => {
    const certo = centavos(Math.max(0, Math.min(max, v)))
    aoMudar(certo)
    if (!doCampo) setTexto(certo.toFixed(2).replace('.', ','))
  }
  const dias = p ? atrasoDa(q, p) : 0
  const custo = p ? custoDa(q, p) : 0
  const faltaDepois = d.valor === null ? 0 : falta(partes, d)
  const chips: { rotulo: string; v: number }[] = [{ rotulo: tx('Tudo que cabe'), v: max }, { rotulo: tx('Metade'), v: centavos(max / 2) }]
  if (d.valor !== null && d.valor / 2 < max - 1 && Math.abs(d.valor / 2 - max / 2) > 1) chips.push({ rotulo: tx('Metade da conta'), v: centavos(d.valor / 2) })
  const pct = max ? valor / max : 0
  return (
    <>
      <div className="pj-ajuste-fundo" onClick={aoFechar} />
      <div className="pj-ajuste" ref={caixa} style={{ ...pos, '--b': corDe(d), '--p': pct } as CSSProperties} role="dialog" aria-label={tx('{0} com {1}', d.nome, f.nome)}>
        <span className="pj-ajuste-titulo"><i />{d.nome}<Icone nome="seta" tamanho={13} /><small>{f.nome}</small></span>
        <span className="pj-ajuste-valor"><Dinheiro valor={valor} /> <small>{tx('de até {0}', fmtValor(max))}</small></span>
        <input type="range" min={0} max={max} step={0.01} value={valor} onChange={(e) => mudar(Number(e.target.value))} aria-label={tx('Quanto pagar')} />
        <span className="pj-ajuste-chips">
          {chips.map((c) => <button key={c.rotulo} className={Math.abs(c.v - valor) < 0.01 ? 'on' : ''} onClick={() => mudar(c.v)}>{c.rotulo}</button>)}
        </span>
        <label className="pj-ajuste-campo">
          <span>{tx('Outro valor')}</span>
          <input inputMode="decimal" value={texto} onChange={(e) => {
            setTexto(e.target.value)
            const v = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'))
            if (!Number.isNaN(v)) mudar(v, true)
          }} />
        </label>
        <p className={`pj-ajuste-nota ${dias ? 'atrasa' : ''}`}>
          {dias ? tx('{0} cai {1} e {2} vence {3}: atrasa {4} e custa uns {5}.', f.nome, fmtDataCurta(f.data), d.nome, fmtDataCurta(d.vence), dias === 1 ? tx('1 dia') : tx('{0} dias', dias), fmtValor(custo))
            : d.valor === null ? tx('Vai para {0} quando {1} cair.', d.nome, f.nome)
              : faltaDepois > 0.009 ? tx('Ficam {0} para pagar com outra entrada.', fmtValor(faltaDepois))
                : tx('Com isso, a conta fica toda paga.')}
        </p>
        {aoPagarFatura && (
          <button className="btn pj-pagar-fatura" onClick={aoPagarFatura}><Icone nome="cartao" tamanho={15} /> {tx('Já paguei: registrar o pagamento da fatura')}</button>
        )}
        <span className="pj-ajuste-botoes">
          <button className="btn pj-tirar" onClick={() => { aoMudar(0); aoFechar() }}><Icone nome="lixeira" tamanho={15} /> {tx('Tirar daqui')}</button>
          <button className="btn primario" onClick={aoFechar}>{tx('Pronto')}</button>
        </span>
      </div>
    </>
  )
}

// ---------- o cartão no Consultor que abre o jogo ----------

export function CartaoDoPlanejamento({ a, planejamento, aoAbrir }: { a: Analise; planejamento: Planejamentos; aoAbrir: () => void }) {
  const bruto = a.quadros?.este
  const q = useMemo(() => (bruto ? quadroDoPlano(bruto, planejamento[bruto.mes]) : null), [bruto, planejamento])
  const partes = useMemo(() => (q && planejamento[q.mes] ? valerPartes(q, planejamento[q.mes].partes) : []), [q, planejamento])
  if (!q || (!q.fontes.length && !q.destinos.some((d) => d.tipo === 'conta'))) return null
  const pl = placarDe(q, partes)
  const comecou = partes.length > 0
  // o próximo passo que a própria pessoa decidiu (o Consultor segue o plano dela: lib/analise.ts, planoDoMes)
  const px = comecou ? a.planoDoMes?.proximo ?? null : null
  const hoje = q.hoje
  const nomes = px ? px.pagar.slice(0, 3).map((x) => x.nome).join(', ') + (px.pagar.length > 3 ? ` +${px.pagar.length - 3}` : '') : ''
  return (
    <section className={`cartao pj-cartao destaque ${pl.fechado ? 'fechado' : ''} ${comecou ? 'comecou' : 'convite'}`}>
      <div className="pj-cartao-texto">
        <span className="pj-cartao-ic"><Icone nome="calendario" tamanho={22} /></span>
        <div>
          <span className="pj-cartao-selo">{comecou ? tx('Seu plano do mês') : tx('Comece por aqui')}</span>
          <h3>{comecou ? (pl.fechado ? tx('Mês fechado no plano') : tx('Seu plano de pagamentos')) : tx('Planejar o mês')}</h3>
          <p>
            {!q.fontes.length ? tx('Lance o próximo dinheiro que entra para dividir entre as contas.')
              : !comecou ? (q.fontes.length === 1 ? tx('1 entrada e {0} para dividir. Diga com qual dinheiro sai cada uma.', q.destinos.filter((d) => d.tipo === 'conta').length === 1 ? tx('1 conta') : tx('{0} contas', q.destinos.filter((d) => d.tipo === 'conta').length))
                : tx('{0} entradas e {1} para dividir. Diga com qual dinheiro sai cada uma.', q.fontes.length, q.destinos.filter((d) => d.tipo === 'conta').length === 1 ? tx('1 conta') : tx('{0} contas', q.destinos.filter((d) => d.tipo === 'conta').length)))
                : pl.fechado ? tx('Tudo com dinheiro e nada atrasa.')
                  : pl.atrasos ? (pl.atrasos === 1 ? tx('{0}% das contas com dinheiro. 1 atrasa no plano.', pl.pct) : tx('{0}% das contas com dinheiro. {1} atrasam no plano.', pl.pct, pl.atrasos))
                    : tx('{0}% das contas com dinheiro.', pl.pct)}
          </p>
          {px && (
            <p className="pj-cartao-proximo">
              <Icone nome="seta" tamanho={14} />
              <span>{px.fonte.saldo ? tx('Agora, com o que está na conta: {0} ({1}).', nomes, fmtValor(px.total))
                : px.fonte.data <= hoje ? tx('Hoje, com {0}: {1} ({2}).', px.fonte.nome, nomes, fmtValor(px.total))
                  : tx('Quando {0} cair ({1}): {2} ({3}).', px.fonte.nome, fmtDataCurta(px.fonte.data), nomes, fmtValor(px.total))}</span>
            </p>
          )}
          {!comecou && <p className="pj-cartao-porque">{tx('O consultor passa a seguir o que você decidir aqui.')}</p>}
        </div>
      </div>
      {q.fontes.length > 0 && (
        <div className="pj-cartao-barras" aria-hidden="true">
          {q.fontes.slice(0, 4).map((f) => (
            <span key={f.id} style={{ flexGrow: f.valor }}>
              {partes.filter((p) => p.entrada === f.id).map((p) => {
                const d = destinoDe(q, p.conta)
                return d ? <i key={p.conta} style={{ width: `${(p.valor / f.valor) * 100}%`, background: corDe(d) }} /> : null
              })}
            </span>
          ))}
        </div>
      )}
      <button className="btn primario" onClick={aoAbrir}>
        <Icone nome={comecou ? 'lapis' : 'estrela'} tamanho={16} /> {comecou ? tx('Continuar o plano') : tx('Planejar o mês')}
      </button>
    </section>
  )
}
