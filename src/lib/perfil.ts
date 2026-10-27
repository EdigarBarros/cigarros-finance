import type { Banco, Detalhe, Divida, Lancamento, Mes, Modulo, Perfil } from './types'

export const MODULOS: { id: Modulo; nome: string; pergunta: string; descricao: string; icone: string }[] = [
  {
    id: 'dividas', nome: 'Dívidas e parcelas', icone: 'divida',
    pergunta: 'Tenho dívidas, empréstimos ou compras parceladas',
    descricao: 'Quanto falta pagar e quando cada dívida acaba. Cada pagamento lançado abate sozinho.',
  },
  {
    id: 'bancos', nome: 'Bancos e contas', icone: 'carteira',
    pergunta: 'Uso mais de um banco, conta ou carteira',
    descricao: 'O que entra e sai de cada banco e quanto está guardado em cada um.',
  },
  {
    id: 'investimentos', nome: 'Investimentos', icone: 'investir',
    pergunta: 'Invisto ou guardo dinheiro rendendo',
    descricao: 'Quanto você tem investido, mês a mês.',
  },
  {
    id: 'moedas', nome: 'Outras moedas', icone: 'globo',
    pergunta: 'Tenho ou uso dinheiro em outra moeda',
    descricao: 'Dólar, euro e outras: quanto você tem e quanto vale na sua moeda, com a cotação do dia.',
  },
  {
    id: 'metas', nome: 'Metas', icone: 'meta',
    pergunta: 'Quero juntar dinheiro para algo (viagem, reserva, carro…)',
    descricao: 'Quanto falta para cada objetivo, quanto guardar por mês e quando você chega lá.',
  },
]

export const DETALHES: { id: Detalhe; nome: string; descricao: string }[] = [
  { id: 'simples', nome: 'Simples', descricao: 'Só o essencial: quanto entrou, quanto saiu e quanto sobrou.' },
  { id: 'equilibrado', nome: 'Equilibrado', descricao: 'O essencial, mais gráficos e a comparação com o mês anterior.' },
  { id: 'detalhado', nome: 'Detalhado', descricao: 'Tudo: quadros no estilo planilha, tabela do ano e cada número.' },
]

export const PERFIL_PADRAO: Perfil = {
  nome: '',
  moeda: 'BRL',
  moedas: [],
  detalhe: 'equilibrado',
  modulos: { dividas: false, bancos: false, investimentos: false, moedas: false, metas: false },
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
      bancos: d.bancos.length > 0,
      investimentos: d.meses.some((m) => m.investimentos !== 0),
      moedas: moedas.length > 0,
      metas: d.meses.some((m) => m.meta_usd > 0),
    },
    onboarding_em: new Date().toISOString(),
  }
}

/** O que aparece na tela para este perfil. */
export function visao(p: Perfil) {
  const nivel = { simples: 0, equilibrado: 1, detalhado: 2 }[p.detalhe]
  return {
    dividas: p.modulos.dividas,
    bancos: p.modulos.bancos,
    investimentos: p.modulos.investimentos,
    moedas: p.modulos.moedas && p.moedas.length > 0,
    metas: p.modulos.metas,
    /** Variação contra o mês anterior nos indicadores. */
    comparacao: nivel >= 1,
    graficoAno: nivel >= 1,
    paginaAno: nivel >= 1,
    /** Quadros e tabelas no estilo da planilha. */
    planilha: nivel >= 2,
  }
}
export type Visao = ReturnType<typeof visao>
