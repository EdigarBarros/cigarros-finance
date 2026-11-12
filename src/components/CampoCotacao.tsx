import { useState } from 'react'
import { fmtTaxa, parseTaxa } from '../lib/dinheiro'
import { simbolo } from '../lib/format'
import { Icone } from './Icone'
import { cotacaoInvertida, taxaAproximada } from '../lib/moedas'
import { tx } from '../lib/textos'

/**
 * Cotação de uma moeda em relação à moeda principal. Moeda forte (dólar): "1 US$ = 5,35 R$". Moeda fraca (peso, iene): o jeito
 * natural é "1 R$ = 287,70 ARS", então o campo abre assim e o botão inverte. Sai sempre como "quanto vale 1 da moeda em
 * moeda principal" (`aoMudar`), ou null quando está em branco (vale a cotação do dia).
 */
export function CampoCotacao({ moeda, principal, taxaDia, valor, aoMudar }: {
  moeda: string; principal: string
  /** Cotação de hoje, para o texto de exemplo. */
  taxaDia?: number
  /** Cotação escolhida (1 da moeda em moeda principal), ou null. */
  valor: number | null
  aoMudar: (taxa: number | null) => void
}) {
  const taxas = taxaDia ? { [moeda]: taxaDia } : {}
  // a de hoje ou, enquanto ela não chega, a ordem de grandeza da moeda (sem isso o peso abria "1 ARS = … R$" e a pessoa
  // escrevia 280 achando que era "1 R$ = 280 ARS")
  const referencia = taxaAproximada(moeda, principal, taxas)
  // moeda fraca (1 unidade vale poucos centavos): mostra "1 R$ = 287 ARS"
  const [invertido, setInvertido] = useState((referencia ?? valor ?? 1) < 0.2)
  const [texto, setTexto] = useState(valor ? fmtTaxa(invertido ? 1 / valor : valor) : '')
  const mudar = (t: string) => {
    setTexto(t)
    const n = parseTaxa(t)
    aoMudar(n ? (invertido ? 1 / n : n) : null)
  }
  const inverter = () => {
    const n = parseTaxa(texto)
    setInvertido(!invertido)
    setTexto(n ? fmtTaxa(1 / n) : '')
  }
  // escreveu ao contrário: desvira o número e mantém o jeito de mostrar
  const virada = cotacaoInvertida(valor, moeda, principal, taxas)
  const desvirar = () => {
    if (!valor) return
    setTexto(fmtTaxa(invertido ? valor : 1 / valor))
    aoMudar(1 / valor)
  }
  const exemplo = taxaDia ? fmtTaxa(invertido ? 1 / taxaDia : taxaDia) : tx('cotação')
  const [de, para] = invertido ? [simbolo(principal), moeda] : [moeda, simbolo(principal)]
  return (
    <div className="campo-cotacao">
      <label className="campo-caixa">
        <span className="prefixo">1 {de} =</span>
        <input inputMode="decimal" value={texto} onChange={(e) => mudar(e.target.value)} placeholder={exemplo}
          aria-label={tx('Cotação: quanto vale 1 {0} em {1}', de, para)} />
        <span className="prefixo">{para}</span>
      </label>
      <button type="button" className="icone-btn campo-cotacao-inverter" onClick={inverter} title={tx('Inverter a cotação')} aria-label={tx('Inverter a cotação')}>
        <Icone nome="desfazer" tamanho={16} />
      </button>
      {virada && referencia && (
        <p className="campo-cotacao-aviso" role="alert">
          {invertido
            ? tx('Essa cotação parece estar ao contrário: hoje 1 {0} vale cerca de {1} {2}.', simbolo(principal), fmtTaxa(1 / referencia), moeda)
            : tx('Essa cotação parece estar ao contrário: hoje 1 {0} vale cerca de {1} {2}.', moeda, fmtTaxa(referencia), simbolo(principal))}
          {' '}<button type="button" className="link" onClick={desvirar}>{tx('Desvirar')}</button>
        </p>
      )}
    </div>
  )
}
