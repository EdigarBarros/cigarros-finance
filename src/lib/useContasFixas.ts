import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { ContaFixa } from './types'

/** Tabela ainda não criada (migração pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

const consultar = () => supabase.from('contas_fixas').select('*').order('dia').order('created_at')

const norm = (r: ContaFixa): ContaFixa => ({ ...r, valor: Number(r.valor ?? 0), dia: Number(r.dia) })

/**
 * As contas fixas da pessoa (não dependem do ano). A baixa ("Paguei") não passa por aqui:
 * é um lançamento comum, criado com o addLanc de useDados.
 */
export function useContasFixas(aoErro: (msg: string) => void) {
  const [contas, setContas] = useState<ContaFixa[]>([])
  /** Sem a migração 7 não há onde guardar as contas. */
  const [semTabela, setSemTabela] = useState(false)
  const [carregando, setCarregando] = useState(true)

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

  const addConta = async (nova: Omit<ContaFixa, 'id'>) => {
    const { data, error } = await supabase.from('contas_fixas').insert(nova).select().single()
    if (error) return falhou(error.message)
    setContas((xs) => [...xs, norm(data as ContaFixa)])
  }
  const updConta = async (id: string, patch: Partial<ContaFixa>) => {
    setContas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('contas_fixas').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  /** Os lançamentos que já foram pagos continuam existindo, só deixam de estar ligados à conta. */
  const delConta = async (id: string) => {
    setContas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('contas_fixas').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  return { contas, semTabela, carregando, addConta, updConta, delConta, recarregar }
}

export type ContasFixas = ReturnType<typeof useContasFixas>
