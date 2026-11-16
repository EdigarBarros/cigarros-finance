import { useHoje } from '../lib/useHoje'
import { useState, type CSSProperties } from 'react'
import { fmtValor, fmtMoeda, moedaAtual, MESES_NOME, useValoresOcultos, LOCAL_DAS_DATAS } from '../lib/format'
import type { Ctx } from '../pages/contexto'
import type { DiaADia } from '../lib/previsao'
import type { ModoDoGrafico } from '../lib/modoDoGrafico'
import { GraficoEvolucao, moedasDoAno, type VisaoEvolucao } from './Graficos'
import { Icone } from './Icone'
import { Segmentado } from './ui'
import { tx } from '../lib/textos'

/**
 * Evolução financeira da Início detalhada: entradas e saídas (ou os saldos) dos últimos meses em barras, com a linha da dívida
 * passando entre elas no mesmo eixo, e embaixo o resumo do mês escolhido no gráfico.
 */
export function EvolucaoDetalhada({ c, dd }: { c: Ctx; dd: DiaADia }) {
  const ocultos = useValoresOcultos()
  const extras = moedasDoAno(c.porMes)
  const [moedaEscolhida, setMoeda] = useState(moedaAtual())
  const moeda = extras.includes(moedaEscolhida) ? moedaEscolhida : moedaAtual()
  const fora = moeda !== moedaAtual()
  const fmt = (n: number) => (fora ? fmtMoeda(n, moeda) : fmtValor(n))
  const [visao, setVisao] = useState<VisaoEvolucao>('movimento')
  const [modoEscolhido, setModo] = useState<ModoDoGrafico>('feito')
  const modo: ModoDoGrafico = fora ? 'feito' : modoEscolhido
  const [janela, setJanela] = useState('6')
  const [escolha, setEscolha] = useState<{ ref: number; mes: number } | null>(null)
  const n = Number(janela), inicio = Math.max(0, Math.min(c.mes - n, 12 - n))
  const indices = Array.from({ length: n }, (_, i) => inicio + i)
  const sel = escolha?.ref === c.mes && indices.includes(escolha.mes) ? escolha.mes : c.mes - 1
  const hoje = useHoje(), atual = hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const p = (i: number) => (i === c.mes - 1 ? dd : c.previsto[i])
  const movimento = (i: number, entrada: boolean) => {
    if (fora) { const r = c.porMes[i]; return r && c.ano * 12 + i + 1 <= atual ? (entrada ? r.entradasMoeda[moeda] ?? 0 : r.saidasMoeda[moeda] ?? 0) : null }
    const x = p(i)
    if (!x || (!c.porMes[i] && !(modo === 'previsto' && (x.vaiEntrar || x.vaiSair)))) return null
    if (c.ano * 12 + i + 1 > atual && modo === 'feito') return null
    return entrada ? x.entrou + (modo === 'previsto' ? x.vaiEntrar : 0) : x.saiu + (modo === 'previsto' ? x.vaiSair : 0)
  }
  const posicao = (i: number, chave: 'caixa' | 'divida') => {
    const r = c.porMes[i]
    if (!r || c.ano * 12 + i + 1 > atual || (chave === 'caixa' && r.saldoDesconhecido)) return null
    if (fora) return chave === 'divida' ? r.dividaMoeda[moeda] ?? null : r.moedas[moeda] ?? null
    return r[chave]
  }
  const e = movimento(sel, true), s = movimento(sel, false)
  const resultado = e == null || s == null ? null : e - s
  const caixa = c.v.bancos || fora ? posicao(sel, 'caixa') : undefined
  const divida = c.v.dividas || fora ? posicao(sel, 'divida') : undefined
  const valor = (x: number | null | undefined) => (x == null ? tx('Não informado') : fmt(x))
  const dataHoje = hoje.toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section id="det-evolucao" className="cartao dt-evolucao" tabIndex={-1}>
      <header className="dt-evo-cab">
        <div>
          <h2>{tx('Evolução financeira')}</h2>
          <p>{visao === 'movimento' ? tx('Entradas e saídas ao longo de {0}', c.ano) : tx('Saldos ao longo de {0}', c.ano)}</p>
        </div>
        <span className="dt-evo-data"><Icone nome="calendario" tamanho={15} />{dataHoje}</span>
      </header>
      <div className="dt-evo-controles">
        <Segmentado rotulo={tx('Visualização')} valor={visao} aoMudar={setVisao} opcoes={[{ id: 'movimento', nome: tx('Movimentação') }, { id: 'saldos', nome: tx('Saldos') }]} />
        {visao === 'movimento' && !fora && (
          <>
            <span className="dt-evo-sep" aria-hidden="true" />
            <Segmentado rotulo={tx('Valores do gráfico')} valor={modoEscolhido} aoMudar={setModo} opcoes={[{ id: 'feito', nome: tx('Realizado') }, { id: 'previsto', nome: tx('Previsto') }]} />
          </>
        )}
        <span className="dt-evo-espaco" />
        <label className="dt-evo-select">
          <span className="sr-only">{tx('Período')}</span>
          <select value={janela} onChange={(ev) => setJanela(ev.target.value)}>
            {['3', '6', '12'].map((x) => <option key={x} value={x}>{tx('Últimos {0} meses', x)}</option>)}
          </select>
          <Icone nome="abaixo" tamanho={14} />
        </label>
        {extras.length > 0 && (
          <>
            <span className="dt-evo-sep" aria-hidden="true" />
            <label className="dt-evo-select">
              <span className="dt-evo-select-rot">{tx('Moeda:')}</span>
              <select aria-label={tx('Ver o gráfico em')} value={moeda} onChange={(ev) => setMoeda(ev.target.value)}>
                {[moedaAtual(), ...extras].map((m) => <option key={m}>{m}</option>)}
              </select>
              <Icone nome="abaixo" tamanho={14} />
            </label>
          </>
        )}
      </div>
      <div className="cartao dt-evo-grafico">
        {ocultos
          ? <p className="det-grafico-privado">{tx('Gráfico oculto para preservar seus valores.')}</p>
          : <GraficoEvolucao porMes={c.porMes} previsto={c.previsto.map((x, i) => (i === c.mes - 1 ? { ...x, entrou: dd.entrou, saiu: dd.saiu, vaiEntrar: dd.vaiEntrar, vaiSair: dd.vaiSair } : x))} indices={indices} visao={visao} modo={modo}
              moeda={moeda} v={c.v} selecionado={sel} ultimoComSaldo={atual - c.ano * 12 - 1} aoEscolher={(mes) => setEscolha({ ref: c.mes, mes })} altura={c.mobile ? 240 : 280} />}
        {fora && <p className="det-nota">{tx('Valores na moeda do registro, sem conversão.')}</p>}
      </div>
      <div className="cartao dt-evo-resumo">
        <strong className="dt-evo-mes">{MESES_NOME[sel]} {c.ano}</strong>
        <div className="dt-evo-numeros">
          {([[tx('Entradas'), 'receber', 'var(--entrada)', e, undefined], [tx('Saídas'), 'enviar', 'var(--saida)', s, undefined],
            [modo === 'previsto' ? tx('Resultado previsto') : tx('Resultado'), 'ano', 'var(--entrada)', resultado, resultado == null ? undefined : resultado >= 0 ? 'var(--entrada)' : 'var(--saida)']] as const).map(([rot, ic, cor, v, corValor]) => (
            <div key={rot} className="dt-evo-num">
              <span className="dt-evo-rot"><span className="dt-tile mini" style={{ '--c': cor } as CSSProperties}><Icone nome={ic} tamanho={13} /></span>{rot}</span>
              <b style={corValor ? { color: corValor } : undefined}>{valor(v)}</b>
            </div>
          ))}
        </div>
        {(caixa !== undefined || divida !== undefined) && (
          <div className="dt-evo-saldos">
            {caixa !== undefined && (
              <div><span className="dt-tile mini" style={{ '--c': 'var(--texto-2)' } as CSSProperties}><Icone nome="carteira" tamanho={13} /></span><span><small>{tx('Saldo nas contas')}</small><b>{valor(caixa)}</b></span></div>
            )}
            {divida !== undefined && (
              <button type="button" onClick={() => c.irPara('dividas')}><span className="dt-tile mini" style={{ '--c': 'var(--divida)' } as CSSProperties}><Icone nome="camadas" tamanho={13} /></span><span><small>{tx('Saldo devedor')}</small><b>{valor(divida)}</b></span></button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
