import { simbolo } from '../lib/format'
import { Bandeira } from './Bandeira'
import { tx } from '../lib/textos'

/**
 * Escolha da moeda: uma pílula por moeda, com a bandeira desenhada (no Windows o emoji de bandeira vira só as letras do país),
 * o código e o símbolo. Em tela pequena a fileira rola para o lado. Serve para qualquer moeda e em qualquer formulário.
 */
export function EscolhaMoeda({ moedas, valor, aoMudar, rotulo = tx('Moeda'), travada = false }: {
  moedas: string[]; valor: string; aoMudar: (m: string) => void; rotulo?: string
  /** Não deixa trocar (a moeda já tem movimentos). */
  travada?: boolean
}) {
  return (
    <div className="moeda-escolha-fila" role="radiogroup" aria-label={rotulo}>
      {moedas.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={m === valor} className={`moeda-pilula ${m === valor ? 'ativo' : ''}`} disabled={travada && m !== valor} onClick={() => aoMudar(m)}>
          <Bandeira moeda={m} tamanho={26} />
          <span className="moeda-pilula-texto"><b>{m}</b><small>{simbolo(m)}</small></span>
        </button>
      ))}
    </div>
  )
}
