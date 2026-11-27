/**
 * O contrato entre as duas partes do Cairo (docs/cairo/contrato.md). Este arquivo tem o que a parte de dados (Claude 1)
 * PRODUZ: fatos com proveniência, qualidade, previsões com incerteza, condições de custo e cenários. Os tipos das decisões
 * (planejador, custos, certificado) são da parte de decisão (Claude 2) e moram em `contrato/decisao.ts`, do dono dela.
 *
 * Mudança compatível (campo opcional novo) sobe o número do meio de CONTRATO_VERSAO; qualquer outra sobe o primeiro e exige
 * atualizar os consumidores na mesma entrega.
 */
import type { DiaISO, MesISO, Moeda, Taxa, Valor } from './unidades'

export const CONTRATO_VERSAO = '1.1.0'

// ---------- de onde veio cada informação ----------

/** Um registro do app que pesou na informação. `versao` fica null até as tabelas terem versão por linha. */
export interface Ref { tabela: string; id: string; versao: number | null }

export interface Proveniencia {
  refs: Ref[]
  /** Quando o app ficou sabendo (o `created_at` do registro): o que não se sabia nesse dia não pode ter sido usado. */
  conhecidoEm: DiaISO | null
  /** Até quando a informação vale com certeza (o saldo "do mês de novembro" vale, no máximo, até o fim de novembro). */
  atualizadoEm: DiaISO | null
}

/** Código estável de um motivo ou premissa. A tela traduz; o núcleo nunca escreve frase. */
export type CodigoMotivo = string

/** Explicação em códigos e números: a tela monta o texto com `tx`. `regras`: ids de contrato/politicas.ts usados. */
export interface Motivo { codigo: CodigoMotivo; params: Record<string, number | string>; refs: string[]; regras: string[]; filhos?: Motivo[] }

// ---------- fato, declaração, estimativa, desconhecido ----------

/** O que aconteceu e está registrado (`fato`) ou o que a pessoa disse (`declarado`). */
export interface Fato<T> { tipo: 'fato' | 'declarado'; valor: T; prov: Proveniencia }
/** O que o Cairo calculou sem ter certeza: sempre com distribuição, método e quanto histórico sustenta. */
export interface Estimativa<T> {
  tipo: 'estimativa'
  dist: Distribuicao<T>
  prov: Proveniencia
  /** Como foi feita ('referencia', 'suavizado', 'quantis', 'modelo:<nome>'). */
  metodo: string
  /** Tamanho efetivo da amostra: observações já descontadas por qualidade, idade e mudança de comportamento. */
  nEf: number
  /** Quanto do resultado vem do histórico da pessoa (0 = só a referência; 1 = só o histórico). */
  pesoDoHistorico: number
}
export interface Desconhecido { tipo: 'desconhecido'; motivo: CodigoMotivo; resolvivelPelaPessoa: boolean }
export type Dado<T> = Fato<T> | Estimativa<T> | Desconhecido

export const ehDesconhecido = <T>(d: Dado<T>): d is Desconhecido => d.tipo === 'desconhecido'

/**
 * Previsão de um número. Os quantis são PREDITIVOS: "p90 = R$ 2.100" quer dizer que, em 9 de cada 10 situações como esta,
 * o valor fica abaixo disso. Só é verdade depois de calibrar: `cobertura80` é a fração de vezes, medida na régua, em que o
 * valor real caiu entre p10 e p90. Enquanto for null, a tela não fala em "chance".
 */
export interface Distribuicao<T> {
  quantis: Partial<Record<'p05' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95', T>>
  /** Chance de o evento não acontecer (o João não pagar, o freela não vir). */
  pNaoOcorre?: number
  calibracao: { versao: string; cobertura80: number | null }
}

// ---------- qualidade ----------

