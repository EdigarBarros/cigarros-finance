/**
 * Importação de investimentos: lê um arquivo (planilha, CSV ou PDF), reconhece o que cada linha é e prepara a prévia que a
 * pessoa confere antes de gravar. Reaproveita os leitores de lib/extrato.ts (CSV e PDF) e a biblioteca de planilhas.
 *
 * O que é reconhecido de verdade (com exemplos nos testes, scripts/invest/casos.ts):
 *  - **Movimentação da B3** (Área do Investidor → Extratos → Movimentação, em Excel ou CSV);
 *  - **Negociação da B3** (Área do Investidor → Extratos → Negociação);
 *  - **Posição da B3** (Área do Investidor → Posição): vira preço de fechamento dos ativos que já existem e posição inicial
 *    dos que ainda não existem;
 *  - **tabela comum** com cabeçalho (data, operação, ativo, quantidade, preço, valor…), de qualquer corretora ou feita à mão;
 *  - **PDF**: só as linhas que trazem data, operação, código do ativo e valores na mesma linha. Nota de corretagem e extrato
 *    em PDF variam demais de uma corretora para outra: o que não for entendido fica pendente, nunca some.
 *
 * Três garantias:
 *  1. **Nada é descartado em silêncio.** Linha com cara de operação que o app não entendeu vira `LinhaPendente`, com o
 *     texto original e o motivo, e fica guardada até a pessoa resolver.
 *  2. **Repetido não entra duas vezes.** Cada operação lida ganha uma `chave` que depende só do conteúdo dela (dia, tipo,
 *     ativo, quantidade, valor e a ordem entre as idênticas do arquivo). O mesmo arquivo importado de novo dá as mesmas
 *     chaves, e o banco recusa a repetida (índice único da migração 28).
 *  3. **O arquivo é dado, não instrução.** Só viram texto os nomes de ativo e instituição, cortados no tamanho do campo e
 *     sem caracteres de controle; nada do arquivo é executado nem interpretado como comando.
 *
 * As funções de leitura são puras (`lerFolhas`, `conciliar`); só `lerArquivoDeInvestimentos` toca no arquivo.
 */
import { tx } from '../textos'
import { diasEntre } from './indices'
import { infoClasse, type Ativo, type Classe, type Indexador, type LinhaPendente, type Operacao, type PrecoInvest, type TipoOperacao } from './tipos'

export type Celula = string | number
export interface Folha { nome: string; linhas: Celula[][] }

/** Uma operação lida do arquivo, ainda sem ativo cadastrado. */
export interface LinhaLida {
  onde: string
  texto: string
  data: string
  tipo: TipoOperacao
  subtipo: string | null
  codigo: string | null
  nome: string
  classe: Classe
  subclasse: string | null
  instituicao: string | null
  quantidade: number | null
  preco: number | null
  valor: number
  custos: number
  impostos: number
  chave: string
}

/** Um ativo que aparece num arquivo de posição: quanto havia e quanto valia no dia do arquivo. */
export interface PosicaoLida {
  onde: string
  texto: string
  codigo: string | null
  nome: string
  classe: Classe
  subclasse: string | null
  instituicao: string | null
  emissor: string | null
  indexador: Indexador | null
  vencimento: string | null
  quantidade: number | null
  preco: number | null
  valor: number
}

export interface ArquivoLido {
  formato: string
  instituicao: string | null
  linhas: LinhaLida[]
  posicoes: PosicaoLida[]
  /** O dia da posição, quando o nome do arquivo diz. */
  dataDaPosicao: string | null
  pendentes: LinhaPendente[]
  /** Quantas linhas com cara de dado o arquivo tinha (lidas + pendentes). */
  total: number
}

// ---------- células ----------

const LIMITE_DE_LINHAS = 20000
const limpar = (s: string, max: number) => s.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const chaveDeTexto = (c: Celula) => semAcento(String(c ?? '')).replace(/[^a-z0-9/% ]+/g, ' ').replace(/\s+/g, ' ').trim()
const texto = (c: Celula | undefined) => (c === undefined || c === null ? '' : String(c).trim())

