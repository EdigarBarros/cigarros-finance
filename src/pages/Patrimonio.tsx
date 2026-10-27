import { totalCaixa } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD } from '../lib/format'
import { COR_BANCO, NOME_BANCO, NOME_TIPO_CAIXA } from '../lib/rotulos'
import { BANCOS, TIPOS_CAIXA } from '../lib/types'
import type { Banco, TipoCaixa } from '../lib/types'
import { Icone } from '../components/Icone'
import { CampoValor, Cartao, Kpi, Progresso } from '../components/ui'
import type { Ctx } from './contexto'

export function Patrimonio(c: Ctx) {
  const caixa = c.metaMes?.caixa ?? {}
  const salvarCaixa = (b: Banco, t: TipoCaixa, v: number) =>
    c.d.salvarMes(c.mes, { caixa: { ...caixa, [b]: { ...caixa[b], [t]: v } } })
  const porTipo = (t: TipoCaixa) => BANCOS.reduce((a, b) => a + (caixa[b]?.[t] ?? 0), 0)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Patrimônio</h1>
          <p className="sub">Quanto você tem guardado no fim do mês</p>
        </div>
        {!totalCaixa(c.metaMes) && (
          <button className="btn" onClick={c.copiarMesAnterior}><Icone nome="copiar" tamanho={16} /> Copiar do mês anterior</button>
        )}
      </header>

      <div className="kpis">
        <Kpi rotulo="Caixa total" valor={fmtBRL(c.r.caixa)} cor={COR.caixa} />
        <Kpi rotulo="Conta corrente" valor={fmtBRL(porTipo('cc'))} cor={COR.caixa} />
        <Kpi rotulo="Caixinhas" valor={fmtBRL(porTipo('caixinha'))} cor={COR.caixa} />
        <Kpi rotulo="Reserva de emergência" valor={fmtBRL(porTipo('reserva'))} cor={COR.caixa} />
      </div>

      <div className="grade-cartoes">
        {BANCOS.map((b) => {
          const total = TIPOS_CAIXA.reduce((a, t) => a + (caixa[b]?.[t] ?? 0), 0)
          return (
            <Cartao key={b} className="banco" titulo={<><i className="marcador" style={{ background: COR_BANCO[b] }} />{NOME_BANCO[b]}</>}
              acao={<strong>{fmtBRL(total)}</strong>}>
              <div className="campos">
                {TIPOS_CAIXA.map((t) => (
                  <CampoValor key={t} rotulo={NOME_TIPO_CAIXA[t]} valor={caixa[b]?.[t] ?? 0} aoSalvar={(v) => salvarCaixa(b, t, v)} />
                ))}
              </div>
            </Cartao>
          )
        })}
      </div>

      <div className="grade-cartoes">
        <Cartao titulo={<><i className="marcador" style={{ background: COR.investimentos }} />Investimentos</>}>
          <div className="campos">
            <CampoValor rotulo="Valor investido no mês" valor={c.r.investimentos} aoSalvar={(investimentos) => c.d.salvarMes(c.mes, { investimentos })} />
          </div>
          <p className="dica">Aceita contas, como na planilha: <code>=105,53-60,02</code></p>
        </Cartao>
        <Cartao titulo={<><i className="marcador" style={{ background: COR.usd }} />Dólar</>}>
          <div className="campos">
            <CampoValor rotulo="Guardado em dólar" prefixo="US$" valor={c.r.usd} aoSalvar={(usd) => c.d.salvarMes(c.mes, { usd })} />
            <CampoValor rotulo="Meta" prefixo="US$" valor={c.r.metaUsd} aoSalvar={(meta_usd) => c.d.salvarMes(c.mes, { meta_usd })} />
          </div>
          {c.r.metaUsd > 0 && (
            <div className="meta">
              <Progresso valor={c.r.usd} total={c.r.metaUsd} cor={COR.usd} />
              <p className="barras-sub">
                {c.r.usd >= c.r.metaUsd ? 'Meta batida! 🎉' : `Faltam ${fmtUSD(c.r.metaUsd - c.r.usd)} · ${Math.round((c.r.usd / c.r.metaUsd) * 100)}% concluído`}
              </p>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  )
}
