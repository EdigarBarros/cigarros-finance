import { useCallback, useEffect, useMemo, useState } from 'react'
import { hojeLocal } from './cartoes'
import { supabase } from './supabase'
import type { CartaoCredito, FaturaPaga, Lancamento } from './types'

const num = (v: unknown) => Number(v ?? 0)
const normCartao = (r: CartaoCredito): CartaoCredito => ({ ...r, limite: r.limite == null ? null : num(r.limite) })
const normFatura = (r: FaturaPaga): FaturaPaga => ({ ...r, valor: num(r.valor) })
const normLanc = (r: Lancamento): Lancamento => ({
  ...r, valor: num(r.valor), valor_original: r.valor_original == null ? null : num(r.valor_original),
})
/** Tabela ou coluna ainda não criada (migração 8 pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === '42703' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

const buscar = () =>
  Promise.all([
    supabase.from('cartoes').select('*').order('created_at'),
    supabase.from('faturas_pagas').select('*').order('ano').order('mes'),
    supabase.from('lancamentos').select('*').not('cartao_id', 'is', null).order('data'),
  ])

/**
 * Cartões de crédito, faturas pagas e as compras no cartão de todos os anos (a fatura de um mês pode ter
 * parcelas de compras de anos antes). Os lançamentos do ano aberto vêm de `useDados`, que já os mantém em
 * dia na tela; os dos outros anos são carregados aqui. Só carrega quando o módulo está ligado.
 *
 * As parcelas de uma compra entram numa única inserção em lote: ou todas são gravadas ou nenhuma, sem
 * deixar uma compra pela metade se a internet cair no meio.
 */
export function useCartoes(opcoes: {
  ativo: boolean
  ano: number
  /** Lançamentos do ano aberto (de useDados). */
  lancsDoAno: Lancamento[]
  /** Sem a migração 5, a categoria vai na coluna antiga (igual ao addLanc de useDados). */
  categoriasAntigas: boolean
  /** Recarrega os lançamentos do ano aberto depois de gravar ou apagar uma compra. */
  recarregarLancs: () => Promise<unknown>
  aoErro: (msg: string) => void
}) {
  const { ativo, ano, lancsDoAno, categoriasAntigas, recarregarLancs, aoErro } = opcoes
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [faturasPagas, setFaturasPagas] = useState<FaturaPaga[]>([])
  const [todas, setTodas] = useState<Lancamento[]>([])
  const [semTabela, setSemTabela] = useState(false)
  const [carregado, setCarregado] = useState(false)

  const aplicar = useCallback(([c, f, l]: Awaited<ReturnType<typeof buscar>>) => {
    const e = c.error ?? f.error ?? l.error
    if (e && faltaTabela(e)) setSemTabela(true)
    else if (e) aoErro(e.message)
    else {
      setSemTabela(false)
      setCartoes((c.data as CartaoCredito[]).map(normCartao))
      setFaturasPagas((f.data as FaturaPaga[]).map(normFatura))
      setTodas((l.data as Lancamento[]).map(normLanc))
    }
    setCarregado(true)
  }, [aoErro])
  const recarregar = useCallback(async () => aplicar(await buscar()), [aplicar])

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    void buscar().then((r) => vivo && aplicar(r))
    return () => { vivo = false }
  }, [ativo, aplicar])

  /** Todas as compras no cartão: as do ano aberto vêm de `lancsDoAno`, as outras da carga própria. */
  const compras = useMemo(
    () => [...lancsDoAno.filter((l) => l.cartao_id && l.ano === ano), ...todas.filter((l) => l.ano !== ano)],
    [lancsDoAno, todas, ano],
  )

  const falhou = (msg: string) => {
    aoErro(msg)
    void recarregar()
    void recarregarLancs()
  }

  const addCartao = async (novo: Omit<CartaoCredito, 'id' | 'created_at'>): Promise<CartaoCredito | undefined> => {
    const { data, error } = await supabase.from('cartoes').insert(novo).select().single()
    if (error) {
      aoErro(/duplicate|unique/i.test(error.message) ? `Já existe um cartão chamado "${novo.nome}".` : error.message)
      return
    }
    const criado = normCartao(data as CartaoCredito)
    setCartoes((xs) => [...xs, criado])
    return criado
  }
  const updCartao = async (id: string, patch: Partial<CartaoCredito>) => {
    setCartoes((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('cartoes').update(patch).eq('id', id)
    if (error) falhou(/duplicate|unique/i.test(error.message) ? `Já existe um cartão chamado "${patch.nome}".` : error.message)
  }
  /** As compras continuam como saídas, só deixam de ter cartão; as faturas marcadas como pagas somem. */
  const delCartao = async (id: string) => {
    setCartoes((xs) => xs.filter((x) => x.id !== id))
    setFaturasPagas((xs) => xs.filter((x) => x.cartao_id !== id))
    setTodas((xs) => xs.filter((x) => x.cartao_id !== id))
    const { error } = await supabase.from('cartoes').delete().eq('id', id)
    if (error) falhou(error.message)
    else void recarregarLancs()
  }

  /** Grava todas as parcelas de uma compra de uma vez. */
  const addCompra = async (parcelas: Omit<Lancamento, 'id'>[]) => {
    const linhas: Record<string, unknown>[] = categoriasAntigas
      ? parcelas.map(({ categoria_id, ...resto }) => ({ ...resto, categoria: categoria_id ?? 'outros' }))
      : parcelas
    const { data, error } = await supabase.from('lancamentos').insert(linhas).select()
    if (error) return falhou(error.message)
    const novas = (data as Lancamento[]).map(normLanc)
    setTodas((xs) => [...xs, ...novas])
    await recarregarLancs()
  }
  /** Apaga todas as parcelas de uma compra. */
  const delCompra = async (compra_id: string) => {
    setTodas((xs) => xs.filter((x) => x.compra_id !== compra_id))
    const { error } = await supabase.from('lancamentos').delete().eq('compra_id', compra_id)
    if (error) return falhou(error.message)
    await recarregarLancs()
  }

  /** "Paguei a fatura": não cria outra saída, só marca a fatura (as parcelas já são as saídas do mês). */
  const pagarFatura = async (f: { cartao_id: string; ano: number; mes: number; valor: number; pago_em?: string; banco_id?: string | null }) => {
    if (faturasPagas.some((x) => x.cartao_id === f.cartao_id && x.ano === f.ano && x.mes === f.mes)) return
    const { data, error } = await supabase
      .from('faturas_pagas').insert({ ...f, pago_em: f.pago_em ?? hojeLocal(), banco_id: f.banco_id ?? null }).select().single()
    if (error) return falhou(error.message)
    setFaturasPagas((xs) => [...xs, normFatura(data as FaturaPaga)])
  }
  const desfazerPagamento = async (id: string) => {
    setFaturasPagas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('faturas_pagas').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  return {
    cartoes, faturasPagas, compras, semTabela, carregado, recarregar,
    addCartao, updCartao, delCartao, addCompra, delCompra, pagarFatura, desfazerPagamento,
  }
}

export type DadosCartoes = ReturnType<typeof useCartoes>