/** Número de uma célula: aceita número de verdade, "1.234,56", "1,234.56", "R$ 10,00" e "-" (vazio). */
export function numero(c: Celula | undefined): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  let s = texto(c).replace(/R\$|US\$|[$€£]|\s/g, '').replace('−', '-')
  if (!s || s === '-' || s === '--') return null
  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-')
  s = s.replace(/[()+-]/g, '')
  if (!/^[\d.,]+$/.test(s)) return null
  const [virgula, ponto] = [s.lastIndexOf(','), s.lastIndexOf('.')]
  let n: number
  if (virgula >= 0 && ponto >= 0) n = Number(virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
  else if (virgula >= 0) n = Number(s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.'))
  // só ponto: "1.234.567" é milhar; "1.234" fica como decimal (as planilhas escrevem número com ponto), salvo 3 casas exatas depois de 1 a 3 dígitos com mais de um ponto
  else n = Number(s.split('.').length > 2 ? s.replace(/\./g, '') : s)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

/** Data de uma célula: "31/10/2026", "31/10/26", "2026-10-31" (ou data do Excel já convertida para esse formato). */
export function data(c: Celula | undefined): string | null {
  const s = texto(c)
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(s)
  if (m) return valida(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), Number(m[2]), Number(m[1]))
  return null
}
function valida(a: number, m: number, d: number): string | null {
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const x = new Date(Date.UTC(a, m - 1, d))
  if (x.getUTCMonth() !== m - 1) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Impressão digital curta de um texto (a mesma entrada dá sempre a mesma saída). */
function digital(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

// ---------- reconhecer o ativo pelo nome ----------

const ETFS = /\b(etf|ishares|it now|index|indice|trend|b-index|investo|hashdex|qr |nu ibov|bb etf|fundo de indice)\b/
const FIIS = /\b(fii|fdo inv imob|fundo de investimento imobiliario|fundo imobiliario|fiagro|fundo inv imob|imobiliario|fi infra)\b/

/** O que dá para saber de um produto só pelo nome e pelo código: código, tipo e (na renda fixa) o título. */
export function reconhecerProduto(bruto: string, codigoDaColuna?: string | null, folha = ''): { codigo: string | null; nome: string; classe: Classe; subclasse: string | null; indexador: Indexador | null } {
  const original = limpar(bruto, 120)
  const t = semAcento(original)
  const f = semAcento(folha)
  let codigo = codigoDaColuna ? limpar(codigoDaColuna, 24).toUpperCase() : null
  let nome = original
  // "PETR4 - PETROLEO BRASILEIRO S.A." → código e nome
  const m = /^([A-Z]{4}\d{1,2}[A-Z]?)\s*-\s*(.+)$/i.exec(original)
  if (m) { codigo ??= m[1].toUpperCase(); nome = limpar(m[2], 120) } else if (!codigo && /^[A-Z]{4}\d{1,2}F?$/i.test(original)) codigo = original.toUpperCase()
  // mercado fracionário: PETR4F é a mesma PETR4
  if (codigo && /^[A-Z]{4}\d{1,2}F$/.test(codigo)) codigo = codigo.slice(0, -1)
  if (!codigo || !/^[A-Z0-9]{4,12}$/.test(codigo)) codigo = codigo && /^[A-Z0-9.\- ]{2,24}$/.test(codigo) ? codigo : null
  const rendaFixa = (subclasse: string, indexador: Indexador | null = null) => ({ codigo: /^[A-Z]{4}\d{1,2}$/.test(codigo ?? '') ? codigo : null, nome: original, classe: 'renda_fixa' as const, subclasse, indexador })
  if (/tesouro/.test(t) || /tesouro/.test(f)) {
    if (/selic|lft/.test(t)) return rendaFixa('tesouro_selic', 'selic')
    if (/ipca|ntn-?b|renda\+|educa\+/.test(t)) return rendaFixa('tesouro_ipca', 'ipca')
    if (/prefixado|ltn|ntn-?f/.test(t)) return rendaFixa('tesouro_prefixado', 'pre')
    return rendaFixa('outro')
  }
  if (/^cdb\b|\bcdb\b/.test(t)) return rendaFixa('cdb')
  if (/^lci\b|\blci\b/.test(t)) return rendaFixa('lci')
  if (/^lca\b|\blca\b/.test(t)) return rendaFixa('lca')
  if (/debenture/.test(t)) return rendaFixa('debenture')
  if (/\b(cri|cra)\b/.test(t)) return rendaFixa('cri_cra')
  if (/renda fixa/.test(f)) return rendaFixa('outro')
  let classe: Classe = 'outro'
  if (FIIS.test(t) || /imobili/.test(f)) classe = 'fii'
  else if (ETFS.test(t) || /\betf\b/.test(f)) classe = 'etf'
  else if (/\bbdr\b/.test(t) || /\bbdr\b/.test(f) || /^[A-Z]{4}3[2-9]$/.test(codigo ?? '')) classe = 'internacional'
  else if (/^[A-Z]{4}(3|4|5|6|11)$/.test(codigo ?? '') || /acoes|acao/.test(f)) classe = 'acao'
  else if (/fundo/.test(t) || /fundo/.test(f)) classe = 'fundo'
  return { codigo, nome: nome || original, classe, subclasse: null, indexador: null }
}

// ---------- reconhecer a operação pelo texto ----------

interface TipoLido { tipo: TipoOperacao; subtipo?: string }

/** `sentido`: +1 quando a coluna de entrada/saída diz crédito, −1 quando diz débito. */
function reconhecerTipo(bruto: string, sentido: 1 | -1 | 0): TipoLido | null {
  const t = chaveDeTexto(bruto)
  if (!t) return null
  if (/dividendo/.test(t)) return { tipo: 'provento', subtipo: 'dividendo' }
  if (/juros sobre capital|jcp|jscp/.test(t)) return { tipo: 'provento', subtipo: 'jcp' }
  if (/rendimento/.test(t)) return { tipo: 'provento', subtipo: 'rendimento' }
  if (/^juros|pagamento de juros|cupom/.test(t)) return { tipo: 'juros' }
  if (/amortizacao/.test(t)) return { tipo: 'amortizacao' }
  if (/vencimento/.test(t)) return { tipo: 'vencimento' }
  if (/bonificacao|desdobro|desdobramento/.test(t)) return sentido >= 0 ? { tipo: 'bonificacao' } : null
  if (/^(c|compra|buy|aplicacao|aporte|subscricao)$/.test(t) || /^compra\b|^aplicacao\b/.test(t)) return { tipo: 'compra' }
  if (/^(v|venda|sell|resgate|resgate antecipado)$/.test(t) || /^venda\b|^resgate\b/.test(t)) return { tipo: 'venda' }
  if (/transferencia liquidacao|compra venda|liquidacao/.test(t)) return sentido > 0 ? { tipo: 'compra' } : sentido < 0 ? { tipo: 'venda' } : null
  if (/taxa de custodia|taxa b3|taxa semestral|^taxa/.test(t)) return { tipo: 'taxa' }
  if (/imposto|^ir\b|irrf|come cotas/.test(t)) return { tipo: 'imposto' }
  return null
}

const sentidoDe = (c: Celula | undefined): 1 | -1 | 0 => {
  const t = chaveDeTexto(c ?? '')
  return /^(credito|entrada|c)$/.test(t) ? 1 : /^(debito|saida|d)$/.test(t) ? -1 : 0
}

// ---------- cabeçalhos ----------

type Campo = 'data' | 'tipo' | 'sentido' | 'produto' | 'codigo' | 'instituicao' | 'quantidade' | 'preco' | 'valor' | 'custos' | 'impostos' | 'emissor' | 'vencimento' | 'indexador'

const NOMES: Record<Campo, RegExp> = {
  data: /^(data|date|dt|data do negocio|data da operacao|data operacao|data do pregao|data de liquidacao|data movimentacao)$/,
  tipo: /^(movimentacao|tipo de movimentacao|tipo|operacao|tipo de operacao|c\/v|natureza|evento|historico|lancamento)$/,
  sentido: /^(entrada\/saida|entrada saida|d\/c|credito\/debito)$/,
  produto: /^(produto|ativo|papel|titulo|descricao|nome|especificacao do titulo|nome do ativo)$/,
  codigo: /^(codigo de negociacao|codigo|ticker|cod|codigo do ativo|simbolo)$/,
  instituicao: /^(instituicao|corretora|banco|agente de custodia|agente)$/,
  quantidade: /^(quantidade|qtd|qtde|qtd\.|cotas|quantidade disponivel|quant)$/,
  preco: /^(preco unitario|preco|pu|cotacao|preco medio|preco de fechamento|preco atualizado curva|preco atualizado mtm|preco \/ ajuste|valor unitario)$/,
  valor: /^(valor da operacao|valor|valor total|total|financeiro|valor liquido|valor bruto|valor atualizado|valor atualizado curva|valor atualizado mtm|valor operacao|valor financeiro)$/,
  custos: /^(taxas|custos|corretagem|emolumentos|taxa|taxa de corretagem|custos totais)$/,
  impostos: /^(ir|imposto|irrf|iof|imposto retido|ir retido)$/,
  emissor: /^(emissor)$/,
  vencimento: /^(vencimento|prazo\/vencimento|data de vencimento)$/,
  indexador: /^(indexador|indice)$/,
}

function cabecalho(linha: Celula[]): Partial<Record<Campo, number>> | null {
  const col: Partial<Record<Campo, number>> = {}
  linha.forEach((c, i) => {
    const t = chaveDeTexto(c)
    if (!t) return
    for (const campo of Object.keys(NOMES) as Campo[]) {
      if (col[campo] === undefined && NOMES[campo].test(t)) { col[campo] = i; break }
    }
  })
  const achados = Object.keys(col).length
  const temAtivo = col.produto !== undefined || col.codigo !== undefined
  return achados >= 3 && temAtivo && (col.valor !== undefined || col.quantidade !== undefined) ? col : null
}

// ---------- ler as folhas ----------

const inteiros = (n: number) => Math.round(n * 100)

/** Lê as folhas de uma planilha (ou a tabela de um CSV) e devolve operações, posições e o que ficou pendente. */
export function lerFolhas(folhas: Folha[], nomeDoArquivo = ''): ArquivoLido {
  const linhas: LinhaLida[] = []
  const posicoes: PosicaoLida[] = []
  const pendentes: LinhaPendente[] = []
  const formatos = new Set<string>()
  const instituicoes = new Map<string, number>()
  let total = 0
  const repetidas = new Map<string, number>()
  for (const folha of folhas) {
    const rows = folha.linhas.slice(0, LIMITE_DE_LINHAS).map((r) => r.map((c) => (typeof c === 'number' ? c : limpar(String(c ?? ''), 300))))
    const inicio = rows.slice(0, 40).findIndex((r) => cabecalho(r))
    if (inicio < 0) continue
    const col = cabecalho(rows[inicio])!
    // sem coluna de data, cada linha é um ativo com quantidade e valor: é um arquivo de posição
    const ehPosicao = col.data === undefined
    const b3 = col.sentido !== undefined ? tx('Movimentação da B3') : chaveDeTexto(rows[inicio][col.data ?? 0] ?? '') === 'data do negocio' ? tx('Negociação da B3') : null
    formatos.add(ehPosicao ? tx('Posição') : b3 ?? tx('Tabela de operações'))
    for (let i = inicio + 1; i < rows.length; i++) {
      const r = rows[i]
      const cel = (c: Campo) => (col[c] === undefined ? undefined : r[col[c]!])
      const bruto = r.map((c) => String(c ?? '')).filter(Boolean).join(' | ')
      if (!bruto) continue
      const produto = texto(cel('produto')) || texto(cel('codigo'))
      const onde = folhas.length > 1 ? tx('{0}, linha {1}', folha.nome, i + 1) : tx('Linha {0}', i + 1)
      // linhas de total e de rodapé: sem produto, ou só um rótulo
      if (!produto || /^(total|subtotal|saldo)/.test(chaveDeTexto(produto))) continue
      const p = reconhecerProduto(produto, col.produto !== undefined ? texto(cel('codigo')) || null : null, folha.nome)
      const instituicao = limpar(texto(cel('instituicao')), 80) || null
      if (instituicao) instituicoes.set(instituicao, (instituicoes.get(instituicao) ?? 0) + 1)
      const quantidade = numero(cel('quantidade'))
      const preco = numero(cel('preco'))
      let valor = numero(cel('valor'))
      if (ehPosicao) {
        if (valor === null && quantidade !== null && preco !== null) valor = quantidade * preco
        if (valor === null && quantidade === null) continue
        total++
        if (valor === null || valor < 0) { pendentes.push({ onde, texto: limpar(bruto, 400), motivo: tx('Não achei o valor desta posição.') }); continue }
        posicoes.push({
          onde, texto: limpar(bruto, 400), codigo: p.codigo, nome: p.nome, classe: p.classe, subclasse: p.subclasse, instituicao,
          emissor: limpar(texto(cel('emissor')), 80) || null, indexador: p.indexador, vencimento: data(cel('vencimento')),
          quantidade: quantidade !== null && quantidade > 0 ? quantidade : null, preco: preco !== null && preco > 0 ? preco : null, valor: Math.round(valor * 100) / 100,
        })
        continue
      }
      const dia = data(cel('data'))
      // linha sem data numa tabela de operações: título repetido, observação ou rodapé
      if (!dia) { if (quantidade !== null || valor !== null) { total++; pendentes.push({ onde, texto: limpar(bruto, 400), motivo: tx('Não entendi a data desta linha.') }) } continue }
      total++
      const sentido = sentidoDe(cel('sentido'))
      const descricaoDoTipo = texto(cel('tipo'))
      const tipo = reconhecerTipo(descricaoDoTipo, sentido) ?? (!descricaoDoTipo && sentido ? { tipo: sentido > 0 ? 'compra' as const : 'venda' as const } : null)
      if (!tipo) {
        pendentes.push({ onde, texto: limpar(bruto, 400), motivo: descricaoDoTipo ? tx('O app ainda não entende a movimentação “{0}”.', limpar(descricaoDoTipo, 60)) : tx('A linha não diz se é compra, venda ou outro tipo de operação.') })
        continue
      }
      const q = quantidade !== null ? Math.abs(quantidade) : null
      if (valor === null && q !== null && preco !== null) valor = q * preco
      const porValor = infoClasse(p.classe).porValor
      const precisaDeQuantidade = !porValor && (tipo.tipo === 'compra' || tipo.tipo === 'venda' || tipo.tipo === 'bonificacao')
      if (precisaDeQuantidade && (q === null || q <= 0)) { pendentes.push({ onde, texto: limpar(bruto, 400), motivo: tx('Falta a quantidade desta operação.') }); continue }
      if (valor === null && tipo.tipo !== 'bonificacao') { pendentes.push({ onde, texto: limpar(bruto, 400), motivo: tx('Não achei o valor desta operação.') }); continue }
      const v = Math.round(Math.abs(valor ?? 0) * 100) / 100
      const custos = Math.round(Math.abs(numero(cel('custos')) ?? 0) * 100) / 100
      const impostos = Math.round(Math.abs(numero(cel('impostos')) ?? 0) * 100) / 100
      const semente = `${dia}|${tipo.tipo}|${semAcento(p.codigo ?? p.nome)}|${q ?? ''}|${inteiros(v)}`
      const n = repetidas.get(semente) ?? 0
      repetidas.set(semente, n + 1)
      linhas.push({
        onde, texto: limpar(bruto, 400), data: dia, tipo: tipo.tipo, subtipo: tipo.subtipo ?? null, codigo: p.codigo, nome: p.nome, classe: p.classe, subclasse: p.subclasse,
        instituicao, quantidade: porValor ? null : q, preco: preco !== null && preco > 0 ? preco : q && v ? v / q : null, valor: v, custos, impostos,
        chave: `i:${dia}:${tipo.tipo}:${digital(semente)}:${n}`,
      })
    }
  }
  const dataDoNome = /(\d{4})[-_.](\d{2})[-_.](\d{2})/.exec(nomeDoArquivo)
  const instituicao = [...instituicoes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  return {
    formato: [...formatos].join(' + ') || tx('Não reconhecido'), instituicao: instituicoes.size === 1 ? instituicao : null, linhas, posicoes,
    dataDaPosicao: dataDoNome ? valida(Number(dataDoNome[1]), Number(dataDoNome[2]), Number(dataDoNome[3])) : null, pendentes, total,
  }
}

// ---------- PDF ----------

const CODIGO = /\b([A-Z]{4}\d{1,2})F?\b/
const DATA_NO_TEXTO = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/
const NUMERO_NO_TEXTO = /-?\d{1,3}(?:\.\d{3})*,\d{2,8}|-?\d+,\d{2,8}|\b\d+\b/g

/**
 * Linhas de texto de um PDF → operações. Só entende a linha que traz tudo junto: data, operação (compra, venda, dividendo…),
 * código do ativo e os valores. O resto das linhas com data e valor vira pendente; cabeçalho e rodapé ficam de fora.
 */
export function lerLinhasDeTexto(linhasDoPdf: string[]): ArquivoLido {
  const linhas: LinhaLida[] = []
  const pendentes: LinhaPendente[] = []
  const repetidas = new Map<string, number>()
  let total = 0
  linhasDoPdf.slice(0, LIMITE_DE_LINHAS).forEach((bruta, i) => {
    const l = limpar(bruta, 400)
    const d = DATA_NO_TEXTO.exec(l)
    if (!d) return
    const resto = l.replace(d[0], ' ')
    const numeros = (resto.match(NUMERO_NO_TEXTO) ?? []).map((x) => numero(x)).filter((x): x is number => x !== null)
    const comCentavos = (resto.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d+,\d{2}\b/g) ?? []).map((x) => Math.abs(numero(x) ?? 0))
    if (!comCentavos.length) return
    total++
    const onde = tx('Linha {0}', i + 1)
    const dia = data(d[1])
    const codigo = CODIGO.exec(resto)
    const palavras = semAcento(resto)
    const tipo = /\bdividendo/.test(palavras) ? { tipo: 'provento' as const, subtipo: 'dividendo' }
      : /juros sobre capital|\bjcp\b/.test(palavras) ? { tipo: 'provento' as const, subtipo: 'jcp' }
        : /\brendimento/.test(palavras) ? { tipo: 'provento' as const, subtipo: 'rendimento' }
          : /\bcompra\b|\bc\b(?= +(vista|fracionario))/.test(palavras) ? { tipo: 'compra' as const }
            : /\bvenda\b|\bv\b(?= +(vista|fracionario))/.test(palavras) ? { tipo: 'venda' as const } : null
    if (!dia || !codigo || !tipo) {
      pendentes.push({ onde, texto: l, motivo: !codigo ? tx('Não achei o código do ativo nesta linha.') : !tipo ? tx('A linha não diz se é compra, venda ou outro tipo de operação.') : tx('Não entendi a data desta linha.') })
      return
    }
    const p = reconhecerProduto(codigo[1], codigo[1])
    const provento = tipo.tipo === 'provento'
    // compra e venda: quantidade, preço e valor, nessa ordem; o valor tem de bater com quantidade × preço
    let q: number | null = null
    let preco: number | null = null
    const valor = comCentavos[comCentavos.length - 1]
    if (!provento) {
      const inteirosDaLinha = numeros.filter((x) => Number.isInteger(x) && x > 0)
      const achado = inteirosDaLinha.map((qtd) => ({ qtd, pu: comCentavos.find((pu) => Math.abs(qtd * pu - valor) <= Math.max(0.02, valor * 0.0005)) })).find((x) => x.pu !== undefined)
      if (!achado) { pendentes.push({ onde, texto: l, motivo: tx('Quantidade, preço e valor desta linha não fecham entre si.') }); return }
      q = achado.qtd
      preco = achado.pu!
    }
    const semente = `${dia}|${tipo.tipo}|${semAcento(p.codigo ?? p.nome)}|${q ?? ''}|${inteiros(valor)}`
    const n = repetidas.get(semente) ?? 0
    repetidas.set(semente, n + 1)
    linhas.push({
      onde, texto: l, data: dia, tipo: tipo.tipo, subtipo: ('subtipo' in tipo ? tipo.subtipo : null) ?? null, codigo: p.codigo, nome: p.nome, classe: p.classe, subclasse: null, instituicao: null,
      quantidade: q, preco, valor, custos: 0, impostos: 0, chave: `i:${dia}:${tipo.tipo}:${digital(semente)}:${n}`,
    })
  })
  linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  return { formato: tx('PDF (leitura parcial)'), instituicao: null, linhas, posicoes: [], dataDaPosicao: null, pendentes, total }
}

// ---------- conciliar com a carteira ----------

export interface NovoAtivoLido { id: string; codigo: string | null; nome: string; classe: Classe; subclasse: string | null; instituicao: string | null; emissor: string | null; indexador: Indexador | null; vencimento: string | null }

export interface LinhaDaPrevia {
  linha: LinhaLida
  /** O ativo da carteira a que a linha pertence, ou o id provisório de um ativo novo (`NovoAtivoLido.id`). */
  ativo: string
  novoAtivo: boolean
  /** 'repetida': a mesma linha já foi importada. 'parecida': há uma operação quase igual, lançada à mão ou vinda de outro arquivo. */
  estado: 'nova' | 'repetida' | 'parecida'
  /** Algo que a pessoa precisa saber antes de importar esta linha. */
  aviso: string | null
}

export interface PosicaoDaPrevia {
  posicao: PosicaoLida
  ativo: string
  novoAtivo: boolean
  /** O que será gravado: o preço (ou saldo) do dia num ativo que já existe, ou a posição inicial de um ativo novo. */
  efeito: 'preco' | 'posicao-inicial'
  estado: 'nova' | 'repetida'
  chave: string
}

export interface Previa {
  linhas: LinhaDaPrevia[]
  posicoes: PosicaoDaPrevia[]
  novosAtivos: NovoAtivoLido[]
  pendentes: LinhaPendente[]
}

const mesmoTexto = (a: string | null, b: string | null) => semAcento(a ?? '').replace(/\s+/g, ' ').trim() === semAcento(b ?? '').replace(/\s+/g, ' ').trim()

/**
 * Cruza o que foi lido com a carteira: acha o ativo de cada linha (pelo código; na renda fixa, pelo nome e a instituição),
 * marca o que já foi importado ou parece repetido e avisa das vendas que não fecham com a posição conhecida.
 */
export function conciliar(lido: ArquivoLido, ativos: Ativo[], operacoes: Operacao[], precos: PrecoInvest[], dataDaPosicao: string): Previa {
  const novos: NovoAtivoLido[] = []
  const achar = (x: { codigo: string | null; nome: string; classe: Classe; subclasse: string | null; instituicao: string | null; emissor?: string | null; indexador?: Indexador | null; vencimento?: string | null }) => {
    const existente = x.codigo
      ? ativos.find((a) => a.codigo && a.codigo.toUpperCase() === x.codigo) ?? ativos.find((a) => !a.codigo && mesmoTexto(a.nome, x.codigo))
      : ativos.find((a) => mesmoTexto(a.nome, x.nome) && (!a.instituicao || !x.instituicao || mesmoTexto(a.instituicao, x.instituicao)))
    if (existente) return { id: existente.id, novo: false }
    let n = novos.find((a) => (x.codigo ? a.codigo === x.codigo : !a.codigo && mesmoTexto(a.nome, x.nome) && mesmoTexto(a.instituicao, x.instituicao)))
    if (!n) {
      n = { id: `novo:${novos.length}`, codigo: x.codigo, nome: x.nome, classe: x.classe, subclasse: x.subclasse, instituicao: x.instituicao, emissor: x.emissor ?? null, indexador: x.indexador ?? null, vencimento: x.vencimento ?? null }
      novos.push(n)
    }
    return { id: n.id, novo: true }
  }
  const chaves = new Set(operacoes.map((o) => o.chave).filter(Boolean))
  const porAtivo = new Map<string, Operacao[]>()
  for (const o of operacoes) porAtivo.set(o.ativo_id, [...(porAtivo.get(o.ativo_id) ?? []), o])
  // quantidade conhecida de cada ativo ao longo do arquivo, para avisar da venda que passa do que havia
  const quantidade = new Map<string, number>()
  const quantidadeAte = (ativoId: string, dia: string) => (porAtivo.get(ativoId) ?? []).filter((o) => o.data <= dia)
    .reduce((q, o) => q + (o.tipo === 'compra' || o.tipo === 'bonificacao' || o.tipo === 'ajuste' ? o.quantidade ?? 0 : o.tipo === 'venda' ? -(o.quantidade ?? 0) : 0), 0)
  const linhas = lido.linhas.map((linha): LinhaDaPrevia => {
    const a = achar(linha)
    const repetida = chaves.has(linha.chave)
    const parecida = !repetida && !a.novo && (porAtivo.get(a.id) ?? []).some((o) =>
      o.tipo === linha.tipo && Math.abs(o.valor - linha.valor) < 0.015 && Math.abs(diasEntre(o.data, linha.data)) <= 3
      && Math.abs((o.quantidade ?? 0) - (linha.quantidade ?? 0)) < 1e-6)
    let aviso: string | null = null
    if (!repetida && linha.quantidade !== null) {
      const antes = quantidade.get(a.id) ?? (a.novo ? 0 : quantidadeAte(a.id, linha.data))
      const depois = antes + (linha.tipo === 'venda' ? -linha.quantidade : linha.tipo === 'compra' || linha.tipo === 'bonificacao' ? linha.quantidade : 0)
      if (linha.tipo === 'venda' && depois < -1e-6) aviso = tx('Venda maior que a posição conhecida: pode faltar uma compra anterior ao período deste arquivo.')
      quantidade.set(a.id, Math.max(0, depois))
    }
    return { linha, ativo: a.id, novoAtivo: a.novo, estado: repetida ? 'repetida' : parecida ? 'parecida' : 'nova', aviso }
  })
  const posicoes = lido.posicoes.map((posicao): PosicaoDaPrevia => {
    const a = achar(posicao)
    // um ativo que só ganhou cadastro por causa das operações deste mesmo arquivo também recebe só o preço
    const temOperacoes = !a.novo || linhas.some((l) => l.ativo === a.id)
    const chave = `p:${dataDaPosicao}:${digital(`${semAcento(posicao.codigo ?? posicao.nome)}|${semAcento(posicao.instituicao ?? '')}`)}`
    const natureza = posicao.quantidade !== null && posicao.preco !== null && !infoClasse(posicao.classe).porValor ? 'preco' : 'saldo'
    const jaTem = temOperacoes
      ? precos.some((p) => p.ativo_id === a.id && p.data === dataDaPosicao && p.natureza === natureza && Math.abs(p.valor - (natureza === 'preco' ? posicao.preco! : posicao.valor)) < 1e-6)
      : chaves.has(chave)
    return { posicao, ativo: a.id, novoAtivo: a.novo, efeito: temOperacoes ? 'preco' : 'posicao-inicial', estado: jaTem ? 'repetida' : 'nova', chave }
  })
  return { linhas, posicoes, novosAtivos: novos, pendentes: lido.pendentes }
}

// ---------- abrir o arquivo ----------

const TAMANHO_MAXIMO = 15 * 1024 * 1024

/** Impressão digital do conteúdo do arquivo (SHA-256), para reconhecer o mesmo arquivo importado de novo. */
export async function hashDoArquivo(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Junta os pedaços de texto de uma página de PDF em linhas (de cima para baixo, da esquerda para a direita). */
export function linhasDaPagina(itens: { str: string; x: number; y: number; h: number }[]): string[] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: { y: number; itens: typeof itens }[] = []
  for (const it of ordenados) {
    const l = linhas.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.4))
    if (l) l.itens.push(it)
    else linhas.push({ y: it.y, itens: [it] })
  }
  return linhas.map((l) => l.itens.sort((a, b) => a.x - b.x).map((i) => i.str).join(' '))
}

export async function lerArquivoDeInvestimentos(arquivo: File): Promise<ArquivoLido & { hash: string }> {
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error(tx('Esse arquivo passa de 15 MB. Exporte um período menor.'))
  const ext = arquivo.name.toLowerCase().split('.').pop() ?? ''
  const dados = await arquivo.arrayBuffer()
  const hash = await hashDoArquivo(dados)
  if (ext === 'pdf') {
    const { itensDoPdf } = await import('../extrato')
    const paginas = await itensDoPdf(dados)
    return { ...lerLinhasDeTexto(paginas.flatMap(linhasDaPagina)), hash }
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(dados, { type: 'array', cellDates: true })
    const celula = (v: unknown): Celula => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : typeof v === 'number' ? v : String(v ?? ''))
    const folhas = wb.SheetNames.map((nome) => ({ nome, linhas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: true, defval: '' }).map((r) => r.map(celula)) }))
    return { ...lerFolhas(folhas, arquivo.name), hash }
  }
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    const { lerCsv } = await import('../extrato')
    let conteudo: string
    try { conteudo = new TextDecoder('utf-8', { fatal: true }).decode(dados) } catch { conteudo = new TextDecoder('windows-1252').decode(dados) }
    let melhor = lerFolhas([{ nome: arquivo.name, linhas: lerCsv(conteudo) }], arquivo.name)
    // o separador da primeira linha pode enganar (título antes da tabela): tenta os outros
    for (const sep of [';', ',', '\t']) {
      const outro = lerFolhas([{ nome: arquivo.name, linhas: lerCsv(conteudo, sep) }], arquivo.name)
      if (outro.linhas.length + outro.posicoes.length > melhor.linhas.length + melhor.posicoes.length) melhor = outro
    }
    return { ...melhor, hash }
  }
  throw new Error(tx('Esse tipo de arquivo ainda não dá para ler. Use Excel (.xlsx), CSV ou PDF.'))
}
