/**
 * Início no jeito equilibrado (computador e tablet; o celular tem a sua em src/movel). Três seções, no layout do OpusCash:
 * Visão geral (resultado do mês, até o fim do mês e contas), Seu dinheiro em perspectiva (comparação com o mês anterior e
 * principais gastos) e Seu próximo passo (uma orientação, a saúde financeira e os resumos de dívidas, metas e contas).
 * Aqui só se desenha: os números chegam prontos de pages/Inicio.tsx (veja docs/arquitetura-do-painel.md, 4.0.2).
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import { fmtValor, MESES_CURTO, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { Icone } from './Icone'
import { IconeCategoria } from './IconeCategoria'
import { Modal } from './ui'
import { tx } from '../lib/textos'
import { agruparTarefas, type Tarefa } from '../lib/paraFazer'
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
const COR_DO_TOM: Record<Tom, string> = { bom: 'var(--entrada)', medio: 'var(--divida)', ruim: 'var(--saida)' }

/** Quadradinho com o ícone, na cor `cor` (uma variável do tema). */
export const Tile = ({ icone, cor, tamanho = 18, children }: { icone?: string; cor: string; tamanho?: number; children?: ReactNode }) => (
  <span className="eq-tile" style={{ '--c': cor } as CSSProperties} aria-hidden="true">{children ?? <Icone nome={icone!} tamanho={tamanho} />}</span>
)

// ---------------------------------------------------------------- jeito de ver

const JEITOS: { id: Detalhe; nome: () => string; texto: () => string }[] = [
  { id: 'simples', nome: () => tx('Simples'), texto: () => tx('A situação do mês e o que fazer agora.') },
  { id: 'equilibrado', nome: () => tx('Equilibrado'), texto: () => tx('Também a comparação com o mês anterior e os principais gastos.') },
  { id: 'detalhado', nome: () => tx('Detalhado'), texto: () => tx('Tudo: gráficos do ano, todas as categorias e os detalhes de cada bloco.') },
]

/** A pílula "Modo equilibrado": abre os três jeitos de ver. A escolha fica salva no perfil; o app nunca troca sozinho. */
export function PilulaDoJeito({ atual, aoMudar }: { atual: Detalhe; aoMudar: (d: Detalhe) => void }) {
  const [aberto, setAberto] = useState(false)
  const nome = JEITOS.find((j) => j.id === atual)?.nome() ?? ''
  return (
    <>
      <button type="button" className="eq-modo" onClick={() => setAberto(true)} title={tx('Jeito de ver a Início')}>
        <Icone nome="balanca" tamanho={17} />{tx('Modo {0}', nome.toLowerCase())}
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
    </>
  )
}

/** Cabeçalho das seções 2 e 3: a pílula do jeito, o título, a linha de explicação e a data de hoje à direita. */
export function CabecalhoEq({ titulo, sub, hoje, modo }: { titulo: string; sub: ReactNode; hoje: string; modo: ReactNode }) {
  return (
    <header className="eq-cab-secao">
      <div className="eq-cab-txt">
        {modo}
        <h2>{titulo}</h2>
        <p>{sub}</p>
      </div>
      <span className="eq-hoje">{tx('Hoje, {0}', hoje)}</span>
    </header>
  )
}

// ---------------------------------------------------------------- 1. visão geral

