/**
 * O painel continua se adaptando depois das perguntas iniciais: olha o que a pessoa lança e sugere ligar
 * o que ela parece precisar. Nada liga sozinho; cada sugestão recusada não volta mais.
 */
import { saidasQueSeRepetem } from './contasFixas'
import { infoMoeda } from './moedas'
import { BANCOS_CONHECIDOS } from './rotulos'
import type { Detalhe, Lancamento, Modulo, Perfil } from './types'
import { tx } from './textos'

const fim = '(?![a-z0-9à-ú])'
const PADRAO_DIVIDA = new RegExp(
  `\\b(parcela|presta[cç][aã]o|empr[eé]stimo|financiamento|consignado|acordo|carn[eê]|\\d{1,2}\\s*/\\s*\\d{1,2}|\\d{1,2}x)${fim}`, 'i',
)
// "10x" sozinho (compra parcelada) indica cartão; "parcela", "empréstimo"… indicam dívida.
const PADRAO_DIVIDA_SEM_X = new RegExp(
  `\\b(parcela|presta[cç][aã]o|empr[eé]stimo|financiamento|consignado|acordo|carn[eê]|\\d{1,2}\\s*/\\s*\\d{1,2})${fim}`, 'i',
)
// Palavras que sozinhas já indicam cartão; "Nubank" e "10x" só contam se se repetirem (muita gente usa o Nubank no débito).
const CARTAO_EXPLICITO = new RegExp(`\\b(cart[aã]o|fatura|cr[eé]dito)${fim}`, 'i')
const PADRAO_CARTAO = new RegExp(`\\b(cart[aã]o|fatura|cr[eé]dito|nubank|visa|mastercard|\\d{1,2}x)${fim}`, 'i')
const PADRAO_INVESTIMENTO = new RegExp(
  `\\b(invest\\w*|cdb|tesouro|a[cç][oõ]es|fiis?|poupan[cç]a|aplica[cç][aã]o|aporte|cripto\\w*|bitcoin|btc|corretora|renda fixa|lci|lca|previd[eê]ncia)${fim}`, 'i',
)
const PADRAO_GUARDAR = new RegExp(`\\b(guardar|guardei|guardando|poupar|poupan[cç]a|juntar|juntando|cofrinho|caixinha|reserva|porquinho)${fim}`, 'i')
const MOEDAS_NO_TEXTO: [RegExp, string][] = [
  [/us\$|\busd\b|d[oó]lar/i, 'USD'],
  [/€|\beuros?\b|\beur\b/i, 'EUR'],
  [/£|\blibras?\b|\bgbp\b/i, 'GBP'],
  [/peso argentino|\bars\b/i, 'ARS'],
]
// "Caixa", "Dinheiro" e "Inter" aparecem em descrições comuns ("caixa de leite"), então não contam.
const BANCOS_TEXTO = BANCOS_CONHECIDOS.filter((b) => !['Caixa', 'Dinheiro', 'Inter'].includes(b.nome)) // sem-tx
  .map((b) => ({ nome: b.nome, re: new RegExp(`\\b(${[b.nome, ...(b.apelidos ?? [])].join('|')})${fim}`, 'i') }))

export const moedaNoTexto = (texto: string) => MOEDAS_NO_TEXTO.find(([re]) => re.test(texto))?.[1]

export interface Dica {
  modulo: Modulo
  moeda?: string
  texto: string
  botao: string
}

/** Dica que aparece no formulário enquanto a pessoa digita a descrição. */
export function dicaDaDescricao(texto: string, p: Perfil, tipo: 'entrada' | 'saida'): Dica | null {
  if (!texto.trim()) return null
  if (!p.modulos.investimentos && PADRAO_INVESTIMENTO.test(texto)) {
    return { modulo: 'investimentos', texto: tx('Isso parece investimento.'), botao: tx('Acompanhar meus investimentos') }
  }
  if (!p.modulos.cartoes && tipo === 'saida' && PADRAO_CARTAO.test(texto) && !PADRAO_DIVIDA_SEM_X.test(texto)) {
    return { modulo: 'cartoes', texto: tx('Foi no cartão de crédito?'), botao: tx('Acompanhar minhas faturas') }
  }
  if (!p.modulos.dividas && tipo === 'saida' && PADRAO_DIVIDA.test(texto)) {
    return { modulo: 'dividas', texto: tx('Parece uma parcela ou dívida.'), botao: tx('Controlar o que falta pagar') }
  }
  if (!p.modulos.metas && PADRAO_GUARDAR.test(texto)) {
    return { modulo: 'metas', texto: tx('Está guardando dinheiro para algo?'), botao: tx('Criar uma meta') }
  }
  const moeda = moedaNoTexto(texto)
  if (moeda && moeda !== p.moeda && !(p.modulos.moedas && p.moedas.includes(moeda))) {
    return { modulo: 'moedas', moeda, texto: tx('Foi em {0}?', infoMoeda(moeda).nome.toLowerCase()), botao: tx('Lançar em {0}', infoMoeda(moeda).nome.toLowerCase()) }
  }
  return null
}

export interface Sugestao {
  id: string
  icone: string
  titulo: string
  texto: string
  botao: string
  /** O que muda no perfil se a pessoa aceitar. */
  aplicar: (p: Perfil) => Perfil
}

const ligar = (m: Modulo) => (p: Perfil): Perfil => ({ ...p, modulos: { ...p.modulos, [m]: true } })
const nivel = (d: Detalhe) => (p: Perfil): Perfil => ({ ...p, detalhe: d })

