import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIAS_ANTIGAS } from './categorias'
import { normPerfil } from './perfil'
import { lerTudo, supabase } from './supabase'
import type { EscolhaZerar, ParteZerar } from './zerar'
import type { Banco, Categoria, Divida, Lancamento, Mes, Meta, MovimentoMeta, Pagamento, Perfil, SaldoDivida } from './types'
import { fmtDataLonga } from './format'
import { mesesDoConselheiro } from './conselheiro'
import { tx } from './textos'

const num = (v: unknown) => Number(v ?? 0)

const normLanc = (r: Lancamento): Lancamento => ({
  ...r, valor: num(r.valor), valor_original: r.valor_original == null ? null : num(r.valor_original),
})
const normDiv = (r: Divida): Divida => ({ ...r, valor_parcela: r.valor_parcela == null ? null : num(r.valor_parcela) })
const normSaldo = (r: SaldoDivida): SaldoDivida => ({ ...r, saldo: num(r.saldo) })
const normMeta = (r: Meta): Meta => ({ ...r, alvo: num(r.alvo) })
const normMovMeta = (r: MovimentoMeta): MovimentoMeta => ({ ...r, valor: num(r.valor) })
const normMes = (r: Mes & { usd?: number }): Mes => {
  const { usd, ...resto } = r
  const moedas = Object.fromEntries(Object.entries(r.moedas ?? {}).map(([k, v]) => [k, num(v)]))
  // Bancos ainda sem a migração 4 só têm a coluna antiga de dólar.
  if (!r.moedas && num(usd) > 0) moedas.USD = num(usd)
  return { ...resto, investimentos: num(r.investimentos), meta_usd: num(r.meta_usd), moedas, caixa: r.caixa ?? {} }
}
/** Tabela ainda não criada (migração pendente). */
const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)
const chaveFoto = (userId: string) => `opuscash-foto-${userId}`
const fotoLocal = (userId: string) => {
  try {
    return localStorage.getItem(chaveFoto(userId))
  } catch {
    return null
  }
}
/** Lançamento ligado a uma dívida: saída que paga o que você deve e entrada que recebe de quem te deve abatem; entrada que é empréstimo recebido (ou saída que empresta mais) aumenta. */
const paraPagamento = (l: Lancamento): Pagamento | null =>
  l.divida_id ? { id: l.id, divida_id: l.divida_id, data: l.data, valor: l.valor, tipo: l.tipo, valor_original: l.valor_original ?? null, moeda_original: l.moeda_original ?? null } : null
/** Campos de dívida que só existem com a migração 10. */
const EXTRAS_DIVIDA = ['sentido', 'pessoa', 'inicio', 'total_parcelas', 'obs'] as const
const semExtrasDivida = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !(EXTRAS_DIVIDA as readonly string[]).includes(k))) as Partial<T>
/** Sem a migração 14 a coluna `moeda` não existe. */
const semMoedaDivida = <T extends object>(o: T) => { const { moeda: _m, ...resto } = o as T & { moeda?: unknown }; return resto as T }
export type NovaDivida = Pick<Divida, 'descricao' | 'valor_parcela'> & Partial<Pick<Divida, (typeof EXTRAS_DIVIDA)[number] | 'moeda'>>

/**
 * Lançamentos dos meses que o conselheiro lê (3 fechados + o atual) que caem fora do ano aberto: no começo do ano, os
 * últimos meses do anterior; com outro ano aberto, os de agora. Só consulta o que falta (em outubro, com o ano atual aberto, nada).
 */
