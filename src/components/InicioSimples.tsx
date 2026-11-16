/**
 * A Início no jeito simples (computador e tablet; o celular tem a sua em src/movel), no mesmo layout da equilibrada, com
 * menos coisa: Visão geral (quanto entrou e saiu, como o mês pode terminar, registrar entrada ou saída e as contas a pagar)
 * e Seu próximo passo (uma orientação, os últimos lançamentos e acessos curtos para gastos, dívidas, metas e dinheiro).
 * Sem gráficos nem comparação. Os detalhes continuam a um toque: "Ver cálculo" abre a conta da previsão, "Gastos por
 * categoria" abre a distribuição inteira e cada acesso leva à sua tela. Todos os números saem das mesmas contas dos outros
 * jeitos (lib/previsao.ts, lib/paraFazer.ts). Veja docs/arquitetura-do-painel.md, seção 4.1.
 */
import { useState, type ReactNode } from 'react'
import { caixaDoBanco } from '../lib/calc'
import { fatiasDeGastos } from '../lib/categorias'
import type { SituacaoConta } from '../lib/contasFixas'
import { fmtDataCurta, fmtMesAno, fmtValor, LOCAL_DAS_DATAS } from '../lib/format'
import type { SituacaoMeta } from '../lib/metas'
import { converter } from '../lib/moedas'
import { tarefasDoMes, type Tarefa } from '../lib/paraFazer'
import type { ComposicaoDaPrevisao, DiaADia } from '../lib/previsao'
import { tx } from '../lib/textos'
import { TIPOS_CAIXA, type Lancamento } from '../lib/types'
import { useAcoesDeLancar } from '../lib/botaoMais'
import type { Ctx } from '../pages/contexto'
import { Selo } from './Categorias'
import { FormBaixa } from './FormBaixa'
import { Icone } from './Icone'
import { SEM_CATEGORIA } from '../lib/categorias'
import { Modal } from './ui'
import { CabecalhoEq, ContasEq, OrientacaoEq, PilulaDoJeito, ResumosCompactos, Tile, TopoEq, type ResumoCompacto } from './InicioEquilibrado'
import './inicio-simples.css'

const centavos = (n: number) => Math.round(n * 100) / 100
/** Lançamentos mostrados na Início. */
const ULTIMOS = 3

/** Valor com sinal de menos quando é negativo: o sentido não pode depender só da cor. */
const comSinal = (n: number) => `${n < 0 ? '− ' : ''}${fmtValor(Math.abs(n))}`

// ---------------------------------------------------------------------------------------------------------------------
// Visão geral: resultado do mês e previsão

function ResultadoSimples({ dd, momento, vazio, nomeMes, aoVerCalculo }: {
  dd: DiaADia
  momento: 'atual' | 'passado' | 'futuro'
  /** Nenhum lançamento no mês. */
  vazio: boolean
  nomeMes: string
  aoVerCalculo: () => void
}) {
  const futuro = momento === 'futuro'
  // num mês que ainda não começou, o que já está lançado para ele; nos outros, só o que já aconteceu (como nos outros jeitos)
  const entrou = futuro ? dd.vaiEntrar : dd.entrou
  const saiu = futuro ? dd.vaiSair : dd.saiu
  const resultado = centavos(entrou - saiu)
  const semNada = vazio && entrou === 0 && saiu === 0
  const rotulo = momento === 'atual' ? tx('Resultado do mês até hoje') : futuro ? tx('Já lançado para {0}', nomeMes) : tx('Resultado de {0}', nomeMes)
  const tom = resultado > 0 ? 'bom' : resultado < 0 ? 'ruim' : 'zero'
  return (
    <section className="cartao eq-cartao eq-resultado is-resultado" aria-label={tx('Resumo do mês')}>
      <header className="eq-cartao-cab">
        <Tile icone="carteira" cor="var(--entrada)" />
        <h3>{rotulo}</h3>
      </header>
      {semNada ? (
        <p className="is-vazio">{tx('Nada registrado em {0} ainda. Comece registrando uma entrada ou uma saída.', nomeMes)}</p>
      ) : (
        <>
          <strong className={`eq-enorme ${tom}`}>{comSinal(resultado)}</strong>
          {resultado < 0 && <p className="is-explica">{futuro ? tx('Já há mais saídas lançadas do que entradas.') : tx('Saiu mais do que entrou.')}</p>}
          <div className="is-entrou-saiu">
            <span className="entrou"><Icone nome="sobe" tamanho={17} /> {futuro ? tx('Vai entrar') : tx('Entrou')} <b>{fmtValor(entrou)}</b></span>
            <span className="saiu"><Icone nome="desce" tamanho={17} /> {futuro ? tx('Vai sair') : tx('Saiu')} <b>{fmtValor(saiu)}</b></span>
          </div>
        </>
      )}
      {momento === 'passado' && !semNada && (
        <button type="button" className="eq-link is-pe-cartao" onClick={aoVerCalculo}>{tx('Ver como o mês fechou')} <Icone nome="dir" tamanho={15} /></button>
      )}
      {futuro && !semNada && <p className="is-nota is-pe-cartao">{tx('O mês ainda não começou: isto é o que já está lançado para ele, como parcelas e compras no cartão.')}</p>}
    </section>
  )
}

