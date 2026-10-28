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
  const abrirMes = (m: number) => { c.irParaMes(m); c.irPara('inicio') }
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
        <Kpi rotulo="Entrou no ano" valor={fmtValor(soma('entradas'))} cor={COR.entradas} />
        <Kpi rotulo="Saiu no ano" valor={fmtValor(soma('saidas'))} cor={COR.saidas} />
        <Kpi rotulo="Sobrou no ano" valor={fmtValor(soma('fluxo'))} cor={COR.caixa} />
        <Kpi rotulo="Gasto médio por mês" valor={fmtValor(mediaGasto)} cor={COR.divida}>
          {melhor !== null && <span className="kpi-delta">Melhor mês: {MESES_NOME[melhor]}</span>}
        </Kpi>
      </div>

      <Cartao titulo="Mês a mês" acao={<span className="dica-cab so-desktop">toque na legenda para esconder ou mostrar uma série</span>}>
        <GraficoAnual porMes={c.porMes} mesAtual={c.mes} altura={c.mobile ? 320 : 420} compacto={c.mobile} v={c.v} />
      </Cartao>

      <Cartao titulo="Números de cada mês">
        <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={abrirMes} v={c.v} />
      </Cartao>

      <Cartao titulo="Quanto sobrou em cada mês">
        <GraficoSaldo porMes={c.porMes} mesAtual={c.mes} compacto={c.mobile} />
      </Cartao>
    </div>
  )
}
