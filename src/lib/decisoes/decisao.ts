/**
 * O que o Kairo pode afirmar sobre uma sugestão, e com base em quê. Vai junto do passo do plano (`Acao.decisao`) e das dicas
 * do planejador, para a tela mostrar, ao abrir o "por quê": se é recomendação, pergunta, condição ou falta de dado; se a regra
 * é do app ou escolha da pessoa; as premissas; e o que foi considerado e não escolhido.
 */
export type EstadoDaDecisao =
  | 'recomenda' // os dados sustentam a sugestão
  | 'pergunta' // a escolha é da pessoa (usar o guardado, pedir o valor ao credor)
  | 'condicional' // vale se algo acontecer (o salário atrasar, quem deve pagar)
  | 'faltam-dados' // a sugestão pode mudar com um dado que falta (o saldo de hoje, a taxa)

export interface Decisao {
  estado: EstadoDaDecisao
  /** Quem decide a ordem: a política padrão do app ou a prioridade que a pessoa deu. */
  regra?: 'app' | 'pessoa'
  premissas: string[]
  alternativas: string[]
}

/** Só guarda a decisão quando ela diz algo além de "recomenda" sem premissa. */
export function decisaoDe(d: { estado?: EstadoDaDecisao; regra?: 'app' | 'pessoa'; premissas?: string[]; alternativas?: string[] }): Decisao | undefined {
  const premissas = (d.premissas ?? []).filter(Boolean)
  const alternativas = (d.alternativas ?? []).filter(Boolean)
  const estado = d.estado ?? 'recomenda'
  if (estado === 'recomenda' && !premissas.length && !alternativas.length && d.regra !== 'pessoa') return undefined
  return { estado, ...(d.regra ? { regra: d.regra } : {}), premissas, alternativas }
}
