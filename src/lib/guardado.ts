import { caixaDoBanco, mesEfetivo } from './calc'
import { converter, type Taxas } from './moedas'
import type { Visao } from './perfil'
import type { Banco, Caixa, Lancamento, Mes, TipoCaixa } from './types'

/** Quanto há guardado somando o que está ligado: contas dos bancos, investimentos e outras moedas (na moeda principal). */
export function totalGuardado({ v, bancos, caixa, investimentos, moedas, lista, taxas }: {
  v: Visao; bancos: Banco[]; caixa: Caixa; investimentos: number; moedas: Record<string, number>; lista: string[]; taxas: Taxas
}) {
  const totalCaixa = bancos.reduce((a, b) => a + caixaDoBanco(caixa, b.id), 0)
  const totalMoedas = lista.reduce((a, m) => a + (converter(moedas[m] ?? 0, m, taxas) ?? 0), 0)
  return (v.bancos ? totalCaixa : 0) + (v.investimentos ? investimentos : 0) + (v.moedas ? totalMoedas : 0)
}

// ---------- saída que é dinheiro indo para o seu dinheiro guardado (Itaú → porquinho do PicPay) ----------

const centavos = (n: number) => Math.round(n * 100) / 100

/** Saída marcada como "guardei no banco X": é o dinheiro mudando de lugar, não um gasto. */
export const ehGuardado = (l: Pick<Lancamento, 'tipo' | 'guardado_banco_id'>) => l.tipo === 'saida' && Boolean(l.guardado_banco_id)

export type EfeitoNoSaldo = { banco: string; tipo: TipoCaixa; delta: number }
type DadosDoGuardado = Pick<Lancamento, 'valor' | 'banco_id' | 'guardado_banco_id' | 'guardado_tipo' | 'guardado_saldo'>

/**
 * O que o lançamento fez nos saldos do mês: soma o valor onde foi guardado e tira da conta corrente do banco de onde saiu.
 * Vazio quando o app não mexeu nos saldos (`guardado_saldo` falso), para desfazer só o que foi feito de verdade.
 */
export function efeitosNoSaldo(l: DadosDoGuardado): EfeitoNoSaldo[] {
  if (!l.guardado_banco_id || !l.guardado_saldo) return []
  const tipo = l.guardado_tipo ?? 'caixinha'
  const v = centavos(l.valor)
  // da conta para a conta do mesmo banco não muda nada
  if (l.banco_id === l.guardado_banco_id && tipo === 'cc') return []
  return [
    { banco: l.guardado_banco_id, tipo, delta: v },
    ...(l.banco_id ? [{ banco: l.banco_id, tipo: 'cc' as const, delta: -v }] : []),
  ]
}

/** Aplica os efeitos (com `sinal` -1 para desfazer) numa cópia do caixa do mês. */
export function aplicarEfeitos(caixa: Caixa, efeitos: EfeitoNoSaldo[], sinal: 1 | -1 = 1): Caixa {
  const novo: Caixa = { ...caixa }
  for (const e of efeitos) novo[e.banco] = { ...novo[e.banco], [e.tipo]: centavos((novo[e.banco]?.[e.tipo] ?? 0) + sinal * e.delta) }
  return novo
}

/**
 * Os meses depois de desfazer o que `antes` fez nos saldos e aplicar o que `depois` faz. Os meses são refeitos em ordem, cada
 * um sobre o resultado do anterior: um mês sem saldo próprio herda o do mês de antes, que já está acertado (sem isso, mudar
 * a data do lançamento para um mês que herda do mês antigo contaria o valor duas vezes). `mudados` são os meses a gravar.
 */
export function ajustarMeses(meses: Mes[], antes?: Lancamento, depois?: Lancamento, hoje = new Date()): { meses: Mes[]; mudados: Mes[] } {
  const porMes = new Map<string, { ano: number; mes: number; efeitos: EfeitoNoSaldo[] }>()
  const somar = (l: Lancamento | undefined, sinal: 1 | -1) => {
    if (!l || !mesJaChegou(l.ano, l.mes, hoje)) return
    const efeitos = efeitosNoSaldo(l).map((e) => ({ ...e, delta: e.delta * sinal }))
    if (!efeitos.length) return
    const k = `${l.ano}-${l.mes}`
    const g = porMes.get(k) ?? { ano: l.ano, mes: l.mes, efeitos: [] }
    g.efeitos.push(...efeitos)
    porMes.set(k, g)
  }
  somar(antes, -1)
  somar(depois, 1)
  let lista = meses
  const mudados: Mes[] = []
  for (const g of [...porMes.values()].sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes))) {
    const ef = mesEfetivo(lista, g.ano, g.mes, hoje)
    const atual = lista.find((m) => m.ano === g.ano && m.mes === g.mes) ?? { ano: g.ano, mes: g.mes, investimentos: 0, moedas: {}, meta_usd: 0, caixa: {} }
    // o que o mês herdou passa a ser dele ao gravar (como na tela Dinheiro guardado)
    const novo: Mes = { ...atual, caixa: aplicarEfeitos(ef.caixa, g.efeitos), moedas: ef.moedas }
    lista = [...lista.filter((m) => !(m.ano === g.ano && m.mes === g.mes)), novo]
    mudados.push(novo)
  }
  return { meses: lista, mudados }
}

/** Só mexe nos saldos de um mês que já chegou: nos futuros o saldo ainda é desconhecido, não zero. */
export const mesJaChegou = (ano: number, mes: number, hoje = new Date()) => ano * 12 + mes <= hoje.getFullYear() * 12 + hoje.getMonth() + 1

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// "porco" e "reserva" sozinhos ficam de fora: "Lombo de porco (Nubank)" e "Reserva do hotel (Itaú)" são compras
const PALAVRA_DE_GUARDAR = /\b(porquinho|cofrinho|cofre|caixinha|guardar|guardei|guardando|poupanca)\b/

/**
 * "Porquinho PicPay", "Guardar no Inter", "Itaú para PicPay (porquinho)": acha o banco que recebeu o dinheiro (o último
 * que aparece no texto, fora o de onde saiu) e onde fica ("reserva" ou, no resto, a caixinha). Sem palavra de guardar, nada.
 */
export function guardadoPelaDescricao(texto: string, bancos: Banco[], origemId?: string): { banco: Banco; tipo: TipoCaixa } | null {
  const t = normal(texto)
  if (!PALAVRA_DE_GUARDAR.test(t)) return null
  let melhor: { banco: Banco; pos: number } | null = null
  for (const b of bancos) {
    if (b.id === origemId) continue
    const m = [...t.matchAll(new RegExp(`(?<![a-z0-9])${normal(b.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'g'))].pop()
    if (m && (!melhor || m.index! > melhor.pos)) melhor = { banco: b, pos: m.index! }
  }
  if (!melhor) return null
  return { banco: melhor.banco, tipo: /\breserva\b/.test(t) ? 'reserva' : 'caixinha' }
}
