import * as XLSX from 'xlsx'
import { MESES, parseNumero } from './format'
import { supabase } from './supabase'
import type { Caixa, Categoria, Conta, Divida, Lancamento, Mes } from './types'
import { BANCOS, TIPOS_CAIXA } from './types'

type NovoLanc = Omit<Lancamento, 'id'>
type NovaDivida = Omit<Divida, 'id'>

export interface MesImportado {
  ano: number
  mes: number
  lancs: NovoLanc[]
  dividas: NovaDivida[]
  meta: Mes
}

// Faixas de linhas do modelo da planilha (1-based, como no Excel).
const FAIXA_ENTRADAS: [number, number] = [3, 106]
const FAIXAS_SAIDAS: [Conta, number, number][] = [
  ['principal', 3, 52],
  ['nubank', 55, 129],
  ['inter', 132, 136],
]

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
        data: data(ws, `F${r}`, ano, mes), conta: 'principal', categoria: 'outros',
      })
    }
    for (const [conta, ini, fim] of FAIXAS_SAIDAS) {
      for (let r = ini; r <= fim; r++) {
        const valor = numero(ws, `L${r}`)
        const desc = valorCelula(ws, `I${r}`)
        if (!valor && !desc) continue
        const categoria: Categoria = transporte.has(r)
          ? 'transporte'
          : dividasPagas.has(r)
            ? 'divida'
            : alimentacao.has(r)
              ? 'alimentacao'
              : 'outros'
        lancs.push({
          ano, mes, tipo: 'saida', descricao: String(desc ?? ''), valor,
          data: data(ws, `N${r}`, ano, mes), conta, categoria,
        })
      }
    }

    const dividas: NovaDivida[] = []
    for (let r = 37; r <= 47; r++) {
      const desc = valorCelula(ws, `Q${r}`)
      const valor = numero(ws, `S${r}`)
      if (!desc && !valor) continue
      dividas.push({
        ano, mes, descricao: String(desc ?? ''), valor_mensal: valor,
        parcelas: numero(ws, `T${r}`), pagas: numero(ws, `U${r}`), ordem: r,
      })
    }

    const caixa: Caixa = {}
    BANCOS.forEach((b, ci) =>
      TIPOS_CAIXA.forEach((t, ri) => {
        const v = numero(ws, `${['AB', 'AC', 'AD'][ci]}${33 + ri}`)
        if (v) (caixa[b] ??= {})[t] = v
      }),
    )
    const meta: Mes = {
      ano, mes, caixa,
      investimentos: numero(ws, 'W22'),
      usd: numero(ws, 'T14'),
      meta_usd: numero(ws, 'T85'),
    }

    const temAlgo = lancs.length || dividas.length || Object.keys(caixa).length || meta.investimentos || meta.usd
    if (temAlgo) resultado.push({ ano, mes, lancs, dividas, meta })
  }
  return resultado
}

/** Substitui no banco os meses que vieram na planilha. */
export async function gravarImportacao(userId: string, meses: MesImportado[]) {
  for (const m of meses) {
    for (const tabela of ['lancamentos', 'dividas'] as const) {
      const { error } = await supabase.from(tabela).delete().eq('ano', m.ano).eq('mes', m.mes)
      if (error) throw error
    }
    if (m.lancs.length) {
      const { error } = await supabase.from('lancamentos').insert(m.lancs)
      if (error) throw error
    }
    if (m.dividas.length) {
      const { error } = await supabase.from('dividas').insert(m.dividas)
      if (error) throw error
    }
    const { error } = await supabase
      .from('meses')
      .upsert({ ...m.meta, user_id: userId }, { onConflict: 'user_id,ano,mes' })
    if (error) throw error
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
  const [lancs, dividas, meses] = await Promise.all([
    buscarTudo<Lancamento>('lancamentos'),
    buscarTudo<Divida>('dividas'),
    buscarTudo<Mes>('meses'),
  ])
  const wb = XLSX.utils.book_new()
  const semIds = <T extends object>(xs: T[]) =>
    xs.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !['id', 'user_id', 'created_at'].includes(k))))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semIds(lancs)), 'Lançamentos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semIds(dividas)), 'Dívidas')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(semIds(meses).map((m) => ({ ...m, caixa: JSON.stringify(m.caixa) }))),
    'Meses',
  )
  XLSX.writeFile(wb, `backup-financas-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
