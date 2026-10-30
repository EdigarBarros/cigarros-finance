import { useCallback, useEffect, useMemo, useState } from 'react'
import { hojeLocal } from './cartoes'
import { lerTudo, supabase } from './supabase'
import type { CartaoCredito, FaturaPaga, Lancamento } from './types'
import { tx } from './textos'

const num = (v: unknown) => Number(v ?? 0)
const normCartao = (r: CartaoCredito): CartaoCredito => ({
  ...r, limite: r.limite == null ? null : num(r.limite), limite_garantido: num(r.limite_garantido), garantia_caixinha: Boolean(r.garantia_caixinha),
})
const normFatura = (r: FaturaPaga): FaturaPaga => ({ ...r, valor: num(r.valor), juros: num(r.juros), tipo: r.tipo ?? 'paga' })
const normLanc = (r: Lancamento): Lancamento => ({
  ...r, valor: num(r.valor), valor_original: r.valor_original == null ? null : num(r.valor_original),
})
/** Tabela ou coluna ainda não criada (migração 8 ou 9 pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === '42703' || e.code === 'PGRST205' || e.code === 'PGRST204' || /does not exist|schema cache/i.test(e.message)

const buscar = () =>
  Promise.all([
    supabase.from('cartoes').select('*').order('created_at'),
    supabase.from('faturas_pagas').select('*').order('ano').order('mes'),
    lerTudo(() => supabase.from('lancamentos').select('*').not('cartao_id', 'is', null).order('data').order('id')),
    // só para saber se a migração 9 (renegociar, juros, limite garantido) já foi rodada
    supabase.from('faturas_pagas').select('tipo, juros, juros_lanc_id, divida_id').limit(1),
    supabase.from('cartoes').select('limite_garantido, garantia_caixinha').limit(1),
  ])

/** Campos que só existem com a migração 9: sem ela, ficam de fora do que é gravado. */
const EXTRAS_CARTAO = ['limite_garantido', 'garantia_caixinha'] as const
const EXTRAS_FATURA = ['tipo', 'juros', 'juros_lanc_id', 'divida_id', 'obs'] as const
const sem = <T extends object>(o: T, campos: readonly string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !campos.includes(k))) as Partial<T>

export type NovoPagamento = Omit<FaturaPaga, 'id' | 'pago_em' | 'banco_id'> & { pago_em?: string; banco_id?: string | null }

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
  /** Migração 9 pendente: as funções novas (renegociar, juros, limite garantido) ficam desligadas. */
  const [semExtras, setSemExtras] = useState(false)
  const [carregado, setCarregado] = useState(false)

  const aplicar = useCallback(([c, f, l, xf, xc]: Awaited<ReturnType<typeof buscar>>) => {
    const e = c.error ?? f.error ?? l.error
    const ex = xf.error ?? xc.error
    setSemExtras(Boolean(ex && faltaTabela(ex)))
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
    const { data, error } = await supabase.from('cartoes').insert(semExtras ? sem(novo, EXTRAS_CARTAO) : novo).select().single()
    if (error) {
      aoErro(/duplicate|unique/i.test(error.message) ? tx('Já existe um cartão chamado "{0}".', novo.nome) : error.message)
      return
    }
    const criado = normCartao(data as CartaoCredito)
    setCartoes((xs) => [...xs, criado])
    return criado
  }
  const updCartao = async (id: string, patch: Partial<CartaoCredito>) => {
    setCartoes((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('cartoes').update(semExtras ? sem(patch, EXTRAS_CARTAO) : patch).eq('id', id)
    if (error) falhou(/duplicate|unique/i.test(error.message) ? tx('Já existe um cartão chamado "{0}".', patch.nome) : error.message)
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

  /**
   * "Paguei a fatura" (ou "Renegociei", com `tipo: 'renegociada'`): não cria outra saída, só marca a fatura (as parcelas
   * já são as saídas do mês). Juros e a dívida da renegociação são criados antes por quem chama, e chegam aqui pelos ids.
   */
  const pagarFatura = async (f: NovoPagamento): Promise<FaturaPaga | undefined> => {
    if (faturasPagas.some((x) => x.cartao_id === f.cartao_id && x.ano === f.ano && x.mes === f.mes)) return
    const linha = { ...f, pago_em: f.pago_em ?? hojeLocal(), banco_id: f.banco_id ?? null }
    const { data, error } = await supabase.from('faturas_pagas').insert(semExtras ? sem(linha, EXTRAS_FATURA) : linha).select().single()
    if (error) {
      falhou(error.message)
      return
    }
    const nova = normFatura(data as FaturaPaga)
    setFaturasPagas((xs) => [...xs, nova])
    return nova
  }
  /** Ajeita uma fatura já paga: valor, dia, banco, juros. */
  const editarPagamento = async (id: string, patch: Partial<FaturaPaga>) => {
    setFaturasPagas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('faturas_pagas').update(semExtras ? sem(patch, EXTRAS_FATURA) : patch).eq('id', id)
    if (error) falhou(error.message)
  }
  const desfazerPagamento = async (id: string) => {
    setFaturasPagas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('faturas_pagas').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  return {
    cartoes, faturasPagas, compras, semTabela, semExtras, carregado, recarregar,
    addCartao, updCartao, delCartao, addCompra, delCompra, pagarFatura, editarPagamento, desfazerPagamento,
  }
}

export type DadosCartoes = ReturnType<typeof useCartoes>
