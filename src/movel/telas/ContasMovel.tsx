/**
 * Contas do mês no celular: o topo que desliza (o que falta pagar e o que vai entrar), as ações (nova conta, entrada fixa,
 * pagar a próxima, todas as contas), a linha do mês e as contas em cartões por situação (atrasadas, esta semana, mais à
 * frente, pagas). Tocar numa conta em aberto abre a conferência (valor, dia e banco) antes da baixa; numa paga, o lançamento.
 * Cadastro, conferência e linha do mês são os mesmos da tela do computador (pages/Contas.tsx).
 */
import { useState } from 'react'
import { FormBaixa } from '../../components/FormBaixa'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Icone } from '../../components/Icone'
import { Modal } from '../../components/ui'
import { agruparContas, fmtConta, fraseDaSituacao, inicioDoMes, mesesComAtraso, totaisDoMes, type SituacaoConta } from '../../lib/contasFixas'
import { fmtDataCurta, fmtMesAno, fmtValor, MESES_NOME, noMeioDaFrase } from '../../lib/format'
import { tx } from '../../lib/textos'
import { ENTRADA_FIXA, FormConta, LinhaDoMes, SemContas, useEdicaoDeConta } from '../../pages/Contas'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CarrosselDeDicas, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type Dica, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

const quando = (iso: string) => fmtMesAno(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))