async function lancamentosRecentes(ano: number): Promise<Lancamento[]> {
  const meses = mesesDoConselheiro().filter((m) => m.ano !== ano)
  const anos = [...new Set(meses.map((m) => m.ano))]
  const grupos = await Promise.all(anos.map(async (a) => {
    const doAno = meses.filter((m) => m.ano === a).map((m) => m.mes)
    const r = await lerTudo(() => supabase.from('lancamentos').select('*').eq('ano', a).gte('mes', Math.min(...doAno)).lte('mes', Math.max(...doAno)).order('id'))
    // o filtro de cima já limita; a conferência de baixo vale para qualquer servidor que o ignore
    return r.error ? [] : (r.data as Lancamento[]).filter((l) => l.ano === a && doAno.includes(l.mes))
  }))
  return grupos.flat()
}

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
  /** undefined = carregando; null = a pessoa ainda não tem perfil salvo. */
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [perfilSemTabela, setPerfilSemTabela] = useState(false)
  /** Foto de perfil: do banco (migração 9) ou, sem a coluna, guardada só neste aparelho. */
  const [foto, setFoto] = useState<string | null>(() => fotoLocal(userId))
  const [categorias, setCategorias] = useState<Categoria[]>([])
  /** Sem a migração 5: usa as 4 categorias antigas. */
  const [categoriasAntigas, setCategoriasAntigas] = useState(false)
  const [metas, setMetas] = useState<Meta[]>([])
  const [movimentosMeta, setMovimentosMeta] = useState<MovimentoMeta[]>([])
  /** Sem a migração 6 não há onde guardar metas. */
  const [metasSemTabela, setMetasSemTabela] = useState(false)
  /** Sem a migração 10: dívidas sem "me devem", pessoa e calendário de parcelas. */
  const [dividasSemExtras, setDividasSemExtras] = useState(false)
  /** Sem a migração 14: dívidas só na moeda principal. */
  const [dividasSemMoeda, setDividasSemMoeda] = useState(false)
  /** Lançamentos de outros anos ligados a uma conta do mês: ensinam ao app como cada conta aparece no extrato. */
  const [vinculosOutrosAnos, setVinculosOutrosAnos] = useState<Pick<Lancamento, 'id' | 'conta_fixa_id' | 'descricao' | 'valor'>[]>([])
  /** Lançamentos de outros anos que o conselheiro lê (os 3 meses fechados e o atual), quando o ano aberto não cobre todos. */
  const [lancsRecentes, setLancsRecentes] = useState<Lancamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const [l, m, d, s, p, b, pf, ct, mt, mv, xd, xm, vc, rc] = await Promise.all([
      // as tabelas que crescem sem parar são lidas em páginas (lerTudo): o Supabase corta em 1000 linhas
      lerTudo(() => supabase.from('lancamentos').select('*').eq('ano', ano).order('data').order('created_at').order('id')),
      lerTudo(() => supabase.from('meses').select('*').order('ano').order('mes')),
      supabase.from('dividas').select('*').order('created_at'),
      lerTudo(() => supabase.from('divida_saldos').select('*').order('data').order('id')),
      lerTudo(() => supabase.from('lancamentos').select('id, divida_id, tipo, data, valor, valor_original, moeda_original').not('divida_id', 'is', null).order('id')),
      supabase.from('bancos').select('*').order('ordem').order('created_at'),
      supabase.from('perfis').select('*').maybeSingle(),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('metas').select('*').order('ordem').order('created_at'),
      lerTudo(() => supabase.from('meta_movimentos').select('*').order('data').order('id')),
      supabase.from('dividas').select('sentido, pessoa, inicio, total_parcelas').limit(1),
      supabase.from('dividas').select('moeda').limit(1),
      lerTudo(() => supabase.from('lancamentos').select('id, conta_fixa_id, descricao, valor').not('conta_fixa_id', 'is', null).neq('ano', ano).order('id')),
      lancamentosRecentes(ano),
    ])
    // Conta nova: ganha as categorias padrão (definidas no banco, migração 5). Isso precisa acontecer ANTES de qualquer setState:
    // um await no meio fazia o React desenhar o painel de verdade (perfil já lido, "carregando" ainda ligado) e só depois as
    // perguntas do primeiro acesso apareciam por cima. Sem await entre os setState, tudo chega junto, num render só.
    let categoriasNovas: Categoria[] | null = null
    let falhaCategorias: string | null = null
    if (!ct.error && !ct.data.length) {
      const criou = await supabase.rpc('criar_categorias_padrao')
      const novas = await supabase.from('categorias').select('*').order('ordem').order('nome')
      const falha = criou.error ?? novas.error
      if (falha) falhaCategorias = falha.message
      else categoriasNovas = novas.data as Categoria[]
    }
    // se falhar, o conselheiro só fala com o que o ano aberto tem
    setLancsRecentes(rc.map(normLanc))
    setDividasSemExtras(Boolean(xd.error))
    setDividasSemMoeda(Boolean(xm.error))
    // sem a migração 7 a coluna não existe: o app só não aprende com os outros anos
    setVinculosOutrosAnos(vc.error ? [] : (vc.data as Pick<Lancamento, 'id' | 'conta_fixa_id' | 'descricao' | 'valor'>[]).map((x) => ({ ...x, valor: num(x.valor) })))
    const e = l.error ?? m.error ?? d.error ?? s.error ?? p.error ?? b.error
    if (e) setErro(e.message)
    else {
      setLancs((l.data as Lancamento[]).map(normLanc))
      setMeses((m.data as Mes[]).map(normMes))
      setDividas((d.data as Divida[]).map(normDiv))
      setSaldos((s.data as SaldoDivida[]).map(normSaldo))
      setPagamentos((p.data as Pagamento[]).map((x) => ({ ...x, valor: num(x.valor), valor_original: x.valor_original == null ? null : num(x.valor_original) })))
      setBancos(b.data as Banco[])
    }
    if (pf.error && faltaTabela(pf.error)) {
      setPerfilSemTabela(true)
      setPerfil(null)
    } else if (pf.error) setErro(pf.error.message)
    else {
      setPerfil(pf.data ? normPerfil(pf.data as Perfil) : null)
      if (pf.data && 'foto' in pf.data) setFoto((pf.data as Perfil).foto ?? fotoLocal(userId))
    }
    const em = mt.error ?? mv.error
    if (em && faltaTabela(em)) setMetasSemTabela(true)
    else if (em) setErro(em.message)
    else {
      setMetas((mt.data as Meta[]).map(normMeta))
      setMovimentosMeta((mv.data as MovimentoMeta[]).map(normMovMeta))
    }
    if (ct.error && faltaTabela(ct.error)) {
      setCategoriasAntigas(true)
      setCategorias(CATEGORIAS_ANTIGAS)
    } else if (ct.error) setErro(ct.error.message)
    else if (ct.data.length) setCategorias(ct.data as Categoria[])
    else if (falhaCategorias) setErro(falhaCategorias)
    else if (categoriasNovas) setCategorias(categoriasNovas)
    setCarregando(false)
  }, [ano, userId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Toda falha de gravação mostra o erro e recarrega do banco, para a tela nunca mentir.
  const falhou = useCallback(
    (msg: string) => {
      setErro(/lancamentos_conta_fixa_mes/.test(msg)
        ? tx('Essa conta do mês já tem um lançamento ligado nesse mês (cada conta tem um por mês). Nada foi mudado.')
        : msg)
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

  /** Sem a migração 11, a coluna da forma de pagamento não existe: o campo fica de fora do que é gravado. */
  const semForma = useRef(false)
  /** Sem a migração 5, a categoria vai na coluna antiga. */
  const paraBanco = <T extends Partial<Lancamento>>(l: T): T => {
    if (semForma.current && 'forma' in l) l = (({ forma: _f, ...resto }) => resto as T)(l)
    if (!categoriasAntigas || !('categoria_id' in l)) return l
    const { categoria_id, ...resto } = l
    return { ...resto, categoria: l.tipo === 'entrada' ? 'outros' : categoria_id ?? 'outros' } as T
  }
  /** Grava; se só falta a coluna `forma`, lembra disso e tenta de novo sem ela. */
  const gravar = async <R extends { error: { code?: string; message: string } | null }>(fazer: () => PromiseLike<R>): Promise<R> => {
    const r = await fazer()
    if (r.error && !semForma.current && /forma/.test(r.error.message) && (r.error.code === '42703' || r.error.code === 'PGRST204')) {
      semForma.current = true
      return fazer()
    }
    return r
  }
  const semMoedaSeFalta = <T extends object>(o: T) => (dividasSemMoeda ? semMoedaDivida(o) : o)
  const addLanc = async (novo: Omit<Lancamento, 'id'>): Promise<Lancamento | undefined> => {
    const { data, error } = await gravar(() => supabase.from('lancamentos').insert(paraBanco(novo)).select().single())
    if (error) {
      falhou(error.message)
      return
    }
    const l = normLanc(data as Lancamento)
    if (l.ano === ano) setLancs((xs) => [...xs, l])
    sincronizarPagamento(l.id, l)
    return l
  }
  /** Vários lançamentos de uma vez (importação de extrato), em lotes; devolve quantos foram gravados. */
  const addLancs = async (novos: Omit<Lancamento, 'id'>[]): Promise<number> => {
    let gravados = 0
    for (let i = 0; i < novos.length; i += 250) {
      const { data, error } = await gravar(() => supabase.from('lancamentos').insert(novos.slice(i, i + 250).map((l) => paraBanco(l))).select('id'))
      if (error) {
        falhou(error.message)
        return gravados
      }
      gravados += data?.length ?? 0
    }
    await recarregar()
    return gravados
  }
  /** Troca a descrição de vários lançamentos ("Organizar nomes"). */
  const renomearLancs = async (lista: { id: string; descricao: string; forma?: Lancamento['forma'] }[]) => {
    const mudancas = new Map(lista.map((x) => [x.id, { descricao: x.descricao, ...(x.forma ? { forma: x.forma } : {}) }]))
    setLancs((xs) => xs.map((x) => (mudancas.has(x.id) ? { ...x, ...mudancas.get(x.id)! } : x)))
    for (let i = 0; i < lista.length; i += 20) {
      const res = await Promise.all(lista.slice(i, i + 20).map((x) => gravar(() => supabase.from('lancamentos').update(paraBanco(mudancas.get(x.id)!)).eq('id', x.id))))
      const e = res.find((r) => r.error)?.error
      if (e) return falhou(e.message)
    }
  }
  const updLanc = async (id: string, mudancas: Partial<Lancamento>) => {
    const patch = paraBanco(mudancas)
    const atual = lancs.find((x) => x.id === id)
    const novo = atual ? { ...atual, ...patch } : null
    setLancs((xs) => (novo && novo.ano !== ano ? xs.filter((x) => x.id !== id) : xs.map((x) => (x.id === id ? { ...x, ...patch } : x))))
    if (novo) sincronizarPagamento(id, novo)
    const { error } = await gravar(() => supabase.from('lancamentos').update(paraBanco(mudancas)).eq('id', id))
    if (error) falhou(error.message)
  }
  const delLanc = async (id: string) => {
    setLancs((xs) => xs.filter((x) => x.id !== id))
    sincronizarPagamento(id, null)
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  /**
   * Cria a dívida já com o saldo de partida. `marcoInicial` (opcional) registra o valor de quando ela começou,
   * para o app mostrar quanto já foi pago ("parcela 4 de 12").
   */
  const addDivida = async (d: NovaDivida & {
    saldo: number; data: string; marcoInicial?: { data: string; saldo: number }
  }): Promise<Divida | undefined> => {
    const { saldo: _s, data: _d, marcoInicial: _m, ...campos } = d
    const { data, error } = await supabase
      .from('dividas').insert(semMoedaSeFalta(dividasSemExtras ? semExtrasDivida(campos) : campos)).select().single()
    if (error) {
      falhou(error.message)
      return
    }
    const nova = normDiv(data as Divida)
    setDividas((xs) => [...xs, nova])
    if (d.marcoInicial) await addSaldo(nova.id, d.marcoInicial.data, d.marcoInicial.saldo)
    await addSaldo(nova.id, d.data, d.saldo)
    return nova
  }
  const updDivida = async (id: string, patch: Partial<Divida>) => {
    setDividas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('dividas').update(semMoedaSeFalta(dividasSemExtras ? semExtrasDivida(patch) : patch)).eq('id', id)
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

  /**
   * Muda o valor total da dívida (quanto ela era no começo) sem mexer nos pagamentos: soma `delta` a todos os saldos
   * informados, então o que falta muda junto. Saldo zerado (quitação) fica como está.
   */
  const ajustarValorDivida = async (divida_id: string, delta: number) => {
    const alvos = saldos.filter((s) => s.divida_id === divida_id && s.saldo > 0)
    if (!alvos.length || !delta) return
    const novos = new Map(alvos.map((s) => [s.id, Math.max(0, Math.round((s.saldo + delta) * 100) / 100)]))
    setSaldos((xs) => xs.map((s) => (novos.has(s.id) ? { ...s, saldo: novos.get(s.id)! } : s)))
    const resultados = await Promise.all([...novos].map(([id, saldo]) => supabase.from('divida_saldos').update({ saldo }).eq('id', id)))
    const erro = resultados.find((r) => r.error)?.error
    if (erro) falhou(erro.message)
  }

  /**
   * Muda o dia em que a dívida começou: move o saldo mais antigo dela (e não cria outro), então os pagamentos já lançados
   * continuam valendo. Devolve o motivo quando não pode (null = feito).
   */
  const moverInicioDivida = async (divida_id: string, data: string): Promise<string | null> => {
    const marcos = saldos.filter((s) => s.divida_id === divida_id).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    const primeiro = marcos[0]
    if (!primeiro || primeiro.data === data) return null
    if (marcos[1] && data > marcos[1].data) return tx('Essa dívida tem um ajuste de saldo em {0}. Escolha uma data até lá.', fmtDataLonga(marcos[1].data))
    setSaldos((xs) => xs.map((s) => (s.id === primeiro.id ? { ...s, data } : s)))
    const { error } = await supabase.from('divida_saldos').update({ data }).eq('id', primeiro.id)
    if (error) {
      setSaldos((xs) => xs.map((s) => (s.id === primeiro.id ? { ...s, data: primeiro.data } : s)))
      falhou(error.message)
      return error.message
    }
    return null
  }

  const salvarMes = async (anoMes: number, mes: number, patch: Partial<Omit<Mes, 'ano' | 'mes'>>) => {
    const atual = meses.find((m) => m.ano === anoMes && m.mes === mes) ?? {
      ano: anoMes, mes, investimentos: 0, moedas: {}, meta_usd: 0, caixa: {},
    }
    const novo = { ...atual, ...patch }
    setMeses((xs) => [...xs.filter((m) => !(m.ano === anoMes && m.mes === mes)), novo])
    // A coluna usd continua preenchida para backups e versões antigas; sem a migração 4 não existe a de moedas.
    const { moedas, ...semMoedas } = novo
    const linha = perfilSemTabela ? semMoedas : novo
    const { error } = await supabase
      .from('meses')
      .upsert({ ...linha, usd: moedas.USD ?? 0, user_id: userId }, { onConflict: 'user_id,ano,mes' })
    if (error) falhou(error.message)
  }

  const addBanco = async (nome: string, cor: string): Promise<Banco | undefined> => {
    const { data, error } = await supabase.from('bancos').insert({ nome, cor, ordem: bancos.length }).select().single()
    if (error) {
      falhou(/duplicate|unique/i.test(error.message) ? tx('Já existe um banco chamado "{0}".', nome) : error.message)
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

  /** Grava o perfil inteiro (sem a tabela, a mudança vale só até recarregar a página). A foto é gravada à parte. */
  const salvarPerfil = async (novo: Perfil) => {
    setPerfil(novo)
    if (perfilSemTabela) return
    const { foto: _foto, ...semFoto } = novo
    const { error } = await supabase.from('perfis').upsert({ ...semFoto, user_id: userId, updated_at: new Date().toISOString() })
    if (error) return falhou(error.message)
    // Foto escolhida antes de o perfil existir (perguntas do primeiro acesso): só agora há uma linha para recebê-la.
    if (foto && !perfil) await supabase.from('perfis').update({ foto }).eq('user_id', userId)
  }
  /**
   * Troca (ou tira, com null) a foto de perfil. Fica sempre guardada neste aparelho e, com a migração 9, também no
   * banco (para aparecer nos outros aparelhos). Sem a coluna, o erro é engolido: a foto local já vale.
   */
  const salvarFoto = async (nova: string | null) => {
    setFoto(nova)
    try {
      if (nova) localStorage.setItem(chaveFoto(userId), nova)
      else localStorage.removeItem(chaveFoto(userId))
    } catch { /* sem armazenamento: vale até recarregar */ }
    if (perfilSemTabela) return
    const { error } = await supabase.from('perfis').update({ foto: nova }).eq('user_id', userId)
    if (error && !faltaTabela(error) && error.code !== '42703' && error.code !== 'PGRST204') falhou(error.message)
  }

  const addCategoria = async (c: Omit<Categoria, 'id' | 'ordem'>): Promise<Categoria | undefined> => {
    const ordem = Math.max(0, ...categorias.filter((x) => x.tipo === c.tipo).map((x) => x.ordem)) + 1
    const { data, error } = await supabase.from('categorias').insert({ ...c, ordem }).select().single()
    if (error) {
      falhou(/duplicate|unique/i.test(error.message) ? tx('Já existe uma categoria chamada "{0}".', c.nome) : error.message)
      return
    }
    const nova = data as Categoria
    setCategorias((xs) => [...xs, nova])
    return nova
  }
  const updCategoria = async (id: string, patch: Partial<Categoria>) => {
    setCategorias((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('categorias').update(patch).eq('id', id)
    if (error) falhou(/duplicate|unique/i.test(error.message) ? tx('Já existe uma categoria chamada "{0}".', patch.nome) : error.message)
  }
  /** Os lançamentos dela continuam existindo, só ficam "sem categoria". */
  const delCategoria = async (id: string) => {
    setCategorias((xs) => xs.filter((x) => x.id !== id))
    setLancs((xs) => xs.map((x) => (x.categoria_id === id ? { ...x, categoria_id: null } : x)))
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  const addMeta = async (nova: Omit<Meta, 'id' | 'ordem'>) => {
    const { data, error } = await supabase.from('metas').insert({ ...nova, ordem: metas.length }).select().single()
    if (error) return falhou(error.message)
    setMetas((xs) => [...xs, normMeta(data as Meta)])
  }
  const updMeta = async (id: string, patch: Partial<Meta>) => {
    setMetas((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('metas').update(patch).eq('id', id)
    if (error) falhou(error.message)
  }
  /** Apaga a meta e todo o histórico dela. */
  const delMeta = async (id: string) => {
    setMetas((xs) => xs.filter((x) => x.id !== id))
    setMovimentosMeta((xs) => xs.filter((x) => x.meta_id !== id))
    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (error) falhou(error.message)
  }
  /** Guardar (valor positivo) ou retirar (negativo) dinheiro de uma meta. */
  const addMovimentoMeta = async (mov: Omit<MovimentoMeta, 'id'>) => {
    const { data, error } = await supabase.from('meta_movimentos').insert(mov).select().single()
    if (error) return falhou(error.message)
    setMovimentosMeta((xs) => [...xs, normMovMeta(data as MovimentoMeta)])
  }
  const delMovimentoMeta = async (id: string) => {
    setMovimentosMeta((xs) => xs.filter((x) => x.id !== id))
    const { error } = await supabase.from('meta_movimentos').delete().eq('id', id)
    if (error) falhou(error.message)
  }

  /**
   * Apaga só o que foi escolhido, na ordem que respeita as ligações entre as tabelas. Dívida, cartão e conta
   * fixa apagados desvinculam os lançamentos (que ficam, a menos que entradas/saídas também sejam apagadas).
   * `tudo` zera a conta: inclui bancos, categorias (as padrão voltam) e preferências (as perguntas iniciais
   * aparecem de novo). As regras do banco só deixam apagar o que é da própria pessoa.
   */
  const zerarDados = async (e: EscolhaZerar) => {
    const todo = Boolean(e.tudo)
    const tem = (p: Exclude<ParteZerar, 'tudo'>) => todo || Boolean(e[p])
    const tab = (t: string) => supabase.from(t)
    const checar = (error: { code?: string; message: string } | null) => { if (error && !faltaTabela(error)) throw new Error(error.message) }
    const apagar = async (t: string, filtro?: [string, string]) => {
      let q = tab(t).delete().eq('user_id', userId)
      if (filtro) q = q.eq(filtro[0], filtro[1])
      checar((await q).error)
    }
    const desvincular = async (coluna: string) => checar((await tab('lancamentos').update({ [coluna]: null }).eq('user_id', userId)).error)

    if (tem('metas')) { await apagar('meta_movimentos'); await apagar('metas') }
    if (tem('cartoes')) { await apagar('faturas_pagas'); await desvincular('cartao_id') }
    if (tem('dividas')) await desvincular('divida_id')
    if (tem('contas')) await desvincular('conta_fixa_id')
    if (tem('entradas')) await apagar('lancamentos', ['tipo', 'entrada'])
    if (tem('saidas')) await apagar('lancamentos', ['tipo', 'saida'])
    if (tem('contas')) await apagar('contas_fixas')
    if (tem('cartoes')) await apagar('cartoes')
    if (tem('dividas')) { await apagar('divida_saldos'); await apagar('dividas') }
    if (todo) await apagar('meses')
    else if (e.guardado) checar((await tab('meses').update({ investimentos: 0, moedas: {}, caixa: {} }).eq('user_id', userId)).error)
    if (todo) for (const t of ['bancos', 'categorias', 'perfis']) await apagar(t)
  }

  return {
    zerarDados,
    metas, movimentosMeta, metasSemTabela, addMeta, updMeta, delMeta, addMovimentoMeta, delMovimentoMeta,
    categorias, categoriasAntigas, addCategoria, updCategoria, delCategoria,
    perfil, perfilSemTabela, salvarPerfil, foto, salvarFoto,
    bancos, addBanco, updBanco, delBanco,
    dividasSemExtras,
    dividasSemMoeda,
    lancs, lancsRecentes, meses, dividas, saldos, pagamentos, vinculosOutrosAnos, carregando, erro, setErro, recarregar,
    addLanc, addLancs, renomearLancs, updLanc, delLanc, addDivida, updDivida, delDivida, addSaldo, ajustarValorDivida, moverInicioDivida, salvarMes,
  }
}

export type Dados = ReturnType<typeof useDados>
