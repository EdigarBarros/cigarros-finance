import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GOSTO_VAZIO, normGosto, type Gosto } from './gosto'
import { carteira, linhaDoTempo, valorPorMes, type Carteira, type EntradaCarteira, type FaixaDeLiquidez, type PontoDaLinha } from './invest/carteira'
import { haNoventaDias } from './invest/descobertas'
import { useIndices, type Indices } from './invest/indices'
import { normPlano, PLANO_PADRAO, type Ativo, type Importacao, type LinhaPendente, type Operacao, type Plano, type PrecoInvest } from './invest/tipos'
import type { Taxas } from './moedas'
import { lerTudo, supabase } from './supabase'
import { tx } from './textos'

const num = (v: unknown) => Number(v ?? 0)
const numOuNulo = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const normAtivo = (r: Ativo): Ativo => ({ ...r, taxa: numOuNulo(r.taxa), por_valor: Boolean(r.por_valor), liquidez_dias: numOuNulo(r.liquidez_dias) })
const normOp = (r: Operacao): Operacao => ({
  ...r, quantidade: numOuNulo(r.quantidade), preco: numOuNulo(r.preco), valor: num(r.valor), custos: num(r.custos), impostos: num(r.impostos),
  fator: numOuNulo(r.fator), cotacao: numOuNulo(r.cotacao), mexe_saldo: Boolean(r.mexe_saldo), origem: r.origem ?? 'manual',
})
const normPreco = (r: PrecoInvest): PrecoInvest => ({ ...r, valor: num(r.valor) })
const normImportacao = (r: Importacao): Importacao => ({ ...r, pendentes: Array.isArray(r.pendentes) ? r.pendentes : [] })

/** Tabela ainda não criada (migração 27 pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

const buscar = () =>
  Promise.all([
    supabase.from('invest_ativos').select('*').order('created_at').order('id'),
    lerTudo<Operacao>(() => supabase.from('invest_operacoes').select('*').order('data').order('created_at').order('id')),
    lerTudo<PrecoInvest>(() => supabase.from('invest_precos').select('*').order('data').order('id')),
    supabase.from('invest_importacoes').select('*').order('created_at'),
    supabase.from('invest_config').select('*').maybeSingle(),
  ])

export type NovoAtivo = Omit<Ativo, 'id' | 'created_at'>
export type NovaOperacao = Omit<Operacao, 'id' | 'created_at' | 'atualizado_em'>
/** A organização da tela antes da última mudança de ordem (para "Desfazer a reorganização"). */
export interface OrganizacaoAnterior { ordem: string[]; desenhos: Record<string, string>; fav: string[]; oculto: string[] }

const chaveGosto = (userId: string) => `opuscash-invest-gosto-${userId}`
const gostoLocal = (userId: string): Gosto => {
  try {
    const t = localStorage.getItem(chaveGosto(userId))
    return t ? normGosto(JSON.parse(t)) : GOSTO_VAZIO
  } catch { return GOSTO_VAZIO }
}

/**
 * Os dados do Invest (tabelas da migração 27): ativos, operações, preços, importações e a configuração da pessoa (o plano e
 * o que a tela aprendeu). Só carrega com o módulo de investimentos ligado. Toda gravação que falha mostra o erro e
 * recarrega do banco, para a tela nunca mostrar um saldo que não foi salvo.
 */
