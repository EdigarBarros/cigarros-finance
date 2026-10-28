import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MODULOS, type Visao } from '../lib/perfil'
import type { Modulo, Perfil } from '../lib/types'
import { Icone } from './Icone'

interface Passo {
  id: string
  icone: string
  titulo: string
  texto: string
  /** Seletor do que ganha o destaque (data-tour). Sem alvo, o cartão fica no meio da tela. */
  alvo?: string
  /** Se o alvo não está na tela (no celular, só 4 abas cabem na barra), destaca este outro e avisa na nota. */
  alternativo?: { alvo: string; nota: string }
  corpo?: React.ReactNode
}

const TEXTO_MODULO: Record<string, { titulo: string; texto: string }> = {
  contas: { titulo: 'Contas do mês', texto: 'Cadastre aluguel, luz e internet uma vez só. O app lembra o vencimento e, com um toque em “Paguei”, lança o gasto por você.' },
  cartoes: { titulo: 'Cartões', texto: 'Diga o dia em que cada fatura fecha e vence. As compras parceladas caem na fatura certa e você vê quanto do limite ainda sobra.' },
  dividas: { titulo: 'Dívidas', texto: 'Empréstimos e parcelamentos: quanto falta, o que já venceu e quando você fica livre. Também dá para registrar quem te deve.' },
  metas: { titulo: 'Metas', texto: 'Crie objetivos, como viagem ou reserva de emergência. O app mostra quanto guardar por mês para chegar lá.' },
  patrimonio: { titulo: 'Dinheiro guardado', texto: 'Quanto você tem em cada banco, nos investimentos e em outras moedas, tudo somado num lugar só.' },
}