/** Sugestões tiradas do uso, da mais útil para a menos útil. */
export function sugestoes(p: Perfil, lancs: Lancamento[], mesesComDados: number, ehPagamentoDeDivida: (l: Lancamento) => boolean): Sugestao[] {
  const lista: Sugestao[] = []
  const conta = (re: RegExp) => lancs.filter((l) => re.test(l.descricao)).length

  if (!p.modulos.cartoes && (conta(CARTAO_EXPLICITO) >= 1 || conta(PADRAO_CARTAO) >= 2)) {
    lista.push({
      id: 'modulo:cartoes', icone: 'cartao', botao: tx('Ligar cartões'),
      titulo: tx('Você usa cartão de crédito?'),
      texto: tx('Veja a fatura de cada cartão, quando ela fecha e vence, as compras parceladas e quanto do limite ainda dá para usar.'),
      aplicar: ligar('cartoes'),
    })
  }
  if (!p.modulos.dividas && lancs.filter((l) => PADRAO_DIVIDA.test(l.descricao) || ehPagamentoDeDivida(l)).length >= 2) {
    lista.push({
      id: 'modulo:dividas', icone: 'divida', botao: tx('Acompanhar dívidas'),
      titulo: tx('Você está pagando parcelas'),
      texto: tx('Quer ver quanto falta em cada dívida e em que mês ela acaba? Cada pagamento lançado abate sozinho.'),
      aplicar: ligar('dividas'),
    })
  }
  if (!p.modulos.investimentos && conta(PADRAO_INVESTIMENTO) >= 1) {
    lista.push({
      id: 'modulo:investimentos', icone: 'investir', botao: tx('Acompanhar investimentos'),
      titulo: tx('Começou a investir?'),
      texto: tx('Acompanhe quanto você tem investido mês a mês, junto com o resto do seu dinheiro.'),
      aplicar: ligar('investimentos'),
    })
  }
  if (!p.modulos.metas && conta(PADRAO_GUARDAR) >= 1) {
    lista.push({
      id: 'modulo:metas', icone: 'meta', botao: tx('Acompanhar metas'),
      titulo: tx('Está guardando dinheiro?'),
      texto: tx('Crie uma meta (viagem, reserva, carro…) e veja quanto guardar por mês e quando você chega lá.'),
      aplicar: ligar('metas'),
    })
  }
  if (!p.modulos.contas) {
    // parcelas já têm o módulo de dívidas; aqui entram aluguel, luz, internet, assinaturas…
    const fixa = saidasQueSeRepetem(lancs.filter((l) => !PADRAO_DIVIDA.test(l.descricao) && !ehPagamentoDeDivida(l)))[0]
    if (fixa) {
      lista.push({
        id: 'modulo:contas', icone: 'calendario', botao: tx('Ligar contas do mês'),
        titulo: tx('Você paga {0} todo mês?', fixa.descricao),
        texto: tx('Transforme em conta fixa e o app te lembra do vencimento, mostra o que está atrasado e dá baixa com um toque.'),
        aplicar: ligar('contas'),
      })
    }
  }
  for (const [re, m] of MOEDAS_NO_TEXTO) {
    if (m === p.moeda || (p.modulos.moedas && p.moedas.includes(m)) || !lancs.some((l) => re.test(l.descricao))) continue
    const nome = infoMoeda(m).nome.toLowerCase()
    lista.push({
      id: `moeda:${m}`, icone: 'globo', botao: tx('Usar {0}', nome),
      titulo: tx('Você mexe com {0}?', nome),
      texto: tx('Lance em {0} e veja quanto vale na sua moeda, com a cotação do dia.', nome),
      aplicar: (x) => ({ ...x, moedas: [...new Set([...x.moedas, m])], modulos: { ...x.modulos, moedas: true } }),
    })
  }
  if (!p.modulos.bancos) {
    const citados = new Set(BANCOS_TEXTO.filter((b) => lancs.some((l) => b.re.test(l.descricao))).map((b) => b.nome))
    if (citados.size >= 2) {
      lista.push({
        id: 'modulo:bancos', icone: 'carteira', botao: tx('Separar por banco'),
        titulo: tx('Você usa {0}', [...citados].slice(0, 2).join(' e ')),
        texto: tx('Quer ver o que entra e sai de cada banco e quanto tem guardado em cada um?'),
        aplicar: ligar('bancos'),
      })
    }
  }
  if (p.detalhe === 'simples' && lancs.length >= 40) {
    lista.push({
      id: 'detalhe:equilibrado', icone: 'ano', botao: tx('Mostrar gráficos'),
      titulo: tx('Você já lançou bastante coisa'),
      texto: tx('Gráficos e a comparação com o mês passado ajudam a ver para onde as coisas estão indo.'),
      aplicar: nivel('equilibrado'),
    })
  }
  if (p.detalhe === 'equilibrado' && mesesComDados >= 4 && lancs.length >= 80) {
    lista.push({
      id: 'detalhe:detalhado', icone: 'lista', botao: tx('Ver mais detalhes'),
      titulo: tx('{0} meses de histórico', mesesComDados),
      texto: tx('Com esse histórico, vale ver todas as categorias, os lançamentos do mês e o ano mês a mês.'),
      aplicar: nivel('detalhado'),
    })
  }
  return lista.filter((s) => !p.dispensadas.includes(s.id))
}
