/**
 * Os cartões da Início do celular (a lista e os modelos de cada jeito ficam em lib/widgets.ts). Cada um sabe se tem o que
 * mostrar (`disponivel`) e se desenha com as peças de primitivas.tsx. Os números saem de lib/useMesDaInicio.ts, os mesmos
 * da Início do computador.
 */
import type { ReactNode } from 'react'
import { IconeCategoria } from '../components/IconeCategoria'
import { BancoIcone } from '../components/BancoIcone'
import { caixaDoBanco } from '../lib/calc'
import { calendarioDe } from '../lib/dividas'
import { fatiasDoPeriodo } from '../lib/comparacao'
import { fmtDataCurta, fmtMoeda, fmtValor, MESES_CURTO, noMeioDaFrase } from '../lib/format'
import { pedirCategoriaNosLancamentos } from '../lib/busca'
import { pedirLadoDividas } from '../lib/dividas'
import { tx } from '../lib/textos'
import type { IdWidget } from '../lib/widgets'
import type { MesDaInicio } from '../lib/useMesDaInicio'
import type { Tarefa } from '../lib/paraFazer'
import type { Ctx } from '../pages/contexto'
import type { Modulo } from '../lib/types'
import { CartaoWidget, IconeRedondo, LinhaDeLista } from './primitivas'

export interface Contexto {
  c: Ctx
  m: MesDaInicio
  /** Conta do mês tocada: abre a conferência (valor e dia) antes da baixa. */
  agir: (t: Tarefa) => void
}

interface DefWidget {
  /** Nome, ícone e uma linha sobre o cartão (a folha "Adicionar cartões" e o modo Arrumar mostram). */
  titulo: () => string
  icone: string
  descricao: () => string
  /** O módulo de que o cartão depende: desligado, a folha oferece ligar. */
  modulo?: Modulo
  /** Tem o que mostrar agora (módulo ligado e dados no mês). Sem isso o cartão some, mas guarda o lugar. */
  disponivel: (x: Contexto) => boolean
  Corpo: (x: Contexto) => ReactNode
}

const LIMITE = 4
const corDoEstado = (t: Tarefa) => (t.estado === 'atrasada' ? 'var(--saida)' : t.estado === 'vence_hoje' ? 'var(--divida)' : 'var(--caixa)')
const iconeDaOrigem = (t: Tarefa) => (t.origem === 'fatura' ? 'cartao' : t.origem === 'parcela' ? 'divida' : t.entrada ? 'receber' : 'calendario')
const decorridos = (m: MesDaInicio) => (m.momento === 'atual' ? m.ddMes.hoje : m.momento === 'futuro' ? 0 : m.ddMes.dias)

/** O gasto acumulado dia a dia (linha cheia) e o que ainda deve sair (tracejada). */
function GraficoDoGasto({ m }: { m: MesDaInicio }) {
  const { saiuDia, vaiSairDia, dias, hoje } = m.ddMes
  const ate = Math.max(0, Math.min(dias, hoje))
  const acum: number[] = []
  let t = 0
  for (let i = 0; i < dias; i++) { t += saiuDia[i] ?? 0; acum.push(t) }
  // o que ainda vem parte do acumulado de hoje (o atrasado cai no dia de hoje) e vai somando até o fim do mês
  const previsto: number[] = []
  if (ate > 0 && ate < dias) {
    let p = acum[ate - 1] ?? 0
    previsto.push(p)
    for (let i = ate; i < dias; i++) { p += (vaiSairDia[i] ?? 0) + (i === ate ? vaiSairDia[ate - 1] ?? 0 : 0); previsto.push(p) }
  }
  const max = Math.max(1, acum[dias - 1] ?? 0, previsto[previsto.length - 1] ?? 0)
  const W = 150, H = 92
  const x = (i: number) => (dias <= 1 ? 0 : (i / (dias - 1)) * W)
  const y = (v: number) => H - 4 - (v / max) * (H - 10)
  const feito = acum.slice(0, Math.max(1, ate)).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const vem = previsto.length ? previsto.map((v, k) => `${k ? 'L' : 'M'}${x(ate - 1 + k).toFixed(1)},${y(v).toFixed(1)}`).join('') : ''
  return (
    <svg className="grafico-gasto" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} />)}
      {ate > 0 && <path className="feito" d={feito} />}
      {vem && <path className="vem" d={vem} />}
    </svg>
  )
}

