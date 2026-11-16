/**
 * Metas no celular: o topo desliza entre o que já foi guardado nas metas e quanto guardar por mês para chegar nos prazos.
 * Ações: guardar, retirar, criar e modelos. A sobra do mês vira um convite para guardar. Embaixo: cada meta com o quanto
 * já tem (tocar abre a ficha), quando cada uma chega e quanto guardar por mês (no detalhado) e as metas batidas. Os números
 * saem de `resumoDasMetas` (lib/metas.ts), os mesmos da tela do computador; ficha e formulários vêm de pages/Metas.tsx.
 */
import { useState } from 'react'
import { CartaoModelo } from '../../components/CenaMeta'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Modal } from '../../components/ui'
import { BarraDividida, LinhaDoTempo } from '../../components/Vitrine'
import { gastoMensalMedio } from '../../lib/conselheiro'
import { fmtMoeda, fmtValor, mesEAno, MESES_NOME, noMeioDaFrase } from '../../lib/format'
import { MODELOS, resumoDasMetas, situacaoMeta, type SituacaoMeta } from '../../lib/metas'
import { tx } from '../../lib/textos'
import type { Meta } from '../../lib/types'
import { estadoMeta, FichaMeta, FormMeta, FormMovimento, linhasDeChegada } from '../../pages/Metas'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CarrosselDeDicas, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type Acao, type Dica, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

const prazo = (iso: string) => mesEAno(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))

