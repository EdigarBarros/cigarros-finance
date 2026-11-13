import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCAL_DAS_DATAS } from '../lib/format'
import {
  abrirPedido, CATEGORIAS, categoria, contextoDoPedido, encerrarPedido, lerConversa, listarPedidos, marcarLido, responderPedido,
  temRespostaNova, type CategoriaSuporte, type MensagemSuporte, type PedidoSuporte,
} from '../lib/suporte'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { Modal, Opcao, Segmentado } from './ui'

/*
 * Suporte (migração 33): de qualquer tela, a pessoa abre um pedido de ajuda, acompanha a conversa e vê só os pedidos dela.
 * Três vistas na mesma janela: a lista de pedidos, o pedido novo e a conversa de um pedido.
 */

type Vista = { tipo: 'lista' } | { tipo: 'novo' } | { tipo: 'conversa'; id: string }

const horaCurta = new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { hour: '2-digit', minute: '2-digit' })
const diaCurto = new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { day: 'numeric', month: 'short' })

/** "agora", "há 5 min", "há 3 h", "12 de nov." */
function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return tx('agora')
  if (min < 60) return tx('há {0} min', min)
  if (min < 24 * 60) return tx('há {0} h', Math.round(min / 60))
  return diaCurto.format(new Date(iso))
}

function Situacao({ p }: { p: PedidoSuporte }) {
  if (p.status === 'resolvido') return <span className="sp-situacao resolvido"><Icone nome="check" tamanho={13} />{tx('Resolvido')}</span>
  if (p.status === 'respondido') return <span className="sp-situacao respondido"><Icone nome="conversa" tamanho={13} />{tx('Respondido')}</span>
  return <span className="sp-situacao aberto"><Icone nome="relogio" tamanho={13} />{tx('Esperando o suporte')}</span>
}

