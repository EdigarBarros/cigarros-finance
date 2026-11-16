import { useHoje } from '../lib/useHoje'
import { useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { useCoresDoGrafico } from '../lib/charts'
import { fmtValor, fmtMoeda, moedaAtual, MESES_CURTO, useValoresOcultos, fmtDataCurta } from '../lib/format'
import type { Ctx } from '../pages/contexto'
import type { DiaADia } from '../lib/previsao'
import { moedasDoAno } from './Graficos'
import { FormSaldoInicial } from './SaldoInicial'
import { Segmentado } from './ui'
import { tx } from '../lib/textos'

/** Apenas a Início detalhada: fluxos e posições nunca compartilham o mesmo gráfico. */
export function EvolucaoDetalhada({ c, dd }: { c: Ctx; dd: DiaADia }) {
  const cores = useCoresDoGrafico()
  const ocultos = useValoresOcultos()
  const [moeda, setMoeda] = useState(moedaAtual())
  const fora = moeda !== moedaAtual()
  const fmt = (n: number) => fora ? fmtMoeda(n, moeda) : fmtValor(n)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [visao, setVisao] = useState('movimento')
  const [modo, setModo] = useState('feito')
  const [janela, setJanela] = useState('6')
  const [escolha, setEscolha] = useState<{ ref: number; mes: number } | null>(null)
  const mes = escolha?.ref === c.mes ? escolha.mes : c.mes
  const [series, setSeries] = useState(['caixa', 'divida'])
  const n = Number(janela), inicio = Math.max(0, Math.min(c.mes - n, 12 - n))
  const indices = Array.from({ length: n }, (_, i) => inicio + i)
  const hoje = useHoje(), atual = hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const quando = (i: number) => !c.porMes[i] && !c.previsto[i]?.vaiEntrar && !c.previsto[i]?.vaiSair ? tx('Sem informação') : c.ano * 12 + i + 1 < atual ? tx('Concluído') : c.ano * 12 + i + 1 === atual ? tx('Atual · parcial') : tx('Projeção futura')
  const ref = (i: number) => c.ano * 12 + i + 1 === atual ? c.diaRef : `${c.ano}-${String(i + 1).padStart(2, '0')}-${new Date(c.ano, i + 1, 0).getDate()}`
  const p = (i: number) => i === c.mes - 1 ? dd : c.previsto[i]
  const movimento = (i: number, entrada: boolean) => {
    if (fora) { const r = c.porMes[i]; return r && c.ano*12+i+1 <= atual ? (entrada ? r.entradasMoeda[moeda] ?? 0 : r.saidasMoeda[moeda] ?? 0) : null }
    const x = p(i)
    if (!x || (!c.porMes[i] && !(modo === 'previsto' && (x.vaiEntrar || x.vaiSair)))) return null
    if (c.ano * 12 + i + 1 > atual && modo === 'feito') return null
    return entrada ? x.entrou + (modo === 'previsto' ? x.vaiEntrar : 0) : x.saiu + (modo === 'previsto' ? x.vaiSair : 0)
  }
  const posicao = (i: number, chave: 'caixa' | 'divida' | 'investimentos') => {
    const r = c.porMes[i]
    if (!r || c.ano * 12 + i + 1 > atual || (chave !== 'divida' && r.saldoDesconhecido)) return null
    if (chave === 'caixa' && !Object.keys(c.d.meses.find(m => m.ano === c.ano && m.mes === i + 1)?.caixa ?? {}).length && !r.caixa) return null
    if (chave === 'investimentos' && !r.investimentos && !c.d.meses.some(m => m.ano === c.ano && m.mes === i+1 && typeof m.investimentos === 'number')) return null
    if (fora) return chave === 'divida' ? r.dividaMoeda[moeda] ?? null : chave === 'caixa' ? r.moedas[moeda] ?? null : null
    return r[chave]
  }
  const opcoes = [
    { id: 'caixa' as const, nome: tx('Saldo nas contas'), cor: '#389ce8', ativo: c.v.bancos },
    { id: 'divida' as const, nome: tx('Saldo devedor'), cor: '#d89c21', ativo: c.v.dividas },
    { id: 'investimentos' as const, nome: tx('Investimentos'), cor: '#a76be8', ativo: c.v.investimentos },
  ].filter(x => x.ativo)
  const datasets = visao === 'movimento' ? [
    { label: tx('Entradas'), data: indices.map(i => movimento(i, true)), backgroundColor: '#0bb58b', borderRadius: 4 },
    { label: tx('Saídas'), data: indices.map(i => movimento(i, false)), backgroundColor: '#f0647c', borderRadius: 4 },
  ] : opcoes.filter(x => series.includes(x.id)).map(x => ({ label: x.nome, data: indices.map(i => posicao(i, x.id)), backgroundColor: x.cor, borderRadius: 4 }))
  const r = c.porMes[mes - 1]
  const desconhecido = tx('Não informado')
  const linha = (nome: string, valor: number | null | undefined) => <div className="det-linha" key={nome}><span>{nome}</span><b>{valor == null ? desconhecido : fmt(valor)}</b></div>
  const e = movimento(mes - 1, true), s = movimento(mes - 1, false)
  return <div className="det-evolucao">
    <Segmentado rotulo={tx('Visualização')} valor={visao} aoMudar={setVisao} opcoes={[{ id: 'movimento', nome: tx('Movimentação') }, { id: 'saldos', nome: tx('Saldos') }]} />
    <p className="det-nota">{visao === 'movimento' ? tx('Movimentações ocorrem durante o mês. Selecione um mês para investigar os valores.') : tx('Saldos são posições em uma data, não movimentações do mês. Saldos futuros não informados ficam em branco.')}</p>
    {moedasDoAno(c.porMes).length > 0 && <details><summary>{tx('Moeda')}</summary><select aria-label={tx('Ver o gráfico em')} value={moeda} onChange={e => { setMoeda(e.target.value); setModo('feito') }}>{[moedaAtual(), ...moedasDoAno(c.porMes)].map(m => <option key={m}>{m}</option>)}</select><p className="det-nota">{tx('Valores na moeda do registro, sem conversão.')}</p></details>}
    <div className="det-controles">
      {visao === 'movimento' && !fora && <Segmentado rotulo={tx('Valores do gráfico')} valor={modo} aoMudar={setModo} opcoes={[{ id: 'feito', nome: tx('Realizado') }, { id: 'previsto', nome: tx('Previsto') }]} />}
      <label>{tx('Período')} <select value={janela} onChange={e => setJanela(e.target.value)}>{['3','6','12'].map(x => <option key={x} value={x}>{tx('{0} meses', x)}</option>)}</select></label>
    </div>
    {visao === 'movimento' && <details className="det-nota"><summary>{tx('O que os valores incluem?')}</summary><p>{tx('Realizado inclui entradas e saídas reconhecidas. Previsto soma ao realizado os recebimentos e pagamentos pendentes; não é confirmação de pagamento. Compras em faturas abertas seguem a regra da previsão.')}</p></details>}
    {visao === 'saldos' && <div className="det-series">{opcoes.map(x => <label key={x.id}><input type="checkbox" checked={series.includes(x.id)} onChange={() => setSeries(xs => xs.includes(x.id) ? xs.filter(y => y !== x.id) : [...xs, x.id])} />{x.nome}</label>)}</div>}
    {ocultos ? <p className="det-grafico-privado">{tx('Gráfico oculto para preservar seus valores.')}</p> : <div className={`det-chart ${modo === 'previsto' && visao === 'movimento' ? 'projecao' : ''}`}><Bar data={{ labels: indices.map(i => MESES_CURTO[i]), datasets }} options={{ maintainAspectRatio: false, animation: false, onClick: (_, elementos) => { if (elementos[0]) setEscolha({ ref: c.mes, mes: indices[elementos[0].index] + 1 }) }, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { enabled: false }, legend: { labels: { color: cores.texto, boxWidth: 10, font: { size: 11 } } } }, scales: { x: { ticks: { color: cores.texto, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: cores.texto, maxTicksLimit: 4, callback: value => fmt(Number(value)), font: { size: 10 } }, grid: { color: cores.grade } } } }} /></div>}
    <label className="det-mes-selecionado">{tx('Detalhamento do mês')}<select value={mes} onChange={e => setEscolha({ ref: c.mes, mes: +e.target.value })}>{Array.from({length:12}, (_,i) => <option key={i} value={i+1}>{MESES_CURTO[i]} · {quando(i)}</option>)}</select></label>
    <div className="det-painel" aria-live="polite">
      <h3>{MESES_CURTO[mes - 1]} {c.ano} <small>{quando(mes - 1)}</small></h3>
      {linha(tx('Entradas'), e)}{linha(tx('Saídas'), s)}{linha(modo === 'previsto' ? tx('Resultado previsto') : tx('Resultado'), e == null || s == null ? null : e-s)}
      {opcoes.map(x => linha(x.nome, posicao(mes-1,x.id)))}
      <p className="det-nota">{tx('Referência dos saldos: {0}.', fmtDataCurta(ref(mes-1)))} {tx('Saldos bancários são os últimos informados; a data de atualização não está disponível.')}</p>
      {r && !fora && <details><summary>{tx('Composição das dívidas')}</summary>
        {linha(tx('Saldo inicial, sem juros estimados'), r.divida-r.dividaJuros-r.dividaNovas-r.dividaAumentos-r.dividaAjustes+r.dividaPagos)}
        {linha(tx('Novas dívidas'),r.dividaNovas)}{linha(tx('Valores adicionais emprestados'),r.dividaAumentos)}{linha(tx('Ajustes e juros confirmados'),r.dividaAjustes)}{linha(tx('Juros de atraso estimados'),r.dividaJuros)}{linha(tx('Pagamentos'),-r.dividaPagos)}{linha(tx('Saldo devedor'),r.divida)}
        <p className="det-nota">{tx('Juros estimados ainda precisam ser conferidos com o credor. Juros confirmados podem estar incorporados ao contrato ou aos ajustes.')}</p>
      </details>}
      <button className="link" onClick={() => { c.irParaMes(mes); c.setBusca(''); c.irPara('lancamentos') }}>{tx('Ver lançamentos')}</button>
    </div>
    <details><summary>{tx('Saldo de um mês para o outro')}</summary><p className="det-nota">{tx('Este saldo parte do valor inicial informado e acumula os resultados; pode diferir dos saldos bancários cadastrados.')}</p>{c.saldoCorrido.porMes[mes-1] && <>{linha(tx('Saldo inicial'), c.saldoCorrido.porMes[mes-1]!.inicio)}{linha(c.saldoCorrido.porMes[mes-1]!.quando === 'passado' ? tx('Saldo final') : tx('Saldo até hoje'),c.saldoCorrido.porMes[mes-1]!.quando === 'futuro' ? null : c.saldoCorrido.porMes[mes-1]!.fim)}</>}<button className="link" onClick={() => setEditandoSaldo(true)}>{tx('Mudar o ponto de partida')}</button></details>
    {editandoSaldo && <FormSaldoInicial inicial={c.saldoCorrido.inicial} mesSugerido={`${c.ano}-${String(mes).padStart(2,'0')}`} aoSalvar={c.saldoCorrido.salvar} aoFechar={() => setEditandoSaldo(false)} />}
    <details><summary>{tx('Consultar os números em lista')}</summary>{indices.map(i => <div className="det-lista-mes" key={i}><h4>{MESES_CURTO[i]} · {quando(i)}</h4>{visao === 'movimento' ? <>{linha(tx('Entradas'), movimento(i,true))}{linha(tx('Saídas'),movimento(i,false))}</> : opcoes.filter(x=>series.includes(x.id)).map(x=>linha(x.nome,posicao(i,x.id)))}</div>)}</details>
  </div>
}
