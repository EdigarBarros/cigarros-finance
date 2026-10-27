import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtValor, MESES_NOME } from '../lib/format'
import { TabelaAnual } from '../components/Blocos'
import { GraficoAnual, GraficoSaldo } from '../components/Graficos'
import { Cartao, Kpi } from '../components/ui'
import type { Ctx } from './contexto'

export function Ano(c: Ctx) {
  const meses = c.porMes.filter((r): r is Resumo => r !== null)
  const soma = (k: 'entradas' | 'saidas' | 'fluxo') => meses.reduce((a, r) => a + r[k], 0)
  const mediaGasto = meses.length ? soma('saidas') / meses.length : 0
  const melhor = c.porMes.reduce<number | null>((b, r, i) => (r && (b === null || r.fluxo > c.porMes[b]!.fluxo) ? i : b), null)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Resumo de {c.ano}</h1>
          <p className="sub">{meses.length} {meses.length === 1 ? 'mês' : 'meses'} com dados · toque num mês para abrir</p>
        </div>
      </header>

      <div className="kpis">
        <Kpi rotulo="Entradas no ano" valor={fmtValor(soma('entradas'))} cor={COR.entradas} />
        <Kpi rotulo="Saídas no ano" valor={fmtValor(soma('saidas'))} cor={COR.saidas} />
        <Kpi rotulo="Sobrou no ano" valor={fmtValor(soma('fluxo'))} cor={COR.caixa} />
        <Kpi rotulo="Gasto médio por mês" valor={fmtValor(mediaGasto)} cor={COR.divida}>
          {melhor !== null && <span className="kpi-delta">Melhor mês: {MESES_NOME[melhor]}</span>}
        </Kpi>
      </div>

      <Cartao titulo="Evolução no ano" acao={<span className="dica-cab">toque num mês para abrir</span>}>
        <GraficoAnual porMes={c.porMes} mesAtual={c.mes} altura={400} aoClicarMes={(m) => { c.irParaMes(m); c.irPara('inicio') }} v={c.v} />
      </Cartao>

      <Cartao titulo={`Resumo de ${c.ano}`}>
        <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={(m) => { c.irParaMes(m); c.irPara('inicio') }} v={c.v} />
      </Cartao>

      <Cartao titulo="Quanto sobrou em cada mês">
        <GraficoSaldo porMes={c.porMes} />
      </Cartao>
    </div>
  )
}
