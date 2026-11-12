/**
 * OpusCash Invest: os tipos da carteira de investimentos (tabelas da migração 27) e o catálogo das classes.
 *
 * A regra que organiza tudo: **as operações são a fonte dos saldos**. Quantidade, custo, resultado e valor de cada ativo são
 * refeitos a partir delas (lib/invest/carteira.ts); nada disso é guardado no banco. O que o ativo vale hoje vem do último
 * preço que alguém informou (`PrecoInvest`), com a fonte e a data: o app não inventa preço.
 */
import { tx } from '../textos'

export type Classe = 'renda_fixa' | 'acao' | 'fii' | 'etf' | 'fundo' | 'internacional' | 'previdencia' | 'cripto' | 'outro'
/** Como a renda fixa rende: taxa fixa ao ano, % do CDI, % da Selic ou inflação mais uma taxa. */
export type Indexador = 'pre' | 'cdi' | 'selic' | 'ipca'
/** Quando dá para tirar o dinheiro: todo dia, só no vencimento, ou N dias depois do pedido. */
export type Liquidez = 'diaria' | 'vencimento' | 'prazo'

export interface Ativo {
  id: string
  nome: string
  /** Código de negociação (PETR4, MXRF11), quando tem. */
  codigo: string | null
  classe: Classe
  subclasse: string | null
  /** true: acompanhado pelo valor aplicado (CDB, Tesouro); false: por quantidade × preço (ações, FIIs, ETFs). */
  por_valor: boolean
  instituicao: string | null
  banco_id: string | null
  /** null = a moeda principal da pessoa. */
  moeda: string | null
  emissor: string | null
  setor: string | null
  indexador: Indexador | null
  /** 'pre': % ao ano; 'cdi' e 'selic': % do índice (110 = 110% do CDI); 'ipca': % ao ano acima da inflação. */
  taxa: number | null
  vencimento: string | null
  liquidez: Liquidez | null
  liquidez_dias: number | null
  obs: string | null
  created_at?: string
}

export type TipoOperacao =
  /** Compra de cotas ou aplicação num título. */
  | 'compra'
  /** Venda de cotas ou resgate (parcial ou total). */
  | 'venda'
  /** Dividendo, JCP ou rendimento pago em dinheiro. */
  | 'provento'
  /** Juros (cupom) pagos em dinheiro por um título. */
  | 'juros'
  /** Devolução de parte do capital: baixa o custo, não é ganho. */
  | 'amortizacao'
  /** Taxa cobrada à parte (custódia, administração). */
  | 'taxa'
  /** Imposto pago à parte (come-cotas, DARF). */
  | 'imposto'
  /** Cada cota vira `fator` cotas (o custo total não muda). */
  | 'desdobramento'
  | 'grupamento'
  /** Cotas recebidas de graça, com o custo que a empresa informou. */
  | 'bonificacao'
  /** Mudou de instituição: só registro, não mexe em quantidade nem custo. */
  | 'transferencia'
  /** O título venceu e o dinheiro voltou (resgate de tudo o que restava). */
  | 'vencimento'
  /** Correção feita pela pessoa, ou posição inicial informada: soma (ou tira) quantidade e custo, sempre identificada. */
  | 'ajuste'

export type OrigemOperacao = 'manual' | 'importacao' | 'posicao'

export interface Operacao {
  id: string
  ativo_id: string
  tipo: TipoOperacao
  subtipo: string | null
  data: string
  quantidade: number | null
  preco: number | null
  /** Valor bruto, na moeda do ativo. */
  valor: number
  /** Corretagem e taxas da operação. */
  custos: number
  /** Imposto retido na operação. */
  impostos: number
  fator: number | null
  moeda: string | null
  /** Quanto valia 1 da moeda do ativo na moeda principal no dia. */
  cotacao: number | null
  banco_id: string | null
  mexe_saldo: boolean
  lancamento_id: string | null
  origem: OrigemOperacao
  importacao_id: string | null
  chave: string | null
  obs: string | null
  created_at?: string
  atualizado_em?: string | null
}

export type NaturezaPreco = 'preco' | 'saldo'

/** O que um ativo valia num dia, dito por alguém: preço de 1 cota (`preco`) ou o saldo da aplicação inteira (`saldo`). */
export interface PrecoInvest {
  id: string
  ativo_id: string
  data: string
  natureza: NaturezaPreco
  valor: number
  moeda: string | null
  fonte: string
  referencia: string
}

