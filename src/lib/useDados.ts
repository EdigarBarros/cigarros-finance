import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Divida, Lancamento, Mes } from './types'

const num = (v: unknown) => Number(v ?? 0)

const normLanc = (r: Lancamento): Lancamento => ({ ...r, valor: num(r.valor) })
const normDiv = (r: Divida): Divida => ({
  ...r,
  valor_mensal: num(r.valor_mensal),
  parcelas: num(r.parcelas),
  pagas: num(r.pagas),
})
const normMes = (r: Mes): Mes => ({
  ...r,
  investimentos: num(r.investimentos),
  usd: num(r.usd),
  meta_usd: num(r.meta_usd),
  caixa: r.caixa ?? {},
})

/** Carrega o ano inteiro (o resumo anual precisa de todos os meses) e expõe as alterações. */
export function useDados(userId: string, ano: number) {
  const [lancs, setLancs] = useState<Lancamento[]>([])
  const [dividas, setDividas] = useState<Divida[]>([])
  const [meses, setMeses] = useState<Mes[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const [l, d, m] = await Promise.all([
      supabase.from('lancamentos').select('*').eq('ano', ano).order('data').order('created_at'),
      supabase.from('dividas').select('*').eq('ano', ano).order('ordem').order('created_at'),
      supabase.from('meses').select('*').eq('ano', ano),
    ])
    const e = l.error ?? d.error ?? m.error
    if (e) setErro(e.message)
    else {
      setLancs((l.data as Lancamento[]).map(normLanc))
      setDividas((d.data as Divida[]).map(normDiv))
      setMeses((m.data as Mes[]).map(normMes))
    }
    setCarregando(false)
  }, [ano])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Toda falha de gravação mostra o erro e recarrega do banco, para a tela nunca mentir.
  const falhou = useCallback(
    (msg: string) => {
      setErro(msg)
      void recarregar()
    },
    [recarregar],
  )

  const addLanc = async (novo: Omit<Lancamento, 'id'>) => {
    const { data, error } = await supabase.from('lancamentos').insert(novo).select().single()
    if (error) return falhou(error.message)
    setLancs((xs) => [...xs, normLanc(data as Lancamento)])
  }
  const updLanc = async (id: string, patch: Partial<Lancamento>) => {
    setLancs((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('lancamentos').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  const delLanc = async (id: string) => {
    setLancs((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  const addDivida = async (nova: Omit<Divida, 'id'>) => {
    const { data, error } = await supabase.from('dividas').insert(nova).select().single()
    if (error) return falhou(error.message)
    setDividas((xs) => [...xs, normDiv(data as Divida)])
  }
  const updDivida = async (id: string, patch: Partial<Divida>) => {
    setDividas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('dividas').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  const delDivida = async (id: string) => {
    setDividas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('dividas').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  const salvarMes = async (mes: number, patch: Partial<Omit<Mes, 'ano' | 'mes'>>) => {
    const atual = meses.find((m) => m.mes === mes) ?? {
      ano, mes, investimentos: 0, usd: 0, meta_usd: 0, caixa: {},
    }
    const novo = { ...atual, ...patch }
    setMeses((xs) => [...xs.filter((m) => m.mes !== mes), novo])
    const { error } = await supabase
      .from('meses')
      .upsert({ ...novo, user_id: userId }, { onConflict: 'user_id,ano,mes' })
    if (error) falhou(error.message)
  }

  /** Copia dívidas e quadro de caixa do mês anterior (é o que se fazia duplicando a aba). */
  const copiarMesAnterior = async (mes: number) => {
    const [pa, pm] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1]
    const [d, m] = await Promise.all([
      supabase.from('dividas').select('*').eq('ano', pa).eq('mes', pm).order('ordem'),
      supabase.from('meses').select('*').eq('ano', pa).eq('mes', pm).maybeSingle(),
    ])
    if (d.error || m.error) return falhou((d.error ?? m.error)!.message)
    const copias = (d.data as Divida[]).map(({ descricao, valor_mensal, parcelas, pagas, ordem }) => ({
      ano, mes, descricao, valor_mensal, parcelas, pagas, ordem,
    }))
    if (copias.length) {
      const { error } = await supabase.from('dividas').insert(copias)
      if (error) return falhou(error.message)
    }
    if (m.data) await salvarMes(mes, { caixa: (m.data as Mes).caixa ?? {} })
    await recarregar()
    return copias.length
  }

  return {
    lancs, dividas, meses, carregando, erro, setErro, recarregar,
    addLanc, updLanc, delLanc, addDivida, updDivida, delDivida, salvarMes, copiarMesAnterior,
  }
}

export type Dados = ReturnType<typeof useDados>
