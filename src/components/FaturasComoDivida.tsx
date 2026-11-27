import type { Ctx } from '../pages/contexto'
import { fmtDataCurta, fmtValor } from '../lib/format'
import { hojeLocal } from '../lib/contasFixas'
import { nomeDaFatura } from '../lib/cartoes'
import { tx } from '../lib/textos'
import { BancoIcone } from './BancoIcone'
import { Icone } from './Icone'
import './faturas-como-divida.css'

/**
 * Faturas de cartão na tela Dívidas (computador e celular): enquanto têm o que pagar, contam como dívida. Pagar aqui abre o
 * mesmo pagamento da tela Cartões (pagar parte, quitar, juros, cofrinho), então as duas telas, o Planejamento e os
 * Lançamentos ficam sempre iguais. A lista vem de lib/faturasAPagar.ts.
 */
export function FaturasComoDivida({ c }: { c: Ctx }) {
  const lista = c.v.cartoes ? c.faturasAPagar : []
  if (!lista.length) return null
  const hoje = hojeLocal()
  const total = lista.reduce((s, x) => s + x.f.falta, 0)
  return (
    <section className="fcd" aria-label={tx('Faturas de cartão')}>
      <header className="fcd-topo">
        <h3><Icone nome="cartao" tamanho={17} /> {tx('Faturas de cartão')}</h3>
        <span className="fcd-total">{fmtValor(total)}</span>
      </header>
      <p className="fcd-nota">{tx('Contam como dívida até serem pagas. Pagar aqui é o mesmo que pagar na aba Cartões.')}</p>
      <ul className="fcd-lista">
        {lista.map(({ cartao, f, chave }) => {
          const venceu = f.vencimento < hoje
          return (
            <li key={chave} className={`fcd-item ${venceu ? 'atrasada' : ''}`}>
              <BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={36} />
              <span className="fcd-texto">
                <b translate="no">{tx('Fatura de {0} do {1}', nomeDaFatura(f.ano, f.mes), cartao.nome)}</b>
                <small>
                  {venceu ? tx('venceu {0}', fmtDataCurta(f.vencimento)) : tx('vence {0}', fmtDataCurta(f.vencimento))}
                  {f.pagoEmParte > 0 && <> · {tx('já pagou {0}', fmtValor(f.pagoEmParte))}</>}
                </small>
              </span>
              <span className="fcd-valor">
                <b>{fmtValor(f.falta)}</b>
                <small>{f.pagoEmParte > 0 ? tx('falta') : tx('a pagar')}</small>
              </span>
              <span className="fcd-acoes">
                <button type="button" className="btn primario" onClick={() => c.pagarFatura(chave)}>{tx('Pagar fatura')}</button>
                <button type="button" className="link" onClick={() => c.verCartao(cartao.id)}>{tx('Ver no cartão')}</button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
