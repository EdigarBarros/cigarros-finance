import type { Resumo } from '../lib/calc'
import { fmtValor, MESES_NOME } from '../lib/format'
import { TabelaAnual } from '../components/Blocos'
import { GraficoAnual, GraficoSaldo } from '../components/Graficos'
import { CenaAno } from '../components/Vazios'
import { Icone } from '../components/Icone'
import type { CSSProperties } from 'react'
import { Cartao } from '../components/ui'
import { AnelVivo, Vitrine } from '../components/Vitrine'
import { fmtCurto } from '../lib/visuais'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

export function Ano(c: Ctx) {
  const meses = c.porMes.filter((r): r is Resumo => r !== null)
  const soma = (k: 'entradas' | 'saidas' | 'fluxo') => meses.reduce((a, r) => a + r[k], 0)
  // A média só conta os meses em que saiu dinheiro: mês com caixa herdado ou dívida, sem lançamentos, não é um mês de gasto zero.
  const mesesComGasto = meses.filter((r) => r.saidas > 0).length
  const mediaGasto = mesesComGasto ? soma('saidas') / mesesComGasto : 0
  const abrirMes = (m: number) => { c.irParaMes(m); c.irPara('inicio') }
  const nivel = c.perfil.detalhe
  const melhor = c.porMes.reduce<number | null>((b, r, i) => (r && (r.entradas > 0 || r.saidas > 0) && (b === null || r.fluxo > c.porMes[b]!.fluxo) ? i : b), null)

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
      <Vitrine cor={soma('fluxo') < 0 ? 'var(--saida)' : 'var(--caixa)'} className="ano-vitrine"
        visual={
          <AnelVivo valor={soma('entradas') > 0 ? Math.max(0, soma('fluxo')) / soma('entradas') : 0} cor="var(--entrada)" cor2="var(--caixa)" tamanho={c.mobile ? 128 : 150}>
            <b>{soma('entradas') > 0 ? `${Math.round((Math.max(0, soma('fluxo')) / soma('entradas')) * 100)}%` : '—'}</b><small>{tx('do que entrou ficou')}</small>
          </AnelVivo>
        }
        rotulo={<><Icone nome="ano" tamanho={16} /> {soma('fluxo') < 0 ? tx('Faltou em {0}', c.ano) : tx('Sobrou em {0}', c.ano)}</>}
        valor={Math.abs(soma('fluxo'))} formato={fmtValor}
        pilulas={[
          { icone: 'receber', rotulo: tx('Entrou no ano'), valor: fmtValor(soma('entradas')), cor: 'var(--entrada)', tom: 'bom' },
          { icone: 'enviar', rotulo: tx('Saiu no ano'), valor: fmtValor(soma('saidas')), cor: 'var(--saida)' },
          ...(nivel !== 'simples' ? [{ icone: 'carteira', rotulo: tx('Gasto médio por mês'), valor: fmtValor(mediaGasto), cor: 'var(--divida)' }] : []),
          ...(melhor !== null ? [{ icone: 'estrela', rotulo: tx('Melhor mês'), valor: MESES_NOME[melhor], cor: 'var(--violeta)' }] : []),
        ]} />

      <MesesDoAno c={c} aoAbrir={abrirMes} />

      {nivel !== 'simples' && (
        <Cartao titulo={tx('Mês a mês')} acao={<span className="dica-cab so-desktop">{tx('toque na legenda para esconder ou mostrar uma série')}</span>}>
          <GraficoAnual porMes={c.porMes} previsto={c.previsto} mesAtual={c.mes} altura={c.mobile ? 320 : 420} compacto={c.mobile} v={c.v} saldoCorrido={c.saldoCorrido} ano={c.ano} />
        </Cartao>
      )}

      {nivel === 'detalhado' && (
        <Cartao titulo={tx('Números de cada mês')}>
          <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={abrirMes} v={c.v} />
        </Cartao>
      )}

      {nivel === 'detalhado' && (
        <Cartao titulo={tx('Quanto sobrou em cada mês')}>
          <GraficoSaldo porMes={c.porMes} mesAtual={c.mes} compacto={c.mobile} saldos={c.saldoCorrido.porMes} />
        </Cartao>
      )}
      </>)}
    </div>
  )
}

/**
 * O ano em 12 quadros: cada mês com o que sobrou (verde) ou faltou (vermelho), a cor mais forte quanto maior, e uma
 * barrinha do que saiu contra o que entrou. Tocar abre o mês na Início.
 */
function MesesDoAno({ c, aoAbrir }: { c: Ctx; aoAbrir: (m: number) => void }) {
  const maior = Math.max(1, ...c.porMes.map((r) => Math.abs(r?.fluxo ?? 0)))
  return (
    <section className="ano-meses" aria-label={tx('Os meses de {0}', c.ano)}>
      {c.porMes.map((r, i) => {
        const tem = Boolean(r && (r.entradas > 0 || r.saidas > 0))
        const fluxo = r?.fluxo ?? 0
        const forca = tem ? 0.08 + 0.3 * Math.min(1, Math.abs(fluxo) / maior) : 0
        const parte = r && r.entradas > 0 ? Math.min(1, r.saidas / r.entradas) : r && r.saidas > 0 ? 1 : 0
        return (
          <button key={i} className={`ano-mes ${tem ? (fluxo < 0 ? 'ruim' : 'bom') : 'vazio'} ${i + 1 === c.mes ? 'atual' : ''}`}
            style={{ '--f': forca, '--i': i, '--p': parte } as CSSProperties} onClick={() => aoAbrir(i + 1)} disabled={!tem}>
            <span className="ano-mes-nome">{MESES_NOME[i].slice(0, 3)}</span>
            <b>{tem ? `${fluxo < 0 ? '−' : '+'}${fmtCurto(Math.abs(fluxo))}` : '—'}</b>
            {tem && <span className="ano-mes-barra" aria-hidden="true"><i /></span>}
          </button>
        )
      })}
    </section>
  )
}