export function MetasMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [modelo, setModelo] = useState<Partial<Meta> | undefined>()
  const [movendo, setMovendo] = useState<{ meta: Meta; retirar: boolean; valor?: number } | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  // escolher a meta antes de guardar ou retirar (com mais de uma)
  const [escolher, setEscolher] = useState<{ retirar: boolean; valor?: number } | null>(null)
  const [modelos, setModelos] = useState(false)
  const sits = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const { ativas, batidas, guardado, alvoTotal, falta, porMes, naPrincipal } = resumoDasMetas(sits, c.taxas)
  const gastoMedio = gastoMensalMedio(c.porMes, c.ano)
  const sobra = Math.max(0, c.r.fluxo)
  const aberto = sits.find((s) => s.meta.id === aberta)
  const nivel = c.perfil.detalhe
  const comGuardado = sits.filter((s) => s.guardado > 0)

  if (c.d.metasSemTabela) {
    return (
      <div className="pagina metas-movel">
        <CartaoWidget titulo={tx('Metas')}>
          <p className="widget-vazio">{tx('Para usar metas, falta atualizar o banco de dados: rode')} <code>supabase/migracao-06-metas.sql</code> {tx('no SQL Editor do Supabase.')}</p>
        </CartaoWidget>
      </div>
    )
  }

  const mover = (retirar: boolean, valor?: number) => {
    const lista = retirar ? comGuardado : ativas
    if (lista.length === 1) setMovendo({ meta: lista[0].meta, retirar, valor })
    else setEscolher({ retirar, valor })
  }
  const novaDoModelo = (m: (typeof MODELOS)[number]) => {
    setModelos(false)
    setModelo({ nome: m.nome, icone: m.icone, cor: m.cor, alvo: m.reserva && gastoMedio ? Math.round(gastoMedio * 6) : undefined })
    setEditando('nova')
  }

  // ---------- topo: o guardado nas metas → quanto guardar por mês ----------
  const paginas: PaginaDoHero[] = sits.length ? [
    {
      id: 'guardado', tom: 'sobra', rotulo: tx('Guardado nas metas'), valor: fmtValor(guardado),
      sub: tx('{0}% de {1} · {2} de {3} batidas', alvoTotal ? Math.round((guardado / alvoTotal) * 100) : 0, fmtValor(alvoTotal), batidas.length, sits.length),
    },
    ...(falta > 0 ? [{
      id: 'falta', tom: 'invest' as const, rotulo: porMes > 0 ? tx('Guardar por mês') : tx('Faltam'), valor: fmtValor(porMes > 0 ? porMes : falta),
      sub: porMes > 0 ? tx('para chegar nos prazos · faltam {0}', fmtValor(falta)) : tx('Pôr um prazo na meta mostra quanto guardar por mês.'),
    }] : []),
  ] : [{ id: 'nenhuma', tom: 'invest', rotulo: tx('Metas'), valor: fmtValor(0), sub: tx('Comece por um objetivo') }]

  const acoes: Acao[] = [
    ...(ativas.length ? [{ id: 'guardar', icone: 'mais', rotulo: tx('Guardar'), acao: () => mover(false) }] : []),
    ...(comGuardado.length ? [{ id: 'retirar', icone: 'desce', rotulo: tx('Retirar'), acao: () => mover(true) }] : []),
    { id: 'criar', icone: 'meta', rotulo: tx('Criar meta'), acao: () => { setModelo(undefined); setEditando('nova') } },
    { id: 'modelos', icone: 'ideia', rotulo: tx('Modelos'), acao: () => setModelos(true) },
  ]
  const dicas: Dica[] = sobra > 0 && ativas.length > 0 ? [{
    id: 'sobra', icone: 'cofre', titulo: tx('Sobrou {0} em {1}. Guardar numa meta?', fmtValor(sobra), noMeioDaFrase(MESES_NOME[c.mes - 1])),
    botao: { texto: tx('Guardar'), acao: () => mover(false, sobra) },
  }] : []

  const linha = (s: SituacaoMeta) => {
    const { meta } = s
    const estado = estadoMeta(s)
    const frase = s.batida ? tx('Você juntou tudo. 🎉')
      : s.atrasada && meta.prazo ? tx('O prazo ({0}) passou. Que tal um novo?', prazo(meta.prazo))
        : s.porMesNoPrazo !== null && meta.prazo ? tx('Guarde {0}/mês até {1}', fmtMoeda(s.porMesNoPrazo, meta.moeda), prazo(meta.prazo))
          : s.previsao ? tx('No seu ritmo, chega em {0}', mesEAno(s.previsao[0], s.previsao[1]))
            : estado.texto
    return (
      <LinhaDeLista key={meta.id} icone={<IconeRedondo cor={meta.cor}><IconeCategoria emoji={meta.icone} tamanho={20} /></IconeRedondo>}
        titulo={meta.nome} sub={frase} progresso={{ parte: s.progresso, cor: meta.cor }}
        valor={fmtMoeda(s.guardado, meta.moeda)} valorSub={tx('de {0}', fmtMoeda(meta.alvo, meta.moeda))}
        aoTocar={() => setAberta(meta.id)} />
    )
  }
  const chegadas = linhasDeChegada(ativas)

  return (
    <div className="pagina metas-movel">
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={acoes} />
      <CarrosselDeDicas dicas={dicas} />

      <div className="widgets-movel">
        {!sits.length && (
          <CartaoWidget titulo={tx('Comece por um objetivo')}>
            <p className="widget-nota">{tx('Escolha um ponto de partida ou crie do seu jeito. O app mostra quanto guardar por mês e quando você chega lá.')}</p>
            <div className="mt-modelos">
              {MODELOS.map((m, i) => (
                <CartaoModelo key={m.nome} cor={m.cor} icone={m.icone} nome={m.nome} indice={i} aoEscolher={() => novaDoModelo(m)}
                  dica={m.reserva && gastoMedio ? tx('{0} = 6 meses de gastos', fmtValor(Math.round(gastoMedio * 6))) : m.dica} />
              ))}
            </div>
          </CartaoWidget>
        )}
        {ativas.length > 0 && <CartaoWidget titulo={tx('Suas metas')}>{ativas.map(linha)}</CartaoWidget>}
        {nivel === 'detalhado' && ativas.length > 0 && chegadas.itens.length > 0 && (
          <CartaoWidget titulo={tx('Quando cada meta chega')}>
            <div className="pecas-do-computador"><LinhaDoTempo itens={chegadas.itens} eixo={chegadas.eixo} /></div>
          </CartaoWidget>
        )}
        {nivel === 'detalhado' && porMes > 0 && (
          <CartaoWidget titulo={tx('Quanto guardar por mês')}>
            <div className="pecas-do-computador">
              <BarraDividida formato={fmtValor} partes={ativas.filter((x) => (x.porMesNoPrazo ?? 0) > 0).map((x) => ({ rotulo: x.meta.nome, valor: naPrincipal(x.porMesNoPrazo ?? 0, x.meta.moeda), cor: x.meta.cor, icone: <IconeCategoria emoji={x.meta.icone} tamanho={14} /> }))} />
            </div>
          </CartaoWidget>
        )}
        {batidas.length > 0 && <CartaoWidget titulo={tx('Metas batidas 🎉')}>{batidas.map(linha)}</CartaoWidget>}
      </div>

      {escolher && (
        <Modal titulo={escolher.retirar ? tx('Retirar de qual meta?') : tx('Guardar em qual meta?')} aoFechar={() => setEscolher(null)}>
          <div className="lista-folha">
            {(escolher.retirar ? comGuardado : ativas).map((s) => (
              <LinhaDeLista key={s.meta.id} icone={<IconeRedondo cor={s.meta.cor} tamanho={40}><IconeCategoria emoji={s.meta.icone} tamanho={18} /></IconeRedondo>}
                titulo={s.meta.nome} sub={tx('{0} de {1}', fmtMoeda(s.guardado, s.meta.moeda), fmtMoeda(s.meta.alvo, s.meta.moeda))}
                progresso={{ parte: s.progresso, cor: s.meta.cor }}
                aoTocar={() => {
                  setEscolher(null)
                  // a sobra do mês vai até o que falta na meta (e só na moeda principal)
                  const valor = escolher.valor !== undefined && s.meta.moeda === c.perfil.moeda ? Math.min(escolher.valor, naPrincipal(s.falta, s.meta.moeda)) : undefined
                  setMovendo({ meta: s.meta, retirar: escolher.retirar, valor })
                }} />
            ))}
          </div>
        </Modal>
      )}
      {modelos && (
        <Modal titulo={tx('Modelos de meta')} aoFechar={() => setModelos(false)}>
          <div className="mt-modelos">
            {MODELOS.map((m, i) => (
              <CartaoModelo key={m.nome} cor={m.cor} icone={m.icone} nome={m.nome} indice={i} aoEscolher={() => novaDoModelo(m)}
                dica={m.reserva && gastoMedio ? tx('{0} = 6 meses de gastos', fmtValor(Math.round(gastoMedio * 6))) : m.dica} />
            ))}
          </div>
        </Modal>
      )}
      {aberto && (
        <FichaMeta s={aberto} c={c} aoFechar={() => setAberta(null)}
          aoEditar={() => { setAberta(null); setEditando(aberto.meta) }}
          aoGuardar={() => { setAberta(null); setMovendo({ meta: aberto.meta, retirar: false }) }}
          aoRetirar={() => { setAberta(null); setMovendo({ meta: aberto.meta, retirar: true }) }} />
      )}
      {editando && <FormMeta c={c} meta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />}
      {movendo && <FormMovimento c={c} meta={movendo.meta} retirar={movendo.retirar} valorInicial={movendo.valor} aoFechar={() => setMovendo(null)} />}
    </div>
  )
}
