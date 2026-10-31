import type { Banco, Detalhe, Divida, Lancamento, Mes, Modulo, Perfil } from './types'
import { tx } from './textos'

export const MODULOS: { id: Modulo; nome: string; pergunta: string; descricao: string; icone: string }[] = [
  {
    id: 'dividas', nome: tx('Dívidas e parcelas'), icone: 'divida',
    pergunta: tx('Tenho dívidas, empréstimos ou compras parceladas'),
    descricao: tx('Quanto falta pagar e quando cada dívida acaba. Cada pagamento lançado abate sozinho.'),
  },
  {
    id: 'cartoes', nome: tx('Cartão de crédito'), icone: 'cartao',
    pergunta: tx('Uso cartão de crédito'),
    descricao: tx('A fatura de cada cartão, quando fecha e vence, as compras parceladas e quanto do limite ainda dá para usar.'),
  },
  {
    id: 'bancos', nome: tx('Bancos e contas'), icone: 'carteira',
    pergunta: tx('Uso mais de um banco, conta ou carteira'),
    descricao: tx('O que entra e sai de cada banco e quanto você tem guardado em cada um.'),
  },
  {
    id: 'investimentos', nome: tx('Investimentos'), icone: 'investir',
    pergunta: tx('Invisto ou guardo dinheiro rendendo'),
    descricao: tx('Quanto você tem investido, mês a mês.'),
  },
  {
    id: 'moedas', nome: tx('Outras moedas'), icone: 'globo',
    pergunta: tx('Tenho ou uso dinheiro em outra moeda'),
    descricao: tx('Dólar, euro e outras: quanto você tem e quanto vale na sua moeda, com a cotação do dia.'),
  },
  {
    id: 'metas', nome: tx('Metas'), icone: 'meta',
    pergunta: tx('Quero juntar dinheiro para algo (viagem, reserva, carro…)'),
    descricao: tx('Quanto falta para cada objetivo, quanto guardar por mês e quando você chega lá.'),
  },
  {
    id: 'contas', nome: tx('Contas do mês'), icone: 'calendario',
    pergunta: tx('Tenho contas que se repetem todo mês (aluguel, luz, internet…)'),
    descricao: tx('O app lembra do vencimento, mostra o que está atrasado e dá baixa com um toque em "Paguei".'),
  },
]

export const DETALHES: { id: Detalhe; nome: string; descricao: string }[] = [
  { id: 'simples', nome: tx('Simples'), descricao: tx('O mês em palavras, o que pagar e quanto deve sobrar no fim. Sem gráficos nem comparações.') },
  { id: 'equilibrado', nome: tx('Equilibrado'), descricao: tx('O painel completo, com gráficos e a comparação com o mês passado.') },
  { id: 'detalhado', nome: tx('Detalhado'), descricao: tx('O equilibrado, mais todas as categorias, mais lançamentos e o ano mês a mês.') },
]

export const PERFIL_PADRAO: Perfil = {
  nome: '',
  moeda: 'BRL',
  moedas: [],
  detalhe: 'equilibrado',
  modulos: { dividas: false, contas: false, cartoes: false, bancos: false, investimentos: false, moedas: false, metas: false },
  dispensadas: [],
  onboarding_em: null,
}

/** Garante todos os campos, mesmo vindo de uma versão antiga do banco. */
export const normPerfil = (p: Partial<Perfil> | null | undefined): Perfil => ({
  ...PERFIL_PADRAO,
  ...p,
  nome: p?.nome ?? '',
  moedas: p?.moedas ?? [],
  modulos: { ...PERFIL_PADRAO.modulos, ...p?.modulos },
  dispensadas: p?.dispensadas ?? [],
})

/** Contas que já tinham dados antes das perguntas: liga o que a pessoa já usa e pula o questionário. */
export function inferirPerfil(d: { lancs: Lancamento[]; dividas: Divida[]; bancos: Banco[]; meses: Mes[] }): Perfil {
  const moedas = [...new Set(d.meses.flatMap((m) => Object.entries(m.moedas).filter(([, v]) => v > 0).map(([k]) => k)))]
  return {
    ...PERFIL_PADRAO,
    moedas,
    // quem já usava o app via tudo; conta vazia começa no meio-termo
    detalhe: d.lancs.length || d.meses.length ? 'detalhado' : 'equilibrado',
    modulos: {
      dividas: d.dividas.length > 0,
      cartoes: d.lancs.some((l) => Boolean(l.cartao_id)),
      bancos: d.bancos.length > 0,
      investimentos: d.meses.some((m) => m.investimentos !== 0),
      moedas: moedas.length > 0,
      metas: d.meses.some((m) => m.meta_usd > 0),
      contas: d.lancs.some((l) => l.conta_fixa_id),
    },
    onboarding_em: new Date().toISOString(),
  }
}

/** O que aparece na tela para este perfil. */
export function visao(p: Perfil) {
  const nivel = { simples: 0, equilibrado: 1, detalhado: 2 }[p.detalhe]
  return {
    dividas: p.modulos.dividas,
    cartoes: p.modulos.cartoes,
    bancos: p.modulos.bancos,
    investimentos: p.modulos.investimentos,
    moedas: p.modulos.moedas && p.moedas.length > 0,
    metas: p.modulos.metas,
    contas: p.modulos.contas,
    /** Variação contra o mês anterior nos indicadores. */
    comparacao: nivel >= 1,
    graficoAno: nivel >= 1,
    paginaAno: nivel >= 1,
    /** Todos os números: categorias completas, lançamentos do mês e mais indicadores. */
    planilha: nivel >= 2,
  }
}
export type Visao = ReturnType<typeof visao>
