/**
 * Cartões no celular: o topo tem uma página por cartão, na cor dele (deslizar troca o cartão escolhido), com a fatura do
 * mês e "Paguei a fatura". Embaixo, do cartão escolhido: as faturas que venceram sem pagar, a fatura do mês (linha do tempo
 * e o que dá para fazer com ela), as compras, o limite, as próximas faturas, as parceladas e o histórico. As peças e os
 * formulários são os mesmos da tela do computador (pages/Cartoes.tsx).
 */
import { useEffect, useRef, useState } from 'react'
import { BancoIcone } from '../../components/BancoIcone'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Icone } from '../../components/Icone'
import { SEM_CATEGORIA } from '../../lib/categorias'
import { nomeDaFatura, textoStatus, type SituacaoCartao } from '../../lib/cartoes'
import { fmtDataCurta, fmtValor, MESES_NOME, noMeioDaFrase } from '../../lib/format'
import { semMovimento } from '../../lib/tema'
import { tx } from '../../lib/textos'
import type { CartaoCredito } from '../../lib/types'
import {
  FaturaDoMes, FaturasAtrasadas, FaturasResolvidas, FormCartao, FormPagarFatura, FormRenegociar, Limite, Parcelada, Proximas,
  ResultadoDaBusca, SemCartoes, type Alvo,
} from '../../pages/Cartoes'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CarrosselDeDicas, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type Acao, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

/** Fatura que já dá para marcar como paga: com valor, já aberta para pagamento e ainda sem pagamento. */
const podeResolver = (s: SituacaoCartao) => s.valor > 0 && s.status !== 'futura' && !s.paga

