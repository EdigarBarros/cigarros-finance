/**
 * O analista do Invest: olha a carteira (lib/invest/carteira.ts) e diz o que merece atenção, hoje, para esta pessoa.
 *
 * Cada descoberta é um `Achado` (o mesmo formato das do Consultor, lib/achados.ts), então a tela é montada pelo mesmo
 * compositor (lib/composicao.ts) com os mesmos componentes. Além do título e da frase, toda descoberta daqui traz o
 * `porQue`: o que foi detectado, os números que sustentam, o período, a confiança (preço antigo e pouco histórico baixam)
 * e a fonte. É o que a pessoa lê em "Por que estou vendo isso?".
 *
 * Regras:
 *  - só sai o que os números sustentam (com limite mínimo para não virar ruído);
 *  - nada de recomendar compra ou venda: a descoberta descreve e a pessoa decide;
 *  - o app não deduz quanto risco a pessoa aceita: só compara com o limite que ela mesma informou (`plano.maxRendaVariavel`);
 *  - `forca` junta o peso financeiro (quanto da carteira), a urgência (dias), a qualidade dos dados e o foco declarado.
 *
 * Puro: mesmas entradas, mesmas descobertas.
 */
import type { Achado, PorQue, TemaInvest } from '../achados'
import { fmtDataCurta, fmtMesAno, fmtPct, fmtValor, MESES_CURTO } from '../format'
import { tx } from '../textos'
import { COR } from '../visuais'
import { desempenho, type Carteira, type PontoDaLinha, type Posicao } from './carteira'
import { cdiNoPeriodo, somarDias, somarMeses, type Indices } from './indices'
import { aporteMedio, aportesPorMes, projetar, rendaPassiva } from './plano'
import { COBERTAS_PELO_FGC, LIMITE_FGC, rotuloDoAtivo, type Foco, type Importacao, type Plano } from './tipos'

export interface EntradaDoAnalista {
  c: Carteira
  linha: PontoDaLinha[]
  /** A carteira como estava há 90 dias (null se ainda não existia). */
  antes: Carteira | null
  plano: Plano
  indices?: Indices
  importacoes: Importacao[]
  /** O número de investimentos digitado à mão antes do Invest. */
  legado: { valor: number; ano: number; mes: number } | null
  /** Médias por mês do orçamento (do Consultor), quando há dados: o que entra, o que sai e o que sobra. */
  orcamento: { renda: number; gastos: number; sobra: number } | null
}

/** Para onde cada ação leva (quem mostra a descoberta resolve): uma aba, uma janela ou um ativo. */
export const IR = {
  carteira: 'aba:carteira', plano: 'aba:plano', precos: 'janela:precos', pendencias: 'janela:pendencias', editarPlano: 'janela:plano',
  ativo: (id: string) => `ativo:${id}`,
} as const

const FOCO_SOBE: Record<Foco, Partial<Record<TemaInvest, number>>> = {
  crescer: { carteira: 10, plano: 12 }, renda: { renda: 16 }, liquidez: { prazos: 16 }, acompanhar: {},
}

const peso = (fracao: number, cheio: number) => Math.min(1, Math.max(0, fracao / cheio))
const mesCurto = (m: string) => MESES_CURTO[Number(m.slice(5, 7)) - 1].slice(0, 3)

