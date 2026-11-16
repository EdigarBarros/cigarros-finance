/**
 * A Início no jeito simples: uma coluna que responde, nesta ordem, quanto entrou e saiu no mês, como ele pode terminar,
 * como registrar uma entrada ou saída e qual conta pede atenção. Depois vêm uma orientação, os últimos lançamentos e acessos
 * curtos para o resto (gastos por categoria, dívidas, metas, contas e investimentos). Os detalhes continuam a um toque:
 * "Ver cálculo" abre a conta da previsão, "Gastos por categoria" abre a distribuição inteira e cada acesso leva à sua tela.
 * Todos os números saem das mesmas contas dos outros jeitos (lib/previsao.ts, lib/paraFazer.ts). Veja
 * docs/arquitetura-do-painel.md, seção 4.1.
 */
import { useState, type ReactNode } from 'react'
import { caixaDoBanco } from '../lib/calc'
import { fatiasDeGastos } from '../lib/categorias'
import type { SituacaoConta } from '../lib/contasFixas'
import { fmtDataCurta, fmtMesAno, fmtValor } from '../lib/format'
import type { SituacaoMeta } from '../lib/metas'
import { converter } from '../lib/moedas'
import { agruparTarefas, tarefasDoMes, type Tarefa } from '../lib/paraFazer'
import { DETALHES } from '../lib/perfil'
import type { ComposicaoDaPrevisao, DiaADia } from '../lib/previsao'
import { tx } from '../lib/textos'
import { TIPOS_CAIXA, type Detalhe, type Lancamento } from '../lib/types'
import { useAcoesDeLancar } from '../lib/botaoMais'
import type { Ctx } from '../pages/contexto'
import { Selo } from './Categorias'
import { FormBaixa } from './FormBaixa'
import { Icone } from './Icone'
import { SEM_CATEGORIA } from '../lib/categorias'
import { Modal } from './ui'
import './inicio-simples.css'

const centavos = (n: number) => Math.round(n * 100) / 100
/** Contas mostradas antes do "Ver todas as contas". */
const NA_TELA = 3
/** Lançamentos mostrados na Início. */
const ULTIMOS = 3

/** Valor com sinal de menos quando é negativo: o sentido não pode depender só da cor. */
const comSinal = (n: number) => `${n < 0 ? '− ' : ''}${fmtValor(Math.abs(n))}`

// ---------------------------------------------------------------------------------------------------------------------
// Resumo do mês e previsão

