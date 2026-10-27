import * as XLSX from 'xlsx'
import { MESES, parseNumero } from './format'
import { supabase } from './supabase'
import { inicioDoMes } from './dividas'
import { bancoConhecido, bancoNaDescricao, mesmoNome } from './rotulos'
import type { Banco, Caixa, Categoria, CategoriaAntiga, Lancamento, Mes, TipoCaixa } from './types'
import { TIPOS_CAIXA } from './types'

/** Lançamento lido da planilha; o banco vem pelo nome e vira id na gravação. */
type NovoLanc = Omit<Lancamento, 'id' | 'banco_id'> & { banco?: string }
/** Uma linha do quadro DÍVIDAS de uma aba. */
interface LinhaDivida { descricao: string; valor_mensal: number; parcelas: number; pagas: number }

export interface MesImportado {
  ano: number
  mes: number
  lancs: NovoLanc[]
  dividas: LinhaDivida[]
  /** Caixa pelo nome do banco (colunas NUBANK, INTER, ITAU da planilha). */
  caixa: Record<string, Partial<Record<TipoCaixa, number>>>
  meta: Omit<Mes, 'caixa'>
}

// Faixas de linhas do modelo da planilha (1-based, como no Excel).
const FAIXA_ENTRADAS: [number, number] = [3, 106]
// O primeiro bloco de saídas (o "principal" da planilha) é o Itaú; os outros são NUBANK e INTER.
const FAIXAS_SAIDAS: [string, number, number][] = [
  ['Itaú', 3, 52],
  ['Nubank', 55, 129],
  ['Inter', 132, 136],
]
const BANCOS_CAIXA = [['AB', 'Nubank'], ['AC', 'Inter'], ['AD', 'Itaú']] as const

function valorCelula(ws: XLSX.WorkSheet, ref: string): number | string | null {
  const c = ws[ref] as XLSX.CellObject | undefined
  if (!c) return null
  if (c.t === 'n' && typeof c.v === 'number') return c.v
  if (c.t === 's' && typeof c.v === 'string') return c.v.trim() || null
  // A planilha não guarda o resultado das fórmulas, então contas simples (=105.53-60.02) são refeitas aqui.
  if (c.f) return parseNumero('=' + c.f)
  return null
}

const numero = (ws: XLSX.WorkSheet, ref: string) => {
  const v = valorCelula(ws, ref)
  return typeof v === 'number' ? v : typeof v === 'string' ? parseNumero(v) ?? 0 : 0
}

