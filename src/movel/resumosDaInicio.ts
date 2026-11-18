/**
 * O que a Início mostra no alto, igual no celular e no computador: os resumos (o que sobrou no mês, o guardado, as
 * dívidas e os investimentos, cada um com o seu tom de cor), as ações (Gasto, Entrada, Contas e Cartões) e as dicas.
 * O celular põe os resumos no topo que desliza; o computador, lado a lado na faixa do topo.
 */
import { fmtValor } from '../lib/format'
import { totalGuardado } from '../lib/guardado'
import { tx } from '../lib/textos'
import type { MesDaInicio } from '../lib/useMesDaInicio'
import type { Ctx } from '../pages/contexto'
import type { Acao, Dica, PaginaDoHero } from './primitivas'

/** Uma página por resumo, só dos módulos ligados (dívidas: só com algo a pagar; investimentos: só com carteira). */
export function resumosDaInicio(c: Ctx, m: MesDaInicio, aoEntender: () => void): PaginaDoHero[] {
  const { v, r } = c
  const { ddMes, composicao, situacao, momento, nomeMes } = m
  const paginas: PaginaDoHero[] = []
  const temPrevisao = ddMes.vaiEntrar > 0 || ddMes.vaiSair > 0
  if (momento === 'futuro') {
    paginas.push({
      id: 'sobra', tom: composicao.resultado < 0 ? 'falta' : 'sobra', rotulo: tx('Previsto para {0}', nomeMes),
      valor: fmtValor(composicao.resultado), numero: composicao.resultado,
      sub: temPrevisao ? tx('Vai entrar {0} · vai sair {1}', fmtValor(ddMes.vaiEntrar), fmtValor(ddMes.vaiSair)) : tx('Nada previsto ainda.'),
      pilula: temPrevisao ? { texto: tx('Entender a conta'), acao: aoEntender } : undefined,
    })
  } else {
    const resultado = situacao.resultado
    const sobrou = resultado >= 0
    const rotulo = momento === 'atual'
      ? (sobrou ? tx('Sobrou em {0} até hoje', nomeMes) : tx('Faltou em {0} até hoje', nomeMes))
      : (sobrou ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes))
    const sub = c.contaNova
      ? tx('Lance o que entrou e o que saiu e o painel se monta sozinho.')
      : momento === 'atual' && temPrevisao
        ? (composicao.resultado >= 0 ? tx('Deve sobrar {0} no fim do mês', fmtValor(composicao.resultado)) : tx('Pode faltar {0} no fim do mês', fmtValor(-composicao.resultado)))
        : tx('Entrou {0} · saiu {1}', fmtValor(ddMes.entrou), fmtValor(ddMes.saiu))
    paginas.push({
      id: 'sobra', tom: !sobrou || situacao.estado === 'critico' ? 'falta' : 'sobra', rotulo, valor: fmtValor(Math.abs(resultado)), numero: Math.abs(resultado), sub,
      pilula: c.contaNova ? undefined : { texto: tx('Entender a conta'), acao: aoEntender },
    })
  }
  if (v.bancos || v.investimentos || v.moedas) {
    const informado = Object.keys(c.mesEf.caixa).length > 0 || r.investimentos > 0 || Object.keys(c.mesEf.moedas ?? {}).length > 0
    const total = totalGuardado({ v, bancos: c.d.bancos, caixa: c.mesEf.caixa, investimentos: r.investimentos, moedas: c.mesEf.moedas, lista: c.perfil.moedas, taxas: c.taxas })
    const nb = c.d.bancos.length
    paginas.push({
      id: 'guardado', tom: 'guardado', rotulo: v.bancos && nb ? (nb === 1 ? tx('Guardado em 1 banco') : tx('Guardado em {0} bancos', nb)) : tx('Dinheiro guardado'),
      valor: fmtValor(total), numero: total, sub: informado ? undefined : tx('Ainda não informado'),
      pilula: { texto: informado ? tx('Ver o guardado') : tx('Informar saldos'), acao: () => c.irPara('patrimonio') },
    })
  }
  if (v.dividas) {
    const comSaldo = c.situacao.filter((s) => !s.semCotacao)
    const falta = comSaldo.reduce((t, s) => t + s.restanteHoje, 0)
    const registrado = comSaldo.reduce((t, s) => t + s.restante, 0)
    const inicial = comSaldo.reduce((t, s) => t + s.saldoInicial, 0)
    if (falta > 0) {
      const pago = inicial > 0 ? Math.max(0, Math.min(1, (inicial - registrado) / inicial)) : null
      paginas.push({
        id: 'dividas', tom: 'dividas', rotulo: tx('Falta pagar nas dívidas'), valor: fmtValor(falta), numero: falta,
        sub: pago !== null ? tx('{0}% quitado', Math.round(pago * 100)) : undefined,
        pilula: { texto: tx('Ver dívidas'), acao: () => c.irPara('dividas') },
      })
    }
  }
  if (v.investimentos && c.invest.c.valor > 0) {
    const res = c.invest.c.resultado
    paginas.push({
      id: 'invest', tom: 'invest', rotulo: tx('Seus investimentos'), valor: fmtValor(c.invest.c.valor), numero: c.invest.c.valor,
      sub: res >= 0 ? tx('Rendeu {0} até hoje', fmtValor(res)) : tx('Perdeu {0} até hoje', fmtValor(-res)),
      pilula: { texto: tx('Ver carteira'), acao: () => c.irPara('invest') },
    })
  }
  return paginas
}

/** Gasto, Entrada, Contas (ou Importar, sem o módulo de contas) e Cartões (ou Mais, sem o módulo de cartões). */
export function acoesDaInicio(c: Ctx, aoMais: () => void): Acao[] {
  const { v } = c
  return [
    { id: 'gasto', icone: 'desce', rotulo: tx('Gasto'), acao: () => c.novoLancamento('saida'), tour: 'lancar' },
    { id: 'entrada', icone: 'sobe', rotulo: tx('Entrada'), acao: () => c.novoLancamento('entrada') },
    v.contas
      ? { id: 'contas', icone: 'calendario', rotulo: tx('Contas'), acao: () => c.irPara('contas') }
      : { id: 'importar', icone: 'relatorio', rotulo: tx('Importar'), acao: c.importarExtrato },
    // com o módulo de cartões ligado, o atalho é a tela Cartões (importar fica em Lançamentos e na dica do topo)
    v.cartoes
      ? { id: 'cartoes', icone: 'cartao', rotulo: tx('Cartões'), acao: () => c.irPara('cartoes') }
      : { id: 'mais', icone: 'reticencias', rotulo: tx('Mais'), acao: aoMais },
  ]
}

/** O convite para importar (quem tem poucos lançamentos) e a sugestão do momento. */
export function dicasDaInicio(c: Ctx): Dica[] {
  const dicas: Dica[] = []
  if (c.d.lancs.length < 20 && !c.perfil.dispensadas.includes('importar')) {
    dicas.push({
      id: 'importar', icone: 'relatorio', titulo: tx('Traga seus dados de uma vez'), tour: 'importar',
      texto: tx('Importe o extrato do banco ou uma planilha e o app lança tudo para você.'),
      botao: { texto: tx('Importar extrato'), acao: c.importarExtrato }, aoDispensar: () => c.dispensar('importar'),
    })
  }
  if (c.sugestao) {
    const s = c.sugestao
    dicas.push({ id: s.id, icone: s.icone, titulo: s.titulo, texto: s.texto, botao: { texto: s.botao, acao: () => c.aceitarSugestao(s) }, aoDispensar: () => c.recusarSugestao(s) })
  }
  return dicas
}
