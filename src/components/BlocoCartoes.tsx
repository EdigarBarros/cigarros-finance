import { textoStatus, totalFaturasDoMes, type SituacaoCartao } from '../lib/cartoes'
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
        <h2>Cartões</h2>
        <span className="bloco-cab-valor"><small>faturas do mês</small><strong>{fmtValor(totalFaturasDoMes(situacoes))}</strong></span>
      </header>
      {!situacoes.length && (
        <p className="quadro-vazio">Adicione seu cartão para ver a fatura de cada mês e quanto do limite ainda dá para usar. <button className="link" onClick={aoAbrir}>Adicionar cartão</button></p>
      )}
      {situacoes.map((s) => (
        <button key={s.cartao.id} className="cc-mini" onClick={aoAbrir} style={{ '--c': s.cartao.cor } as React.CSSProperties}>
          {/* um cartãozinho na cor do cartão, com chip e o final do nome */}
          <span className="cc-mini-plastico" aria-hidden="true"><i className="cc-mini-chip" /><span>{s.cartao.nome.slice(0, 10)}</span></span>
          <span className="cc-mini-info">
            <span className="cc-mini-topo"><strong>{s.cartao.nome}</strong><span className="cc-mini-valor">{fmtValor(s.valor)}</span></span>
            <span className={`chip-estado cc ${s.status}`}>{textoStatus(s)}</span>
            {s.cartao.limite ? (
              <span className="cc-mini-limite">
                <Progresso valor={s.limiteUsado} total={s.cartao.limite} cor={s.cartao.cor} />
                {s.limiteDisponivel !== null && <small>livre {fmtValor(Math.max(0, s.limiteDisponivel))}</small>}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </section>
  )
}
