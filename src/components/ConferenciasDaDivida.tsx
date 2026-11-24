import { useState } from 'react'
import { fmtDiv, type Calendario, type SituacaoDivida } from '../lib/dividas'
import { aprenderJuros, descontoParaQuitar, type JurosAprendido } from '../lib/jurosAprendido'
import { historicoDaDivida, type MudancaConferida } from '../lib/conferencias'
import { fmtDataLonga, fmtTaxa } from '../lib/format'
import type { Dados } from '../lib/useDados'
import { Icone } from './Icone'
import { tx } from '../lib/textos'

const pctTexto = (p: number) => `${fmtTaxa(Math.abs(p))}%`

/**
 * O histórico de "Conferi com o banco": em cada dia, quanto o app mostrava e quanto o banco mostrou, e se a dívida caiu ou
 * subiu. Fica guardado para a pessoa (e o consultor) saberem que o valor mudou e quando.
 */
export function ConferenciasDaDivida({ s, cal, d }: {
  s: SituacaoDivida; cal: Calendario | null
  d: Pick<Dados, 'conferencias' | 'conferenciasSemTabela' | 'conferenciasSemPista' | 'delConferencia' | 'updDivida'>
}) {
  const [apagando, setApagando] = useState<string | null>(null)
  if (d.conferenciasSemTabela) {
    return (
      <p className="cc-aviso-migracao">
        <Icone nome="ideia" tamanho={16} />
        <span>{tx('Para guardar o histórico das conferências com o banco, rode')} <code>supabase/migracao-37-conferencias-da-divida.sql</code> {tx('no SQL Editor do Supabase.')}</span>
      </p>
    )
  }
  const lista = historicoDaDivida(d.conferencias, s.divida.id)
  if (!lista.length) return null
  // os valores do histórico estão na moeda principal; `fmtDiv` os põe na moeda da dívida
  const dinheiro = (v: number) => fmtDiv(s, v)
  const daDivida = d.conferencias.filter((c) => c.divida_id === s.divida.id)
  const aprendido = aprenderJuros(s, cal, daDivida)
  const quitar = descontoParaQuitar(daDivida)
  return (
    <section className="dv-conferencias">
      {(aprendido || quitar) && <OQueAprendi s={s} a={aprendido} quitar={quitar} dinheiro={dinheiro} d={d} />}
      <h4 className="dv-ficha-titulo">{tx('Conferências com o banco')} <small>{lista.length}</small></h4>
      <ol className="dv-conferencias-lista">
        {lista.map((m, i) => <Item key={m.conferencia.id} m={m} indice={i} dinheiro={dinheiro}
          apagando={apagando === m.conferencia.id} aoPedirApagar={() => setApagando(m.conferencia.id)} aoManter={() => setApagando(null)}
          aoApagar={() => { setApagando(null); void d.delConferencia(m.conferencia.id) }} />)}
      </ol>
    </section>
  )
}

const CONFIANCA = { alta: () => tx('precisão alta'), media: () => tx('precisão média'), baixa: () => tx('ainda aprendendo') }

/**
 * "O que aprendi com o banco": quanto a dívida cresce de verdade, se bate com a regra informada, quanto pode ser IOF e o
 * desconto para quitar. A taxa calculada só entra na dívida se a pessoa pedir ("Usar a taxa que calculei").
 */
