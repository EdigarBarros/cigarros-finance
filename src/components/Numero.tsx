import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { depoisDaAbertura } from '../lib/abertura'
import { semMovimento } from '../lib/tema'

const suave = (t: number) => 1 - Math.pow(1 - t, 4)

/**
 * Número que conta até o valor (como os saldos do vídeo de referência): na primeira vez parte do zero,
 * depois anda do valor anterior até o novo, ao trocar de mês ou lançar algo.
 *
 * A contagem muda só o texto do número, quadro a quadro, sem passar pelo React: antes cada quadro redesenhava o
 * componente (dezenas de vezes por segundo, em cada número da tela), e trocar de aba rápido no celular engasgava.
 * O React continua dono do texto: ele escreve o valor da hora em cada desenho, e a contagem só mexe nesse mesmo texto.
 * Na entrada do app, a contagem espera a abertura sair (lib/abertura.ts): atrás dela ninguém via, e cada quadro roubava
 * quadros da saída dela no celular.
 */
export function Numero({ valor, formato, duracao = 1200 }: { valor: number; formato: (n: number) => string; duracao?: number }) {
  const [parado] = useState(semMovimento)
  const texto = useRef<HTMLSpanElement>(null)
  const atual = useRef(parado ? valor : 0)
  // o formato pode mudar a cada desenho (moeda, valores ocultos): a contagem usa sempre o mais recente
  const formatoAtual = useRef(formato)
  useLayoutEffect(() => { formatoAtual.current = formato })
  useEffect(() => {
    if (parado) return
    const de = atual.current
    if (de === valor) return
    let quadro = 0
    const desistir = depoisDaAbertura(() => {
      const inicio = performance.now()
      quadro = requestAnimationFrame(function passo(agora) {
        const t = Math.min(1, Math.max(0, (agora - inicio) / duracao))
        const v = t < 1 ? de + (valor - de) * suave(t) : valor
        atual.current = v
        const no = texto.current?.firstChild
        if (no) no.nodeValue = formatoAtual.current(v)
        if (t < 1) quadro = requestAnimationFrame(passo)
      })
    })
    return () => { desistir(); cancelAnimationFrame(quadro) }
  }, [valor, duracao, parado])
  // Os valores já usam a formatação do idioma escolhido no aplicativo.
  return <span ref={texto} translate="no">{formato(parado ? valor : atual.current)}</span>
}
