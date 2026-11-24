import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Lancamento } from './types'

/*
 * Estorno (migração 40): a compra ou o gasto que voltou para você, inteiro ou em parte.
 *
 * Como fica guardado: `valor` passa a ser o que ainda conta (o que não voltou; 0 no estorno total) e `estorno_valor` guarda
 * o que voltou, com o dia em `estornado_em`. Assim todas as somas do app (fatura, limite, gastos do mês, categorias,
 * previsão, saldo) já tiram o estorno sem mudar nada nelas, e o lançamento continua na lista, riscado, com o valor de antes.
 * Compra no cartão: o estorno vale para a compra inteira; em parcelada, cada parcela devolve a sua parte (proporcional).
 */

const centavos = (n: number) => Math.round(n * 100) / 100

export type ComEstorno = Pick<Lancamento, 'valor' | 'estorno_valor' | 'estornado_em'>

export const foiEstornado = (l: Partial<ComEstorno>) => (l.estorno_valor ?? 0) > 0
/** O valor de antes do estorno (o que a compra custou). */
export const valorAntesDoEstorno = (l: ComEstorno) => centavos(l.valor + (l.estorno_valor ?? 0))
/** Estorno total: não sobrou nada contando. */
export const estornoTotal = (l: ComEstorno) => foiEstornado(l) && l.valor < 0.005

/** Total de antes do estorno e o que já voltou, somando as parcelas de uma compra (ou o lançamento sozinho). */
export function totaisDoEstorno(parcelas: ComEstorno[]) {
  const antes = centavos(parcelas.reduce((a, l) => a + valorAntesDoEstorno(l), 0))
  const voltou = centavos(parcelas.reduce((a, l) => a + (l.estorno_valor ?? 0), 0))
  return { antes, voltou, conta: centavos(antes - voltou) }
}

export interface MudancaDeEstorno { id: string; patch: Pick<Lancamento, 'valor' | 'estorno_valor' | 'estornado_em'> }

/**
 * Marca `quanto` como estornado no dia `data`, repartido entre as parcelas na proporção de cada uma (a diferença de centavos
 * fica na última). Recomeça do valor de antes: estornar de novo troca o estorno anterior pelo novo.
 * Devolve null quando o valor não serve (zero, negativo ou mais do que a compra custou).
 */
export function planoDoEstorno(parcelas: (ComEstorno & { id: string })[], quanto: number, data: string): MudancaDeEstorno[] | null {
  const { antes } = totaisDoEstorno(parcelas)
  const q = centavos(quanto)
  if (!parcelas.length || !(q > 0) || q > antes + 0.005) return null
  const total = q >= antes - 0.005
  let restante = q
  return parcelas.map((l, i) => {
    const base = valorAntesDoEstorno(l)
    const ultima = i === parcelas.length - 1
    const volta = total ? base : ultima ? Math.min(base, centavos(restante)) : Math.min(base, centavos((base / antes) * q))
    restante = centavos(restante - volta)
    return { id: l.id, patch: { valor: centavos(base - volta), estorno_valor: volta > 0 ? volta : null, estornado_em: volta > 0 ? data : null } }
  })
}

/** Desfaz o estorno: cada parcela volta ao valor de antes. */
export function planoDesfazerEstorno(parcelas: (ComEstorno & { id: string })[]): MudancaDeEstorno[] {
  return parcelas.filter(foiEstornado).map((l) => ({ id: l.id, patch: { valor: valorAntesDoEstorno(l), estorno_valor: null, estornado_em: null } }))
}

/** Sem a migração 40 (coluna `estorno_valor`), o botão "Foi estornada" não aparece. Lê uma vez por abertura. */
let lido: boolean | null = null
export function useSemEstorno() {
  const [sem, setSem] = useState(lido ?? true)
  useEffect(() => {
    if (lido !== null) return
    let vivo = true
    void supabase.from('lancamentos').select('estorno_valor').limit(1).then(({ error }) => {
      // só a coluna que não existe conta como "sem migração"; outro erro (rede) tenta de novo na próxima abertura
      const falta = Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /estorno_valor/.test(error.message)))
      if (!error || falta) lido = falta
      if (vivo) setSem(falta || Boolean(error))
    })
    return () => { vivo = false }
  }, [])
  return sem
}