/** Uma linha de arquivo que não virou operação: fica guardada até a pessoa resolver ou descartar. */
export interface LinhaPendente {
  /** Onde estava no arquivo ("Movimentação, linha 14"). */
  onde: string
  /** O texto original, como veio. */
  texto: string
  /** Por que ficou de fora. */
  motivo: string
}

export interface Importacao {
  id: string
  arquivo: string
  hash: string
  formato: string | null
  instituicao: string | null
  linhas: number
  importadas: number
  repetidas: number
  pendentes: LinhaPendente[]
  created_at: string
}

export type Foco = 'crescer' | 'renda' | 'liquidez' | 'acompanhar'

/** O plano de investimentos: o que a pessoa quer e as hipóteses das projeções. Fica em invest_config.plano. */
export interface Plano {
  /** O que ela mais quer acompanhar (sobe as descobertas desse assunto). */
  foco: Foco | null
  /** Quanto, no máximo, ela disse querer em renda variável (% da carteira). O app não deduz isso da carteira. */
  maxRendaVariavel: number | null
  metaPatrimonio: number | null
  /** AAAA-MM */
  metaPrazo: string | null
  aporteMensal: number | null
  /** Renda mensal que ela quer receber dos investimentos. */
  rendaAlvo: number | null
  /** Hipóteses de rendimento ao ano (%), uma por cenário. São suposições, não previsões. */
  cenarios: { pessimista: number; base: number; otimista: number }
  /** O valor que a pessoa informava à mão (meses.investimentos): a carteira o substitui, ou são outros investimentos e soma. */
  legado: 'substituir' | 'somar'
}

export const PLANO_PADRAO: Plano = {
  foco: null, maxRendaVariavel: null, metaPatrimonio: null, metaPrazo: null, aporteMensal: null, rendaAlvo: null,
  cenarios: { pessimista: 6, base: 9, otimista: 12 }, legado: 'substituir',
}

const numeroOuNulo = (x: unknown, min = 0, max = 1e13) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null)

/** Garante a forma do plano, mesmo vindo de uma versão antiga ou de um JSON estranho. */
export function normPlano(x: unknown): Plano {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<Record<keyof Plano, unknown>>
  const c = (p.cenarios && typeof p.cenarios === 'object' ? p.cenarios : {}) as Record<string, unknown>
  const taxa = (v: unknown, padrao: number) => numeroOuNulo(v, -50, 200) ?? padrao
  return {
    foco: (['crescer', 'renda', 'liquidez', 'acompanhar'] as const).find((f) => f === p.foco) ?? null,
    maxRendaVariavel: numeroOuNulo(p.maxRendaVariavel, 0, 100),
    metaPatrimonio: numeroOuNulo(p.metaPatrimonio, 0.01),
    metaPrazo: typeof p.metaPrazo === 'string' && /^\d{4}-\d{2}$/.test(p.metaPrazo) ? p.metaPrazo : null,
    aporteMensal: numeroOuNulo(p.aporteMensal, 0.01),
    rendaAlvo: numeroOuNulo(p.rendaAlvo, 0.01),
    cenarios: {
      pessimista: taxa(c.pessimista, PLANO_PADRAO.cenarios.pessimista), base: taxa(c.base, PLANO_PADRAO.cenarios.base),
      otimista: taxa(c.otimista, PLANO_PADRAO.cenarios.otimista),
    },
    legado: p.legado === 'somar' ? 'somar' : 'substituir',
  }
}

// ---------- catálogo ----------

export interface InfoClasse {
  id: Classe
  nome: () => string
  /** No plural, para títulos de grupo. */
  icone: string
  cor: string
  /** Acompanhada pelo valor aplicado (e não por quantidade × preço) quando nada for dito. */
  porValor: boolean
  /** Renda variável, para a conta de "quanto está em renda variável". */
  variavel: boolean
}

