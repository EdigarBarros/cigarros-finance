/**
 * Peças da Início no jeito equilibrado (celular primeiro): o resultado do mês com a previsão, o botão de registrar, as contas
 * por prioridade, a comparação com o mês anterior, os principais gastos, uma orientação, os resumos do que você tem e o
 * seletor do jeito de ver. O que é explicação longa ou lista completa abre por toque (veja docs/arquitetura-do-painel.md, 4.0.4).
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import { fmtValor, MESES_CURTO, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { Icone } from './Icone'
import { IconeCategoria } from './IconeCategoria'
import { Modal } from './ui'
import { tx } from '../lib/textos'
import { agruparTarefas, fraseDoAtraso, type Tarefa } from '../lib/paraFazer'
import { destaqueDaComparacao, fatiasDoPeriodo, type ComparacaoDeGastos, type FatiaDoPeriodo } from '../lib/comparacao'
import { SEM_CATEGORIA } from '../lib/categorias'
import type { Categoria, Detalhe } from '../lib/types'
import type { Conselho, Gravidade } from '../lib/conselheiro'
import type { Tom } from '../lib/analise'
import { fmtDataCurta } from '../lib/format'
import { useAcoesDeLancar } from '../lib/botaoMais'
import './entender.css'
import './inicio-equilibrado.css'

const comSinal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtValor(Math.abs(n))}`
const maiuscula = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t)

// ---------------------------------------------------------------- saudação

export function SaudacaoEq({ nome }: { nome: string }) {
  return (
    <header className="pagina-topo ieq-saudacao">
      <h1>{nome ? <>{tx('Olá,')}{'\u00a0'}<span className="nome" translate="no">{nome}!</span></> : tx('Olá!')}</h1>
    </header>
  )
}

// ---------------------------------------------------------------- 1. resumo do mês

/**
 * Parte A: o resultado do mês até hoje (entrou menos saiu; não é o saldo do banco). Parte B, no mesmo cartão: o que ainda
 * vem até o fim do mês e como ele deve fechar, com "Ver cálculo" abrindo a conta item por item (EntenderMes).
 */
