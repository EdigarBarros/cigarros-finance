/**
 * Invest → Visão geral: responde de cara quanto há investido, quanto foi aportado, quanto isso rendeu, como evoluiu, como
 * está dividido e o que vem pela frente. O destaque do topo é a descoberta mais importante do analista.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { importante } from '../../lib/achados'
import { fmtDataCurta, fmtMesAno, fmtValor } from '../../lib/format'
import { desempenho } from '../../lib/invest/carteira'
import { cdiNoPeriodo, diasEntre } from '../../lib/invest/indices'
import { legadoDigitado } from '../../lib/invest/saldos'
import { infoClasse, nomeOperacao, rotuloDoAtivo } from '../../lib/invest/tipos'
import { fmtCurto } from '../../lib/visuais'
import { tx } from '../../lib/textos'
import { Icone } from '../../components/Icone'
import { Progresso } from '../../components/ui'
import { BarraDividida, Rosquinha } from '../../components/Vitrine'
import { COR_DO_TOM } from '../analiseApoio'
import type { Ctx } from '../contexto'
import { inicioDoPeriodo, serieDoValor, useDescobertas, type Periodo } from './analista'
import { Quadro, type AcoesInvest } from './apoio'
import { GraficoDoValor, textoDoPeriodo } from './GraficoDoValor'
import { fmtVariacao, tomDoNumero } from './formatos'

export function VisaoGeral({ c, acoes }: { c: Ctx; acoes: AcoesInvest }) {
  const inv = c.invest
  const k = inv.c
  const nivel = c.perfil.detalhe
  const [periodo, setPeriodo] = useState<Periodo>('12m')
  const de = inicioDoPeriodo(periodo, k.hoje, k.primeiraOperacao)
  const d = useMemo(() => desempenho(inv.linha, de), [inv.linha, de])
  const serie = useMemo(() => serieDoValor(inv.linha, de, k.hoje), [inv.linha, de, k.hoje])
  const cdi = d && d.rentabilidade !== null && diasEntre(d.de, d.ate) >= 30 ? cdiNoPeriodo(d.de, d.ate, inv.indices) : null
  const lista = useDescobertas(c)
  const destaque = lista[0]
  const plano = inv.d.plano
  const legado = legadoDigitado(c.d.meses)
  const doze = k.proventosPorMes.slice(-12).reduce((a, m) => a + m.valor, 0)
  const ativoDe = new Map(inv.d.ativos.map((a) => [a.id, a]))
  // o que tem data marcada: títulos que vencem em até 6 meses e operações com data futura (proventos anunciados)
  const agenda = [
    ...k.vencimentos.filter((v) => v.dias <= 183).map((v) => ({ data: v.data, id: `v${v.ativo.id}`, ativo: v.ativo, titulo: tx('Vencimento'), valor: v.valor, icone: 'calendario' })),
    ...k.futuras.map((f) => ({ data: f.op.data, id: f.op.id, ativo: f.ativo, titulo: nomeOperacao(f.op.tipo, f.ativo.por_valor), valor: f.valorP, icone: f.op.tipo === 'provento' || f.op.tipo === 'juros' ? 'receber' : 'calendario' })),
  ].sort((a, b) => (a.data < b.data ? -1 : 1)).slice(0, nivel === 'simples' ? 3 : 6)
  const recebidos = inv.d.operacoes.filter((o) => (o.tipo === 'provento' || o.tipo === 'juros') && o.data <= k.hoje).sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 3)

  return (
    <>
      <section className="cartao inv-resumo">
        <GraficoDoValor estreito={c.mobile} rotulo={tx('Investido hoje')} formato={fmtValor} formatoCurto={fmtCurto} altura={c.mobile ? 190 : 250}
          agora={{ valor: k.valor, ganho: d?.ganho ?? null, rentabilidade: d?.rentabilidade ?? null, aportado: k.aportadoLiquido }}
          serie={serie} texto={textoDoPeriodo(periodo, de === null)} periodo={{ valor: periodo, aoMudar: setPeriodo }}
          extras={(cdi || k.emDia < 0.9) && (
            <>
              {cdi && <span className="inv-chip" title={tx('Quanto o CDI rendeu no mesmo período')}>{tx('CDI: {0}', fmtVariacao(cdi.retorno))}</span>}
              {k.emDia < 0.9 && (
                <button className="inv-chip atencao" onClick={() => acoes.atualizarValores()}>
                  <Icone nome="relogio" tamanho={13} /> {tx('{0} com valor antigo', fmtVariacao(1 - k.emDia).replace('+', ''))}
                </button>
              )}
            </>
          )}
          vazio={<p className="quadro-vazio">{tx('O gráfico da evolução aparece a partir da segunda movimentação ou do segundo dia.')}</p>} />
        <ul className="inv-tres">
          <li>
            <small>{tx('Você aportou')}</small>
            <b>{fmtValor(k.aportadoLiquido)}</b>
            <span>{tx('o que pôs, menos o que tirou')}</span>
          </li>
          <li>
            <small>{tx('Resultado até hoje')}</small>
            <b className={tomDoNumero(k.resultado)}>{k.resultado > 0 ? '+' : ''}{fmtValor(k.resultado)}</b>
            <span>{tx('valorização, vendas e proventos')}</span>
          </li>
          <li>
            <small>{tx('Proventos em 12 meses')}</small>
            <b>{fmtValor(doze)}</b>
            <span>{tx('dividendos, rendimentos e juros')}</span>
          </li>
        </ul>
        {nivel !== 'simples' && <p className="inv-nota">{tx('O ganho do topo já desconta os aportes: dinheiro que você pôs não conta como rendimento. A linha tracejada é o que você aportou.')}</p>}
      </section>

      <section className="vt-grade-2">
        <Quadro icone="carteira" titulo={tx('Como está dividido')} acao={<button className="link" onClick={() => acoes.abrirAba('carteira')}>{tx('Ver a carteira')}</button>}>
          <div className="inv-composicao">
            <Rosquinha partes={k.porClasse.map((f) => ({ rotulo: f.rotulo, valor: f.valor, cor: f.cor ?? 'var(--caixa)' }))} tamanho={c.mobile ? 128 : 150}>
              <small>{k.abertas.length === 1 ? tx('1 ativo') : tx('{0} ativos', k.abertas.length)}</small>
            </Rosquinha>
            <ul className="inv-legenda">
              {k.porClasse.map((f) => (
                <li key={f.id}><i style={{ background: f.cor }} /><span>{f.rotulo}</span><b>{fmtVariacao(f.fracao).replace('+', '')}</b><small>{fmtValor(f.valor)}</small></li>
              ))}
            </ul>
          </div>
        </Quadro>
        {destaque ? (
          <section className="cartao inv-destaque" style={{ '--c': destaque.tom ? COR_DO_TOM[destaque.tom] : 'var(--destaque)' } as CSSProperties}>
            <span className="peca-selo destaque"><Icone nome="ideia" tamanho={13} /> {importante(destaque) ? tx('Precisa da sua atenção') : tx('Análise em destaque')}</span>
            <h3>{destaque.titulo}</h3>
            <p>{destaque.frase}</p>
            <div className="inv-destaque-acoes">
              <button className="btn primario" onClick={() => acoes.abrirAba('analises')}>{tx('Ver as análises')} <Icone nome="seta" tamanho={15} /></button>
              {destaque.porQue && <button className="link" onClick={() => acoes.explicar(destaque)}>{tx('Por que estou vendo isso?')}</button>}
            </div>
          </section>
        ) : (
          <Quadro icone="ideia" titulo={tx('Análises')}>
            <p className="quadro-vazio">{tx('Com mais operações e valores atualizados, as análises da sua carteira aparecem aqui.')}</p>
          </Quadro>
        )}
      </section>

      <section className="vt-grade-2">
        <Quadro icone="calendario" titulo={tx('O que vem pela frente')}>
          {agenda.length ? (
            <ul className="inv-linhas">
              {agenda.map((x) => (
                <li key={x.id}>
                  <button onClick={() => acoes.abrirAtivo(x.ativo.id)}>
                    <span className="inv-linha-ic" style={{ '--c': infoClasse(x.ativo.classe).cor } as CSSProperties}><Icone nome={x.icone} tamanho={17} /></span>
                    <span className="inv-linha-texto"><b>{rotuloDoAtivo(x.ativo)}</b><small>{x.titulo}</small></span>
                    <span className="inv-linha-valor"><b>{fmtValor(x.valor)}</b><small>{fmtDataCurta(x.data)}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="quadro-vazio">{tx('Nada com data marcada: nenhum título vence nos próximos 6 meses e não há proventos anunciados.')}</p>}
        </Quadro>
        <Quadro icone="receber" titulo={tx('Proventos e juros')} acao={doze > 0 ? <small>{tx('{0} em 12 meses', fmtValor(doze))}</small> : undefined}>
          {recebidos.length ? (
            <ul className="inv-linhas">
              {recebidos.map((o) => {
                const a = ativoDe.get(o.ativo_id)
                if (!a) return null
                return (
                  <li key={o.id}>
                    <button onClick={() => acoes.abrirAtivo(a.id)}>
                      <span className="inv-linha-ic" style={{ '--c': infoClasse(a.classe).cor } as CSSProperties}><Icone nome="receber" tamanho={17} /></span>
                      <span className="inv-linha-texto"><b>{rotuloDoAtivo(a)}</b><small>{nomeOperacao(o.tipo, a.por_valor)}</small></span>
                      <span className="inv-linha-valor"><b className="bom">+{fmtValor((o.valor - o.custos - o.impostos) * (o.cotacao ?? 1))}</b><small>{fmtDataCurta(o.data)}</small></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Quando um investimento pagar dividendo, rendimento ou juros, registre aqui para acompanhar a sua renda.')}</p>
          )}
          <button className="btn inv-quadro-botao" onClick={() => acoes.novaOperacao({ tipo: 'provento' })}><Icone nome="mais" tamanho={15} /> {tx('Registrar provento')}</button>
        </Quadro>
      </section>

      <Quadro icone="meta" titulo={tx('Meta de patrimônio')} acao={<button className="link" onClick={() => (plano.metaPatrimonio ? acoes.abrirAba('plano') : acoes.editarPlano())}>{plano.metaPatrimonio ? tx('Ver o planejamento') : tx('Definir a meta')}</button>}>
        {plano.metaPatrimonio ? (
          <div className="inv-meta">
            <div className="inv-meta-topo">
              <span>{tx('Meta: {0}', fmtValor(plano.metaPatrimonio))}{plano.metaPrazo ? ` · ${tx('até {0}', fmtMesAno(Number(plano.metaPrazo.slice(0, 4)), Number(plano.metaPrazo.slice(5, 7))))}` : ''}</span>
              <b>{fmtVariacao(Math.min(1, k.valor / plano.metaPatrimonio)).replace('+', '')}</b>
            </div>
            <Progresso valor={k.valor} total={plano.metaPatrimonio} cor="var(--gradiente)" />
            <small>{tx('{0} de {1}', fmtValor(k.valor), fmtValor(plano.metaPatrimonio))}</small>
          </div>
        ) : <p className="quadro-vazio">{tx('Diga quanto você quer ter investido e, se quiser, até quando. O app mostra o caminho em três cenários.')}</p>}
      </Quadro>

      {nivel !== 'simples' && k.porInstituicao.length > 1 && (
        <Quadro icone="inicio" titulo={tx('Onde está')}>
          <BarraDividida formato={fmtValor} partes={k.porInstituicao.slice(0, 8).map((f, i) => ({ rotulo: f.rotulo, valor: f.valor, cor: ['var(--caixa)', 'var(--destaque)', 'var(--violeta)', 'var(--divida)', 'var(--saida)', 'var(--entrada)'][i % 6] }))} />
        </Quadro>
      )}

      {legado && k.primeiraOperacao && (
        <p className="inv-nota"><Icone nome="historico" tamanho={15} /> {plano.legado === 'somar'
          ? tx('Os {0} que você informava à mão continuam somados à carteira no seu patrimônio.', fmtValor(legado.valor))
          : tx('Os {0} que você informava à mão ficaram como histórico: desde {1}, o seu patrimônio usa a carteira.', fmtValor(legado.valor), fmtMesAno(Number(k.primeiraOperacao.slice(0, 4)), Number(k.primeiraOperacao.slice(5, 7))))}
          {' '}<button className="link" onClick={acoes.editarPlano}>{tx('Mudar')}</button>
        </p>
      )}
    </>
  )
}