function data(ws: XLSX.WorkSheet, ref: string, ano: number, mes: number): string | null {
  const v = valorCelula(ws, ref)
  if (typeof v !== 'number') return null
  const d = XLSX.SSF.parse_date_code(v)
  if (!d) return null
  // Se a data caiu em outro mês por engano, mantém o lançamento no mês da aba.
  const dia = d.y === ano && d.m === mes ? d.d : 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Linhas citadas numa fórmula de métrica, ex.: "=L5+L23+L25" -> {5, 23, 25}. */
function linhasDaFormula(ws: XLSX.WorkSheet, ref: string) {
  const f = (ws[ref] as XLSX.CellObject | undefined)?.f ?? ''
  return new Set([...f.matchAll(/L\$?(\d+)/g)].map((m) => Number(m[1])))
}

export async function lerPlanilha(arquivo: File): Promise<MesImportado[]> {
  const wb = XLSX.read(await arquivo.arrayBuffer(), { cellFormula: true, cellDates: false, sheetStubs: true })
  const resultado: MesImportado[] = []

  for (const nome of wb.SheetNames) {
    const m = /^([A-ZÇ]+)(\d{2})$/.exec(nome.trim().toUpperCase())
    const idx = m ? MESES.indexOf(m[1]) : -1
    if (!m || idx < 0) continue
    const ano = 2000 + Number(m[2])
    const mes = idx + 1
    const ws = wb.Sheets[nome]

    const transporte = linhasDaFormula(ws, 'V55')
    const dividasPagas = linhasDaFormula(ws, 'V56')
    const alimentacao = linhasDaFormula(ws, 'V57')
    const lancs: NovoLanc[] = []

    for (let r = FAIXA_ENTRADAS[0]; r <= FAIXA_ENTRADAS[1]; r++) {
      const valor = numero(ws, `D${r}`)
      const desc = valorCelula(ws, `C${r}`)
      if (!valor && !desc) continue
      lancs.push({
        ano, mes, tipo: 'entrada', descricao: String(desc ?? ''), valor,
        data: data(ws, `F${r}`, ano, mes), categoria: 'outros', banco: bancoNaDescricao(String(desc ?? '')),
      })
    }
    for (const [bancoBloco, ini, fim] of FAIXAS_SAIDAS) {
      for (let r = ini; r <= fim; r++) {
        const valor = numero(ws, `L${r}`)
        const desc = valorCelula(ws, `I${r}`)
        if (!valor && !desc) continue
        const categoria: CategoriaAntiga = transporte.has(r)
          ? 'transporte'
          : dividasPagas.has(r)
            ? 'divida'
            : alimentacao.has(r)
              ? 'alimentacao'
              : 'outros'
        lancs.push({
          ano, mes, tipo: 'saida', descricao: String(desc ?? ''), valor,
          data: data(ws, `N${r}`, ano, mes), categoria,
          banco: bancoNaDescricao(String(desc ?? '')) ?? bancoBloco,
        })
      }
    }

    const dividas: LinhaDivida[] = []
    for (let r = 37; r <= 47; r++) {
      const desc = valorCelula(ws, `Q${r}`)
      const valor = numero(ws, `S${r}`)
      if (!desc && !valor) continue
      dividas.push({ descricao: String(desc ?? ''), valor_mensal: valor, parcelas: numero(ws, `T${r}`), pagas: numero(ws, `U${r}`) })
    }

    const caixa: MesImportado['caixa'] = {}
    for (const [col, nome] of BANCOS_CAIXA) {
      TIPOS_CAIXA.forEach((t, ri) => {
        const v = numero(ws, `${col}${33 + ri}`)
        if (v) (caixa[nome] ??= {})[t] = v
      })
    }
    const usd = numero(ws, 'T14')
    const meta: MesImportado['meta'] = {
      ano, mes,
      investimentos: numero(ws, 'W22'),
      moedas: usd ? { USD: usd } : {},
      meta_usd: numero(ws, 'T85'),
    }

    const temAlgo = lancs.length || dividas.length || Object.keys(caixa).length || meta.investimentos || usd
    if (temAlgo) resultado.push({ ano, mes, lancs, dividas, caixa, meta })
  }
  return resultado
}

/** "Cartão Nubank – saldo em atraso" e "Cartão Nubank – fatura vencida" são a mesma dívida. */
const nomeBase = (descricao: string) => descricao.split(/\s+[–-]\s+/)[0].trim()
const chaveDivida = (descricao: string) => nomeBase(descricao).toLowerCase()

interface DividaImportada {
  descricao: string
  valor_parcela: number | null
  saldos: { data: string; saldo: number }[]
}

/**
 * Na planilha cada aba tem uma cópia do quadro de dívidas. Aqui elas viram uma dívida só,
 * com o saldo de cada mês registrado; quando some da aba seguinte, ela foi quitada.
 * O saldo é datado no dia 1º para que pagamentos lançados depois, no próprio app, abatam dele
 * (os pagamentos que vieram da planilha não ficam ligados à dívida, então não contam duas vezes).
 */
export function juntarDividas(meses: MesImportado[]): DividaImportada[] {
  const ordenados = [...meses].sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes))
  const mapa = new Map<string, DividaImportada & { ultimo: number }>()
  ordenados.forEach((m, idx) => {
    for (const linha of m.dividas) {
      const k = chaveDivida(linha.descricao)
      if (!k) continue
      const restantes = Math.max(0, linha.parcelas - linha.pagas)
      const saldo = Math.round(restantes * linha.valor_mensal * 100) / 100
      const atual = mapa.get(k) ?? { descricao: nomeBase(linha.descricao), valor_parcela: null, saldos: [], ultimo: -1 }
      // vale a parcela do mês mais recente (acordos mudam); dívida de parcela única não tem parcela fixa
      atual.valor_parcela = linha.parcelas > 1 ? linha.valor_mensal : null
      atual.saldos.push({ data: inicioDoMes(m.ano, m.mes), saldo })
      atual.ultimo = idx
      mapa.set(k, atual)
    }
  })
  for (const d of mapa.values()) {
    const seguinte = ordenados[d.ultimo + 1]
    const ultimoSaldo = d.saldos[d.saldos.length - 1]?.saldo ?? 0
    if (seguinte && ultimoSaldo > 0) d.saldos.push({ data: inicioDoMes(seguinte.ano, seguinte.mes), saldo: 0 })
  }
  return [...mapa.values()].map(({ descricao, valor_parcela, saldos }) => ({ descricao, valor_parcela, saldos }))
}