export function ResumoEq({ dd, nomeMes, momento, mesVazio, carregando, previsaoSabe, faturaAberta, aoVerCalculo }: {
  dd: DiaADia; nomeMes: string
  momento: 'atual' | 'passado' | 'futuro'
  /** Nenhum lançamento no mês: o resultado não é um zero confirmado. */
  mesVazio: boolean
  carregando: boolean
  /** Há contas do mês ou cartões ligados: sem eles a previsão não tem o que somar. */
  previsaoSabe: boolean
  /** Há compras em fatura ainda aberta: elas estão em "A pagar", não no "Saiu" (a comparação e os gastos já as contam). */
  faturaAberta?: boolean
  aoVerCalculo: () => void
}) {
  if (carregando && mesVazio) {
    return (
      <section className="cartao ieq-resumo-mes" aria-busy="true" aria-label={tx('Carregando')}>
        <span className="esqueleto ieq-esq-linha" /><span className="esqueleto ieq-esq-valor" /><span className="esqueleto ieq-esq-linha" />
      </section>
    )
  }
  const futuro = momento === 'futuro'
  const ateHoje = Math.round((dd.entrou - dd.saiu) * 100) / 100
  const fim = Math.round((ateHoje + dd.vaiEntrar - dd.vaiSair) * 100) / 100
  const valor = futuro ? Math.round((dd.vaiEntrar - dd.vaiSair) * 100) / 100 : ateHoje
  const rotulo = futuro ? tx('Previsto para {0}', nomeMes)
    : momento === 'passado' ? tx('Resultado de {0}', nomeMes) : tx('Resultado do mês até hoje')
  const entrou = futuro ? dd.vaiEntrar : dd.entrou
  const saiu = futuro ? dd.vaiSair : dd.saiu
  const tom = valor > 0 ? 'bom' : valor < 0 ? 'ruim' : 'zero'
  const semNada = mesVazio && !futuro
  const comPrevisao = momento === 'atual' && (dd.vaiEntrar > 0 || dd.vaiSair > 0)
  return (
    <section className="cartao ieq-resumo-mes" aria-label={tx('Resumo do mês')}>
      <div className="ieq-parte">
        <span className="ieq-rot">{rotulo}</span>
        {semNada ? (
          <p className="ieq-nada">{tx('Nenhum lançamento em {0} ainda.', nomeMes)}</p>
        ) : (
          <>
            <strong className={`ieq-grande ${tom}`}>{valor < 0 ? '− ' : ''}{fmtValor(Math.abs(valor))}</strong>
            <div className="ieq-lados">
              <span><i className="entrou" aria-hidden="true" />{futuro ? tx('Vai entrar') : tx('Entrou')} <b>{fmtValor(entrou)}</b></span>
              <span><i className="saiu" aria-hidden="true" />{futuro ? tx('Vai sair') : tx('Saiu')} <b>{fmtValor(saiu)}</b></span>
            </div>
            {faturaAberta && momento === 'atual' && <small className="ieq-nota-resumo">{tx('Compras no cartão ficam em “A pagar” até a fatura ser paga.')}</small>}
          </>
        )}
      </div>
      {momento === 'atual' && (
        <div className="ieq-parte ieq-previsao">
          <span className="ieq-rot">{tx('Até o fim do mês')}</span>
          {comPrevisao ? (
            <>
              <p className="ieq-linha-prev"><span>{tx('A pagar')} <small>{tx('pendente')}</small></span><b>{fmtValor(dd.vaiSair)}</b></p>
              <p className="ieq-linha-prev"><span>{tx('A receber')} <small>{tx('previsto')}</small></span><b className="bom">{fmtValor(dd.vaiEntrar)}</b></p>
              <p className={`ieq-fecho ${fim < 0 ? 'ruim' : fim > 0 ? 'bom' : 'zero'}`}>
                <span>{fim < 0 ? tx('Pode faltar') : fim > 0 ? tx('Deve sobrar') : tx('Deve fechar no zero')}</span>
                {fim !== 0 && <b>{fmtValor(Math.abs(fim))}</b>}
              </p>
            </>
          ) : (
            <p className="ieq-sem-prev">
              {previsaoSabe
                ? tx('Nada mais a pagar ou a receber previsto. O mês deve fechar como está.')
                : tx('Sem contas do mês nem cartões cadastrados, não dá para prever o resto do mês.')}
            </p>
          )}
          <button type="button" className="ieq-link" onClick={aoVerCalculo}>{tx('Ver cálculo')} <Icone nome="dir" tamanho={14} /></button>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 2. registrar

/** "+ Registrar" no fluxo da página (no lugar do botão flutuante): abre entrada, saída e as outras formas de registrar. */
export function RegistrarEq({ aoEntrada, aoSaida, aoImportar }: { aoEntrada: () => void; aoSaida: () => void; aoImportar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useAcoesDeLancar<HTMLDivElement>()
  return (
    <div className="ieq-registrar" ref={ref} data-tour="lancar">
      <button type="button" className="btn primario ieq-registrar-btn" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <Icone nome={aberto ? 'fechar' : 'mais'} tamanho={18} /> {aberto ? tx('Fechar') : tx('Registrar')}
      </button>
      {aberto && (
        <div className="ieq-registrar-opcoes" role="group" aria-label={tx('O que registrar?')}>
          <button type="button" className="ieq-opcao entrada" onClick={() => { setAberto(false); aoEntrada() }}>
            <Icone nome="sobe" tamanho={18} /><span><b>{tx('Entrada')}</b><small>{tx('Dinheiro que entrou')}</small></span>
          </button>
          <button type="button" className="ieq-opcao saida" onClick={() => { setAberto(false); aoSaida() }}>
            <Icone nome="desce" tamanho={18} /><span><b>{tx('Saída')}</b><small>{tx('Dinheiro que saiu, no débito, Pix ou cartão')}</small></span>
          </button>
          <button type="button" className="ieq-link" onClick={() => { setAberto(false); aoImportar() }}>
            <Icone nome="relatorio" tamanho={15} /> {tx('Importar extrato')}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 3. contas e vencimentos

const VISIVEIS = 2

function LinhaConta({ t, aoAgir }: { t: Tarefa; aoAgir: (t: Tarefa) => void }) {
  const dia = t.vencimento.slice(8, 10)
  const mes = noMeioDaFrase(MESES_CURTO[Number(t.vencimento.slice(5, 7)) - 1])
  const quando = t.estado === 'atrasada' ? fraseDoAtraso(t) : t.frase
  const acao = t.origem === 'fatura' ? tx('Ver fatura')
    : t.entrada ? tx('Marcar como recebida') : tx('Marcar como paga')
  // parcela: o valor é a soma do que vence no mês; o saldo da dívida inteira fica separado, com nome
  const detalhe = t.origem === 'parcela' && t.parcelas
    ? (t.parcelas > 1
      ? (t.vencidas ? tx('Soma de {0} parcelas ({1} vencidas)', t.parcelas, t.vencidas) : tx('Soma de {0} parcelas', t.parcelas))
      : tx('Valor da parcela'))
    : null
  return (
    <li className={`ieq-conta ${t.estado}`}>
      <span className="ieq-conta-dia" aria-hidden="true"><b>{dia}</b><small>{mes}</small></span>
      <span className="ieq-conta-info">
        <strong>{t.titulo}</strong>
        <span className={`ieq-conta-quando ${t.estado}`}>{quando}</span>
        {detalhe && <small className="ieq-conta-det">{detalhe}{t.saldoDivida ? ` · ${tx('Saldo da dívida: {0}', t.saldoDivida)}` : ''}</small>}
      </span>
      <span className={`ieq-conta-valor ${t.entrada ? 'entrada' : ''}`}>{t.entrada ? '+ ' : ''}{t.valor}{t.aprox && <small>{t.aprox}</small>}</span>
      <button type="button" className="btn ieq-conta-acao" onClick={() => aoAgir(t)}>{acao}</button>
    </li>
  )
}

function Grupo({ titulo, tarefas, aoAgir, rotuloMais, recolhido, tom, vazio }: {
  titulo: string; tarefas: Tarefa[]; aoAgir: (t: Tarefa) => void
  /** "Ver mais 4 atrasadas" */
  rotuloMais: (n: number) => string
  /** Começa fechado (o restante do mês). */
  recolhido?: boolean
  tom?: 'atencao'
  vazio?: string
}) {
  const [aberto, setAberto] = useState(!recolhido)
  const [todas, setTodas] = useState(false)
  if (!tarefas.length && !vazio) return null
  const visiveis = todas ? tarefas : tarefas.slice(0, VISIVEIS)
  const escondidas = tarefas.length - visiveis.length
  return (
    <div className={`ieq-grupo ${tom ?? ''}`}>
      <button type="button" className="ieq-grupo-cab" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span>{titulo}</span>
        <small>{tarefas.length}</small>
        <Icone nome={aberto ? 'cima' : 'abaixo'} tamanho={16} />
      </button>
      {aberto && (tarefas.length ? (
        <>
          <ul className="ieq-contas">{visiveis.map((t) => <LinhaConta key={t.chave} t={t} aoAgir={aoAgir} />)}</ul>
          {escondidas > 0 && <button type="button" className="ieq-mais" onClick={() => setTodas(true)}>{rotuloMais(escondidas)}</button>}
          {todas && tarefas.length > VISIVEIS && <button type="button" className="ieq-mais" onClick={() => setTodas(false)}>{tx('Mostrar menos')}</button>}
        </>
      ) : <p className="ieq-vazio-grupo"><Icone nome="check" tamanho={15} /> {vazio}</p>)}
    </div>
  )
}

/**
 * Contas, faturas e parcelas em três grupos: atrasadas e próximos 7 dias abertos (duas de cada, o resto atrás de um botão com
 * a quantidade), o restante do mês fechado. Nada é pago ao tocar na linha: o botão abre a conferência (conta), a fatura ou o
 * lançamento da parcela, que a pessoa confirma.
 */
export function ContasEq({ tarefas, limite, aoAgir, aoVerContas }: {
  tarefas: Tarefa[]
  /** AAAA-MM-DD do fim dos "próximos 7 dias"; sem ele (outro mês), tudo o que está em aberto num grupo só. */
  limite?: string
  aoAgir: (t: Tarefa) => void
  aoVerContas?: () => void
}) {
  const g = agruparTarefas(tarefas, limite ?? '9999-12-31')
  const atrasadas = g.atrasadas.length
  return (
    <section className="cartao ieq-bloco ieq-contas-bloco" aria-label={tx('Contas e vencimentos')}>
      <header className="ieq-cab">
        <h2>{tx('Contas e vencimentos')}</h2>
        {atrasadas > 0 && <span className="ieq-selo ruim">{atrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atrasadas)}</span>}
      </header>
      {!tarefas.length ? (
        <p className="ieq-vazio-grupo"><Icone nome="check" tamanho={16} /> {tx('Nenhuma conta em aberto neste mês.')}</p>
      ) : (
        <>
          <Grupo titulo={tx('Atrasadas')} tom="atencao" tarefas={g.atrasadas} aoAgir={aoAgir}
            rotuloMais={(n) => (n === 1 ? tx('Ver mais 1 atrasada') : tx('Ver mais {0} atrasadas', n))} />
          {limite ? (
            <>
              <Grupo titulo={tx('Próximos 7 dias')} tarefas={g.proximas} aoAgir={aoAgir} vazio={tx('Nada vence nos próximos 7 dias.')}
                rotuloMais={(n) => (n === 1 ? tx('Ver mais 1 dos próximos 7 dias') : tx('Ver mais {0} dos próximos 7 dias', n))} />
              <Grupo titulo={tx('Restante do mês')} tarefas={g.depois} aoAgir={aoAgir} recolhido
                rotuloMais={(n) => (n === 1 ? tx('Ver mais 1 do restante do mês') : tx('Ver mais {0} do restante do mês', n))} />
            </>
          ) : (
            <Grupo titulo={tx('Em aberto')} tarefas={g.proximas} aoAgir={aoAgir}
              rotuloMais={(n) => (n === 1 ? tx('Ver mais 1 em aberto') : tx('Ver mais {0} em aberto', n))} />
          )}
        </>
      )}
      {aoVerContas && <button type="button" className="ieq-link ieq-pe" onClick={aoVerContas}>{tx('Ver contas do mês')} <Icone nome="dir" tamanho={14} /></button>}
    </section>
  )
}

// ---------------------------------------------------------------- 4. comparação

const nomeDaCategoria = (categorias: Categoria[], id: string) => {
  const c = categorias.find((k) => k.id === id)
  return c ? { nome: c.nome, icone: c.icone, cor: c.cor } : { ...SEM_CATEGORIA, nome: tx('Sem categoria') }
}

/** "1–16 nov" ou "novembro inteiro". */
const intervalo = (mes: number, ateDia: number | null) => (ateDia !== null
  ? tx('1–{0} {1}', ateDia, noMeioDaFrase(MESES_CURTO[mes - 1]))
  : tx('{0} inteiro', noMeioDaFrase(MESES_NOME[mes - 1])))

/** Como a comparação é feita, em tópicos curtos (abre por toque). */
export function ComoCalculamos({ comp, aoFechar }: { comp: ComparacaoDeGastos; aoFechar: () => void }) {
  const atual = intervalo(comp.mes, comp.ateDia)
  const anterior = intervalo(comp.mesAnterior, comp.ateDiaAnterior)
  const itens: [string, string][] = [
    [tx('Datas comparadas'), comp.ateDia !== null
      ? tx('{0} contra {1}: o mesmo intervalo nos dois meses (num mês mais curto, até o último dia dele).', atual, anterior)
      : tx('{0} contra {1}: os dois meses inteiros.', atual, anterior)],
    [tx('O que conta como gasto'), tx('Toda saída lançada com data dentro do intervalo (ou sem data). Entradas e dinheiro que você guardou (caixinha, porquinho) ficam de fora.')],
    [tx('Compras no cartão e fatura'), tx('A compra no cartão conta na data dela (ou da parcela), mesmo com a fatura aberta. Marcar a fatura como paga não cria outro gasto, então nada conta duas vezes. Se o pagamento da fatura também foi lançado como saída comum (vindo do extrato, por exemplo), o mesmo dinheiro aparece duas vezes.')],
    [tx('Contas pendentes'), tx('Conta sem baixa e lançamento com data mais à frente ainda não entram. Uma conta vencida e não paga deixa o mês atual mais baixo até ser paga.')],
    [tx('O que fica de fora'), tx('Entradas, dinheiro guardado, compras de fatura renegociada (viraram dívida: entram as parcelas) e o que tem data depois do dia de corte.')],
    [tx('Diferença para o resumo do mês'), tx('O "Saiu" do resumo conta a compra no cartão só quando a fatura é paga (até lá ela está em "A pagar"). Por isso os dois números podem ser diferentes.')],
    [tx('Sem categoria'), tx('Menos gasto "sem categoria" pode ser só você ter dado categoria aos lançamentos. Isso não é tratado como economia.')],
  ]
  return (
    <Modal titulo={tx('Como calculamos')} aoFechar={aoFechar}>
      <dl className="ieq-metodo">
        {itens.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
      </dl>
    </Modal>
  )
}

/**
 * O diferencial do equilibrado: os gastos deste período contra o mesmo período do mês anterior, em duas barras na mesma
 * escala, a variação, a categoria que mais puxou a mudança (só quando os dados sustentam) e, por toque, a comparação
 * completa e como ela é calculada.
 */
export function ComparacaoEq({ comp, categorias, atrasadas, aoExplorar }: {
  comp: ComparacaoDeGastos; categorias: Categoria[]
  /** Contas a pagar vencidas e sem baixa no mês de hoje: ainda não estão nos gastos. */
  atrasadas: number
  aoExplorar: () => void
}) {
  const [metodo, setMetodo] = useState(false)
  const nomeAnt = noMeioDaFrase(MESES_NOME[comp.mesAnterior - 1])
  const topo = Math.max(comp.atual, comp.anterior) || 1
  const destaque = destaqueDaComparacao(comp)
  let principal: string | null = null
  let tom: 'sobe' | 'desce' | 'igual' = 'igual'
  if (comp.semBase) principal = tx('Sem lançamentos em {0} para comparar.', nomeAnt)
  else if (comp.variacao === null) {
    principal = comp.atual > 0 ? tx('Nada tinha saído em {0} nesse período: não há porcentagem para comparar.', nomeAnt) : tx('Nenhum gasto nos dois períodos.')
  } else {
    const p = Math.round(Math.abs(comp.variacao) * 100)
    if (p === 0) principal = tx('Gastos iguais aos de {0}', nomeAnt)
    else if (comp.variacao > 0) { tom = 'sobe'; principal = tx('Gastos {0}% maiores', p) }
    else { tom = 'desce'; principal = tx('Gastos {0}% menores', p) }
  }
  const cat = destaque ? nomeDaCategoria(categorias, destaque.id) : null
  const fraseDestaque = destaque && cat && (destaque.tipo === 'alta'
    ? tx('{0} teve o maior aumento: {1}.', cat.nome, comSinal(destaque.diferenca))
    : destaque.tipo === 'queda'
      ? tx('{0} teve a maior redução: {1}.', cat.nome, comSinal(destaque.diferenca))
      : tx('Menos gastos sem categoria ({0}): pode ser só reclassificação, não economia.', comSinal(destaque.diferenca)))
  const avisos = [
    atrasadas > 0 && !comp.semBase ? (atrasadas === 1 ? tx('1 conta vencida ainda não entrou nos gastos.') : tx('{0} contas vencidas ainda não entraram nos gastos.', atrasadas)) : null,
    comp.faturaEmDobro ? tx('Parece haver pagamento de fatura lançado junto com as compras do cartão: pode contar duas vezes.') : null,
  ].filter(Boolean) as string[]
  const barra = (mes: number, valor: number, classe: string) => (
    <div className={`ieq-cmp-linha ${classe}`}>
      <span className="ieq-cmp-nome">{maiuscula(noMeioDaFrase(MESES_NOME[mes - 1]))}</span>
      <b>{fmtValor(valor)}</b>
      <span className="ieq-cmp-trilho" aria-hidden="true"><i style={{ width: `${(valor / topo) * 100}%` }} /></span>
    </div>
  )
  return (
    <section className="cartao ieq-bloco ieq-cmp" aria-label={tx('Comparado com {0}', nomeAnt)}>
      <header className="ieq-cab">
        <h2>{tx('Comparado com {0}', nomeAnt)}</h2>
      </header>
      <p className="ieq-cmp-periodo">{tx('{0} vs. {1}', intervalo(comp.mes, comp.ateDia), intervalo(comp.mesAnterior, comp.ateDiaAnterior))}</p>
      {!comp.semBase && (
        <div className="ieq-cmp-barras" role="img"
          aria-label={tx('{0}: {1}. {2}: {3}.', maiuscula(noMeioDaFrase(MESES_NOME[comp.mes - 1])), fmtValor(comp.atual), maiuscula(nomeAnt), fmtValor(comp.anterior))}>
          {barra(comp.mes, comp.atual, 'atual')}
          {barra(comp.mesAnterior, comp.anterior, 'anterior')}
        </div>
      )}
      {principal && (
        <p className={`ieq-cmp-principal ${tom}`}>
          {tom !== 'igual' && <Icone nome={tom === 'sobe' ? 'sobe' : 'desce'} tamanho={16} />}<span>{principal}</span>
        </p>
      )}
      {fraseDestaque && cat && (
        <p className="ieq-cmp-destaque">
          <span className="ieq-cat-ic" style={{ '--c': cat.cor } as CSSProperties}><IconeCategoria emoji={cat.icone} tamanho={14} /></span>
          <span>{fraseDestaque}</span>
        </p>
      )}
      {avisos.map((a) => (
        <p key={a} className="ieq-cmp-aviso"><Icone nome="relogio" tamanho={14} /><span>{a}</span></p>
      ))}
      <div className="ieq-acoes-pe">
        {!comp.semBase && <button type="button" className="btn ieq-btn-sec" onClick={aoExplorar}>{tx('Explorar comparação')}</button>}
        <button type="button" className="ieq-link" onClick={() => setMetodo(true)}>{tx('Como calculamos')}</button>
      </div>
      {metodo && <ComoCalculamos comp={comp} aoFechar={() => setMetodo(false)} />}
    </section>
  )
}

// ---------------------------------------------------------------- 5. principais gastos

function LinhaFatia({ f, nome, icone, cor, aoTocar, aberta, children }: {
  f: { valor: number; parte: number }; nome: string; icone?: string; cor: string
  aoTocar?: () => void; aberta?: boolean; children?: ReactNode
}) {
  const conteudo = (
    <>
      <span className="ieq-fatia-topo">
        <span className="ieq-fatia-nome">
          {icone ? <span className="ieq-cat-ic" style={{ '--c': cor } as CSSProperties}><IconeCategoria emoji={icone} tamanho={14} /></span> : <span className="ieq-cat-ic vazio" aria-hidden="true" />}
          <span>{nome}</span>
        </span>
        <span className="ieq-fatia-valor"><b>{fmtValor(f.valor)}</b><small>{Math.round(f.parte * 100)}%</small></span>
      </span>
      <span className="ieq-fatia-trilho" aria-hidden="true"><i style={{ width: `${Math.max(f.parte * 100, f.valor > 0 ? 1 : 0)}%`, background: cor }} /></span>
    </>
  )
  return (
    <li className={`ieq-fatia ${aberta ? 'aberta' : ''}`}>
      {aoTocar ? <button type="button" className="ieq-fatia-btn" onClick={aoTocar} aria-expanded={aberta}>{conteudo}</button> : <div className="ieq-fatia-btn estatico">{conteudo}</div>}
      {children}
    </li>
  )
}

/** Todas as categorias do período, cada uma abrindo os lançamentos dela (com as compras no cartão, como na soma). */
function TodasAsCategorias({ fatias, categorias, inicial, base, aoAbrirLancamentos, aoFechar }: {
  fatias: FatiaDoPeriodo[]; categorias: Categoria[]; inicial: string | null; base: string
  aoAbrirLancamentos: (id: string) => void; aoFechar: () => void
}) {
  const [aberta, setAberta] = useState<string | null>(inicial)
  return (
    <Modal titulo={tx('Todas as categorias')} aoFechar={aoFechar}>
      <p className="ieq-base">{base}</p>
      <ul className="ieq-fatias">
        {fatias.map((f) => {
          const c = nomeDaCategoria(categorias, f.id)
          return (
            <LinhaFatia key={f.id} f={f} nome={c.nome} icone={c.icone} cor={c.cor} aberta={aberta === f.id} aoTocar={() => setAberta(aberta === f.id ? null : f.id)}>
              {aberta === f.id && (
                <div className="ieq-fatia-lancs">
                  <ul>
                    {f.lancs.slice(0, 8).map((l) => (
                      <li key={l.id}><span>{l.data ? fmtDataCurta(l.data) : '—'}</span><span>{l.descricao}{l.cartao_id ? <small> · {tx('cartão')}</small> : null}</span><b>{fmtValor(l.valor)}</b></li>
                    ))}
                  </ul>
                  {f.lancs.length > 8 && <p className="ieq-base">{tx('e mais {0}', f.lancs.length - 8)}</p>}
                  <button type="button" className="ieq-link" onClick={() => aoAbrirLancamentos(f.id)}>{tx('Abrir em Lançamentos')} <Icone nome="dir" tamanho={14} /></button>
                </div>
              )}
            </LinhaFatia>
          )
        })}
      </ul>
    </Modal>
  )
}

/**
 * As três maiores categorias do que saiu até hoje (a mesma base da comparação), cada barra na largura da sua parte do total.
 * O resto vira "Demais categorias" (um agrupamento: "Outros" é uma categoria cadastrada e aparece com o próprio nome).
 */
export function PrincipaisGastos({ comp, categorias, momento, aoAbrirLancamentos }: {
  comp: ComparacaoDeGastos; categorias: Categoria[]; momento: 'atual' | 'passado' | 'futuro'
  aoAbrirLancamentos: (id: string) => void
}) {
  const [todas, setTodas] = useState<false | { inicial: string | null }>(false)
  const f = fatiasDoPeriodo(comp, 3)
  if (!f.todas.length) return null
  const base = momento === 'atual'
    ? tx('Parte de cada categoria no que saiu até hoje ({0}), com as compras no cartão.', fmtValor(f.total))
    : tx('Parte de cada categoria nos gastos do mês ({0}), com as compras no cartão.', fmtValor(f.total))
  return (
    <section className="cartao ieq-bloco" aria-label={tx('Principais gastos')}>
      <header className="ieq-cab"><h2>{tx('Principais gastos')}</h2></header>
      <p className="ieq-base">{base}</p>
      <ul className="ieq-fatias">
        {f.principais.map((x) => {
          const c = nomeDaCategoria(categorias, x.id)
          return <LinhaFatia key={x.id} f={x} nome={c.nome} icone={c.icone} cor={c.cor} aoTocar={() => setTodas({ inicial: x.id })} />
        })}
        {f.demais && (
          <LinhaFatia f={f.demais} cor="var(--texto-3)"
            nome={f.demais.quantas === 1 ? tx('Demais categorias (1)') : tx('Demais categorias ({0})', f.demais.quantas)}
            aoTocar={() => setTodas({ inicial: null })} />
        )}
      </ul>
      <div className="ieq-acoes-pe">
        <button type="button" className="ieq-link" onClick={() => setTodas({ inicial: null })}>
          {tx('Ver todas as categorias')} <Icone nome="dir" tamanho={14} />
        </button>
      </div>
      {todas && (
        <TodasAsCategorias fatias={f.todas} categorias={categorias} inicial={todas.inicial} base={base}
          aoAbrirLancamentos={(id) => { setTodas(false); aoAbrirLancamentos(id) }} aoFechar={() => setTodas(false)} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 6. orientação

const SELO: Record<Gravidade, () => string> = {
  urgente: () => tx('Importante'),
  atencao: () => tx('Fique de olho'),
  elogio: () => tx('Parabéns'),
}
const COR_DO_TOM: Record<Tom, string> = { bom: 'var(--entrada)', medio: 'var(--divida)', ruim: 'var(--saida)' }
/** A primeira frase (o resto da explicação fica em "Ver todas as orientações"). */
const primeiraFrase = (t: string) => t.split(/(?<=[.!?])\s+/)[0] ?? t
/** Conselhos que pedem um dado que falta (juros não informados…): não são conclusão tirada dos números. */
const pedeDado = (c: Conselho) => c.id.startsWith('informe-')

/**
 * Uma orientação só (a mais importante que não repete o que o resumo e a comparação já dizem): título, uma frase, a ação e
 * o "Agora não". As outras e a explicação completa abrem por toque; a nota vem com a escala e leva à análise.
 */
export function OrientacaoEq({ conselhos, semDados, nota, aoIr, aoDispensar, aoAbrirAnalise, todas }: {
  conselhos: Conselho[]
  semDados: boolean
  nota?: { valor: number | null; rotulo: string; tom: Tom }
  aoIr: (destino: Conselho['destino']) => void
  aoDispensar: (id: string) => void
  aoAbrirAnalise: () => void
  /** A lista completa (BlocoConselhos), para a janela "Ver todas as orientações". */
  todas: ReactNode
}) {
  const [aberta, setAberta] = useState(false)
  const c = conselhos[0]
  const notaBotao = nota && nota.valor !== null && (
    <button type="button" className="ieq-nota" style={{ '--c': COR_DO_TOM[nota.tom] } as CSSProperties} onClick={aoAbrirAnalise}
      title={tx('Como a nota é calculada')}>
      {tx('Nota {0} de 100', nota.valor)} · {nota.rotulo} <Icone nome="dir" tamanho={13} />
    </button>
  )
  return (
    <section className="cartao ieq-bloco ieq-orientacao" aria-label={tx('Orientação')}>
      <header className="ieq-cab">
        <h2>{tx('Orientação')}</h2>
        {notaBotao}
      </header>
      {c ? (
        <div className={`ieq-conselho ${c.gravidade}`}>
          <span className="ieq-conselho-selo">{pedeDado(c) ? tx('Falta um dado') : SELO[c.gravidade]()}</span>
          <strong>{c.titulo}</strong>
          <p>{primeiraFrase(c.porque)}</p>
          <div className="ieq-conselho-acoes">
            <button type="button" className="btn primario" onClick={() => aoIr(c.destino)}>{c.botao}</button>
            <button type="button" className="ieq-agora-nao" onClick={() => aoDispensar(c.id)} aria-label={tx('Agora não: esconde este aviso até o mês que vem')}>{tx('Agora não')}</button>
          </div>
        </div>
      ) : semDados ? (
        <p className="ieq-base">{tx('Ainda sem orientação: faltam dados. Lance entradas e saídas de pelo menos 2 meses que já terminaram.')}</p>
      ) : (
        <p className="ieq-base"><Icone nome="check" tamanho={15} /> {tx('Nenhum alerta agora. Tudo em ordem por aqui.')}</p>
      )}
      {(conselhos.length > 0) && (
        <div className="ieq-acoes-pe">
          <button type="button" className="ieq-link" onClick={() => setAberta(true)}>
            {conselhos.length > 1 ? tx('Ver todas as orientações ({0})', conselhos.length) : tx('Entender esta orientação')} <Icone nome="dir" tamanho={14} />
          </button>
        </div>
      )}
      {aberta && <Modal titulo={tx('Orientações')} aoFechar={() => setAberta(false)} tamanho="grande">{todas}</Modal>}
    </section>
  )
}

// ---------------------------------------------------------------- 7. dívidas, metas e contas

export interface ResumoCompacto {
  chave: string
  rotulo: string
  valor: string
  sub?: string
  cor: string
  icone: string
  /** 0 a 1: uma barra fina (no lugar de um anel grande). */
  progresso?: number
  aoAbrir: () => void
}

/** Três resumos curtos, um embaixo do outro no celular: tocar abre a página. */
export function ResumosCompactos({ itens }: { itens: ResumoCompacto[] }) {
  if (!itens.length) return null
  return (
    <div className="ieq-resumos">
      {itens.map((x) => (
        <button key={x.chave} type="button" className="cartao ieq-resumo" onClick={x.aoAbrir} style={{ '--c': x.cor } as CSSProperties}>
          <span className="ieq-resumo-ic" aria-hidden="true"><Icone nome={x.icone} tamanho={18} /></span>
          <span className="ieq-resumo-texto">
            <span className="ieq-rot">{x.rotulo}</span>
            <strong>{x.valor}</strong>
            {x.sub && <small>{x.sub}</small>}
            {x.progresso !== undefined && <span className="ieq-resumo-trilho" aria-hidden="true"><i style={{ width: `${Math.round(x.progresso * 100)}%` }} /></span>}
          </span>
          <Icone nome="dir" tamanho={16} />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- 8. seletor do jeito de ver

const JEITOS: { id: Detalhe; nome: () => string; texto: () => string }[] = [
  { id: 'simples', nome: () => tx('Simples'), texto: () => tx('A situação do mês e o que fazer agora.') },
  { id: 'equilibrado', nome: () => tx('Equilibrado'), texto: () => tx('Também a comparação com o mês anterior e os principais gastos.') },
  { id: 'detalhado', nome: () => tx('Detalhado'), texto: () => tx('Tudo: gráficos do ano, todas as categorias e os detalhes de cada bloco.') },
]

/** "Modo equilibrado · Alterar": discreto, no fim. A escolha fica salva no perfil; o app nunca troca sozinho. */
export function SeletorDoJeito({ atual, aoMudar }: { atual: Detalhe; aoMudar: (d: Detalhe) => void }) {
  const [aberto, setAberto] = useState(false)
  const nome = JEITOS.find((j) => j.id === atual)?.nome() ?? ''
  return (
    <div className="ieq-jeito">
      <button type="button" className="ieq-jeito-btn" onClick={() => setAberto(true)}>
        {tx('Modo {0}', nome.toLowerCase())} · <span>{tx('Alterar')}</span>
      </button>
      {aberto && (
        <Modal titulo={tx('Jeito de ver a Início')} aoFechar={() => setAberto(false)}>
          <div className="ieq-jeitos" role="radiogroup" aria-label={tx('Jeito de ver a Início')}>
            {JEITOS.map((j) => (
              <button key={j.id} type="button" role="radio" aria-checked={j.id === atual} className={`ieq-jeito-op ${j.id === atual ? 'ativo' : ''}`}
                onClick={() => { setAberto(false); if (j.id !== atual) aoMudar(j.id) }}>
                <span><b>{j.nome()}</b><small>{j.texto()}</small></span>
                {j.id === atual && <Icone nome="check" tamanho={18} />}
              </button>
            ))}
          </div>
          <p className="ieq-base">{tx('Você pode mudar quando quiser. O app não muda sozinho.')}</p>
        </Modal>
      )}
    </div>
  )
}