export const WIDGETS: Record<IdWidget, DefWidget> = {
  contas: {
    titulo: () => tx('Contas a pagar'), icone: 'calendario', descricao: () => tx('O que vence no mês, na ordem do vencimento.'), modulo: 'contas',
    disponivel: ({ c, m }) => m.tarefas.lista.length > 0 || c.v.contas,
    Corpo: ({ c, m, agir }) => {
      const lista = m.tarefas.lista
      return (
        <CartaoWidget titulo={tx('Contas a pagar')} aoAbrir={c.v.contas ? () => c.irPara('contas') : undefined}
          rodape={lista.length > LIMITE ? { texto: tx('Ver tudo'), acao: () => c.irPara(c.v.contas ? 'contas' : 'dividas') } : undefined}>
          {lista.length ? lista.slice(0, LIMITE).map((t) => (
            <LinhaDeLista key={t.chave} icone={<IconeRedondo icone={iconeDaOrigem(t)} cor={corDoEstado(t)} />}
              titulo={t.titulo} sub={t.frase} valor={t.valor} tomValor={t.entrada ? 'entrada' : t.estado === 'atrasada' ? 'alerta' : undefined}
              aoTocar={() => agir(t)} />
          )) : <p className="widget-vazio">{tx('Nada para pagar em {0}.', m.nomeMes)}</p>}
        </CartaoWidget>
      )
    },
  },

  'gasto-mes': {
    titulo: () => tx('Gasto do mês'), icone: 'enviar', descricao: () => tx('Quanto saiu e a linha do mês até hoje.'),
    disponivel: ({ c, m }) => !c.contaNova && m.momento !== 'futuro',
    Corpo: ({ c, m }) => (
      <CartaoWidget className="widget-gasto">
        <button className="widget-gasto-corpo" onClick={() => c.irPara('lancamentos')}>
          <span className="widget-gasto-texto">
            <span className="widget-titulo-solto">{m.momento === 'atual' ? tx('Gasto este mês') : tx('Gasto em {0}', m.nomeMes)}</span>
            <b className="widget-numero">{fmtValor(m.ddMes.saiu)}</b>
            <span className="widget-gasto-pe">
              {m.momento === 'atual' && m.ddMes.vaiSair > 0 && <span>{tx('Ainda vai sair {0}', fmtValor(m.ddMes.vaiSair))}</span>}
              {m.pilulaGastos && <span className={`tom-${m.pilulaGastos.tom}`}>{m.pilulaGastos.texto}</span>}
            </span>
          </span>
          <GraficoDoGasto m={m} />
        </button>
      </CartaoWidget>
    ),
  },

  ultimos: {
    titulo: () => tx('Últimos lançamentos'), icone: 'lista', descricao: () => tx('Os lançamentos mais recentes do mês.'),
    disponivel: ({ c }) => !c.contaNova,
    Corpo: ({ c, m }) => {
      const lista = [...c.lancsMes].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')).slice(0, LIMITE)
      return (
        <CartaoWidget titulo={tx('Últimos lançamentos')} aoAbrir={() => c.irPara('lancamentos')}
          rodape={c.lancsMes.length > LIMITE ? { texto: tx('Ver tudo'), acao: () => c.irPara('lancamentos') } : undefined}>
          {lista.length ? lista.map((l) => {
            const cat = c.categoriaDe(l)
            return (
              <LinhaDeLista key={l.id}
                icone={<IconeRedondo cor={cat?.cor ?? (l.tipo === 'entrada' ? 'var(--entrada)' : 'var(--saida)')}>
                  {cat ? <IconeCategoria emoji={cat.icone} tamanho={20} /> : undefined}
                </IconeRedondo>}
                titulo={l.descricao} sub={[l.data ? fmtDataCurta(l.data) : null, cat?.nome].filter(Boolean).join(' · ')}
                valor={l.tipo === 'entrada' ? `+${fmtValor(l.valor)}` : fmtValor(l.valor)} tomValor={l.tipo === 'entrada' ? 'entrada' : undefined}
                aoTocar={() => c.editarLancamento(l)} />
            )
          }) : (
            <div className="widget-vazio">
              <p>{tx('Nada lançado em {0} ainda.', m.nomeMes)}</p>
              <button className="btn primario" onClick={() => c.novoLancamento()}>{tx('Lançar agora')}</button>
            </div>
          )}
        </CartaoWidget>
      )
    },
  },

  categorias: {
    titulo: () => tx('Para onde foi o dinheiro'), icone: 'relatorio', descricao: () => tx('As categorias em que você mais gastou.'),
    disponivel: ({ m }) => Boolean((m.comparacao ?? m.gastosDoPeriodo)?.atual),
    Corpo: ({ c, m }) => {
      const periodo = (m.comparacao ?? m.gastosDoPeriodo)!
      const { principais, demais } = fatiasDoPeriodo(periodo, 4)
      const abrir = (id: string) => { pedirCategoriaNosLancamentos(id || 'sem'); c.irPara('lancamentos') }
      return (
        <CartaoWidget titulo={tx('Para onde foi o dinheiro')} aoAbrir={() => c.irPara('lancamentos')}>
          {principais.map((f) => {
            const cat = c.categorias.find((x) => x.id === f.id)
            return (
              <LinhaDeLista key={f.id || 'sem'}
                icone={<IconeRedondo cor={cat?.cor ?? 'var(--texto-2)'}>{cat ? <IconeCategoria emoji={cat.icone} tamanho={20} /> : undefined}</IconeRedondo>}
                titulo={cat?.nome ?? tx('Sem categoria')} progresso={{ parte: f.parte, cor: cat?.cor }}
                valor={fmtValor(f.valor)} valorSub={`${Math.round(f.parte * 100)}%`} aoTocar={() => abrir(f.id)} />
            )
          })}
          {demais && (
            <p className="widget-nota">{demais.quantas === 1 ? tx('Mais 1 categoria: {0}', fmtValor(demais.valor)) : tx('Mais {0} categorias: {1}', demais.quantas, fmtValor(demais.valor))}</p>
          )}
        </CartaoWidget>
      )
    },
  },

  orientacao: {
    titulo: () => tx('Consultor'), icone: 'bussola', descricao: () => tx('A nota do seu dinheiro e as dicas do momento.'),
    disponivel: ({ c }) => !c.contaNova,
    Corpo: ({ c }) => {
      const { nota, rotulo } = c.analise
      return (
        <CartaoWidget titulo={tx('Consultor')} aoAbrir={() => c.irPara('analise')}>
          {nota !== null && (
            <LinhaDeLista icone={<IconeRedondo icone="bussola" cor="var(--destaque)" />} titulo={tx('Saúde do seu dinheiro')} sub={rotulo}
              valor={`${nota}/100`} aoTocar={() => c.irPara('analise')} />
          )}
          {c.conselhos.slice(0, 2).map((k) => (
            <LinhaDeLista key={k.id} icone={<IconeRedondo icone={k.icone} cor={k.gravidade === 'urgente' ? 'var(--saida)' : k.gravidade === 'atencao' ? 'var(--divida)' : 'var(--entrada)'} />}
              titulo={k.titulo} sub={k.botao} aoTocar={() => c.irPara(k.destino)} />
          ))}
          {!c.conselhos.length && nota === null && (
            <p className="widget-vazio">{c.conselhosSemDados ? tx('Lance mais um mês e o consultor começa a dar dicas.') : tx('Nenhum alerta agora. Seu dinheiro está em ordem.')}</p>
          )}
        </CartaoWidget>
      )
    },
  },

  'entrou-saiu': {
    titulo: () => tx('Entrou e saiu'), icone: 'trocar', descricao: () => tx('Os totais do mês, lado a lado.'),
    disponivel: ({ c }) => !c.contaNova,
    Corpo: ({ c, m }) => (
      <CartaoWidget className="widget-pequeno">
        <button className="widget-pequeno-corpo" onClick={() => c.irPara('lancamentos')}>
          <span className="widget-titulo-solto">{tx('Entrou')}</span>
          <b className="widget-numero entrada">{fmtValor(m.ddMes.entrou)}</b>
          <span className="widget-titulo-solto">{tx('Saiu')}</span>
          <b className="widget-numero saida">{fmtValor(m.ddMes.saiu)}</b>
        </button>
      </CartaoWidget>
    ),
  },

  'gasto-dia': {
    titulo: () => tx('Gasto por dia'), icone: 'relogio', descricao: () => tx('Quanto você gasta, em média, por dia.'),
    disponivel: ({ c, m }) => !c.contaNova && decorridos(m) > 0,
    Corpo: ({ c, m }) => {
      const dias = decorridos(m)
      return (
        <CartaoWidget className="widget-pequeno">
          <button className="widget-pequeno-corpo" onClick={() => c.irPara('lancamentos')}>
            <span className="widget-titulo-solto">{tx('Gasto por dia')}</span>
            <b className="widget-numero">{fmtValor(m.ddMes.saiu / dias)}</b>
            <span className="widget-nota">{dias === 1 ? tx('em 1 dia') : tx('em {0} dias', dias)}</span>
          </button>
        </CartaoWidget>
      )
    },
  },

  nota: {
    titulo: () => tx('Saúde do dinheiro'), icone: 'escudo', descricao: () => tx('A nota de 0 a 100 do consultor.'),
    disponivel: ({ c }) => !c.contaNova && c.analise.nota !== null,
    Corpo: ({ c }) => (
      <CartaoWidget className="widget-pequeno">
        <button className="widget-pequeno-corpo" onClick={() => c.irPara('analise')}>
          <span className="widget-titulo-solto">{tx('Saúde do dinheiro')}</span>
          <b className={`widget-numero tom-${c.analise.tom}`}>{c.analise.nota}<small>/100</small></b>
          <span className="widget-nota">{c.analise.rotulo}</span>
        </button>
      </CartaoWidget>
    ),
  },

  comparacao: {
    titulo: () => tx('Comparação com o mês anterior'), icone: 'historico', descricao: () => tx('Se você está gastando mais ou menos.'),
    disponivel: ({ m }) => Boolean(m.pilulaGastos),
    Corpo: ({ c, m }) => (
      <CartaoWidget className="widget-pequeno">
        <button className="widget-pequeno-corpo" onClick={() => c.irPara('lancamentos')}>
          <span className="widget-titulo-solto">{tx('Comparado a {0}', noMeioDaFrase(MESES_CURTO[(m.comparacao?.mesAnterior ?? 1) - 1]))}</span>
          <span className={`widget-frase tom-${m.pilulaGastos!.tom}`}>{m.pilulaGastos!.texto}</span>
        </button>
      </CartaoWidget>
    ),
  },

  dividas: {
    titulo: () => tx('Dívidas'), icone: 'divida', descricao: () => tx('Quanto falta pagar em cada uma.'), modulo: 'dividas',
    disponivel: ({ c }) => c.v.dividas && c.situacao.some((s) => s.restante > 0),
    Corpo: ({ c }) => {
      const abertas = c.situacao.filter((s) => s.restante > 0)
      return (
        <CartaoWidget titulo={tx('Dívidas')} aoAbrir={() => c.irPara('dividas')}
          rodape={abertas.length > LIMITE ? { texto: tx('Ver tudo'), acao: () => c.irPara('dividas') } : undefined}>
          {abertas.slice(0, LIMITE).map((s) => {
            const atraso = calendarioDe(s, c.diaRef)?.emAtraso ?? 0
            const pago = s.saldoInicial > 0 ? Math.max(0, Math.min(1, (s.saldoInicial - s.restante) / s.saldoInicial)) : undefined
            return (
              <LinhaDeLista key={s.divida.id} icone={<IconeRedondo icone="divida" cor={atraso > 0 ? 'var(--saida)' : 'var(--divida)'} />}
                titulo={s.divida.descricao} sub={atraso > 0 ? tx('{0} atrasado', fmtValor(atraso)) : pago !== undefined ? tx('{0}% quitado', Math.round(pago * 100)) : undefined}
                progresso={pago !== undefined ? { parte: pago, cor: 'var(--divida)' } : undefined}
                valor={fmtValor(s.restanteHoje)} valorSub={tx('falta')} tomValor={atraso > 0 ? 'alerta' : undefined}
                aoTocar={() => c.irPara('dividas')} />
            )
          })}
        </CartaoWidget>
      )
    },
  },

  receber: {
    titulo: () => tx('Te devem'), icone: 'receber', descricao: () => tx('Quem te deve e quanto falta receber.'), modulo: 'dividas',
    disponivel: ({ c }) => c.v.dividas && c.aReceber.some((s) => s.restante > 0),
    Corpo: ({ c }) => {
      const abertas = c.aReceber.filter((s) => s.restante > 0)
      const abrir = () => { pedirLadoDividas('me_devem'); c.irPara('dividas') }
      return (
        <CartaoWidget titulo={tx('Te devem')} aoAbrir={abrir}>
          {abertas.slice(0, LIMITE).map((s) => (
            <LinhaDeLista key={s.divida.id} icone={<IconeRedondo icone="receber" cor="var(--entrada)" />}
              titulo={s.divida.pessoa || s.divida.descricao} sub={s.divida.pessoa ? s.divida.descricao : undefined}
              valor={fmtValor(s.restante)} tomValor="entrada" aoTocar={abrir} />
          ))}
        </CartaoWidget>
      )
    },
  },

  metas: {
    titulo: () => tx('Metas'), icone: 'meta', descricao: () => tx('Quanto você já juntou em cada meta.'), modulo: 'metas',
    disponivel: ({ c, m }) => c.v.metas && !c.d.metasSemTabela && m.situacaoMetas.length > 0,
    Corpo: ({ c, m }) => (
      <CartaoWidget titulo={tx('Metas')} aoAbrir={() => c.irPara('metas')}>
        {[...m.situacaoMetas].sort((a, b) => Number(a.batida) - Number(b.batida) || b.progresso - a.progresso).slice(0, LIMITE).map((s) => (
          <LinhaDeLista key={s.meta.id} icone={<IconeRedondo cor={s.meta.cor}><IconeCategoria emoji={s.meta.icone} tamanho={20} /></IconeRedondo>}
            titulo={s.meta.nome} progresso={{ parte: s.progresso, cor: s.meta.cor }}
            valor={fmtMoeda(s.guardado, s.meta.moeda)} valorSub={tx('de {0}', fmtMoeda(s.meta.alvo, s.meta.moeda))}
            aoTocar={() => c.irPara('metas')} />
        ))}
      </CartaoWidget>
    ),
  },

  guardado: {
    titulo: () => tx('Dinheiro guardado'), icone: 'cofre', descricao: () => tx('O saldo de cada banco.'), modulo: 'bancos',
    disponivel: ({ c }) => c.v.bancos && c.d.bancos.length > 0,
    Corpo: ({ c }) => {
      const bancos = [...c.d.bancos].sort((a, b) => caixaDoBanco(c.mesEf.caixa, b.id) - caixaDoBanco(c.mesEf.caixa, a.id))
      return (
        <CartaoWidget titulo={tx('Dinheiro guardado')} aoAbrir={() => c.irPara('patrimonio')}
          rodape={bancos.length > LIMITE ? { texto: tx('Ver tudo'), acao: () => c.irPara('patrimonio') } : undefined}>
          {bancos.slice(0, LIMITE).map((b) => (
            <LinhaDeLista key={b.id} icone={<span className="icone-banco-movel"><BancoIcone nome={b.nome} cor={b.cor} tamanho={44} /></span>}
              titulo={b.nome} valor={c.mesEf.caixa[b.id] ? fmtValor(caixaDoBanco(c.mesEf.caixa, b.id)) : tx('Não informado')}
              aoTocar={() => c.abrirBanco(b.id)} />
          ))}
          {c.mesEf.herdadoDe && <p className="widget-nota">{tx('Saldos de {0}. Toque para atualizar.', noMeioDaFrase(MESES_CURTO[c.mesEf.herdadoDe[1] - 1]))}</p>}
        </CartaoWidget>
      )
    },
  },

  cartoes: {
    titulo: () => tx('Cartões'), icone: 'cartao', descricao: () => tx('A fatura de cada cartão no mês.'), modulo: 'cartoes',
    disponivel: ({ c }) => c.v.cartoes && c.faturas.length > 0,
    Corpo: ({ c }) => (
      <CartaoWidget titulo={tx('Cartões')} aoAbrir={() => c.irPara('cartoes')}>
        {c.faturas.slice(0, LIMITE).map((f) => {
          const atrasada = f.status === 'atrasada' || f.atrasadas.length > 0
          return (
            <LinhaDeLista key={f.cartao.id} icone={<IconeRedondo icone="cartao" cor={f.cartao.cor || 'var(--caixa)'} />}
              titulo={f.cartao.nome}
              sub={f.paga ? tx('Fatura paga') : atrasada ? tx('Fatura atrasada') : tx('Vence {0}', fmtDataCurta(f.vencimento))}
              valor={fmtValor(f.valor)} tomValor={atrasada ? 'alerta' : undefined} aoTocar={() => c.irPara('cartoes')} />
          )
        })}
      </CartaoWidget>
    ),
  },
}