/** O primeiro elemento com esse data-tour que está de fato visível (o menu lateral e a barra de abas existem os dois, um fica escondido). */
function acharAlvo(seletor: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${seletor}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

/** Largura do cartão do tutorial (px). */
const LARGURA = 360
const entre = (n: number, a: number, b: number) => Math.min(Math.max(n, a), Math.max(a, b))

/**
 * Passeio guiado: escurece a tela e destaca, um por vez, o que a pessoa precisa conhecer. Os passos seguem as respostas
 * das perguntas iniciais (só aparecem as abas que ela ligou) e há um passo para ligar abas que ela não tinha escolhido.
 * Pode ser pulado a qualquer momento (botão, X ou Esc); quem pula ou termina não vê de novo, mas revê em Configurações.
 */
export function Tour({ perfil, v, nome, mobile, aoLigar, aoIrPara, aoTerminar }: {
  perfil: Perfil; v: Visao; nome: string; mobile: boolean
  aoLigar: (m: Modulo) => void
  aoIrPara: (pagina: 'inicio') => void
  aoTerminar: () => void
}) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tam, setTam] = useState({ h: 220 })
  const [nota, setNota] = useState<string | null>(null)
  const cartao = useRef<HTMLDivElement>(null)
  const principal = useRef<HTMLButtonElement>(null)

  // Os passos seguem o perfil de quando o tour começou: ligar uma aba no meio do passeio não pode mexer na lista (e no passo atual).
  const [inicio] = useState(() => ({ v, faltam: MODULOS.filter((m) => !perfil.modulos[m.id] && (m.id !== 'moedas' || perfil.moedas.length > 0)).map((m) => m.id) }))
  const v0 = inicio.v
  const oferta = inicio.faltam

  const passos: Passo[] = useMemo(() => {
    const lista: Passo[] = [
      { id: 'inicio', icone: 'ideia', titulo: nome ? `Oi, ${nome}! Vamos conhecer seu painel?` : 'Vamos conhecer seu painel?',
        texto: 'É um passeio de 1 minuto, montado com o que você respondeu. Dá para pular quando quiser.' },
      { id: 'lancar', icone: 'mais', titulo: 'Comece lançando', alvo: 'lancar',
        texto: 'Toque aqui para registrar o que entrou ou saiu. Diga como pagou (Pix, débito, crédito…) e, no crédito, a compra entra na fatura do cartão sozinha.' },
      { id: 'lancamentos', icone: 'lista', titulo: 'Tudo o que você lançou', alvo: 'nav-lancamentos',
        alternativo: { alvo: 'mais', nota: 'Fica em “Mais”.' },
        texto: 'Aqui ficam todos os lançamentos, por dia, com busca e filtros. Tem um extrato do banco ou uma planilha? Dá para importar e lançar tudo de uma vez.' },
    ]
    if (v0.paginaAno) lista.splice(2, 0, {
      id: 'resumo', icone: 'inicio', titulo: 'Seu resumo do mês', alvo: 'nav-inicio',
      alternativo: { alvo: 'mais', nota: 'Fica em “Mais”.' },
      texto: `O Início mostra quanto sobrou, entrou e saiu${v0.comparacao ? ', compara com o mês passado' : ''} e para onde o dinheiro foi. Use o seletor de mês lá em cima para voltar no tempo.`,
    })
    else lista.splice(2, 0, {
      id: 'resumo', icone: 'inicio', titulo: 'Seu resumo do mês', alvo: 'nav-inicio',
      alternativo: { alvo: 'mais', nota: 'Fica em “Mais”.' },
      texto: 'O Início mostra, de forma simples, quanto sobrou, quanto entrou e quanto saiu no mês.',
    })
    if (document.querySelector('[data-tour="importar"]')) lista.push({
      id: 'importar', icone: 'relatorio', titulo: 'Traga seus dados de uma vez', alvo: 'importar',
      texto: 'Importe o extrato do banco (PDF, OFX, Excel, CSV ou Word) ou uma planilha. O app arruma os nomes e mostra tudo antes de gravar.',
    })
    const paginas: { modulo: boolean; pagina: string; chave: string }[] = [
      { modulo: v0.contas, pagina: 'contas', chave: 'contas' },
      { modulo: v0.cartoes, pagina: 'cartoes', chave: 'cartoes' },
      { modulo: v0.dividas, pagina: 'dividas', chave: 'dividas' },
      { modulo: v0.metas, pagina: 'metas', chave: 'metas' },
      { modulo: v0.bancos || v0.investimentos || v0.moedas, pagina: 'patrimonio', chave: 'patrimonio' },
    ]
    for (const p of paginas) if (p.modulo) lista.push({
      id: p.chave, icone: p.pagina === 'patrimonio' ? 'carteira' : p.pagina === 'metas' ? 'meta' : p.pagina === 'contas' ? 'calendario' : 'cartao',
      titulo: TEXTO_MODULO[p.chave].titulo, texto: TEXTO_MODULO[p.chave].texto, alvo: `nav-${p.pagina}`,
      alternativo: { alvo: 'mais', nota: 'Fica em “Mais”.' },
    })
    if (v0.paginaAno) lista.push({
      id: 'ano', icone: 'ano', titulo: 'O ano inteiro', alvo: 'nav-ano', alternativo: { alvo: 'mais', nota: 'Fica em “Mais”.' },
      texto: 'Mês a mês: quanto entrou, saiu e sobrou, num gráfico e numa tabela. Toque num mês para abri-lo.',
    })
    if (oferta.length) lista.push({
      id: 'mais-abas', icone: 'ajustes', titulo: 'Quer mais abas?', alvo: 'nav-config', alternativo: { alvo: 'menu-conta', nota: '' },
      texto: 'Você começou só com o que respondeu, mas o app tem mais. Ligue agora o que fizer sentido; dá para desligar depois em Configurações.',
    })
    lista.push({
      id: 'config', icone: 'engrenagem', titulo: 'Tudo se ajusta aqui', alvo: 'nav-config', alternativo: { alvo: 'menu-conta', nota: 'Toque no menu e escolha Configurações.' },
      texto: 'Em Configurações você põe sua foto, troca o tema, muda as moedas e as categorias, faz backup e vê este passeio de novo quando quiser.',
    })
    return lista
  }, [nome, v0, oferta.length])

  const passo = passos[Math.min(i, passos.length - 1)]
  const ultimo = i >= passos.length - 1
  const primeiro = i === 0

  const medir = useCallback(() => {
    let el = passo.alvo ? acharAlvo(passo.alvo) : null
    let aviso: string | null = null
    if (!el && passo.alternativo) { el = acharAlvo(passo.alternativo.alvo); aviso = passo.alternativo.nota || null }
    setNota(aviso)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [passo.alvo, passo.alternativo])

  useEffect(() => { if (primeiro) aoIrPara('inicio') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // leva o alvo para o meio da tela (se rola) e mede de novo quando a rolagem acaba
  useEffect(() => {
    const el = (passo.alvo && acharAlvo(passo.alvo)) || (passo.alternativo && acharAlvo(passo.alternativo.alvo)) || null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    medir()
    const t = [120, 320, 700].map((ms) => window.setTimeout(medir, ms))
    return () => t.forEach(window.clearTimeout)
  }, [i, medir]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true) }
  }, [medir])

  // mede o cartão de novo quando o conteúdo dele muda (passo, nota, lista de abas)
  useLayoutEffect(() => {
    // offsetHeight é o tamanho de verdade: getBoundingClientRect pegaria o cartão ainda encolhido pela animação de entrada
    const alt = cartao.current?.offsetHeight
    if (alt) setTam((t) => (Math.abs(alt - t.h) > 1 ? { ...t, h: alt } : t))
  }, [passo.id, nota, oferta.length, rect])
  useEffect(() => { principal.current?.focus() }, [i])

  const seguir = () => (ultimo ? aoTerminar() : setI(i + 1))
  const voltar = () => setI(Math.max(0, i - 1))
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoTerminar()
      else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) seguir()
      else if (e.key === 'ArrowLeft') voltar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // onde fica o cartão: ao lado do menu lateral (computador), ou no maior espaço livre acima/abaixo do destaque
  const vw = window.innerWidth, vh = window.innerHeight, m = 12
  const w = Math.min(LARGURA, vw - 2 * m)
  let pos: React.CSSProperties
  if (!rect) pos = { left: (vw - w) / 2, top: Math.max(m, (vh - tam.h) / 2) }
  else if (!mobile && rect.right + w + 28 < vw && rect.left < 340) pos = { left: rect.right + 20, top: entre(rect.top + rect.height / 2 - tam.h / 2, m, vh - tam.h - m) }
  else {
    const abaixo = vh - rect.bottom, acima = rect.top
    const top = abaixo >= tam.h + 28 || abaixo >= acima ? rect.bottom + 16 : rect.top - tam.h - 16
    pos = { left: entre(rect.left + rect.width / 2 - w / 2, m, vw - w - m), top: entre(top, m, vh - tam.h - m) }
  }
  const folga = 7
  const foco: React.CSSProperties | undefined = rect
    ? { left: rect.left - folga, top: rect.top - folga, width: rect.width + 2 * folga, height: rect.height + 2 * folga, borderRadius: Math.min(22, Math.max(12, rect.height / 2 + folga)) }
    : undefined

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tutorial do painel">
      {foco ? <span className="tour-foco" style={foco} aria-hidden="true" /> : <span className="tour-escuro" aria-hidden="true" />}
      <div ref={cartao} className="tour-cartao" style={{ ...pos, width: w }} key={passo.id}>
        <button className="tour-x" onClick={aoTerminar} aria-label="Pular tutorial" title="Pular tutorial"><Icone nome="fechar" tamanho={16} /></button>
        <span className="tour-icone" aria-hidden="true"><Icone nome={passo.icone} tamanho={22} /></span>
        <h2>{passo.titulo}</h2>
        <p>{passo.texto}{nota && <> <b>{nota}</b></>}</p>

        {passo.id === 'inicio' && (
          <div className="tour-chips" aria-label="O que o seu painel tem">
            {['Lançamentos', ...MODULOS.filter((x) => perfil.modulos[x.id] && (x.id !== 'moedas' || perfil.moedas.length)).map((x) => x.nome)].map((n) => <span key={n}>{n}</span>)}
          </div>
        )}
        {passo.id === 'mais-abas' && (
          <ul className="tour-modulos">
            {oferta.map((id) => {
              const mod = MODULOS.find((x) => x.id === id)!
              const ligada = perfil.modulos[id]
              return (
                <li key={id} className={ligada ? 'ligado' : ''}>
                  <span className="tour-modulo-icone"><Icone nome={mod.icone} tamanho={18} /></span>
                  <span className="tour-modulo-texto"><strong>{mod.nome}</strong><small>{mod.descricao}</small></span>
                  <button type="button" className={`btn ${ligada ? '' : 'primario'}`} disabled={ligada}
                    onClick={() => aoLigar(id)}>
                    {ligada ? <><Icone nome="check" tamanho={14} /> Ligada</> : 'Ligar'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="tour-rodape">
          <span className="tour-pontos" aria-label={`Passo ${i + 1} de ${passos.length}`}>
            {passos.map((p, k) => <i key={p.id} className={k === i ? 'ativo' : k < i ? 'feito' : ''} />)}
          </span>
          <div className="tour-acoes">
            {!ultimo && <button type="button" className="link tour-pular" onClick={aoTerminar}>Pular tutorial</button>}
            <span className="espaco" />
            {!primeiro && <button type="button" className="btn" onClick={voltar}>Voltar</button>}
            <button ref={principal} type="button" className="btn primario" onClick={seguir}>
              {ultimo ? 'Concluir' : primeiro ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
