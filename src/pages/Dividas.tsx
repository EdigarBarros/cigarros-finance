import { useState } from 'react'
import { restantes, totalDivida } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL } from '../lib/format'
import type { Divida } from '../lib/types'
import { FormDivida } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

export function Dividas(c: Ctx) {
  const [editando, setEditando] = useState<Divida | 'nova' | null>(null)
  const abertas = c.dividasMes.filter((d) => restantes(d) > 0)
  const quitadas = c.dividasMes.filter((d) => restantes(d) <= 0)
  const mensal = abertas.reduce((a, d) => a + d.valor_mensal, 0)

  const salvar = (d: Omit<Divida, 'id'>, id?: string) => (id ? c.d.updDivida(id, d) : c.d.addDivida(d))

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Dívidas</h1>
          <p className="sub">Situação das dívidas neste mês</p>
        </div>
        <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> Nova dívida</button>
      </header>

      <div className="kpis">
        <Kpi rotulo="Total a pagar" valor={fmtBRL(c.r.divida)} cor={COR.divida} />
        <Kpi rotulo="Parcelas por mês" valor={fmtBRL(mensal)} cor={COR.saidas} />
        <Kpi rotulo="Pago em dívidas no mês" valor={fmtBRL(c.r.metricas.divida)} cor={COR.entradas} />
      </div>

      {!c.dividasMes.length ? (
        <Cartao>
          <Vazio>
            Nenhuma dívida cadastrada neste mês.<br />
            <button className="link" onClick={c.copiarMesAnterior}><Icone nome="copiar" tamanho={14} /> Trazer dívidas e caixa do mês anterior</button>
          </Vazio>
        </Cartao>
      ) : (
        <div className="grade-cartoes">
          {[...abertas, ...quitadas].map((d) => {
            const resta = restantes(d)
            return (
              <Cartao key={d.id} className={resta <= 0 ? 'quitada' : ''}>
                <div className="divida">
                  <div className="divida-topo">
                    <h3>{d.descricao}</h3>
                    <button className="link" onClick={() => setEditando(d)}>Editar</button>
                  </div>
                  <strong className="divida-total">{resta > 0 ? fmtBRL(totalDivida(d)) : 'Quitada ✓'}</strong>
                  <Progresso valor={d.pagas} total={d.parcelas} cor={resta > 0 ? COR.divida : COR.entradas} />
                  <div className="divida-info">
                    <span>{d.pagas} de {d.parcelas} parcelas</span>
                    <span>{fmtBRL(d.valor_mensal)}/mês</span>
                  </div>
                  {resta > 0 && (
                    <button className="btn" onClick={() => c.d.updDivida(d.id, { pagas: d.pagas + 1 })}>
                      <Icone nome="check" tamanho={16} /> Paguei uma parcela
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
          ordem={c.dividasMes.length}
          inicial={editando === 'nova' ? undefined : editando}
          aoSalvar={salvar}
          aoExcluir={c.d.delDivida}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