export function ContasMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom) => void }) {
  const { editando, setEditando, modelo, nova } = useEdicaoDeConta()
  const [conferir, setConferir] = useState<SituacaoConta | null>(null)
  const [todas, setTodas] = useState(false)
  const { contas } = c.contas
  const sits = c.situacoesContas
  const t = totaisDoMes(sits)
  const g = agruparContas(sits)
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  const totalSaidas = t.jaPago + t.faltaPagar
  const anteriores = mesesComAtraso(contas, c.d.lancs, c.ano, c.mes)
  // a próxima a pagar: a atrasada mais antiga, senão a que vence primeiro
  const proxima = [...g.atrasadas, ...g.estaSemana, ...g.maisAFrente].find((s) => s.conta.tipo === 'saida')

  if (c.contas.semTabela) {
    return (
      <div className="pagina contas-movel">
        <CartaoWidget titulo={tx('Contas do mês')}>
          <p className="widget-vazio">{tx('Para usar as contas do mês, falta atualizar o banco de dados: rode')} <code>supabase/migracao-07-contas-fixas.sql</code> {tx('no SQL Editor do Supabase.')}</p>
        </CartaoWidget>
      </div>
    )
  }

  // ---------- topo: o que falta pagar e o que vai entrar ----------
  const paginas: PaginaDoHero[] = [{
    id: 'pagar', tom: t.qtdAtrasadas ? 'falta' : totalSaidas && !t.faltaPagar ? 'sobra' : 'dividas',
    rotulo: contas.length ? tx('Falta pagar em {0}', nomeMes) : tx('Contas do mês'),
    valor: fmtValor(t.faltaPagar),
    sub: !contas.length ? tx('Nunca mais esqueça uma conta.')
      : t.qtdAtrasadas ? (t.qtdAtrasadas === 1 ? tx('1 conta atrasada · {0}', fmtValor(t.atrasado)) : tx('{0} contas atrasadas · {1}', t.qtdAtrasadas, fmtValor(t.atrasado)))
        : totalSaidas ? tx('Já pago {0} de {1}', fmtValor(t.jaPago), fmtValor(totalSaidas)) : undefined,
    pilula: proxima ? { texto: tx('Pagar {0}', proxima.conta.descricao), acao: () => setConferir(proxima) } : undefined,
  }]
  if (t.temEntradas) {
    paginas.push({
      id: 'entra', tom: 'sobra',
      rotulo: t.aReceber > 0 ? tx('Vai entrar em {0}', nomeMes) : tx('Recebido em {0}', nomeMes),
      valor: fmtValor(t.aReceber > 0 ? t.aReceber : t.jaRecebido),
      sub: t.aReceber > 0 && t.jaRecebido > 0 ? tx('Já recebido {0}', fmtValor(t.jaRecebido)) : undefined,
    })
  }

  const dicas: Dica[] = anteriores.length ? [{
    id: 'anteriores', icone: 'sino',
    titulo: tx('Ficou conta sem pagar em {0}.', anteriores.map((a) => `${noMeioDaFrase(MESES_NOME[a.mes - 1])} (${a.qtd})`).join(', ')),
    botao: { texto: tx('Ver {0}', noMeioDaFrase(MESES_NOME[anteriores[0].mes - 1])), acao: () => c.irParaMes(anteriores[0].mes) },
  }] : []

  const linha = (s: SituacaoConta) => {
    const entrada = s.conta.tipo === 'entrada'
    const cat = c.categorias.find((k) => k.id === s.conta.categoria_id)
    const sugestao = s.baixa ? undefined : c.sugestaoDaConta(s.conta.id)
    return (
      <div key={s.conta.id} className="conta-movel">
        <LinhaDeLista
          icone={<IconeRedondo cor={cat?.cor ?? (entrada ? 'var(--entrada)' : 'var(--texto-2)')}><IconeCategoria emoji={cat?.icone ?? (entrada ? '💰' : '🧾')} tamanho={20} /></IconeRedondo>}
          titulo={s.conta.descricao} sub={fraseDaSituacao(s)}
          valor={`${entrada ? '+' : ''}${fmtConta(s)}`} tomValor={s.estado === 'atrasada' ? 'alerta' : entrada ? 'entrada' : undefined}
          valorSub={s.estado === 'paga' ? (entrada ? tx('recebido') : tx('pago')) : undefined}
          aoTocar={() => (s.baixa ? c.editarLancamento(s.baixa) : setConferir(s))} />
        {sugestao && (
          <div className="sugestao-movel" role="status">
            <span><Icone nome="ideia" tamanho={14} /> {entrada ? tx('Parece que já caiu') : tx('Parece que já foi pago')}: <b>{sugestao.lanc.descricao}</b> · {fmtValor(sugestao.lanc.valor)} · {fmtDataCurta(sugestao.lanc.data)}</span>
            <span className="sugestao-movel-acoes">
              <button className="btn primario" onClick={() => c.ligarAConta(sugestao.lanc.id, s.conta.id)}>{tx('É esse')}</button>
              <button className="btn" onClick={() => c.recusarVinculo(sugestao.lanc.id, s.conta.id)}>{tx('Não é')}</button>
            </span>
          </div>
        )}
      </div>
    )
  }
  const grupo = (id: string, titulo: string, itens: SituacaoConta[]) => itens.length > 0 && (
    <CartaoWidget key={id} titulo={`${titulo} · ${itens.length}`}>{itens.map(linha)}</CartaoWidget>
  )

  return (
    <div className="pagina contas-movel">
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={[
        { id: 'nova', icone: 'mais', rotulo: tx('Nova conta'), acao: () => nova() },
        { id: 'entrada', icone: 'receber', rotulo: tx('Entrada fixa'), acao: () => nova(ENTRADA_FIXA) },
        ...(proxima ? [{ id: 'pagar', icone: 'check', rotulo: tx('Pagar'), acao: () => setConferir(proxima) }] : []),
        ...(contas.length ? [{ id: 'todas', icone: 'lista', rotulo: tx('Todas'), acao: () => setTodas(true) }] : []),
      ]} />
      <CarrosselDeDicas dicas={dicas} />

      {!contas.length && <SemContas aoNova={nova} />}

      <div className="widgets-movel">
        {sits.length > 0 && c.perfil.detalhe !== 'simples' && <div className="linha-do-mes-movel"><LinhaDoMes c={c} sits={sits} /></div>}
        {contas.length > 0 && !sits.length && (
          <CartaoWidget><p className="widget-vazio">{tx('Nenhuma conta vale em {0} de {1}. Confira abaixo o mês em que cada uma começa.', nomeMes, c.ano)}</p></CartaoWidget>
        )}
        {grupo('atrasadas', tx('Atrasadas'), g.atrasadas)}
        {grupo('semana', tx('Esta semana'), g.estaSemana)}
        {grupo('depois', tx('Mais à frente'), g.maisAFrente)}
        {grupo('pagas', tx('Pagas'), g.pagas)}
      </div>

      {todas && (
        <Modal titulo={tx('Suas contas fixas')} aoFechar={() => setTodas(false)}>
          <div className="lista-folha">
            {contas.map((x) => {
              const cat = c.categorias.find((k) => k.id === x.categoria_id)
              return (
                <LinhaDeLista key={x.id}
                  icone={<IconeRedondo cor={cat?.cor ?? 'var(--texto-2)'} tamanho={40}><IconeCategoria emoji={cat?.icone ?? (x.tipo === 'entrada' ? '💰' : '🧾')} tamanho={18} /></IconeRedondo>}
                  titulo={x.ativa ? x.descricao : `${x.descricao} · ${tx('pausada')}`}
                  sub={[
                    tx('{0} todo dia {1}', x.tipo === 'entrada' ? tx('cai') : tx('vence'), x.dia),
                    x.fim ? tx('até {0}', quando(x.fim)) : null,
                    x.inicio > inicioDoMes(c.ano, c.mes) ? tx('começa em {0}', quando(x.inicio)) : null,
                  ].filter(Boolean).join(' · ')}
                  valor={`${x.tipo === 'entrada' ? '+' : ''}${fmtValor(x.valor)}`} tomValor={x.tipo === 'entrada' ? 'entrada' : undefined}
                  aoTocar={() => { setTodas(false); setEditando(x) }} />
              )
            })}
          </div>
        </Modal>
      )}
      {editando && <FormConta c={c} conta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />}
      {conferir && <FormBaixa c={c} s={conferir} conferir aoFechar={() => setConferir(null)} />}
    </div>
  )
}