export function useInvestDados(opcoes: { ativo: boolean; userId: string; aoErro: (msg: string) => void }) {
  const { ativo, userId, aoErro } = opcoes
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [precos, setPrecos] = useState<PrecoInvest[]>([])
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [plano, setPlano] = useState<Plano>(PLANO_PADRAO)
  const [gosto, setGosto] = useState<Gosto>(() => gostoLocal(userId))
  const [anterior, setAnterior] = useState<OrganizacaoAnterior | null>(null)
  const [semTabela, setSemTabela] = useState(false)
  const [carregado, setCarregado] = useState(false)
  /** A linha de invest_config já existe (a primeira gravação cria, as outras atualizam). */
  const temConfig = useRef(false)
  const agora = useRef({ plano, gosto, anterior })
  useEffect(() => { agora.current = { plano, gosto, anterior } })

  const aplicar = useCallback(([a, o, p, i, c]: Awaited<ReturnType<typeof buscar>>) => {
    const e = a.error ?? o.error ?? p.error ?? i.error ?? c.error
    if (e && faltaTabela(e)) setSemTabela(true)
    else if (e) aoErro(e.message)
    else {
      setSemTabela(false)
      setAtivos((a.data as Ativo[]).map(normAtivo))
      setOperacoes(o.data.map(normOp))
      setPrecos(p.data.map(normPreco))
      setImportacoes((i.data as Importacao[]).map(normImportacao))
      const cfg = c.data as { plano?: unknown; gosto?: { anterior?: OrganizacaoAnterior } | null } | null
      temConfig.current = Boolean(cfg)
      setPlano(normPlano(cfg?.plano))
      // entre o gosto deste aparelho e o do banco, vale o que sabe mais (como no Consultor)
      const doBanco = normGosto(cfg?.gosto)
      setGosto((g) => (doBanco.total > g.total ? doBanco : g))
      setAnterior(cfg?.gosto?.anterior ?? null)
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

  const falhou = (msg: string) => {
    aoErro(msg)
    void recarregar()
  }

  // ---------- ativos ----------
  const addAtivo = async (novo: NovoAtivo): Promise<Ativo | undefined> => {
    const { data, error } = await supabase.from('invest_ativos').insert(novo).select().single()
    if (error) { falhou(error.message); return }
    const criado = normAtivo(data as Ativo)
    setAtivos((xs) => [...xs, criado])
    return criado
  }
  const updAtivo = async (id: string, patch: Partial<NovoAtivo>): Promise<boolean> => {
    setAtivos((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('invest_ativos').update(patch).eq('id', id)
    if (error) falhou(error.message)
    return !error
  }
  /** Apaga o ativo com as operações e os preços dele (o banco apaga em cascata). */
  const delAtivo = async (id: string): Promise<boolean> => {
    setAtivos((xs) => xs.filter((x) => x.id !== id))
    setOperacoes((xs) => xs.filter((x) => x.ativo_id !== id))
    setPrecos((xs) => xs.filter((x) => x.ativo_id !== id))
    const { error } = await supabase.from('invest_ativos').delete().eq('id', id)
    if (error) falhou(error.message)
    return !error
  }

  // ---------- operações ----------
  const addOperacao = async (nova: NovaOperacao): Promise<Operacao | undefined> => {
    const { data, error } = await supabase.from('invest_operacoes').insert(nova).select().single()
    if (error) { falhou(error.message); return }
    const criada = normOp(data as Operacao)
    setOperacoes((xs) => [...xs, criada])
    return criada
  }
  /**
   * Grava várias operações de uma vez (importação): ou todas entram, ou nenhuma. Se o banco recusar por operação repetida
   * (a mesma chave já existe), tenta uma a uma e conta as recusadas, sem duplicar nada.
   */
  const addOperacoes = async (novas: NovaOperacao[]): Promise<{ gravadas: Operacao[]; repetidas: number; erro: string | null }> => {
    if (!novas.length) return { gravadas: [], repetidas: 0, erro: null }
    const lote = await supabase.from('invest_operacoes').insert(novas).select()
    if (!lote.error) {
      const gravadas = (lote.data as Operacao[]).map(normOp)
      setOperacoes((xs) => [...xs, ...gravadas])
      return { gravadas, repetidas: 0, erro: null }
    }
    if (lote.error.code !== '23505') return { gravadas: [], repetidas: 0, erro: lote.error.message }
    const gravadas: Operacao[] = []
    let repetidas = 0
    for (const n of novas) {
      const r = await supabase.from('invest_operacoes').insert(n).select().single()
      if (r.error?.code === '23505') repetidas++
      else if (r.error) return { gravadas, repetidas, erro: r.error.message }
      else gravadas.push(normOp(r.data as Operacao))
    }
    setOperacoes((xs) => [...xs, ...gravadas])
    return { gravadas, repetidas, erro: null }
  }
  const updOperacao = async (id: string, patch: Partial<NovaOperacao>): Promise<boolean> => {
    const comData = { ...patch, atualizado_em: new Date().toISOString() }
    setOperacoes((xs) => xs.map((x) => (x.id === id ? { ...x, ...comData } : x)))
    const { error } = await supabase.from('invest_operacoes').update(comData).eq('id', id)
    if (error) falhou(error.message)
    return !error
  }
  const delOperacao = async (id: string): Promise<boolean> => {
    setOperacoes((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('invest_operacoes').delete().eq('id', id)
    if (error) falhou(error.message)
    return !error
  }

  // ---------- preços e saldos informados ----------
  /** Um valor por ativo, por dia e por natureza: informar de novo no mesmo dia troca o anterior. */
  const salvarPreco = async (novo: Omit<PrecoInvest, 'id' | 'referencia'>): Promise<boolean> => {
    const referencia = new Date().toISOString()
    const existente = precos.find((p) => p.ativo_id === novo.ativo_id && p.data === novo.data && p.natureza === novo.natureza)
    if (existente) {
      setPrecos((xs) => xs.map((x) => (x.id === existente.id ? { ...x, ...novo, referencia } : x)))
      const { error } = await supabase.from('invest_precos').update({ valor: novo.valor, fonte: novo.fonte, moeda: novo.moeda, referencia }).eq('id', existente.id)
      if (error) falhou(error.message)
      return !error
    }
    const { data, error } = await supabase.from('invest_precos').insert({ ...novo, referencia }).select().single()
    if (error) { falhou(error.message); return false }
    setPrecos((xs) => [...xs, normPreco(data as PrecoInvest)])
    return true
  }
  const delPreco = async (id: string) => {
    setPrecos((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('invest_precos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  // ---------- importações ----------
  const addImportacao = async (nova: Omit<Importacao, 'id' | 'created_at'>): Promise<Importacao | undefined> => {
    const { data, error } = await supabase.from('invest_importacoes').insert(nova).select().single()
    if (error) { falhou(error.message); return }
    const criada = normImportacao(data as Importacao)
    setImportacoes((xs) => [...xs, criada])
    return criada
  }
  const updImportacao = async (id: string, patch: Partial<Pick<Importacao, 'pendentes' | 'importadas' | 'repetidas'>>) => {
    setImportacoes((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('invest_importacoes').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  /** Tira uma linha pendente da lista (resolvida à mão ou descartada pela pessoa). */
  const resolverPendente = (importacaoId: string, linha: LinhaPendente) => {
    const imp = importacoes.find((x) => x.id === importacaoId)
    if (imp) void updImportacao(importacaoId, { pendentes: imp.pendentes.filter((p) => !(p.onde === linha.onde && p.texto === linha.texto)) })
  }

  // ---------- plano e gosto (uma linha por pessoa) ----------
  const gravarConfig = async (p: Plano, g: Gosto, ant: OrganizacaoAnterior | null) => {
    const linha = { plano: p, gosto: { ...g, anterior: ant }, updated_at: new Date().toISOString() }
    const r = temConfig.current
      ? await supabase.from('invest_config').update(linha).eq('user_id', userId)
      : await supabase.from('invest_config').insert({ ...linha, user_id: userId })
    // outra aba criou a linha antes desta: passa a atualizar
    if (r.error?.code === '23505') { temConfig.current = true; return (await supabase.from('invest_config').update(linha).eq('user_id', userId)).error }
    if (!r.error) temConfig.current = true
    return r.error
  }
  const salvarPlano = async (p: Plano): Promise<boolean> => {
    setPlano(p)
    const erro = await gravarConfig(p, agora.current.gosto, agora.current.anterior)
    if (erro && !faltaTabela(erro)) falhou(erro.message)
    return !erro
  }
  /** Guarda o que a tela aprendeu (no aparelho e no banco). Quando a ordem dos cartões muda, a de antes fica para o "desfazer". */
  const salvarGosto = useCallback((g: Gosto) => {
    const antes = agora.current.gosto
    const mudouAOrdem = antes.ordem.length > 0 && antes.ordem.join() !== g.ordem.join()
    const ant = mudouAOrdem ? { ordem: antes.ordem, desenhos: antes.desenhos, fav: antes.fav, oculto: antes.oculto } : agora.current.anterior
    setGosto(g)
    setAnterior(ant)
    try { localStorage.setItem(chaveGosto(userId), JSON.stringify(g)) } catch { /* sem armazenamento: vale só nesta visita */ }
    void gravarConfig(agora.current.plano, g, ant)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Apaga tudo do Invest (Zerar dados). O número antigo de meses.investimentos não é daqui e fica. */
  const zerar = async () => {
    for (const t of ['invest_precos', 'invest_operacoes', 'invest_importacoes', 'invest_ativos', 'invest_config']) {
      const { error } = await supabase.from(t).delete().eq('user_id', userId)
      if (error && !faltaTabela(error)) throw new Error(error.message)
    }
    temConfig.current = false
    setAtivos([]); setOperacoes([]); setPrecos([]); setImportacoes([]); setPlano(PLANO_PADRAO); setGosto(GOSTO_VAZIO); setAnterior(null)
    try { localStorage.removeItem(chaveGosto(userId)) } catch { /* nada guardado */ }
  }

  return {
    ativos, operacoes, precos, importacoes, plano, gosto, anterior, semTabela, carregado, recarregar,
    addAtivo, updAtivo, delAtivo, addOperacao, addOperacoes, updOperacao, delOperacao, salvarPreco, delPreco,
    addImportacao, updImportacao, resolverPendente, salvarPlano, salvarGosto, zerar,
  }
}

export type DadosInvest = ReturnType<typeof useInvestDados>

const hojeIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Os nomes que o motor não conhece (ele é puro e não traduz nada). */
const nomesDaCarteira = () => ({
  semInstituicao: tx('Sem instituição'),
  liquidez: {
    diaria: tx('A qualquer hora'), ate30: tx('Em até 30 dias'), ate365: tx('Em até 1 ano'), longo: tx('Mais de 1 ano'), 'sem-data': tx('Sem prazo informado'),
  } satisfies Record<FaixaDeLiquidez, string>,
})

export interface Invest {
  d: DadosInvest
  /** A entrada do motor (para quem precisa refazer uma conta com outro recorte: um ativo só, outra data). */
  entrada: EntradaCarteira
  /** A carteira de hoje. */
  c: Carteira
  /** A carteira como estava há 90 dias (null se ainda não existia). */
  antes: Carteira | null
  /** Valor, aportes e rentabilidade nos dias que importam. */
  linha: PontoDaLinha[]
  /** 'AAAA-MM' → valor da carteira no fim do mês: é o que o patrimônio usa no lugar do número digitado. */
  valoresPorMes: Map<string, number>
  indices?: Indices
  /** Não deu para atualizar os índices do Banco Central agora (vale o que estava guardado). */
  indicesFalharam: boolean
}

/** A carteira calculada: refeita sempre que uma operação, um preço, a cotação ou o dia mudam. */
export function useCarteira(d: DadosInvest, moeda: string, taxas: Taxas, hoje: Date): Invest {
  const dia = hojeIso(hoje)
  const primeira = useMemo(() => d.operacoes.reduce<string | null>((a, o) => (!a || o.data < a ? o.data : a), null), [d.operacoes])
  const { indices, falhou } = useIndices(primeira)
  const { ativos, operacoes, precos } = d
  const calculado = useMemo(() => {
    const entrada: EntradaCarteira = { ativos, operacoes, precos, hoje: dia, moeda, taxas, indices }
    const nomes = nomesDaCarteira()
    const c = carteira(entrada, nomes)
    const linha = linhaDoTempo(entrada)
    const noventa = haNoventaDias(dia)
    const antes = c.primeiraOperacao && c.primeiraOperacao <= noventa ? carteira({ ...entrada, hoje: noventa }, nomes) : null
    return { entrada, c, antes, linha, valoresPorMes: valorPorMes(linha, dia) }
  }, [ativos, operacoes, precos, dia, moeda, taxas, indices])
  return { d, ...calculado, indices, indicesFalharam: falhou }
}