export const CLASSES: InfoClasse[] = [
  { id: 'renda_fixa', nome: () => tx('Renda fixa'), icone: 'escudo', cor: '#4ea3ff', porValor: true, variavel: false },
  { id: 'acao', nome: () => tx('Ações'), icone: 'investir', cor: '#1fd1a0', porValor: false, variavel: true },
  { id: 'fii', nome: () => tx('Fundos imobiliários'), icone: 'inicio', cor: '#63e6e2', porValor: false, variavel: true },
  { id: 'etf', nome: () => tx('ETFs'), icone: 'ano', cor: '#8b7cf6', porValor: false, variavel: true },
  { id: 'fundo', nome: () => tx('Fundos de investimento'), icone: 'carteira', cor: '#ffc24b', porValor: true, variavel: false },
  { id: 'internacional', nome: () => tx('Investimentos no exterior'), icone: 'globo', cor: '#ff9b45', porValor: false, variavel: true },
  { id: 'previdencia', nome: () => tx('Previdência'), icone: 'cofre', cor: '#bf5af2', porValor: true, variavel: false },
  { id: 'cripto', nome: () => tx('Criptoativos'), icone: 'trocar', cor: '#ff6b81', porValor: false, variavel: true },
  { id: 'outro', nome: () => tx('Outros'), icone: 'reticencias', cor: '#94a3c4', porValor: true, variavel: false },
]
export const infoClasse = (c: Classe): InfoClasse => CLASSES.find((x) => x.id === c) ?? CLASSES[CLASSES.length - 1]

export const SUBCLASSES_RENDA_FIXA: { id: string; nome: () => string; indexador?: Indexador }[] = [
  { id: 'cdb', nome: () => 'CDB' }, // sem-tx
  { id: 'lci', nome: () => 'LCI' }, // sem-tx
  { id: 'lca', nome: () => 'LCA' }, // sem-tx
  { id: 'tesouro_selic', nome: () => tx('Tesouro Selic'), indexador: 'selic' },
  { id: 'tesouro_prefixado', nome: () => tx('Tesouro Prefixado'), indexador: 'pre' },
  { id: 'tesouro_ipca', nome: () => tx('Tesouro IPCA+'), indexador: 'ipca' },
  { id: 'debenture', nome: () => tx('Debênture') },
  { id: 'cri_cra', nome: () => 'CRI / CRA' }, // sem-tx
  { id: 'poupanca', nome: () => tx('Poupança') },
  { id: 'outro', nome: () => tx('Outro título') },
]
export const nomeSubclasse = (id: string | null) => SUBCLASSES_RENDA_FIXA.find((s) => s.id === id)?.nome() ?? null

/** Títulos cobertos pelo Fundo Garantidor de Créditos (até o limite por instituição). */
export const COBERTAS_PELO_FGC = new Set(['cdb', 'lci', 'lca', 'poupanca'])
/** Limite do FGC por pessoa e por instituição, em reais. */
export const LIMITE_FGC = 250_000

export const NOME_INDEXADOR: Record<Indexador, () => string> = {
  pre: () => tx('Prefixado'), cdi: () => tx('% do CDI'), selic: () => tx('% da Selic'), ipca: () => tx('IPCA +'),
}

/** O nome de cada operação: num título, "compra" e "venda" são aplicação e resgate. */
export function nomeOperacao(tipo: TipoOperacao, porValor: boolean): string {
  switch (tipo) {
    case 'compra': return porValor ? tx('Aplicação') : tx('Compra')
    case 'venda': return porValor ? tx('Resgate') : tx('Venda')
    case 'provento': return tx('Provento')
    case 'juros': return tx('Juros recebidos')
    case 'amortizacao': return tx('Amortização')
    case 'taxa': return tx('Taxa')
    case 'imposto': return tx('Imposto')
    case 'desdobramento': return tx('Desdobramento')
    case 'grupamento': return tx('Grupamento')
    case 'bonificacao': return tx('Bonificação')
    case 'transferencia': return tx('Transferência de instituição')
    case 'vencimento': return tx('Vencimento')
    case 'ajuste': return tx('Ajuste')
  }
}

export const SUBTIPOS_PROVENTO: { id: string; nome: () => string }[] = [
  { id: 'dividendo', nome: () => tx('Dividendo') },
  { id: 'jcp', nome: () => tx('Juros sobre capital próprio') },
  { id: 'rendimento', nome: () => tx('Rendimento') },
  { id: 'outro', nome: () => tx('Outro') },
]

/** A moeda do ativo, ou a principal quando ele não diz. */
export const moedaDoAtivo = (a: Pick<Ativo, 'moeda'>, principal: string) => a.moeda || principal
/** Como o ativo aparece numa lista: o código quando tem, senão o nome. */
export const rotuloDoAtivo = (a: Pick<Ativo, 'codigo' | 'nome'>) => a.codigo || a.nome
