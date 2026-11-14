/**
 * Peças da Início no jeito equilibrado: o meio-termo entre o simples (o mês em palavras) e o detalhado (gráfico e mosaico).
 * O mês num número grande com uma barra só, os próximos 7 dias, três resumos com anel e o essencial do resto
 * (veja docs/arquitetura-do-painel.md).
 */
import type { CSSProperties } from 'react'
import type { DiaADia } from '../lib/previsao'
import { fmtValor } from '../lib/format'
import { Anel } from './ui'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import type { SituacaoDoMes } from '../lib/situacaoDoMes'
import type { PilulaDeGastos } from '../lib/comparacao'
import './entender.css'
import './inicio-equilibrado.css'

/**
 * O mês: quanto sobrou (até hoje, no mês de hoje), a barra entrou × saiu, o estado do mês (a mesma conta do simples e do
 * detalhado), a comparação dos gastos com o mesmo período do mês anterior e como o mês deve terminar.
 */
export function MesEquilibrado({ dd, nomeMes, gastos, situacao, aoEntender }: {
  dd: DiaADia; nomeMes: string
  /** Gastos contra o mesmo período do mês anterior (null sem com o que comparar). */
  gastos: PilulaDeGastos | null
  situacao: SituacaoDoMes
  /** Abre o "Entender previsão". */
  aoEntender: () => void
}) {
  const futuro = dd.hoje === 0
  const acabou = dd.hoje === dd.dias
  const ateHoje = dd.entrou - dd.saiu
  const fim = ateHoje + dd.vaiEntrar - dd.vaiSair
  const valor = futuro ? fim : ateHoje
  const positivo = valor >= 0
  const rotulo = futuro ? tx('Previsto para {0}', nomeMes)
    : acabou ? (positivo ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes))
    : (positivo ? tx('Sobrou até hoje') : tx('Faltou até hoje'))
  const entrou = futuro ? dd.vaiEntrar : dd.entrou
  const saiu = futuro ? dd.vaiSair : dd.saiu
  const topo = Math.max(entrou, saiu) || 1
  const temPrevisao = !futuro && !acabou && (dd.vaiEntrar > 0 || dd.vaiSair > 0)
  const comSelo = situacao.estado !== 'sem_dados'
  return (
    <section className="cartao ieq-mes">
      <span className="ieq-rot">{rotulo}</span>
      <strong className={`ieq-grande ${positivo ? 'bom' : 'ruim'}`}>{positivo ? '' : '− '}{fmtValor(Math.abs(valor))}</strong>
      {/* com entrou e saiu zerados (no começo do mês), as barras vazias não dizem nada */}
      {(entrou > 0 || saiu > 0) && (
        <>
          <div className="ieq-barras" role="img" aria-label={tx('Entrou {0} e saiu {1}', fmtValor(entrou), fmtValor(saiu))}>
            <span className="ieq-linha"><i className="entrou" style={{ width: `${(entrou / topo) * 100}%` }} /></span>
            <span className="ieq-linha"><i className="saiu" style={{ width: `${(saiu / topo) * 100}%` }} /></span>
          </div>
          <div className="ieq-lados">
            <span>{futuro ? tx('Vai entrar') : tx('Entrou')} <b className="bom">{fmtValor(entrou)}</b></span>
            <span>{futuro ? tx('Vai sair') : tx('Saiu')} <b className="ruim">{fmtValor(saiu)}</b></span>
          </div>
        </>
      )}
      {(comSelo || gastos) && (
        <div className="ieq-pilulas">
          {comSelo && (
            <button type="button" className={`selo-mes ${situacao.estado}`} onClick={aoEntender} title={tx('Por que este estado?')}>
              <i aria-hidden="true" />{situacao.selo}
            </button>
          )}
          {gastos && <span className={`ieq-pilula ${gastos.tom}`}><i aria-hidden="true" />{gastos.texto}</span>}
        </div>
      )}
      {temPrevisao && (
        <div className="ieq-fim">
          <span className="ieq-rot">{tx('Até o fim do mês')}</span>
          {dd.vaiSair > 0 && <p><span>{tx('Ainda falta pagar')}</span><b>{fmtValor(dd.vaiSair)}</b></p>}
          {dd.vaiEntrar > 0 && <p><span>{tx('Ainda falta receber')}</span><b className="bom">{fmtValor(dd.vaiEntrar)}</b></p>}
          <p className="ieq-fim-total"><span>{fim < 0 ? tx('Deve faltar') : tx('Deve sobrar')}</span><b className={fim < 0 ? 'ruim' : 'bom'}>{fim < 0 ? '− ' : ''}{fmtValor(Math.abs(fim))}</b></p>
          <button type="button" className="btn-entender" onClick={aoEntender}><Icone nome="ideia" tamanho={15} /> {tx('Entender previsão')}</button>
        </div>
      )}
    </section>
  )
}

export interface ResumoAnel {
  chave: string
  rotulo: string
  valor: string
  sub?: string
  cor: string
  /** 0 a 1: vira o anel; sem ele, o anel mostra o ícone. */
  progresso?: number
  icone: string
  aoAbrir: () => void
}

/** Até três resumos (dívidas, metas, guardado): um anel, um número e uma frase curta. Tocar leva para a página. */
export function ResumosComAnel({ itens }: { itens: ResumoAnel[] }) {
  if (!itens.length) return null
  return (
    <div className="ieq-resumos" style={{ '--n': itens.length } as CSSProperties}>
      {itens.map((x) => (
        <button key={x.chave} type="button" className="cartao ieq-resumo" onClick={x.aoAbrir}>
          {x.progresso !== undefined
            ? <Anel valor={x.progresso} cor={x.cor} tamanho={52}><small className="ieq-anel-pct">{Math.round(x.progresso * 100)}%</small></Anel>
            : <span className="ieq-icone" style={{ '--c': x.cor } as CSSProperties}><Icone nome={x.icone} tamanho={22} /></span>}
          <span className="ieq-resumo-texto">
            <span className="ieq-rot">{x.rotulo}</span>
            <strong>{x.valor}</strong>
            {x.sub && <small>{x.sub}</small>}
          </span>
          <Icone nome="dir" tamanho={16} />
        </button>
      ))}
    </div>
  )
}
