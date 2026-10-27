import { useState } from 'react'
import { COR } from '../lib/charts'
import { parcelasDe, type SituacaoDivida } from '../lib/dividas'
import { dataPadrao, fmtValor, fmtDataCurta, fmtMesAno, MESES_CURTO } from '../lib/format'
import { FormDivida } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

/**
 * Dívidas: quanto falta em cada uma, em que parcela está e quando acaba. As que ainda não têm parcela
 * aparecem com um convite para definir; as quitadas ficam no fim.
 */
export function Dividas(c: Ctx) {
  const [editando, setEditando] = useState<SituacaoDivida | 'nova' | null>(null)
  const [definirParcela, setDefinirParcela] = useState(false)
  const editar = (s: SituacaoDivida, parcela = false) => { setDefinirParcela(parcela); setEditando(s) }
  const abertas = c.situacao.filter((s) => !s.quitadaNoMes)
  const quitadas = c.situacao.filter((s) => s.quitadaNoMes)
  const semParcela = abertas.filter((s) => !s.divida.valor_parcela)
  const pagoNoMes = c.situacao.reduce((a, s) => a + s.pagoNoMes, 0)
  // Só dá para prever o fim se toda dívida em aberto tiver parcela definida.
  const ultimaQuitacao = semParcela.length ? undefined : abertas
    .map((s) => s.quitacao)
    .filter((q): q is [number, number] => q !== null)
    .sort((a, b) => b[0] * 12 + b[1] - (a[0] * 12 + a[1]))[0]

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Dívidas</h1>
          <p className="sub">Quanto falta em cada uma e quando acaba. Cada pagamento lançado abate sozinho.</p>
        </div>
        <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> Adicionar dívida</button>
      </header>

      {c.situacao.length > 0 && (
        <div className="kpis">
          <Kpi rotulo="Falta pagar" valor={fmtValor(c.r.divida)} cor={COR.divida}
            delta={c.anterior?.divida ? (c.r.divida - c.anterior.divida) / c.anterior.divida : null} menorMelhor
            contra={c.mes > 1 ? `em ${MESES_CURTO[c.mes - 2].toLowerCase()}` : undefined} />
          <Kpi rotulo="Parcelas por mês" valor={fmtValor(c.r.parcelasMensais)} cor={COR.saidas} />
          <Kpi rotulo="Sem dívidas em" valor={ultimaQuitacao ? fmtMesAno(ultimaQuitacao[0], ultimaQuitacao[1]) : abertas.length ? '—' : 'Já está! 🎉'} cor={COR.caixa}>
            {semParcela.length > 0 && <span className="kpi-delta">Falta definir parcelas</span>}
          </Kpi>
          <Kpi rotulo="Pago neste mês" valor={fmtValor(pagoNoMes)} cor={COR.entradas} />
        </div>
      )}

      {semParcela.length > 0 && (
        <div className="faixa-aviso">
          <span>
            <b>{semParcela.length === 1 ? '1 dívida está' : `${semParcela.length} dívidas estão`} sem parcela.</b>{' '}
            Diga quanto você paga por mês para o app mostrar em que parcela está e quando você fica livre.
          </span>
          <button className="btn" onClick={() => editar(semParcela[0], true)}>Definir agora</button>
        </div>
      )}

      {!c.situacao.length ? (
        <Cartao>
          <Vazio>
            Nenhuma dívida por aqui. 🎉<br />
            Tem empréstimo, parcelamento ou conta em atraso? <button className="link" onClick={() => setEditando('nova')}>Adicione</button> e acompanhe até quitar.
          </Vazio>
        </Cartao>
      ) : (
        <div className="grade-cartoes">
          {abertas.map((s) => <CartaoDivida key={s.divida.id} s={s} c={c} aoEditar={(parcela) => editar(s, parcela)} />)}
        </div>
      )}

      {quitadas.length > 0 && (
        <>
          <h2 className="secao-titulo">Quitadas neste mês 🎉</h2>
          <div className="grade-cartoes">
            {quitadas.map((s) => <CartaoDivida key={s.divida.id} s={s} c={c} aoEditar={() => editar(s)} />)}
          </div>
        </>
      )}

      {editando && (
        <FormDivida
          ano={c.ano}
          mes={c.mes}
          situacao={editando === 'nova' ? undefined : editando}
          aoCriar={c.d.addDivida}
          aoEditar={c.d.updDivida}
          aoNovoSaldo={c.d.addSaldo}
          aoExcluir={c.d.delDivida}
          aoFechar={() => setEditando(null)}
          definirParcela={definirParcela}
        />
      )}
    </div>
  )
}

function CartaoDivida({ s, c, aoEditar }: { s: SituacaoDivida; c: Ctx; aoEditar: (definirParcela?: boolean) => void }) {
  const p = parcelasDe(s)
  const pagamentos = c.d.pagamentos
    .filter((x) => x.divida_id === s.divida.id && x.data)
    .sort((a, b) => b.data!.localeCompare(a.data!))
    .slice(0, 3)
  const quitada = s.quitadaNoMes

  return (
    <Cartao className={quitada ? 'quitada' : ''}>
      <div className="divida">
        <div className="divida-topo">
          <h3>{s.divida.descricao}</h3>
          <button className="link" onClick={() => aoEditar()}>Editar</button>
        </div>
        <div>
          <span className="divida-rotulo">{quitada ? 'Quitada' : 'Falta pagar'}</span>
          <strong className="divida-total">{quitada ? '✓' : fmtValor(s.restante)}</strong>
        </div>
        <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={COR.entradas} />
        {p ? (
          <div className="divida-parcelas">
            <span><b>{quitada ? `${p.total} de ${p.total} pagas` : `Parcela ${p.proxima} de ${p.total}`}</b> · {fmtValor(s.divida.valor_parcela!)} por mês</span>
            {!quitada && s.quitacao && (
              <span>{p.faltam === 1 ? 'Falta 1 parcela' : `Faltam ${p.faltam} parcelas`} · última em {fmtMesAno(s.quitacao[0], s.quitacao[1])}</span>
            )}
          </div>
        ) : !quitada && (
          <button className="divida-sem-parcela" onClick={() => aoEditar(true)}>
            <Icone nome="ideia" tamanho={16} /> Sem parcela definida. <b>Definir parcela</b>
          </button>
        )}
        {s.pagoNoMes > 0 && <p className="divida-previsao">Pago neste mês: <b>{fmtValor(s.pagoNoMes)}</b></p>}
        {pagamentos.length > 0 && (
          <ul className="divida-pagamentos">
            {pagamentos.map((x) => <li key={x.id}><span>{fmtDataCurta(x.data)}</span><span>− {fmtValor(x.valor)}</span></li>)}
          </ul>
        )}
        {!quitada && !p && (
          <button className="link divida-quitar" onClick={() => c.d.addSaldo(s.divida.id, dataPadrao(c.ano, c.mes), 0)}>Já paguei tudo? Marcar como quitada</button>
        )}
        {!quitada && (
          <button className="btn primario" onClick={() => c.pagarDivida(s)}>
            <Icone nome="check" tamanho={16} /> {p ? 'Pagar parcela' : 'Lançar pagamento'}
          </button>
        )}
      </div>
    </Cartao>
  )
}
