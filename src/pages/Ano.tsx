import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtValor, MESES_NOME } from '../lib/format'
import { TabelaAnual } from '../components/Blocos'
import { GraficoAnual, GraficoSaldo } from '../components/Graficos'
import { CenaAno } from '../components/Vazios'
import { Icone } from '../components/Icone'
import { Cartao, Kpi } from '../components/ui'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

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
          <h1>{tx('Resumo de {0}', c.ano)}</h1>
          <p className="sub">{meses.length} {meses.length === 1 ? tx('mês') : tx('meses')} {tx('com dados · toque num mês para abrir')}</p>
        </div>
      </header>

      {!meses.length ? (
        <section className="cartao vz-vazio">
          <CenaAno />
          <h2>{tx('Seu ano vai se desenhar aqui')}</h2>
          <p>{tx('Assim que você lançar o que entrou e o que saiu, aparecem o total de cada mês, o gráfico mês a mês e quanto sobrou. Dá para começar agora ou trazer tudo do extrato do seu banco.')}</p>
          <div className="vz-vazio-acoes">
            <button className="btn primario" onClick={() => c.novoLancamento('saida')}><Icone nome="mais" tamanho={16} /> {tx('Fazer o primeiro lançamento')}</button>
            <button className="btn" onClick={c.importarExtrato}><Icone nome="relatorio" tamanho={16} /> {tx('Importar extrato')}</button>
          </div>
        </section>
      ) : (<>
      <div className="kpis">
        <Kpi rotulo={tx('Entrou no ano')} valor={fmtValor(soma('entradas'))} cor={COR.entradas} />
        <Kpi rotulo={tx('Saiu no ano')} valor={fmtValor(soma('saidas'))} cor={COR.saidas} />
        <Kpi rotulo={tx('Sobrou no ano')} valor={fmtValor(soma('fluxo'))} cor={COR.caixa} />
        <Kpi rotulo={tx('Gasto médio por mês')} valor={fmtValor(mediaGasto)} cor={COR.divida}>
          {melhor !== null && <span className="kpi-delta">{tx('Melhor mês: {0}', MESES_NOME[melhor])}</span>}
        </Kpi>
      </div>

      <Cartao titulo={tx('Mês a mês')} acao={<span className="dica-cab so-desktop">{tx('toque na legenda para esconder ou mostrar uma série')}</span>}>
        <GraficoAnual porMes={c.porMes} mesAtual={c.mes} altura={c.mobile ? 320 : 420} compacto={c.mobile} v={c.v} />
      </Cartao>

      <Cartao titulo={tx('Números de cada mês')}>
        <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={abrirMes} v={c.v} />
      </Cartao>

      <Cartao titulo={tx('Quanto sobrou em cada mês')}>
        <GraficoSaldo porMes={c.porMes} mesAtual={c.mes} compacto={c.mobile} />
      </Cartao>
      </>)}
    </div>
  )
}