function OQueAprendi({ s, a, quitar, dinheiro, d }: {
  s: SituacaoDivida; a: JurosAprendido | null; quitar: ReturnType<typeof descontoParaQuitar>; dinheiro: (v: number) => string
  d: Pick<Dados, 'updDivida'>
}) {
  const [aplicando, setAplicando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const usar = async () => {
    if (!a?.sugestao || aplicando) return
    setAplicando(true)
    await d.updDivida(s.divida.id, a.sugestao)
    setAplicando(false)
    setConfirmar(false)
  }
  const regraNova = a?.sugestao
    ? a.modelo === 'pct' ? tx('{0}% ao dia sobre o atrasado', fmtTaxa(a.taxaDia * 100)) : tx('{0} por dia', dinheiro(a.reaisDia))
    : null
  return (
    <div className={`dv-aprendi ${a?.diverge ?? 'bate'}`}>
      <h4 className="dv-ficha-titulo"><Icone nome="ideia" tamanho={15} /> {tx('O que aprendi com o banco')}
        {a && <small>{a.amostras === 1 ? tx('1 conferência') : tx('{0} conferências', a.amostras)} · {CONFIANCA[a.confianca]()}</small>}
      </h4>
      {a && (
        <>
          <p className="dv-aprendi-frase">
            {a.diverge === 'mais'
              ? (a.porDiaInformado > 0
                ? tx('O banco está cobrando mais do que você me disse: a dívida cresce uns {0} por dia, e não {1}.', dinheiro(a.porDiaHoje), dinheiro(a.porDiaInformado))
                : tx('Essa dívida cresce uns {0} por dia, mesmo sem regra de juros informada.', dinheiro(a.porDiaHoje)))
              : a.diverge === 'menos'
                ? tx('O banco está cobrando menos do que você me disse: a dívida cresce uns {0} por dia, e não {1}.', dinheiro(a.porDiaHoje), dinheiro(a.porDiaInformado))
                : tx('A regra que você informou bate com o banco: a dívida cresce uns {0} por dia.', dinheiro(a.porDiaHoje))}
          </p>
          <ul className="dv-aprendi-numeros">
            {a.porDiaHoje > 0 && <li><small>{tx('em 30 dias')}</small><strong>{dinheiro(a.porDiaHoje * 30)}</strong></li>}
            {a.taxaMes > 0 && <li><small>{tx('equivale a')}</small><strong>{tx('{0}% ao mês', fmtTaxa(a.taxaMes))}</strong></li>}
            {a.erroMedio !== null && <li><small>{tx('erro das estimativas')}</small><strong>{pctTexto(a.erroMedio * 100)}</strong></li>}
          </ul>
          {a.iofDia > 0.009 && a.porDiaHoje > a.iofDia && (
            <p className="campo-ajuda">{tx('Desses {0} por dia, até {1} pode ser IOF (0,0082% ao dia, regra do governo). O resto, {2}, são juros e encargos do banco.', dinheiro(a.porDiaHoje), dinheiro(a.iofDia), dinheiro(a.porDiaHoje - a.iofDia))}</p>
          )}
          {a.sugestao && regraNova && (confirmar ? (
            <div className="dv-aprendi-confirmar">
              <span>{tx('Trocar a regra desta dívida para {0}? As estimativas passam a seguir o que o banco cobra.', regraNova)}</span>
              <span className="dv-promessa-apagar">
                <button className="btn" onClick={() => setConfirmar(false)}>{tx('Agora não')}</button>
                <button className="btn primario" onClick={() => void usar()} disabled={aplicando}>{tx('Trocar a regra')}</button>
              </span>
            </div>
          ) : (
            <button className="btn" onClick={() => setConfirmar(true)}><Icone nome="calculadora" tamanho={15} /> {tx('Usar a taxa que calculei')}</button>
          ))}
          {a.confianca === 'baixa' && <p className="campo-ajuda">{tx('Com mais uma ou duas conferências (de preferência com alguns dias entre elas), eu acerto melhor.')}</p>}
        </>
      )}
      {quitar && (
        <p className="campo-ajuda dv-aprendi-quitar">
          <Icone nome="acordo" tamanho={14} /> {tx('Em {0}, o banco pedia {1} para quitar tudo: {2} a menos que o total.', fmtDataLonga(quitar.data), dinheiro(quitar.quitar), dinheiro(quitar.desconto))}
        </p>
      )}
    </div>
  )
}

function Item({ m, indice, dinheiro, apagando, aoPedirApagar, aoManter, aoApagar }: {
  m: MudancaConferida; indice: number; dinheiro: (v: number) => string
  apagando: boolean; aoPedirApagar: () => void; aoManter: () => void; aoApagar: () => void
}) {
  const { conferencia: c } = m
  const frase = m.sentido === 'igual'
    ? tx('O banco confirmou {0}.', dinheiro(c.depois))
    : tx('Estava {0}; o banco mostrou {1}.', dinheiro(c.antes), dinheiro(c.depois))
  return (
    <li className={`dv-conferencia ${m.sentido}`} style={{ animationDelay: `${Math.min(indice, 10) * 40}ms` }}>
      <span className="dv-conferencia-marco" aria-hidden="true"><Icone nome={m.sentido === 'caiu' ? 'desce' : m.sentido === 'subiu' ? 'sobe' : 'check'} tamanho={14} /></span>
      <span className="dv-conferencia-corpo">
        <span className="dv-conferencia-topo">
          <strong>{fmtDataLonga(c.data)}</strong>
          {m.sentido !== 'igual' && (
            <span className="dv-conferencia-delta">
              {m.sentido === 'caiu' ? tx('caiu {0}', dinheiro(Math.abs(m.diferenca))) : tx('subiu {0}', dinheiro(m.diferenca))}
              {m.percentual !== 0 && ` (${m.sentido === 'caiu' ? '−' : '+'}${pctTexto(m.percentual)})`}
            </span>
          )}
        </span>
        <small>{frase}</small>
      </span>
      {apagando ? (
        <span className="dv-promessa-apagar">
          <button className="btn" onClick={aoManter}>{tx('Manter')}</button>
          <button className="btn perigo" onClick={aoApagar}>{tx('Excluir')}</button>
        </span>
      ) : (
        <button className="icone-btn" onClick={aoPedirApagar} aria-label={tx('Excluir conferência')} title={tx('Excluir conferência')}><Icone nome="lixeira" tamanho={14} /></button>
      )}
    </li>
  )
}
