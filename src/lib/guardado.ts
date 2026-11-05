import { caixaDoBanco } from './calc'
import { converter, type Taxas } from './moedas'
import type { Visao } from './perfil'
import type { Banco, Caixa } from './types'

/** Quanto há guardado somando o que está ligado: contas dos bancos, investimentos e outras moedas (na moeda principal). */
export function totalGuardado({ v, bancos, caixa, investimentos, moedas, lista, taxas }: {
  v: Visao; bancos: Banco[]; caixa: Caixa; investimentos: number; moedas: Record<string, number>; lista: string[]; taxas: Taxas
}) {
  const totalCaixa = bancos.reduce((a, b) => a + caixaDoBanco(caixa, b.id), 0)
  const totalMoedas = lista.reduce((a, m) => a + (converter(moedas[m] ?? 0, m, taxas) ?? 0), 0)
  return (v.bancos ? totalCaixa : 0) + (v.investimentos ? investimentos : 0) + (v.moedas ? totalMoedas : 0)
}