export function descobertas(e: EntradaDoAnalista): Achado[] {
  const { c, linha, plano } = e
  const lista: Achado[] = []
  if (!c.posicoes.length) return lista
  const hoje = c.hoje
  // quanto dá para confiar nos números de hoje: preço antigo ou ausente baixa a confiança do que depende do valor atual
  const confiancaDoValor: PorQue['confianca'] = c.emDia >= 0.9 ? 'alta' : c.emDia >= 0.6 ? 'media' : 'baixa'
  const ressalvaDoValor = c.emDia >= 0.9 ? undefined : tx('{0} da carteira está com valor antigo ou sem atualização: os números podem estar defasados.', fmtPct(1 - c.emDia))
  const base = (tema: TemaInvest, id: string, forca: number): Pick<Achado, 'id' | 'tema' | 'forca'> => ({ id, tema, forca })
  const porQue = (p: Omit<PorQue, 'atualizadoEm' | 'fonte' | 'confianca' | 'periodo'> & Partial<Pick<PorQue, 'fonte' | 'confianca' | 'periodo'>>): PorQue => ({
    fonte: tx('Suas operações e os valores informados no Invest'), confianca: confiancaDoValor, periodo: tx('Posição de hoje'),
    ...(p.confianca === undefined && ressalvaDoValor ? { ressalva: ressalvaDoValor } : {}), ...p, atualizadoEm: hoje,
  })
  const nomeDe = (p: Posicao) => rotuloDoAtivo(p.ativo)

  // ---------- os dados não fecham ----------
  const vendasMaiores = c.posicoes.filter((p) => p.alertas.includes('venda-maior'))
  if (vendasMaiores.length) {
    const p = vendasMaiores[0]
    lista.push({
      ...base('dados', 'inv-venda-maior', 96), tom: 'ruim',
      titulo: tx('Vendeu mais do que tinha'),
      frase: vendasMaiores.length === 1
        ? tx('{0} tem uma venda maior que a quantidade comprada. Falta alguma compra?', nomeDe(p))
        : tx('{0} ativos têm venda maior que a quantidade comprada.', vendasMaiores.length),
      dado: { forma: 'numero', valor: vendasMaiores.length, formato: 'inteiro', legenda: vendasMaiores.length === 1 ? tx('ativo com operações que não fecham') : tx('ativos com operações que não fecham') },
      porQue: porQue({
        explicacao: tx('Pelas operações cadastradas, em algum momento foi vendido mais do que havia. Quase sempre falta uma compra antiga (ou uma bonificação), ou uma venda entrou duas vezes. Enquanto isso, a quantidade, o custo e o resultado desses ativos não são confiáveis.'),
        dados: vendasMaiores.slice(0, 6).map((x) => ({ rotulo: nomeDe(x), valor: tx('{0} operações', x.operacoes) })),
        confianca: 'alta', periodo: tx('Todas as operações'), acao: { rotulo: tx('Conferir as operações'), ir: IR.ativo(p.ativo.id) },
      }),
    })
  }

  const vencidos = c.abertas.filter((p) => p.alertas.includes('vencido'))
  if (vencidos.length) {
    const p = vencidos[0]
    lista.push({
      ...base('prazos', 'inv-vencido', 90), tom: 'medio', essencial: true,
      titulo: tx('Título vencido na carteira'),
      frase: vencidos.length === 1
        ? tx('{0} venceu em {1}. Registre o vencimento para o saldo ficar certo.', nomeDe(p), fmtDataCurta(p.ativo.vencimento))
        : tx('{0} títulos já venceram e continuam na carteira.', vencidos.length),
      dado: { forma: 'ranking', itens: vencidos.slice(0, 6).map((x) => ({ rotulo: nomeDe(x), valor: x.valorP, cor: COR.divida, nota: fmtDataCurta(x.ativo.vencimento) })) },
      porQue: porQue({
        explicacao: tx('No vencimento, o dinheiro de um título volta para a conta. Aqui ele ainda aparece investido, então o total da carteira (e o do seu patrimônio) pode estar contando um dinheiro que já está na conta.'),
        dados: vencidos.slice(0, 6).map((x) => ({ rotulo: nomeDe(x), valor: `${fmtValor(x.valorP)} · ${fmtDataCurta(x.ativo.vencimento)}` })),
        confianca: 'alta', acao: { rotulo: tx('Registrar o vencimento'), ir: IR.ativo(p.ativo.id) },
      }),
    })
  }

  const pendentes = e.importacoes.reduce((a, i) => a + i.pendentes.length, 0)
  if (pendentes) {
    lista.push({
      ...base('dados', 'inv-pendencias', 72), tom: 'medio',
      titulo: tx('Linhas esperando revisão'),
      frase: pendentes === 1 ? tx('1 linha de um arquivo importado não foi entendida e ficou guardada.') : tx('{0} linhas de arquivos importados não foram entendidas e ficaram guardadas.', pendentes),
      dado: { forma: 'numero', valor: pendentes, formato: 'inteiro', legenda: pendentes === 1 ? tx('linha para revisar') : tx('linhas para revisar') },
      porQue: porQue({
        explicacao: tx('Na importação, o que o app entende entra na carteira e o que ele não entende fica guardado, sem sumir. Enquanto essas linhas não forem resolvidas ou descartadas, pode faltar alguma operação na carteira.'),
        dados: e.importacoes.filter((i) => i.pendentes.length).slice(0, 6).map((i) => ({ rotulo: i.arquivo, valor: tx('{0} pendentes', i.pendentes.length) })),
        confianca: 'alta', periodo: tx('Arquivos importados'), acao: { rotulo: tx('Revisar as linhas'), ir: IR.pendencias },
      }),
    })
  }

  if (!c.abertas.length || c.valor <= 0) return finalizar(lista, plano)

  const antigos = c.abertas.filter((p) => p.avaliacao.situacao !== 'em-dia')
  if (antigos.length && 1 - c.emDia >= 0.1) {
    const maisVelho = [...antigos].sort((a, b) => b.avaliacao.dias - a.avaliacao.dias)[0]
    lista.push({
      ...base('dados', 'inv-precos-antigos', 44 + 36 * peso(1 - c.emDia, 0.6)), tom: 'medio',
      titulo: tx('Valores desatualizados'),
      frase: antigos.length === 1
        ? tx('{0} está com valor de {1} dias atrás: {2} da carteira.', nomeDe(antigos[0]), antigos[0].avaliacao.dias, fmtPct(1 - c.emDia))
        : tx('{0} ativos estão sem valor recente: {1} da carteira.', antigos.length, fmtPct(1 - c.emDia)),
      dado: { forma: 'partes', centro: { valor: fmtPct(c.emDia), rotulo: tx('em dia') }, partes: [
        { rotulo: tx('Em dia'), valor: c.emDia, cor: COR.entrada }, { rotulo: tx('Antigo ou sem valor'), valor: 1 - c.emDia, cor: COR.divida },
      ] },
      porQue: porQue({
        explicacao: tx('O valor de cada ativo vem do último preço ou saldo que alguém informou. O app não busca cotação sozinho nem inventa preço: quando a informação é antiga, ele mostra a última conhecida e avisa. Patrimônio, resultado e rentabilidade ficam tão atuais quanto esses valores.'),
        dados: [...antigos].sort((a, b) => b.valorP - a.valorP).slice(0, 6).map((x) => ({
          rotulo: nomeDe(x), valor: x.avaliacao.situacao === 'sem-preco' ? tx('sem valor informado') : tx('há {0} dias', x.avaliacao.dias),
        })),
        confianca: 'alta', ressalva: undefined, acao: { rotulo: tx('Atualizar os valores'), ir: IR.precos },
        periodo: tx('O mais antigo: {0}', fmtDataCurta(maisVelho.avaliacao.referencia)),
      }),
    })
  }

  // ---------- concentração ----------
  const maior = c.abertas[0]
  if (c.abertas.length >= 2 && maior.participacao >= 0.25) {
    const alto = maior.participacao >= 0.4
    lista.push({
      ...base('risco', 'inv-concentracao-ativo', 52 + 34 * peso(maior.participacao - 0.25, 0.4)), tom: alto ? 'medio' : undefined,
      titulo: tx('Muito num ativo só'),
      frase: tx('{0} é {1} da carteira ({2}).', nomeDe(maior), fmtPct(maior.participacao), fmtValor(maior.valorP)),
      dado: { forma: 'partes', centro: { valor: fmtPct(maior.participacao), rotulo: nomeDe(maior) }, partes: [
        { rotulo: nomeDe(maior), valor: maior.valorP, cor: COR.divida }, { rotulo: tx('O resto da carteira'), valor: c.valor - maior.valorP, cor: COR.caixa },
      ] },
      porQue: porQue({
        explicacao: tx('Quando um único investimento pesa muito, o que acontecer com ele decide o resultado da carteira inteira. Isso pode ser exatamente o que você quer (uma reserva num CDB, por exemplo); a descoberta só mostra o tamanho, e a decisão é sua.'),
        dados: c.abertas.slice(0, 5).map((p) => ({ rotulo: nomeDe(p), valor: `${fmtPct(p.participacao)} · ${fmtValor(p.valorP)}` })),
        acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  const classe = [...c.porClasse].sort((a, b) => b.valor - a.valor)[0]
  if (classe && c.abertas.length >= 2 && classe.fracao >= 0.7) {
    lista.push({
      ...base('risco', 'inv-concentracao-classe', 40 + 22 * peso(classe.fracao - 0.7, 0.3)),
      titulo: tx('Quase tudo num tipo só'),
      frase: tx('{0} da carteira está em {1}.', fmtPct(classe.fracao), classe.rotulo.toLowerCase()),
      dado: { forma: 'partes', centro: { valor: fmtPct(classe.fracao), rotulo: classe.rotulo }, partes: c.porClasse.map((f) => ({ rotulo: f.rotulo, valor: f.valor, cor: f.cor ?? COR.caixa })) },
      porQue: porQue({
        explicacao: tx('A carteira está concentrada num tipo de investimento. Tipos diferentes costumam reagir de formas diferentes ao que acontece na economia; se a concentração é o que você planejou para o seu prazo e objetivo, está tudo certo.'),
        dados: c.porClasse.map((f) => ({ rotulo: f.rotulo, valor: `${fmtPct(f.fracao)} · ${fmtValor(f.valor)}` })),
        acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  if (plano.maxRendaVariavel !== null && c.rendaVariavel * 100 > plano.maxRendaVariavel + 2) {
    lista.push({
      ...base('risco', 'inv-acima-do-limite', 70 + 20 * peso(c.rendaVariavel * 100 - plano.maxRendaVariavel, 30)), tom: 'medio',
      titulo: tx('Acima do seu limite'),
      frase: tx('Renda variável é {0} da carteira. Você disse querer no máximo {1}%.', fmtPct(c.rendaVariavel), plano.maxRendaVariavel),
      dado: { forma: 'progresso', atual: c.rendaVariavel * c.valor, alvo: c.valor, legenda: tx('em renda variável'), junta: false,
        marcos: [{ rotulo: tx('Seu limite'), valor: (plano.maxRendaVariavel / 100) * c.valor }, { rotulo: tx('Carteira'), valor: c.valor }] },
      porQue: porQue({
        explicacao: tx('Você informou no planejamento quanto, no máximo, quer ter em renda variável (ações, fundos imobiliários, ETFs e parecidos). A carteira passou desse limite, seja porque esses ativos subiram, seja pelos últimos aportes. O limite é seu: dá para ajustar a carteira ou o próprio limite.'),
        dados: [
          { rotulo: tx('Em renda variável'), valor: `${fmtPct(c.rendaVariavel)} · ${fmtValor(c.rendaVariavel * c.valor)}` },
          { rotulo: tx('Seu limite'), valor: `${plano.maxRendaVariavel}%` },
        ],
        acao: { rotulo: tx('Rever o limite'), ir: IR.editarPlano },
      }),
    })
  }

  // o limite do fundo garantidor vale por instituição emissora, em reais
  if (c.moeda === 'BRL') {
    const porEmissor = new Map<string, { nome: string; valor: number }>()
    for (const p of c.abertas) {
      if (!COBERTAS_PELO_FGC.has(p.ativo.subclasse ?? '') || p.moeda !== 'BRL') continue
      const nome = (p.ativo.emissor || p.ativo.instituicao || '').trim()
      if (!nome) continue
      const g = porEmissor.get(nome.toLowerCase()) ?? { nome, valor: 0 }
      g.valor += p.valorP
      porEmissor.set(nome.toLowerCase(), g)
    }
    const acima = [...porEmissor.values()].filter((g) => g.valor > LIMITE_FGC).sort((a, b) => b.valor - a.valor)
    if (acima.length) {
      const g = acima[0]
      lista.push({
        ...base('risco', 'inv-fgc', 74), tom: 'medio',
        titulo: tx('Acima da cobertura do FGC'),
        frase: tx('{0} em títulos do {1}: a garantia do FGC vai até {2} por instituição.', fmtValor(g.valor), g.nome, fmtValor(LIMITE_FGC)),
        dado: { forma: 'progresso', atual: g.valor, alvo: g.valor, legenda: tx('no {0}', g.nome), junta: false,
          marcos: [{ rotulo: tx('Coberto pelo FGC'), valor: LIMITE_FGC }, { rotulo: tx('Aplicado'), valor: g.valor }] },
        porQue: porQue({
          explicacao: tx('CDB, LCI, LCA e poupança têm a garantia do Fundo Garantidor de Créditos até R$ 250 mil por pessoa em cada instituição emissora (com um teto global por período). O que passa disso, na mesma instituição, fica sem essa garantia. A conta usa o emissor (ou a instituição) que você informou em cada título.'),
          dados: acima.slice(0, 5).map((x) => ({ rotulo: x.nome, valor: `${fmtValor(x.valor)} (${fmtValor(x.valor - LIMITE_FGC)} ${tx('acima')})` })),
          fonte: tx('Suas operações no Invest e a regra pública do FGC'), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
        }),
      })
    }
  }

  const setor = c.porSetor[0]
  if (setor && c.porSetor.length >= 2 && setor.fracao >= 0.4) {
    lista.push({
      ...base('risco', 'inv-setor', 42 + 24 * peso(setor.fracao - 0.4, 0.4)),
      titulo: tx('Um setor pesa mais'),
      frase: tx('{0} da sua renda variável está em {1}.', fmtPct(setor.fracao), setor.rotulo),
      dado: { forma: 'ranking', itens: c.porSetor.slice(0, 6).map((f) => ({ rotulo: f.rotulo, valor: f.valor, cor: COR.violeta })) },
      porQue: porQue({
        explicacao: tx('Empresas e fundos do mesmo setor costumam subir e cair juntos. A conta usa só os ativos de renda variável em que você informou o setor.'),
        dados: c.porSetor.slice(0, 6).map((f) => ({ rotulo: f.rotulo, valor: `${fmtPct(f.fracao)} · ${fmtValor(f.valor)}` })),
        periodo: tx('Renda variável com setor informado'), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  // ---------- evolução: aporte não é rendimento ----------
  const tudo = desempenho(linha, null)
  if (tudo && c.aportadoLiquido > 0 && linha.length >= 2) {
    const ganho = c.valor - c.aportadoLiquido
    const positivo = ganho >= 0
    if (Math.abs(ganho) >= Math.max(1, c.valor * 0.002)) {
      lista.push({
        ...base('carteira', 'inv-de-onde-veio', 58 + 14 * peso(Math.abs(ganho) / c.valor, 0.3)), tom: positivo ? 'bom' : 'medio',
        titulo: positivo ? tx('Aportes e rendimento') : tx('Vale menos do que você pôs'),
        frase: positivo
          ? tx('Dos {0} de hoje, {1} você aportou e {2} é rendimento.', fmtValor(c.valor), fmtValor(c.aportadoLiquido), fmtValor(ganho))
          : tx('Você pôs {0} e hoje vale {1}: {2} a menos.', fmtValor(c.aportadoLiquido), fmtValor(c.valor), fmtValor(-ganho)),
        dado: positivo
          ? { forma: 'partes', centro: { valor: fmtPct(ganho / c.valor), rotulo: tx('é rendimento') }, partes: [
            { rotulo: tx('Você aportou'), valor: c.aportadoLiquido, cor: COR.caixa }, { rotulo: tx('Rendeu'), valor: ganho, cor: COR.entrada },
          ] }
          : { forma: 'comparacao', antes: { rotulo: tx('Você pôs'), valor: c.aportadoLiquido }, agora: { rotulo: tx('Vale hoje'), valor: c.valor }, subirEBom: true },
        porQue: porQue({
          explicacao: tx('A carteira cresce de dois jeitos: quando você põe dinheiro nela e quando ela rende. Só o segundo é ganho. Aqui os dois aparecem separados: o que você aportou (já descontado o que tirou) e a diferença para o que ela vale hoje. Os proventos pagos em dinheiro não estão nessa diferença: eles já saíram da carteira.'),
          dados: [
            { rotulo: tx('Vale hoje'), valor: fmtValor(c.valor) },
            { rotulo: tx('Aportado (menos o que tirou)'), valor: fmtValor(c.aportadoLiquido) },
            { rotulo: tx('Diferença'), valor: fmtValor(ganho) },
            { rotulo: tx('Proventos recebidos em dinheiro'), valor: fmtValor(c.proventos) },
          ],
          periodo: tx('Desde {0}', fmtDataCurta(tudo.de)), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
        }),
      })
    }
  }

  // ---------- rentabilidade contra o CDI ----------
  const haUmAno = somarMeses(hoje, -12)
  const periodo = desempenho(linha, c.primeiraOperacao && c.primeiraOperacao < haUmAno ? haUmAno : null)
  if (periodo && periodo.rentabilidade !== null && Math.round((new Date(`${periodo.ate}T00:00:00Z`).getTime() - new Date(`${periodo.de}T00:00:00Z`).getTime()) / 86400000) >= 60) {
    const cdi = cdiNoPeriodo(periodo.de, periodo.ate, e.indices)
    const r = periodo.rentabilidade
    const acima = cdi ? r >= cdi.retorno : null
    lista.push({
      ...base('carteira', 'inv-rentabilidade', 54 + (c.emDia < 0.6 ? -14 : 0)), tom: r < 0 ? 'medio' : acima === false ? undefined : 'bom',
      titulo: tx('Quanto a carteira rendeu'),
      frase: cdi
        ? tx('Rendeu {0} desde {1}. No mesmo período, o CDI rendeu {2}.', fmtPct(r), fmtDataCurta(periodo.de), fmtPct(cdi.retorno))
        : tx('Rendeu {0} desde {1}, já descontados os aportes.', fmtPct(r), fmtDataCurta(periodo.de)),
      dado: { forma: 'numero', valor: r, formato: 'pct', legenda: cdi ? tx('de rentabilidade; o CDI rendeu {0}', fmtPct(cdi.retorno)) : tx('de rentabilidade no período') },
      porQue: porQue({
        explicacao: tx('Rentabilidade é o quanto o dinheiro rendeu, não o quanto o saldo cresceu: aporte não conta como ganho. A conta é ponderada pelo tempo: a cada dia em que entrou ou saiu dinheiro, mede o rendimento desde a última vez, tirando o que entrou. Vale o preço ou saldo conhecido em cada dia, então meses sem atualização aparecem "parados" e o ganho deles cai todo no dia da atualização. O CDI é só uma referência de renda fixa, sem imposto dos dois lados.'),
        dados: [
          { rotulo: tx('Rentabilidade (ponderada pelo tempo)'), valor: fmtPct(r) },
          ...(periodo.taxaInterna !== null ? [{ rotulo: tx('Retorno do seu dinheiro (considera quando você aportou)'), valor: fmtPct(periodo.taxaInterna) }] : []),
          ...(cdi ? [{ rotulo: cdi.completo ? tx('CDI no período') : tx('CDI até {0}', fmtDataCurta(cdi.ate)), valor: fmtPct(cdi.retorno) }] : []),
          { rotulo: tx('Ganho em dinheiro'), valor: fmtValor(periodo.ganho) },
          { rotulo: tx('Aportes no período'), valor: fmtValor(periodo.aportes) },
        ],
        periodo: tx('De {0} a {1}', fmtDataCurta(periodo.de), fmtDataCurta(periodo.ate)),
        fonte: cdi ? tx('Suas operações no Invest e o CDI do Banco Central') : tx('Suas operações e os valores informados no Invest'),
      }),
    })
  }

  // ---------- vencimentos ----------
  const proximos = c.vencimentos.filter((v) => v.dias <= 90)
  if (proximos.length) {
    const v = proximos[0]
    const total = proximos.reduce((a, x) => a + x.valor, 0)
    lista.push({
      ...base('prazos', 'inv-vencimentos', 56 + 30 * peso(90 - v.dias, 90) + 8 * peso(total / c.valor, 0.3)), tom: v.dias <= 30 ? 'medio' : undefined, essencial: v.dias <= 7,
      titulo: tx('Vencimento chegando'),
      frase: proximos.length === 1
        ? v.dias === 0 ? tx('{0} vence hoje: {1} voltam para a conta.', rotuloDoAtivo(v.ativo), fmtValor(v.valor))
          : tx('{0} vence em {1} dias ({2}): {3} voltam para a conta.', rotuloDoAtivo(v.ativo), v.dias, fmtDataCurta(v.data), fmtValor(v.valor))
        : tx('{0} vencem em até 90 dias, em {1} títulos. O primeiro: {2}.', fmtValor(total), proximos.length, fmtDataCurta(v.data)),
      dado: { forma: 'ranking', itens: proximos.slice(0, 6).map((x) => ({ rotulo: rotuloDoAtivo(x.ativo), valor: x.valor, cor: x.dias <= 30 ? COR.divida : COR.caixa, nota: fmtDataCurta(x.data) })) },
      porQue: porQue({
        explicacao: tx('No vencimento o dinheiro volta para a conta e para de render do jeito que rendia. Saber antes dá tempo de decidir o destino dele, em vez de deixá-lo parado.'),
        dados: proximos.slice(0, 8).map((x) => ({ rotulo: rotuloDoAtivo(x.ativo), valor: `${fmtDataCurta(x.data)} · ${fmtValor(x.valor)}` })),
        periodo: tx('Próximos 90 dias'), acao: { rotulo: tx('Ver os títulos'), ir: IR.carteira },
      }),
    })
  }

  // ---------- liquidez ----------
  if (c.porLiquidez.length) {
    const diaria = c.porLiquidez.find((f) => f.id === 'diaria')?.valor ?? 0
    const semData = c.porLiquidez.find((f) => f.id === 'sem-data')?.valor ?? 0
    const meses = e.orcamento && e.orcamento.gastos > 0 ? diaria / e.orcamento.gastos : null
    const cores: Record<string, string> = { diaria: COR.entrada, ate30: COR.caixa, ate365: COR.violeta, longo: COR.divida, 'sem-data': COR.neutro }
    lista.push({
      ...base('prazos', 'inv-liquidez', 40 + (meses !== null && meses < 3 ? 16 : 0)),
      titulo: tx('Em quanto tempo vira dinheiro'),
      frase: meses !== null
        ? tx('{0} dá para resgatar a qualquer hora: cobre {1} meses dos seus gastos.', fmtValor(diaria), meses.toFixed(1).replace('.', ','))
        : tx('{0} da carteira dá para resgatar a qualquer hora.', fmtPct(diaria / c.valor)),
      dado: { forma: 'partes', centro: { valor: fmtPct(diaria / c.valor), rotulo: tx('a qualquer hora') }, partes: c.porLiquidez.map((f) => ({ rotulo: f.rotulo, valor: f.valor, cor: cores[f.id] ?? COR.neutro })) },
      porQue: porQue({
        explicacao: tx('Liquidez é a rapidez com que um investimento vira dinheiro na conta. O que se negocia na bolsa conta como resgate rápido (mas o preço do dia pode ser ruim para vender); nos títulos, vale o que você informou: liquidez diária, só no vencimento ou um prazo depois do pedido.'),
        dados: [
          ...c.porLiquidez.map((f) => ({ rotulo: f.rotulo, valor: `${fmtPct(f.fracao)} · ${fmtValor(f.valor)}` })),
          ...(e.orcamento && e.orcamento.gastos > 0 ? [{ rotulo: tx('Seus gastos por mês (média)'), valor: fmtValor(e.orcamento.gastos) }] : []),
        ],
        ...(semData > 0 ? { confianca: 'media' as const, ressalva: tx('{0} está em investimentos sem liquidez nem vencimento informados.', fmtValor(semData)) } : {}),
        acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  // ---------- proventos ----------
  const meses = c.proventosPorMes
  const fechados = meses.slice(0, -1)
  const doze = meses.slice(-12).reduce((a, m) => a + m.valor, 0)
  if (doze > 0) {
    const tres = fechados.slice(-3).reduce((a, m) => a + m.valor, 0)
    const tresAntes = fechados.slice(-6, -3).reduce((a, m) => a + m.valor, 0)
    const variou = tresAntes > 0 && tres > 0 ? tres / tresAntes - 1 : null
    const renda = rendaPassiva(doze, c.valor, plano.rendaAlvo)
    if (variou !== null && Math.abs(variou) >= 0.15) {
      lista.push({
        ...base('renda', 'inv-proventos-tendencia', 46 + 22 * peso(Math.abs(variou), 0.6)), tom: variou > 0 ? 'bom' : 'medio',
        titulo: variou > 0 ? tx('Proventos em alta') : tx('Proventos em queda'),
        frase: variou > 0
          ? tx('Nos últimos 3 meses você recebeu {0}: {1} a mais que nos 3 anteriores.', fmtValor(tres), fmtPct(variou))
          : tx('Nos últimos 3 meses você recebeu {0}: {1} a menos que nos 3 anteriores.', fmtValor(tres), fmtPct(-variou)),
        dado: { forma: 'serie', pontos: meses.slice(-12).map((m) => ({ rotulo: mesCurto(m.mes), valor: m.valor })), continua: false },
        porQue: porQue({
          explicacao: tx('Compara o que entrou de dividendos, rendimentos e juros nos três últimos meses fechados com os três anteriores. Proventos variam com o calendário de cada empresa e fundo: um trimestre não faz tendência sozinho, mas mostra a direção.'),
          dados: [
            { rotulo: tx('Últimos 3 meses'), valor: fmtValor(tres) }, { rotulo: tx('3 meses anteriores'), valor: fmtValor(tresAntes) },
            { rotulo: tx('Em 12 meses'), valor: fmtValor(doze) },
          ],
          confianca: 'alta', periodo: tx('Últimos 6 meses fechados'),
        }),
      })
    }
    lista.push({
      ...base('renda', 'inv-proventos', 42 + 10 * peso(doze / c.valor, 0.08)), tom: 'bom',
      titulo: tx('O que a carteira já paga'),
      frase: tx('Em 12 meses: {0} em proventos e juros, cerca de {1} por mês.', fmtValor(doze), fmtValor(renda.mediaMensal)),
      dado: { forma: 'numero', valor: doze, formato: 'dinheiro', legenda: tx('recebidos em 12 meses'), historia: meses.slice(-8).map((m) => ({ rotulo: mesCurto(m.mes), valor: m.valor })) },
      porQue: porQue({
        explicacao: tx('Soma os proventos (dividendos, juros sobre capital e rendimentos) e os juros recebidos em dinheiro nos últimos 12 meses, já sem o imposto retido que você informou. É renda que saiu da carteira para a sua conta: se você reinvestiu, o valor voltou como uma nova compra, e não é contado duas vezes.'),
        dados: [
          { rotulo: tx('Recebido em 12 meses'), valor: fmtValor(doze) }, { rotulo: tx('Média por mês'), valor: fmtValor(renda.mediaMensal) },
          ...(renda.retornoEmProventos !== null ? [{ rotulo: tx('Sobre o valor da carteira hoje'), valor: tx('{0} ao ano', fmtPct(renda.retornoEmProventos)) }] : []),
        ],
        confianca: 'alta', periodo: tx('Últimos 12 meses'), acao: { rotulo: tx('Ver o planejamento'), ir: IR.plano },
      }),
    })
    if (plano.rendaAlvo && renda.progresso !== null) {
      lista.push({
        ...base('plano', 'inv-renda-alvo', 48 + 12 * renda.progresso), tom: renda.progresso >= 1 ? 'bom' : undefined,
        titulo: tx('Sua renda dos investimentos'),
        frase: tx('A carteira paga em média {0} por mês: {1} dos {2} que você quer.', fmtValor(renda.mediaMensal), fmtPct(renda.progresso), fmtValor(plano.rendaAlvo)),
        dado: { forma: 'progresso', atual: renda.mediaMensal, alvo: plano.rendaAlvo, legenda: tx('por mês, em média'), junta: true, marcos: [{ rotulo: tx('Sua meta de renda'), valor: plano.rendaAlvo }] },
        porQue: porQue({
          explicacao: tx('Compara a média mensal do que a carteira pagou nos últimos 12 meses com a renda mensal que você definiu no planejamento. A projeção do patrimônio necessário supõe que o retorno em proventos continue como foi nos últimos 12 meses, o que não é garantido.'),
          dados: [
            { rotulo: tx('Média por mês (12 meses)'), valor: fmtValor(renda.mediaMensal) }, { rotulo: tx('Renda que você quer'), valor: fmtValor(plano.rendaAlvo) },
            ...(renda.patrimonioParaOAlvo !== null ? [{ rotulo: tx('Patrimônio para isso, no retorno de hoje'), valor: fmtValor(renda.patrimonioParaOAlvo) }] : []),
          ],
          confianca: 'media', ressalva: tx('É uma conta com o que já aconteceu: proventos futuros podem ser maiores ou menores.'), periodo: tx('Últimos 12 meses'),
          acao: { rotulo: tx('Ver o planejamento'), ir: IR.plano },
        }),
      })
    }
  }

  // ---------- outras moedas ----------
  const fora = c.porMoeda.filter((f) => f.id !== c.moeda)
  const fracaoFora = fora.reduce((a, f) => a + f.fracao, 0)
  if (fracaoFora >= 0.05) {
    lista.push({
      ...base('risco', 'inv-cambio', 38 + 20 * peso(fracaoFora, 0.5)),
      titulo: tx('Parte em outra moeda'),
      frase: Math.abs(c.cambial) >= 1
        ? c.cambial > 0
          ? tx('{0} da carteira está em outras moedas. O câmbio já somou {1} ao resultado.', fmtPct(fracaoFora), fmtValor(c.cambial))
          : tx('{0} da carteira está em outras moedas. O câmbio já tirou {1} do resultado.', fmtPct(fracaoFora), fmtValor(-c.cambial))
        : tx('{0} da carteira está em outras moedas.', fmtPct(fracaoFora)),
      dado: { forma: 'partes', centro: { valor: fmtPct(fracaoFora), rotulo: tx('em outras moedas') }, partes: c.porMoeda.map((f, i) => ({ rotulo: f.rotulo, valor: f.valor, cor: f.id === c.moeda ? COR.caixa : [COR.entrada, COR.violeta, COR.divida][i % 3] })) },
      porQue: porQue({
        explicacao: tx('O valor desses investimentos na sua moeda muda com a cotação, mesmo que o ativo fique parado. O resultado separa as duas coisas: quanto o ativo rendeu na moeda dele e quanto veio só do câmbio (a diferença entre a cotação de hoje e a de cada compra). Operações sem cotação informada usam a cotação de hoje, e o câmbio delas fica zerado.'),
        dados: [
          ...c.porMoeda.map((f) => ({ rotulo: f.rotulo, valor: `${fmtPct(f.fracao)} · ${fmtValor(f.valor)}` })),
          { rotulo: tx('Resultado só do câmbio'), valor: fmtValor(c.cambial) },
        ],
        fonte: tx('Suas operações no Invest e a cotação do dia'), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  // ---------- a composição mudou ----------
  if (e.antes && e.antes.valor > 0) {
    const antes = new Map(e.antes.porClasse.map((f) => [f.id, f]))
    const mudancas = [...new Set([...c.porClasse.map((f) => f.id), ...antes.keys()])].map((id) => {
      const agora = c.porClasse.find((f) => f.id === id)
      return { id, rotulo: agora?.rotulo ?? antes.get(id)!.rotulo, de: antes.get(id)?.fracao ?? 0, para: agora?.fracao ?? 0, valorAntes: antes.get(id)?.valor ?? 0, valorAgora: agora?.valor ?? 0 }
    }).filter((m) => Math.abs(m.para - m.de) >= 0.05).sort((a, b) => Math.abs(b.para - b.de) - Math.abs(a.para - a.de))
    if (mudancas.length) {
      const m = mudancas[0]
      lista.push({
        ...base('carteira', 'inv-composicao-mudou', 44 + 26 * peso(Math.abs(m.para - m.de), 0.3)),
        titulo: tx('A carteira mudou de cara'),
        frase: tx('{0} foi de {1} para {2} da carteira em 90 dias.', m.rotulo, fmtPct(m.de), fmtPct(m.para)),
        dado: { forma: 'pares', itens: mudancas.slice(0, 5).map((x) => ({ rotulo: x.rotulo, icone: '', antes: x.valorAntes, agora: x.valorAgora })) },
        porQue: porQue({
          explicacao: tx('Compara a divisão da carteira por tipo de investimento hoje com a de 90 dias atrás. A fatia de um tipo muda quando você aporta ou resgata nele, e também quando ele rende mais ou menos que o resto.'),
          dados: mudancas.slice(0, 6).map((x) => ({ rotulo: x.rotulo, valor: `${fmtPct(x.de)} → ${fmtPct(x.para)}` })),
          periodo: tx('De {0} a {1}', fmtDataCurta(e.antes.hoje), fmtDataCurta(hoje)), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
        }),
      })
    }
  }

  // ---------- aportes ----------
  const aportes = aportesPorMes(linha, hoje, 12)
  const media = aporteMedio(linha, hoje)
  const seis = aportes.slice(-7, -1)
  const comAporte = seis.filter((m) => m.valor > 0).length
  if (linha.length >= 2 && c.primeiraOperacao && c.primeiraOperacao < somarMeses(hoje, -2)) {
    const planejado = plano.aporteMensal
    const esteMes = aportes[aportes.length - 1].valor
    const abaixo = planejado !== null && media < planejado * 0.9
    lista.push({
      ...base('plano', 'inv-aportes', 40 + (planejado ? 14 : 0) + (abaixo ? 10 : 0)), tom: planejado ? (abaixo ? 'medio' : 'bom') : undefined,
      titulo: planejado ? (abaixo ? tx('Aportes abaixo do plano') : tx('Aportes no ritmo do plano')) : tx('Seu ritmo de aportes'),
      frase: planejado
        ? tx('Você tem aportado {0} por mês. O plano é {1}.', fmtValor(media), fmtValor(planejado))
        : tx('Você aportou em {0} dos últimos 6 meses: {1} por mês, em média.', comAporte, fmtValor(media)),
      dado: { forma: 'serie', pontos: aportes.map((m) => ({ rotulo: mesCurto(m.mes), valor: m.valor })), continua: false },
      porQue: porQue({
        explicacao: tx('Aporte é dinheiro novo entrando na carteira: compras e aplicações, menos vendas e resgates. A média olha os últimos meses fechados e deixa de fora o mês em que a carteira foi cadastrada, que costuma trazer tudo de uma vez.'),
        dados: [
          { rotulo: tx('Média por mês'), valor: fmtValor(media) }, { rotulo: tx('Meses com aporte (últimos 6)'), valor: tx('{0} de 6', comAporte) },
          { rotulo: tx('Este mês até agora'), valor: fmtValor(esteMes) },
          ...(planejado ? [{ rotulo: tx('Aporte planejado'), valor: fmtValor(planejado) }] : []),
        ],
        confianca: 'alta', periodo: tx('Últimos 12 meses'), acao: { rotulo: planejado ? tx('Ver o planejamento') : tx('Definir um aporte por mês'), ir: planejado ? IR.plano : IR.editarPlano },
      }),
    })
  }

  // o plano pede mais do que sobra no mês (ou sobra bem mais do que vai para os investimentos)
  if (e.orcamento && e.orcamento.renda > 0 && (plano.aporteMensal ?? media) > 0) {
    const aporte = plano.aporteMensal ?? media
    const sobra = e.orcamento.sobra
    if (aporte > Math.max(0, sobra) * 1.1) {
      lista.push({
        ...base('plano', 'inv-aporte-e-sobra', 58), tom: 'medio',
        titulo: tx('O aporte passa da sobra'),
        frase: tx('O aporte é de {0} por mês, mas costuma sobrar {1}.', fmtValor(aporte), fmtValor(Math.max(0, sobra))),
        dado: { forma: 'comparacao', antes: { rotulo: tx('Sobra por mês'), valor: Math.max(0, sobra) }, agora: { rotulo: tx('Aporte por mês'), valor: aporte }, subirEBom: false },
        porQue: porQue({
          explicacao: tx('Pelo seu orçamento no OpusCash (as entradas e saídas lançadas), a sobra média do mês é menor que o aporte. A diferença sai de algum lugar: de dinheiro que já estava guardado, ou de gastos e entradas que não foram lançados.'),
          dados: [
            { rotulo: tx('Entra por mês (média)'), valor: fmtValor(e.orcamento.renda) }, { rotulo: tx('Sai por mês (média)'), valor: fmtValor(e.orcamento.gastos) },
            { rotulo: tx('Sobra'), valor: fmtValor(sobra) }, { rotulo: plano.aporteMensal ? tx('Aporte planejado') : tx('Aporte médio'), valor: fmtValor(aporte) },
          ],
          confianca: 'media', ressalva: tx('Depende de as entradas e saídas do mês estarem lançadas.'), periodo: tx('Média dos últimos meses'),
          fonte: tx('Seus lançamentos no OpusCash e suas operações no Invest'), acao: { rotulo: tx('Ver o planejamento'), ir: IR.plano },
        }),
      })
    }
  }

  // ---------- a meta de patrimônio ----------
  if (plano.metaPatrimonio) {
    const proj = projetar(plano, c.valor, media, hoje)
    const cen = proj.cenarios.find((x) => x.nome === 'base')!
    const p = Math.min(1, c.valor / plano.metaPatrimonio)
    const atrasa = plano.metaPrazo && cen.chegaEm ? cen.chegaEm > plano.metaPrazo : plano.metaPrazo ? cen.chegaEm === null : false
    const quando = (m: string) => fmtMesAno(Number(m.slice(0, 4)), Number(m.slice(5, 7)))
    lista.push({
      ...base('plano', 'inv-meta', 50 + 16 * p + (atrasa ? 10 : 0)), tom: p >= 1 ? 'bom' : atrasa ? 'medio' : undefined,
      titulo: p >= 1 ? tx('Meta de patrimônio batida') : tx('Sua meta de patrimônio'),
      frase: p >= 1
        ? tx('A carteira chegou a {0}, a meta que você definiu.', fmtValor(plano.metaPatrimonio))
        : cen.chegaEm
          ? plano.metaPrazo && atrasa
            ? tx('{0} da meta. Nesse ritmo e rendendo {1}% ao ano, chega em {2}, depois do prazo ({3}).', fmtPct(p), cen.aoAno, quando(cen.chegaEm), quando(plano.metaPrazo))
            : tx('{0} da meta. Nesse ritmo e rendendo {1}% ao ano, chega em {2}.', fmtPct(p), cen.aoAno, quando(cen.chegaEm))
          : tx('{0} da meta de {1}.', fmtPct(p), fmtValor(plano.metaPatrimonio)),
      dado: { forma: 'progresso', atual: c.valor, alvo: plano.metaPatrimonio, legenda: tx('investidos'), junta: true, marcos: [{ rotulo: tx('Meta'), valor: plano.metaPatrimonio }] },
      porQue: porQue({
        explicacao: tx('Mostra o quanto do patrimônio investido que você quer já está na carteira. A data de chegada é uma projeção: usa o aporte por mês e a hipótese de rendimento do cenário base do seu planejamento. Não é promessa: se render menos ou os aportes mudarem, a data muda.'),
        dados: [
          { rotulo: tx('Carteira hoje'), valor: fmtValor(c.valor) }, { rotulo: tx('Meta'), valor: fmtValor(plano.metaPatrimonio) },
          { rotulo: tx('Aporte usado na conta'), valor: tx('{0} por mês', fmtValor(proj.aporte)) },
          { rotulo: tx('Hipótese de rendimento'), valor: tx('{0}% ao ano', cen.aoAno) },
          ...(proj.aporteParaAMeta !== null ? [{ rotulo: tx('Para chegar no prazo'), valor: tx('{0} por mês', fmtValor(proj.aporteParaAMeta)) }] : []),
        ],
        confianca: 'media', ressalva: tx('Projeção com hipóteses: o resultado de verdade pode ser diferente.'), periodo: tx('De hoje até a meta'),
        acao: { rotulo: tx('Ver o planejamento'), ir: IR.plano },
      }),
    })
  }

  // ---------- quem está no prejuízo ----------
  const noVermelho = c.abertas.filter((p) => p.custoP > 0 && p.valorP < p.custoP * 0.95 && p.avaliacao.natureza === 'cotado').sort((a, b) => (a.valorP - a.custoP) - (b.valorP - b.custoP))
  if (noVermelho.length) {
    const p = noVermelho[0]
    lista.push({
      ...base('carteira', 'inv-abaixo-do-custo', 42 + 22 * peso((p.custoP - p.valorP) / c.valor, 0.05)),
      titulo: tx('Valendo menos que o custo'),
      frase: noVermelho.length === 1
        ? tx('{0} vale {1} e custou {2}.', nomeDe(p), fmtValor(p.valorP), fmtValor(p.custoP))
        : tx('{0} ativos valem menos do que custaram. O maior: {1}.', noVermelho.length, nomeDe(p)),
      dado: { forma: 'pares', itens: noVermelho.slice(0, 5).map((x) => ({ rotulo: nomeDe(x), icone: '', antes: x.custoP, agora: x.valorP })) },
      porQue: porQue({
        explicacao: tx('Compara o custo de aquisição do que você ainda tem (custo médio, com as taxas) com o valor pelo último preço conhecido. É uma perda só no papel enquanto você não vende, e não conta os proventos que o ativo já pagou.'),
        dados: noVermelho.slice(0, 6).map((x) => ({ rotulo: nomeDe(x), valor: `${fmtValor(x.custoP)} → ${fmtValor(x.valorP)}` })),
        acao: { rotulo: tx('Ver o ativo'), ir: IR.ativo(p.ativo.id) },
      }),
    })
  }

  // ---------- de onde vem o resultado ----------
  const partes = [
    { rotulo: tx('Valorização do que você tem'), valor: c.naoRealizado, cor: COR.entrada },
    { rotulo: tx('Ganho no que já vendeu'), valor: c.realizado, cor: COR.caixa },
    { rotulo: tx('Proventos e juros'), valor: c.proventos, cor: COR.violeta },
  ].filter((x) => x.valor > 0.5)
  if (partes.length >= 2 && c.resultado > 0) {
    const maiorParte = [...partes].sort((a, b) => b.valor - a.valor)[0]
    lista.push({
      ...base('carteira', 'inv-resultado', 38),
      titulo: tx('De onde vem o seu ganho'),
      frase: tx('Do resultado de {0}, a maior parte é {1}.', fmtValor(c.resultado), maiorParte.rotulo.toLowerCase()),
      dado: { forma: 'partes', centro: { valor: fmtValor(c.resultado), rotulo: tx('resultado') }, partes },
      porQue: porQue({
        explicacao: tx('O resultado de uma carteira tem três partes: o quanto o que você ainda tem vale acima do custo (só vira dinheiro se vender), o que você ganhou ou perdeu no que já vendeu ou resgatou, e os proventos e juros recebidos em dinheiro.'),
        dados: [
          { rotulo: tx('Valorização do que você tem'), valor: fmtValor(c.naoRealizado) }, { rotulo: tx('Ganho no que já vendeu'), valor: fmtValor(c.realizado) },
          { rotulo: tx('Proventos e juros'), valor: fmtValor(c.proventos) }, { rotulo: tx('Resultado total'), valor: fmtValor(c.resultado) },
        ],
        periodo: tx('Desde {0}', fmtDataCurta(c.primeiraOperacao)), acao: { rotulo: tx('Ver a carteira'), ir: IR.carteira },
      }),
    })
  }

  // ---------- estimativas ----------
  const estimado = c.abertas.filter((p) => p.avaliacao.natureza === 'estimado').reduce((a, p) => a + p.valorP, 0)
  if (estimado / c.valor >= 0.3) {
    lista.push({
      ...base('dados', 'inv-estimado', 30),
      titulo: tx('Parte do valor é estimativa'),
      frase: tx('{0} da carteira é estimado pela taxa de cada título, antes do imposto.', fmtPct(estimado / c.valor)),
      dado: { forma: 'partes', centro: { valor: fmtPct(estimado / c.valor), rotulo: tx('estimado') }, partes: [
        { rotulo: tx('Estimado pela taxa'), valor: estimado, cor: COR.violeta }, { rotulo: tx('Preço ou saldo informado'), valor: c.valor - estimado, cor: COR.caixa },
      ] },
      porQue: porQue({
        explicacao: tx('Quando um título tem a taxa informada (prefixado, % do CDI, IPCA+), o app calcula quanto ele rendeu desde a aplicação com os índices oficiais do Banco Central. É uma boa aproximação do valor bruto, mas não é o saldo da corretora: não desconta imposto nem considera a marcação a mercado. Informar o saldo de vez em quando corrige a conta.'),
        dados: c.abertas.filter((p) => p.avaliacao.natureza === 'estimado').slice(0, 6).map((p) => ({ rotulo: nomeDe(p), valor: fmtValor(p.valorP) })),
        confianca: 'media', ressalva: tx('Valores brutos, antes do imposto de renda.'), fonte: tx('Suas operações no Invest e os índices do Banco Central'),
        acao: { rotulo: tx('Informar os saldos'), ir: IR.precos },
      }),
    })
  }

  // ---------- o número antigo ----------
  if (e.legado && c.primeiraOperacao) {
    lista.push({
      ...base('dados', 'inv-legado', 26),
      titulo: tx('Seu valor antigo foi mantido'),
      frase: plano.legado === 'somar'
        ? tx('Os {0} que você informava à mão continuam somados à carteira.', fmtValor(e.legado.valor))
        : tx('Os {0} que você informava à mão ficaram como histórico até {1}.', fmtValor(e.legado.valor), fmtMesAno(Number(c.primeiraOperacao.slice(0, 4)), Number(c.primeiraOperacao.slice(5, 7)))),
      dado: { forma: 'numero', valor: e.legado.valor, formato: 'dinheiro', legenda: tx('informados à mão em {0}', fmtMesAno(e.legado.ano, e.legado.mes)) },
      porQue: porQue({
        explicacao: plano.legado === 'somar'
          ? tx('Antes do Invest, o valor investido era um número só, digitado por mês. Você disse que ele é de investimentos que não estão cadastrados aqui, então o patrimônio soma os dois.')
          : tx('Antes do Invest, o valor investido era um número só, digitado por mês. Ele não foi apagado nem virou um investimento inventado: vale como histórico até o mês anterior à sua primeira operação. A partir daí, o patrimônio usa a carteira, para o mesmo dinheiro não contar duas vezes. Se aquele número é de outros investimentos, dá para somar os dois no planejamento.'),
        dados: [{ rotulo: tx('Último valor digitado'), valor: fmtValor(e.legado.valor) }, { rotulo: tx('Carteira hoje'), valor: fmtValor(c.valor) }],
        confianca: 'alta', periodo: tx('Histórico'), fonte: tx('O que você informava em Dinheiro guardado'), acao: { rotulo: tx('Escolher como contar'), ir: IR.editarPlano },
      }),
    })
  }

  return finalizar(lista, plano)
}

/** Soma o foco declarado e ordena. */
function finalizar(lista: Achado[], plano: Plano): Achado[] {
  if (plano.foco) for (const a of lista) a.forca += FOCO_SOBE[plano.foco][a.tema as TemaInvest] ?? 0
  return lista.sort((a, b) => b.forca - a.forca)
}

/** O dia de 90 dias atrás, para a comparação da composição. */
export const haNoventaDias = (hoje: string) => somarDias(hoje, -90)