/** Substitui no banco os meses que vieram na planilha (e as dívidas com o mesmo nome). */
export async function gravarImportacao(userId: string, meses: MesImportado[]) {
  // Garante que os bancos citados na planilha existam e pega o id de cada um.
  const { data: jaTem, error: e0 } = await supabase.from('bancos').select('*')
  if (e0) throw e0
  const bancos = [...(jaTem as Banco[])]
  const citados = new Set(meses.flatMap((m) => [...m.lancs.map((l) => l.banco), ...Object.keys(m.caixa)]).filter(Boolean) as string[])
  for (const nome of citados) {
    if (bancos.some((b) => mesmoNome(b.nome, nome))) continue
    const { data, error } = await supabase
      .from('bancos').insert({ nome, cor: bancoConhecido(nome)?.cor ?? '#8a8a96', ordem: bancos.length }).select().single()
    if (error) throw error
    bancos.push(data as Banco)
  }
  const idDe = (nome?: string) => (nome ? bancos.find((b) => mesmoNome(b.nome, nome))?.id ?? null : null)

  // As 4 categorias da planilha viram as categorias da pessoa (sem a migração 5, ficam só na coluna antiga).
  let cats = await supabase.from('categorias').select('*')
  if (!cats.error && !cats.data.length) {
    await supabase.rpc('criar_categorias_padrao')
    cats = await supabase.from('categorias').select('*')
  }
  const minhas = cats.error ? null : (cats.data as Categoria[])
  const NOMES: Record<CategoriaAntiga, string> = { alimentacao: 'alimentação', transporte: 'transporte', divida: 'dívidas e parcelas', outros: 'outros' }
  const idCategoria = (l: NovoLanc) => {
    const procurado = l.tipo === 'entrada' ? 'outros' : NOMES[l.categoria ?? 'outros']
    const c = minhas?.find((x) => x.tipo === l.tipo && (l.categoria === 'divida' && l.tipo === 'saida' ? x.papel === 'divida' : x.nome.toLowerCase() === procurado))
    return c?.id ?? null
  }

  for (const m of meses) {
    const { error: e1 } = await supabase.from('lancamentos').delete().eq('ano', m.ano).eq('mes', m.mes)
    if (e1) throw e1
    if (m.lancs.length) {
      const { error } = await supabase.from('lancamentos').insert(m.lancs.map(({ banco, ...l }) => ({
        ...l, banco_id: idDe(banco), ...(minhas ? { categoria_id: idCategoria(l) } : {}),
      })))
      if (error) throw error
    }
    const caixa: Caixa = Object.fromEntries(Object.entries(m.caixa).map(([nome, v]) => [idDe(nome)!, v]))
    const { error } = await supabase
      .from('meses')
      .upsert({ ...m.meta, usd: m.meta.moedas.USD ?? 0, caixa, user_id: userId }, { onConflict: 'user_id,ano,mes' })
    if (error) throw error
  }

  const novas = juntarDividas(meses)
  if (!novas.length) return
  const { data: existentes, error: e2 } = await supabase.from('dividas').select('id, descricao')
  if (e2) throw e2
  const repetidas = (existentes as { id: string; descricao: string }[])
    .filter((x) => novas.some((n) => chaveDivida(n.descricao) === chaveDivida(x.descricao)))
    .map((x) => x.id)
  if (repetidas.length) {
    const { error } = await supabase.from('dividas').delete().in('id', repetidas)
    if (error) throw error
  }
  for (const n of novas) {
    const { data, error } = await supabase
      .from('dividas').insert({ descricao: n.descricao, valor_parcela: n.valor_parcela }).select('id').single()
    if (error) throw error
    const id = (data as { id: string }).id
    const { error: e3 } = await supabase.from('divida_saldos').insert(n.saldos.map((s) => ({ ...s, divida_id: id })))
    if (e3) throw e3
  }
}

async function buscarTudo<T>(tabela: string): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select('*').range(de, de + 999)
    if (error) throw error
    linhas.push(...(data as T[]))
    if (data.length < 1000) return linhas
  }
}

/** Backup completo em .xlsx, uma aba por tabela. */
export async function exportarBackup() {
  const [lancs, dividas, saldos, meses, bancos] = await Promise.all([
    buscarTudo<Lancamento>('lancamentos'),
    buscarTudo<{ id: string; descricao: string; valor_parcela: number | null }>('dividas'),
    buscarTudo<{ divida_id: string; data: string; saldo: number }>('divida_saldos'),
    buscarTudo<Mes>('meses'),
    buscarTudo<Banco>('bancos'),
  ])
  // Sem a migração 5 não há tabela de categorias; o backup sai com a coluna antiga.
  const categorias = await buscarTudo<Categoria>('categorias').catch(() => [] as Categoria[])
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]))
  const nomeBanco = new Map(bancos.map((b) => [b.id, b.nome]))
  const nomeDivida = new Map(dividas.map((d) => [d.id, d.descricao]))
  const wb = XLSX.utils.book_new()
  const semIds = <T extends object>(xs: T[]) =>
    xs.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !['id', 'user_id', 'created_at'].includes(k))))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(semIds(lancs).map(({ divida_id, banco_id, categoria_id, categoria, conta: _conta, conta_fixa_id: _contaFixa, ...l }) => ({
      ...l,
      categoria: categoria_id ? nomeCategoria.get(String(categoria_id)) : categorias.length ? '' : categoria,
      banco: banco_id ? nomeBanco.get(String(banco_id)) : '',
      divida: divida_id ? nomeDivida.get(String(divida_id)) : '',
    }))),
    'Lançamentos',
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semIds(dividas)), 'Dívidas')
  if (categorias.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semIds(categorias).map(({ ordem: _o, ...c }) => c)), 'Categorias')
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(saldos.map((s) => ({ divida: nomeDivida.get(s.divida_id), data: s.data, saldo: s.saldo }))),
    'Saldos das dívidas',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(semIds(meses).map((m) => ({
      ...m,
      caixa: JSON.stringify(Object.fromEntries(Object.entries(m.caixa as Caixa).map(([id, v]) => [nomeBanco.get(id) ?? id, v]))),
      moedas: JSON.stringify(m.moedas ?? {}),
    }))),
    'Meses',
  )
  XLSX.writeFile(wb, `backup-financas-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
