import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ContaFixa } from './types'

/** Tabela ainda não criada (migração pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

const consultar = () => supabase.from('contas_fixas').select('*').order('dia').order('created_at')

/** Sem as migrações 14 (moeda) e 15 (cotação) as colunas não existem: o campo fica de fora do que é gravado. */
const colunaFaltando = (e: { code?: string; message: string }) => /moeda|cotacao/.test(e.message) && (e.code === '42703' || e.code === 'PGRST204')
const tirarNovas = <T extends object>(o: T): T => { const { moeda: _m, cotacao: _c, ...resto } = o as T & { moeda?: unknown; cotacao?: unknown }; return resto as T }

const norm = (r: ContaFixa): ContaFixa => ({ ...r, valor: Number(r.valor ?? 0), dia: Number(r.dia), cotacao: r.cotacao == null ? null : Number(r.cotacao) })

/**
 * As contas fixas da pessoa (não dependem do ano). A baixa ("Paguei") não passa por aqui:
 * é um lançamento comum, criado com o addLanc de useDados.
 */
export function useContasFixas(aoErro: (msg: string) => void) {
  const [contas, setContas] = useState<ContaFixa[]>([])
  /** Sem a migração 7 não há onde guardar as contas. */
  const [semTabela, setSemTabela] = useState(false)
  const [carregando, setCarregando] = useState(true)
  /** Sem a migração 14, as contas ficam só na moeda principal. */
  const [semMoeda, setSemMoeda] = useState(false)
  useEffect(() => {
    void supabase.from('contas_fixas').select('moeda').limit(1).then(({ error }) => setSemMoeda(Boolean(error)))
  }, [])

  const aplicar = useCallback(({ data, error }: Awaited<ReturnType<typeof consultar>>) => {
    if (error && faltaTabela(error)) setSemTabela(true)
    else if (error) aoErro(error.message)
    else setContas((data as ContaFixa[]).map(norm))
    setCarregando(false)
  }, [aoErro])
  const recarregar = useCallback(async () => aplicar(await consultar()), [aplicar])

  useEffect(() => {
    void consultar().then(aplicar)
  }, [aplicar])

  // Toda falha de gravação mostra o erro e recarrega do banco, para a tela nunca mentir.
  const falhou = (msg: string) => {
    aoErro(msg)
    void recarregar()
  }

  const faltaMoeda = useRef(false)
  const addConta = async (nova: Omit<ContaFixa, 'id'>) => {
    let r = await supabase.from('contas_fixas').insert(faltaMoeda.current ? tirarNovas(nova) : nova).select().single()
    if (r.error && !faltaMoeda.current && colunaFaltando(r.error)) {
      faltaMoeda.current = true
      r = await supabase.from('contas_fixas').insert(tirarNovas(nova)).select().single()
    }
    if (r.error) return falhou(r.error.message)
    setContas((xs) => [...xs, norm(r.data as ContaFixa)])
  }
  const updConta = async (id: string, patch: Partial<ContaFixa>) => {
    setContas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    let { error } = await supabase.from('contas_fixas').update(faltaMoeda.current ? tirarNovas(patch) : patch).eq('id', id)
    if (error && !faltaMoeda.current && colunaFaltando(error)) {
      faltaMoeda.current = true
      ;({ error } = await supabase.from('contas_fixas').update(tirarNovas(patch)).eq('id', id))
    }
    if (error) falhou(error.message)
  }
  /** Os lançamentos que já foram pagos continuam existindo, só deixam de estar ligados à conta. */
  const delConta = async (id: string) => {
    setContas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('contas_fixas').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  return { contas, semTabela, semMoeda, carregando, addConta, updConta, delConta, recarregar }
}

export type ContasFixas = ReturnType<typeof useContasFixas>
