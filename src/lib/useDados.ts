import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Banco, Divida, Lancamento, Mes, Pagamento, SaldoDivida } from './types'

const num = (v: unknown) => Number(v ?? 0)

const normLanc = (r: Lancamento): Lancamento => ({ ...r, valor: num(r.valor) })
const normDiv = (r: Divida): Divida => ({ ...r, valor_parcela: r.valor_parcela == null ? null : num(r.valor_parcela) })
const normSaldo = (r: SaldoDivida): SaldoDivida => ({ ...r, saldo: num(r.saldo) })
const normMes = (r: Mes): Mes => ({
  ...r,
  investimentos: num(r.investimentos),
  usd: num(r.usd),
  meta_usd: num(r.meta_usd),
  caixa: r.caixa ?? {},
})
const paraPagamento = (l: Lancamento): Pagamento | null =>
  l.divida_id && l.tipo === 'saida' ? { id: l.id, divida_id: l.divida_id, data: l.data, valor: l.valor } : null

/**
 * Lançamentos do ano aberto + tudo que atravessa os anos (dívidas, saldos, pagamentos e meses),
 * para que dívida e caixa sejam calculados de forma contínua.
 */
export function useDados(userId: string, ano: number) {
  const [lancs, setLancs] = useState<Lancamento[]>([])
  const [meses, setMeses] = useState<Mes[]>([])
  const [dividas, setDividas] = useState<Divida[]>([])
  const [saldos, setSaldos] = useState<SaldoDivida[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const [l, m, d, s, p, b] = await Promise.all([
      supabase.from('lancamentos').select('*').eq('ano', ano).order('data').order('created_at'),
      supabase.from('meses').select('*'),
      supabase.from('dividas').select('*').order('created_at'),
      supabase.from('divida_saldos').select('*').order('data'),
      supabase.from('lancamentos').select('id, divida_id, data, valor').not('divida_id', 'is', null),
      supabase.from('bancos').select('*').order('ordem').order('created_at'),
    ])
    const e = l.error ?? m.error ?? d.error ?? s.error ?? p.error ?? b.error
    if (e) setErro(e.message)
    else {
      setLancs((l.data as Lancamento[]).map(normLanc))
      setMeses((m.data as Mes[]).map(normMes))
      setDividas((d.data as Divida[]).map(normDiv))
      setSaldos((s.data as SaldoDivida[]).map(normSaldo))
      setPagamentos((p.data as Pagamento[]).map((x) => ({ ...x, valor: num(x.valor) })))
      setBancos(b.data as Banco[])
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

  /** Mantém a lista de pagamentos (que cobre todos os anos) igual aos lançamentos. */
  const sincronizarPagamento = (id: string, l: Lancamento | null) =>
    setPagamentos((xs) => {
      const sem = xs.filter((x) => x.id !== id)
      const p = l && paraPagamento(l)
      return p ? [...sem, p] : sem
    })

  const addLanc = async (novo: Omit<Lancamento, 'id'>) => {
    const { data, error } = await supabase.from('lancamentos').insert(novo).select().single()
    if (error) return falhou(error.message)
    const l = normLanc(data as Lancamento)
    if (l.ano === ano) setLancs((xs) => [...xs, l])
    sincronizarPagamento(l.id, l)
  }
  const updLanc = async (id: string, patch: Partial<Lancamento>) => {
    const atual = lancs.find((x) => x.id === id)
    const novo = atual ? { ...atual, ...patch } : null
    setLancs((xs) => (novo && novo.ano !== ano ? xs.filter((x) => x.id !== id) : xs.map((x) => (x.id === id ? { ...x, ...patch } : x))))
    if (novo) sincronizarPagamento(id, novo)
    const { error } = await supabase.from('lancamentos').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  const delLanc = async (id: string) => {
    setLancs((xs) => xs.filter((x) => x.id !== id))
    sincronizarPagamento(id, null)
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  /** Cria a dívida já com o saldo devedor de partida. */
  const addDivida = async (d: { descricao: string; valor_parcela: number | null; saldo: number; data: string }) => {
    const { data, error } = await supabase
      .from('dividas').insert({ descricao: d.descricao, valor_parcela: d.valor_parcela }).select().single()
    if (error) return falhou(error.message)
    const nova = normDiv(data as Divida)
    setDividas((xs) => [...xs, nova])
    await addSaldo(nova.id, d.data, d.saldo)
  }
  const updDivida = async (id: string, patch: Partial<Divida>) => {
    setDividas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('dividas').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  const delDivida = async (id: string) => {
    setDividas((xs) => xs.filter((x) => x.id !== id))
    setSaldos((xs) => xs.filter((x) => x.divida_id !== id))
    setPagamentos((xs) => xs.filter((x) => x.divida_id !== id))
    setLancs((xs) => xs.map((x) => (x.divida_id === id ? { ...x, divida_id: null } : x)))
    const { error } = await supabase.from('dividas').delete().eq('id', id)
    if (error) falhou(error.message)
  }
  /** "Hoje o saldo devedor é X" — corrige juros, acordos e o que mais o banco mudar. */
  const addSaldo = async (divida_id: string, data: string, saldo: number) => {
    const { data: linha, error } = await supabase.from('divida_saldos').insert({ divida_id, data, saldo }).select().single()
    if (error) return falhou(error.message)
    setSaldos((xs) => [...xs, normSaldo(linha as SaldoDivida)])
  }

  const salvarMes = async (anoMes: number, mes: number, patch: Partial<Omit<Mes, 'ano' | 'mes'>>) => {
    const atual = meses.find((m) => m.ano === anoMes && m.mes === mes) ?? {
      ano: anoMes, mes, investimentos: 0, usd: 0, meta_usd: 0, caixa: {},
    }
    const novo = { ...atual, ...patch }
    setMeses((xs) => [...xs.filter((m) => !(m.ano === anoMes && m.mes === mes)), novo])
    const { error } = await supabase
      .from('meses')
      .upsert({ ...novo, user_id: userId }, { onConflict: 'user_id,ano,mes' })
    if (error) falhou(error.message)
  }

  const addBanco = async (nome: string, cor: string): Promise<Banco | undefined> => {
    const { data, error } = await supabase.from('bancos').insert({ nome, cor, ordem: bancos.length }).select().single()
    if (error) {
      falhou(/duplicate|unique/i.test(error.message) ? `Já existe um banco chamado "${nome}".` : error.message)
      return
    }
    const novo = data as Banco
    setBancos((xs) => [...xs, novo])
    return novo
  }
  const updBanco = async (id: string, patch: Partial<Banco>) => {
    setBancos((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('bancos').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  /** Os lançamentos do banco continuam existindo, só ficam "sem banco". */
  const delBanco = async (id: string) => {
    setBancos((xs) => xs.filter((x) => x.id !== id))
    setLancs((xs) => xs.map((x) => (x.banco_id === id ? { ...x, banco_id: null } : x)))
    const { error } = await supabase.from('bancos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  return {
    bancos, addBanco, updBanco, delBanco,
    lancs, meses, dividas, saldos, pagamentos, carregando, erro, setErro, recarregar,
    addLanc, updLanc, delLanc, addDivida, updDivida, delDivida, addSaldo, salvarMes,
  }
}

export type Dados = ReturnType<typeof useDados>
