import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { coresDe, nomeDe } from '../lib/abrirConta'
import { abrirContaConectada, contaConectada, esquecerConta, useContasSalvas, type ContaSalva } from '../lib/contas'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { useMobile } from '../lib/useMobile'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { FotoDaConta, SenhaDaConta } from './SenhaDaConta'
import './perfis.css'

// o fundo animado vem num arquivo à parte: só quem vê esta tela o baixa
const CenasDoOpus = lazy(() => import('./CenasDoOpus'))

/** Quanto dura o voo do quadro escolhido até o centro (perfis.css, .pf-voo). */
const VOO = 850

function Perfil({ conta, ordem, editando, ocupada, voando, aoEscolher }: {
  conta: ContaSalva; ordem: number; editando: boolean; ocupada: boolean; voando: boolean; aoEscolher: (foto: HTMLElement) => void
}) {
  return (
    <button type="button" className={`pf-perfil ${ocupada ? 'ocupada' : ''} ${voando ? 'voando' : ''}`} style={{ '--i': ordem } as CSSProperties}
      onClick={(e) => aoEscolher(e.currentTarget.querySelector('.pf-foto') as HTMLElement)} disabled={ocupada}
      aria-label={editando ? tx('Tirar {0} deste aparelho', conta.email) : undefined}>
      <span className="pf-foto" style={coresDe(conta.id)}>
        <FotoDaConta conta={conta} />
        {!editando && conta.id !== contaConectada() && <em className="pf-selo">{tx('Pede a senha')}</em>}
        {editando && <span className="pf-tirar"><Icone nome="lixeira" tamanho={30} /></span>}
      </span>
      <span className="pf-nome" translate="no">{nomeDe(conta)}</span>
      <span className="pf-oculto" translate="no">{conta.email}</span>
    </button>
  )
}

/** O quadro escolhido saindo do lugar e voando, em 3D, para o meio da tela, onde some (e entra a abertura ou a senha). */
function Voo({ conta, de }: { conta: ContaSalva; de: DOMRect }) {
  const meioX = window.innerWidth / 2, meioY = window.innerHeight / 2
  const estilo = {
    left: de.left, top: de.top, width: de.width, height: de.height,
    '--dx': `${meioX - (de.left + de.width / 2)}px`, '--dy': `${meioY - (de.top + de.height / 2)}px`,
    '--s': Math.min(2.2, 200 / de.width),
    ...coresDe(conta.id),
  } as CSSProperties
  return (
    <div className="pf-voo" style={estilo} aria-hidden="true">
      <i className="pf-voo-luz" />
      <div className="pf-voo-giro">
        <span className="pf-foto"><FotoDaConta conta={conta} /></span>
        <span className="pf-foto pf-voo-verso"><img src="/simbolo.webp" alt="" /></span>
      </div>
    </div>
  )
}

/**
 * Sem conta aberta, mas com contas lembradas neste aparelho: escolher com qual entrar, como os perfis de um serviço de
 * vídeo. No fundo passam as cenas do que o app faz (CenasDoOpus). Tocar num perfil: o quadro voa para o meio e some, e entra
 * a abertura do OpusCash (a conta conectada neste aparelho abre direto) ou a tela de senha.
 * "Gerenciar contas" (no celular, "Editar") tira contas deste aparelho; "Outra conta" abre o login; "Início", a apresentação.
 */
export function EscolherConta({ aoOutra, aoInicio }: { aoOutra: () => void; aoInicio?: () => void }) {
  const contas = useContasSalvas()
  const mobile = useMobile()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [voo, setVoo] = useState<{ conta: ContaSalva; de: DOMRect } | null>(null)
  const [senhaDe, setSenhaDe] = useState<ContaSalva | null>(null)

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

  const escolher = async (c: ContaSalva, foto: HTMLElement) => {
    if (ocupada) return
    if (editando) { esquecerConta(c.id); return }
    setOcupada(c.id)
    setVoo({ conta: c, de: foto.getBoundingClientRect() })
    const pouso = new Promise<void>((r) => window.setTimeout(r, semMovimento() ? 0 : VOO))
    // conectada neste aparelho ("Manter conectado" dentro do prazo): abre sem senha quando o quadro pousa
    if (c.id === contaConectada()) { await abrirContaConectada(pouso); return }
    await pouso
    setSenhaDe(c)
    setVoo(null)
    setOcupada(null)
  }
  const alternarEdicao = () => setEditando((x) => !x)

  if (senhaDe) {
    const atual = contas.find((c) => c.id === senhaDe.id) ?? senhaDe
    return <SenhaDaConta conta={atual} aoVoltar={() => setSenhaDe(null)} />
  }

  const titulo = editando ? tx('Tirar contas deste aparelho') : mobile ? tx('Escolha sua conta') : tx('Quem está usando?')
  return (
    <div className={`escolher-conta pf ${editando ? 'editando' : ''} ${voo ? 'saindo' : ''} ${legendaEmbaixo ? '' : 'legenda-no-alto'}`}
      style={legendaEmbaixo ? { '--pf-livre': `${Math.min(460, livre)}px` } as CSSProperties : undefined}>
      <div className="pf-fundo">
        <Suspense fallback={null}><CenasDoOpus /></Suspense>
      </div>
      <header className="pf-topo">
        <Marca />
        {aoInicio && (
          <button type="button" className="pf-inicio" onClick={aoInicio} title={tx('Conhecer o OpusCash')}>
            <Icone nome="inicio" tamanho={16} /><span>{tx('Início')}</span>
          </button>
        )}
      </header>
      <section className="pf-escolha" aria-labelledby="pf-titulo">
        <h1 id="pf-titulo" key={titulo}>{titulo}</h1>
        {editando && <p className="pf-dica">{tx('Toque numa conta para tirá-la deste aparelho. Os dados dela continuam guardados.')}</p>}
        <div className="pf-grade">
          {contas.map((c, k) => (
            <Perfil key={c.id} conta={c} ordem={k} editando={editando} ocupada={ocupada === c.id} voando={voo?.conta.id === c.id}
              aoEscolher={(foto) => void escolher(c, foto)} />
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
        {!mobile && (
          <button type="button" className="pf-gerenciar" onClick={alternarEdicao}>
            <Icone nome={editando ? 'check' : 'lapis'} tamanho={16} />{editando ? tx('Concluir') : tx('Gerenciar contas')}
          </button>
        )}
      </section>
      {voo && <Voo conta={voo.conta} de={voo.de} />}
    </div>
  )
}