function PrevisaoSimples({ composicao, previsaoPossivel, aoVerCalculo, aoCadastrarContas }: {
  composicao: ComposicaoDaPrevisao
  /** Há o que prever: algo ainda a pagar ou receber, ou contas do mês cadastradas (aí "nada pendente" também é informação). */
  previsaoPossivel: boolean
  aoVerCalculo: () => void
  /** Leva às Contas do mês (só com o módulo ligado). */
  aoCadastrarContas?: () => void
}) {
  // a mesma conta do "Ver cálculo" (lib/previsao.ts → comporPrevisao): o que já entrou − o que já saiu + o que vem − o que vai sair
  const previsto = composicao.resultado
  const escala = Math.max(composicao.entrou + composicao.totalReceber, composicao.saiu + composicao.totalPagar)
  const pertoDeZero = Math.abs(previsto) < Math.max(10, escala * 0.02)
  const tom = !previsaoPossivel ? 'sem' : pertoDeZero ? 'zero' : previsto < 0 ? 'ruim' : 'bom'
  return (
    <section className={`cartao eq-cartao is-previsao ${tom}`} aria-label={tx('Previsão para o fim do mês')}>
      <header className="eq-cartao-cab">
        <Tile icone="calendario" cor={tom === 'ruim' ? 'var(--saida)' : 'var(--entrada)'} />
        <h3>{tx('Previsão para o fim do mês')}</h3>
      </header>
      {previsaoPossivel ? (
        <>
          <p className="is-previsao-frase">
            {pertoDeZero
              ? <>{tx('Deve fechar perto de zero')} <small>({comSinal(previsto)})</small></>
              : previsto < 0
                ? <><Icone nome="alerta" tamanho={24} />{tx('Pode faltar')} <b>{fmtValor(-previsto)}</b></>
                : <><Icone nome="check" tamanho={24} />{tx('Pode sobrar')} <b>{fmtValor(previsto)}</b></>}
          </p>
          <p className="is-nota">{tx('Conta com o que está registrado e pode mudar.')}</p>
          <button type="button" className="eq-link is-pe-cartao" onClick={aoVerCalculo}>{tx('Ver cálculo')} <Icone nome="dir" tamanho={15} /></button>
        </>
      ) : (
        <>
          <p className="is-previsao-frase sem">{tx('Ainda não há dados suficientes para prever.')}</p>
          <p className="is-nota">{tx('Cadastre o que entra e sai todo mês (salário, aluguel, contas) para o app prever.')}</p>
          {aoCadastrarContas && <button type="button" className="eq-link is-pe-cartao" onClick={aoCadastrarContas}>{tx('Cadastrar contas')} <Icone nome="dir" tamanho={15} /></button>}
        </>
      )}
    </section>
  )
}

/** Ação de cada linha, conforme o que o app faz de verdade: dar baixa numa conta, abrir a fatura ou lançar o pagamento da parcela. */
const textoDaAcao = (t: Tarefa) => (t.origem === 'fatura' ? tx('Ver fatura') : t.origem === 'parcela' ? tx('Registrar pagamento') : tx('Marcar como paga'))

