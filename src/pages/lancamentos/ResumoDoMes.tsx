/**
 * O resumo do topo de Lançamentos (redesenhado em 18/11/2026, pedido do dono: mais visual, menos texto), com os mesmos
 * números dos filtros da tela:
 * - o que sobrou (ou faltou) no mês, grande, e quanto do que entrou já saiu;
 * - a balança: Entrou e Saiu em barras na mesma escala (a diferença é o que sobrou ou faltou, marcada na ponta);
 * - o mês dia a dia: o resultado acumulado de cada dia, verde acima do zero e coral abaixo, com o dia de hoje marcado.
 */
import { useId, type CSSProperties } from 'react'
import { Icone } from '../../components/Icone'
import { Numero } from '../../components/Numero'
import { fmtValor, MESES_NOME, noMeioDaFrase } from '../../lib/format'
import { ehGuardado } from '../../lib/guardado'
import { tx } from '../../lib/textos'
import type { Lancamento } from '../../lib/types'
import './resumo.css'

export function ResumoDoMes({ lancs, entrou, saiu, ano, mes, hoje, quantos }: {
  /** Os lançamentos da tela, já com os filtros. */
  lancs: Lancamento[]
  entrou: number
  saiu: number
  ano: number
  mes: number
  /** 'AAAA-MM-DD' */
  hoje: string
  /** Quantos lançamentos (só no detalhado). */
  quantos?: number
}) {
  const resultado = entrou - saiu
  const falta = resultado < 0
  const nomeMes = noMeioDaFrase(MESES_NOME[mes - 1])
  const parte = entrou > 0 ? saiu / entrou : saiu > 0 ? 1 : 0
  const escala = Math.max(entrou, saiu, 1)
  return (
    <div className="rm-caixa">
    <section className={`cartao rm ${falta ? 'falta' : 'sobra'}`} aria-label={tx('Resumo')}>
      <div className="rm-numero">
        <span className="rm-rotulo"><Icone nome={falta ? 'desce' : 'sobe'} tamanho={16} /> {falta ? tx('Faltou em {0}', nomeMes) : tx('Sobrou em {0}', nomeMes)}</span>
        <strong className="rm-valor"><Numero valor={Math.abs(resultado)} formato={fmtValor} /></strong>
        <div className="rm-fichas">
          {entrou > 0 && (
            <span className="rm-ficha" style={{ '--c': parte >= 1 ? 'var(--saida)' : parte >= 0.85 ? 'var(--divida)' : 'var(--entrada)' } as CSSProperties}>
              <i aria-hidden="true" style={{ '--p': Math.min(1, parte) } as CSSProperties} />
              <b>{Math.round(parte * 100)}%</b> {tx('do que entrou saiu')}
            </span>
          )}
          {quantos !== undefined && (
            <span className="rm-ficha neutra"><Icone nome="lista" tamanho={14} /> {quantos === 1 ? tx('1 lançamento') : tx('{0} lançamentos', quantos)}</span>
          )}
        </div>
      </div>

      <div className="rm-balanca" aria-label={tx('Entrou {0} e saiu {1}', fmtValor(entrou), fmtValor(saiu))}>
        <Barra rotulo={tx('Entrou')} valor={entrou} escala={escala} cor="var(--entrada)" icone="receber"
          sobra={!falta && resultado > 0 ? resultado / escala : 0} />
        <Barra rotulo={tx('Saiu')} valor={saiu} escala={escala} cor="var(--saida)" icone="enviar"
          sobra={falta ? -resultado / escala : 0} />
      </div>

      <DiaADia lancs={lancs} ano={ano} mes={mes} hoje={hoje} />
    </section>
    </div>
  )
}

/** Uma barra da balança. `sobra`: a ponta que passa da outra barra (o que sobrou, na de Entrou; o que faltou, na de Saiu). */
function Barra({ rotulo, valor, escala, cor, icone, sobra }: { rotulo: string; valor: number; escala: number; cor: string; icone: string; sobra: number }) {
  return (
    <div className="rm-barra" style={{ '--c': cor, '--p': valor / escala, '--s': sobra } as CSSProperties}>
      <span className="rm-barra-ic" aria-hidden="true"><Icone nome={icone} tamanho={15} /></span>
      <span className="rm-barra-rotulo">{rotulo}</span>
      <b className="rm-barra-valor">{fmtValor(valor)}</b>
      <span className="rm-trilho" aria-hidden="true"><i><em /></i></span>
    </div>
  )
}

