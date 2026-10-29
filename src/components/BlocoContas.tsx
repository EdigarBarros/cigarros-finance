import { COR } from '../lib/charts'
import { aproxConta, fmtConta, fraseDaSituacao, pendentes, totaisDoMes, type SituacaoConta } from '../lib/contasFixas'
import { fmtValor } from '../lib/format'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
import './contas.css'

const PROXIMAS = 4
const ATRASADAS = 5

/**
 * Contas do mês na visão geral: o que está atrasado e as próximas a vencer, com "Paguei" a um toque.
 * `situacoes` são as do mês aberto (vindas de `situacoesDoMes`, ou de `ctx.situacoesContas`).
 */
export function BlocoContasDoMes({ situacoes, aoAbrir, aoPagar, completo }: {
  /** Detalhado: mostra todas as contas pendentes, sem cortar a lista. */
  completo?: boolean
  situacoes: SituacaoConta[]
  /** Abre a página Contas do mês (também para cadastrar a primeira conta). */
  aoAbrir: () => void
  /** "Paguei" / "Recebi" a um toque, com o valor de costume da conta. */
  aoPagar: (s: SituacaoConta) => void
}) {
  const { faltaPagar, qtdAtrasadas } = totaisDoMes(situacoes)
  const { atrasadas, proximas } = pendentes(situacoes)
  const linhas = [...atrasadas.slice(0, completo ? undefined : ATRASADAS), ...proximas.slice(0, completo ? undefined : PROXIMAS)]
  const escondidas = atrasadas.length + proximas.length - linhas.length

  return (
    <section className="bloco">
      <header className="bloco-cab">
        <h2>Contas do mês</h2>
        {situacoes.length > 0 && (
          <span className="bloco-cab-valor">
            <small style={qtdAtrasadas ? { color: COR.saidas } : undefined}>{qtdAtrasadas ? `${qtdAtrasadas} vencida${qtdAtrasadas > 1 ? 's' : ''} · falta pagar` : 'falta pagar'}</small>
            <strong>{fmtValor(faltaPagar)}</strong>
          </span>
        )}
      </header>
      {!situacoes.length && (
        <p className="quadro-vazio">
          Aluguel, luz, internet, salário… Adicione o que se repete todo mês e o app avisa quando vencer.{' '}
          <button className="link" onClick={aoAbrir}>Adicionar a primeira conta</button>
        </p>
      )}
      {situacoes.length > 0 && !linhas.length && (
        <p className="quadro-vazio">Tudo em dia neste mês! 🎉 <button className="link" onClick={aoAbrir}>Ver contas</button></p>
      )}
      {linhas.map((s) => (
        <div key={s.conta.id} className={`conta-linha com-dia ${s.estado}`}>
          {/* o dia do vencimento em bloco, na cor da situação */}
          <span className="conta-dia" aria-hidden="true"><b>{String(s.dia).padStart(2, '0')}</b><small>{MES[Number(s.vencimento.slice(5, 7)) - 1]}</small></span>
          <button className="conta-info" onClick={aoAbrir}>
            <strong>{s.conta.descricao}</strong>
            <span className={`chip-estado ${s.estado}`}>{fraseDaSituacao(s)}</span>
          </button>
          <span className="conta-valor">{fmtConta(s)}{s.moeda && <small className="conta-aprox">{aproxConta(s)}</small>}</span>
          <button className="btn primario" onClick={() => aoPagar(s)}>{s.conta.tipo === 'entrada' ? 'Recebi' : 'Paguei'}</button>
        </div>
      ))}
      {linhas.length > 0 && (
        <div className="conta-bloco-rodape">
          <span>{atrasadas.length + proximas.length} {atrasadas.length + proximas.length === 1 ? 'conta em aberto' : 'contas em aberto'}</span>
          <button className="link" onClick={aoAbrir}>{escondidas > 0 ? `Ver todas (+${escondidas})` : 'Ver todas'}</button>
        </div>
      )}
    </section>
  )
}