// ---------------------------------------------------------------------------------------------------------------------
// Seu próximo passo: últimos lançamentos e acessos

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
  return (
    <section className="cartao eq-cartao is-lancs" aria-labelledby="is-lancs-titulo">
      <header className="is-cab">
        <h3 id="is-lancs-titulo">{tx('Últimos lançamentos')}</h3>
        <button type="button" className="eq-link" onClick={() => c.irPara('lancamentos')}>{tx('Ver todos')} <Icone nome="dir" tamanho={15} /></button>
      </header>
      {lista.length ? (
        <ul className="is-lista-lancs">
          {lista.map(([l, agendado]) => {
            const cat = c.categoriaDe(l)
            const entrada = l.tipo === 'entrada'
            return (
              <li key={l.id}>
                <button type="button" className={`is-lanc ${agendado ? 'agendado' : ''}`} onClick={() => c.editarLancamento(l)}>
                  <Selo c={cat ?? SEM_CATEGORIA} tamanho={32} />
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
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="is-nota">{tx('Nenhum lançamento neste mês ainda.')}</p>
      )}
      {agendadosFora > 0 && (
        <p className="is-nota is-pe-cartao">{agendadosFora === 1 ? tx('Mais 1 lançamento agendado para depois de hoje.') : tx('Mais {0} lançamentos agendados para depois de hoje.', agendadosFora)}</p>
      )}
    </section>
  )
}

const caixaInformado = (caixa: Ctx['mesEf']['caixa']) => Object.values(caixa ?? {}).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number'))

/** Gastos por categoria, dívidas, metas e contas e investimentos, em cartões curtos: tocar abre a janela ou a página. */
function acessos(c: Ctx, metas: SituacaoMeta[], aoAbrirGastos?: () => void): ResumoCompacto[] {
  const { v } = c
  const itens: ResumoCompacto[] = []
  if (aoAbrirGastos) {
    const maior = fatiasDeGastos(c.r.gastosPorCategoria, c.categorias, Infinity)[0]
    if (maior && c.r.saidas > 0) {
      itens.push({
        chave: 'gastos', icone: 'barras', cor: 'var(--marca-2)', rotulo: tx('Gastos por categoria'), texto: true,
        valor: maior.nome, sub: tx('O maior gasto: {0}% do que saiu no mês', Math.round((maior.valor / c.r.saidas) * 100)), aoAbrir: aoAbrirGastos,
      })
    }
  }
  if (v.dividas) {
    const abertas = c.situacao.filter((s) => s.restante > 0 && !s.semCotacao)
    if (abertas.length) {
      itens.push({
        chave: 'dividas', icone: 'cartao', cor: 'var(--divida)', rotulo: tx('Dívidas'), valor: fmtValor(abertas.reduce((t, s) => t + s.restanteHoje, 0)),
        sub: abertas.length === 1 ? tx('Total que falta pagar · 1 dívida') : tx('Total que falta pagar · {0} dívidas', abertas.length), aoAbrir: () => c.irPara('dividas'),
      })
    }
  }
  if (v.metas && !c.d.metasSemTabela) {
    const guardado = metas.reduce((t, s) => t + (converter(s.guardado, s.meta.moeda, c.taxas) ?? 0), 0)
    const ativas = metas.filter((s) => !s.batida).length
    itens.push({
      chave: 'metas', icone: 'meta', cor: 'var(--violeta)', rotulo: tx('Metas'), aoAbrir: () => c.irPara('metas'),
      ...(metas.length
        ? { valor: fmtValor(guardado), sub: ativas ? (ativas === 1 ? tx('Guardado · 1 meta em andamento') : tx('Guardado · {0} metas em andamento', ativas)) : tx('Guardado · todas as metas batidas') }
        : { valor: tx('Nenhuma meta ainda'), texto: true, sub: tx('Crie uma meta para juntar dinheiro') }),
    })
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
    const informado = comCaixa || comInvest || emMoedas > 0
    itens.push({
      chave: 'dinheiro', icone: 'cofre', cor: 'var(--caixa)', rotulo: tx('Contas e investimentos'),
      valor: informado ? fmtValor(total) : tx('Não informado'), texto: !informado, sub: partes.join(' · '), aoAbrir: () => c.irPara('patrimonio'),
    })
  }
  return itens
}

// ---------------------------------------------------------------------------------------------------------------------
// Janela: gastos por categoria

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
  const vazio = c.lancsMes.length === 0

  // "Marcar como paga": se o dinheiro parece já estar num lançamento, o app pergunta antes (como no "Paguei" de sempre);
  // senão abre a conferência do valor, do dia e do banco
  const marcarComoPaga = (s: SituacaoConta) => (c.sugestaoDaConta(s.conta.id) && !s.semCotacao ? c.pagarConta(s) : setBaixa(s))
  const tarefas = tarefasDoMes({
    ano: c.ano, mes: c.mes, contas: v.contas ? c.situacoesContas : [], faturas: v.cartoes ? c.faturas : [],
    dividas: v.dividas ? c.situacao.filter((s) => s.restante > 0) : [],
    diaRef: c.diaRef, aoPagarConta: marcarComoPaga, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
  }).lista
  // recebimentos não são contas a pagar: viram um link no pé das contas
  const pagar = tarefas.filter((t) => !t.entrada)
  const receber = tarefas.length - pagar.length
  const comContas = (v.contas && c.situacoesContas.length > 0) || (v.cartoes && c.faturas.length > 0) || (v.dividas && c.situacao.some((s) => s.restante > 0))
  const previsaoPossivel = composicao.receber.length + composicao.pagar.length > 0 || (!vazio && v.contas && c.situacoesContas.length > 0)
  const hojePorExtenso = new Date(`${hojeIso}T12:00:00`).toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })
  const modo = <PilulaDoJeito atual="simples" aoMudar={c.mudarDetalhe} />
  const itens = acessos(c, metas, !vazio && c.r.saidas > 0 ? () => setGastos(true) : undefined)
  const temOrientacao = c.conselhos.length > 0

  const registrar = (
    <div className="is-acoes" data-tour="lancar" ref={refAcoes}>
      <button type="button" className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={18} /> {tx('Registrar entrada')}</button>
      <button type="button" className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={18} /> {tx('Registrar saída')}</button>
    </div>
  )

  return (
    <div className="pagina inicio inicio-eq inicio-simples">
      {/* ---------- 1. Visão geral ---------- */}
      <section className="eq-secao" aria-label={tx('Visão geral')}>
        <TopoEq nome={c.perfil.nome ?? ''} modo={modo} registrar={registrar} />
        <div className={`eq-duas${momento === 'atual' ? '' : ' uma'}`}>
          <ResultadoSimples dd={dd} momento={momento} vazio={vazio} nomeMes={nomeMes} aoVerCalculo={aoEntender} />
          {momento === 'atual' && (
            <PrevisaoSimples composicao={composicao} previsaoPossivel={previsaoPossivel} aoVerCalculo={aoEntender}
              aoCadastrarContas={v.contas ? () => c.irPara('contas') : undefined} />
          )}
        </div>
        {comContas && (
          <ContasEq titulo={tx('Contas a pagar')} tituloProximas={momento === 'passado' ? undefined : tx('Próximas')} tarefas={pagar} hoje={hojePorExtenso} aoAgir={(t) => t.botao.acao()} botaoNasProximas acaoDaConta={textoDaAcao}
            aoVerContas={v.contas ? () => c.irPara('contas') : undefined}
            pe={receber > 0 && v.contas ? (
              <button type="button" className="eq-link is-receber" onClick={() => c.irPara('contas')}>
                <Icone nome="receber" tamanho={15} /> {receber === 1 ? tx('1 valor a receber') : tx('{0} valores a receber', receber)}
              </button>
            ) : undefined} />
        )}
      </section>

      {/* ---------- 2. Seu próximo passo ---------- */}
      <section className="eq-secao" aria-label={tx('Seu próximo passo')}>
        <CabecalhoEq modo={modo} titulo={tx('Seu próximo passo')} sub={tx('O que fazer agora e onde está o seu dinheiro')} hoje={hojePorExtenso} />
        <div className={`eq-duas${temOrientacao ? ' is-passo' : ' uma'}`}>
          {temOrientacao && (
            <OrientacaoEq conselhos={c.conselhos.slice(0, 1)} semDados={c.conselhosSemDados} aoIr={c.irPara} aoDispensar={c.dispensarConselho}
              aoAnalise={() => c.irPara('analise')} />
          )}
          <UltimosLancamentos c={c} hojeIso={hojeIso} />
        </div>
        <ResumosCompactos itens={itens} />
      </section>

      {extras}
      {baixa && <FormBaixa c={c} s={baixa} aoFechar={() => setBaixa(null)} />}
      {gastos && <JanelaGastos c={c} nomeMes={nomeMes} saiuAteHoje={dd.saiu} momento={momento} aoFechar={() => setGastos(false)} />}
    </div>
  )
}