function Lista({ pedidos, erro, aoAbrir, aoNovo }: { pedidos: PedidoSuporte[] | null; erro: string | null; aoAbrir: (id: string) => void; aoNovo: () => void }) {
  const [aba, setAba] = useState<'andamento' | 'resolvidos'>('andamento')
  const andamento = (pedidos ?? []).filter((p) => p.status !== 'resolvido')
  const resolvidos = (pedidos ?? []).filter((p) => p.status === 'resolvido')
  const lista = aba === 'andamento' ? andamento : resolvidos
  return (
    <div className="sp-lista">
      <button className="sp-novo" onClick={aoNovo}>
        <span className="sp-novo-icone"><Icone nome="mais" /></span>
        <span><strong>{tx('Pedir ajuda')}</strong><small>{tx('Pagamento, algo que não funciona, sua conta ou uma dúvida: a gente responde por aqui.')}</small></span>
        <Icone nome="dir" tamanho={18} />
      </button>
      {pedidos && pedidos.length > 0 && (
        <Segmentado rotulo={tx('Meus pedidos')} valor={aba} aoMudar={setAba}
          opcoes={[{ id: 'andamento', nome: tx('Em andamento ({0})', andamento.length) }, { id: 'resolvidos', nome: tx('Resolvidos ({0})', resolvidos.length) }]} />
      )}
      {erro && !pedidos && <p className="form-erro">{erro}</p>}
      {!pedidos && !erro && <div className="esqueleto" style={{ height: 160 }} />}
      {pedidos && pedidos.length === 0 && (
        <div className="sp-vazio">
          <span className="sp-vazio-icone"><Icone nome="conversa" tamanho={30} /></span>
          <strong>{tx('Nenhum pedido ainda')}</strong>
          <p>{tx('Quando precisar, peça ajuda aqui. Você recebe a resposta nesta mesma tela.')}</p>
        </div>
      )}
      {pedidos && pedidos.length > 0 && lista.length === 0 && (
        <p className="sp-nada">{aba === 'andamento' ? tx('Nenhum pedido em andamento.') : tx('Nenhum pedido resolvido ainda.')}</p>
      )}
      <ul className="sp-pedidos">
        {lista.map((p, i) => {
          const c = categoria(p.categoria)
          const nova = temRespostaNova(p)
          return (
            <li key={p.id} style={{ '--i': Math.min(i, 10), '--c': c.cor } as React.CSSProperties}>
              <button className={nova ? 'nova' : ''} onClick={() => aoAbrir(p.id)}>
                <span className="sp-cat-icone"><Icone nome={c.icone} tamanho={18} /></span>
                <span className="sp-pedido-texto">
                  <strong>{p.assunto}</strong>
                  <small>{c.nome()} · {quando(p.ultima_mensagem_em)}</small>
                </span>
                {nova ? <span className="sp-nova">{tx('Resposta nova')}</span> : <Situacao p={p} />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Novo({ aoEnviado, aoVoltar }: { aoEnviado: (id: string) => void; aoVoltar: () => void }) {
  const [cat, setCat] = useState<CategoriaSuporte | null>(null)
  const [assunto, setAssunto] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ctx = contextoDoPedido()
  const pode = cat && texto.trim().length >= 3 && !enviando
  return (
    <form className="sp-form" onSubmit={async (e) => {
      e.preventDefault()
      if (!cat || !pode) return
      setEnviando(true)
      setErro(null)
      try {
        aoEnviado(await abrirPedido(cat, assunto, texto))
      } catch (err) {
        setErro(err instanceof Error ? err.message : String(err))
        setEnviando(false)
      }
    }}>
      <button type="button" className="link sp-voltar" onClick={aoVoltar}><Icone nome="esq" tamanho={16} />{tx('Meus pedidos')}</button>
      <p className="sp-rotulo">{tx('Sobre o que é?')}</p>
      <div className="sp-categorias">
        {CATEGORIAS.map((c) => (
          <Opcao key={c.id} ativo={cat === c.id} aoClicar={() => setCat(c.id)} icone={c.icone} titulo={c.nome()} texto={c.texto()} />
        ))}
      </div>
      {cat && (
        <div className="sp-campos">
          <label>
            {tx('Assunto')} <small>{tx('(opcional)')}</small>
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={120}
              placeholder={cat === 'bug' ? tx('Ex.: a tela de metas fica em branco') : cat === 'pagamento' ? tx('Ex.: paguei o Pix e não liberou') : tx('Em poucas palavras')} />
          </label>
          <label>
            {tx('Conte o que aconteceu')}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={4000} autoFocus
              placeholder={cat === 'bug' ? tx('O que você fez, o que esperava e o que apareceu. Quanto mais detalhe, mais rápido a gente resolve.') : tx('Escreva com suas palavras.')} />
          </label>
          <p className="sp-contexto"><Icone nome="escudo" tamanho={14} />
            {tx('Vai junto, para ajudar: a tela em que você estava ({0}), o aparelho ({1}) e a versão do app ({2}). Nada dos seus lançamentos.', ctx.tela, ctx.aparelho, ctx.versao)}
          </p>
          {erro && <p className="form-erro">{erro}</p>}
          <button className="btn primario sp-enviar" disabled={!pode}>
            <Icone nome="enviar" tamanho={17} />{enviando ? tx('Enviando…') : tx('Mandar pedido')}
          </button>
        </div>
      )}
    </form>
  )
}

function Conversa({ pedido, aoVoltar, aoMudou }: { pedido: PedidoSuporte | undefined; aoVoltar: () => void; aoMudou: () => void }) {
  const id = pedido?.id
  const [msgs, setMsgs] = useState<MensagemSuporte[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const ler = useCallback(() => {
    if (!id) return
    lerConversa(id).then((m) => { setMsgs(m); setErro(null) }, (e) => setErro(e instanceof Error ? e.message : String(e)))
  }, [id])
  // abre lendo e confere de novo a cada 15 s enquanto a conversa está aberta (a resposta aparece sozinha)
  useEffect(() => {
    if (!id) return
    ler()
    void marcarLido(id).then(aoMudou)
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') ler() }, 15_000)
    return () => window.clearInterval(t)
  }, [id, ler, aoMudou])
  const total = msgs?.length ?? 0
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [total])
  if (!pedido) return <div className="esqueleto" style={{ height: 240 }} />
  const c = categoria(pedido.categoria)
  const resolvido = pedido.status === 'resolvido'

  const mandar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      await responderPedido(pedido.id, texto)
      setTexto('')
      ler()
      aoMudou()
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    }
    setEnviando(false)
  }

  return (
    <div className="sp-conversa" style={{ '--c': c.cor } as React.CSSProperties}>
      <button type="button" className="link sp-voltar" onClick={aoVoltar}><Icone nome="esq" tamanho={16} />{tx('Meus pedidos')}</button>
      <header className="sp-conversa-topo">
        <span className="sp-cat-icone"><Icone nome={c.icone} tamanho={18} /></span>
        <div><strong>{pedido.assunto}</strong><small>{c.nome()} · {tx('aberto em {0}', diaCurto.format(new Date(pedido.criado_em)))}</small></div>
        <Situacao p={pedido} />
      </header>
      <div className="sp-mensagens" aria-live="polite">
        {!msgs && !erro && <div className="esqueleto" style={{ height: 120 }} />}
        {msgs?.map((m, i) => (
          <div key={m.id} className={`sp-msg ${m.autor}`} style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
            {m.autor === 'suporte' && <span className="sp-msg-quem"><Marca compacta /></span>}
            <div className="sp-balao">
              <p>{m.texto}</p>
              <small>{m.autor === 'suporte' ? tx('Suporte OpusCash') : tx('Você')} · {quando(m.criado_em)} · {horaCurta.format(new Date(m.criado_em))}</small>
            </div>
          </div>
        ))}
        {msgs && pedido.status === 'aberto' && (
          <p className="sp-aguarde"><Icone nome="relogio" tamanho={14} />{tx('Recebemos seu pedido. A resposta aparece aqui; você também vê um aviso no botão de suporte.')}</p>
        )}
        <div ref={fim} />
      </div>
      {resolvido && <p className="sp-resolvido"><Icone nome="check" tamanho={15} />{tx('Este pedido foi resolvido. Se precisar de mais alguma coisa, é só escrever: ele volta a ficar aberto.')}</p>}
      {erro && <p className="form-erro">{erro}</p>}
      <form className="sp-escrever" onSubmit={(e) => { e.preventDefault(); void mandar() }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={4000} placeholder={tx('Escreva sua mensagem…')}
          aria-label={tx('Mensagem')} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void mandar() } }} />
        <button className="btn primario" disabled={!texto.trim() || enviando} aria-label={tx('Mandar')}><Icone nome="enviar" tamanho={17} /></button>
      </form>
      {!resolvido && (
        <button type="button" className="link sp-encerrar" onClick={async () => {
          try { await encerrarPedido(pedido.id); aoMudou() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
        }}>{tx('Meu problema foi resolvido')}</button>
      )}
    </div>
  )
}

/** A janela de suporte. `aoMudar` avisa o painel para atualizar o aviso de resposta nova. */
export function Suporte({ aoFechar, aoMudar, inicial }: { aoFechar: () => void; aoMudar: () => void; inicial?: 'novo' }) {
  const [vista, setVista] = useState<Vista>(inicial === 'novo' ? { tipo: 'novo' } : { tipo: 'lista' })
  const [pedidos, setPedidos] = useState<PedidoSuporte[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => {
    listarPedidos().then((p) => { setPedidos(p); setErro(null) }, (e) => setErro(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(() => {
    carregar()
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') carregar() }, 30_000)
    return () => window.clearInterval(t)
  }, [carregar])
  const mudou = useCallback(() => { carregar(); aoMudar() }, [carregar, aoMudar])

  return (
    <Modal titulo={tx('Suporte')} aoFechar={aoFechar}>
      <div key={vista.tipo === 'conversa' ? vista.id : vista.tipo} className="sp-vista">
        {vista.tipo === 'lista' && <Lista pedidos={pedidos} erro={erro} aoAbrir={(id) => setVista({ tipo: 'conversa', id })} aoNovo={() => setVista({ tipo: 'novo' })} />}
        {vista.tipo === 'novo' && <Novo aoVoltar={() => setVista({ tipo: 'lista' })} aoEnviado={(id) => { mudou(); setVista({ tipo: 'conversa', id }) }} />}
        {vista.tipo === 'conversa' && <Conversa pedido={pedidos?.find((p) => p.id === vista.id)} aoVoltar={() => setVista({ tipo: 'lista' })} aoMudou={mudou} />}
      </div>
    </Modal>
  )
}
