import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  compararRetratos, fmtMeses, redondo, retratoDe, type Acao, type Analise as DadosAnalise, type Mudanca, type Pilar, type Retrato, type Tom,
} from '../lib/analise'
import { fmtDataCurta, fmtMesAno, fmtMoeda, fmtPct, fmtTaxa, fmtValor, LOCAL_DAS_DATAS, MESES_CURTO, MESES_NOME, mesEAno, noMeioDaFrase } from '../lib/format'
import { chaveMes, doMesChave } from '../lib/cartoes'
import { Bloco } from '../components/Blocos'
import { Icone } from '../components/Icone'
import { Anel, Interruptor } from '../components/ui'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import './analise.css'

const COR_DO_TOM: Record<Tom, string> = { bom: 'var(--entrada)', medio: 'var(--divida)', ruim: 'var(--saida)' }
const URGENCIA = { urgente: () => tx('Importante'), importante: () => tx('Faça logo'), sugestao: () => tx('Sugestão') }
/** No jeito simples, o plano mostra os 3 primeiros passos (o resto atrás de "Ver todos"). */
const PASSOS_SIMPLES = 3

const mesAno = (m: { ano: number; mes: number } | null | undefined) => (m ? fmtMesAno(m.ano, m.mes) : '—')
const sinal = (n: number) => (n > 0 ? `+${fmtValor(n)}` : fmtValor(n))

/**
 * Consultor financeiro: a análise completa de lib/analise.ts numa aba só, como alguém que cuida de tudo. O Painel refaz a
 * análise a cada mudança nos dados; aqui ela aparece em ordem de decisão: diagnóstico e fase, o que mudou, o plano de ação,
 * o mês atual, os pilares e, depois, a análise completa (sobra, tendência, regra 50/30/20, revisão dos gastos, orçamento,
 * dívidas, reserva, metas e patrimônio). Veja docs/arquitetura-do-painel.md, seção 4.7.
 */
export function Analise(c: Ctx) {
  const a = c.analise
  const simples = c.perfil.detalhe === 'simples'
  const [completa, setCompleta] = useState(!simples)
  const desdeAVisita = useDesdeAUltimaVisita(c.idUsuario, a)

  if (c.contaNova) {
    return (
      <div className="pagina analise">
        <Cabecalho a={a} />
        <section className="cartao an-vazio">
          <span className="an-vazio-icone"><Icone nome="bussola" tamanho={30} /></span>
          <h2>{tx('Seu consultor começa a trabalhar no primeiro lançamento')}</h2>
          <p>{tx('A cada entrada, saída, compra no cartão ou dívida que você lançar, o app refaz a análise: quanto sobra, para onde vai o dinheiro, o que cortar, qual dívida pagar primeiro e quanto guardar.')}</p>
          <div className="an-vazio-acoes">
            <button className="btn primario" onClick={() => c.novoLancamento('saida')}><Icone nome="mais" tamanho={16} /> {tx('Fazer o primeiro lançamento')}</button>
            <button className="btn" onClick={c.importarExtrato}><Icone nome="relatorio" tamanho={16} /> {tx('Importar extrato')}</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="pagina analise">
      <Cabecalho a={a} />
      <Diagnostico a={a} />
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} />
      <PlanoDeAcao acoes={a.acoes} simples={simples} aoIr={c.irPara} />
      {a.mes && <EsteMes a={a} />}
      {a.pilares.length > 0 && <Pilares pilares={a.pilares} aoIr={c.irPara} />}

      {!completa ? (
        <button className="btn an-ver-completa" onClick={() => setCompleta(true)}>
          <Icone nome="relatorio" tamanho={17} /> {tx('Ver a análise completa')}
        </button>
      ) : (
        <>
          {a.alocacao && <ParaOndeASobra a={a} />}
          {a.temFluxo && (
            <div className="an-duas">
              <Tendencia a={a} />
              {a.regra && <Regra a={a} />}
            </div>
          )}
          {a.temFluxo && <Revisao a={a} />}
          {a.temFluxo && <Orcamento a={a} />}
          {a.dividas && <Dividas a={a} aoIr={() => c.irPara('dividas')} />}
          {(a.reserva || a.metas) && (
            <div className="an-duas">
              {a.reserva && <Reserva a={a} />}
              {a.metas && <Metas a={a} aoIr={() => c.irPara('metas')} />}
            </div>
          )}
          {a.patrimonio && <Patrimonio a={a} />}
        </>
      )}

      <footer className="an-rodape">
        <label className="an-avisos">
          <Interruptor ligado={c.avisosDaAnalise} aoMudar={c.mudarAvisosDaAnalise} rotulo={tx('Avisar quando a análise mudar')} />
          <span>{tx('Avisar quando a análise mudar')}</span>
        </label>
        <p>{tx('São orientações de educação financeira calculadas com o que você lançou. Não são recomendação de investimento: para decisões grandes, converse com um profissional.')}</p>
      </footer>
    </div>
  )
}

