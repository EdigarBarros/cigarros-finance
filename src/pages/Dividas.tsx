import { useState } from 'react'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtValor, fmtDataCurta, MESES_CURTO, MESES_NOME } from '../lib/format'
import { FormDivida } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

export function Dividas(c: Ctx) {
  const [editando, setEditando] = useState<SituacaoDivida | 'nova' | null>(null)
  const pagoNoMes = c.situacao.reduce((a, s) => a + s.pagoNoMes, 0)
  // Só dá para prever o fim se toda dívida em aberto tiver parcela definida.
  const semParcela = c.situacao.some((s) => s.restante > 0 && !s.quitacao)
  const ultimaQuitacao = semParcela ? undefined : c.situacao
    .map((s) => s.quitacao)
    .filter((q): q is [number, number] => q !== null)
    .sort((a, b) => b[0] * 12 + b[1] - (a[0] * 12 + a[1]))[0]

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Dívidas</h1>
          <p className="sub">Saldos em {MESES_NOME[c.mes - 1].toLowerCase()} de {c.ano}. Cada pagamento lançado abate sozinho.</p>
        </div>
        <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> Adicionar dívida</button>
      </header>

      <div className="kpis">
        <Kpi rotulo="Você deve no total" valor={fmtValor(c.r.divida)} cor={COR.divida} delta={c.anterior ? (c.anterior.divida ? (c.r.divida - c.anterior.divida) / c.anterior.divida : null) : null} menorMelhor contra={c.mes > 1 ? `em ${MESES_CURTO[c.mes - 2].toLowerCase()}` : undefined} />
        <Kpi rotulo="Pago neste mês" valor={fmtValor(pagoNoMes)} cor={COR.entradas} />
        <Kpi rotulo="Parcelas por mês" valor={fmtValor(c.r.parcelasMensais)} cor={COR.saidas} />
        <Kpi rotulo="Sem dívidas em" valor={ultimaQuitacao ? `${MESES_NOME[ultimaQuitacao[1] - 1].toLowerCase()} de ${ultimaQuitacao[0]}` : c.r.divida > 0 ? 'Defina as parcelas' : 'Já está! 🎉'} cor={COR.caixa} />
      </div>

      {!c.situacao.length ? (
        <Cartao><Vazio>Nenhuma dívida em aberto neste mês. 🎉</Vazio></Cartao>
      ) : (
        <div className="grade-cartoes">
          {c.situacao.map((s) => {
            const pagamentos = c.d.pagamentos
              .filter((p) => p.divida_id === s.divida.id && p.data)
              .sort((a, b) => b.data!.localeCompare(a.data!))
              .slice(0, 4)
            return (
              <Cartao key={s.divida.id} className={s.quitadaNoMes ? 'quitada' : ''}>
                <div className="divida">
                  <div className="divida-topo">
                    <h3>{s.divida.descricao}</h3>
                    <button className="link" onClick={() => setEditando(s)}>Editar</button>
                  </div>
                  <strong className="divida-total">{s.quitadaNoMes ? 'Quitada ✓' : fmtValor(s.restante)}</strong>
                  <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={s.quitadaNoMes ? COR.entradas : COR.divida} />
                  <div className="divida-info">
                    <span>{Math.round(((s.saldoInicial - s.restante) / (s.saldoInicial || 1)) * 100)}% pago de {fmtValor(s.saldoInicial)}</span>
                    {s.divida.valor_parcela ? <span>{fmtValor(s.divida.valor_parcela)}/mês</span> : null}
                  </div>
                  {s.quitacao && (
                    <p className="divida-previsao">
                      Acaba em <b>{MESES_NOME[s.quitacao[1] - 1].toLowerCase()} de {s.quitacao[0]}</b> ({s.mesesRestantes} {s.mesesRestantes === 1 ? 'parcela' : 'parcelas'})
                    </p>
                  )}
                  {pagamentos.length > 0 && (
                    <ul className="divida-pagamentos">
                      {pagamentos.map((p) => <li key={p.id}><span>{fmtDataCurta(p.data)}</span><span>− {fmtValor(p.valor)}</span></li>)}
                    </ul>
                  )}
                  {!s.quitadaNoMes && (
                    <button className="btn" onClick={() => c.pagarDivida(s)}>
                      <Icone nome="check" tamanho={16} /> Lançar pagamento
                    </button>
                  )}
                </div>
              </Cartao>
            )
          })}
        </div>
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
        />
      )}
    </div>
  )
}
