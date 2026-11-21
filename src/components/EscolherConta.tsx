import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { abrir, iniciaisDe, nomeDe } from '../lib/abrirConta'
import { esquecerConta, useContasSalvas, type ContaSalva } from '../lib/contas'
import { tx } from '../lib/textos'
import { useMobile } from '../lib/useMobile'
import { Icone } from './Icone'
import { Marca } from './Marca'
import './perfis.css'

// o fundo animado vem num arquivo à parte: só quem vê esta tela o baixa
const CenasDoOpus = lazy(() => import('./CenasDoOpus'))

/** Cores da foto de quem não tem foto: sempre a mesma para a mesma conta. */
const CORES: [string, string][] = [
  ['#1f8ef1', '#3d4be0'], ['#14c9a0', '#0b7d66'], ['#ff6b81', '#b8304a'], ['#ffb547', '#d9740b'], ['#8b7cf6', '#5340d6'],
]
function coresDe(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [c1, c2] = CORES[h % CORES.length]
  return { '--c1': c1, '--c2': c2 } as CSSProperties
}

function Perfil({ conta, ordem, editando, ocupada, aoEscolher }: {
  conta: ContaSalva; ordem: number; editando: boolean; ocupada: boolean; aoEscolher: () => void
}) {
  return (
    <button type="button" className={`pf-perfil ${ocupada ? 'ocupada' : ''}`} style={{ '--i': ordem } as CSSProperties}
      onClick={aoEscolher} disabled={ocupada} aria-label={editando ? tx('Tirar {0} deste aparelho', conta.email) : undefined}>
      <span className="pf-foto" style={coresDe(conta.id)}>
        {conta.foto ? <img src={conta.foto} alt="" /> : <b aria-hidden="true">{iniciaisDe(conta) || '?'}</b>}
        {conta.precisaEntrar && !editando && <em className="pf-selo">{tx('Pede a senha')}</em>}
        {ocupada && <span className="pf-espera"><span className="en-girando" /></span>}
        {editando && <span className="pf-tirar"><Icone nome="lixeira" tamanho={30} /></span>}
      </span>
      <span className="pf-nome" translate="no">{nomeDe(conta)}</span>
      <span className="pf-oculto" translate="no">{conta.email}</span>
    </button>
  )
}

/**
 * Sem conta aberta, mas com contas lembradas neste aparelho: escolher com qual entrar, como os perfis de um serviço de
 * vídeo. No fundo passam as cenas do que o app faz (CenasDoOpus). "Gerenciar contas" (no celular, "Editar") deixa tirar
 * contas deste aparelho; "Outra conta" abre o login.
 */
export function EscolherConta({ aoOutra }: { aoOutra: () => void }) {
  const contas = useContasSalvas()
  const mobile = useMobile()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  // no computador, o nome da cena fica embaixo à esquerda (como o título de uma série) se sobra espaço ao lado das contas
  const [largura, setLargura] = useState(() => window.innerWidth)
  useEffect(() => {
    const aoMudar = () => setLargura(window.innerWidth)
    window.addEventListener('resize', aoMudar)
    return () => window.removeEventListener('resize', aoMudar)
  }, [])
  const quadros = contas.length + (editando ? 0 : 1)
  const lado = Math.min(136, Math.max(100, largura * 0.08)), vao = Math.min(28, Math.max(14, largura * 0.018))
  const livre = Math.floor((largura - (quadros * lado + (quadros - 1) * vao)) / 2 - largura * 0.04 - 40)
  const legendaEmbaixo = livre >= 330

  useEffect(() => {
    if (!editando) return
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditando(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [editando])

  const escolher = (c: ContaSalva) => {
    if (ocupada) return
    setErro(null)
    if (editando) { void esquecerConta(c.id); return }
    setOcupada(c.id)
    void abrir(c, setErro).finally(() => setOcupada(null))
  }
  const alternarEdicao = () => { setErro(null); setEditando((x) => !x) }

  const titulo = editando ? tx('Tirar contas deste aparelho') : mobile ? tx('Escolha sua conta') : tx('Quem está usando?')
  return (
    <div className={`escolher-conta pf ${editando ? 'editando' : ''} ${legendaEmbaixo ? '' : 'legenda-no-alto'}`}
      style={legendaEmbaixo ? { '--pf-livre': `${Math.min(460, livre)}px` } as CSSProperties : undefined}>
      <div className="pf-fundo">
        <Suspense fallback={null}><CenasDoOpus /></Suspense>
      </div>
      <header className="pf-topo"><Marca /></header>
      <section className="pf-escolha" aria-labelledby="pf-titulo">
        <h1 id="pf-titulo" key={titulo}>{titulo}</h1>
        {editando && <p className="pf-dica">{tx('Toque numa conta para tirá-la deste aparelho. Os dados dela continuam guardados.')}</p>}
        <div className="pf-grade">
          {contas.map((c, k) => (
            <Perfil key={c.id} conta={c} ordem={k} editando={editando} ocupada={ocupada === c.id} aoEscolher={() => escolher(c)} />
          ))}
          {!editando && (
            <button type="button" className="pf-perfil pf-outra" style={{ '--i': contas.length } as CSSProperties} onClick={aoOutra}>
              <span className="pf-foto"><Icone nome="mais" tamanho={44} /></span>
              <span className="pf-nome">{tx('Outra conta')}</span>
            </button>
          )}
          {mobile && (
            <button type="button" className="pf-perfil pf-editar" style={{ '--i': contas.length + 1 } as CSSProperties} onClick={alternarEdicao}>
              <span className="pf-foto"><Icone nome={editando ? 'check' : 'lapis'} tamanho={34} /></span>
              <span className="pf-nome">{editando ? tx('Concluir') : tx('Editar')}</span>
            </button>
          )}
        </div>
        {erro && <p className="en-aviso" role="alert">{erro}</p>}
        {!mobile && (
          <button type="button" className="pf-gerenciar" onClick={alternarEdicao}>
            <Icone nome={editando ? 'check' : 'lapis'} tamanho={16} />{editando ? tx('Concluir') : tx('Gerenciar contas')}
          </button>
        )}
      </section>
    </div>
  )
}
