import { useCallback, useEffect, useMemo, useState } from 'react'
import { hojeLocal, renegociada } from './cartoes'
import { lerTudo, supabase } from './supabase'
import type { CartaoCredito, FaturaPaga, FaturaParcial, Lancamento } from './types'
import { tx } from './textos'

const num = (v: unknown) => Number(v ?? 0)
const normCartao = (r: CartaoCredito): CartaoCredito => ({
  ...r, limite: r.limite == null ? null : num(r.limite), limite_garantido: num(r.limite_garantido), garantia_caixinha: Boolean(r.garantia_caixinha),
})
const normFatura = (r: FaturaPaga): FaturaPaga => ({
  ...r, valor: num(r.valor), juros: num(r.juros), tipo: r.tipo ?? 'paga', da_caixinha: Boolean(r.da_caixinha), saldo_mexido: Boolean(r.saldo_mexido),
})
const normParcial = (r: FaturaParcial): FaturaParcial => ({ ...r, valor: num(r.valor), da_caixinha: Boolean(r.da_caixinha), saldo_mexido: Boolean(r.saldo_mexido) })
const normLanc = (r: Lancamento): Lancamento => ({
  ...r, valor: num(r.valor), valor_original: r.valor_original == null ? null : num(r.valor_original),
  estorno_valor: r.estorno_valor == null ? null : num(r.estorno_valor),
})
/** Tabela ou coluna ainda não criada (migração 8 ou 9 pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === '42703' || e.code === 'PGRST205' || e.code === 'PGRST204' || /does not exist|schema cache/i.test(e.message)

const buscar = () =>
  Promise.all([
    supabase.from('cartoes').select('*').order('created_at'),
    lerTudo(() => supabase.from('faturas_pagas').select('*').order('ano').order('mes').order('id')),
    lerTudo(() => supabase.from('lancamentos').select('*').not('cartao_id', 'is', null).order('data').order('id')),
    // só para saber se a migração 9 (renegociar, juros, limite garantido) já foi rodada
    supabase.from('faturas_pagas').select('tipo, juros, juros_lanc_id, divida_id').limit(1),
    supabase.from('cartoes').select('limite_garantido, garantia_caixinha').limit(1),
    // migração 38 (pular compra, pagar parte, pagar com o cofrinho): a tabela de pagamentos de parte e a coluna da compra pulada
    lerTudo(() => supabase.from('faturas_parciais').select('*').order('pago_em').order('id')),
    supabase.from('lancamentos').select('pulada_de').limit(1),
    // migração 39 (compra que outra pessoa paga)
    supabase.from('lancamentos').select('pago_por').limit(1),
  ])

/** Campos que só existem com a migração 9: sem ela, ficam de fora do que é gravado. */
const EXTRAS_CARTAO = ['limite_garantido', 'garantia_caixinha'] as const
const EXTRAS_FATURA = ['tipo', 'juros', 'juros_lanc_id', 'divida_id', 'obs'] as const
/** Campos que só existem com a migração 38. */
const EXTRAS_FATURA_38 = ['da_caixinha', 'saldo_mexido'] as const
const sem = <T extends object>(o: T, campos: readonly string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !campos.includes(k))) as Partial<T>

