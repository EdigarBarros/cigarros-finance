/**
 * Invest → Planejamento: o plano de aportes, a projeção em três cenários (com as hipóteses à vista), uma simulação de
 * "e se eu aportar outro valor", a renda que a carteira já paga e os objetivos do OpusCash (as metas), sem duplicá-los.
 * Tudo o que olha para a frente é hipótese: cada número diz a taxa e o aporte que supôs.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { mascarar } from '../../lib/dinheiro'
import { fmtMesAno, fmtPct, fmtValor, MESES_CURTO, parseNumero, simbolo } from '../../lib/format'
import { aporteMedio, aportesPorMes, mesesAte, mesesEntre, projetar, rendaPassiva, type NomeDoCenario } from '../../lib/invest/plano'
import { somarMeses } from '../../lib/invest/indices'
import { situacaoMeta } from '../../lib/metas'
import { converter } from '../../lib/moedas'
import { fmtCurto } from '../../lib/visuais'
import { tx } from '../../lib/textos'
import { Icone } from '../../components/Icone'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Anel, Progresso } from '../../components/ui'
import { Colunas } from '../../components/Vitrine'
import type { Ctx } from '../contexto'
import { GraficoDeLinhas, Quadro, type AcoesInvest } from './apoio'

const NOME_CENARIO: Record<NomeDoCenario, () => string> = { pessimista: () => tx('Pessimista'), base: () => tx('Base'), otimista: () => tx('Otimista') }
const COR_CENARIO: Record<NomeDoCenario, string> = { pessimista: 'var(--an-atencao)', base: 'var(--destaque)', otimista: 'var(--an-destino)' }
const quando = (m: string) => fmtMesAno(Number(m.slice(0, 4)), Number(m.slice(5, 7)))
const NOME_FOCO = { crescer: () => tx('Fazer o patrimônio crescer'), renda: () => tx('Viver de renda aos poucos'), liquidez: () => tx('Ter dinheiro à mão e seguro'), acompanhar: () => tx('Só acompanhar') }

export function Planejamento({ c, acoes }: { c: Ctx; acoes: AcoesInvest }) {
  const inv = c.invest
  const k = inv.c
  const plano = inv.d.plano
  const nivel = c.perfil.detalhe
  const media = useMemo(() => aporteMedio(inv.linha, k.hoje), [inv.linha, k.hoje])
  const aportes = useMemo(() => aportesPorMes(inv.linha, k.hoje, 12), [inv.linha, k.hoje])
  const proj = useMemo(() => projetar(plano, k.valor, media, k.hoje), [plano, k.valor, media, k.hoje])
  const esteMes = aportes[aportes.length - 1]?.valor ?? 0
  const planejado = plano.aporteMensal
  const doze = k.proventosPorMes.slice(-12).reduce((a, m) => a + m.valor, 0)
  const renda = rendaPassiva(doze, k.valor, plano.rendaAlvo)
  const [simulado, setSimulado] = useState('')
  const aporteSimulado = parseNumero(simulado)
  const base = plano.cenarios.base
  const alvo = plano.metaPatrimonio
  const mesesHoje = alvo ? mesesAte(alvo, k.valor, proj.aporte, base) : null
  const mesesSimulado = alvo && aporteSimulado ? mesesAte(alvo, k.valor, aporteSimulado, base) : null
  const dataEm = (meses: number | null) => (meses === null ? null : quando(somarMeses(`${k.hoje.slice(0, 7)}-01`, meses).slice(0, 7)))
  const a = c.analise
  const temOrcamento = a.renda > 0 && a.gastos > 0
  // os objetivos são as metas do OpusCash: aqui só aparecem, por prazo (quem cuida delas é a tela Metas)
  const metas = c.v.metas ? c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta)).filter((s) => !s.batida) : []
  const horizonte = (prazo: string | null) => {
    if (!prazo) return tx('Sem prazo')
    const meses = mesesEntre(k.hoje, prazo.slice(0, 7))
    return meses <= 12 ? tx('Curto prazo') : meses <= 60 ? tx('Médio prazo') : tx('Longo prazo')
  }
  // o eixo da projeção em até 60 pontos
  const passo = Math.max(1, Math.ceil(proj.meses.length / 60))
  const indices = proj.meses.map((_, i) => i).filter((i) => i % passo === 0 || i === proj.meses.length - 1)
  const semPlano = !plano.metaPatrimonio && !plano.aporteMensal && !plano.rendaAlvo && !plano.foco

  return (
    <>
      {semPlano ? (
        <section className="cartao inv-vazio pequeno">
          <span className="inv-vazio-icone"><Icone nome="meta" tamanho={28} /></span>
          <h2>{tx('Monte o seu plano')}</h2>
          <p>{tx('Diga quanto quer aportar por mês, quanto quer ter investido e até quando. O app acompanha o ritmo e mostra o caminho em três cenários.')}</p>
          <div className="inv-vazio-acoes"><button className="btn primario" onClick={acoes.editarPlano}><Icone nome="lapis" tamanho={16} /> {tx('Montar o plano')}</button></div>
        </section>
      ) : (
        <section className="cartao inv-plano">
          <header className="inv-lista-cab">
            <h3><Icone nome="meta" tamanho={17} /> {tx('Seu plano')}</h3>
            <button className="btn" onClick={acoes.editarPlano}><Icone nome="lapis" tamanho={15} /> {tx('Editar o plano')}</button>
          </header>
          <ul className="inv-plano-itens">
            <li><small>{tx('Aporte por mês')}</small><b>{planejado ? fmtValor(planejado) : '—'}</b></li>
            <li><small>{tx('Meta de patrimônio')}</small><b>{alvo ? fmtValor(alvo) : '—'}</b>{plano.metaPrazo && <span>{tx('até {0}', quando(plano.metaPrazo))}</span>}</li>
            <li><small>{tx('Renda por mês que você quer')}</small><b>{plano.rendaAlvo ? fmtValor(plano.rendaAlvo) : '—'}</b></li>
            <li><small>{tx('O que você mais quer')}</small><b className="texto">{plano.foco ? NOME_FOCO[plano.foco]() : '—'}</b></li>
            {plano.maxRendaVariavel !== null && <li><small>{tx('Máximo em renda variável')}</small><b>{plano.maxRendaVariavel}%</b><span>{tx('hoje: {0}', fmtPct(k.rendaVariavel))}</span></li>}
          </ul>
        </section>
      )}

      <section className="vt-grade-2">
        <Quadro icone="calendario" titulo={tx('Aporte deste mês')}>
          <div className="inv-aporte">
            <Anel valor={planejado ? Math.min(1, Math.max(0, esteMes) / planejado) : esteMes > 0 ? 1 : 0} cor="var(--destaque)" tamanho={c.mobile ? 96 : 116}>
              <b>{fmtCurto(Math.max(0, esteMes))}</b>
            </Anel>
            <ul className="inv-legenda larga">
              <li><span>{tx('Aportado no mês')}</span><b>{fmtValor(esteMes)}</b></li>
              {planejado ? <li><span>{tx('Falta para o plano')}</span><b>{fmtValor(Math.max(0, planejado - esteMes))}</b></li> : <li><span>{tx('Média dos últimos meses')}</span><b>{fmtValor(media)}</b></li>}
              {temOrcamento && <li><span>{tx('Sobra por mês no orçamento')}</span><b className={a.sobra >= (planejado ?? media) ? 'bom' : 'ruim'}>{fmtValor(a.sobra)}</b></li>}
            </ul>
          </div>
          {temOrcamento && (planejado ?? media) > Math.max(0, a.sobra) * 1.1 && (
            <p className="inv-nota"><Icone nome="sino" tamanho={15} /> {tx('O aporte passa do que costuma sobrar no mês, pelos seus lançamentos. A diferença sai de dinheiro já guardado ou de entradas não lançadas.')}</p>
          )}
          <button className="btn inv-quadro-botao" onClick={() => acoes.novaOperacao({ tipo: 'compra' })}><Icone nome="mais" tamanho={15} /> {tx('Registrar aporte')}</button>
        </Quadro>
        <Quadro icone="ano" titulo={tx('Aportes nos últimos 12 meses')}>
          {aportes.some((m) => m.valor > 0) ? (
            <Colunas cor="var(--destaque)" altura={c.mobile ? 110 : 130} formato={fmtCurto}
              itens={aportes.map((m, i) => ({ rotulo: MESES_CURTO[Number(m.mes.slice(5, 7)) - 1].slice(0, 3), valor: Math.max(0, m.valor), destaque: i === aportes.length - 1, titulo: fmtValor(m.valor) }))} />
          ) : <p className="quadro-vazio">{tx('Nenhum aporte nos últimos 12 meses.')}</p>}
          {aportes.some((m) => m.valor < 0) && <p className="inv-nota">{tx('Meses em que saiu mais do que entrou aparecem zerados no gráfico.')}</p>}
        </Quadro>
      </section>

      <Quadro icone="investir" titulo={tx('Projeção do patrimônio')} className="inv-projecao">
        <div className="inv-hipoteses">
          <span><Icone nome="ideia" tamanho={14} /> {tx('Hipóteses desta conta:')}</span>
          <span>{proj.origemDoAporte === 'plano' ? tx('aporte de {0} por mês (o seu plano)', fmtValor(proj.aporte)) : proj.origemDoAporte === 'media' ? tx('aporte de {0} por mês (a sua média)', fmtValor(proj.aporte)) : tx('sem novos aportes')}</span>
          {proj.cenarios.map((x) => <span key={x.nome} style={{ '--c': COR_CENARIO[x.nome] } as CSSProperties} className="inv-hipotese"><i />{NOME_CENARIO[x.nome]()}: {tx('{0}% ao ano', x.aoAno)}</span>)}
          <button className="link" onClick={acoes.editarPlano}>{tx('Mudar as hipóteses')}</button>
        </div>
        <GraficoDeLinhas formato={fmtCurto} altura={c.mobile ? 180 : 230} rotulos={indices.map((i) => `${MESES_CURTO[Number(proj.meses[i].slice(5, 7)) - 1].slice(0, 3)}/${proj.meses[i].slice(2, 4)}`)}
          series={[
            ...proj.cenarios.map((x) => ({ nome: NOME_CENARIO[x.nome](), cor: COR_CENARIO[x.nome], valores: indices.map((i) => x.pontos[i]), area: x.nome === 'base', tracejada: x.nome !== 'base' })),
            ...(alvo ? [{ nome: tx('Meta'), cor: 'var(--texto-3)', valores: indices.map(() => alvo), tracejada: true }] : []),
          ]} />
        {alvo ? (
          <ul className="inv-cenarios">
            {proj.cenarios.map((x) => (
              <li key={x.nome} style={{ '--c': COR_CENARIO[x.nome] } as CSSProperties}>
                <small>{NOME_CENARIO[x.nome]()} · {tx('{0}% ao ano', x.aoAno)}</small>
                <b>{x.chegaEm ? (x.chegaEm <= k.hoje.slice(0, 7) ? tx('Já chegou') : tx('Chega em {0}', quando(x.chegaEm))) : tx('Não chega nesse ritmo')}</b>
                {x.noPrazo !== null && plano.metaPrazo && <span>{tx('{0} em {1}', fmtValor(x.noPrazo), quando(plano.metaPrazo))}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="inv-nota">{tx('Com uma meta de patrimônio, a projeção diz quando você chega em cada cenário.')} <button className="link" onClick={acoes.editarPlano}>{tx('Definir a meta')}</button></p>}
        {proj.aporteParaAMeta !== null && plano.metaPrazo && alvo && k.valor < alvo && (
          <p className="inv-nota forte">{proj.aporteParaAMeta > 0
            ? tx('Para chegar a {0} até {1} no cenário base, o aporte precisa ser de {2} por mês.', fmtValor(alvo), quando(plano.metaPrazo), fmtValor(proj.aporteParaAMeta))
            : tx('No cenário base, o que você já tem chega a {0} até {1} mesmo sem novos aportes.', fmtValor(alvo), quando(plano.metaPrazo))}</p>
        )}
        <p className="inv-nota">{tx('É uma conta, não uma previsão: rendimentos passados não garantem os futuros, e a projeção não desconta imposto nem inflação.')}</p>
      </Quadro>

      <section className="vt-grade-2">
        <Quadro icone="trocar" titulo={tx('E se eu aportar outro valor?')}>
          {alvo ? (
            <>
              <label className="campo">
                <span className="campo-rotulo">{tx('Aporte por mês para simular')}</span>
                <span className="campo-caixa"><span className="prefixo">{simbolo()}</span>
                  <input inputMode="decimal" value={simulado} onChange={(e) => setSimulado(mascarar(e.target.value))} placeholder={fmtValor(proj.aporte).replace(/[^\d.,]/g, '')} />
                </span>
              </label>
              <ul className="inv-legenda larga">
                <li><span>{tx('Com {0} por mês', fmtValor(proj.aporte))}</span><b>{dataEm(mesesHoje) ?? tx('não chega')}</b></li>
                {aporteSimulado ? <li><span>{tx('Com {0} por mês', fmtValor(aporteSimulado))}</span><b>{dataEm(mesesSimulado) ?? tx('não chega')}</b></li> : null}
                {aporteSimulado && mesesHoje !== null && mesesSimulado !== null && mesesSimulado !== mesesHoje ? (
                  <li><span>{tx('Diferença')}</span><b className={mesesSimulado < mesesHoje ? 'bom' : 'ruim'}>{mesesSimulado < mesesHoje ? tx('{0} meses antes', mesesHoje - mesesSimulado) : tx('{0} meses depois', mesesSimulado - mesesHoje)}</b></li>
                ) : null}
              </ul>
              <p className="inv-nota">{tx('Simulação no cenário base ({0}% ao ano). Nada é gravado.', base)}</p>
            </>
          ) : <p className="quadro-vazio">{tx('Defina uma meta de patrimônio para simular em quanto tempo você chega com outro aporte.')}</p>}
        </Quadro>
        <Quadro icone="receber" titulo={tx('Renda dos investimentos')}>
          <ul className="inv-legenda larga">
            <li><span>{tx('Média por mês (12 meses)')}</span><b>{fmtValor(renda.mediaMensal)}</b></li>
            <li><span>{tx('Recebido em 12 meses')}</span><b>{fmtValor(doze)}</b></li>
            {renda.retornoEmProventos !== null && <li><span>{tx('Sobre o valor da carteira')}</span><b>{tx('{0} ao ano', fmtPct(renda.retornoEmProventos))}</b></li>}
          </ul>
          {plano.rendaAlvo ? (
            <div className="inv-meta">
              <div className="inv-meta-topo"><span>{tx('Renda que você quer: {0} por mês', fmtValor(plano.rendaAlvo))}</span><b>{fmtPct(renda.progresso ?? 0)}</b></div>
              <Progresso valor={renda.mediaMensal} total={plano.rendaAlvo} cor="var(--gradiente)" />
              {renda.patrimonioParaOAlvo !== null && <small>{tx('Mantido o retorno dos últimos 12 meses (hipótese), seriam precisos {0} investidos.', fmtValor(renda.patrimonioParaOAlvo))}</small>}
            </div>
          ) : <p className="inv-nota">{tx('Quer acompanhar uma renda mensal?')} <button className="link" onClick={acoes.editarPlano}>{tx('Definir a renda que você quer')}</button></p>}
        </Quadro>
      </section>

      {nivel !== 'simples' && (
        <Quadro icone="meta" titulo={tx('Seus objetivos')} acao={<button className="link" onClick={() => { if (!c.v.metas) c.ligarModulo('metas'); c.irPara('metas') }}>{metas.length ? tx('Ver as metas') : tx('Criar uma meta')}</button>}>
          {metas.length ? (
            <ul className="inv-linhas">
              {metas.slice(0, 6).map((s) => {
                const valor = converter(s.guardado, s.meta.moeda, c.taxas) ?? s.guardado
                return (
                  <li key={s.meta.id}>
                    <button onClick={() => c.irPara('metas')}>
                      <span className="inv-linha-ic" style={{ '--c': s.meta.cor } as CSSProperties}><IconeCategoria emoji={s.meta.icone} tamanho={17} /></span>
                      <span className="inv-linha-texto"><b>{s.meta.nome}</b><small>{horizonte(s.meta.prazo)}{s.meta.prazo ? ` · ${quando(s.meta.prazo.slice(0, 7))}` : ''}</small></span>
                      <span className="inv-linha-valor"><b>{fmtPct(s.meta.alvo > 0 ? Math.min(1, s.guardado / s.meta.alvo) : 0)}</b><small>{fmtValor(valor)}</small></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="quadro-vazio">{tx('Os objetivos são as suas metas do OpusCash (viagem, reserva, casa…). Crie uma e ela aparece aqui, por prazo.')}</p>}
        </Quadro>
      )}
    </>
  )
}
