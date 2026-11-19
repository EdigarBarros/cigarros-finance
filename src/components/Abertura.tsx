import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { temSessaoSalva, useAberturaSegura } from '../lib/abertura'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { PecaOpus, type NomeDaPeca } from '../pages/FundoOpus'
import './abertura.css'

/** Tempo mínimo na tela, para a entrada terminar inteira (o símbolo chega girando e as peças entram em órbita). */
const MINIMO = 1600
/** Entre uma tela de carregamento e a seguinte (sessão → assinatura → painel), espera um pouco antes de sair. */
const FOLGA = 140
const SAIDA = 1000
const NOME = 'OPUSCASH'
/** Camadas do símbolo, uma atrás da outra: dão espessura ao infinito quando ele balança. */
const CAMADAS = 10

/** As peças da página inicial (pages/FundoOpus.tsx) que giram em volta do símbolo; `dy` desencontra as alturas. */
const ORBITA: { p: NomeDaPeca; dy: number }[] = [
  { p: 'grafico', dy: -46 },
  { p: 'nubank', dy: 26 },
  { p: 'aro', dy: -18 },
  { p: 'lanc', dy: 42 },
  { p: 'invest', dy: -38 },
  { p: 'conta', dy: 22 },
  { p: 'divida', dy: -26 },
  { p: 'guardado', dy: 38 },
]

type Fase = 'fora' | 'dentro' | 'saindo'

/** Espera as fontes do nome e das peças (no máximo `limite` ms): trocar de fonte no meio da animação dá um pulinho. */
function fontesProntas(limite: number): Promise<void> {
  const prontas = new Promise<void>((pronto) => {
    try {
      const link = document.getElementById('fontes') as HTMLLinkElement | null
      const carregar = () => Promise.all(['700 26px Montserrat', '400 12px Inter', '600 12px Inter', '700 12px Inter']
        .map((f) => document.fonts.load(f))).then(() => pronto(), () => pronto())
      // o link das fontes nasce com media="print" e vira "all" quando chega (public/tema-inicial.js)
      if (!link || link.media === 'all') carregar()
      else {
        link.addEventListener('load', () => queueMicrotask(carregar), { once: true })
        link.addEventListener('error', () => pronto(), { once: true })
      }
    } catch { pronto() }
  })
  return Promise.race([prontas, new Promise<void>((r) => window.setTimeout(r, limite))])
}

/**
 * A abertura do OpusCash, em 3D: o símbolo do infinito (com espessura) chega girando e fica balançando; dele saem as peças
 * do app (as mesmas que flutuam na página inicial) e entram em órbita em volta, passando por trás e pela frente dele.
 * Quando tudo carregou, a órbita se abre e as peças voam para fora, o símbolo vem para cima de quem olha e a tela some.
 *
 * Tudo é transform e opacidade em camadas prontas: quem move é a placa de vídeo, então a animação não engasga enquanto o
 * app trabalha para montar o painel (a abertura anterior animava recorte e desfoque, que dependiam do mesmo trabalho e
 * travavam justo no carregamento).
 * Fica por cima de tudo (fora das telas), então não pisca na troca entre uma tela de carregamento e outra; quem pede para
 * ela ficar são as telas de carregamento (lib/abertura.ts).
 */
export function Abertura() {
  const segura = useAberturaSegura()
  const [fase, setFase] = useState<Fase>(() => (temSessaoSalva() ? 'dentro' : 'fora'))
  const desde = useRef(0)
  const [vez, setVez] = useState(0)
  const [rodando, setRodando] = useState(false)

  // a cena começa quando as fontes chegam; o tempo mínimo conta daí
  useEffect(() => {
    let vivo = true
    void fontesProntas(500).then(() => {
      if (!vivo) return
      desde.current = performance.now()
      setRodando(true)
    })
    return () => { vivo = false; setRodando(false) }
  }, [vez])

  useEffect(() => {
    if (segura) {
      if (fase === 'fora') { setVez((v) => v + 1); setFase('dentro') }
      else if (fase === 'saindo') setFase('dentro')
      return
    }
    if (fase === 'dentro') {
      const parado = semMovimento()
      if (!rodando && !parado) return
      const falta = parado ? 0 : Math.max(0, MINIMO - (performance.now() - desde.current))
      const t = window.setTimeout(() => setFase('saindo'), falta + FOLGA)
      return () => window.clearTimeout(t)
    }
    if (fase === 'saindo') {
      const t = window.setTimeout(() => setFase('fora'), semMovimento() ? 200 : SAIDA)
      return () => window.clearTimeout(t)
    }
  }, [segura, fase, rodando])

  if (fase === 'fora') return null
  return (
    <div key={vez} className={`abertura ${rodando ? 'rodando' : ''} ${fase === 'saindo' ? 'saindo' : ''}`} role="status" aria-label={tx('Carregando')} translate="no">
      <div className="ab-fundo" aria-hidden="true" />
      <div className="ab-luz" aria-hidden="true" />
      <div className="ab-cena" aria-hidden="true">
        <div className="ab-inclina">
          {/* a órbita: o anel gira, cada peça tem o seu lugar nele e se vira sempre para quem olha */}
          <div className="ab-abre">
            <div className="ab-anel">
              {ORBITA.map((o, i) => (
                <div key={o.p} className="ab-lugar" style={{ '--a': `${(360 / ORBITA.length) * i}deg`, '--dy': o.dy, '--i': i } as CSSProperties}>
                  <div className="ab-entra">
                    <div className="ab-encara">
                      <div className="ab-flutua">
                        <div className="ab-peca"><PecaOpus p={o.p} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* o símbolo: camadas da mesma imagem uma atrás da outra, a da frente acesa e as de trás mais escuras */}
        <div className="ab-simbolo-sai">
          <div className="ab-simbolo-chega">
            <div className="ab-simbolo">
              <i className="ab-simbolo-brilho" />
              {Array.from({ length: CAMADAS }, (_, i) => (
                <img key={i} src="/simbolo.webp" alt="" width={140} height={68} className={i === 0 ? 'frente' : ''}
                  style={{ '--k': i } as CSSProperties} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="ab-nome" aria-hidden="true">
        {[...NOME].map((l, i) => (
          <span key={i} className={i >= 4 ? 'cash' : ''} style={{ '--i': i } as CSSProperties}>{l}</span>
        ))}
      </div>
    </div>
  )
}
