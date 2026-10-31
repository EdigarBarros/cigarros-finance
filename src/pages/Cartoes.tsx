import { casasDaMoeda, mascarar } from '../lib/dinheiro'
import { useState } from 'react'
import { CATALOGO_BANCOS } from '../lib/bancos'
import {
  datasDaFatura, faturaDoMes, hojeLocal, nomeDaFatura, pagaComAtraso, quandoVence, renegociada, somaMeses, textoStatus,
  totalFaturasAPagar, totalFaturasDoMes, type CompraParcelada, type Fatura, type SituacaoCartao,
} from '../lib/cartoes'
import { COR } from '../lib/charts'
import { somaMesesData } from '../lib/dividas'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtDataCurta, fmtDataLonga, fmtValor, MESES_CURTO, MESES_NOME, moedaAtual, paraCampo, parseNumero, simbolo, noMeioDaFrase } from '../lib/format'
import { CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import type { CartaoCredito, FaturaPaga } from '../lib/types'
import { BancoIcone } from '../components/BancoIcone'
import { CartaoIlustrado } from '../components/CartaoIlustrado'
import { Selo } from '../components/Categorias'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { Cartao, Interruptor, Kpi, Modal, Vazio } from '../components/ui'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const sufixoMes = (ano: number, mes: number) => `${noMeioDaFrase(MESES_CURTO[mes - 1])}/${String(ano).slice(2)}`
const centavos = (n: number) => Math.round(n * 100) / 100
/** Dias de b menos a (datas ISO). */
const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
const anoMesDe = (iso: string) => ({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) })

/** Uma fatura escolhida para pagar, renegociar ou ajeitar. */
interface Alvo { cartao: CartaoCredito; f: Fatura; pagamento?: FaturaPaga }

/**
 * Cartões de crédito: a carteira com os cartões desenhados e, do cartão escolhido, a fatura do mês, o limite (com o
 * garantido da caixinha), as faturas que atrasaram, as próximas, as parceladas e o histórico do que já foi pago ou
 * renegociado. Renegociar cria uma dívida; juros de atraso viram uma saída.
 */