/** Como cada mês pode ser usado nas médias. Mês sem registro não é mês sem renda. */
export interface QualidadeDoMes {
  mes: MesISO
  /** 'conta': registro normal; 'parcial': bem menos saídas que o costume; 'sem_registros': nada lançado. */
  gastos: 'conta' | 'parcial' | 'sem_registros'
  /**
   * 'conta': houve entrada; 'zero_real': nenhuma entrada num mês bem registrado, de quem costuma lançar o que recebe;
   * 'nao_registrada': sem entrada e sem como saber se faltou renda ou se faltou lançar; 'sem_registros': nada lançado.
   */
  renda: 'conta' | 'zero_real' | 'nao_registrada' | 'sem_registros'
  motivos: Motivo[]
  /**
   * (1.1) Por que o Cairo não tem certeza do mês, mesmo quando ele entra nas médias: 'nivel_novo' (poucas saídas, mas é o
   * nível dos meses seguidos até agora: mudança de comportamento, não falta de registro) ou 'contas_em_dia' (poucas
   * saídas, mas as contas fixas do mês têm baixa). Sem o campo: sem dúvida.
   */
  incerto?: 'nivel_novo' | 'contas_em_dia'
  /** (1.1) O que a pessoa disse do mês ("está tudo lançado" ou "faltou lançar"). Vale mais que qualquer inferência. */
  declarado?: 'completo' | 'incompleto'
  /**
   * (1.1) Vale perguntar à pessoa se o mês está completo: a resposta muda as médias. 'poucas_saidas' traz `saidas` e
   * `tipico`; 'renda_nao_registrada', o mês sem entrada com renda fixa esperando baixa. Só nos meses recentes.
   */
  pergunta?: { motivo: 'poucas_saidas' | 'renda_nao_registrada'; saidas: number; tipico: number }
}

export interface QualidadeDosDados {
  meses: QualidadeDoMes[]
  /** Lançamentos feitos depois da data deles (o app só soube depois): quantos e a fração. */
  lancadosDepois: { quantos: number; fracao: number; medianaDias: number }
  /** Quantos registros não têm `created_at` (não dá para saber quando o app soube). */
  semDataDeCriacao: number
  /** O saldo da conta corrente: até quando vale com certeza e há quantos dias isso foi. */
  saldo: { informado: boolean; validoAte: DiaISO | null; idadeMaximaDias: number | null }
  avisos: Motivo[]
}

// ---------- fluxos e cenários (a parte de decisão consome) ----------

/**
 * Caixa × renda: 'credito_recebido' (empréstimo que vai cair) e 'a_receber' (me devem, inclusive a devolução marcada para o
 * futuro) entram no caixa quando caem, mas NÃO são renda; 'emprestimo_concedido' sai do caixa e não é gasto. Só 'renda' é
 * renda, e só o 'a_receber' é incerto (vem com `pOcorre` nos esperados; nunca é dinheiro disponível antes de cair).
 * 'essencial' (1.1): conta ou lançamento futuro de categoria essencial (inferida pelo nome da categoria, por enquanto).
 * 'dia_a_dia': o gasto miúdo previsto, ainda sem separar essencial de conforto (essa separação depende do que a pessoa
 * declarar). 'obrigacao': conta, parcela ou fatura (contratada ou detectada: veja `origem`).
 */
export type Natureza =
  | 'essencial' | 'obrigacao' | 'conforto' | 'dia_a_dia' | 'transferencia_propria' | 'credito_recebido' | 'a_receber' | 'renda'
  /** (1.1) Dinheiro que a pessoa vai emprestar a alguém: sai do caixa, não é gasto, e não tem multa se atrasar. */
  | 'emprestimo_concedido'

/**
 * Um movimento de dinheiro num cenário. `dia` é quando o dinheiro se move; `reveladoEm` é quando a pessoa fica sabendo
 * (o salário só é revelado quando cai; o aluguel contratado, desde sempre). A política do planejador só pode ver fluxos com
 * `reveladoEm <= hoje` da simulação (`revelar`).
 */
export interface Fluxo {
  id: string
  dia: DiaISO
  reveladoEm: DiaISO
  valor: Valor
  sentido: 'entra' | 'sai'
  natureza: Natureza
  /** 'compromisso': conhecido (conta fixa, parcela, fatura); 'previsto': o Cairo espera; 'observado': já aconteceu. */
  origem: 'compromisso' | 'previsto' | 'observado'
  /** Compra no cartão: o consumo é no dia da compra, o dinheiro sai no dia da fatura (`dia`). */
  competencia?: DiaISO
  /** Este fluxo só existe se o outro existir, ou anda junto com ele (o gasto do dia do salário anda com o salário). */
  dependeDe?: { fluxo: string; relacao: 'so_se_ocorrer' | 'desloca_junto' }
  /** (1.1) A fonte de renda deste fluxo (`FonteDeRenda.chave`: 'conta:<id>' ou 'desc:<chave>'), quando há. */
  fonte?: string
  /** (1.1) A dívida a que o fluxo pertence (parcela, empréstimo, me devem). */
  divida?: string
  /** Só nos `esperados`: a chance de acontecer (renda que pode faltar, me devem). Sem o campo: certo. */
  pOcorre?: number
  /** Só nos `esperados`: era para ter acontecido neste dia e ainda não aconteceu (a renda atrasada continua esperada). */
  esperadoEm?: DiaISO
  /** De onde saiu (conta fixa, parcela, previsão do dia a dia). */
  ref: Proveniencia
  /** Código do que o fluxo é ('conta-fixa', 'parcela', 'fatura', 'dia-a-dia', 'entrada-recorrente', 'me-devem'). */
  tipo: string
  descricao: string
}