export function CartoesMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const [editando, setEditando] = useState<CartaoCredito | 'novo' | null>(null)
  const [pagando, setPagando] = useState<Alvo | null>(null)
  const [renegociando, setRenegociando] = useState<Alvo | null>(null)
  // vem da compra que acabou de ser lançada: abre direto no cartão dela
  const [escolhido, setEscolhido] = useState<string | null>(c.cartaoAberto)
  const { cartoes, faturas } = c
  const arquivados = cartoes.cartoes.filter((x) => !x.ativo)
  const s = faturas.find((x) => x.cartao.id === escolhido) ?? faturas[0]
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  const nivel = c.perfil.detalhe
  // a compra recém-lançada: rola até ela uma vez e o destaque se apaga sozinho
  const [destacada, setDestacada] = useState<string | null>(c.compraDestacada)
  const jaRolou = useRef(false)
  const apareceu = Boolean(destacada && s?.compras.some((l) => l.compra_id === destacada))
  useEffect(() => {
    if (!apareceu || jaRolou.current) return
    jaRolou.current = true
    const rolar = window.setTimeout(() => document.querySelector('.cartoes-movel .compra-nova')?.scrollIntoView({ block: 'center', behavior: semMovimento() ? 'auto' : 'smooth' }), 350)
    const apagar = window.setTimeout(() => setDestacada(null), 3600)
    return () => { window.clearTimeout(rolar); window.clearTimeout(apagar) }
  }, [apareceu])

  if (cartoes.semTabela) {
    return (
      <div className="pagina cartoes-movel">
        <CartaoWidget titulo={tx('Cartões')}>
          <p className="widget-vazio">{tx('Para usar cartões de crédito, falta atualizar o banco de dados: rode')} <code>supabase/migracao-08-cartoes.sql</code> {tx('no SQL Editor do Supabase.')}</p>
        </CartaoWidget>
      </div>
    )
  }

  // ---------- topo: uma página por cartão, na cor dele ----------
  const paginas: PaginaDoHero[] = faturas.length ? faturas.map((x) => ({
    id: x.cartao.id, tom: 'cor', cor: x.cartao.cor,
    rotulo: tx('{0} · fatura de {1}', x.cartao.nome, nomeDaFatura(x.ano, x.mes, c.ano)),
    valor: fmtValor(x.valor),
    // o selo já diz quando vence ("vence em 3 dias", "venceu há 6 dias"); a data do fechamento completa
    sub: x.status === 'aberta' && !x.paga ? tx('{0} · fecha {1}', textoStatus(x), fmtDataCurta(x.fechamento)) : textoStatus(x),
    pilula: podeResolver(x) ? { texto: tx('Paguei a fatura'), acao: () => setPagando({ cartao: x.cartao, f: x }) } : undefined,
  })) : [{ id: 'nenhum', tom: 'invest', rotulo: tx('Faturas de {0}', nomeMes), valor: fmtValor(0), sub: tx('Coloque seus cartões aqui') }]
  const inicial = Math.max(0, faturas.findIndex((x) => x.cartao.id === s?.cartao.id))

  const acoes: Acao[] = s ? [
    { id: 'compra', icone: 'mais', rotulo: tx('Compra'), acao: () => c.novaCompraNoCartao(s.cartao.id) },
    ...(podeResolver(s) ? [{ id: 'paguei', icone: 'check', rotulo: tx('Paguei'), acao: () => setPagando({ cartao: s.cartao, f: s }) }] : []),
    { id: 'editar', icone: 'lapis', rotulo: tx('Editar'), acao: () => setEditando(s.cartao) },
    { id: 'novo', icone: 'cartao', rotulo: tx('Novo cartão'), acao: () => setEditando('novo') },
  ] : [{ id: 'novo', icone: 'cartao', rotulo: tx('Novo cartão'), acao: () => setEditando('novo') }]
  const dicas = cartoes.semExtras && cartoes.carregado && cartoes.cartoes.length > 0 ? [{
    id: 'migracao-9', icone: 'ideia', titulo: tx('Para renegociar faturas, registrar juros de atraso e usar limite garantido, rode a migração 9 no Supabase.'),
  }] : []
  const abrirCompra = (compra: string, atual: number) => {
    const ps = c.cartoes.compras.filter((l) => l.compra_id === compra)
    const l = ps.find((x) => (x.parcela ?? 1) === atual) ?? ps[0]
    if (l) c.editarLancamento(l)
  }

  return (
    <div className="pagina cartoes-movel">
      <HeroDeslizante paginas={paginas} inicial={inicial}
        aoMudar={(p) => { aoMudarTom(p.tom, p.cor); if (p.id !== 'nenhum') setEscolhido(p.id) }} />
      <BotoesDeAcao acoes={acoes} />
      <CarrosselDeDicas dicas={dicas} />

      {c.busca.trim() && cartoes.carregado && <ResultadoDaBusca c={c} />}
      {cartoes.carregado && !cartoes.cartoes.length && <SemCartoes aoCriar={() => setEditando('novo')} />}

      {s && (
        <div className="widgets-movel pecas-do-computador" style={{ '--c': s.cartao.cor } as React.CSSProperties}>
          <FaturasAtrasadas s={s} c={c} aoPagar={(f) => setPagando({ cartao: s.cartao, f })} aoRenegociar={(f) => setRenegociando({ cartao: s.cartao, f })} />
          <FaturaDoMes s={s} c={c} aoPagar={(f, p) => setPagando({ cartao: s.cartao, f, pagamento: p })} aoRenegociar={(f) => setRenegociando({ cartao: s.cartao, f })} />
          <CartaoWidget titulo={s.compras.length ? tx('Compras desta fatura · {0}', s.compras.length) : tx('Compras desta fatura')}>
            {s.compras.length ? s.compras.map((l) => {
              const k = c.categoriaDe(l) ?? SEM_CATEGORIA
              return (
                <div key={l.id} className={l.compra_id && l.compra_id === destacada ? 'compra-nova' : undefined}>
                  <LinhaDeLista icone={<IconeRedondo cor={k.cor}><IconeCategoria emoji={k.icone} tamanho={20} /></IconeRedondo>}
                    titulo={l.descricao || tx('Compra')}
                    sub={[fmtDataCurta(l.data_compra ?? null), k.nome, (l.parcelas ?? 1) > 1 ? `${l.parcela}/${l.parcelas}` : null].filter(Boolean).join(' · ')}
                    valor={fmtValor(l.valor)} aoTocar={() => c.editarLancamento(l)} />
                </div>
              )
            }) : <p className="widget-vazio">{tx('Nenhuma compra nesta fatura. Toque em “Compra” para lançar uma neste cartão.')}</p>}
          </CartaoWidget>
          {nivel !== 'simples' && <Limite s={s} c={c} aoEditar={() => setEditando(s.cartao)} />}
          {nivel !== 'simples' && <Proximas s={s} c={c} />}
          {nivel !== 'simples' && s.parceladas.length > 0 && (
            <CartaoWidget titulo={tx('Parceladas em andamento · {0}', s.parceladas.length)}>
              <ul className="ccd-parceladas">
                {s.parceladas.map((p) => <Parcelada key={p.compra_id} p={p} aoAbrir={() => abrirCompra(p.compra_id, p.atual)} />)}
              </ul>
            </CartaoWidget>
          )}
          {nivel === 'detalhado' && <FaturasResolvidas s={s} c={c} aoPagar={(f, p) => setPagando({ cartao: s.cartao, f, pagamento: p })} aoRenegociar={(f) => setRenegociando({ cartao: s.cartao, f })} />}
        </div>
      )}

      {arquivados.length > 0 && (
        <div className="widgets-movel">
          <CartaoWidget titulo={tx('Cartões que você não usa mais')}>
            {arquivados.map((x) => (
              <LinhaDeLista key={x.id} icone={<span className="icone-banco-movel"><BancoIcone nome={x.nome} cor={x.cor} tamanho={40} /></span>}
                titulo={x.nome} aoTocar={() => setEditando(x)} valor={<Icone nome="lapis" tamanho={16} />} />
            ))}
          </CartaoWidget>
        </div>
      )}

      {editando && <FormCartao c={c} cartao={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {pagando && <FormPagarFatura c={c} alvo={pagando} aoFechar={() => setPagando(null)} />}
      {renegociando && <FormRenegociar c={c} alvo={renegociando} aoFechar={() => setRenegociando(null)} />}
    </div>
  )
}
