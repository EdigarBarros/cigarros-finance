/**
 * Os filtros e as contas da tela Lançamentos (a do computador e a do celular usam os mesmos): tipo, banco, forma,
 * categoria, dia, ordem e busca; o que entra na lista, os grupos por dia, as categorias, as formas de pagamento, os totais e
 * as compras no cartão que ficam na tela Cartões. Só estado e conta; nada aqui desenha.
 */
import { useMemo, useState } from 'react'
import { casaCompraNoCartao, chaveDaCompra, ehCompraNoCartao, hojeLocal } from '../../lib/cartoes'
import { SEM_CATEGORIA } from '../../lib/categorias'
import { formaDe, infoForma, type FormaPagamento } from '../../lib/formas'
import { fmtValor } from '../../lib/format'
import { criarBusca, semAcento, tirarCategoriaPedida } from '../../lib/busca'
import { ehGuardado } from '../../lib/guardado'
import type { Lancamento, Tipo } from '../../lib/types'
import type { Ctx } from '../contexto'
import { tx } from '../../lib/textos'
import { previstosDoMes } from '../../lib/previstos'

export type Filtro<T> = T | 'todos'
export const doisDig = (n: number) => String(n).padStart(2, '0')
// A saída guardada (dinheiro indo para o porquinho) aparece na lista mas não é gasto: fica fora de todas as somas.
export const somaTipo = (ls: Lancamento[], t: Tipo) => ls.filter((l) => l.tipo === t && !ehGuardado(l)).reduce((a, l) => a + l.valor, 0)
export function somaDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`
}

export function useLancamentosFiltrados(c: Ctx) {
  const [tipo, setTipo] = useState<Filtro<Tipo>>('todos')
  const [banco, setBanco] = useState<Filtro<string>>('todos')
  const [forma, setForma] = useState<Filtro<FormaPagamento | 'sem'>>('todos')
  // Dia e categoria escolhidos valem para o mês em que foram escolhidos: ao trocar de mês ou de ano voltam para "todos",
  // senão o mês novo abriria vazio ("Nada com esses filtros") com todos os dias desligados.
  const chaveMes = `${c.ano}-${c.mes}`
  // a Início pode pedir para abrir já numa categoria ("Principais gastos" → "Abrir em Lançamentos")
  const [doMes, setDoMes] = useState<{ chave: string; dia: string | null; categoria: Filtro<string> }>(() => ({ chave: chaveMes, dia: null, categoria: tirarCategoriaPedida() ?? 'todos' }))
  const vazios = { chave: chaveMes, dia: null as string | null, categoria: 'todos' as Filtro<string> }
  const escolhidos = doMes.chave === chaveMes ? doMes : vazios
  /** id da categoria, 'sem' (sem categoria) ou 'todos'. */
  const categoria = escolhidos.categoria
  const dia = escolhidos.dia
  const mudar = (parte: Partial<typeof vazios>) => setDoMes((a) => ({ ...(a.chave === chaveMes ? a : vazios), ...parte }))
  const setCategoria = (k: Filtro<string>) => mudar({ categoria: k })
  const setDia = (d: string | null) => mudar({ dia: d })
  const [ordem, setOrdem] = useState<'data' | 'valor'>('data')
  const [todasCategorias, setTodasCategorias] = useState(false)
  const { busca, setBusca } = c
  const hoje = hojeLocal()

  // Com algo digitado na busca, ela procura no ano inteiro (o lançamento que você quer pode estar em outro mês).
  const pesquisando = busca.trim().length > 0
  // As compras no cartão ficam na tela Cartões (aqui só se vê o que entrou e saiu da conta); sem o módulo de cartões, tudo aparece.
  // Só as de cartão ativo: a tela Cartões mostra os cartões ativos, e a compra de um cartão que a pessoa deixou de usar não pode sumir.
  const separaCartao = c.v.cartoes && !c.cartoes.semTabela
  const cartoesAtivos = useMemo(() => new Set(c.cartoes.cartoes.filter((k) => k.ativo).map((k) => k.id)), [c.cartoes.cartoes])
  const naTelaCartoes = (l: Lancamento) => separaCartao && ehCompraNoCartao(l) && (!c.cartoes.carregado || cartoesAtivos.has(l.cartao_id!))
  const doPeriodo = pesquisando ? c.lancsAnoComGuardados : c.lancsMesComGuardados
  const origem = useMemo(() => doPeriodo.filter((l) => !naTelaCartoes(l)), [doPeriodo, separaCartao, cartoesAtivos, c.cartoes.carregado]) // eslint-disable-line react-hooks/exhaustive-deps
  const casa = useMemo(() => criarBusca(busca, hoje, somaDias(hoje, -1)), [busca, hoje])
  /** O mês aberto tem algum lançamento aqui (fora as compras no cartão)? */
  const temNoMes = c.lancsMesComGuardados.some((l) => !naTelaCartoes(l))
  // o que ainda vem no mês (contas sem baixa, parcelas de dívida e do que te devem), por dia, para o calendário
  const previstos = useMemo(() => previstosDoMes({
    ano: c.ano, mes: c.mes, hoje, diaRef: c.diaRef,
    contas: c.v.contas ? c.situacoesContas : [],
    dividas: c.v.dividas ? [...c.situacao, ...c.aReceber] : [],
    faturas: c.faturas,
    pagamentos: c.d.pagamentos,
  }), [c.ano, c.mes, hoje, c.diaRef, c.v.contas, c.v.dividas, c.situacoesContas, c.situacao, c.aReceber, c.faturas, c.d.pagamentos])
  const comCalendario = (temNoMes || previstos.size > 0) && c.perfil.detalhe !== 'simples'
  // o que o lançamento "diz", sem acento: nome, categoria, banco, cartão, forma, dívida e se é entrada ou saída
  const textoDe = (l: Lancamento) => {
    const f = formaDe(l)
    const div = l.divida_id ? c.d.dividas.find((x) => x.id === l.divida_id) : undefined
    return semAcento([
      l.descricao, c.categoriaDe(l)?.nome, c.d.bancos.find((b) => b.id === l.banco_id)?.nome,
      l.cartao_id ? `cartao ${c.cartoes.cartoes.find((k) => k.id === l.cartao_id)?.nome ?? ''}` : '',
      f ? infoForma(f).nome : '', div ? `${div.descricao} ${div.pessoa ?? ''}` : '',
      l.tipo === 'entrada' ? tx('entrada entradas recebido') : tx('saida saidas gasto'), (l.parcelas ?? 1) > 1 ? tx('parcela parcelado') : '',
    ].filter(Boolean).join(' '))
  }

  // compras no cartão deste mês (ou da busca, em todos os anos, como a tela Cartões) que ficaram de fora desta lista: o aviso leva para lá
  const noCartao = useMemo(
    () => (pesquisando && casa ? c.cartoes.compras : c.lancsMes)
      .filter((l) => naTelaCartoes(l) && (!casa || casaCompraNoCartao(casa, l, c.categoriaDe(l)?.nome, c.cartoes.cartoes.find((k) => k.id === l.cartao_id)?.nome))),
    [pesquisando, casa, c.cartoes.compras, c.lancsMes, c.categorias, cartoesAtivos, separaCartao, c.cartoes.carregado], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const comprasNoCartao = new Set(noCartao.map(chaveDaCompra)).size
  const totalNoCartao = noCartao.reduce((a, l) => a + l.valor, 0)

  // tudo menos a categoria e o dia: base para os chips de categoria e para o calendário
  const base = useMemo(() => {
    return origem
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter((l) => banco === 'todos' || (banco === 'sem' ? !l.banco_id : l.banco_id === banco))
      .filter((l) => forma === 'todos' || (formaDe(l) ?? 'sem') === forma)
      .filter((l) => !casa || casa(l, textoDe(l)))
  }, [origem, tipo, banco, forma, casa, c.categorias, c.d.bancos, c.d.dividas, c.cartoes.cartoes]) // eslint-disable-line react-hooks/exhaustive-deps

  const daCategoria = (l: Lancamento) => categoria === 'todos' || (categoria === 'sem' ? !c.categoriaDe(l) : c.categoriaDe(l)?.id === categoria)
  const semDia = base.filter(daCategoria)
  const filtrados = semDia
    .filter((l) => !dia || l.data === dia)
    .sort((x, y) => ordem === 'valor'
      ? y.valor - x.valor
      : (y.data ?? '').localeCompare(x.data ?? '') || (y.created_at ?? '').localeCompare(x.created_at ?? ''))

  const grupos = useMemo(() => {
    const g = new Map<string, Lancamento[]>()
    for (const l of filtrados) g.set(l.data ?? '', [...(g.get(l.data ?? '') ?? []), l])
    return [...g.entries()]
  }, [filtrados])

  // chips de categoria: as do tipo escolhido (sem tipo, as de saída), da maior para a menor
  const tipoChips: Tipo = tipo === 'entrada' ? 'entrada' : 'saida'
  const chips = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; icone: string; cor: string; total: number; n: number }>()
    for (const l of base.filter((x) => x.tipo === tipoChips && !ehGuardado(x) && (!dia || x.data === dia))) {
      const k = c.categoriaDe(l)
      const id = k?.id ?? 'sem'
      const g = m.get(id) ?? { id, nome: k?.nome ?? SEM_CATEGORIA.nome, icone: k?.icone ?? SEM_CATEGORIA.icone, cor: k?.cor ?? SEM_CATEGORIA.cor, total: 0, n: 0 }
      g.total += l.valor
      g.n++
      m.set(id, g)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [base, tipoChips, dia]) // eslint-disable-line react-hooks/exhaustive-deps

  const entrou = somaTipo(filtrados, 'entrada')
  const saiu = somaTipo(filtrados, 'saida')
  const filtrando = tipo !== 'todos' || banco !== 'todos' || forma !== 'todos' || categoria !== 'todos' || busca || dia
  const limpar = () => { setTipo('todos'); setBanco('todos'); setForma('todos'); setCategoria('todos'); setBusca(''); setDia(null) }
  // formas de pagamento usadas no mês, com os outros filtros aplicados (tipo, banco, categoria, dia e busca), menos a própria forma;
  // entrou e saiu ficam separados para não somar um com o outro
  const formasDoMes = useMemo(() => {
    const m = new Map<FormaPagamento | 'sem', { entrou: number; saiu: number }>()
    for (const l of origem) {
      if (tipo !== 'todos' && l.tipo !== tipo) continue
      if (banco !== 'todos' && (banco === 'sem' ? l.banco_id : l.banco_id !== banco)) continue
      if (!daCategoria(l) || (dia && l.data !== dia)) continue
      if (casa && !casa(l, textoDe(l))) continue
      if (ehGuardado(l)) continue
      const f = formaDe(l) ?? 'sem'
      const g = m.get(f) ?? { entrou: 0, saiu: 0 }
      if (l.tipo === 'entrada') g.entrou += l.valor
      else g.saiu += l.valor
      m.set(f, g)
    }
    return m
  }, [origem, tipo, banco, categoria, dia, casa, c.categorias, c.d.bancos, c.d.dividas, c.cartoes.cartoes]) // eslint-disable-line react-hooks/exhaustive-deps
  /** "− R$ 120,00", "+ R$ 50,00" ou os dois, conforme o que a forma teve com esses filtros. */
  const valorDaForma = (f: FormaPagamento | 'sem') => {
    const g = formasDoMes.get(f)
    const partes = [g && g.saiu > 0 && `− ${fmtValor(g.saiu)}`, g && g.entrou > 0 && `+ ${fmtValor(g.entrou)}`].filter(Boolean)
    return partes.length ? partes.join(' · ') : fmtValor(0)
  }
  const bancoDe = (l: Lancamento) => (c.v.bancos ? c.d.bancos.find((b) => b.id === l.banco_id) : undefined)
  const cartaoDe = (l: Lancamento) => (l.cartao_id ? c.cartoes.cartoes.find((k) => k.id === l.cartao_id) : undefined)

  const totalChips = chips.reduce((a, k) => a + k.total, 0)
  const chipsVisiveis = todasCategorias || chips.length <= 6 ? chips : chips.slice(0, 5)
  const comBancos = c.v.bancos && c.d.bancos.length > 0
  const comFormas = formasDoMes.size > 1 || forma !== 'todos'
  const parteSaiu = entrou > 0 ? Math.min(1, saiu / entrou) : saiu > 0 ? 1 : 0
  const nivel = c.perfil.detalhe
  return {
    tipo, setTipo, banco, setBanco, forma, setForma, categoria, dia, setCategoria, setDia, ordem, setOrdem, todasCategorias, setTodasCategorias, busca, setBusca, hoje, pesquisando, origem, temNoMes, previstos, comCalendario, noCartao, comprasNoCartao, totalNoCartao, base, semDia, filtrados, grupos, tipoChips, chips, entrou, saiu, filtrando, limpar, formasDoMes, valorDaForma, bancoDe, cartaoDe, totalChips, chipsVisiveis, comBancos, comFormas, parteSaiu, nivel,
  }
}

export type LancamentosFiltrados = ReturnType<typeof useLancamentosFiltrados>
