/**
 * O consultor na hora da decisão: o que ele diz ANTES de a pessoa confirmar uma compra parcelada, uma dívida nova, pular uma
 * compra para a próxima fatura, pagar só parte da fatura ou anotar mais uma promessa de pagamento. Puro: recebe a análise
 * (lib/analise.ts) e o que está sendo decidido, e devolve uma frase curta (ou null quando não há nada a dizer).
 *
 * O fato vem sempre; o "chamado" no fim segue a firmeza que a pessoa escolheu (gentil, direto ou sem filtro).
 */
import type { Analise } from './analise'
import { avaliarParcelaNova } from './decisoes/parcelaNova'
import { somaMesesData } from './dividas'
import { fmtDataCurta, fmtValor, MESES_NOME } from './format'
import { chamar, emDiasDeRenda } from './sinais'
import { tx } from './textos'

export interface FalaNaHora {
  tom: 'bom' | 'medio' | 'ruim'
  texto: string
}

/** Juros do rotativo do cartão para a estimativa (os bancos cobram, em média, bem mais de 10% ao mês). */
export const ROTATIVO_MES = 0.12

const chave = (ano: number, mes: number) => ano * 12 + (mes - 1)
const nomeMes = (mes: number) => MESES_NOME[mes - 1].toLowerCase()

/**
 * Uma compra parcelada no cartão (as parcelas que vão ser gravadas) ou uma dívida nova com parcela: quantas parcelas vão
 * estar correndo e quanto do que entra no mês mais pesado já sai para elas, com esta.
 */
export function naHoraDeParcelar(a: Analise, novas: { ano: number; mes: number; valor: number; data?: string }[]): FalaNaHora | null {
  if (novas.length < 2 && !a.compromisso.atrasadas.length) return null
  // além do peso na renda, o calendário: com as parcelas nas datas delas, alguma conta passa a atrasar até o fim do mês que vem?
  const comData = novas.filter((p): p is typeof p & { data: string } => Boolean(p.data))
  const cal = a.entradaDoPlano && comData.length >= 2 ? avaliarParcelaNova(a.entradaDoPlano, comData.map((p) => ({ data: p.data, valor: p.valor }))) : null
  const f = a.firmeza
  const porMes = new Map(a.compromisso.meses.map((m) => [chave(m.ano, m.mes), m.valor]))
  for (const p of novas) {
    const k = chave(p.ano, p.mes)
    if (porMes.has(k)) porMes.set(k, (porMes.get(k) ?? 0) + p.valor)
  }
  // o mês mais pesado dos próximos 6, já com esta compra
  let pior: { ano: number; mes: number; valor: number } | null = null
  for (const m of a.compromisso.meses) {
    const v = porMes.get(chave(m.ano, m.mes)) ?? 0
    if (!pior || v > pior.valor) pior = { ano: m.ano, mes: m.mes, valor: v }
  }
  const n = a.compromisso.parcelasAtivas + (novas.length >= 2 ? 1 : 0)
  const partes: string[] = []
  if (novas.length >= 2) partes.push(n === 1 ? tx('Vai ser sua primeira parcela correndo.') : tx('Vai ser a sua {0}ª parcela correndo ao mesmo tempo.', n))
  const pct = a.renda > 0 && pior ? Math.round((pior.valor / a.renda) * 100) : null
  if (pct !== null && pior && pior.valor > 0) partes.push(tx('Em {0}, {1}% do que entra já sai para parcelas ({2}).', nomeMes(pior.mes), pct, fmtValor(pior.valor)))
  const atrasada = a.compromisso.atrasadas[0]
  if (atrasada) partes.push(tx('Atenção: "{0}" está em atraso ({1}).', atrasada.descricao, fmtValor(atrasada.valor)))
  const fim = a.entradaDoPlano?.fim
  const quebra = Boolean(cal && (cal.novasAtrasadas.length || cal.faltaDepois >= 1))
  if (cal && fim) {
    const outras = cal.novasAtrasadas.filter((x) => x !== tx('Compra nova'))
    if (outras.length) {
      partes.push(outras.length === 1
        ? tx('Pelo seu calendário até {0}, com esta compra {1} atrasa.', fmtDataCurta(fim), outras[0])
        : tx('Pelo seu calendário até {0}, com esta compra {1} atrasam.', fmtDataCurta(fim), outras.slice(0, 2).join(', ')))
    } else if (cal.novasAtrasadas.length) {
      partes.push(tx('Pelo seu calendário até {0}, a fatura com esta parcela não teria dinheiro no vencimento.', fmtDataCurta(fim)))
    } else if (cal.faltaDepois >= 1) {
      partes.push(tx('Pelo que já está marcado, nada atrasa até {0}, mas a compra tira {1} do que precisa sobrar para o essencial depois disso.', fmtDataCurta(fim), fmtValor(cal.faltaDepois)))
    } else if (cal.cabePorMes !== null) {
      partes.push(a.entradaDoPlano?.semComprasFuturasDoCartao
        ? tx('Pelo que já está marcado até {0}, nenhuma conta atrasa com esta compra (caberia até {1} por mês). Isso não conta as compras que você ainda vai fazer no cartão.', fmtDataCurta(fim), fmtValor(cal.cabePorMes))
        : tx('Pelo que já está marcado até {0}, nenhuma conta atrasa com esta compra (caberia até {1} por mês).', fmtDataCurta(fim), fmtValor(cal.cabePorMes)))
    }
  }
  if (!partes.length) return null
  const pesado = (pct ?? 0) >= 30 || Boolean(atrasada) || quebra
  if (pesado) {
    partes.push(chamar(f, tx('Se der para esperar, espere.'), tx('Pense duas vezes: isso sai de um dinheiro que ainda nem chegou.'), tx('Sério que vai parcelar mais? Segura essa.')))
  }
  return { tom: atrasada || (pct ?? 0) >= 50 || Boolean(cal?.novasAtrasadas.length) ? 'ruim' : pesado ? 'medio' : 'bom', texto: partes.join(' ') }
}

