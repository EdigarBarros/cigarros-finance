/**
 * Resumo do ano no celular: o topo desliza entre o que sobrou (ou faltou), o que entrou e o que saiu no ano. Ações: ano
 * anterior, próximo ano e voltar ao mês de hoje. Embaixo: os 12 meses (tocar abre o mês na Início), o melhor mês e o gasto
 * médio, o gráfico mês a mês (fora do simples) e quanto sobrou em cada mês (detalhado). Os números saem de `resumoDoAno`
 * (lib/calc.ts) e as peças de pages/Ano.tsx, os mesmos da tela do computador.
 */
import { GraficoAnual, GraficoSaldo } from '../../components/Graficos'
import { resumoDoAno } from '../../lib/calc'
import { fmtValor, MESES_NOME } from '../../lib/format'
import { tx } from '../../lib/textos'
import { useHoje } from '../../lib/useHoje'
import { MesesDoAno } from '../../pages/Ano'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CartaoWidget, HeroDeslizante, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

export function AnoMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const hoje = useHoje()
  const { meses, entradas, saidas, fluxo, mediaGasto, melhor } = resumoDoAno(c.porMes)
  const nivel = c.perfil.detalhe
  const abrirMes = (m: number) => { c.irParaMes(m); c.irPara('inicio') }
  const quantos = meses.length === 1 ? tx('1 mês com dados') : tx('{0} meses com dados', meses.length)

  const paginas: PaginaDoHero[] = [
    { id: 'sobrou', tom: fluxo < 0 ? 'falta' : 'sobra', rotulo: fluxo < 0 ? tx('Faltou em {0}', c.ano) : tx('Sobrou em {0}', c.ano), valor: fmtValor(Math.abs(fluxo)), sub: quantos },
    ...(meses.length ? [
      { id: 'entrou', tom: 'guardado' as const, rotulo: tx('Entrou no ano'), valor: fmtValor(entradas), sub: entradas > 0 ? tx('{0}% ficou com você', Math.round((Math.max(0, fluxo) / entradas) * 100)) : undefined },
      { id: 'saiu', tom: 'dividas' as const, rotulo: tx('Saiu no ano'), valor: fmtValor(saidas), sub: mediaGasto > 0 ? tx('Gasto médio de {0} por mês', fmtValor(mediaGasto)) : undefined },
    ] : []),
  ]
  const anoDeHoje = hoje.getFullYear()

  return (
    <div className="pagina ano-movel">
      <HeroDeslizante key={c.ano} paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={[
        { id: 'anterior', icone: 'esq', rotulo: String(c.ano - 1), acao: () => c.irParaAno(c.ano - 1) },
        { id: 'proximo', icone: 'dir', rotulo: String(c.ano + 1), acao: () => c.irParaAno(c.ano + 1) },
        { id: 'hoje', icone: 'calendario', rotulo: tx('Mês atual'), acao: () => { c.irParaAno(anoDeHoje); abrirMes(hoje.getMonth() + 1) } },
      ]} />

      <div className="widgets-movel">
        {!meses.length ? (
          <CartaoWidget titulo={tx('Seu ano vai se desenhar aqui')}>
            <p className="widget-nota">{tx('Assim que você lançar o que entrou e o que saiu, aparecem o total de cada mês, o gráfico mês a mês e quanto sobrou. Dá para começar agora ou trazer tudo do extrato do seu banco.')}</p>
            <button className="btn primario" onClick={() => c.novoLancamento('saida')}>{tx('Fazer o primeiro lançamento')}</button>
          </CartaoWidget>
        ) : (
          <>
            <CartaoWidget titulo={tx('Os meses de {0}', c.ano)}>
              <p className="widget-nota">{tx('Toque num mês para abrir.')}</p>
              <MesesDoAno c={c} aoAbrir={abrirMes} />
            </CartaoWidget>
            <div className="widgets-linha par">
              {melhor !== null && (
                <CartaoWidget className="widget-pequeno">
                  <button className="widget-pequeno-corpo" onClick={() => abrirMes(melhor + 1)}>
                    <span className="widget-titulo-solto">{tx('Melhor mês')}</span>
                    <b className="widget-numero">{MESES_NOME[melhor]}</b>
                    <span className="widget-nota">{tx('sobrou {0}', fmtValor(c.porMes[melhor]?.fluxo ?? 0))}</span>
                  </button>
                </CartaoWidget>
              )}
              <CartaoWidget className="widget-pequeno">
                <div className="widget-pequeno-corpo">
                  <span className="widget-titulo-solto">{tx('Gasto médio por mês')}</span>
                  <b className="widget-numero">{fmtValor(mediaGasto)}</b>
                </div>
              </CartaoWidget>
            </div>
            {nivel !== 'simples' && (
              <CartaoWidget titulo={tx('Mês a mês')}>
                <div className="pecas-do-computador">
                  <GraficoAnual porMes={c.porMes} previsto={c.previsto} mesAtual={c.mes} altura={300} compacto v={c.v} saldoCorrido={c.saldoCorrido} ano={c.ano} />
                </div>
              </CartaoWidget>
            )}
            {nivel === 'detalhado' && (
              <CartaoWidget titulo={tx('Quanto sobrou em cada mês')}>
                <div className="pecas-do-computador">
                  <GraficoSaldo porMes={c.porMes} mesAtual={c.mes} compacto saldos={c.saldoCorrido.porMes} />
                </div>
              </CartaoWidget>
            )}
          </>
        )}
      </div>
    </div>
  )
}