export function Cartoes(c: Ctx) {
  const [editando, setEditando] = useState<CartaoCredito | 'novo' | null>(null)
  const [pagando, setPagando] = useState<Alvo | null>(null)
  const [renegociando, setRenegociando] = useState<Alvo | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const { cartoes, faturas } = c
  const arquivados = cartoes.cartoes.filter((x) => !x.ativo)
  const s = faturas.find((x) => x.cartao.id === escolhido) ?? faturas[0]
  const comLimite = faturas.filter((x) => x.limiteDisponivel !== null)
  const atrasadas = faturas.flatMap((x) => [...x.atrasadas, ...(x.status === 'atrasada' ? [x] : [])])
  const emAtraso = centavos(atrasadas.reduce((a, f) => a + f.valor, 0))
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])

  if (cartoes.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>{tx('Cartões')}</h1></div></header>
        <Cartao><Vazio>{tx('Para usar cartões de crédito, falta atualizar o banco de dados: rode')} <code>supabase/migracao-08-cartoes.sql</code> {tx('no SQL Editor do Supabase.')}</Vazio></Cartao>
      </div>
    )
  }

  return (
    <div className="pagina pg-cartoes">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Cartões')}</h1>
          <p className="sub">{tx('Faturas de {0}/{1}, limite e parcelas de cada cartão.', nomeMes, c.ano)}</p>
        </div>
        {cartoes.cartoes.length > 0 && <button className="btn primario" onClick={() => setEditando('novo')}><Icone nome="mais" tamanho={16} /> {tx('Novo cartão')}</button>}
      </header>

      {cartoes.semExtras && cartoes.carregado && cartoes.cartoes.length > 0 && (
        <p className="cc-aviso-migracao">
          <Icone nome="ideia" tamanho={16} />
          <span>{tx('Para renegociar faturas, registrar juros de atraso e usar limite garantido, rode')} <code>supabase/migracao-09-cartoes-extras.sql</code> {tx('no SQL Editor do Supabase.')}</span>
        </p>
      )}

      {cartoes.carregado && !cartoes.cartoes.length && <SemCartoes aoCriar={() => setEditando('novo')} />}

      {faturas.length > 0 && s && (
        <>
          <section className="cc-carteira" aria-label={tx('Seus cartões')}>
            {faturas.map((x, i) => (
              <div key={x.cartao.id} className="cc-carteira-item" style={{ animationDelay: `${i * 70}ms` }}>
                <CartaoIlustrado
                  nome={x.cartao.nome} cor={x.cartao.cor} banco={c.d.bancos.find((b) => b.id === x.cartao.banco_id)?.nome}
                  ativo={x === s} aoClicar={() => setEscolhido(x.cartao.id)}
                  conteudo={<span className="cc-plastico-fatura"><small>{tx('fatura de {0}', nomeDaFatura(x.ano, x.mes, c.ano))}</small><b>{fmtValor(x.valor)}</b></span>}
                  rodape={<>{tx('fecha dia {0} · vence dia {1}', x.cartao.dia_fechamento, x.cartao.dia_vencimento)}</>}
                />
                <span className={`chip-estado cc ${x.status}`}>{textoStatus(x)}</span>
              </div>
            ))}
            <button className="cc-carteira-novo" onClick={() => setEditando('novo')}>
              <span><Icone nome="mais" tamanho={22} /></span>{tx('Novo cartão')}
            </button>
          </section>

          <div className="kpis">
            <Kpi rotulo={tx('Faturas de {0}', nomeMes)} valor={totalFaturasDoMes(faturas)} cor={COR.saidas} icone="cartao" />
            <Kpi rotulo={tx('Falta pagar')} valor={totalFaturasAPagar(faturas)} cor={COR.divida} icone="relogio" />
            {comLimite.length > 0 && (
              <Kpi rotulo={tx('Limite livre')} valor={comLimite.reduce((a, x) => a + Math.max(0, x.limiteDisponivel!), 0)} cor={COR.caixa} icone="escudo" />
            )}
            {emAtraso > 0 && <Kpi rotulo={tx('Em atraso ({0})', atrasadas.length)} valor={emAtraso} cor={COR.saidas} icone="sino" />}
          </div>

          <Detalhe key={s.cartao.id} s={s} c={c}
            aoEditar={() => setEditando(s.cartao)}
            aoPagar={(f, pagamento) => setPagando({ cartao: s.cartao, f, pagamento })}
            aoRenegociar={(f) => setRenegociando({ cartao: s.cartao, f })} />
        </>
      )}

      {arquivados.length > 0 && (
        <Cartao titulo={tx('Cartões que você não usa mais')}>
          <ul className="cc-arquivados">
            {arquivados.map((x) => (
              <li key={x.id}>
                <button onClick={() => setEditando(x)}>
                  <BancoIcone nome={x.nome} cor={x.cor} tamanho={30} />
                  <span>{x.nome}</span>
                  <Icone nome="lapis" tamanho={16} />
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {editando && <FormCartao c={c} cartao={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {pagando && <FormPagarFatura c={c} alvo={pagando} aoFechar={() => setPagando(null)} />}
      {renegociando && <FormRenegociar c={c} alvo={renegociando} aoFechar={() => setRenegociando(null)} />}
    </div>
  )
}

/** Conta sem cartões: uma pilha de cartões desenhados e o convite para adicionar o primeiro. */
function SemCartoes({ aoCriar }: { aoCriar: () => void }) {
  return (
    <section className="cartao cc-vazio">
      <div className="cc-vazio-pilha" aria-hidden="true">
        <CartaoIlustrado nome="Nubank" cor="#8a05be" compacto />
        <CartaoIlustrado nome="Itaú" cor="#ec7000" compacto />
        <CartaoIlustrado nome="PicPay" cor="#21c25e" compacto />
      </div>
      <div className="cc-vazio-texto">
        <h2>{tx('Coloque seus cartões aqui')}</h2>
        <p>{tx('Diga o dia em que a fatura fecha e o dia em que vence. Depois é só lançar as compras escolhendo o cartão: cada parcela cai na fatura certa e você vê quanto do limite ainda sobra.')}</p>
        <button className="btn primario" onClick={aoCriar}><Icone nome="mais" tamanho={16} /> {tx('Adicionar meu primeiro cartão')}</button>
      </div>
    </section>
  )
}

function Detalhe({ s, c, aoEditar, aoPagar, aoRenegociar }: {
  s: SituacaoCartao; c: Ctx; aoEditar: () => void
  aoPagar: (f: Fatura, pagamento?: FaturaPaga) => void
  aoRenegociar: (f: Fatura) => void
}) {
  const { cartao } = s
  const historico = c.cartoes.faturasPagas
    .filter((p) => p.cartao_id === cartao.id)
    .sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))
  const faturaDe = (p: FaturaPaga) => faturaDoMes(cartao, c.cartoes.compras, c.cartoes.faturasPagas, p.ano, p.mes)
  const banco = c.d.bancos.find((b) => b.id === cartao.banco_id)
  /** Abre uma parcela da compra para editar ou excluir, esteja ela na fatura que está na tela ou não. */
  const abrirCompra = (p: CompraParcelada) => {
    const ps = c.cartoes.compras.filter((l) => l.compra_id === p.compra_id)
    const l = ps.find((x) => (x.parcela ?? 1) === p.atual) ?? ps[0]
    if (l) c.editarLancamento(l)
  }

  return (
    <div className="ccd" style={{ '--c': cartao.cor } as React.CSSProperties}>
      <header className="ccd-cab">
        <BancoIcone nome={cartao.nome} reserva={banco?.nome} cor={cartao.cor} tamanho={40} />
        <span>
          <h2>{cartao.nome}</h2>
          <small>{banco ? `${banco.nome} · ` : ''}{tx('fecha dia {0}, vence dia {1}', cartao.dia_fechamento, cartao.dia_vencimento)}</small>
        </span>
        <span className="espaco" />
        <button className="btn" onClick={aoEditar}><Icone nome="lapis" tamanho={16} /> {tx('Editar')}</button>
        <button className="btn primario" onClick={() => c.novaCompraNoCartao(cartao.id)}><Icone nome="mais" tamanho={16} /> {tx('Nova compra')}</button>
      </header>

      {s.atrasadas.length > 0 && (
        <section className="cartao ccd-atrasadas">
          <header className="ccd-atrasadas-cab">
            <h3 className="ccd-titulo"><Icone nome="sino" tamanho={18} /> {s.atrasadas.length === 1 ? tx('Uma fatura venceu sem pagar') : tx('{0} faturas venceram sem pagar', s.atrasadas.length)}</h3>
            {s.atrasadas.length > 1 && (
              <button className="link" onClick={() => {
                if (!confirm(tx('Marcar as {0} faturas como pagas no dia do vencimento de cada uma?', s.atrasadas.length))) return
                for (const f of s.atrasadas) void c.cartoes.pagarFatura({ cartao_id: cartao.id, ano: f.ano, mes: f.mes, valor: f.valor, pago_em: f.vencimento, banco_id: cartao.banco_id, tipo: 'paga', juros: 0 })
              }}>{tx('Já paguei todas')}</button>
            )}
          </header>
          <ul>
            {s.atrasadas.map((f) => (
              <li key={`${f.ano}-${f.mes}`}>
                <span className="ccd-atrasada-mes">{sufixoMes(f.ano, f.mes)}</span>
                <span className="ccd-atrasada-texto">
                  <strong>{fmtValor(f.valor)}</strong>
                  <small>{tx('venceu há {0} dias, em {1}', dias(f.vencimento, hojeLocal()), fmtDataLonga(f.vencimento))}</small>
                </span>
                <span className="ccd-atrasada-acoes">
                  <button className="btn" onClick={() => aoPagar(f)}><Icone nome="check" tamanho={15} /> {tx('Paguei')}</button>
                  <button className="btn" onClick={() => aoRenegociar(f)} disabled={c.cartoes.semExtras}><Icone nome="acordo" tamanho={15} /> {tx('Renegociei')}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ccd-linha">
        <FaturaDoMes s={s} c={c} aoPagar={aoPagar} aoRenegociar={aoRenegociar} />
        <Limite s={s} c={c} aoEditar={aoEditar} />
      </div>

      <div className="ccd-linha">
        <section className="cartao ccd-compras">
          <h3 className="ccd-titulo">{tx('Compras desta fatura')} <small>{s.compras.length || ''}</small></h3>
          {s.compras.length ? (
            <ul className="lista-lanc">
              {s.compras.map((l, i) => {
                const k = c.categoriaDe(l) ?? SEM_CATEGORIA
                return (
                  <li key={l.id} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                    <button className="item-lanc" onClick={() => c.editarLancamento(l)}>
                      <Selo c={k} tamanho={34} />
                      <span className="item-texto">
                        <span className="item-desc">{l.descricao || tx('Compra')}</span>
                        <span className="item-meta">
                          {fmtDataCurta(l.data_compra ?? null) && <>{fmtDataCurta(l.data_compra ?? null)} · </>}{k.nome}
                          {(l.parcelas ?? 1) > 1 && <> · {l.parcela}/{l.parcelas}</>}
                        </span>
                      </span>
                      <span className="item-valor">{fmtValor(l.valor)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Nenhuma compra nesta fatura. Toque em “Nova compra” e escolha este cartão.')}</p>
          )}
        </section>
        <Proximas s={s} c={c} />
      </div>

      <div className="ccd-linha">
        <section className="cartao">
          <h3 className="ccd-titulo">{tx('Parceladas em andamento')} <small>{s.parceladas.length || ''}</small></h3>
          {s.parceladas.length ? (
            <ul className="ccd-parceladas">
              {s.parceladas.map((p) => <Parcelada key={p.compra_id} p={p} aoAbrir={() => abrirCompra(p)} />)}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Nenhuma compra parcelada pela frente.')}</p>
          )}
        </section>
        <section className="cartao">
          <h3 className="ccd-titulo">{tx('Faturas resolvidas')} <small>{tx('toque para ajeitar')}</small></h3>
          {historico.length ? (
            <ul className="ccd-historico">
              {historico.slice(0, 8).map((p) => {
                const f = faturaDe(p)
                const reneg = renegociada(p)
                const atraso = pagaComAtraso(p, f.vencimento)
                return (
                  <li key={p.id}>
                    <button onClick={() => (reneg ? aoRenegociar(f) : aoPagar(f, p))}>
                      <span className={`ccd-hist-icone ${reneg ? 'reneg' : atraso ? 'atraso' : 'ok'}`}>
                        <Icone nome={reneg ? 'acordo' : atraso ? 'relogio' : 'check'} tamanho={16} />
                      </span>
                      <span className="ccd-hist-texto">
                        <strong>{MESES_NOME[p.mes - 1]}{p.ano !== c.ano ? `/${p.ano}` : ''}</strong>
                        <small>
                          {reneg ? tx('renegociada') : tx('paga em {0}', fmtDataCurta(p.pago_em))}
                          {atraso && ` · ${dias(f.vencimento, p.pago_em)} dias de atraso`}
                          {(p.juros ?? 0) > 0 && ` · ${reneg ? tx('acréscimo') : tx('juros')} ${fmtValor(p.juros!)}`}
                        </small>
                      </span>
                      <span className="ccd-hist-valor">{fmtValor(p.valor)}</span>
                      <Icone nome="lapis" tamanho={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Quando você marcar uma fatura como paga ou renegociada, ela aparece aqui.')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

/** A fatura do mês aberto: valor, situação, a linha do tempo (abriu → fecha → vence) e o que dá para fazer com ela. */
function FaturaDoMes({ s, c, aoPagar, aoRenegociar }: {
  s: SituacaoCartao; c: Ctx; aoPagar: (f: Fatura, p?: FaturaPaga) => void; aoRenegociar: (f: Fatura) => void
}) {
  const hoje = hojeLocal()
  const ant = somaMeses({ ano: s.ano, mes: s.mes }, -1)
  const abriu = datasDaFatura(s.cartao, ant.ano, ant.mes).fechamento
  const total = Math.max(1, dias(abriu, s.vencimento))
  const pos = (d: string) => Math.min(100, Math.max(0, (dias(abriu, d) / total) * 100))
  const p = s.paga
  const atraso = pagaComAtraso(p, s.vencimento)
  const mudou = p && !renegociada(p) && Math.abs(p.valor - s.valor) >= 0.01
  const podeResolver = s.valor > 0 && s.status !== 'futura' && !p

  return (
    <section className={`cartao ccd-fatura ${s.status}`}>
      <div className="ccd-fatura-topo">
        <span>{tx('Fatura de {0}', nomeDaFatura(s.ano, s.mes, c.ano))}</span>
        <span className={`chip-estado cc ${s.status}`}>{textoStatus(s)}</span>
      </div>
      <strong className="ccd-valor"><Numero valor={s.valor} formato={fmtValor} /></strong>

      <div className="ccd-tempo" role="img" aria-label={tx('Fecha em {0} e vence em {1}', fmtDataLonga(s.fechamento), fmtDataLonga(s.vencimento))}>
        <div className="ccd-tempo-trilho">
          <i className="ccd-tempo-cheio" style={{ width: `${pos(hoje)}%` }} />
          <i className="ccd-tempo-marco" style={{ left: `${pos(s.fechamento)}%` }} />
          <i className="ccd-tempo-marco fim" style={{ left: '100%' }} />
          {hoje >= abriu && hoje <= s.vencimento && <i className="ccd-tempo-hoje" style={{ left: `${pos(hoje)}%` }} title="hoje" />}
        </div>
        <div className="ccd-tempo-rotulos">
          <span>{tx('abriu')}<b>{fmtDataCurta(abriu)}</b></span>
          <span>{tx('fecha')}<b>{fmtDataCurta(s.fechamento)}</b></span>
          <span>{tx('vence')}<b>{fmtDataCurta(s.vencimento)}</b></span>
        </div>
      </div>

      {p ? (
        <div className="ccd-pago">
          <span className={`ccd-hist-icone ${renegociada(p) ? 'reneg' : atraso ? 'atraso' : 'ok'}`}>
            <Icone nome={renegociada(p) ? 'acordo' : atraso ? 'relogio' : 'check'} tamanho={16} />
          </span>
          <span>
            {renegociada(p)
              ? <>{tx('Renegociada em {0}. Virou uma dívida em parcelas; as compras dela saíram das saídas do mês.', fmtDataLonga(p.pago_em))}</>
              : <>{tx('Paga em {0}', fmtDataLonga(p.pago_em))}{atraso && <>{tx(', com')} <b>{tx('{0} dias de atraso', dias(s.vencimento, p.pago_em))}</b></>}{(p.juros ?? 0) > 0 && <> {tx('e {0} de juros', fmtValor(p.juros!))}</>}.</>}
            {mudou && <small className="cc-aviso"> {tx('Você pagou {0}; depois disso a fatura mudou.', fmtValor(p.valor))}</small>}
          </span>
        </div>
      ) : s.valor > 0 && s.status !== 'futura' ? (
        <p className="ccd-quando">{s.status === 'atrasada' ? tx('Já venceu') : tx('Para pagar')}: <b>{quandoVence(s)}</b></p>
      ) : null}

      <PorCategoria s={s} c={c} />

      <div className="ccd-acoes">
        {podeResolver && <button className="btn primario" onClick={() => aoPagar(s)}><Icone nome="check" tamanho={16} /> {tx('Paguei a fatura')}</button>}
        {podeResolver && (
          <button className="btn" onClick={() => aoRenegociar(s)} disabled={c.cartoes.semExtras}
            title={c.cartoes.semExtras ? tx('Falta rodar a migração 9') : tx('O banco parcelou a fatura')}>
            <Icone nome="acordo" tamanho={16} /> {tx('Renegociar')}
          </button>
        )}
        {p && !renegociada(p) && <button className="btn" onClick={() => aoPagar(s, p)}><Icone nome="lapis" tamanho={16} /> {tx('Ajeitar pagamento')}</button>}
        {p && renegociada(p) && <button className="btn" onClick={() => aoRenegociar(s)}><Icone nome="acordo" tamanho={16} /> {tx('Ver renegociação')}</button>}
      </div>
    </section>
  )
}

/** Para onde foi a fatura: uma barra dividida pelas categorias das compras, com as maiores embaixo. */
function PorCategoria({ s, c }: { s: SituacaoCartao; c: Ctx }) {
  if (!s.compras.length || s.valor <= 0) return null
  const grupos = new Map<string, { nome: string; cor: string; valor: number }>()
  for (const l of s.compras) {
    const k = c.categoriaDe(l) ?? SEM_CATEGORIA
    const g = grupos.get(k.nome) ?? { nome: k.nome, cor: k.cor, valor: 0 }
    g.valor += l.valor
    grupos.set(k.nome, g)
  }
  const lista = [...grupos.values()].sort((a, b) => b.valor - a.valor)
  return (
    <div className="ccd-cats">
      <div className="ccd-cats-barra" aria-hidden="true">
        {lista.map((g, i) => <i key={g.nome} style={{ flexGrow: g.valor, background: g.cor, animationDelay: `${300 + i * 80}ms` }} />)}
      </div>
      <ul>
        {lista.slice(0, 4).map((g) => (
          <li key={g.nome}><i style={{ background: g.cor }} />{g.nome}<b>{Math.round((g.valor / s.valor) * 100)}%</b></li>
        ))}
      </ul>
    </div>
  )
}

/** Anel do limite: usado na cor do cartão, o garantido (caixinha) num arco por fora, e quanto sobra no meio. */
function Limite({ s, c, aoEditar }: { s: SituacaoCartao; c: Ctx; aoEditar: () => void }) {
  if (s.limiteTotal == null) {
    return (
      <section className="cartao ccd-limite sem">
        <span className="ccd-limite-icone"><Icone nome="escudo" tamanho={30} /></span>
        <p>{tx('Informe o limite do cartão para ver quanto ainda dá para gastar.')}</p>
        <button className="btn" onClick={aoEditar}>{tx('Informar limite')}</button>
      </section>
    )
  }
  const total = s.limiteTotal
  const usado = Math.min(1, s.limiteUsado / total)
  const garantido = Math.min(1, s.garantido / total)
  const livre = Math.max(0, s.limiteDisponivel ?? 0)
  const estourou = (s.limiteDisponivel ?? 0) < 0
  const cor = usado > 0.9 ? COR.saidas : s.cartao.cor
  return (
    <section className="cartao ccd-limite">
      <h3 className="ccd-titulo">{tx('Limite')}</h3>
      <div className="ccd-limite-corpo">
        <svg className="ccd-anel" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="46" className="ccd-anel-fundo" />
          {usado > 0 && <circle cx="60" cy="60" r="46" className="ccd-anel-usado" stroke={cor} pathLength={100} strokeDasharray={`${usado * 100} 100`} />}
          <circle cx="60" cy="60" r="56" className="ccd-anel-fundo fino" />
          {garantido > 0 && <circle cx="60" cy="60" r="56" className="ccd-anel-garantido" pathLength={100} strokeDasharray={`${garantido * 100} 100`} />}
        </svg>
        <span className="ccd-anel-meio">
          <small>{estourou ? tx('passou do limite') : tx('livre')}</small>
          <strong><Numero valor={estourou ? -(s.limiteDisponivel ?? 0) : livre} formato={fmtValor} /></strong>
          <small>{tx('de {0}', fmtValor(total))}</small>
        </span>
      </div>
      <ul className="ccd-legenda">
        <li><i style={{ background: cor }} />{tx('Usado')}<b>{fmtValor(s.limiteUsado)}</b></li>
        <li><i className="livre" />{tx('Livre')}<b>{fmtValor(livre)}</b></li>
        {s.garantido > 0 && <li><i className="garantido" />{tx('Garantido')}<b>{fmtValor(s.garantido)}</b></li>}
      </ul>
      {!c.cartoes.semExtras && (
        <button className="ccd-garantia" onClick={aoEditar}>
          <Icone nome="cofre" tamanho={18} />
          <span>
            {s.garantido > 0
              ? <>{tx('{0} da caixinha', fmtValor(s.garantido))} {s.cartao.garantia_caixinha ? (tx('do banco') + ' ') : ''}{tx('viram limite')}</>
              : <>{tx('Tem dinheiro numa caixinha que vira limite? Toque para somar.')}</>}
          </span>
          <Icone nome="dir" tamanho={16} />
        </button>
      )}
    </section>
  )
}

/** Barras da fatura do mês e das 6 seguintes (o que já está comprometido pelas parcelas). */
function Proximas({ s, c }: { s: SituacaoCartao; c: Ctx }) {
  const todas: Fatura[] = [s, ...s.proximas]
  const maior = Math.max(1, ...todas.map((f) => f.valor))
  const comprometido = centavos(s.proximas.reduce((a, f) => a + f.valor, 0))
  return (
    <section className="cartao ccd-proximas">
      <h3 className="ccd-titulo">{tx('Próximas faturas')} <small>{comprometido > 0 ? tx('{0} já comprometidos', fmtValor(comprometido)) : tx('nada comprometido')}</small></h3>
      <div className="ccd-barras">
        {todas.map((f, i) => (
          <div key={`${f.ano}-${f.mes}`} className={`ccd-barra ${i === 0 ? 'atual' : ''} ${f.valor ? '' : 'vazia'}`} title={`${nomeDaFatura(f.ano, f.mes, c.ano)}: ${fmtValor(f.valor)}`}>
            <span className="ccd-barra-valor">{f.valor ? fmtValor(f.valor).replace(/,\d\d$/, '') : '—'}</span>
            <span className="ccd-barra-trilho">
              <i style={{ height: `${Math.max(f.valor ? 6 : 0, (f.valor / maior) * 100)}%`, animationDelay: `${i * 60}ms` }} />
            </span>
            <span className="ccd-barra-mes">{noMeioDaFrase(MESES_CURTO[f.mes - 1])}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Parcelada({ p, aoAbrir }: { p: CompraParcelada; aoAbrir: () => void }) {
  const pagas = p.parcelas - p.restantes
  return (
    <li>
      <button type="button" className="ccd-parcelada-btn" onClick={aoAbrir} aria-label={tx('Abrir a compra {0}', p.descricao || '')}>
      <div className="ccd-parcelada-linha">
        <span className="item-desc">{p.descricao || tx('Compra')}</span>
        <b>{p.atual}/{p.parcelas}</b>
      </div>
      {p.parcelas <= 24 ? (
        <span className="ccd-pips" aria-hidden="true">
          {Array.from({ length: p.parcelas }, (_, i) => <i key={i} className={i < pagas ? 'paga' : i === pagas ? 'atual' : ''} style={{ animationDelay: `${i * 25}ms` }} />)}
        </span>
      ) : (
        <span className="ccd-pips longo" aria-hidden="true"><i className="paga" style={{ width: `${(pagas / p.parcelas) * 100}%` }} /></span>
      )}
      <small>{tx('{0}/mês · faltam {1} · até {2}', fmtValor(p.valorParcela), fmtValor(p.valorRestante), sufixoMes(p.termina.ano, p.termina.mes))}</small>
      </button>
    </li>
  )
}

function FormCartao({ c, cartao, aoFechar }: { c: Ctx; cartao?: CartaoCredito; aoFechar: () => void }) {
  const [nome, setNome] = useState(cartao?.nome ?? '')
  const [cor, setCor] = useState(cartao?.cor ?? CORES_LIVRES[0])
  const [fecha, setFecha] = useState(cartao ? String(cartao.dia_fechamento) : '')
  const [vence, setVence] = useState(cartao ? String(cartao.dia_vencimento) : '')
  const [limite, setLimite] = useState(cartao?.limite ? paraCampo(cartao.limite) : '')
  const [bancoId, setBancoId] = useState(cartao?.banco_id ?? '')
  const [ativo, setAtivo] = useState(cartao?.ativo ?? true)
  const [comGarantia, setComGarantia] = useState(Boolean(cartao?.garantia_caixinha || cartao?.limite_garantido))
  const [daCaixinha, setDaCaixinha] = useState(Boolean(cartao?.garantia_caixinha))
  const [garantido, setGarantido] = useState(cartao?.limite_garantido ? paraCampo(cartao.limite_garantido) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const bancos = c.d.bancos
  const sugestoes = CATALOGO_BANCOS.filter((b) => !b.nome.startsWith(tx('Carteira'))).slice(0, 12)
  const caixinha = bancoId ? c.mesEf.caixa[bancoId]?.caixinha ?? 0 : 0
  const podeCaixinha = c.v.bancos && Boolean(bancoId)

  const escolherSugestao = (b: (typeof sugestoes)[number]) => {
    setNome(b.nome)
    setCor(b.cor)
    const meu = bancos.find((x) => mesmoNome(x.nome, b.nome))
    if (meu) setBancoId(meu.id)
  }

  const salvar = async () => {
    if (!nome.trim()) return setErro(tx('Dê um nome para o cartão.'))
    if (!fecha || !vence) return setErro(tx('Escolha o dia em que a fatura fecha e o dia em que vence.'))
    const lim = limite.trim() ? parseNumero(limite) : null
    if (limite.trim() && (!lim || lim <= 0)) return setErro(tx('Limite inválido.'))
    const gar = comGarantia && !daCaixinha && garantido.trim() ? parseNumero(garantido) : 0
    if (gar == null || gar < 0) return setErro(tx('Valor da caixinha inválido.'))
    const dados = {
      nome: nome.trim(), cor, banco_id: bancoId || null, limite: lim,
      dia_fechamento: Number(fecha), dia_vencimento: Number(vence), ativo,
      limite_garantido: gar, garantia_caixinha: comGarantia && daCaixinha && podeCaixinha,
    }
    if (cartao) await c.cartoes.updCartao(cartao.id, dados)
    else await c.cartoes.addCartao(dados)
    aoFechar()
  }

  return (
    <Modal titulo={cartao ? tx('Editar cartão') : tx('Novo cartão')} aoFechar={aoFechar} tamanho="tela" cor={cor} palco={
      <div className="cc-form-previa">
        <CartaoIlustrado nome={nome.trim() || tx('Seu cartão')} cor={cor} banco={bancos.find((b) => b.id === bancoId)?.nome}
          rodape={<>{fecha ? tx('fecha dia {0}', fecha) : tx('fecha dia —')} · {vence ? tx('vence dia {0}', vence) : tx('vence dia —')}</>}
          conteudo={parseNumero(limite) ? <span className="cc-plastico-fatura"><small>{tx('limite')}</small><b>{fmtValor(parseNumero(limite)!)}</b></span> : undefined} />
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {!cartao && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Escolha rápida')}</span>
            <div className="cc-sugestoes">
              {sugestoes.map((b) => (
                <button key={b.nome} type="button" className={`cc-sugestao ${nome === b.nome ? 'ativo' : ''}`} onClick={() => escolherSugestao(b)}>
                  <BancoIcone nome={b.nome} cor={b.cor} tamanho={30} />
                  <span>{b.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">{tx('Nome do cartão')}</span>
          <input autoFocus={Boolean(cartao)} value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} maxLength={40} placeholder={tx('Ex.: Nubank, Itaú Platinum…')} />
        </label>
        <div className="campo">
          <span className="campo-rotulo">{tx('Cor')}</span>
          <div className="chips" role="radiogroup" aria-label={tx('Cor')}>
            {[...new Set([cor, ...CORES_LIVRES, ...CATALOGO_BANCOS.map((b) => b.cor)])].slice(0, 16).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
                style={{ background: k }} onClick={() => setCor(k)} />
            ))}
          </div>
        </div>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Dia que a fatura fecha')}</span>
            <select value={fecha} onChange={(e) => { setFecha(e.target.value); setErro(null) }}>
              <option value="">{tx('Escolher…')}</option>
              {DIAS.map((d) => <option key={d} value={d}>{tx('dia {0}', d)}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Dia que vence')}</span>
            <select value={vence} onChange={(e) => { setVence(e.target.value); setErro(null) }}>
              <option value="">{tx('Escolher…')}</option>
              {DIAS.map((d) => <option key={d} value={d}>{tx('dia {0}', d)}</option>)}
            </select>
          </label>
        </div>
        <span className="campo-ajuda">{tx('Os dois dias aparecem no app do seu banco. Compras feitas depois do dia que fecha entram na fatura do mês seguinte.')}{cartao && (' ' + tx('Mudar os dias vale para as próximas compras; as que você já lançou ficam onde estão.'))}</span>
        <label className="campo">
          <span className="campo-rotulo">{tx('Limite')} <small>(opcional)</small></span>
          <span className="campo-caixa">
            <span className="prefixo">{simbolo()}</span>
            <input inputMode="decimal" value={limite} onChange={(e) => setLimite(mascarar(e.target.value, casasDaMoeda(moedaAtual())))} placeholder="0,00" />
          </span>
        </label>
        {bancos.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">{tx('Banco do cartão')} <small>(opcional)</small></span>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">{tx('Nenhum')}</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </label>
        )}
        {!c.cartoes.semExtras && (
          <div className="cc-garantia-form">
            <div className="cc-uso">
              <span><Icone nome="cofre" tamanho={18} /> {tx('Limite garantido')}<small>{tx('Dinheiro guardado numa caixinha do banco que vira limite extra no cartão.')}</small></span>
              <Interruptor ligado={comGarantia} aoMudar={setComGarantia} rotulo={tx('Limite garantido')} />
            </div>
            {comGarantia && (
              <>
                {podeCaixinha && (
                  <div className="chips">
                    <button type="button" className={`chip ${daCaixinha ? 'ativo' : ''}`} onClick={() => setDaCaixinha(true)}>
                      {tx('Usar a caixinha do banco ({0})', fmtValor(caixinha))}
                    </button>
                    <button type="button" className={`chip ${!daCaixinha ? 'ativo' : ''}`} onClick={() => setDaCaixinha(false)}>{tx('Valor fixo')}</button>
                  </div>
                )}
                {(!daCaixinha || !podeCaixinha) && (
                  <label className="campo">
                    <span className="campo-rotulo">{tx('Quanto está na caixinha')}</span>
                    <span className="campo-caixa">
                      <span className="prefixo">{simbolo()}</span>
                      <input inputMode="decimal" value={garantido} onChange={(e) => setGarantido(mascarar(e.target.value, casasDaMoeda(moedaAtual())))} placeholder="0,00" />
                    </span>
                  </label>
                )}
                <span className="campo-ajuda">
                  {daCaixinha && podeCaixinha
                    ? tx('O limite acompanha a caixinha que você informa em Dinheiro guardado: guardou mais, o limite cresce sozinho.')
                    : bancos.length > 0 && c.v.bancos ? tx('Escolhendo o banco do cartão, dá para ligar o limite à caixinha dele.') : tx('Some este valor ao limite do cartão.')}
                </span>
              </>
            )}
          </div>
        )}
        {cartao && (
          <div className="cc-uso">
            <span>{tx('Ainda uso este cartão')}<small>{tx('Se desligar, ele some das telas, mas o histórico fica.')}</small></span>
            <Interruptor ligado={ativo} aoMudar={setAtivo} rotulo={tx('Ainda uso este cartão')} />
          </div>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {cartao && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.cartoes.delCartao(cartao.id); aoFechar() }}>{tx('Excluir mesmo')}</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>{tx('Excluir')}</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{cartao ? tx('Salvar') : tx('Criar cartão')}</button>
        </div>
        {confirmar && <span className="campo-ajuda">{tx('As compras continuam nas suas saídas, só deixam de ser ligadas a este cartão. As faturas marcadas como pagas são esquecidas.')}</span>}
      </form>
    </Modal>
  )
}

/** Saída dos juros e multa de uma fatura paga com atraso (na categoria de dívidas, no mês em que foi paga). */
const lancamentoDosJuros = (c: Ctx, cartao: CartaoCredito, f: Fatura, juros: number, pagoEm: string, bancoId: string | null) => ({
  ...anoMesDe(pagoEm),
  tipo: 'saida' as const,
  descricao: tx('Juros e multa – fatura {0} de {1}', cartao.nome, nomeDaFatura(f.ano, f.mes)),
  valor: juros,
  data: pagoEm,
  categoria_id: c.categorias.find((k) => k.papel === 'divida')?.id ?? null,
  banco_id: bancoId,
})

/** Pagar a fatura (ou ajeitar um pagamento já feito): dia, valor, banco, e juros/multa quando pagou com atraso. */
function FormPagarFatura({ c, alvo, aoFechar }: { c: Ctx; alvo: Alvo; aoFechar: () => void }) {
  const { cartao, f, pagamento } = alvo
  const [data, setData] = useState(pagamento?.pago_em ?? hojeLocal())
  const [valor, setValor] = useState(paraCampo(pagamento?.valor ?? f.valor))
  const [juros, setJuros] = useState(pagamento?.juros ? paraCampo(pagamento.juros) : '')
  const [bancoId, setBancoId] = useState(pagamento?.banco_id ?? cartao.banco_id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [desfazer, setDesfazer] = useState(false)
  const bancos = c.v.bancos ? c.d.bancos : []
  const atraso = data > f.vencimento ? dias(f.vencimento, data) : 0
  const semExtras = c.cartoes.semExtras

  const salvar = async () => {
    const v = parseNumero(valor)
    const j = juros.trim() ? parseNumero(juros) : 0
    if (!v || v <= 0) return setErro(tx('Valor inválido.'))
    if (j == null || j < 0) return setErro(tx('Juros inválidos.'))
    const pagoEm = data || hojeLocal()
    aoFechar()
    if (!pagamento) {
      const lanc = j > 0 && !semExtras ? await c.d.addLanc(lancamentoDosJuros(c, cartao, f, j, pagoEm, bancoId || null)) : undefined
      await c.cartoes.pagarFatura({
        cartao_id: cartao.id, ano: f.ano, mes: f.mes, valor: v, pago_em: pagoEm, banco_id: bancoId || null,
        tipo: 'paga', juros: j, juros_lanc_id: lanc?.id ?? null,
      })
      return
    }
    // ajeitando: a saída dos juros acompanha o que mudou
    let jurosLanc = pagamento.juros_lanc_id ?? null
    if (!semExtras) {
      if (j > 0 && jurosLanc) await c.d.updLanc(jurosLanc, { valor: j, data: pagoEm, ...anoMesDe(pagoEm), banco_id: bancoId || null })
      else if (j > 0) jurosLanc = (await c.d.addLanc(lancamentoDosJuros(c, cartao, f, j, pagoEm, bancoId || null)))?.id ?? null
      else if (jurosLanc) {
        await c.d.delLanc(jurosLanc)
        jurosLanc = null
      }
    }
    await c.cartoes.editarPagamento(pagamento.id, { valor: v, pago_em: pagoEm, banco_id: bancoId || null, juros: j, juros_lanc_id: jurosLanc })
  }

  const desfazerPagamento = async () => {
    if (!pagamento) return
    aoFechar()
    if (pagamento.juros_lanc_id) await c.d.delLanc(pagamento.juros_lanc_id)
    await c.cartoes.desfazerPagamento(pagamento.id)
  }

  return (
    <Modal titulo={pagamento ? tx('Ajeitar pagamento') : tx('Pagar fatura {0}', cartao.nome)} aoFechar={aoFechar} tamanho="tela" cor={cartao.cor} palco={
      <div className="cc-confirma palco-fatura">
        <span className="cc-confirma-quem"><BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={34} /><span>{tx('Fatura de {0}', nomeDaFatura(f.ano, f.mes, c.ano))}<small>{tx('{0} em {1}', f.vencimento < hojeLocal() ? tx('venceu') : tx('vence'), fmtDataLonga(f.vencimento))}</small></span></span>
        <strong>{fmtValor(f.valor)}</strong>
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Dia do pagamento')}</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Quanto pagou')}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo()}</span>
              <input inputMode="decimal" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moedaAtual()))); setErro(null) }} />
            </span>
          </label>
        </div>
        {atraso > 0 && (
          <div className="cc-atraso">
            <Icone nome="relogio" tamanho={18} />
            <span>{tx('Pago')} <b>{tx('{0} {1} depois', atraso, atraso === 1 ? tx('dia') : tx('dias'))}</b> {tx('do vencimento.')}{!semExtras && (' ' + tx('Se teve juros ou multa, coloque aqui: eles entram como uma saída do mês do pagamento.'))}</span>
          </div>
        )}
        {!semExtras && (atraso > 0 || (pagamento?.juros ?? 0) > 0) && (
          <label className="campo">
            <span className="campo-rotulo">{tx('Juros e multa')} <small>(opcional)</small></span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo()}</span>
              <input inputMode="decimal" value={juros} onChange={(e) => { setJuros(mascarar(e.target.value, casasDaMoeda(moedaAtual()))); setErro(null) }} placeholder="0,00" />
            </span>
          </label>
        )}
        {bancos.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">{tx('De qual banco saiu?')} <small>(opcional)</small></span>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">{tx('Não sei / não importa')}</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </label>
        )}
        <span className="campo-ajuda">
          {tx('Isso marca a fatura como paga. O gasto de cada compra já está nas suas saídas de {0}, então nada é contado duas vezes.', noMeioDaFrase(MESES_NOME[f.mes - 1]))}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {pagamento && (desfazer
            ? <button type="button" className="btn perigo" onClick={() => void desfazerPagamento()}>{tx('Desfazer mesmo')}</button>
            : <button type="button" className="btn perigo" onClick={() => setDesfazer(true)}><Icone nome="desfazer" tamanho={15} /> {tx('Desfazer')}</button>)}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{pagamento ? tx('Salvar') : tx('Marcar como paga')}</button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Renegociar a fatura: o banco transformou o que você devia em parcelas. Cria uma dívida (com as parcelas e o total,
 * juros inclusos) e marca a fatura como renegociada; as compras dela deixam de contar nas saídas do mês e o que passa a
 * contar é cada parcela paga da dívida. Aberto numa fatura já renegociada, mostra o acordo e deixa desfazer.
 */
function FormRenegociar({ c, alvo, aoFechar }: { c: Ctx; alvo: Alvo; aoFechar: () => void }) {
  const { cartao, f } = alvo
  const feita = f.paga && renegociada(f.paga) ? f.paga : null
  const divida = feita?.divida_id ? c.d.dividas.find((x) => x.id === feita.divida_id) : undefined
  const [n, setN] = useState('6')
  const [total, setTotal] = useState(paraCampo(f.valor))
  const [data, setData] = useState(hojeLocal())
  const [erro, setErro] = useState<string | null>(null)
  const [desfazer, setDesfazer] = useState(false)
  const tot = parseNumero(total) ?? 0
  const parcelas = Math.max(1, Math.min(120, Number(n) || 1))
  const parcela = centavos(tot / parcelas)
  const acrescimo = centavos(Math.max(0, tot - f.valor))

  const salvar = async () => {
    if (!tot || tot <= 0) return setErro(tx('Valor total inválido.'))
    aoFechar()
    if (!c.v.dividas) c.ligarModulo('dividas')
    const d = await c.d.addDivida({
      descricao: tx('Fatura {0} de {1} (renegociada)', cartao.nome, nomeDaFatura(f.ano, f.mes)),
      valor_parcela: parcela, saldo: tot, data: data || hojeLocal(),
      // a 1ª parcela do acordo vence no mês seguinte, no dia do vencimento do cartão
      sentido: 'devo', pessoa: cartao.nome, total_parcelas: parcelas,
      inicio: somaMesesData(`${(data || hojeLocal()).slice(0, 8)}${String(Math.min(cartao.dia_vencimento, 28)).padStart(2, '0')}`, 1),
    })
    if (!d) return
    await c.cartoes.pagarFatura({
      cartao_id: cartao.id, ano: f.ano, mes: f.mes, valor: f.valor, pago_em: data || hojeLocal(),
      tipo: 'renegociada', divida_id: d.id, juros: acrescimo,
    })
  }

  const desfazerAcordo = async () => {
    if (!feita) return
    aoFechar()
    // a dívida só vai junto se nada foi pago nela ainda; com parcelas pagas, ela fica (e o histórico também)
    if (feita.divida_id && !c.d.pagamentos.some((p) => p.divida_id === feita.divida_id)) await c.d.delDivida(feita.divida_id)
    await c.cartoes.desfazerPagamento(feita.id)
  }

  if (feita) {
    const pagos = c.d.pagamentos.filter((p) => p.divida_id === feita.divida_id)
    return (
      <Modal titulo={tx('Fatura renegociada')} aoFechar={aoFechar}>
        <div className="form">
          <div className="cc-confirma">
            <span className="cc-confirma-quem"><BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={34} /><span>{tx('Fatura de {0}', nomeDaFatura(f.ano, f.mes, c.ano))}<small>{tx('renegociada em {0}', fmtDataLonga(feita.pago_em))}</small></span></span>
            <strong>{fmtValor(f.valor)}</strong>
          </div>
          <p className="campo-ajuda">
            {divida
              ? <>{tx('Virou a dívida')} <b>{divida.descricao}</b>{divida.valor_parcela ? <>{tx(', em parcelas de {0}', fmtValor(divida.valor_parcela))}</> : null}{(feita.juros ?? 0) > 0 && <>{tx(', com {0} de acréscimo', fmtValor(feita.juros!))}</>}. {pagos.length ? (pagos.length === 1 ? tx('1 parcela paga até agora.') : tx('{0} parcelas pagas até agora.', pagos.length)) : tx('Nenhuma parcela paga ainda.')}</>
              : tx('A dívida desta renegociação foi apagada.')}
          </p>
          <p className="campo-ajuda">{tx('Desfazer devolve as compras às saídas do mês da fatura')}{pagos.length ? tx('; a dívida fica, porque já tem parcelas pagas') : (' ' + tx('e apaga a dívida criada'))}.</p>
          <div className="form-acoes">
            {desfazer
              ? <button type="button" className="btn perigo" onClick={() => void desfazerAcordo()}>{tx('Desfazer mesmo')}</button>
              : <button type="button" className="btn perigo" onClick={() => setDesfazer(true)}><Icone nome="desfazer" tamanho={15} /> {tx('Desfazer')}</button>}
            <span className="espaco" />
            {divida && <button type="button" className="btn" onClick={() => { aoFechar(); c.irPara('dividas') }}>{tx('Ver dívida')}</button>}
            <button type="button" className="btn primario" onClick={aoFechar}>{tx('Fechar')}</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo={tx('Renegociar fatura {0}', cartao.nome)} aoFechar={aoFechar} tamanho="tela" cor={cartao.cor} palco={
      <div className="cc-confirma palco-fatura">
        <span className="cc-confirma-quem"><BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={34} /><span>{tx('Fatura de {0}', nomeDaFatura(f.ano, f.mes, c.ano))}<small>{f.status === 'atrasada' ? tx('venceu em {0}', fmtDataLonga(f.vencimento)) : tx('vence em {0}', fmtDataLonga(f.vencimento))}</small></span></span>
        <strong>{fmtValor(f.valor)}</strong>
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Total do acordo')}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo()}</span>
              <input inputMode="decimal" value={total} onChange={(e) => { setTotal(mascarar(e.target.value, casasDaMoeda(moedaAtual()))); setErro(null) }} />
            </span>
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Em quantas parcelas')}</span>
            <input type="number" min={1} max={120} value={n} onChange={(e) => setN(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span className="campo-rotulo">{tx('Dia do acordo')}</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <div className="cc-acordo-resumo">
          <span><small>{tx('parcela')}</small><b>{tx('{0}x {1}', parcelas, fmtValor(parcela))}</b></span>
          <span><small>{tx('acréscimo')}</small><b className={acrescimo > 0 ? 'ruim' : ''}>{fmtValor(acrescimo)}</b></span>
          <span><small>{tx('a mais')}</small><b className={acrescimo > 0 ? 'ruim' : ''}>{f.valor ? `${Math.round((acrescimo / f.valor) * 100)}%` : '—'}</b></span>
        </div>
        <span className="campo-ajuda">
          {tx('Vira uma dívida em Dívidas. As compras desta fatura saem das saídas de {0}, e cada parcela que você pagar entra como saída no mês em que pagar. Assim nada conta duas vezes.', noMeioDaFrase(MESES_NOME[f.mes - 1]))}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario"><Icone nome="acordo" tamanho={16} /> {tx('Renegociar')}</button>
        </div>
      </form>
    </Modal>
  )
}