/** Um futuro sorteado. Fica ESCONDIDO da política: ela recebe só `Observado`. */
export interface Mundo { indice: number; semente: number; fluxos: Fluxo[] }
/**
 * O que a pessoa sabe no dia `hoje` da simulação:
 *  - `conhecidos`: o que este mundo já revelou (`reveladoEm <= hoje`). Inclui os compromissos com dia futuro, que se sabem
 *    desde o começo, e a renda que já caiu;
 *  - `esperados`: o que ela espera e ainda não se sabe se vem (renda, me devem, dia a dia), na versão mediana. É IGUAL em
 *    todos os mundos: nada do que só um mundo sorteou aparece antes da hora.
 */
export interface Observado { hoje: DiaISO; conhecidos: Fluxo[]; esperados: Fluxo[] }

export interface Horizonte { hoje: DiaISO; ate: DiaISO }

export interface GeradorDeCenarios {
  versao: string
  horizonte: Horizonte
  moeda: Moeda
  /** Mesma semente, mesmos mundos: duas alternativas comparadas com os mesmos sorteios. */
  gerar(n: number, semente: number): Mundo[]
  /** O futuro mais provável (cada incerteza na mediana), para mostrar como agenda. */
  mediano(): Mundo
}

// ---------- condições de custo (a parte de decisão é dona das contas com elas) ----------

export type Fonte = 'informada' | 'contrato' | 'aprendida' | 'padrao' | 'implicita_fluxo'

export type CondicaoDeCusto =
  /** O juro do contrato. Só ele serve para descontar parcelas futuras numa antecipação. */
  | { tipo: 'contratual'; divida: string; taxa: Taxa; fonte: 'informada' | 'contrato'; desde: DiaISO | null }
  /**
   * Os fatos do contrato para o custo efetivo (a TIR é conta da parte de decisão). Sem a data em que o dinheiro foi recebido,
   * a taxa sai num intervalo: `recebidoEm` null.
   */
  | {
      tipo: 'fluxo_do_contrato'; divida: string; recebido: Valor; recebidoEm: DiaISO | null
      parcelas: { vence: DiaISO; valor: Valor }[]
    }
  /** Como a dívida cresce ENQUANTO ESTÁ ATRASADA. Nunca serve para descontar antecipação. */
  | {
      tipo: 'atraso'; divida: string; multa: number | null; mora: Taxa | null; porDia: Valor | null
      base: 'parcela' | 'saldo'; fonte: 'informada' | 'aprendida' | 'padrao'
      /** Na aprendida: quantas conferências, a confiança e o erro médio do app contra o banco. */
      amostras?: number; confianca?: 'alta' | 'media' | 'baixa'
    }
  /** O que o contrato diz sobre adiantar. Hoje o app não pergunta: vem 'desconhecida'. */
  | { tipo: 'antecipacao'; divida: string; regra: 'desconto_contratual' | 'desconto_informado' | 'sem_desconto' | 'desconhecida' }
  /** Juros, tarifa ou IOF pagos: um fato, não uma taxa. */
  | { tipo: 'encargo'; divida: string | null; valor: Valor; dia: DiaISO; descricao: string; ref: Ref }
  /** "Para quitar hoje, R$ X": uma cotação de um dia, não ensina juros. */
  | { tipo: 'oferta_quitacao'; divida: string; valor: Valor; total: Valor; dia: DiaISO; ref: Ref }

// ---------- parâmetros individuais ----------

/** Um parâmetro aprendido: o valor, de onde partiu, quanto o histórico pesou e quanto ele sustenta. */
export interface Parametro<T> {
  id: string
  valor: T
  referencia: T
  nEf: number
  pesoDoHistorico: number
  metodo: string
}

