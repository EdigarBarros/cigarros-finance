import { useEffect, useRef, useState } from 'react'
import type { Reanalise } from '../lib/analise'
import { Icone } from './Icone'
import { Kairo } from './Kairo'
import type { Humor } from '../lib/kairo'
import { tx } from '../lib/textos'
import './reanalise.css'

/** Quanto tempo o aviso fica na tela (com o ponteiro em cima, ele espera). */
const TEMPO = 9000

/**
 * "Analisei a mudança": depois de um lançamento, compra no cartão, dívida ou qualquer alteração que mexa na análise, o
 * Kairo conta, num canto da tela, o que mudou (nota, previsão do mês, dívidas, plano). Some sozinho; "Ver análise"
 * abre a aba Consultor e "Não avisar mais" desliga (dá para ligar de novo no pé da aba).
 */
export function AvisoReanalise({ r, aoVer, aoFechar, aoDesligar }: {
  r: Reanalise
  aoVer: () => void
  aoFechar: () => void
  aoDesligar: () => void
}) {
  const timer = useRef<number | undefined>(undefined)
  const contar = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(aoFechar, TEMPO)
  }
  // cada reanálise nova recomeça a contagem
  useEffect(() => {
    contar()
    return () => window.clearTimeout(timer.current)
  }, [r]) // eslint-disable-line react-hooks/exhaustive-deps
  const delta = r.nota !== null && r.notaAntes !== null ? r.nota - r.notaAntes : 0
  // primeiro ele pensa (acabou de refazer as contas), depois mostra o que achou: nota subiu, feliz; caiu, preocupado
  const [pensou, setPensou] = useState<Reanalise | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setPensou(r), 1300)
    return () => window.clearTimeout(t)
  }, [r])
  const pensando = pensou !== r
  const humor: Humor = pensando ? 'pensando' : delta > 0 ? 'feliz' : delta < 0 ? 'preocupado' : 'calmo'

  return (
    <div className="reanalise" role="status" aria-live="polite" key={r.em.getTime()}
      onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={contar}>
      <span className="reanalise-icone" aria-hidden="true"><Kairo humor={humor} tamanho={38} vivo flutua /></span>
      <div className="reanalise-texto">
        <strong>
          {tx('Analisei a mudança')}
          {r.nota !== null && (
            <span className={`reanalise-nota ${delta > 0 ? 'bom' : delta < 0 ? 'ruim' : ''}`}>
              {delta !== 0 ? tx('Nota {0} ({1})', r.nota, delta > 0 ? `+${delta}` : String(delta)) : tx('Nota {0}', r.nota)}
            </span>
          )}
        </strong>
        <ul>
          {r.mudancas.slice(0, 2).map((m, i) => <li key={i} className={m.tom}>{m.texto}</li>)}
        </ul>
        <div className="reanalise-acoes">
          <button className="btn primario" onClick={aoVer}>{tx('Ver análise')}</button>
          <button className="link" onClick={aoDesligar}>{tx('Não avisar mais')}</button>
        </div>
      </div>
      <button className="reanalise-fechar" onClick={aoFechar} aria-label={tx('Fechar')}><Icone nome="fechar" tamanho={16} /></button>
    </div>
  )
}
