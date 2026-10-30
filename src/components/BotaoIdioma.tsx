import { useEffect, useMemo, useRef, useState } from 'react'
import { IDIOMAS, idiomaPorCodigo, ORIGINAL, sugeridos, trocarIdioma, useIdioma } from '../lib/idioma'
import { Icone } from './Icone'

// "Idioma" em vários idiomas: é o que o leitor de tela fala e o que aparece ao parar o ponteiro, seja qual for a língua da pessoa
const ROTULO = 'Idioma · Language · Idioma · Langue · Sprache · 语言 · भाषा · لغة · Язык · 言語'

/** Ícone universal de tradução (o "文A" que o Chrome, o Android e o Google Tradutor usam). */
function IconeTraduzir({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.87 15.07l-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
    </svg>
  )
}

const sigla = (codigo: string) => codigo.split('-')[0].toUpperCase().replace('IW', 'HE').replace('JW', 'JV')
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Botão de trocar o idioma do site. `flutuante`: fica preso no canto de cima da tela (landing, login, assinatura), onde não há
 * barra de topo; sem ele, é um botão redondo da barra do painel, ao lado do tema.
 * O menu inteiro é `translate="no"`: cada idioma aparece escrito nele mesmo, nunca traduzido.
 */
export function BotaoIdioma({ flutuante }: { flutuante?: boolean }) {
  const codigo = useIdioma()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto) return
    // no celular o teclado subiria cobrindo a lista: o foco automático na busca é só no computador
    if (matchMedia('(pointer: fine)').matches) campo.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto])

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim())
    if (termo) {
      return IDIOMAS.filter((i) => [i.nativo, i.ingles, i.portugues, i.codigo].some((t) => semAcento(t).includes(termo)))
    }
    // os idiomas do navegador e o original primeiro; depois todos, sem repetir
    const topo = [...sugeridos(), idiomaPorCodigo(ORIGINAL)]
    const vistos = new Set(topo.map((i) => i.codigo))
    return [...topo.filter((i, n) => topo.findIndex((j) => j.codigo === i.codigo) === n), ...IDIOMAS.filter((i) => !vistos.has(i.codigo))]
  }, [busca])

  const escolher = (c: string) => {
    setAberto(false)
    setBusca('')
    trocarIdioma(c)
  }

  return (
    <div className={`idioma ${flutuante ? 'flutuante' : ''}`} translate="no">
      <button className="idioma-btn" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-haspopup="dialog"
        aria-label={ROTULO} title={ROTULO}>
        <IconeTraduzir />
        <span className="idioma-sigla">{sigla(codigo)}</span>
      </button>
      {aberto && (
        <>
          <div className="fora" onClick={() => setAberto(false)} />
          <div className="idioma-menu" role="dialog" aria-label={ROTULO}>
            <div className="idioma-busca">
              <Icone nome="busca" tamanho={17} />
              <input ref={campo} type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="English, Español, 中文, हिन्दी…" aria-label={ROTULO} />
            </div>
            <ul className="idioma-lista">
              {lista.map((i) => (
                <li key={i.codigo}>
                  <button className={i.codigo === codigo ? 'ativo' : ''} onClick={() => escolher(i.codigo)}
                    aria-current={i.codigo === codigo ? 'true' : undefined} lang={i.codigo}>
                    <span>{i.nativo}</span>
                    {i.codigo === codigo ? <Icone nome="check" tamanho={16} /> : <small>{i.ingles !== i.nativo ? i.ingles : ''}</small>}
                  </button>
                </li>
              ))}
              {!lista.length && <li className="idioma-vazio"><Icone nome="globo" tamanho={18} /> ?</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
