import { useState } from 'react'
import { casasDaMoeda, mascarar, paraCampoMoeda, VALOR_MAX } from '../lib/dinheiro'
import { moedaAtual, parseNumero, simbolo } from '../lib/format'
import type { SaldoInicial } from '../lib/types'
import { CampoMes } from './Escolhas'
import { Modal } from './ui'
import { tx } from '../lib/textos'

/**
 * O ponto de partida do saldo de um mês para o outro: quanto a pessoa tinha no começo de um mês. Informado uma vez; daí em
 * diante o app soma o que sobrou e tira o que faltou em cada mês (lib/saldoCorrido.ts). Não vira lançamento.
 */
export function FormSaldoInicial({ inicial, mesSugerido, aoSalvar, aoFechar }: {
  inicial: SaldoInicial | null
  /** Mês que abre escolhido quando ainda não há ponto de partida ("AAAA-MM"): o primeiro com lançamentos no ano aberto. */
  mesSugerido: string
  aoSalvar: (novo: SaldoInicial | null) => void
  aoFechar: () => void
}) {
  const moeda = moedaAtual()
  const [mes, setMes] = useState(inicial?.mes ?? mesSugerido)
  const [valor, setValor] = useState(inicial ? paraCampoMoeda(Math.abs(inicial.valor), moeda) : '')
  const [negativo, setNegativo] = useState(Boolean(inicial && inicial.valor < 0))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = () => {
    const n = valor.trim() ? parseNumero(valor) : 0
    if (n === null || n < 0) return setErro(tx('Digite quanto você tinha (pode ser 0).'))
    if (n > VALOR_MAX) return setErro(tx('Esse valor é grande demais. Use menos de 10 bilhões.'))
    if (!mes) return setErro(tx('Escolha o mês.'))
    aoSalvar({ valor: negativo ? -n : n, mes })
    aoFechar()
  }

  return (
    <Modal titulo={tx('Saldo de um mês para o outro')} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <p className="campo-ajuda">
          {tx('Diga quanto você tinha no começo de um mês. A partir dele, cada mês começa com o que sobrou do anterior: o que sobra soma, o que falta tira.')}
        </p>
        <label className="campo">
          <span className="campo-rotulo">{tx('A partir de')}</span>
          <CampoMes valor={mes} aoMudar={(m) => { setMes(m); setErro(null) }} rotulo={tx('A partir de')} obrigatorio />
        </label>
        <label className="valor-grande" style={{ '--c': negativo ? 'var(--saida)' : 'var(--entrada)' } as React.CSSProperties}>
          <span>{negativo ? '−' : ''}{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} aria-label={tx('Quanto você tinha no começo do mês')}
            onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} />
        </label>
        <label className="lf-acertar">
          <input type="checkbox" checked={negativo} onChange={(e) => setNegativo(e.target.checked)} />
          <span>{tx('Estava no negativo (cheque especial)')}</span>
        </label>
        <span className="campo-ajuda">
          {tx('Some o que estava nas contas e na carteira nesse dia. Não vira lançamento e não muda o saldo dos bancos.')}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {inicial && (
            <button type="button" className="btn perigo" onClick={() => { aoSalvar(null); aoFechar() }}>{tx('Tirar o saldo')}</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{tx('Salvar')}</button>
        </div>
      </form>
    </Modal>
  )
}
