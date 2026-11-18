/**
 * Início do computador e do tablet deitado (≥ 861 px), no desenho do celular (docs/arquitetura-do-painel.md, 4.0):
 * - a faixa do topo, colorida pelo estado do mês (verde-água quando sobra, coral quando falta): o número grande do mês com a
 *   previsão e "Entender a conta" à esquerda, os outros resumos (guardado, dívidas, investimentos) lado a lado à direita
 *   e as ações redondas embaixo; no celular essas mesmas páginas deslizam (src/movel/resumosDaInicio.ts);
 * - as dicas (convite para importar, sugestão do momento);
 * - os cartões do jeito escolhido (lib/widgets.ts), numa grade de 12 colunas, com a mesma arrumação do celular.
 * A conta nova continua na boas-vindas de pages/Inicio.tsx.
 */
import { useState, type PointerEvent } from 'react'
import { EntenderMes } from './EntenderMes'
import { FormBaixa } from './FormBaixa'
import { Icone } from './Icone'
import { PilulaDoJeito } from './InicioEquilibrado'
import type { SituacaoConta } from '../lib/contasFixas'
import { fmtValor, LOCAL_DAS_DATAS } from '../lib/format'
import { Numero } from './Numero'
import type { Tarefa } from '../lib/paraFazer'
import { tx } from '../lib/textos'
import { useMesDaInicio } from '../lib/useMesDaInicio'
import type { Ctx } from '../pages/contexto'
import { GradeDeCartoes } from '../movel/GradeDeCartoes'
import { CarrosselDeDicas } from '../movel/primitivas'
import { acoesDaInicio, dicasDaInicio, resumosDaInicio } from '../movel/resumosDaInicio'
import type { Contexto } from '../movel/widgets'
import './inicio-pc.css'

export function InicioPC({ c }: { c: Ctx }) {
  const m = useMesDaInicio(c)
  const [entender, setEntender] = useState(false)
  const [conferir, setConferir] = useState<SituacaoConta | null>(null)
  const { ddMes, composicao, situacao, nomeMes, hoje } = m

  const [principal, ...outros] = resumosDaInicio(c, m, () => setEntender(true))
  // no computador cabem todas: sem o "Mais" (que só existe sem o módulo de cartões), importar fica à vista
  const acoes = acoesDaInicio(c, () => {}).filter((a) => a.id !== 'mais')
  if (!acoes.some((a) => a.id === 'importar')) acoes.push({ id: 'importar', icone: 'relatorio', rotulo: tx('Importar'), acao: c.importarExtrato })
  const dicas = dicasDaInicio(c)

  // conta do mês clicada: abre a conferência (nunca dá baixa direto)
  const agir = (t: Tarefa) => {
    if (t.origem === 'conta' && t.conta) setConferir(t.conta)
    else t.botao.acao()
  }
  const x: Contexto = { c, m, agir, computador: true }
  const nomeDoCartao = (id?: string) => c.cartoes.cartoes.find((k) => k.id === id)?.nome ?? ''
  const hojePorExtenso = hoje.toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })
  // o número conta até o valor ao abrir e ao trocar de mês (o mesmo Numero do resto do app)
  const valor = (p: { valor: string; numero?: number }) => (p.numero === undefined ? p.valor : <Numero valor={p.numero} formato={fmtValor} />)

  // a luz que segue o mouse: a posição vai direto no estilo do cartão (sem redesenhar a tela a cada movimento)
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('.widget, .faixa-pc, .faixa-pc-resumo')
    if (!alvo) return
    const b = alvo.getBoundingClientRect()
    alvo.style.setProperty('--mx', `${e.clientX - b.left}px`)
    alvo.style.setProperty('--my', `${e.clientY - b.top}px`)
    // dentro da faixa, a luz da faixa acompanha também quando o mouse está num dos resumos
    const faixa = alvo.closest<HTMLElement>('.faixa-pc')
    if (faixa && faixa !== alvo) {
      const f = faixa.getBoundingClientRect()
      faixa.style.setProperty('--mx', `${e.clientX - f.left}px`)
      faixa.style.setProperty('--my', `${e.clientY - f.top}px`)
    }
  }

  return (
    <div className="pagina inicio inicio-pc" data-t={principal.tom} onPointerMove={aoMover}>
      <section className="faixa-pc" data-t={principal.tom} aria-label={tx('Resumo')}>
        <header className="faixa-pc-topo">
          <h1>
            {c.perfil.nome ? <>{tx('Olá,')} <span translate="no">{c.perfil.nome}</span>!</> : tx('Olá!')}
          </h1>
          <PilulaDoJeito atual={c.perfil.detalhe} aoMudar={c.mudarDetalhe} />
          <span className="faixa-pc-data"><Icone nome="calendario" tamanho={16} /> {hojePorExtenso}</span>
        </header>

        <div className={`faixa-pc-corpo ${outros.length ? '' : 'so-um'}`}>
          <div className="faixa-pc-principal">
            <p className="faixa-pc-rotulo">{principal.rotulo}</p>
            <p className="faixa-pc-valor">{valor(principal)}</p>
            {principal.sub && <p className="faixa-pc-sub">{principal.sub}</p>}
            {principal.pilula && <button className="faixa-pc-pilula" onClick={principal.pilula.acao}>{principal.pilula.texto}</button>}
          </div>
          {outros.length > 0 && (
            <div className="faixa-pc-resumos">
              {outros.map((p) => (
                <button key={p.id} className="faixa-pc-resumo" data-t={p.tom} onClick={p.pilula?.acao}>
                  <span className="faixa-pc-resumo-rotulo">{p.rotulo}</span>
                  <b>{valor(p)}</b>
                  {p.sub && <small>{p.sub}</small>}
                  {p.pilula && <span className="faixa-pc-resumo-ir">{p.pilula.texto}<Icone nome="dir" tamanho={14} /></span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="faixa-pc-acoes">
          {acoes.map((a) => (
            <button key={a.id} onClick={a.acao} data-tour={a.tour}>
              <span className="faixa-pc-circulo" aria-hidden="true"><Icone nome={a.icone} tamanho={22} /></span>
              <span>{a.rotulo}</span>
            </button>
          ))}
        </div>
      </section>

      <CarrosselDeDicas dicas={dicas} />

      <div className="inicio-pc-cartoes">
        <GradeDeCartoes x={x} computador />
      </div>

      {entender && (
        <EntenderMes situacao={situacao} composicao={composicao} nomeMes={nomeMes} dias={ddMes.dias} nomeDoCartao={nomeDoCartao} aoFechar={() => setEntender(false)} />
      )}
      {conferir && <FormBaixa c={c} s={conferir} conferir aoFechar={() => setConferir(null)} />}
    </div>
  )
}