/** Uma dívida nova (empréstimo, acordo, crédito de loja): o que já está aberto e o peso nos próximos meses. */
export function naHoraDaDividaNova(a: Analise, parcela: number | null, parcelas: number | null, primeira: string | null): FalaNaHora | null {
  const novas = parcela && parcelas && parcelas > 1 && primeira
    ? Array.from({ length: Math.min(parcelas, 6) }, (_, i) => {
      const k = chave(Number(primeira.slice(0, 4)), Number(primeira.slice(5, 7))) + i
      return { ano: Math.floor(k / 12), mes: (k % 12) + 1, valor: parcela, data: somaMesesData(primeira, i) }
    })
    : []
  const total = a.dividas?.total ?? 0
  const fala = naHoraDeParcelar(a, novas.length >= 2 ? novas : [])
  const antes = total > 0 ? tx('Você já deve {0} em outras dívidas.', fmtValor(total)) : null
  if (!fala && !antes) return null
  return { tom: fala?.tom ?? 'medio', texto: [antes, fala?.texto].filter(Boolean).join(' ') }
}

/** Pular compras para a fatura seguinte: quanto a próxima fatura já nasce mais pesada, traduzido. */
export function naHoraDePular(a: Analise, total: number, nomeProx: string, jaPuladas: number): FalaNaHora | null {
  if (!(total > 0)) return null
  const dias = emDiasDeRenda(total, a.renda)
  const partes = [dias
    ? tx('A fatura de {0} já nasce {1} mais pesada ({2}).', nomeProx, fmtValor(total), dias)
    : tx('A fatura de {0} já nasce {1} mais pesada.', nomeProx, fmtValor(total))]
  if (jaPuladas > 0) partes.push(jaPuladas === 1 ? tx('Já tem 1 compra empurrada desta fatura.') : tx('Já são {0} compras empurradas desta fatura.', jaPuladas))
  partes.push(chamar(a.firmeza, tx('Vale separar esse valor desde já.'), tx('Separe esse dinheiro agora, senão ele some até lá.'), tx('Empurrar conta não paga conta.')))
  return { tom: jaPuladas > 0 ? 'ruim' : 'medio', texto: partes.join(' ') }
}

/** Pagar só parte da fatura: o resto entra no rotativo. Quanto isso custa, mais ou menos, em 30 dias. */
export function naHoraDePagarParte(a: Analise, resta: number): FalaNaHora | null {
  if (!(resta > 0)) return null
  const custo = Math.round(resta * ROTATIVO_MES * 100) / 100
  return {
    tom: 'ruim',
    texto: `${tx('Os {0} que ficam costumam entrar no rotativo, o juro mais caro do cartão: uns {1} em 30 dias.', fmtValor(resta), fmtValor(custo))} ${chamar(a.firmeza,
      tx('Se não der para pagar tudo, parcelar a fatura costuma sair mais barato.'),
      tx('Se não der para pagar tudo, parcele a fatura: sai mais barato que o rotativo.'),
      tx('Rotativo é o pior negócio do país. Parcela a fatura se não der para pagar inteira.'))}`,
  }
}

/** Mais uma promessa de pagamento: como foram as anteriores. */
export function naHoraDaPromessa(a: Analise, anteriores: { cumpridas: number; falhas: number }, recebe: boolean): FalaNaHora | null {
  const total = anteriores.cumpridas + anteriores.falhas
  if (total < 1 || anteriores.falhas < 1) return null
  if (recebe) {
    return {
      tom: 'medio',
      texto: `${total === 1 ? tx('A promessa anterior não foi cumprida.')
        : anteriores.cumpridas === 0 ? tx('Nenhuma das {0} promessas anteriores foi cumprida.', total)
          : anteriores.cumpridas === 1 ? tx('Das {0} promessas anteriores, só 1 foi cumprida.', total)
            : tx('Das {0} promessas anteriores, {1} foram cumpridas.', total, anteriores.cumpridas)} ${chamar(a.firmeza, tx('Talvez um valor menor ajude.'), tx('Não conte com esse dinheiro até ele cair.'), tx('Só acredito quando cair na conta.'))}`,
    }
  }
  return {
    tom: anteriores.falhas >= 2 ? 'ruim' : 'medio',
    texto: `${anteriores.falhas === 1 ? tx('Uma data anterior não foi cumprida.') : tx('{0} datas anteriores não foram cumpridas.', anteriores.falhas)} ${chamar(a.firmeza,
      tx('Escolha uma data que dê mesmo, nem que seja mais longe.'),
      tx('Escolha uma data que você consegue cumprir. Cada remarcada soma juros.'),
      tx('Promessa que não se cumpre vira juros. Escolhe uma data de verdade.'))}`,
  }
}
