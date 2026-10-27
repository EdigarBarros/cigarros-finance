/**
 * O painel continua se adaptando depois das perguntas iniciais: olha o que a pessoa lança e sugere ligar
 * o que ela parece precisar. Nada liga sozinho; cada sugestão recusada não volta mais.
 */
import { saidasQueSeRepetem } from './contasFixas'
import { infoMoeda } from './moedas'
import { BANCOS_CONHECIDOS } from './rotulos'
import type { Detalhe, Lancamento, Modulo, Perfil } from './types'

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
const BANCOS_TEXTO = BANCOS_CONHECIDOS.filter((b) => !['Caixa', 'Dinheiro', 'Inter'].includes(b.nome))
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
    return { modulo: 'investimentos', texto: 'Isso parece investimento.', botao: 'Acompanhar meus investimentos' }
  }
  if (!p.modulos.cartoes && tipo === 'saida' && PADRAO_CARTAO.test(texto) && !PADRAO_DIVIDA_SEM_X.test(texto)) {
    return { modulo: 'cartoes', texto: 'Foi no cartão de crédito?', botao: 'Acompanhar minhas faturas' }
  }
  if (!p.modulos.dividas && tipo === 'saida' && PADRAO_DIVIDA.test(texto)) {
    return { modulo: 'dividas', texto: 'Parece uma parcela ou dívida.', botao: 'Controlar o que falta pagar' }
  }
  if (!p.modulos.metas && PADRAO_GUARDAR.test(texto)) {
    return { modulo: 'metas', texto: 'Está guardando dinheiro para algo?', botao: 'Criar uma meta' }
  }
  const moeda = moedaNoTexto(texto)
  if (moeda && moeda !== p.moeda && !(p.modulos.moedas && p.moedas.includes(moeda))) {
    return { modulo: 'moedas', moeda, texto: `Foi em ${infoMoeda(moeda).nome.toLowerCase()}?`, botao: `Lançar em ${infoMoeda(moeda).nome.toLowerCase()}` }
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
      id: 'modulo:cartoes', icone: 'cartao', botao: 'Ligar cartões',
      titulo: 'Você usa cartão de crédito?',
      texto: 'Veja a fatura de cada cartão, quando ela fecha e vence, as compras parceladas e quanto do limite ainda dá para usar.',
      aplicar: ligar('cartoes'),
    })
  }
  if (!p.modulos.dividas && lancs.filter((l) => PADRAO_DIVIDA.test(l.descricao) || ehPagamentoDeDivida(l)).length >= 2) {
    lista.push({
      id: 'modulo:dividas', icone: 'divida', botao: 'Ligar dívidas',
      titulo: 'Você está pagando parcelas',
      texto: 'Quer ver quanto falta em cada dívida e em que mês ela acaba? Cada pagamento lançado abate sozinho.',
      aplicar: ligar('dividas'),
    })
  }
  if (!p.modulos.investimentos && conta(PADRAO_INVESTIMENTO) >= 1) {
    lista.push({
      id: 'modulo:investimentos', icone: 'investir', botao: 'Ligar investimentos',
      titulo: 'Começou a investir?',
      texto: 'Acompanhe quanto você tem investido mês a mês, junto com o resto do seu dinheiro.',
      aplicar: ligar('investimentos'),
    })
  }
  if (!p.modulos.metas && conta(PADRAO_GUARDAR) >= 1) {
    lista.push({
      id: 'modulo:metas', icone: 'meta', botao: 'Ligar metas',
      titulo: 'Está guardando dinheiro?',
      texto: 'Crie uma meta (viagem, reserva, carro…) e veja quanto guardar por mês e quando você chega lá.',
      aplicar: ligar('metas'),
    })
  }
  if (!p.modulos.contas) {
    // parcelas já têm o módulo de dívidas; aqui entram aluguel, luz, internet, assinaturas…
    const fixa = saidasQueSeRepetem(lancs.filter((l) => !PADRAO_DIVIDA.test(l.descricao) && !ehPagamentoDeDivida(l)))[0]
    if (fixa) {
      lista.push({
        id: 'modulo:contas', icone: 'calendario', botao: 'Ligar contas do mês',
        titulo: `Você paga ${fixa.descricao} todo mês?`,
        texto: 'Transforme em conta fixa e o app te lembra do vencimento, mostra o que está atrasado e dá baixa com um toque.',
        aplicar: ligar('contas'),
      })
    }
  }
  for (const [re, m] of MOEDAS_NO_TEXTO) {
    if (m === p.moeda || (p.modulos.moedas && p.moedas.includes(m)) || !lancs.some((l) => re.test(l.descricao))) continue
    const nome = infoMoeda(m).nome.toLowerCase()
    lista.push({
      id: `moeda:${m}`, icone: 'globo', botao: `Usar ${nome}`,
      titulo: `Você mexe com ${nome}?`,
      texto: `Lance em ${nome} e veja quanto vale na sua moeda, com a cotação do dia.`,
      aplicar: (x) => ({ ...x, moedas: [...new Set([...x.moedas, m])], modulos: { ...x.modulos, moedas: true } }),
    })
  }
  if (!p.modulos.bancos) {
    const citados = new Set(BANCOS_TEXTO.filter((b) => lancs.some((l) => b.re.test(l.descricao))).map((b) => b.nome))
    if (citados.size >= 2) {
      lista.push({
        id: 'modulo:bancos', icone: 'carteira', botao: 'Separar por banco',
        titulo: `Você usa ${[...citados].slice(0, 2).join(' e ')}`,
        texto: 'Quer ver o que entra e sai de cada banco e quanto tem guardado em cada um?',
        aplicar: ligar('bancos'),
      })
    }
  }
  if (p.detalhe === 'simples' && lancs.length >= 40) {
    lista.push({
      id: 'detalhe:equilibrado', icone: 'ano', botao: 'Mostrar gráficos',
      titulo: 'Você já tem bastante coisa lançada',
      texto: 'Gráficos e a comparação com o mês anterior ajudam a ver para onde as coisas estão indo.',
      aplicar: nivel('equilibrado'),
    })
  }
  if (p.detalhe === 'equilibrado' && mesesComDados >= 4 && lancs.length >= 80) {
    lista.push({
      id: 'detalhe:detalhado', icone: 'lista', botao: 'Ver tudo',
      titulo: `${mesesComDados} meses de histórico`,
      texto: 'Com esse histórico, a tabela do ano mês a mês e os quadros completos mostram cada detalhe.',
      aplicar: nivel('detalhado'),
    })
  }
  return lista.filter((s) => !p.dispensadas.includes(s.id))
}