function Cabecalho({ a }: { a: DadosAnalise }) {
  return (
    <header className="pagina-topo">
      <div>
        <h1>{tx('Seu consultor')}</h1>
        <p className="sub">
          {a.mesesAnalisados === 0 ? tx('A análise é refeita a cada mudança nos seus dados.')
            : a.mesesAnalisados === 1 ? tx('Analisei 1 mês dos seus lançamentos. Refaço tudo a cada mudança.')
              : tx('Analisei {0} meses dos seus lançamentos. Refaço tudo a cada mudança.', a.mesesAnalisados)}
        </p>
      </div>
    </header>
  )
}

/** Nota, resumo do consultor e a escada das fases. */
function Diagnostico({ a }: { a: DadosAnalise }) {
  const iFase = a.fases.findIndex((f) => f.id === a.fase)
  return (
    <section className="cartao an-diag" style={{ '--c': COR_DO_TOM[a.tom] } as CSSProperties}>
      <div className="an-diag-topo">
        <div className="an-nota">
          {a.nota !== null ? (
            <Anel valor={a.nota / 100} cor={COR_DO_TOM[a.tom]} tamanho={128}>
              <strong>{a.nota}</strong>
              <small>{tx('de 100')}</small>
            </Anel>
          ) : (
            <span className="an-nota-vazia"><Icone nome="bussola" tamanho={36} /></span>
          )}
          <span className="an-nota-rotulo">{a.rotulo}</span>
        </div>
        <div className="an-resumo">
          <span className="an-selo">{tx('Resumo do consultor')}</span>
          {a.resumo.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
      <div className="an-fases">
        <ol className="an-escada" aria-label={tx('Fases da sua vida financeira')}>
          {a.fases.map((f, i) => (
            <li key={f.id} className={i < iFase ? 'feita' : i === iFase ? 'atual' : ''} aria-current={i === iFase ? 'step' : undefined}>
              <span className="an-degrau">{i < iFase ? <Icone nome="check" tamanho={14} /> : i + 1}</span>
              <span className="an-degrau-nome">{f.nome}</span>
            </li>
          ))}
        </ol>
        <p className="an-fase-texto">
          <b>{tx('Você está na fase {0} de 5: {1}.', iFase + 1, a.fases[iFase].nome)}</b> {a.porqueFase} <span>{a.proximoPasso}</span>
        </p>
      </div>
    </section>
  )
}

/**
 * O que a última mudança fez com a análise ou, sem mudança nesta visita, o que mudou desde a anterior. O retrato da visita
 * fica no navegador (só números), para comparar na próxima.
 */
function useDesdeAUltimaVisita(id: string, a: DadosAnalise) {
  const chave = `opuscash:analise:${id}`
  const [antes] = useState<Retrato | null>(() => {
    try { return JSON.parse(localStorage.getItem(chave) ?? 'null') as Retrato | null } catch { return null }
  })
  const agora = useRef(a)
  useEffect(() => { agora.current = a }, [a])
  useEffect(() => {
    const guardar = () => { try { localStorage.setItem(chave, JSON.stringify(retratoDe(agora.current))) } catch { /* sem armazenamento */ } }
    window.addEventListener('pagehide', guardar)
    return () => { guardar(); window.removeEventListener('pagehide', guardar) }
  }, [chave])
  return useMemo(() => (antes ? { em: antes.em, mudancas: compararRetratos(antes, retratoDe(a)) } : null), [antes, a])
}

function ListaMudancas({ mudancas }: { mudancas: Mudanca[] }) {
  return (
    <ul className="an-mudancas">
      {mudancas.slice(0, 6).map((m, i) => (
        <li key={i} className={m.tom}>
          <Icone nome={m.tom === 'bom' ? 'sobe' : m.tom === 'ruim' ? 'desce' : 'seta'} tamanho={15} />
          <span>{m.texto}</span>
        </li>
      ))}
    </ul>
  )
}

function OQueMudou({ reanalise, desdeAVisita }: { reanalise: Ctx['reanalise']; desdeAVisita: { em: string; mudancas: Mudanca[] } | null }) {
  if (reanalise?.mudancas.length) {
    return (
      <Bloco titulo={tx('O que mudou')} className="an-mudou"
        sub={tx('Refeito às {0}, depois da sua última alteração.', reanalise.em.toLocaleTimeString(LOCAL_DAS_DATAS, { hour: '2-digit', minute: '2-digit' }))}>
        <div className="bloco-corpo"><ListaMudancas mudancas={reanalise.mudancas} /></div>
      </Bloco>
    )
  }
  if (desdeAVisita?.mudancas.length) {
    return (
      <Bloco titulo={tx('O que mudou')} className="an-mudou" sub={tx('Desde a sua última visita, em {0}.', fmtDataCurta(desdeAVisita.em.slice(0, 10)))}>
        <div className="bloco-corpo"><ListaMudancas mudancas={desdeAVisita.mudancas} /></div>
      </Bloco>
    )
  }
  return null
}

function PlanoDeAcao({ acoes, simples, aoIr }: { acoes: Acao[]; simples: boolean; aoIr: Ctx['irPara'] }) {
  const [todos, setTodos] = useState(false)
  const visiveis = simples && !todos ? acoes.slice(0, PASSOS_SIMPLES) : acoes
  return (
    <Bloco titulo={tx('Plano de ação')} className="an-plano" sub={acoes.length > 1 ? tx('Em ordem: comece pelo primeiro passo.') : undefined}>
      {acoes.length ? (
        <>
          <ol className="an-acoes">
            {visiveis.map((x, i) => (
              <li key={x.id} className={`an-acao ${x.urgencia}`}>
                <span className="an-acao-n" aria-hidden="true">{i + 1}</span>
                <div className="an-acao-texto">
                  <span className="an-acao-selo"><Icone nome={x.icone} tamanho={13} /> {URGENCIA[x.urgencia]()}</span>
                  <strong>{x.titulo}</strong>
                  <p>{x.porque}</p>
                  <div className="an-acao-pe">
                    {x.impacto && <span className="an-impacto"><Icone nome="sobe" tamanho={13} /> {x.impacto}</span>}
                    <button className="btn" onClick={() => aoIr(x.destino)}>{x.botao} <Icone nome="seta" tamanho={15} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {simples && acoes.length > PASSOS_SIMPLES && (
            <button className="quadro-ver" onClick={() => setTodos(!todos)}>{todos ? tx('Mostrar menos') : tx('Ver todos os {0} passos', acoes.length)}</button>
          )}
        </>
      ) : (
        <p className="an-tudo-certo"><Icone nome="check" tamanho={18} /> {tx('Nada pedindo ação agora. Continue lançando: a cada mudança, o plano é refeito.')}</p>
      )}
    </Bloco>
  )
}

/** Comparar: o mês atual, previsão de fechamento e quanto dá para gastar por dia. */
function EsteMes({ a }: { a: DadosAnalise }) {
  const m = a.mes!
  const nomeMes = MESES_NOME[a.hoje.mes - 1]
  const sobra = m.resultadoPrevisto >= 0
  const linhas: { rotulo: string; valor: number; tipo: 'entrada' | 'saida' }[] = [
    { rotulo: tx('Já entrou'), valor: m.entrouAteAgora, tipo: 'entrada' },
    { rotulo: m.rendaPelaMedia ? tx('Ainda deve entrar (pela sua média)') : tx('Ainda deve entrar'), valor: m.aReceber, tipo: 'entrada' },
    { rotulo: tx('Já saiu'), valor: m.saiuAteAgora, tipo: 'saida' },
    { rotulo: tx('Contas, parcelas e faturas que ainda vêm'), valor: m.aPagar, tipo: 'saida' },
    { rotulo: tx('Gastos do dia a dia previstos'), valor: m.diaADiaPrevisto, tipo: 'saida' },
  ]
  return (
    <Bloco titulo={tx('Como {0} deve fechar', noMeioDaFrase(nomeMes))} className="an-mes"
      sub={tx('Dia {0} de {1}: conta o que já aconteceu, o que está marcado e o seu ritmo de gastos.', m.dia, m.diasNoMes)}>
      <div className="bloco-corpo an-mes-grade">
        <div className={`an-mes-total ${sobra ? 'bom' : 'ruim'}`}>
          <small>{sobra ? tx('Deve sobrar') : tx('Pode faltar')}</small>
          <strong>{fmtValor(Math.abs(m.resultadoPrevisto))}</strong>
          {m.contraMedia !== null && Math.abs(m.contraMedia) >= 1 && (
            <span className={`an-chip ${m.contraMedia >= 0 ? 'bom' : 'ruim'}`}>
              {m.contraMedia >= 0 ? tx('{0} a mais que a sua média', fmtValor(m.contraMedia)) : tx('{0} a menos que a sua média', fmtValor(-m.contraMedia))}
            </span>
          )}
          <div className={`an-por-dia ${m.porDia > 0 ? '' : 'sem'}`}>
            <Icone nome={m.porDia > 0 ? 'carteira' : 'escudo'} tamanho={18} />
            <span>
              {m.porDia > 0
                ? m.sobraAlvo > 0
                  ? tx('Para guardar {0} neste mês, gaste até {1} por dia no dia a dia.', fmtValor(redondo(m.sobraAlvo)), fmtValor(Math.floor(m.porDia)))
                  : tx('Dá para gastar até {0} por dia no dia a dia.', fmtValor(Math.floor(m.porDia)))
                : tx('Neste mês não há espaço para gastos do dia a dia sem mexer no guardado. Segure o que não for essencial.')}
            </span>
          </div>
        </div>
        <div className="an-mes-linhas">
          <dl>
            {linhas.map((l) => (
              <div key={l.rotulo} className={l.tipo}>
                <dt>{l.rotulo}</dt>
                <dd>{l.tipo === 'saida' && l.valor > 0 ? `− ${fmtValor(l.valor)}` : fmtValor(l.valor)}</dd>
              </div>
            ))}
            <div className="total">
              <dt>{tx('Resultado previsto')}</dt>
              <dd>{sinal(m.resultadoPrevisto)}</dd>
            </div>
          </dl>
          <ul className="an-notas">
            {m.rendaExtraMedia > 0 && (
              <li>{tx('Sem contar renda extra (freelas, vendas, bicos): nos últimos meses, ela foi de {0} por mês em média.', fmtValor(m.rendaExtraMedia))}</li>
            )}
            {m.ateHojeNormal !== null && m.dia >= 3 && (m.saiuAteAgora > 0 || m.ateHojeNormal > 0) && (
              <li>{tx('Até o dia {0}, saíram {1}. Nos outros meses, até esse dia, saíam {2}.', m.dia, fmtValor(m.saiuAteAgora), fmtValor(m.ateHojeNormal))}</li>
            )}
            {m.acimaDoNormal.map((x) => (
              <li key={x.id}>{tx('{0} já passou da média: {1} neste mês, contra {2} por mês.', x.nome, fmtValor(x.atual), fmtValor(x.media))}</li>
            ))}
          </ul>
        </div>
      </div>
    </Bloco>
  )
}

function Pilares({ pilares, aoIr }: { pilares: Pilar[]; aoIr: Ctx['irPara'] }) {
  return (
    <Bloco titulo={tx('Como está cada parte')} className="an-pilares" sub={tx('A nota é a média destes pilares, pesando mais a sobra, a reserva e as dívidas.')}>
      <div className="an-pilares-grade">
        {pilares.map((p) => (
          <button key={p.id} className={`an-pilar ${p.tom}`} style={{ '--c': COR_DO_TOM[p.tom] } as CSSProperties} onClick={() => aoIr(p.destino)}>
            <span className="an-pilar-topo">
              <span className="an-pilar-nome">{p.nome}</span>
              <span className="an-pilar-nota"><b>{p.nota}</b>/100</span>
            </span>
            <span className="an-barra" aria-hidden="true"><i style={{ width: `${p.nota}%` }} /></span>
            <strong className="an-pilar-valor">{p.valor}</strong>
            <span className="an-pilar-ref">{p.referencia}</span>
            <span className="an-pilar-frase">{p.frase}</span>
          </button>
        ))}
      </div>
    </Bloco>
  )
}

/** Planejar: a divisão da sobra conforme a fase. */
function ParaOndeASobra({ a }: { a: DadosAnalise }) {
  const x = a.alocacao!
  const partes = [
    { id: 'reserva', rotulo: tx('Reserva'), valor: x.reserva, cor: 'var(--caixa)' },
    { id: 'dividas', rotulo: tx('Adiantar dívidas'), valor: x.dividas, cor: 'var(--divida)' },
    { id: 'metas', rotulo: tx('Metas'), valor: x.metas, cor: 'var(--violeta)' },
    { id: 'livre', rotulo: a.fase === 'crescer' ? tx('Para o longo prazo') : tx('Folga'), valor: x.livre, cor: 'var(--entrada)' },
  ].filter((p) => p.valor >= 0.01)
  const porFase: Record<DadosAnalise['fase'], string> = {
    vermelho: '',
    colchao: tx('Primeiro o colchão: sem ele, qualquer imprevisto vira dívida nova.'),
    dividas: tx('A maior parte vai para a dívida cara: cada real adiantado nela rende os juros que ela cobra.'),
    reserva: tx('A maior parte completa a reserva; o resto já começa a encher as metas.'),
    crescer: tx('A base está pronta: a sobra vai para as metas e para o longo prazo.'),
  }
  return (
    <Bloco titulo={tx('Para onde mandar a sobra')} valor={fmtValor(x.sobra)} legenda={tx('por mês')} className="an-sobra" sub={porFase[a.fase]}>
      <div className="bloco-corpo">
        <div className="an-pilha" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${fmtValor(p.valor)}`).join(', ')}>
          {partes.map((p) => <i key={p.id} style={{ flexGrow: p.valor, background: p.cor }} />)}
        </div>
        <ul className="an-legenda">
          {partes.map((p) => (
            <li key={p.id}><i style={{ background: p.cor }} /> <span>{p.rotulo}</span> <b>{fmtValor(p.valor)}</b></li>
          ))}
        </ul>
      </div>
    </Bloco>
  )
}

/** Comparar: os últimos 12 meses (sobra de cada mês) e o rumo da renda e dos gastos. */
function Tendencia({ a }: { a: DadosAnalise }) {
  const meses = a.serie.filter((s) => !s.atual)
  const primeiro = meses.findIndex((s) => s.comDados)
  const vistos = primeiro < 0 ? [] : meses.slice(primeiro)
  const maxPos = Math.max(1, ...vistos.map((s) => (s.comDados ? s.sobra : 0)))
  const maxNeg = Math.max(0, ...vistos.map((s) => (s.comDados ? -s.sobra : 0)))
  const zero = (maxPos / (maxPos + maxNeg)) * 100
  const rumo = (t: number | null, de: 'renda' | 'gastos') => {
    if (t === null) return de === 'renda' ? tx('Renda: poucos meses para ver o rumo.') : tx('Gastos: poucos meses para ver o rumo.')
    const p = new Intl.NumberFormat(LOCAL_DAS_DATAS, { maximumFractionDigits: 1 }).format(Math.abs(t) * 100)
    if (Math.abs(t) < 0.01) return de === 'renda' ? tx('Renda: estável.') : tx('Gastos: estáveis.')
    return de === 'renda'
      ? t > 0 ? tx('Renda: sobe cerca de {0}% ao mês.', p) : tx('Renda: cai cerca de {0}% ao mês.', p)
      : t > 0 ? tx('Gastos: sobem cerca de {0}% ao mês.', p) : tx('Gastos: caem cerca de {0}% ao mês.', p)
  }
  return (
    <Bloco titulo={tx('Últimos 12 meses')} className="an-tendencia" sub={tx('Quanto sobrou (ou faltou) em cada mês fechado.')}>
      <div className="bloco-corpo">
        {vistos.length ? (
          <div className="an-barras" style={{ '--zero': `${zero}%` } as CSSProperties}>
            {vistos.map((s) => {
              const altura = s.sobra >= 0 ? (s.sobra / (maxPos + maxNeg)) * 100 : (-s.sobra / (maxPos + maxNeg)) * 100
              return (
                <div key={`${s.ano}-${s.mes}`} className={`an-coluna ${s.comDados ? (s.sobra >= 0 ? 'bom' : 'ruim') : 'sem'}`}
                  title={s.comDados ? `${MESES_NOME[s.mes - 1]} ${s.ano}: ${sinal(s.sobra)}` : tx('{0}: sem entradas e saídas lançadas', `${MESES_NOME[s.mes - 1]} ${s.ano}`)}>
                  <i style={s.sobra >= 0 ? { bottom: `calc(100% - var(--zero))`, height: `${s.comDados ? altura : 0}%` } : { top: 'var(--zero)', height: `${altura}%` }} />
                  <span>{MESES_CURTO[s.mes - 1].slice(0, 3)}</span>
                </div>
              )
            })}
          </div>
        ) : <p className="vazio">{tx('Ainda não há meses fechados com entradas e saídas.')}</p>}
        <ul className="an-notas">
          <li>{rumo(a.tendenciaRenda, 'renda')}</li>
          <li>{rumo(a.tendenciaGastos, 'gastos')}</li>
          {a.principalFonte && a.principalFonte.fracao >= 0.6 && (
            <li>{tx('{0}% do que entra vem de {1}.', Math.round(a.principalFonte.fracao * 100), a.principalFonte.nome)}{' '}
              {a.principalFonte.fracao >= 0.9 ? tx('Depender de uma fonte só pede uma reserva mais robusta.') : ''}</li>
          )}
          {a.variacaoRenda !== null && (
            <li>{a.rendaVaria ? tx('Sua renda varia bastante de um mês para o outro: por isso a reserva ideal é de 12 meses.') : tx('Sua renda é estável de um mês para o outro.')}</li>
          )}
        </ul>
      </div>
    </Bloco>
  )
}

/** Revisar: a regra 50/30/20 com os números da pessoa. */
function Regra({ a }: { a: DadosAnalise }) {
  const r = a.regra!
  const necessidades = r.essencial + r.parcelas
  const linhas = [
    { id: 'nec', rotulo: tx('Necessidades'), detalhe: tx('casa, mercado, transporte, saúde e parcelas'), valor: necessidades, ideal: tx('até 50%'), ok: necessidades <= 0.5, cor: 'var(--caixa)' },
    { id: 'estilo', rotulo: tx('Estilo de vida'), detalhe: tx('lazer, compras, assinaturas, restaurantes'), valor: r.estilo + r.outros, ideal: tx('até 30%'), ok: r.estilo + r.outros <= 0.3, cor: 'var(--violeta)' },
    { id: 'futuro', rotulo: tx('Futuro'), detalhe: tx('o que sobra para guardar e adiantar dívidas'), valor: r.sobra, ideal: tx('20% ou mais'), ok: r.sobra >= 0.2, cor: 'var(--entrada)' },
  ]
  return (
    <Bloco titulo={tx('Regra 50/30/20')} className="an-regra" sub={tx('Uma referência simples para dividir o que entra.')}>
      <div className="bloco-corpo">
        <div className="an-pilha" role="img" aria-label={linhas.map((l) => `${l.rotulo}: ${fmtPct(l.valor)}`).join(', ')}>
          {linhas.map((l) => <i key={l.id} style={{ flexGrow: Math.max(0.001, l.valor), background: l.cor }} />)}
        </div>
        <ul className="an-regra-linhas">
          {linhas.map((l) => (
            <li key={l.id}>
              <i style={{ background: l.cor }} />
              <span className="an-regra-nome"><b>{l.rotulo}</b><small>{l.detalhe}</small></span>
              <span className="an-regra-valor"><b>{fmtPct(l.valor)}</b><small>{l.ideal}</small></span>
              <span className={`an-regra-ok ${l.ok ? 'bom' : 'ruim'}`} aria-label={l.ok ? tx('Dentro do ideal') : tx('Fora do ideal')}>
                <Icone nome={l.ok ? 'check' : 'sobe'} tamanho={14} />
              </span>
            </li>
          ))}
        </ul>
        {r.parcelas > 0.15 && <p className="an-nota-fraca">{tx('Só as parcelas de dívidas levam {0} do que entra.', fmtPct(r.parcelas))}</p>}
      </div>
    </Bloco>
  )
}

/** Revisar: o que mudou nas categorias, o que se repete todo mês, gastos formiga e juros. */
function Revisao({ a }: { a: DadosAnalise }) {
  const nada = !a.subiram.length && !a.cairam.length && !a.recorrentes.length && !a.formigas.length && a.jurosPagos <= 0
  return (
    <Bloco titulo={tx('Revisão dos gastos')} className="an-revisao" sub={tx('O que mudou, o que se repete todo mês e onde o dinheiro escapa sem você ver.')}>
      <div className="bloco-corpo an-revisao-grade">
        {nada && <p className="an-tudo-certo"><Icone nome="check" tamanho={18} /> {tx('Nada fora do lugar nos seus gastos.')}</p>}
        {(a.subiram.length > 0 || a.cairam.length > 0) && (
          <section>
            <h3>{tx('O que mais mudou nos últimos 3 meses')}</h3>
            <ul className="an-itens">
              {[...a.subiram, ...a.cairam].map((c) => (
                <li key={c.id}>
                  <span className="an-item-icone">{c.icone}</span>
                  <span className="an-item-nome">{c.nome}
                    <small>{c.parcelado > 0 && c.media > 0 && c.parcelado / c.media >= 0.5 ? tx('{0} por mês são parcelas no cartão', fmtValor(c.parcelado)) : tx('antes, {0} por mês', fmtValor(c.antes ?? 0))}</small>
                  </span>
                  <span className={`an-item-valor ${(c.variacao ?? 0) > 0 ? 'ruim' : 'bom'}`}>
                    <b>{fmtValor(c.media)}</b>
                    <small><Icone nome={(c.variacao ?? 0) > 0 ? 'sobe' : 'desce'} tamanho={12} /> {fmtPct(Math.abs(c.variacao ?? 0))}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {a.recorrentes.length > 0 && (
          <section>
            <h3>{tx('Contas que se repetem todo mês')}</h3>
            <ul className="an-itens">
              {a.recorrentes.slice(0, 8).map((r) => (
                <li key={r.descricao}>
                  <span className="an-item-icone"><Icone nome={r.assinatura ? 'calendario' : 'historico'} tamanho={16} /></span>
                  <span className="an-item-nome">{r.descricao}<small>{r.assinatura ? tx('assinatura · {0} por ano', fmtValor(r.valor * 12)) : tx('{0} por ano', fmtValor(r.valor * 12))}</small></span>
                  <span className="an-item-valor"><b>{fmtValor(r.valor)}</b><small>{tx('por mês')}</small></span>
                </li>
              ))}
            </ul>
            <p className="an-nota-fraca">
              {a.assinaturasPorMes > 0
                ? tx('Juntas, somam {0} por mês, e as assinaturas, {1}. Revise uma vez por ano o que ainda vale a pena.', fmtValor(a.recorrentesPorMes), fmtValor(a.assinaturasPorMes))
                : tx('Juntas, somam {0} por mês. Revise uma vez por ano o que ainda vale a pena.', fmtValor(a.recorrentesPorMes))}
            </p>
          </section>
        )}
        {a.formigas.length > 0 && (
          <section>
            <h3>{tx('Gastos formiga')}</h3>
            <ul className="an-itens">
              {a.formigas.map((f) => (
                <li key={f.descricao}>
                  <span className="an-item-icone"><Icone nome="lista" tamanho={16} /></span>
                  <span className="an-item-nome">{f.descricao}<small>{tx('{0} vezes por mês, {1} em média', Math.round(f.vezesPorMes), fmtValor(f.ticket))}</small></span>
                  <span className="an-item-valor"><b>{fmtValor(f.porAno)}</b><small>{tx('por ano')}</small></span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {a.jurosPagos > 0 && (
          <section className="an-juros">
            <h3>{tx('Juros, multas e tarifas')}</h3>
            <p><b>{fmtValor(a.jurosPagos)}</b> {tx('nos últimos 12 meses: dinheiro que não volta nem compra nada.')}</p>
          </section>
        )}
      </div>
    </Bloco>
  )
}

/** Planejar: teto por categoria para o mês que vem. */
function Orcamento({ a }: { a: DadosAnalise }) {
  const prox = doMesChave(chaveMes(a.hoje.ano, a.hoje.mes) + 1)
  const linhas = a.categorias.filter((c) => c.grupo !== 'dividas' && c.media > 0).slice(0, 10)
  if (!linhas.length) return null
  const totalMedia = linhas.reduce((s, c) => s + c.media, 0)
  const totalSugestao = linhas.reduce((s, c) => s + c.sugestao, 0)
  return (
    <Bloco titulo={tx('Orçamento para {0}', mesEAno(prox.ano, prox.mes))} className="an-orcamento"
      sub={a.corte > 0
        ? tx('Para guardar {0}% do que entra, alguns tetos ficam abaixo da sua média. Parcelas já assumidas não entram no corte.', Math.round(a.sobraAlvo * 100))
        : tx('Você já guarda bem: use a sua média como teto de cada categoria.')}>
      <div className="bloco-corpo">
        <table className="an-tabela">
          <thead>
            <tr><th>{tx('Categoria')}</th><th>{tx('Média por mês')}</th><th>{tx('Teto sugerido')}</th></tr>
          </thead>
          <tbody>
            {linhas.map((c) => {
              const corte = c.media - c.sugestao
              return (
                <tr key={c.id}>
                  <td><span className="an-cat"><span>{c.icone}</span> {c.nome}</span></td>
                  <td>{fmtValor(c.media)}</td>
                  <td className={corte >= 1 ? 'corta' : ''}>
                    {fmtValor(c.sugestao)}
                    {corte >= 1 && <small>{tx('− {0}', fmtValor(corte))}</small>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr><td>{tx('Total')}</td><td>{fmtValor(totalMedia)}</td><td>{fmtValor(totalSugestao)}</td></tr>
          </tfoot>
        </table>
      </div>
    </Bloco>
  )
}

/** Planejar: estratégias para sair das dívidas, com a economia de juros. */
function Dividas({ a, aoIr }: { a: DadosAnalise; aoIr: () => void }) {
  const d = a.dividas!
  const nomes = { parcelas: tx('Só as parcelas'), avalanche: tx('Avalanche: juros mais altos primeiro'), 'bola-de-neve': tx('Bola de neve: menor dívida primeiro') }
  return (
    <Bloco titulo={tx('Plano para sair das dívidas')} className="an-dividas" acao={<button className="link" onClick={aoIr}>{tx('Ver dívidas')}</button>}
      sub={d.extraExemplo
        ? tx('Comparando com {0} a mais por mês: um exemplo, porque hoje a sobra ainda não tem espaço para isso.', fmtValor(d.extra))
        : tx('Comparando com {0} a mais por mês, a parte da sua sobra que o plano separa para as dívidas.', fmtValor(d.extra))}>
      <div className="bloco-corpo">
        <div className="an-numeros">
          <div><small>{tx('Você deve')}</small><b>{fmtValor(d.total)}</b></div>
          <div><small>{tx('Parcelas por mês')}</small><b>{fmtValor(d.parcelasMes)}</b></div>
          {d.jurosPorMes > 0 && <div><small>{tx('Juros por mês, hoje')}</small><b>{fmtValor(d.jurosPorMes)}</b></div>}
          {d.jurosEmbutidos > 0 && <div><small>{tx('Juros que ainda estão nas parcelas')}</small><b>{fmtValor(d.jurosEmbutidos)}</b></div>}
        </div>
        <table className="an-tabela an-estrategias">
          <thead>
            <tr><th>{tx('Estratégia')}</th><th>{tx('Sem dívidas em')}</th><th>{tx('Total pago')}</th><th>{tx('Economia')}</th></tr>
          </thead>
          <tbody>
            {d.estrategias.map((e) => (
              <tr key={e.id} className={e.id === d.recomendada ? 'recomendada' : ''}>
                <td><span className="an-estrategia">{nomes[e.id]}{e.id === d.recomendada && <span className="an-chip bom">{tx('Recomendada')}</span>}</span></td>
                <td>{e.fim ? mesAno(e.fim) : tx('Não acaba')}</td>
                <td>{e.meses === null ? '—' : fmtValor(e.totalPago)}</td>
                <td>{e.id === 'parcelas' ? '—' : e.economia === null ? '—' : fmtValor(e.economia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="an-nota-fraca">{d.porque}</p>
        <h3 className="an-sub">{tx('Ordem de pagamento')}</h3>
        <ol className="an-ordem">
          {d.ordem.map((x) => (
            <li key={x.id}>
              <span className="an-ordem-nome"><b>{x.nome}</b>
                <small>{x.juros !== null ? tx('{0}% ao mês · falta {1}', fmtTaxa(x.juros), fmtValor(x.restante)) : tx('juros não informados · falta {0}', fmtValor(x.restante))}</small>
              </span>
              <span className="an-ordem-fim">
                <b>{x.quitaEm ? mesAno(x.quitaEm) : '—'}</b>
                {x.quitaSemExtra && x.quitaEm && chaveMes(x.quitaEm.ano, x.quitaEm.mes) < chaveMes(x.quitaSemExtra.ano, x.quitaSemExtra.mes) && (
                  <small>{tx('em vez de {0}', mesAno(x.quitaSemExtra))}</small>
                )}
              </span>
            </li>
          ))}
        </ol>
        <p className="an-nota-fraca">{tx('As contas usam as parcelas que faltam e os juros informados. Ao adiantar, peça ao credor o desconto dos juros: o valor exato é ele quem diz.')}</p>
      </div>
    </Bloco>
  )
}

function Reserva({ a }: { a: DadosAnalise }) {
  const r = a.reserva!
  const max = Math.max(r.alvo, r.tem, 1)
  return (
    <Bloco titulo={tx('Reserva para imprevistos')} className="an-reserva" valor={fmtMeses(r.meses)}>
      <div className="bloco-corpo">
        <div className="an-trilho" role="img" aria-label={tx('{0} de {1}', fmtValor(r.tem), fmtValor(r.alvo))}>
          <i style={{ width: `${Math.min(100, (r.tem / max) * 100)}%` }} />
          <span className="an-marco" style={{ left: `${(r.colchao / max) * 100}%` }}><small>{tx('1 mês')}</small></span>
          <span className="an-marco fim" style={{ left: '100%' }}><small>{tx('{0} meses', r.alvoMeses)}</small></span>
        </div>
        <div className="an-numeros">
          <div><small>{tx('Guardado')}</small><b>{fmtValor(r.tem)}</b></div>
          <div><small>{tx('Ideal')}</small><b>{fmtValor(r.alvo)}</b></div>
          <div><small>{tx('Falta')}</small><b>{fmtValor(r.falta)}</b></div>
        </div>
        <p className="an-nota-fraca">
          {r.falta <= 0 ? tx('Reserva completa. Deixe esse dinheiro onde dá para tirar no mesmo dia, rendendo pelo menos a inflação.')
            : r.chegaEm ? tx('Guardando {0} por mês, você chega lá em {1}.', fmtValor(r.porMes), mesAno(r.chegaEm))
              : tx('Quando sobrar dinheiro no mês, comece por aqui.')}
          {' '}{r.rendaVaria ? tx('Como a sua renda varia, o ideal é ter 12 meses de gastos.') : tx('Para renda estável, o ideal é ter 6 meses de gastos.')}
          {r.fonte === 'meta' && <> {tx('Conta o que está na sua meta de reserva.')}</>}
        </p>
      </div>
    </Bloco>
  )
}

function Metas({ a, aoIr }: { a: DadosAnalise; aoIr: () => void }) {
  const p = a.metas!
  return (
    <Bloco titulo={tx('Metas')} className="an-metas" acao={<button className="link" onClick={aoIr}>{tx('Ver metas')}</button>}
      sub={p.necessario > 0
        ? p.cabe ? tx('Pedem {0} por mês e cabem no plano.', fmtValor(p.necessario))
          : tx('Pedem {0} por mês; pelo plano, cabem {1}.', fmtValor(p.necessario), fmtValor(p.disponivel))
        : tx('Sem prazo definido: guarde um pouco todo mês.')}>
      <ul className="bloco-corpo an-itens">
        {p.metas.map((m) => (
          <li key={m.id}>
            <span className="an-item-icone">{m.icone}</span>
            <span className="an-item-nome">{m.nome}
              <small>
                {m.porMes !== null
                  ? tx('pede {0} por mês · você guarda {1}', fmtMoeda(m.porMes, m.moeda), fmtMoeda(m.ritmo, m.moeda))
                  : m.ritmo > 0 ? tx('você guarda {0} por mês', fmtMoeda(m.ritmo, m.moeda)) : tx('nada guardado nos últimos meses')}
              </small>
            </span>
            <span className={`an-item-valor ${m.noRitmo ? 'bom' : 'ruim'}`}>
              <b>{m.noRitmo ? tx('No ritmo') : tx('Atrasada')}</b>
              <small>{m.previsao ? tx('chega em {0}', mesAno(m.previsao)) : m.prazo ? tx('prazo: {0}', mesAno(m.prazo)) : ''}</small>
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

function Patrimonio({ a }: { a: DadosAnalise }) {
  const p = a.patrimonio!
  const valores = p.serie.map((x) => x.valor)
  const min = Math.min(...valores, p.em12)
  const max = Math.max(...valores, p.em12)
  const faixa = max - min || 1
  const n = valores.length
  const pontos = valores.map((v, i) => `${n === 1 ? 50 : (i / (n - 1)) * 100},${100 - ((v - min) / faixa) * 100}`).join(' ')
  return (
    <Bloco titulo={tx('Tudo o que é seu')} className="an-patrimonio" valor={fmtValor(p.hoje)}
      sub={tx('O que você tem guardado e investido, menos o que deve.')}>
      <div className="bloco-corpo an-patrimonio-grade">
        {n > 1 && (
          <svg className="an-linha" viewBox="0 -4 100 108" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={pontos} />
          </svg>
        )}
        <div className="an-numeros">
          <div><small>{tx('Tem')}</small><b>{fmtValor(p.ativos)}</b></div>
          <div><small>{tx('Deve')}</small><b>{fmtValor(p.dividas)}</b></div>
          {p.variacao !== null && p.desde && (
            <div><small>{tx('Desde {0}', mesAno(p.desde))}</small><b className={p.variacao >= 0 ? 'bom' : 'ruim'}>{sinal(p.variacao)}</b></div>
          )}
          <div><small>{tx('Em 12 meses, no ritmo de hoje')}</small><b>{fmtValor(p.em12)}</b></div>
          {p.em12NoPlano > p.em12 + 1 && <div><small>{tx('Em 12 meses, seguindo o orçamento')}</small><b className="bom">{fmtValor(p.em12NoPlano)}</b></div>}
        </div>
        <p className="an-nota-fraca">{tx('A projeção soma a sobra de cada mês e as parcelas pagas (cada parcela paga é dívida a menos). Não conta rendimento de investimentos.')}</p>
      </div>
    </Bloco>
  )
}
