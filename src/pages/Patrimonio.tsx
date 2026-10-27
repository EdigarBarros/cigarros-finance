import { somaCaixa } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES_NOME } from '../lib/format'
import { COR_BANCO, NOME_BANCO, NOME_TIPO_CAIXA } from '../lib/rotulos'
import { BANCOS, TIPOS_CAIXA } from '../lib/types'
import type { Banco, TipoCaixa } from '../lib/types'
import { Icone } from '../components/Icone'
import { CampoValor, Cartao, Kpi, Progresso } from '../components/ui'
import type { Ctx } from './contexto'

export function Patrimonio(c: Ctx) {
  const caixa = c.mesEf.caixa
  const herdado = c.mesEf.herdadoDe
  // Editar um campo grava o mês inteiro, partindo dos valores herdados.
  const salvarCaixa = (b: Banco, t: TipoCaixa, v: number) =>
    c.d.salvarMes(c.ano, c.mes, { caixa: { ...caixa, [b]: { ...caixa[b], [t]: v } }, usd: c.mesEf.usd })
  const confirmar = () => c.d.salvarMes(c.ano, c.mes, { caixa, usd: c.mesEf.usd })
  const porTipo = (t: TipoCaixa) => BANCOS.reduce((a, b) => a + (caixa[b]?.[t] ?? 0), 0)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Patrimônio</h1>
          <p className="sub">Quanto você tem guardado em {MESES_NOME[c.mes - 1].toLowerCase()}/{c.ano}</p>
        </div>
      </header>

      {herdado && (
        <div className="faixa-herdado">
          <span>
            Estes valores vêm de <b>{MESES_NOME[herdado[1] - 1].toLowerCase()}/{herdado[0]}</b>. Se nada mudou, confirme; se mudou, edite abaixo.
          </span>
          <button className="btn" onClick={confirmar}><Icone nome="check" tamanho={16} /> Continua igual</button>
        </div>
      )}

      <div className="kpis">
        <Kpi rotulo="Caixa total" valor={fmtBRL(somaCaixa(caixa))} cor={COR.caixa} delta={c.anterior?.caixa ? (c.r.caixa - c.anterior.caixa) / c.anterior.caixa : null} />
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
        <Cartao titulo={<><i className="marcador" style={{ background: COR.investimentos }} />Investimentos do mês</>}>
          <div className="campos">
            <CampoValor rotulo="Valor investido neste mês" valor={c.r.investimentos} aoSalvar={(investimentos) => c.d.salvarMes(c.ano, c.mes, { investimentos })} />
          </div>
          <p className="dica">Aceita contas, como na planilha: <code>=105,53-60,02</code></p>
        </Cartao>
        <Cartao titulo={<><i className="marcador" style={{ background: COR.usd }} />Dólar</>}>
          <div className="campos">
            <CampoValor rotulo="Guardado em dólar" prefixo="US$" valor={c.r.usd} aoSalvar={(usd) => c.d.salvarMes(c.ano, c.mes, { usd })} />
            <CampoValor rotulo="Meta (vale para os próximos meses)" prefixo="US$" valor={c.r.metaUsd} aoSalvar={(meta_usd) => c.d.salvarMes(c.ano, c.mes, { meta_usd })} />
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