function ResumoDoMes({ dd, composicao, momento, vazio, nomeMes, previsaoPossivel, aoVerCalculo, aoCadastrarContas }: {
  dd: DiaADia
  composicao: ComposicaoDaPrevisao
  momento: 'atual' | 'passado' | 'futuro'
  /** Nenhum lançamento no mês. */
  vazio: boolean
  nomeMes: string
  /** Há o que prever: algo ainda a pagar ou receber, ou contas do mês cadastradas (aí "nada pendente" também é informação). */
  previsaoPossivel: boolean
  aoVerCalculo: () => void
  /** Leva às Contas do mês (só com o módulo ligado). */
  aoCadastrarContas?: () => void
}) {
  const futuro = momento === 'futuro'
  // num mês que ainda não começou, o que já está lançado para ele; nos outros, só o que já aconteceu (como nos outros jeitos)
  const entrou = futuro ? dd.vaiEntrar : dd.entrou
  const saiu = futuro ? dd.vaiSair : dd.saiu
  const resultado = centavos(entrou - saiu)
  const semNada = vazio && entrou === 0 && saiu === 0
  const rotulo = momento === 'atual' ? tx('Resultado do mês até hoje') : futuro ? tx('Já lançado para {0}', nomeMes) : tx('Resultado de {0}', nomeMes)
  const tom = resultado > 0 ? 'pos' : resultado < 0 ? 'neg' : 'zero'

  // a mesma conta do "Ver cálculo" (lib/previsao.ts → comporPrevisao): o que já entrou − o que já saiu + o que vem − o que vai sair
  const previsto = composicao.resultado
  const escala = Math.max(composicao.entrou + composicao.totalReceber, composicao.saiu + composicao.totalPagar)
  const pertoDeZero = Math.abs(previsto) < Math.max(10, escala * 0.02)

  return (
    <section className="is-resumo" aria-label={tx('Resumo do mês')}>
      <div className={`is-resultado ${semNada ? 'sem-nada' : tom}`}>
        <p className="is-rotulo">{rotulo}</p>
        {semNada ? (
          <p className="is-vazio">{tx('Nada registrado em {0} ainda. Comece registrando uma entrada ou uma saída.', nomeMes)}</p>
        ) : (
          <>
            <strong className="is-valor">{comSinal(resultado)}</strong>
            {resultado < 0 && <p className="is-explica">{futuro ? tx('Já há mais saídas lançadas do que entradas.') : tx('Saiu mais do que entrou.')}</p>}
            <div className="is-entrou-saiu">
              <span><Icone nome="sobe" tamanho={15} /> {futuro ? tx('Vai entrar') : tx('Entrou')} <b>{fmtValor(entrou)}</b></span>
              <span><Icone nome="desce" tamanho={15} /> {futuro ? tx('Vai sair') : tx('Saiu')} <b>{fmtValor(saiu)}</b></span>
            </div>
          </>
        )}
      </div>

      {momento === 'atual' && (
        <div className={`is-previsao ${previsaoPossivel ? (pertoDeZero ? 'zero' : previsto < 0 ? 'neg' : 'pos') : 'sem'}`}>
          <p className="is-rotulo">{tx('Previsão para o fim do mês')}</p>
          {previsaoPossivel ? (
            <>
              <p className="is-previsao-frase">
                {pertoDeZero
                  ? <>{tx('Deve fechar perto de zero')} <small>({comSinal(previsto)})</small></>
                  : previsto < 0
                    ? <>{tx('Pode faltar')} <b>{fmtValor(-previsto)}</b></>
                    : <>{tx('Pode sobrar')} <b>{fmtValor(previsto)}</b></>}
              </p>
              <p className="is-nota">{tx('Conta com o que está registrado e pode mudar.')}</p>
              <button type="button" className="is-ver-calculo" onClick={aoVerCalculo}>{tx('Ver cálculo')} <Icone nome="dir" tamanho={15} /></button>
            </>
          ) : (
            <>
              <p className="is-previsao-frase sem">{tx('Ainda não há dados suficientes para prever.')}</p>
              <p className="is-nota">{tx('Cadastre o que entra e sai todo mês (salário, aluguel, contas) para o app prever.')}</p>
              {aoCadastrarContas && <button type="button" className="is-ver-calculo" onClick={aoCadastrarContas}>{tx('Cadastrar contas')} <Icone nome="dir" tamanho={15} /></button>}
            </>
          )}
        </div>
      )}
      {momento === 'passado' && !semNada && (
        <button type="button" className="is-ver-calculo solto" onClick={aoVerCalculo}>{tx('Ver como o mês fechou')} <Icone nome="dir" tamanho={15} /></button>
      )}
      {futuro && !semNada && <p className="is-nota solta">{tx('O mês ainda não começou: isto é o que já está lançado para ele, como parcelas e compras no cartão.')}</p>}
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Contas a pagar

/** Ação de cada linha, conforme o que o app faz de verdade: dar baixa numa conta, abrir a fatura ou lançar o pagamento da parcela. */
const textoDaAcao = (t: Tarefa) => (t.chave.startsWith('conta:') ? tx('Marcar como paga') : t.chave.startsWith('divida:') ? tx('Registrar pagamento') : t.botao.texto)

function LinhaConta({ t }: { t: Tarefa }) {
  return (
    <li className={`is-conta ${t.estado}`}>
      <span className="is-conta-topo">
        <span className="is-conta-nome">{t.titulo}</span>
        <span className="is-conta-valor">{t.valor}{t.aprox && <small>{t.aprox}</small>}</span>
      </span>
      <span className="is-conta-prazo">
        {t.estado === 'atrasada' ? <Icone nome="relogio" tamanho={13} /> : <Icone nome="calendario" tamanho={13} />}
        {t.frase}
      </span>
      <button type="button" className={`btn ${t.chave.startsWith('fatura:') ? '' : 'primario'}`} onClick={t.botao.acao}>{textoDaAcao(t)}</button>
    </li>
  )
}

/**
 * Até 3 contas: o que já venceu e, guardando um lugar, a próxima a vencer (senão atrasos antigos escondem a conta de amanhã).
 * O resto abre no "Ver todas as contas". Recebimentos ficam numa linha à parte: não são contas a pagar.
 */
function ContasAPagar({ tarefas, aoAbrirContas }: { tarefas: Tarefa[]; aoAbrirContas?: () => void }) {
  const [todas, setTodas] = useState(false)
  const pagar = tarefas.filter((t) => !t.entrada)
  const receber = tarefas.filter((t) => t.entrada)
  const g = agruparTarefas(pagar, '9999-12-31')
  const atr = g.atrasadas.length
  const prox = g.proximas.length
  const nProx = todas ? prox : atr ? Math.min(prox, 1, NA_TELA) : Math.min(prox, NA_TELA)
  const nAtr = todas ? atr : Math.min(atr, NA_TELA - nProx)
  // sobrou lugar (poucas atrasadas)? volta para as próximas
  const nProxFinal = todas ? prox : Math.min(prox, NA_TELA - nAtr)
  const escondidas = pagar.length - nAtr - nProxFinal
  const doisGrupos = atr > 0 && prox > 0
  return (
    <section className="bloco is-contas" aria-labelledby="is-contas-titulo">
      <header className="is-cab">
        <h2 id="is-contas-titulo">{tx('Contas a pagar')}</h2>
        {atr > 0
          ? <span className="is-chip neg">{atr === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atr)}</span>
          : pagar.length > 0 && <span className="is-chip">{pagar.length === 1 ? tx('1 em aberto') : tx('{0} em aberto', pagar.length)}</span>}
      </header>
      {!pagar.length && <p className="is-tudo-em-dia"><Icone nome="check" tamanho={17} /> {tx('Nenhuma conta pendente neste mês.')}</p>}
      {nAtr > 0 && (
        <>
          {doisGrupos && <h3 className="is-grupo neg">{tx('Atrasadas')}</h3>}
          <ul className="is-lista-contas">{g.atrasadas.slice(0, nAtr).map((t) => <LinhaConta key={t.chave} t={t} />)}</ul>
        </>
      )}
      {nProxFinal > 0 && (
        <>
          {doisGrupos && <h3 className="is-grupo">{tx('Próximas')}</h3>}
          <ul className="is-lista-contas">{g.proximas.slice(0, nProxFinal).map((t) => <LinhaConta key={t.chave} t={t} />)}</ul>
        </>
      )}
      <div className="is-pe">
        {escondidas > 0 && <button type="button" className="is-ver" onClick={() => setTodas(true)}>{tx('Ver todas as contas ({0})', pagar.length)}</button>}
        {todas && pagar.length > NA_TELA && <button type="button" className="is-ver" onClick={() => setTodas(false)}>{tx('Mostrar menos')}</button>}
        {aoAbrirContas && (todas || !escondidas) && pagar.length > 0 && <button type="button" className="is-ver" onClick={aoAbrirContas}>{tx('Abrir contas do mês')}</button>}
        {receber.length > 0 && aoAbrirContas && (
          <button type="button" className="is-ver discreto" onClick={aoAbrirContas}>
            <Icone nome="receber" tamanho={15} /> {receber.length === 1 ? tx('1 valor a receber') : tx('{0} valores a receber', receber.length)}
          </button>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Orientação, últimos lançamentos e acessos

/** Só o conselho mais importante (o conselheiro já ordena e só fala com dados que sustentam a frase). */
function Orientacao({ c }: { c: Ctx }) {
  const o = c.conselhos[0]
  if (!o) return null
  return (
    <section className={`bloco is-orientacao ${o.gravidade}`} aria-label={tx('Orientação')}>
      <span className="is-orientacao-icone" aria-hidden="true"><Icone nome={o.icone} tamanho={18} /></span>
      <div className="is-orientacao-texto">
        <h2>{o.titulo}</h2>
        <p>{o.porque}</p>
      </div>
      <div className="is-orientacao-acoes">
        <button type="button" className="btn" onClick={() => c.irPara(o.destino)}>{o.botao}</button>
        <button type="button" className="link" onClick={() => c.irPara('analise')}>{tx('Ver análise')}</button>
        <button type="button" className="is-dispensar" onClick={() => c.dispensarConselho(o.id)} title={tx('Esconde este aviso até o mês que vem')}>
          {tx('Agora não')}
        </button>
      </div>
    </section>
  )
}

function UltimosLancamentos({ c, hojeIso }: { c: Ctx; hojeIso: string }) {
  // feitos (até hoje) do mais novo para o mais antigo; agendados (data à frente) só completam a lista, e com etiqueta
  const feitos = c.lancsMes.filter((l) => !l.data || l.data <= hojeIso)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const agendados = c.lancsMes.filter((l) => l.data && l.data > hojeIso).sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))
  const lista: [Lancamento, boolean][] = [
    ...feitos.slice(0, ULTIMOS).map((l) => [l, false] as [Lancamento, boolean]),
    ...agendados.slice(0, Math.max(0, ULTIMOS - feitos.length)).map((l) => [l, true] as [Lancamento, boolean]),
  ]
  const agendadosFora = agendados.length - lista.filter(([, a]) => a).length
  if (!lista.length) return null
  return (
    <section className="bloco is-lancs" aria-labelledby="is-lancs-titulo">
      <header className="is-cab">
        <h2 id="is-lancs-titulo">{tx('Últimos lançamentos')}</h2>
        <button type="button" className="link" onClick={() => c.irPara('lancamentos')}>{tx('Ver todos')}</button>
      </header>
      <ul className="is-lista-lancs">
        {lista.map(([l, agendado]) => {
          const cat = c.categoriaDe(l)
          const entrada = l.tipo === 'entrada'
          return (
            <li key={l.id}>
              <button type="button" className={`is-lanc ${agendado ? 'agendado' : ''}`} onClick={() => c.editarLancamento(l)}>
                <Selo c={cat ?? SEM_CATEGORIA} tamanho={30} />
                <span className="is-lanc-corpo">
                <span className="is-lanc-texto">
                  <span className="is-lanc-desc">{l.descricao || (entrada ? tx('Entrada') : tx('Saída'))}</span>
                  <span className="is-lanc-meta">
                    {agendado && <span className="is-tag">{tx('agendado')}</span>}
                    {l.cartao_id && <span className="is-tag cartao">{tx('no cartão')}</span>}
                    {l.data && fmtDataCurta(l.data)}
                    {cat && <> · {cat.nome}</>}
                  </span>
                </span>
                <span className={`is-lanc-valor ${entrada ? 'mais' : ''}`}>{entrada ? '+' : '−'} {fmtValor(l.valor)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {agendadosFora > 0 && (
        <p className="is-nota pe">{agendadosFora === 1 ? tx('Mais 1 lançamento agendado para depois de hoje.') : tx('Mais {0} lançamentos agendados para depois de hoje.', agendadosFora)}</p>
      )}
    </section>
  )
}

function Acesso({ icone, cor, titulo, sub, valor, aoAbrir }: { icone: string; cor: string; titulo: string; sub?: ReactNode; valor?: string; aoAbrir: () => void }) {
  return (
    <li>
      <button type="button" className="is-acesso" onClick={aoAbrir} style={{ '--c': cor } as React.CSSProperties}>
        <span className="is-acesso-icone" aria-hidden="true"><Icone nome={icone} tamanho={18} /></span>
        <span className="is-acesso-texto">
          <span className="is-acesso-titulo">{titulo}</span>
          {sub && <small>{sub}</small>}
        </span>
        {valor && <b className="is-acesso-valor">{valor}</b>}
        <Icone nome="dir" tamanho={16} />
      </button>
    </li>
  )
}

const caixaInformado = (caixa: Ctx['mesEf']['caixa']) => Object.values(caixa ?? {}).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number'))

function Acessos({ c, metas, aoAbrirGastos }: { c: Ctx; metas: SituacaoMeta[]; aoAbrirGastos?: () => void }) {
  const { v } = c
  const itens: ReactNode[] = []
  if (aoAbrirGastos) {
    const maior = fatiasDeGastos(c.r.gastosPorCategoria, c.categorias, Infinity)[0]
    itens.push(
      <Acesso key="gastos" icone="ano" cor="var(--marca-2)" titulo={tx('Gastos por categoria')} aoAbrir={aoAbrirGastos}
        sub={maior && c.r.saidas > 0 ? tx('Maior: {0} ({1}%)', maior.nome, Math.round((maior.valor / c.r.saidas) * 100)) : undefined} />,
    )
  }
  if (v.dividas) {
    const abertas = c.situacao.filter((s) => s.restante > 0 && !s.semCotacao)
    if (abertas.length) {
      itens.push(
        <Acesso key="dividas" icone="divida" cor="var(--saida)" titulo={tx('Dívidas')} valor={fmtValor(abertas.reduce((t, s) => t + s.restanteHoje, 0))}
          sub={abertas.length === 1 ? tx('Total que falta pagar · 1 dívida') : tx('Total que falta pagar · {0} dívidas', abertas.length)} aoAbrir={() => c.irPara('dividas')} />,
      )
    }
  }
  if (v.metas && !c.d.metasSemTabela) {
    const guardado = metas.reduce((t, s) => t + (converter(s.guardado, s.meta.moeda, c.taxas) ?? 0), 0)
    const ativas = metas.filter((s) => !s.batida).length
    itens.push(
      <Acesso key="metas" icone="meta" cor="var(--violeta)" titulo={tx('Metas')} aoAbrir={() => c.irPara('metas')}
        sub={!metas.length ? tx('Crie uma meta para juntar dinheiro')
          : ativas ? tx('{0} em andamento · {1} guardado', ativas, fmtValor(guardado)) : tx('Todas batidas · {0} guardado', fmtValor(guardado))} />,
    )
  }
  if (v.bancos || v.investimentos || v.moedas) {
    // só o que foi informado entra no total: investimento não informado não vira "R$ 0,00 investido"
    const ef = c.mesEf
    const comCaixa = v.bancos && caixaInformado(ef.caixa)
    const nasContas = c.d.bancos.reduce((t, b) => t + caixaDoBanco(ef.caixa, b.id), 0)
    const comInvest = v.investimentos && (c.r.investimentos > 0 || Boolean(ef.investimentosDaCarteira))
    const emMoedas = v.moedas ? c.perfil.moedas.reduce((t, m) => t + (converter(ef.moedas[m] ?? 0, m, c.taxas) ?? 0), 0) : 0
    const total = (comCaixa ? nasContas : 0) + (comInvest ? c.r.investimentos : 0) + emMoedas
    const partes = [
      v.bancos && (comCaixa ? tx('Saldo nas contas {0}', fmtValor(nasContas)) : tx('Saldos das contas não informados')),
      v.investimentos && (comInvest ? tx('Investido {0}', fmtValor(c.r.investimentos)) : tx('Investimentos não informados')),
      v.moedas && emMoedas > 0 && tx('Outras moedas {0}', fmtValor(emMoedas)),
      ef.herdadoDe && tx('valores de {0}', fmtMesAno(ef.herdadoDe[0], ef.herdadoDe[1])),
    ].filter(Boolean)
    itens.push(
      <Acesso key="dinheiro" icone="cofre" cor="var(--caixa)" titulo={tx('Contas e investimentos')} valor={comCaixa || comInvest || emMoedas ? fmtValor(total) : undefined}
        sub={partes.join(' · ')} aoAbrir={() => c.irPara('patrimonio')} />,
    )
  }
  if (!itens.length) return null
  return (
    <section className="bloco is-acessos" aria-label={tx('Mais informações')}>
      <ul>{itens}</ul>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Janelas: gastos por categoria e o jeito de ver

function JanelaGastos({ c, nomeMes, saiuAteHoje, momento, aoFechar }: {
  c: Ctx; nomeMes: string; saiuAteHoje: number; momento: 'atual' | 'passado' | 'futuro'; aoFechar: () => void
}) {
  const total = c.r.saidas
  // todas as categorias, sem juntar o resto: "Outros" aqui é sempre a categoria de verdade
  const fatias = fatiasDeGastos(c.r.gastosPorCategoria, c.categorias, Infinity)
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const fmtPct = (n: number) => (n > 0 && n < 1 ? '<1%' : `${Math.round(n)}%`)
  return (
    <Modal titulo={tx('Gastos por categoria')} aoFechar={aoFechar}>
      <div className="is-gastos">
        <p className="is-gastos-total">
          {tx('Tudo o que foi lançado como saída em {0}', nomeMes)}
          <b>{fmtValor(total)}</b>
        </p>
        <p className="is-nota">
          {tx('Inclui compras no cartão e contas com data mais à frente no mês. Cada porcentagem é a parte deste total, e a barra tem o mesmo tamanho da porcentagem.')}
          {momento === 'atual' && Math.abs(total - saiuAteHoje) >= 0.01 && (
            <> {tx('No resumo, “Saiu” mostra {0}: ali entra só o que já saiu do bolso até hoje, e a compra no cartão entra quando a fatura é paga.', fmtValor(saiuAteHoje))}</>
          )}
        </p>
        {fatias.length ? (
          <ul className="is-gastos-lista">
            {fatias.map((f) => (
              <li key={f.id}>
                <Selo c={f} tamanho={28} />
                <span className="is-gastos-nome">{f.nome}</span>
                <span className="is-gastos-valor">{fmtValor(f.valor)} <small>{fmtPct(pct(f.valor))}</small></span>
                <span className="is-gastos-barra" aria-hidden="true"><span style={{ width: `${pct(f.valor)}%`, background: f.cor }} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="is-nota">{tx('Quando você lançar saídas, aparece aqui em que você mais gasta.')}</p>
        )}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={() => { aoFechar(); c.gerenciarCategorias() }}>{tx('Editar categorias')}</button>
          <span className="espaco" />
          <button type="button" className="btn primario" onClick={() => { aoFechar(); c.irPara('lancamentos') }}>{tx('Ver lançamentos')}</button>
        </div>
      </div>
    </Modal>
  )
}

function JanelaModo({ atual, aoEscolher, aoFechar }: { atual: Detalhe; aoEscolher: (d: Detalhe) => void; aoFechar: () => void }) {
  return (
    <Modal titulo={tx('Jeito de ver')} aoFechar={aoFechar}>
      <div className="is-modos" role="radiogroup" aria-label={tx('Jeito de ver')}>
        {DETALHES.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={atual === d.id} className={`is-modo ${atual === d.id ? 'ativo' : ''}`}
            onClick={() => aoEscolher(d.id)}>
            <span className="is-modo-texto"><strong>{d.nome}</strong><small>{d.descricao}</small></span>
            <i className="is-modo-marca" aria-hidden="true">{atual === d.id && <Icone nome="check" tamanho={13} />}</i>
          </button>
        ))}
      </div>
      <p className="is-nota">{tx('Dá para trocar quando quiser. O app não muda o jeito sozinho.')}</p>
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export function InicioSimples({ c, dd, composicao, momento, nomeMes, hojeIso, metas, aoEntender, extras }: {
  c: Ctx
  /** O mês dia a dia já com as parcelas de dívida (a mesma base dos outros jeitos). */
  dd: DiaADia
  composicao: ComposicaoDaPrevisao
  momento: 'atual' | 'passado' | 'futuro'
  nomeMes: string
  hojeIso: string
  metas: SituacaoMeta[]
  aoEntender: () => void
  /** Janelas e convites que a Início já monta (formulário de dívida, "Ver cálculo", sugestões). */
  extras: ReactNode
}) {
  const { v } = c
  const refAcoes = useAcoesDeLancar<HTMLDivElement>()
  const [baixa, setBaixa] = useState<SituacaoConta | null>(null)
  const [gastos, setGastos] = useState(false)
  const [modo, setModo] = useState(false)
  const vazio = c.lancsMes.length === 0

  // "Marcar como paga": se o dinheiro parece já estar num lançamento, o app pergunta antes (como no "Paguei" de sempre);
  // senão abre a conferência do valor, do dia e do banco
  const marcarComoPaga = (s: SituacaoConta) => (c.sugestaoDaConta(s.conta.id) && !s.semCotacao ? c.pagarConta(s) : setBaixa(s))
  const tarefas = tarefasDoMes({
    ano: c.ano, mes: c.mes, contas: v.contas ? c.situacoesContas : [], faturas: v.cartoes ? c.faturas : [],
    dividas: v.dividas ? c.situacao.filter((s) => s.restante > 0) : [],
    diaRef: c.diaRef, aoPagarConta: marcarComoPaga, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
  }).lista
  const comContas = (v.contas && c.situacoesContas.length > 0) || (v.cartoes && c.faturas.length > 0) || (v.dividas && c.situacao.some((s) => s.restante > 0))
  const previsaoPossivel = composicao.receber.length + composicao.pagar.length > 0 || (!vazio && v.contas && c.situacoesContas.length > 0)
  const primeiroNome = c.perfil.nome.trim().split(/\s+/)[0]

  return (
    <div className="pagina inicio inicio-simples">
      <h1 className="is-ola">
        {primeiroNome ? <>{tx('Olá,')} <span className="nome" translate="no">{primeiroNome}!</span></> : tx('Olá!')}
      </h1>
      <div className="is-grade">
        <div className="is-col">
          <ResumoDoMes dd={dd} composicao={composicao} momento={momento} vazio={vazio} nomeMes={nomeMes} previsaoPossivel={previsaoPossivel}
            aoVerCalculo={aoEntender} aoCadastrarContas={v.contas ? () => c.irPara('contas') : undefined} />
          <div className="is-acoes" data-tour="lancar" ref={refAcoes}>
            <button type="button" className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={18} /> {tx('Registrar entrada')}</button>
            <button type="button" className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={18} /> {tx('Registrar saída')}</button>
          </div>
          {comContas && <ContasAPagar tarefas={tarefas} aoAbrirContas={v.contas ? () => c.irPara('contas') : undefined} />}
        </div>
        <div className="is-col">
          <Orientacao c={c} />
          <UltimosLancamentos c={c} hojeIso={hojeIso} />
          <Acessos c={c} metas={metas} aoAbrirGastos={!vazio && c.r.saidas > 0 ? () => setGastos(true) : undefined} />
        </div>
      </div>
      <p className="is-modo-atual">
        {tx('Modo simples')} · <button type="button" className="link" onClick={() => setModo(true)}>{tx('Alterar')}</button>
      </p>
      {extras}
      {baixa && <FormBaixa c={c} s={baixa} aoFechar={() => setBaixa(null)} />}
      {gastos && <JanelaGastos c={c} nomeMes={nomeMes} saiuAteHoje={dd.saiu} momento={momento} aoFechar={() => setGastos(false)} />}
      {modo && (
        <JanelaModo atual={c.perfil.detalhe} aoFechar={() => setModo(false)}
          aoEscolher={(d) => { setModo(false); if (d !== c.perfil.detalhe) void c.d.salvarPerfil({ ...c.perfil, detalhe: d }) }} />
      )}
    </div>
  )
}
