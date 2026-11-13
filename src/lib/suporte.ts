import { VERSAO } from './atualizacao'
import { idiomaAtual } from './idioma'
import { supabase } from './supabase'
import { tx } from './textos'
import { aparelho, telaAtual } from './uso'

/*
 * Suporte dentro do app (migração 32): a pessoa abre um pedido de ajuda de qualquer tela e conversa com o suporte por ele.
 * Ela só vê os próprios pedidos (RLS) e só age pelas funções suporte_* do banco. O suporte responde pelo painel de suporte.
 */

export type CategoriaSuporte = 'pagamento' | 'bug' | 'conta' | 'duvida' | 'sugestao' | 'outro'
export type StatusSuporte = 'aberto' | 'respondido' | 'resolvido'

export interface PedidoSuporte {
  id: string; categoria: CategoriaSuporte; assunto: string; status: StatusSuporte
  criado_em: string; ultima_mensagem_em: string; ultima_mensagem_de: 'pessoa' | 'suporte'
  lido_pela_pessoa_em: string; resolvido_em: string | null
}
export interface MensagemSuporte { id: number; autor: 'pessoa' | 'suporte'; texto: string; criado_em: string }

/** As categorias, na ordem em que aparecem para escolher. */
export const CATEGORIAS: { id: CategoriaSuporte; icone: string; cor: string; nome: () => string; texto: () => string }[] = [
  { id: 'pagamento', icone: 'cartao', cor: 'var(--entrada)', nome: () => tx('Pagamento e assinatura'), texto: () => tx('Cobrança, Pix, cartão, acesso liberado') },
  { id: 'bug', icone: 'inseto', cor: 'var(--saida)', nome: () => tx('Algo não funciona'), texto: () => tx('Tela com erro, botão que não responde, valor errado') },
  { id: 'conta', icone: 'pessoa', cor: 'var(--caixa)', nome: () => tx('Minha conta'), texto: () => tx('Login, senha, e-mail, apagar a conta') },
  { id: 'duvida', icone: 'ideia', cor: 'var(--divida)', nome: () => tx('Dúvida de como usar'), texto: () => tx('Como fazer alguma coisa no OpusCash') },
  { id: 'sugestao', icone: 'estrela', cor: 'var(--violeta)', nome: () => tx('Sugestão'), texto: () => tx('Uma ideia para melhorar o app') },
  { id: 'outro', icone: 'conversa', cor: 'var(--texto-2)', nome: () => tx('Outro assunto'), texto: () => tx('Qualquer outra coisa') },
]
export const categoria = (id: string) => CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[CATEGORIAS.length - 1]

/** O suporte respondeu e a pessoa ainda não viu. */
export const temRespostaNova = (p: PedidoSuporte) =>
  p.ultima_mensagem_de === 'suporte' && new Date(p.ultima_mensagem_em).getTime() > new Date(p.lido_pela_pessoa_em).getTime()

/** Erro do banco → frase para a pessoa. */
function mensagemDoErro(e: { message?: string; hint?: string } | null): string {
  const m = `${e?.message ?? ''}`
  if (/suporte_muitos_abertos/.test(m)) return tx('Você já tem 5 pedidos em andamento. Responda ou encerre um deles antes de abrir outro.')
  if (/suporte_ritmo/.test(m)) return tx('Muitas mensagens em pouco tempo. Espere alguns minutos e mande de novo.')
  if (/suporte_texto_vazio/.test(m)) return tx('Escreva a mensagem.')
  if (/suporte_assunto_curto/.test(m)) return tx('Escreva um pouco mais sobre o assunto.')
  if (/suporte_|function|schema cache/i.test(m)) return tx('O suporte não está disponível agora. Tente de novo em alguns minutos.')
  return tx('Não deu para mandar agora. Confira a internet e tente de novo.')
}

export async function listarPedidos(): Promise<PedidoSuporte[]> {
  const { data, error } = await supabase.from('suporte_tickets')
    .select('id, categoria, assunto, status, criado_em, ultima_mensagem_em, ultima_mensagem_de, lido_pela_pessoa_em, resolvido_em')
    .order('ultima_mensagem_em', { ascending: false }).limit(100)
  if (error) throw new Error(mensagemDoErro(error))
  return (data ?? []) as PedidoSuporte[]
}

export async function lerConversa(id: string): Promise<MensagemSuporte[]> {
  const { data, error } = await supabase.from('suporte_mensagens').select('id, autor, texto, criado_em').eq('ticket_id', id).order('id')
  if (error) throw new Error(mensagemDoErro(error))
  return (data ?? []) as MensagemSuporte[]
}

/** Abre o pedido. Vão junto, à vista da pessoa, a tela em que ela estava, a versão do app, o aparelho e o idioma. */
export async function abrirPedido(c: CategoriaSuporte, assunto: string, texto: string): Promise<string> {
  const { data, error } = await supabase.rpc('suporte_abrir', {
    p_categoria: c, p_assunto: assunto.trim(), p_texto: texto.trim(),
    p_tela: telaAtual(), p_versao: VERSAO, p_aparelho: aparelho(), p_idioma: idiomaAtual(),
  })
  if (error) throw new Error(mensagemDoErro(error))
  return data as string
}

export async function responderPedido(id: string, texto: string) {
  const { error } = await supabase.rpc('suporte_responder', { p_ticket: id, p_texto: texto.trim() })
  if (error) throw new Error(mensagemDoErro(error))
}

export async function marcarLido(id: string) {
  await supabase.rpc('suporte_lido', { p_ticket: id }).then(() => {}, () => {})
}

export async function encerrarPedido(id: string) {
  const { error } = await supabase.rpc('suporte_encerrar', { p_ticket: id })
  if (error) throw new Error(mensagemDoErro(error))
}

/** O que vai junto com o pedido, em palavras (mostrado antes de mandar). */
export function contextoDoPedido() {
  const nomes: Record<string, string> = {
    site_computador: tx('site no computador'), site_celular: tx('site no celular'), app_android: tx('app Android'), site: tx('site'),
  }
  const telas: Record<string, string> = {
    // os mesmos nomes do menu (components/Painel.tsx)
    inicio: tx('Início'), lancamentos: tx('Lançamentos'), analise: tx('Consultor'), invest: tx('Invest'), contas: tx('Contas do mês'),
    cartoes: tx('Cartões'), dividas: tx('Dívidas'), metas: tx('Metas'), patrimonio: tx('Dinheiro guardado'), ano: tx('Resumo do ano'),
    configuracoes: tx('Configurações'), importar: tx('Importar extrato'), categorias: tx('Categorias'),
  }
  const t = telaAtual()
  return { tela: telas[t] ?? t, aparelho: nomes[aparelho()] ?? aparelho(), versao: VERSAO }
}
