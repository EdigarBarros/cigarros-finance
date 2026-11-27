/**
 * As regras do Cairo que NÃO são fatos: escolhas de produto e parâmetros estatísticos. Cada uma tem id (os `Motivo` citam
 * o id), classe, valor e justificativa. Restrição financeira (fato do contrato, do caixa ou da lei) não mora aqui.
 *
 *  - 'politica': escolha de produto. Quem decide o valor é o dono do OpusCash.
 *  - 'parametro_estatistico': escolha técnica, que a régua (src/cairo/regua) deve calibrar. O valor atual é ponto de
 *    partida declarado, NÃO garantia estatística.
 *
 * As regras da parte de decisão (nível de proteção, horizonte, quando perguntar…) são acrescentadas pelo dono dela.
 */

export type ClasseDaRegra = 'restricao_financeira' | 'declaracao' | 'politica' | 'parametro_estatistico'

export interface Regra<T = number> { id: string; classe: ClasseDaRegra; valor: T; porque: string }

const regra = <T>(id: string, classe: ClasseDaRegra, valor: T, porque: string): Regra<T> => ({ id, classe, valor, porque })

export const REGRAS = {
  /** Um mês com bem menos saídas que o costume está mal lançado: não entra nas médias de gasto. */
  mesParcialFracao: regra('dados.mes-parcial.fracao', 'parametro_estatistico', 0.35,
    'Abaixo de 35% do número de saídas de um mês típico da pessoa, o mês provavelmente não foi todo lançado.'),
  /** Só dá para julgar "poucas saídas" quando o mês típico tem saídas suficientes. */
  mesParcialMinimoTipico: regra('dados.mes-parcial.minimo', 'parametro_estatistico', 4,
    'Com menos de 4 saídas num mês típico, a contagem varia demais para dizer que um mês ficou incompleto.'),
  /**
   * Poucas saídas por tantos meses seguidos até o mês mais recente é nível novo (gastar menos), não registro incompleto.
   * Com 3 meses seguidos assim, em qualquer ponto, também.
   */
  nivelNovoMeses: regra('dados.nivel-novo.meses', 'parametro_estatistico', 2,
    'Um mês baixo sozinho, entre meses normais, costuma ser lançamento que faltou; dois ou mais seguidos até hoje, um jeito novo de gastar.'),
  /** Só pergunta "o mês está completo?" dos meses que mexem nas médias de agora. */
  perguntarMesesRecentes: regra('dados.perguntar.meses-recentes', 'politica', 3,
    'Perguntar de meses antigos cansa e não muda a nota: só os 3 últimos fechados.'),
  /** Mês sem entrada só é "renda zero de verdade" para quem costuma lançar o que recebe. */
  rendaZeroMesesComRenda: regra('dados.renda-zero.meses-com-renda', 'parametro_estatistico', 2,
    'Se a pessoa lançou entradas em pelo menos 2 outros meses da janela, um mês bem registrado sem entrada é mês sem renda.'),
  /** Lançamento feito mais de N dias depois da data dele conta como "lançado depois" na qualidade. */
  lancadoDepoisDias: regra('dados.lancado-depois.dias', 'parametro_estatistico', 3,
    'Até 3 dias de diferença entre a data e o registro é o normal de quem lança no fim de semana.'),
  /** Meia-vida do peso de uma observação (dias): o hábito de 6 meses atrás vale metade do de hoje. */
  meiaVidaDias: regra('aprendizado.meia-vida', 'parametro_estatistico', 180,
    'O hábito muda devagar; 180 dias é o ponto de partida até a régua calibrar.'),
  /** Força da referência: quantas observações a referência "vale" contra o histórico. */
  forcaDaReferencia: regra('aprendizado.forca-referencia', 'parametro_estatistico', 4,
    'Com 4 observações o histórico já pesa metade; com 12, três quartos.'),
  /** Depois de uma mudança de comportamento, quanto pesa o que veio antes. */
  pesoAntesDaQuebra: regra('aprendizado.peso-antes-da-quebra', 'parametro_estatistico', 0.25,
    'O comportamento antigo não some, mas pesa um quarto: pode ser só uma fase.'),
  /** Quanto a diferença de nível precisa passar do ruído para ser chamada de mudança (em desvios do ruído). */
  quebraLimiar: regra('aprendizado.quebra.limiar', 'parametro_estatistico', 3,
    'Diferença de 3 vezes o erro do nível médio: abaixo disso, pode ser só a variação normal da pessoa.'),
  /** Prior da pontualidade de quem te deve: metade das vezes paga no combinado, com a força de 2 observações. */
  pontualidadePrior: regra('aprendizado.pontualidade.prior', 'parametro_estatistico', { media: 0.5, forca: 2 },
    'Sem histórico, nem otimista nem pessimista; com 2 observações, a referência ainda pesa metade.'),
  /** Prior do atraso de renda: cai no dia combinado. */
  atrasoDeRendaPrior: regra('aprendizado.atraso-renda.prior', 'parametro_estatistico', { dias: 0, forca: 3 },
    'A renda combinada costuma cair no dia; 3 meses de histórico pesam tanto quanto a referência.'),
  /** Com menos dias de histórico do dia a dia (já pesados), o Cairo diz que não sabe em vez de inventar um ritmo. */
  diaADiaMinimoDias: regra('aprendizado.dia-a-dia.minimo-dias', 'parametro_estatistico', 14,
    'Duas semanas cobrem cada dia da semana duas vezes; menos que isso, um sábado de festa vira o "normal".'),
  /** Dias depois de uma entrada em que o gasto costuma subir (o "dia do salário"). */
  janelaAposEntrada: regra('aprendizado.pico-apos-entrada.dias', 'parametro_estatistico', 3,
    'O efeito do dinheiro novo na conta costuma durar poucos dias.'),
  /** Prior da chance de uma renda que se repete não vir no mês: 3%, com a força de 3 meses. */
  faltaDeRendaPrior: regra('aprendizado.falta-renda.prior', 'parametro_estatistico', { media: 0.03, forca: 3 },
    'Renda combinada raramente falha; um mês que falhou em 4 já pesa bastante.'),
  /** Quantos cenários o Cairo usa para as faixas das previsões (o gerador aceita qualquer n). */
  cenariosDaPrevisao: regra('previsao.cenarios', 'parametro_estatistico', 400,
    'Com 400 sorteios, p10 e p90 variam menos de 3% de uma rodada para outra nos casos testados.'),
  /** "Me devem" e recebimento incerto nunca contam como dinheiro disponível: entram nos cenários com a chance deles. */
  aReceberNaoEDisponivel: regra('politica.a-receber-nao-disponivel', 'politica', true,
    'Dinheiro prometido não é dinheiro na conta. O planejador decide se a pessoa quer contar com ele.'),
} as const

export type IdRegra = (typeof REGRAS)[keyof typeof REGRAS]['id']
