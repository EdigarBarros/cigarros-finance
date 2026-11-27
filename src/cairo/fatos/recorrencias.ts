/**
 * O que se repete todo mês (assinatura, conta, salário sem conta fixa), pelos mesmos critérios da análise do app
 * (lib/analise.ts → recorrencias), para os dois concordarem:
 *  - nos últimos 6 meses fechados, em pelo menos 3 meses (2, com menos de 4 meses de histórico);
 *  - no máximo 1 vez por mês (saída que cai duas vezes no mês é do dia a dia: o mercado) ou 2 (entrada: adiantamento e
 *    salário);
 *  - regular (em 75% dos meses entre a primeira e a última vez) e ainda de pé (a última há no máximo 2 meses);
 *  - valor parecido (o maior e o menor total do mês diferem até 35%).
 */
import type { LancNormal } from './historico'

export interface Recorrencia { chave: string; tipo: 'entrada' | 'saida'; meses: number; vezesPorMes: number }

export function recorrencias(lancs: LancNormal[], atual: number, tipo: 'entrada' | 'saida'): Recorrencia[] {
  const classe = tipo === 'entrada' ? 'renda' : 'gasto'
  const janela = lancs.filter((l) => l.tipo === tipo && l.classe === classe && !l.divida && l.chave >= atual - 6 && l.chave < atual && l.chaveDescricao)
  const mesesComAlgo = new Set(janela.map((l) => l.chave)).size
  const minimo = mesesComAlgo >= 4 ? 3 : 2
  const maxVezes = tipo === 'entrada' ? 2 : 1
  const porChave = new Map<string, LancNormal[]>()
  for (const l of janela) porChave.set(l.chaveDescricao, [...(porChave.get(l.chaveDescricao) ?? []), l])
  const out: Recorrencia[] = []
  for (const [chave, ls] of porChave) {
    const porMes = new Map<number, LancNormal[]>()
    for (const l of ls) porMes.set(l.chave, [...(porMes.get(l.chave) ?? []), l])
    const vezes = Math.max(...[...porMes.values()].map((x) => x.length))
    if (porMes.size < minimo || vezes > maxVezes) continue
    const ks = [...porMes.keys()]
    if (porMes.size < 0.75 * (Math.max(...ks) - Math.min(...ks) + 1) || Math.max(...ks) < atual - 2) continue
    const totais = [...porMes.values()].map((x) => x.reduce((s, l) => s + l.valor, 0))
    const maior = Math.max(...totais)
    if (maior <= 0 || (maior - Math.min(...totais)) / maior > 0.35) continue
    out.push({ chave, tipo, meses: porMes.size, vezesPorMes: vezes })
  }
  return out
}