/** O resultado acumulado do mês, dia a dia: sobe com o que entra, desce com o que sai. */
function DiaADia({ lancs, ano, mes, hoje }: { lancs: Lancamento[]; ano: number; mes: number; hoje: string }) {
  const id = useId().replace(/:/g, '')
  const dias = new Date(ano, mes, 0).getDate()
  const porDia = new Array<number>(dias).fill(0)
  let ultimo = 0
  for (const l of lancs) {
    if (!l.data || ehGuardado(l)) continue
    const [a, m, d] = l.data.split('-').map(Number)
    if (a !== ano || m !== mes || !d) continue
    porDia[d - 1] += l.tipo === 'entrada' ? l.valor : -l.valor
    ultimo = Math.max(ultimo, d)
  }
  const [ha, hm, hd] = hoje.split('-').map(Number)
  const diaDeHoje = ha === ano && hm === mes ? hd : null
  // até hoje no mês corrente (ou até o último lançamento com data à frente); o mês inteiro nos outros
  const ate = diaDeHoje ? Math.max(diaDeHoje, ultimo) : dias
  const acum: number[] = []
  let t = 0
  for (let i = 0; i < ate; i++) { t += porDia[i]; acum.push(t) }
  if (acum.length < 2) return null
  const max = Math.max(0, ...acum), min = Math.min(0, ...acum)
  const W = 300, H = 110, pad = 6
  const x = (i: number) => (i / (dias - 1)) * W
  const y = (v: number) => pad + ((max - v) / (max - min || 1)) * (H - pad * 2)
  const linha = acum.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = `${linha}L${x(acum.length - 1).toFixed(1)},${y(0).toFixed(1)}L0,${y(0).toFixed(1)}Z`
  const zero = y(0)
  const iFim = acum.length - 1
  return (
    <figure className="rm-dias">
      <figcaption>{tx('Dia a dia')}</figcaption>
      <div className="rm-grafico">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={tx('Resultado acumulado do mês, dia a dia')}>
        <defs>
          <clipPath id={`${id}-cima`}><rect x={0} y={0} width={W} height={zero + 1.5} /></clipPath>
          <clipPath id={`${id}-baixo`}><rect x={0} y={zero + 1.5} width={W} height={H - zero} /></clipPath>
          <linearGradient id={`${id}-gc`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--entrada)" stopOpacity=".42" /><stop offset="1" stopColor="var(--entrada)" stopOpacity=".04" /></linearGradient>
          <linearGradient id={`${id}-gb`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="var(--saida)" stopOpacity=".42" /><stop offset="1" stopColor="var(--saida)" stopOpacity=".04" /></linearGradient>
        </defs>
        <line className="rm-zero" x1={0} x2={W} y1={zero} y2={zero} />
        <path d={area} fill={`url(#${id}-gc)`} clipPath={`url(#${id}-cima)`} />
        <path d={area} fill={`url(#${id}-gb)`} clipPath={`url(#${id}-baixo)`} />
        <path className="rm-linha cima" d={linha} clipPath={`url(#${id}-cima)`} />
        <path className="rm-linha baixo" d={linha} clipPath={`url(#${id}-baixo)`} />
        {diaDeHoje && diaDeHoje <= dias && <line className="rm-hoje" x1={x(diaDeHoje - 1)} x2={x(diaDeHoje - 1)} y1={0} y2={H} />}
      </svg>
      {/* o ponto do último dia fica fora do SVG esticado, para não virar elipse */}
      <span className={`rm-ponto ${acum[iFim] < 0 ? 'baixo' : ''}`} style={{ left: `${(x(iFim) / W) * 100}%`, top: `${(y(acum[iFim]) / H) * 100}%` } as CSSProperties} aria-hidden="true" />
      </div>
      <div className="rm-dias-eixo" aria-hidden="true">
        <span>1</span>
        {diaDeHoje && diaDeHoje > 3 && diaDeHoje < dias - 3 && <span className="rm-dias-hoje" style={{ left: `${(x(diaDeHoje - 1) / W) * 100}%` }}>{tx('hoje')}</span>}
        <span>{dias}</span>
      </div>
    </figure>
  )
}
