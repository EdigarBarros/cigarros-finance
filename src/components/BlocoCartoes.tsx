import { textoStatus, totalFaturasDoMes, type SituacaoCartao } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { fmtValor } from '../lib/format'
import { Progresso } from './ui'

/**
 * As faturas do mês de cada cartão, para a visão geral: valor, quando vence, situação e quanto sobra do limite.
 * `situacoes` vem de `situacoesDoMes` (um item por cartão ativo; em `Ctx` é `c.faturas`).
 * Para um indicador com o total das faturas do mês, use `totalFaturasDoMes(situacoes)` de `lib/cartoes`.
 */
export function BlocoCartoes({ situacoes, aoAbrir }: { situacoes: SituacaoCartao[]; aoAbrir: () => void }) {
  return (
    <section className="bloco">
      <header className="bloco-cab">
        <span style={{ color: COR.investimentos }}>CARTÕES</span>
        <strong>{fmtValor(totalFaturasDoMes(situacoes))}</strong>
      </header>
      {!situacoes.length && (
        <p className="quadro-vazio">Cadastre seu cartão para ver a fatura de cada mês e quanto do limite ainda dá para usar. <button className="link" onClick={aoAbrir}>Cadastrar</button></p>
      )}
      {situacoes.map((s) => (
        <button key={s.cartao.id} className="banco-linha" onClick={aoAbrir}>
          <span className="banco-linha-nome"><i className="marcador" style={{ background: s.cartao.cor }} />{s.cartao.nome}</span>
          <span className="banco-linha-saldo">{fmtValor(s.valor)}</span>
          {s.cartao.limite ? <Progresso valor={s.limiteUsado} total={s.cartao.limite} cor={s.cartao.cor} /> : null}
          <span className="banco-linha-sub">
            {textoStatus(s)}
            {s.limiteDisponivel !== null && ` · disponível ${fmtValor(Math.max(0, s.limiteDisponivel))}`}
          </span>
        </button>
      ))}
    </section>
  )
}