/** "+ Registrar": abre Entrada, Saída e Importar extrato logo abaixo do botão. */
export function RegistrarEq({ aoEntrada, aoSaida, aoImportar }: { aoEntrada: () => void; aoSaida: () => void; aoImportar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useAcoesDeLancar<HTMLDivElement>()
  return (
    <div className="eq-registrar" ref={ref} data-tour="lancar">
      <button type="button" className="btn primario eq-registrar-btn" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <Icone nome={aberto ? 'fechar' : 'mais'} tamanho={17} /> {aberto ? tx('Fechar') : tx('Registrar')}
      </button>
      {aberto && (
        <div className="eq-registrar-opcoes" role="group" aria-label={tx('O que registrar?')}>
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

/** Topo da página: "Visão geral", a saudação com a pílula do jeito e o "+ Registrar" à direita. */
export function TopoEq({ nome, modo, registrar }: { nome: string; modo: ReactNode; registrar: ReactNode }) {
  const primeiro = nome.trim().split(/\s+/)[0]
  return (
    <header className="eq-topo">
      <div>
        <h1>{tx('Visão geral')}</h1>
        <div className="eq-ola">
          <span>{primeiro ? <>{tx('Olá,')}{' '}<b translate="no">{primeiro}!</b></> : tx('Olá!')}</span>
          {modo}
        </div>
      </div>
      {registrar}
    </header>
  )
}

/**
 * O resultado do mês até hoje (entrou menos saiu; não é o saldo do banco), com as barras de entradas e saídas na mesma escala.
 * O (i) abre a conta item por item (EntenderMes).
 */
export function ResultadoEq({ dd, nomeMes, momento, mesVazio, carregando, faturaAberta, aoVerCalculo }: {
  dd: DiaADia; nomeMes: string
  momento: 'atual' | 'passado' | 'futuro'
  /** Nenhum lançamento no mês: o resultado não é um zero confirmado. */
  mesVazio: boolean
  carregando: boolean
  /** Há compras em fatura ainda aberta: elas estão em "A pagar", não no "Saiu". */
  faturaAberta?: boolean
  aoVerCalculo: () => void
}) {
  if (carregando && mesVazio) {
    return (
      <section className="cartao eq-cartao eq-resultado" aria-busy="true" aria-label={tx('Carregando')}>
        <span className="esqueleto ieq-esq-linha" /><span className="esqueleto ieq-esq-valor" /><span className="esqueleto ieq-esq-linha" />
      </section>
    )
  }
  const futuro = momento === 'futuro'
  const entrou = futuro ? dd.vaiEntrar : dd.entrou
  const saiu = futuro ? dd.vaiSair : dd.saiu
  const valor = Math.round((entrou - saiu) * 100) / 100
  const rotulo = futuro ? tx('Previsto para {0}', nomeMes) : momento === 'passado' ? tx('Resultado de {0}', nomeMes) : tx('Resultado do mês')
  const tom = valor > 0 ? 'bom' : valor < 0 ? 'ruim' : 'zero'
  const maior = Math.max(entrou, saiu, 1)
  const explica = faturaAberta && momento === 'atual'
    ? tx('Entrou menos saiu até hoje (não é o saldo do banco). Compras no cartão ficam em “A pagar” até a fatura ser paga.')
    : tx('Entrou menos saiu (não é o saldo do banco).')
  return (
    <section className="cartao eq-cartao eq-resultado" aria-label={tx('Resumo do mês')}>
      <header className="eq-cartao-cab">
        <Tile icone="barras" cor="var(--entrada)" />
        <h3>{rotulo}</h3>
        <button type="button" className="eq-info" onClick={aoVerCalculo} title={explica} aria-label={tx('Ver cálculo')}><Icone nome="info" tamanho={18} /></button>
      </header>
      {mesVazio && !futuro ? (
        <p className="ieq-nada">{tx('Nenhum lançamento em {0} ainda.', nomeMes)}</p>
      ) : (
        <>
          <strong className={`eq-enorme ${tom}`}>{valor < 0 ? '− ' : ''}{fmtValor(Math.abs(valor))}</strong>
          <div className="eq-lados">
            <span><i className="entrou" aria-hidden="true" />{futuro ? tx('Vai entrar') : tx('Entrou')} <b>{fmtValor(entrou)}</b></span>
            <span><i className="saiu" aria-hidden="true" />{futuro ? tx('Vai sair') : tx('Saiu')} <b>{fmtValor(saiu)}</b></span>
          </div>
          <div className="eq-fluxo" aria-hidden="true">
            {([[futuro ? tx('Vai entrar') : tx('Entradas'), entrou, 'var(--entrada)'], [futuro ? tx('Vai sair') : tx('Saídas'), saiu, 'var(--saida)']] as const).map(([rot, v, cor]) => (
              <div key={rot} className="eq-fluxo-linha">
                <span>{rot}</span>
                <span className="eq-trilho"><b style={{ width: `${(v / maior) * 100}%`, background: cor }} /></span>
                <b>{fmtValor(v)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** O que ainda vem até o fim do mês e como ele deve fechar (só no mês de hoje). "Ver cálculo" abre a conta item por item. */
export function AteOFimEq({ dd, previsaoSabe, aoVerCalculo }: {
  dd: DiaADia
  /** Há contas do mês ou cartões ligados: sem eles a previsão não tem o que somar. */
  previsaoSabe: boolean
  aoVerCalculo: () => void
}) {
  const fim = Math.round((dd.entrou - dd.saiu + dd.vaiEntrar - dd.vaiSair) * 100) / 100
  const comPrevisao = dd.vaiEntrar > 0 || dd.vaiSair > 0
  const tom = fim < 0 ? 'ruim' : fim > 0 ? 'bom' : 'zero'
  return (
    <section className="cartao eq-cartao eq-ate-fim" aria-label={tx('Até o fim do mês')}>
      <header className="eq-cartao-cab">
        <Tile icone="calendario" cor="var(--entrada)" />
        <h3>{tx('Até o fim do mês')}</h3>
      </header>
      {comPrevisao ? (
        <>
          <div className="eq-prev-linhas">
            <p className="eq-prev"><span><Icone nome="diag-sobe" tamanho={18} />{tx('A pagar')}</span><b>{fmtValor(dd.vaiSair)}</b></p>
            <p className="eq-prev"><span><Icone nome="diag-desce" tamanho={18} />{tx('A receber')}</span><b className="bom">{fmtValor(dd.vaiEntrar)}</b></p>
          </div>
          <p className={`eq-fecho ${tom}`}>
            <span><Icone nome={tom === 'ruim' ? 'alerta' : 'check'} tamanho={20} />{tom === 'ruim' ? tx('Pode faltar') : tom === 'bom' ? tx('Deve sobrar') : tx('Deve fechar no zero')}</span>
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
      <button type="button" className="eq-link" onClick={aoVerCalculo}>{tx('Ver cálculo')} <Icone nome="dir" tamanho={15} /></button>
    </section>
  )
}

// ---------------------------------------------------------------- contas e vencimentos

const VISIVEIS = 2

const tituloDaConta = (t: Tarefa) => (t.divida && t.divida.parcelas > 1 ? tx('{0} · {1} parcelas', t.divida.nome, t.divida.parcelas) : t.titulo)
const acaoPadrao = (t: Tarefa) => (t.origem === 'fatura' ? tx('Ver fatura') : t.entrada ? tx('Marcar como recebida') : tx('Marcar como paga'))

function LinhaConta({ t, aoAgir, comBotao, acaoDaConta }: { t: Tarefa; aoAgir: (t: Tarefa) => void; comBotao: boolean; acaoDaConta: (t: Tarefa) => string }) {
  const atrasada = t.estado === 'atrasada'
  const n = t.diasAtraso ?? 0
  const quando = atrasada
    ? (t.entrada ? (n === 1 ? tx('não caiu há 1 dia') : tx('não caiu há {0} dias', n)) : n === 1 ? tx('1 dia em atraso') : tx('{0} dias em atraso', n))
    : t.frase
  // parcela: o valor é a soma do que vence no mês; o saldo da dívida inteira fica no título do valor
  const detalhe = t.origem === 'parcela' && t.saldoDivida ? tx('Saldo da dívida: {0}', t.saldoDivida) : undefined
  const corpo = (
    <>
      <span className="eq-dia" aria-hidden="true"><b>{t.vencimento.slice(8, 10)}</b><small>{noMeioDaFrase(MESES_CURTO[Number(t.vencimento.slice(5, 7)) - 1])}</small></span>
      <span className="eq-conta-info">
        <strong>{tituloDaConta(t)}</strong>
        <span className={`eq-conta-quando ${t.estado}`}>{quando}</span>
      </span>
    </>
  )
  // no simples o botão de dar baixa é o principal da linha (a fatura só leva aos cartões)
  const destaque = comBotao === true && t.origem !== 'fatura' && acaoDaConta !== acaoPadrao
  const valor = <b className={`eq-conta-valor${t.entrada ? ' entrada' : ''}`} title={detalhe}>{t.entrada ? '+ ' : ''}{t.valor}{t.aprox && <small>{t.aprox}</small>}</b>
  if (!comBotao) {
    return (
      <li>
        <button type="button" className={`eq-conta clicavel ${t.estado}`} onClick={() => aoAgir(t)} aria-label={`${acaoDaConta(t)}: ${tituloDaConta(t)}`}>
          {corpo}
          <span className="eq-conta-lado">{valor}</span>
        </button>
      </li>
    )
  }
  return (
    <li className={`eq-conta ${t.estado}`}>
      {corpo}
      <span className="eq-conta-lado">
        {valor}
        <button type="button" className={`btn eq-conta-acao${destaque ? ' primario' : ''}`} onClick={() => aoAgir(t)}>{acaoDaConta(t)}</button>
      </span>
    </li>
  )
}

function ColunaContas({ tipo, titulo, itens, aoAgir, comBotao, acaoDaConta, maisRotulo, vazio, pe }: {
  tipo: 'atrasadas' | 'proximas'
  titulo: ReactNode
  itens: Tarefa[]
  aoAgir: (t: Tarefa) => void
  comBotao: boolean
  acaoDaConta: (t: Tarefa) => string
  maisRotulo: (n: number) => string
  vazio: string
  pe?: ReactNode
}) {
  const [todas, setTodas] = useState(false)
  const visiveis = todas ? itens : itens.slice(0, VISIVEIS)
  const escondidas = itens.length - visiveis.length
  return (
    <div className={`eq-coluna ${tipo}`}>
      <h3>{titulo}</h3>
      {itens.length ? (
        <ul className="eq-contas">{visiveis.map((t) => <LinhaConta key={t.chave} t={t} aoAgir={aoAgir} comBotao={comBotao} acaoDaConta={acaoDaConta} />)}</ul>
      ) : (
        <p className="eq-vazio"><Icone nome="check" tamanho={16} /> {vazio}</p>
      )}
      <div className="eq-coluna-pe">
        {escondidas > 0 && <button type="button" className={`eq-link ${tipo}`} onClick={() => setTodas(true)}>{maisRotulo(escondidas)} <Icone nome="dir" tamanho={15} /></button>}
        {todas && itens.length > VISIVEIS && <button type="button" className={`eq-link ${tipo}`} onClick={() => setTodas(false)}>{tx('Mostrar menos')} <Icone nome="cima" tamanho={15} /></button>}
        {pe}
      </div>
    </div>
  )
}

/**
 * Contas, faturas e parcelas em duas colunas: atrasadas (com a ação ao lado do valor) e próximos 7 dias (a linha inteira abre a
 * ação). Duas de cada; o resto atrás de "Ver mais". Nada é pago ao tocar: a conta abre a conferência, a fatura leva aos cartões
 * e a parcela abre o lançamento já preenchido, que a pessoa confirma.
 */
export function ContasEq({ tarefas, limite, hoje, aoAgir, aoVerContas, titulo, tituloProximas, botaoNasProximas = false, acaoDaConta = acaoPadrao, pe }: {
  tarefas: Tarefa[]
  /** O título da segunda coluna quando não há limite de 7 dias (o simples usa "Próximas"; senão, "Em aberto"). */
  tituloProximas?: string
  /** "Contas e vencimentos" (o simples usa "Contas a pagar"). */
  titulo?: string
  /** As próximas também com o botão ao lado do valor (no simples, toda linha tem a ação escrita). */
  botaoNasProximas?: boolean
  /** O texto do botão de cada linha. */
  acaoDaConta?: (t: Tarefa) => string
  /** Mais um link no pé da segunda coluna (no simples: "N valores a receber"). */
  pe?: ReactNode
  /** AAAA-MM-DD do fim dos "próximos 7 dias"; sem ele (outro mês), o que está em aberto numa coluna só. */
  limite?: string
  /** "16 de novembro de 2026" */
  hoje: string
  aoAgir: (t: Tarefa) => void
  aoVerContas?: () => void
}) {
  const g = agruparTarefas(tarefas, limite ?? '9999-12-31')
  const na = g.atrasadas.length
  const proximas = limite ? g.proximas : [...g.proximas, ...g.depois]
  const verContas = (aoVerContas || pe) && <>{aoVerContas && <button type="button" className="eq-link" onClick={aoVerContas}>{tx('Ver contas do mês')} <Icone nome="dir" tamanho={15} /></button>}{pe}</>
  const nome = titulo ?? tx('Contas e vencimentos')
  return (
    <section className="eq-secao-contas" aria-label={nome}>
      <header className="eq-cab-contas">
        <h2>{nome}</h2>
        <span className="eq-hoje">{tx('Hoje, {0}', hoje)}</span>
      </header>
      <div className="cartao eq-cartao eq-contas-cartao">
        <ColunaContas tipo="atrasadas" itens={g.atrasadas} aoAgir={aoAgir} comBotao acaoDaConta={acaoDaConta}
          titulo={<><Icone nome="exclamacao" tamanho={20} />{na === 0 ? tx('Atrasadas') : na === 1 ? tx('1 atrasada') : tx('{0} atrasadas', na)}</>}
          maisRotulo={(n) => (n === 1 ? tx('Ver mais 1 atrasada') : tx('Ver mais {0} atrasadas', n))} vazio={tx('Nenhuma conta atrasada.')} />
        <ColunaContas tipo="proximas" itens={proximas} aoAgir={aoAgir} comBotao={botaoNasProximas} acaoDaConta={acaoDaConta}
          titulo={<><Icone nome="calendario" tamanho={20} />{limite ? tx('Próximos 7 dias') : tituloProximas ?? tx('Em aberto')}<small>{proximas.length}</small></>}
          maisRotulo={(n) => (limite
            ? (n === 1 ? tx('Ver mais 1 dos próximos 7 dias') : tx('Ver mais {0} dos próximos 7 dias', n))
            : tituloProximas ? (n === 1 ? tx('Ver mais 1 próxima') : tx('Ver mais {0} próximas', n))
              : (n === 1 ? tx('Ver mais 1 em aberto') : tx('Ver mais {0} em aberto', n)))}
          vazio={limite ? tx('Nada vence nos próximos 7 dias.') : tituloProximas ? tx('Nada mais vence neste mês.') : tx('Nenhuma conta em aberto neste mês.')} pe={verContas} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- 2. seu dinheiro em perspectiva

const nomeDaCategoria = (categorias: Categoria[], id: string) => {
  const c = categorias.find((k) => k.id === id)
  return c ? { nome: c.nome, icone: c.icone, cor: c.cor } : { ...SEM_CATEGORIA, nome: tx('Sem categoria') }
}

/** "1–16 nov" ou "novembro inteiro" (no "Como calculamos"). */
const intervalo = (mes: number, ateDia: number | null) => (ateDia !== null
  ? tx('1–{0} {1}', ateDia, noMeioDaFrase(MESES_CURTO[mes - 1]))
  : tx('{0} inteiro', noMeioDaFrase(MESES_NOME[mes - 1])))
/** "1 a 16 de novembro" ou "novembro inteiro" (na linha embaixo do título). */
const intervaloLongo = (mes: number, ateDia: number | null) => (ateDia !== null
  ? tx('1 a {0} de {1}', ateDia, noMeioDaFrase(MESES_NOME[mes - 1]))
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
 * Os gastos deste período contra o mesmo período do mês anterior: duas barras na mesma escala, a variação, a categoria que
 * mais puxou a mudança (só quando os dados sustentam), os avisos e, por toque, a comparação completa e como ela é calculada.
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
  const corAtual = tom === 'sobe' ? 'var(--saida)' : tom === 'desce' ? 'var(--entrada)' : 'var(--destaque)'
  const barra = (mes: number, valor: number, cor: string) => (
    <div className="eq-cmp-linha">
      <span>{maiuscula(noMeioDaFrase(MESES_NOME[mes - 1]))}</span>
      <b>{fmtValor(valor)}</b>
      <span className="eq-trilho grosso" aria-hidden="true"><b style={{ width: `${(valor / topo) * 100}%`, background: cor }} /></span>
    </div>
  )
  return (
    <section className="cartao eq-cartao eq-cmp" aria-label={tx('Comparado com {0}', nomeAnt)}>
      <header className="eq-cartao-titulo">
        <h3>{tx('Comparado com {0}', nomeAnt)}</h3>
        <p>{tx('{0} vs. {1}', intervaloLongo(comp.mes, comp.ateDia), intervaloLongo(comp.mesAnterior, comp.ateDiaAnterior))}</p>
      </header>
      {!comp.semBase && (
        <div className="eq-cmp-barras" role="img"
          aria-label={tx('{0}: {1}. {2}: {3}.', maiuscula(noMeioDaFrase(MESES_NOME[comp.mes - 1])), fmtValor(comp.atual), maiuscula(nomeAnt), fmtValor(comp.anterior))}>
          {barra(comp.mes, comp.atual, corAtual)}
          {barra(comp.mesAnterior, comp.anterior, 'color-mix(in srgb, var(--texto-2) 70%, var(--superficie))')}
        </div>
      )}
      {principal && (
        <p className={`eq-cmp-principal ${tom}`}>
          {tom !== 'igual' && <Icone nome={tom === 'sobe' ? 'sobe' : 'desce'} tamanho={19} />}<span>{principal}</span>
        </p>
      )}
      {fraseDestaque && cat && (
        <p className="eq-cmp-destaque">
          <Tile cor={cat.cor}><IconeCategoria emoji={cat.icone} tamanho={15} /></Tile>
          <span>{fraseDestaque}</span>
        </p>
      )}
      {avisos.map((a) => (
        <p key={a} className="eq-cmp-aviso"><Icone nome="exclamacao" tamanho={18} /><span>{a}</span></p>
      ))}
      <div className="eq-acoes-pe">
        {!comp.semBase && <button type="button" className="btn eq-btn-contorno" onClick={aoExplorar}>{tx('Explorar comparação')}</button>}
        <button type="button" className="eq-link" onClick={() => setMetodo(true)}>{tx('Como calculamos')}</button>
      </div>
      {metodo && <ComoCalculamos comp={comp} aoFechar={() => setMetodo(false)} />}
    </section>
  )
}

function LinhaFatia({ f, nome, icone, cor, aoTocar, aberta, children }: {
  f: { valor: number; parte: number }; nome: string; icone?: ReactNode; cor: string
  aoTocar?: () => void; aberta?: boolean; children?: ReactNode
}) {
  return (
    <li className={`eq-fatia ${aberta ? 'aberta' : ''}`}>
      <button type="button" className="eq-fatia-btn" onClick={aoTocar} aria-expanded={aberta}>
        <span className="eq-fatia-topo">
          <Tile cor={cor}>{icone}</Tile>
          <span className="eq-fatia-nome">{nome}</span>
          <b>{fmtValor(f.valor)}</b>
          <small>{Math.round(f.parte * 100)}%</small>
        </span>
        <span className="eq-trilho" aria-hidden="true"><b style={{ width: `${Math.max(f.parte * 100, f.valor > 0 ? 1 : 0)}%`, background: cor }} /></span>
      </button>
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
      <ul className="eq-fatias no-modal">
        {fatias.map((f) => {
          const c = nomeDaCategoria(categorias, f.id)
          return (
            <LinhaFatia key={f.id} f={f} nome={c.nome} icone={<IconeCategoria emoji={c.icone} tamanho={15} />} cor={c.cor} aberta={aberta === f.id}
              aoTocar={() => setAberta(aberta === f.id ? null : f.id)}>
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
  const sub = momento === 'atual'
    ? tx('Parte de cada categoria no que saiu até hoje ({0}).', fmtValor(f.total))
    : tx('Parte de cada categoria nos gastos do mês ({0}).', fmtValor(f.total))
  return (
    <section className="cartao eq-cartao eq-gastos" aria-label={tx('Principais gastos')}>
      <header className="eq-cartao-titulo">
        <h3>{tx('Principais gastos')}</h3>
        <p title={base}>{sub}</p>
      </header>
      <ul className="eq-fatias">
        {f.principais.map((x) => {
          const c = nomeDaCategoria(categorias, x.id)
          return <LinhaFatia key={x.id} f={x} nome={c.nome} icone={<IconeCategoria emoji={c.icone} tamanho={17} />} cor={c.cor} aoTocar={() => setTodas({ inicial: x.id })} />
        })}
        {f.demais && (
          <LinhaFatia f={f.demais} cor="color-mix(in srgb, var(--texto-2) 70%, var(--superficie))" icone={<Icone nome="camadas" tamanho={17} />}
            nome={f.demais.quantas === 1 ? tx('Demais categorias (1)') : tx('Demais categorias ({0})', f.demais.quantas)}
            aoTocar={() => setTodas({ inicial: null })} />
        )}
      </ul>
      <div className="eq-acoes-pe">
        <button type="button" className="eq-link" onClick={() => setTodas({ inicial: null })}>
          {tx('Ver todas as categorias')} <Icone nome="dir" tamanho={15} />
        </button>
      </div>
      {todas && (
        <TodasAsCategorias fatias={f.todas} categorias={categorias} inicial={todas.inicial} base={base}
          aoAbrirLancamentos={(id) => { setTodas(false); aoAbrirLancamentos(id) }} aoFechar={() => setTodas(false)} />
      )}
    </section>
  )
}

/** Faixa larga no fim de uma seção: ícone em degradê, o texto e uma ação (link ou botão). */
export function FaixaEq({ titulo, texto, acao, botao }: { titulo: string; texto?: string; acao: () => void; botao: string; }) {
  return (
    <div className={`cartao eq-faixa${texto ? ' com-texto' : ''}`}>
      <span className="eq-faixa-ic" aria-hidden="true"><Icone nome="investir" tamanho={24} /></span>
      <span className="eq-faixa-sep" aria-hidden="true" />
      <div className="eq-faixa-txt">
        <strong>{titulo}</strong>
        {texto && <p>{texto}</p>}
      </div>
      {texto
        ? <button type="button" className="btn primario eq-faixa-btn" onClick={acao}>{botao}</button>
        : <button type="button" className="eq-link eq-faixa-link" onClick={acao}>{botao} <Icone nome="dir" tamanho={16} /></button>}
    </div>
  )
}

// ---------------------------------------------------------------- 3. seu próximo passo

const SELO: Record<Gravidade, () => string> = {
  urgente: () => tx('Importante'),
  atencao: () => tx('Fique de olho'),
  elogio: () => tx('Parabéns'),
}
/** A primeira frase (o resto da explicação fica em "Ver todas as orientações"). */
const primeiraFrase = (t: string) => t.split(/(?<=[.!?])\s+/)[0] ?? t
/** As duas primeiras frases (no simples). */
const duasFrases = (t: string) => t.split(/(?<=[.!?])\s+(?=\p{Lu})/u).slice(0, 2).join(' ')
/** Conselhos que pedem um dado que falta (juros não informados…): não são conclusão tirada dos números. */
const pedeDado = (c: Conselho) => c.id.startsWith('informe-')

/**
 * Uma orientação só (a mais importante que não repete o que a comparação já diz): o selo, o título, uma frase, a ação e o
 * "Agora não". As outras e a explicação completa abrem em "Ver todas as orientações".
 */
export function OrientacaoEq({ conselhos, semDados, aoIr, aoDispensar, todas, aoAnalise }: {
  conselhos: Conselho[]
  semDados: boolean
  aoIr: (destino: Conselho['destino']) => void
  aoDispensar: (id: string) => void
  /** A lista completa (BlocoConselhos), para a janela "Ver todas as orientações". */
  todas?: ReactNode
  /** Simples: duas frases e "Ver análise" (o Consultor) no lugar da lista de orientações. */
  aoAnalise?: () => void
}) {
  const [aberta, setAberta] = useState(false)
  const c = conselhos[0]
  return (
    <section className="cartao eq-cartao eq-orientacao" aria-label={tx('Orientação')}>
      {c ? (
        <div className={`eq-conselho ${pedeDado(c) ? 'atencao' : c.gravidade}`}>
          <span className="eq-conselho-selo">{pedeDado(c) ? tx('Falta um dado') : SELO[c.gravidade]()}</span>
          <strong>{c.titulo}</strong>
          <p>{aoAnalise ? duasFrases(c.porque) : primeiraFrase(c.porque)}</p>
          <div className="eq-conselho-acoes">
            <button type="button" className="btn primario" onClick={() => aoIr(c.destino)}>{c.botao}</button>
            <button type="button" className="eq-agora-nao" onClick={() => aoDispensar(c.id)} aria-label={tx('Agora não: esconde este aviso até o mês que vem')}>{tx('Agora não')}</button>
          </div>
        </div>
      ) : (
        <div className="eq-conselho elogio">
          <span className="eq-conselho-selo">{tx('Orientação')}</span>
          <strong>{semDados ? tx('Ainda sem orientação: faltam dados.') : tx('Nenhum alerta agora.')}</strong>
          <p>{semDados ? tx('Lance entradas e saídas de pelo menos 2 meses que já terminaram.') : tx('Tudo em ordem por aqui.')}</p>
        </div>
      )}
      {aoAnalise ? (
        <div className="eq-orientacao-pe">
          <button type="button" className="eq-link" onClick={aoAnalise}>{tx('Ver análise')} <Icone nome="dir" tamanho={15} /></button>
        </div>
      ) : conselhos.length > 0 && (
        <div className="eq-orientacao-pe">
          <button type="button" className="eq-link" onClick={() => setAberta(true)}>
            {conselhos.length > 1 ? tx('Ver todas as orientações ({0})', conselhos.length) : tx('Entender esta orientação')} <Icone nome="dir" tamanho={15} />
          </button>
        </div>
      )}
      {aberta && <Modal titulo={tx('Orientações')} aoFechar={() => setAberta(false)} tamanho="grande">{todas}</Modal>}
    </section>
  )
}

/** A nota de 0 a 100 num anel, com o rótulo na cor do tom; "Ver diagnóstico" leva ao Consultor. */
export function SaudeEq({ nota, aoDiagnostico }: { nota: { valor: number | null; rotulo: string; tom: Tom }; aoDiagnostico: () => void }) {
  const r = 42, volta = 2 * Math.PI * r
  const parte = nota.valor === null ? 0 : Math.max(0, Math.min(100, nota.valor)) / 100
  const cor = COR_DO_TOM[nota.tom]
  return (
    <section className="cartao eq-cartao eq-saude" aria-label={tx('Saúde financeira')} style={{ '--c': cor } as CSSProperties}>
      <h3>{tx('Saúde financeira')}</h3>
      <div className="eq-saude-corpo">
        <div className="eq-anel" role="img" aria-label={nota.valor === null ? tx('Sem nota ainda') : tx('Nota {0} de 100', nota.valor)}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" stroke="color-mix(in srgb, var(--c) 16%, var(--superficie))" />
            {parte > 0 && <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke="var(--c)"
              strokeDasharray={`${volta * parte} ${volta}`} transform="rotate(-90 50 50)" />}
          </svg>
          <span><b>{nota.valor ?? '—'}</b>/100</span>
        </div>
        <span className="eq-saude-rotulo">{nota.rotulo}</span>
      </div>
      <button type="button" className="eq-link" onClick={aoDiagnostico}>{tx('Ver diagnóstico')} <Icone nome="dir" tamanho={15} /></button>
    </section>
  )
}

export interface ResumoCompacto {
  chave: string
  rotulo: string
  valor: string
  sub?: string
  cor: string
  icone: string
  /** 0 a 1: uma barra fina embaixo. */
  progresso?: number
  /** O valor é um nome (a meta), não um número. */
  texto?: boolean
  aoAbrir: () => void
}

/** Dívidas, meta em destaque e saldo nas contas, lado a lado: tocar abre a página. */
export function ResumosCompactos({ itens }: { itens: ResumoCompacto[] }) {
  if (!itens.length) return null
  return (
    <div className={`eq-resumos${itens.length === 4 ? ' quatro' : ''}`}>
      {itens.map((x) => (
        <button key={x.chave} type="button" className="cartao eq-cartao eq-resumo" onClick={x.aoAbrir} style={{ '--c': x.cor } as CSSProperties}>
          <span className="eq-resumo-linha">
            <Tile icone={x.icone} cor={x.cor} tamanho={20} />
            <span className="eq-resumo-texto">
              <span className="eq-resumo-rot">{x.rotulo}</span>
              <strong className={x.texto ? 'texto' : undefined}>{x.valor}</strong>
              {x.sub && <small>{x.sub}</small>}
            </span>
            <Icone nome="dir" tamanho={17} />
          </span>
          {x.progresso !== undefined && <span className="eq-trilho" aria-hidden="true"><b style={{ width: `${Math.round(Math.min(1, Math.max(0, x.progresso)) * 100)}%`, background: x.cor }} /></span>}
        </button>
      ))}
    </div>
  )
}
