/**
 * Dinheiro que só muda de bolso: passar para a caixinha, a poupança ou um investimento, transferir para outra conta sua,
 * resgatar o que estava guardado. Não é renda nem gasto. Quem guarda R$ 1.000 por mês na caixinha está sobrando
 * R$ 1.000, não gastando R$ 1.000: contar como saída punha no vermelho justamente quem mais guarda.
 *
 * O reconhecimento é pela descrição e pelo nome da categoria, e é estrito de propósito: "Reserva do hotel" e
 * "Aplicação de botox" são gasto de verdade e não podem sumir das contas.
 */

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// "reserva" e "aplicação" sozinhas são ambíguas (hotel, restaurante, botox): só valem acompanhadas do que deixa claro.
const RE_DESCRICAO = new RegExp([
  'conta propria', 'contas proprias', 'mesma titularidade', 'entre contas', 'minha conta', 'propria conta', 'para mim mesm',
  'caixinha', 'cofrinho', 'poupanca',
  // aplicação e investimento só com o que diz que é dinheiro (botox e curso também são "aplicação" e "investimento")
  '(aplicac(ao|oes)|investimentos?|aplicar|investir) (financeira|mensal|((em|no|na|do|da) )?'
    + '(cdb|tesouro|fundos?|acoes|renda fixa|poupanca|caixinha|lci|lca|corretora|reserva|bolsa|cripto|bitcoin|previdencia))',
  '^(aplicac(ao|oes)|investimentos?)$',
  '\\bresgate\\b', '\\bresgatei\\b',
  '\\baporte\\b', '\\bcdb\\b', 'tesouro direto', '\\blci\\b', '\\blca\\b',
  'reserva de emergencia', '(para|pra|na|a|da) reserva$', '^reserva$', '^guardar\\b', '^guardei\\b', '^guardado\\b',
  'own account', '\\bsavings\\b', 'transfer to self', 'cuenta propia', '\\bahorro',
].join('|'))
/** Categoria criada para isso ("Investimentos", "Poupança", "Reserva"): tudo nela é dinheiro guardado. */
const RE_CATEGORIA = /^(investimentos?|aplicac|poupanca|reserva|guardad|cofrinho|caixinha|savings|investments?|ahorros?|inversion)/

/** O lançamento só passa o dinheiro de um bolso seu para outro (não é renda nem gasto). */
export function mudaDeBolso(descricao: string, nomeDaCategoria = ''): boolean {
  return RE_DESCRICAO.test(normal(descricao.trim())) || RE_CATEGORIA.test(normal(nomeDaCategoria.trim()))
}
