import { emTeste, type Assinatura } from './assinatura'

/** Em que pé está o plano da pessoa. */
export type FasePlano = 'teste' | 'ativa' | 'cancelando' | 'problema' | 'encerrada' | 'cortesia'

export interface Marco {
  chave: string
  icone: string
  titulo: string
  texto: string
  data: Date | null
  /** feito: já passou; agora: onde a pessoa está; futuro: ainda vai acontecer. */
  estado: 'feito' | 'agora' | 'futuro'
}

export interface SituacaoPlano {
  fase: FasePlano
  rotulo: string
  /** Cor de destaque da fase (variável CSS). */
  cor: string
  /** Dias até o próximo marco (fim do teste, cobrança, fim do acesso). Vazio quando não há contagem. */
  dias: number | null
  legendaDias: string
  /** 0 a 1: quanto do período atual já passou. Vazio quando não há período. */
  progresso: number | null
  inicio: Date | null
  fim: Date | null
  resumo: string
  marcos: Marco[]
}

const DIA = 86_400_000
const DIAS_DE_TESTE = 7

const diasAte = (alvo: Date, agora: number) => Math.max(0, Math.ceil((alvo.getTime() - agora) / DIA))
const fracao = (ini: Date, fim: Date, agora: number) => Math.min(1, Math.max(0, (agora - ini.getTime()) / (fim.getTime() - ini.getTime())))
const umMesAntes = (d: Date) => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x }
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

/** Texto do preço: R$ 9,99 para quem paga em real; para outra moeda o valor aparece na página de pagamento. */
export const precoMensal = (a: Assinatura) => (!a.moeda || a.moeda.toLowerCase() === 'brl' ? 'R$ 9,99 por mês' : `valor mensal em ${a.moeda.toUpperCase()}`)

/**
 * Transforma a linha da tabela "assinaturas" no que a pessoa precisa ver: a fase, os dias que faltam, quanto do período já passou
 * e uma linha do tempo com o que já aconteceu e o que vem. Função pura (recebe "agora"), para ser fácil de conferir.
 */