export type NovoPagamento = Omit<FaturaPaga, 'id' | 'pago_em' | 'banco_id'> & { pago_em?: string; banco_id?: string | null }
export type NovoParcial = Omit<FaturaParcial, 'id'>

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
  /** Pagamentos de parte das faturas (migração 38). */
  const [parciais, setParciais] = useState<FaturaParcial[]>([])
  /** Migração 38 pendente: pular compra, pagar parte e pagar com o cofrinho ficam desligados. */
  const [sem38, setSem38] = useState(false)
  /** Migração 39 pendente: "Quem paga esta compra?" fica desligado. */
  const [semPagoPor, setSemPagoPor] = useState(false)
  const [carregado, setCarregado] = useState(false)

  const aplicar = useCallback(([c, f, l, xf, xc, p, xp, x39]: Awaited<ReturnType<typeof buscar>>) => {
    setSemPagoPor(Boolean(x39.error && faltaTabela(x39.error)))
    const e = c.error ?? f.error ?? l.error
    const ex = xf.error ?? xc.error
    setSemExtras(Boolean(ex && faltaTabela(ex)))
    const e38 = p.error ?? xp.error
    setSem38(Boolean(e38 && faltaTabela(e38)))
    if (!p.error) setParciais((p.data as FaturaParcial[]).map(normParcial))
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
  /** Devolve false quando não gravou (o formulário fica aberto para a pessoa ajeitar). */
  const updCartao = async (id: string, patch: Partial<CartaoCredito>): Promise<boolean> => {
    setCartoes((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('cartoes').update(semExtras ? sem(patch, EXTRAS_CARTAO) : patch).eq('id', id)
    if (error) falhou(/duplicate|unique/i.test(error.message) ? tx('Já existe um cartão chamado "{0}".', patch.nome) : error.message)
    return !error
  }
  /** O cartão tem fatura renegociada (virou uma dívida em parcelas)? */
  const temRenegociada = (cartaoId: string) => faturasPagas.some((x) => x.cartao_id === cartaoId && renegociada(x))
  /**
   * As compras continuam como saídas, só deixam de ter cartão; as faturas marcadas como pagas somem. Com fatura renegociada
   * não exclui: as compras dela voltariam às saídas do mês e contariam duas vezes junto com a dívida do acordo.
   */
  const delCartao = async (id: string) => {
    if (temRenegociada(id)) {
      aoErro(tx('Este cartão tem uma fatura renegociada. Desfaça a renegociação antes de excluir, ou desligue "Ainda uso este cartão".'))
      return false
    }
    setCartoes((xs) => xs.filter((x) => x.id !== id))
    setFaturasPagas((xs) => xs.filter((x) => x.cartao_id !== id))
    setParciais((xs) => xs.filter((x) => x.cartao_id !== id))
    setTodas((xs) => xs.filter((x) => x.cartao_id !== id))
    const { error } = await supabase.from('cartoes').delete().eq('id', id)
    if (error) falhou(error.message)
    else void recarregarLancs()
    return !error
  }

  /** Grava todas as parcelas de uma compra de uma vez. */
  /** Devolve true quando gravou (o formulário só segue, avisa e fecha depois disso). */
  const addCompra = async (parcelas: Omit<Lancamento, 'id'>[]): Promise<boolean> => {
    const linhas: Record<string, unknown>[] = categoriasAntigas
      ? parcelas.map(({ categoria_id, ...resto }) => ({ ...resto, categoria: categoria_id ?? 'outros' }))
      : parcelas
    const { data, error } = await supabase.from('lancamentos').insert(linhas).select()
    if (error) {
      falhou(error.message)
      return false
    }
    const novas = (data as Lancamento[]).map(normLanc)
    setTodas((xs) => [...xs, ...novas])
    void recarregarLancs()
    return true
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
    const { data, error } = await supabase.from('faturas_pagas').insert(semCampos(linha)).select().single()
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
    const { error } = await supabase.from('faturas_pagas').update(semCampos(patch)).eq('id', id)
    if (error) falhou(error.message)
    return !error
  }
  const desfazerPagamento = async (id: string) => {
    setFaturasPagas((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('faturas_pagas').delete().eq('id', id)
    if (error) falhou(error.message)
    return !error
  }
  /** Tira da linha os campos das migrações que ainda não foram rodadas. */
  function semCampos<T extends object>(linha: T): Partial<T> {
    const fora = [...(semExtras ? EXTRAS_FATURA : []), ...(sem38 ? EXTRAS_FATURA_38 : [])]
    return fora.length ? sem(linha, fora) : linha
  }

  // ---------- pagamento de parte da fatura (migração 38) ----------

  /** Paguei uma parte: a fatura continua em aberto pelo que falta. */
  const pagarParte = async (p: NovoParcial): Promise<FaturaParcial | undefined> => {
    const { data, error } = await supabase.from('faturas_parciais').insert(p).select().single()
    if (error) {
      falhou(error.message)
      return
    }
    const nova = normParcial(data as FaturaParcial)
    setParciais((xs) => [...xs, nova])
    return nova
  }
  const editarParte = async (id: string, patch: Partial<FaturaParcial>) => {
    setParciais((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('faturas_parciais').update(patch).eq('id', id)
    if (error) falhou(error.message)
    return !error
  }
  const apagarParte = async (id: string) => {
    setParciais((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('faturas_parciais').delete().eq('id', id)
    if (error) falhou(error.message)
    return !error
  }

  /** Muda todas as parcelas de uma compra de uma vez (quem paga). */
  const atualizarCompra = async (compra_id: string, patch: Partial<Lancamento>) => {
    setTodas((xs) => xs.map((x) => (x.compra_id === compra_id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('lancamentos').update(patch).eq('compra_id', compra_id)
    if (error) return falhou(error.message)
    await recarregarLancs()
  }

  // ---------- pular compra para a próxima fatura (migração 38) ----------

  /**
   * Muda parcelas de fatura (pular para a próxima ou voltar): cada uma recebe o seu `patch` (ano, mês, data e `pulada_de`).
   * Grava uma por uma; se alguma falhar, recarrega tudo para a tela mostrar o que ficou de verdade.
   */
  const moverParcelas = async (mudancas: { id: string; patch: Partial<Lancamento> }[]): Promise<boolean> => {
    if (!mudancas.length) return true
    const porId = new Map(mudancas.map((m) => [m.id, m.patch]))
    setTodas((xs) => xs.map((x) => (porId.has(x.id) ? { ...x, ...porId.get(x.id) } : x)))
    for (const m of mudancas) {
      const { error } = await supabase.from('lancamentos').update(m.patch).eq('id', m.id)
      if (error) {
        falhou(error.message)
        return false
      }
    }
    await Promise.all([recarregar(), recarregarLancs()])
    return true
  }

  return {
    cartoes, faturasPagas, parciais, compras, semTabela, semExtras, sem38, semPagoPor, carregado, recarregar, atualizarCompra,
    addCartao, updCartao, delCartao, temRenegociada, addCompra, delCompra, pagarFatura, editarPagamento, desfazerPagamento,
    pagarParte, editarParte, apagarParte, moverParcelas,
  }
}

export type DadosCartoes = ReturnType<typeof useCartoes>
