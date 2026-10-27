import { useEffect, useState } from 'react'

export const MOEDAS: { codigo: string; nome: string; bandeira: string }[] = [
  { codigo: 'BRL', nome: 'Real', bandeira: '🇧🇷' },
  { codigo: 'USD', nome: 'Dólar americano', bandeira: '🇺🇸' },
  { codigo: 'EUR', nome: 'Euro', bandeira: '🇪🇺' },
  { codigo: 'GBP', nome: 'Libra esterlina', bandeira: '🇬🇧' },
  { codigo: 'ARS', nome: 'Peso argentino', bandeira: '🇦🇷' },
  { codigo: 'CLP', nome: 'Peso chileno', bandeira: '🇨🇱' },
  { codigo: 'UYU', nome: 'Peso uruguaio', bandeira: '🇺🇾' },
  { codigo: 'PYG', nome: 'Guarani paraguaio', bandeira: '🇵🇾' },
  { codigo: 'COP', nome: 'Peso colombiano', bandeira: '🇨🇴' },
  { codigo: 'PEN', nome: 'Sol peruano', bandeira: '🇵🇪' },
  { codigo: 'MXN', nome: 'Peso mexicano', bandeira: '🇲🇽' },
  { codigo: 'CAD', nome: 'Dólar canadense', bandeira: '🇨🇦' },
  { codigo: 'AUD', nome: 'Dólar australiano', bandeira: '🇦🇺' },
  { codigo: 'CHF', nome: 'Franco suíço', bandeira: '🇨🇭' },
  { codigo: 'JPY', nome: 'Iene japonês', bandeira: '🇯🇵' },
  { codigo: 'CNY', nome: 'Yuan chinês', bandeira: '🇨🇳' },
  { codigo: 'AOA', nome: 'Kwanza angolano', bandeira: '🇦🇴' },
  { codigo: 'MZN', nome: 'Metical moçambicano', bandeira: '🇲🇿' },
]

export const infoMoeda = (codigo: string) => MOEDAS.find((m) => m.codigo === codigo) ?? { codigo, nome: codigo, bandeira: '💱' }

/** Quanto vale 1 unidade de cada moeda na moeda principal ({ USD: 5.4 } com o real como principal). */
export type Taxas = Record<string, number>

interface Cotacao { taxas: Taxas; em: number }

const VALIDADE = 12 * 60 * 60 * 1000
const chave = (base: string) => `cambio:${base}`

function lerCache(base: string): Cotacao | null {
  try {
    const c = JSON.parse(localStorage.getItem(chave(base)) ?? 'null') as Cotacao | null
    return c?.taxas ? c : null
  } catch {
    return null
  }
}

/** As APIs devolvem "1 base = X moeda"; aqui vira "1 moeda = Y base". */
const inverter = (base: string, rates: Record<string, number>): Taxas =>
  Object.fromEntries([...Object.entries(rates).filter(([, v]) => v > 0).map(([k, v]) => [k, 1 / v]), [base, 1]])

async function buscarCotacao(base: string): Promise<Cotacao> {
  // Duas fontes gratuitas e sem chave; a segunda (Banco Central Europeu) cobre menos moedas.
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    const j = (await r.json()) as { result?: string; rates?: Record<string, number> }
    if (j.result === 'success' && j.rates) return { taxas: inverter(base, j.rates), em: Date.now() }
  } catch { /* tenta a próxima */ }
  const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`)
  const j = (await r.json()) as { rates?: Record<string, number> }
  if (!j.rates) throw new Error('Cotação indisponível')
  return { taxas: inverter(base, j.rates), em: Date.now() }
}

/**
 * Cotação do dia para converter as outras moedas na principal. Fica guardada no navegador por 12 h;
 * sem internet, usa a última que conseguiu.
 */
export function useCambio(base: string, ativo: boolean) {
  const [cotacao, setCotacao] = useState<Cotacao | null>(() => lerCache(base))
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!ativo) return
    const guardada = lerCache(base)
    if (guardada && Date.now() - guardada.em < VALIDADE) {
      queueMicrotask(() => setCotacao(guardada))
      return
    }
    let vivo = true
    buscarCotacao(base)
      .then((c) => {
        try { localStorage.setItem(chave(base), JSON.stringify(c)) } catch { /* sem armazenamento */ }
        if (vivo) { setCotacao(c); setFalhou(false) }
      })
      .catch(() => vivo && setFalhou(true))
    return () => { vivo = false }
  }, [base, ativo])

  const taxas: Taxas = cotacao && cotacao.taxas[base] === 1 ? cotacao.taxas : { [base]: 1 }
  return { taxas, atualizadaEm: cotacao?.em ?? null, falhou }
}

/** Valor convertido para a moeda principal (null se ainda não há cotação dessa moeda). */
export function converter(valor: number, moeda: string, taxas: Taxas): number | null {
  const t = taxas[moeda]
  return t ? Math.round(valor * t * 100) / 100 : null
}

/** Total das outras moedas convertido para a principal (as sem cotação ficam de fora). */
export const totalConvertido = (moedas: Record<string, number>, taxas: Taxas) =>
  Object.entries(moedas).reduce((a, [m, v]) => a + (converter(v, m, taxas) ?? 0), 0)