export function situacaoDoPlano(a: Assinatura, agora: number = Date.now()): SituacaoPlano {
  const teste = a.teste_fim ? new Date(a.teste_fim) : null
  const periodo = a.periodo_fim ? new Date(a.periodo_fim) : null
  const assinou = a.assinada_em ? new Date(a.assinada_em) : null
  const preco = precoMensal(a)
  const marcoAssinou = (): Marco[] => assinou
    ? [{ chave: 'assinou', icone: 'check', titulo: 'Você assinou', texto: 'Obrigado por apoiar o OpusCash.', data: assinou, estado: 'feito' }]
    : []

  if (a.status === 'cortesia') {
    return {
      fase: 'cortesia', rotulo: 'Acesso liberado', cor: 'var(--entrada)', dias: null, legendaDias: '', progresso: null, inicio: null, fim: null,
      resumo: 'Seu acesso foi liberado pela equipe do OpusCash, sem cobrança e sem data para acabar.',
      marcos: [{ chave: 'liberado', icone: 'escudo', titulo: 'Acesso liberado', texto: 'Sem cobrança e sem prazo.', data: null, estado: 'agora' }],
    }
  }

  // Teste grátis do OpusCash (sem cartão) ou teste do Stripe (contas antigas, com cartão)
  if ((emTeste(a) || a.status === 'trialing') && teste && !a.cancela_no_fim) {
    const sem = a.status === 'teste'
    const inicio = new Date(teste.getTime() - DIAS_DE_TESTE * DIA)
    const dias = diasAte(teste, agora)
    const dia = Math.min(DIAS_DE_TESTE, Math.max(1, DIAS_DE_TESTE - dias + 1))
    return {
      fase: 'teste', rotulo: sem ? 'Teste grátis' : 'Teste grátis (com cartão)', cor: 'var(--entrada)', dias,
      legendaDias: `${plural(dias, 'dia', 'dias')} até o fim do teste`, progresso: fracao(inicio, teste, agora), inicio, fim: teste,
      resumo: sem
        ? 'Você usa o OpusCash completo, sem pagar nada. Quando o teste acabar, o painel é bloqueado até você assinar. Seus dados continuam guardados.'
        : 'Você está no teste grátis. Quando ele acabar, o cartão cadastrado é cobrado, a menos que você cancele antes.',
      marcos: [
        { chave: 'inicio', icone: 'calendario', titulo: 'Teste começou', texto: 'Acesso completo ao painel.', data: inicio, estado: 'feito' },
        { chave: 'hoje', icone: 'sol', titulo: 'Hoje', texto: `Dia ${dia} de ${DIAS_DE_TESTE} do teste.`, data: null, estado: 'agora' },
        sem
          ? { chave: 'fim', icone: 'relogio', titulo: 'Fim do teste', texto: 'O painel é bloqueado até você assinar.', data: teste, estado: 'futuro' }
          : { chave: 'fim', icone: 'cartao', titulo: 'Primeira cobrança', texto: `${preco}, no cartão cadastrado.`, data: teste, estado: 'futuro' },
        ...(sem ? [{ chave: 'depois', icone: 'cartao', titulo: 'Para continuar', texto: `Assine por ${preco}. Sem fidelidade.`, data: null, estado: 'futuro' as const }] : []),
      ],
    }
  }

  // Assinatura que não renova mais: a pessoa cancelou, mas o acesso vale até o fim do período já pago
  if ((a.status === 'active' || a.status === 'trialing') && a.cancela_no_fim) {
    const fim = periodo ?? teste
    const dias = fim ? diasAte(fim, agora) : null
    return {
      fase: 'cancelando', rotulo: 'Cancelada', cor: '#f5a524', dias, legendaDias: dias === null ? '' : `${plural(dias, 'dia', 'dias')} de acesso restantes`,
      progresso: fim ? fracao(umMesAntes(fim), fim, agora) : null, inicio: fim ? umMesAntes(fim) : null, fim,
      resumo: 'Você cancelou: não haverá novas cobranças e o painel segue liberado até o fim do período já pago. Dá para reativar quando quiser.',
      marcos: [
        ...marcoAssinou(),
        { chave: 'cancelou', icone: 'fechar', titulo: 'Você cancelou', texto: 'Sem novas cobranças.', data: null, estado: 'feito' },
        { chave: 'hoje', icone: 'sol', titulo: 'Hoje', texto: 'Você ainda usa o painel normalmente.', data: null, estado: 'agora' },
        { chave: 'fim', icone: 'relogio', titulo: 'Acesso termina', texto: 'O painel é bloqueado. Seus dados continuam guardados.', data: fim, estado: 'futuro' },
      ],
    }
  }

  if (a.status === 'active') {
    const dias = periodo ? diasAte(periodo, agora) : null
    return {
      fase: 'ativa', rotulo: 'Assinatura ativa', cor: 'var(--entrada)', dias, legendaDias: dias === null ? '' : `${plural(dias, 'dia', 'dias')} até a próxima cobrança`,
      progresso: periodo ? fracao(umMesAntes(periodo), periodo, agora) : null, inicio: periodo ? umMesAntes(periodo) : null, fim: periodo,
      resumo: `Seu plano está em dia: ${preco}, renovado automaticamente no cartão cadastrado. Você cancela quando quiser, sem multa.`,
      marcos: [
        ...marcoAssinou(),
        { chave: 'hoje', icone: 'sol', titulo: 'Hoje', texto: 'Seu acesso está liberado.', data: null, estado: 'agora' },
        { chave: 'proxima', icone: 'cartao', titulo: 'Próxima cobrança', texto: `${preco}, no cartão cadastrado.`, data: periodo, estado: 'futuro' },
      ],
    }
  }

  if (a.status === 'past_due' || a.status === 'unpaid') {
    return {
      fase: 'problema', rotulo: 'Pagamento pendente', cor: 'var(--saida)', dias: null, legendaDias: '', progresso: null, inicio: null, fim: null,
      resumo: 'Não conseguimos cobrar seu cartão. Atualize a forma de pagamento para não perder o acesso.',
      marcos: [
        ...marcoAssinou(),
        { chave: 'recusada', icone: 'fechar', titulo: 'Cobrança recusada', texto: 'O cartão não passou.', data: null, estado: 'feito' },
        { chave: 'hoje', icone: 'relogio', titulo: 'Hoje', texto: 'O Stripe tenta cobrar de novo por alguns dias.', data: null, estado: 'agora' },
        { chave: 'bloqueio', icone: 'escudo', titulo: 'Se não der certo', texto: 'O painel é bloqueado até o pagamento ser regularizado.', data: null, estado: 'futuro' },
      ],
    }
  }

  // teste que acabou, assinatura cancelada e o resto
  const fimDoTeste = a.status === 'teste' ? teste : null
  return {
    fase: 'encerrada', rotulo: 'Plano encerrado', cor: 'var(--saida)', dias: null, legendaDias: '', progresso: null, inicio: null, fim: fimDoTeste,
    resumo: 'Seu acesso terminou. Seus dados continuam guardados: é só assinar para voltar de onde parou.',
    marcos: [
      ...marcoAssinou(),
      { chave: 'fim', icone: 'relogio', titulo: a.status === 'teste' ? 'Teste terminou' : 'Acesso terminou', texto: 'O painel está bloqueado.', data: fimDoTeste ?? periodo, estado: 'agora' },
      { chave: 'voltar', icone: 'cartao', titulo: 'Para voltar', texto: `Assine por ${preco}. Seus dados estão guardados.`, data: null, estado: 'futuro' },
    ],
  }
}
