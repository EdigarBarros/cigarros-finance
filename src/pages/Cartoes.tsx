import { casasDaMoeda, mascarar } from '../lib/dinheiro'
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { criarBusca } from '../lib/busca'
import { CATALOGO_BANCOS } from '../lib/bancos'
import { mesEfetivo } from '../lib/calc'
import {
  casaCompraNoCartao, chaveDaCompra, datasDaFatura, efeitoNaCaixinha, ehCompraNoCartao, faturaDoMes, hojeLocal, nomeDaFatura, pagaComAtraso, pularParcela,
  quandoVence, renegociada, somaMeses, taxaParaPular, textoStatus, totalFaturasAPagar, totalFaturasDoMes, voltarParcela,
  type CompraParcelada, type Fatura, type SituacaoCartao,
} from '../lib/cartoes'
import { mesJaChegou } from '../lib/guardado'
import { COR } from '../lib/charts'
import { somaMesesData } from '../lib/dividas'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtDataCurta, fmtDataLonga, fmtValor, MESES_CURTO, MESES_NOME, moedaAtual, paraCampo, parseNumero, simbolo, noMeioDaFrase } from '../lib/format'
import { CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import { semMovimento } from '../lib/tema'
import type { CartaoCredito, FaturaPaga, FaturaParcial, Lancamento } from '../lib/types'
import { BancoIcone } from '../components/BancoIcone'
import type { Nivel } from '../components/Vitrine'
import { CartaoIlustrado } from '../components/CartaoIlustrado'
import { Carteira3D, moverCarteira, quadroDaVaga, quadroDe, quantoAparece, sairDaCarteira, voltarParaCarteira, type VagaDaCarteira } from '../components/Carteira3D'
import { Selo } from '../components/Categorias'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { Cartao, Interruptor, Modal, Vazio } from '../components/ui'
import { confirmar } from '../lib/avisos'
import { CampoData, Seletor } from '../components/Escolhas'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import { naHoraDePagarParte, naHoraDePular } from '../lib/naHora'
import { AvisoDoConsultor } from '../components/AvisoDoConsultor'
import './cartoes-pc.css'
import { estornoTotal, foiEstornado, valorAntesDoEstorno } from '../lib/estorno'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const sufixoMes = (ano: number, mes: number) => `${noMeioDaFrase(MESES_CURTO[mes - 1])}/${String(ano).slice(2)}`
const centavos = (n: number) => Math.round(n * 100) / 100
/** Dias de b menos a (datas ISO). */
const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
const anoMesDe = (iso: string) => ({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) })

/** Uma fatura escolhida para pagar, renegociar ou ajeitar (`parcial`: um pagamento de parte dela). */
export interface Alvo { cartao: CartaoCredito; f: Fatura; pagamento?: FaturaPaga; parcial?: FaturaParcial }
/** "pulada de novembro": de qual fatura a compra veio. */
const puladaDe = (l: Lancamento, anoRef: number) => (l.pulada_de ? tx('pulada de {0}', nomeDaFatura(Number(l.pulada_de.slice(0, 4)), Number(l.pulada_de.slice(5, 7)), anoRef)) : null)

/**
 * Cartões de crédito: a carteira com os cartões desenhados e, do cartão escolhido, a fatura do mês, o limite (com o
 * garantido da caixinha), as faturas que atrasaram, as próximas, as parceladas e o histórico do que já foi pago ou
 * renegociado. Renegociar cria uma dívida; juros de atraso viram uma saída.
 */
type Aba = 'fatura' | 'compras' | 'resolvidas' | 'proximas' | 'limite'
const CHAVE_ABA = 'opus.cartoes.aba'
const abaGuardada = (): Aba => {
  try {
    const v = localStorage.getItem(CHAVE_ABA)
    return (['fatura', 'compras', 'resolvidas', 'proximas', 'limite'] as const).find((a) => a === v) ?? 'fatura'
  } catch { return 'fatura' }
}

/**
 * Tela Cartões do computador: a carteira de couro com os cartões. Escolher um tira o cartão da carteira (a carteira
 * encolhe para o lado) e mostra as coisas dele em abas: fatura, compras, faturas pagas e renegociadas, próximas e
 * parceladas, limite e caixinha. "Guardar na carteira" (ou Esc) devolve. O celular usa `CartoesMovel`.
 */
export function Cartoes(c: Ctx) {
  const [editando, setEditando] = useState<CartaoCredito | 'novo' | null>(null)
  const [pagando, setPagando] = useState<Alvo | null>(null)
  const [renegociando, setRenegociando] = useState<Alvo | null>(null)
  // vem da compra que acabou de ser lançada (tela Lançamentos): abre direto no cartão dela, nas compras
  const [escolhido, setEscolhido] = useState<string | null>(c.cartaoAberto)
  const [aba, setAba] = useState<Aba>(() => (c.compraDestacada ? 'compras' : abaGuardada()))
  const [verArquivados, setVerArquivados] = useState(false)
  const { cartoes, faturas } = c
  const arquivados = cartoes.cartoes.filter((x) => !x.ativo)
  const s = faturas.find((x) => x.cartao.id === escolhido) ?? null
  // Acabou de lançar uma compra (tela Lançamentos): quando ela já está na fatura (a gravação pode demorar um pouco), rola até
  // ela uma vez só, deixa o destaque aceso por alguns segundos e o apaga (trocar de cartão não repete nada).
  const [destacada, setDestacada] = useState<string | null>(c.compraDestacada)
  const jaRolou = useRef(false)
  const apareceu = Boolean(destacada && aba === 'compras' && s?.compras.some((l) => l.compra_id === destacada))
  useEffect(() => {
    if (!apareceu || jaRolou.current) return
    jaRolou.current = true
    const rolar = window.setTimeout(() => document.querySelector('.ccd-compras .compra-nova')?.scrollIntoView({ block: 'center', behavior: semMovimento() ? 'auto' : 'smooth' }), 1000)
    const apagar = window.setTimeout(() => setDestacada(null), 4200)
    return () => { window.clearTimeout(rolar); window.clearTimeout(apagar) }
  }, [apareceu])

  // ---------- o cartão saindo e voltando da carteira ----------
  const carteira = useRef<HTMLDivElement>(null)
  const grande = useRef<HTMLDivElement>(null)
  const topo = useRef<HTMLDivElement>(null)
  const voo = useRef<{ carteira: ReturnType<typeof quadroDe>; sai?: { id: string; de: NonNullable<ReturnType<typeof quadroDe>>; aparece: number }; volta?: { id: string; de: NonNullable<ReturnType<typeof quadroDe>> } } | null>(null)
  const trocar = (novo: string | null) => {
    if (novo === escolhido) return
    if (!semMovimento()) {
      // trocando de cartão lá embaixo na página: volta ao topo antes, para ver o cartão sair
      const t = topo.current?.getBoundingClientRect().top ?? 0
      if (escolhido && novo && t < 0) topo.current?.scrollIntoView({ block: 'start' })
      const de = novo ? quadroDaVaga(carteira.current, novo) : null
      const antes = grande.current?.querySelector('.cc-plastico')
      const deGrande = quadroDe(antes)
      voo.current = {
        carteira: quadroDe(carteira.current),
        sai: novo && de ? { id: novo, de, aparece: quantoAparece(carteira.current, novo) } : undefined,
        volta: escolhido && deGrande ? { id: escolhido, de: deGrande } : undefined,
      }
    }
    setEscolhido(novo)
  }
  useLayoutEffect(() => {
    const v = voo.current
    voo.current = null
    if (!v) return
    moverCarteira(carteira.current, v.carteira)
    if (v.volta) voltarParaCarteira(carteira.current, v.volta.id, v.volta.de)
    const el = grande.current?.querySelector<HTMLElement>('.ccx-voo')
    if (v.sai && el) sairDaCarteira(el, v.sai.de, v.sai.aparece)
  }, [escolhido])
  // Esc guarda o cartão (quando não há janela aberta por cima)
  useEffect(() => {
    if (!escolhido) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[role="dialog"]')) return
      trocar(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })
  const escolherAba = (a: Aba) => {
    setAba(a)
    try { localStorage.setItem(CHAVE_ABA, a) } catch { /* sem armazenamento: só não lembra */ }
  }

  const nivel = c.perfil.detalhe

  if (cartoes.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>{tx('Cartões')}</h1></div></header>
        <Cartao><Vazio>{tx('Para usar cartões de crédito, falta atualizar o banco de dados: rode')} <code>supabase/migracao-08-cartoes.sql</code> {tx('no SQL Editor do Supabase.')}</Vazio></Cartao>
      </div>
    )
  }

  const vagas: VagaDaCarteira[] = faturas.map((x) => ({
    id: x.cartao.id, nome: x.cartao.nome, cor: x.cartao.cor, banco: c.d.bancos.find((b) => b.id === x.cartao.banco_id)?.nome,
    rotulo: tx('fatura de {0}', nomeDaFatura(x.ano, x.mes, c.ano)), valor: fmtValor(x.valor),
    estado: x.atrasadas.length ? 'atrasada' : x.status, textoEstado: textoStatus(x),
    rodape: <>{tx('fecha dia {0} · vence dia {1}', x.cartao.dia_fechamento, x.cartao.dia_vencimento)}</>,
  }))

  return (
    <div className="pagina pg-cartoes pg-cartoes-pc">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Cartões')}</h1>
          <p className="sub">{s ? tx('Fatura de {0}, compras, pagamentos e limite do {1}.', nomeDaFatura(s.ano, s.mes, c.ano), s.cartao.nome) : tx('Escolha um cartão na carteira para ver a fatura, as compras e o limite dele.')}</p>
        </div>
      </header>

      {cartoes.semExtras && cartoes.carregado && cartoes.cartoes.length > 0 && (
        <p className="cc-aviso-migracao">
          <Icone nome="ideia" tamanho={16} />
          <span>{tx('Para renegociar faturas, registrar juros de atraso e usar limite garantido, rode')} <code>supabase/migracao-09-cartoes-extras.sql</code> {tx('no SQL Editor do Supabase.')}</span>
        </p>
      )}

      {c.busca.trim() && cartoes.carregado && <ResultadoDaBusca c={c} />}

      {cartoes.carregado && !cartoes.cartoes.length && <SemCartoes aoCriar={() => setEditando('novo')} />}

      {faturas.length > 0 && (
        <div ref={topo} className={`ccx ${s ? 'com-cartao' : ''}`}>
          <aside className="ccx-lado">
            <Carteira3D ref={carteira} vagas={vagas} titular={c.perfil.nome} fora={s?.cartao.id ?? null} compacta={Boolean(s)}
              aoEscolher={(id) => trocar(id === escolhido ? null : id)} aoNovo={() => setEditando('novo')} />
            {arquivados.length > 0 && (
              <div className="ccx-arquivados">
                <button type="button" className="link" onClick={() => setVerArquivados(!verArquivados)} aria-expanded={verArquivados}>
                  <Icone nome="cofre" tamanho={14} /> {tx('Cartões que você não usa mais ({0})', arquivados.length)}
                </button>
                {verArquivados && (
                  <ul className="cc-arquivados">
                    {arquivados.map((x) => (
                      <li key={x.id}>
                        <button onClick={() => setEditando(x)}>
                          <BancoIcone nome={x.nome} cor={x.cor} tamanho={26} />
                          <span>{x.nome}</span>
                          <Icone nome="lapis" tamanho={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>

          <div className="ccx-palco">
            {s ? (
              <DetalheEmAbas key={s.cartao.id} ref={grande} s={s} c={c} aba={aba} aoAba={escolherAba} destacada={destacada} nivel={nivel}
                aoGuardar={() => trocar(null)}
                aoEditar={() => setEditando(s.cartao)}
                aoPagar={(f, pagamento, parcial) => setPagando({ cartao: s.cartao, f, pagamento, parcial })}
                aoRenegociar={(f) => setRenegociando({ cartao: s.cartao, f })} />
            ) : (
              <div className="ccx-resumo">
                <ResumoDosCartoes faturas={faturas} c={c} aoAbrir={(id, a) => { if (a) escolherAba(a); trocar(id) }} />
              </div>
            )}
          </div>
        </div>
      )}

      {editando && <FormCartao c={c} cartao={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {pagando && <FormPagarFatura c={c} alvo={pagando} aoFechar={() => setPagando(null)} />}
      {renegociando && <FormRenegociar c={c} alvo={renegociando} aoFechar={() => setRenegociando(null)} />}
    </div>
  )
}

/**
 * Ao lado da carteira fechada (computador): o total das faturas do mês, falta pagar, limite livre e o atrasado, e uma linha
 * por cartão com a fatura, a situação e quanto do limite sobra. Clicar numa linha tira aquele cartão da carteira.
 */
function ResumoDosCartoes({ faturas, c, aoAbrir }: { faturas: SituacaoCartao[]; c: Ctx; aoAbrir: (id: string, aba?: Aba) => void }) {
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  const comLimite = faturas.filter((x) => x.limiteTotal !== null)
  const livre = centavos(comLimite.reduce((a, x) => a + Math.max(0, x.limiteDisponivel ?? 0), 0))
  const limiteTotal = centavos(comLimite.reduce((a, x) => a + (x.limiteTotal ?? 0), 0))
  const atrasadas = faturas.flatMap((x) => [...x.atrasadas, ...(x.status === 'atrasada' ? [x] : [])])
  const emAtraso = centavos(atrasadas.reduce((a, f) => a + f.falta, 0))
  const comAtraso = faturas.filter((x) => x.atrasadas.length > 0 || x.status === 'atrasada')
  const total = totalFaturasDoMes(faturas)
  const partes = faturas.filter((x) => x.valor > 0)
  return (
    <section className="cxr" aria-label={tx('Faturas de {0}', nomeMes)}>
      <header className="cxr-topo">
        <div className="cxr-total">
          <span className="cxr-rotulo"><Icone nome="cartao" tamanho={15} /> {tx('Faturas de {0}', nomeMes)}</span>
          <strong><Numero valor={total} formato={fmtValor} /></strong>
          <small>{faturas.length === 1 ? tx('1 cartão') : tx('{0} cartões', faturas.length)}</small>
        </div>
        <dl className="cxr-numeros">
          <div><dt><Icone nome="relogio" tamanho={14} /> {tx('Falta pagar')}</dt><dd>{fmtValor(totalFaturasAPagar(faturas))}</dd></div>
          {comLimite.length > 0 && <div><dt><Icone nome="escudo" tamanho={14} /> {tx('Limite livre')}</dt><dd>{fmtValor(livre)}<small>{tx('de {0}', fmtValor(limiteTotal))}</small></dd></div>}
          {emAtraso > 0 && <div className="ruim"><dt><Icone nome="sino" tamanho={14} /> {tx('Em atraso')}</dt><dd>{fmtValor(emAtraso)}</dd></div>}
        </dl>
      </header>

      {partes.length > 1 && total > 0 && (
        <div className="cxr-divide" role="img" aria-label={partes.map((x) => `${x.cartao.nome}: ${fmtValor(x.valor)}`).join(', ')}>
          {partes.map((x) => <i key={x.cartao.id} style={{ flexGrow: x.valor, '--c': x.cartao.cor } as React.CSSProperties} title={`${x.cartao.nome}: ${fmtValor(x.valor)}`} />)}
        </div>
      )}

      {comAtraso.length > 0 && (
        <div className="ccx-alerta" role="group" aria-label={tx('Faturas que venceram sem pagar')}>
          <Icone nome="sino" tamanho={16} />
          <span>{atrasadas.length === 1 ? tx('Uma fatura venceu sem pagar.') : tx('{0} faturas venceram sem pagar.', atrasadas.length)}</span>
          <span className="espaco" />
          {comAtraso.map((x) => (
            <button key={x.cartao.id} type="button" className="btn" onClick={() => aoAbrir(x.cartao.id, 'fatura')}>
              <BancoIcone nome={x.cartao.nome} cor={x.cartao.cor} tamanho={18} /> {tx('Resolver no {0}', x.cartao.nome)}
            </button>
          ))}
        </div>
      )}

      <ul className="cxr-lista">
        {faturas.map((x, i) => {
          const lim = x.limiteTotal
          const uso = lim ? Math.min(1, Math.max(0, x.limiteUsado / lim)) : 0
          const estado = x.atrasadas.length ? 'atrasada' : x.status
          return (
            <li key={x.cartao.id} style={{ '--c': x.cartao.cor, '--i': i } as React.CSSProperties}>
              <button type="button" className="cxr-linha" onClick={() => aoAbrir(x.cartao.id)} aria-label={tx('Abrir o cartão {0}', x.cartao.nome)}>
                <BancoIcone nome={x.cartao.nome} cor={x.cartao.cor} tamanho={38} />
                <span className="cxr-nome">
                  <b>{x.cartao.nome}</b>
                  <small className={`cxr-estado ${estado}`}><i />{textoStatus(x)}</small>
                </span>
                <span className="cxr-fatura">
                  <small>{tx('fatura de {0}', nomeDaFatura(x.ano, x.mes, c.ano))}</small>
                  <b>{fmtValor(x.valor)}</b>
                </span>
                {lim ? (
                  <span className={`cxr-limite ${uso >= 0.9 ? 'ruim' : uso >= 0.7 ? 'atencao' : ''}`}>
                    <span className="cxr-trilho"><i style={{ width: `${uso * 100}%` }} /></span>
                    <small>
                      <b>{tx('{0} livres', fmtValor(Math.max(0, x.limiteDisponivel ?? 0)))}</b> {tx('de {0}', fmtValor(lim))}
                      <em>{Math.round(uso * 100)}%</em>
                    </small>
                  </span>
                ) : (
                  <span className="cxr-limite sem"><small>{tx('Sem limite informado')}</small></span>
                )}
                <Icone nome="dir" tamanho={16} />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="ccx-dica"><Icone nome="ideia" tamanho={14} /> {tx('Clique num cartão, aqui ou na carteira, para ver tudo dele.')}</p>
    </section>
  )
}

/**
 * Aba "Limite e caixinha" do computador: quanto sobra para gastar (número grande e uma régua), de onde vem o limite (banco e
 * caixinha) e o que está ocupando ele (fatura do mês, faturas vencidas e as parcelas que já caem nas próximas).
 */
function LimitePC({ s, c, aoEditar }: { s: SituacaoCartao; c: Ctx; aoEditar: () => void }) {
  if (s.limiteTotal == null) return <Limite s={s} c={c} aoEditar={aoEditar} />
  const total = s.limiteTotal
  const usado = s.limiteUsado
  const livre = s.limiteDisponivel ?? 0
  const estourou = livre < 0
  const uso = total > 0 ? Math.min(1, Math.max(0, usado / total)) : 0
  const tom = estourou || uso >= 0.9 ? 'ruim' : uso >= 0.7 ? 'atencao' : 'bom'
  const doBanco = Math.max(0, centavos(total - s.garantido))
  // o que ocupa o limite: a fatura do mês (o que falta), as vencidas e o resto (parcelas das próximas faturas)
  const daFatura = s.paga ? 0 : s.falta
  const vencidas = centavos(s.atrasadas.reduce((a, f) => a + f.falta, 0))
  const proximas = Math.max(0, centavos(usado - daFatura - vencidas))
  const ocupa = [
    { rotulo: tx('Fatura de {0}', nomeDaFatura(s.ano, s.mes, c.ano)), valor: daFatura, icone: 'cartao' },
    ...(vencidas > 0 ? [{ rotulo: tx('Faturas vencidas'), valor: vencidas, icone: 'sino' }] : []),
    { rotulo: tx('Parcelas das próximas faturas'), valor: proximas, icone: 'calendario' },
  ]
  const maior = Math.max(1, ...ocupa.map((x) => x.valor))
  return (
    <section className={`cartao lpc ${tom}`} style={{ '--c': s.cartao.cor } as React.CSSProperties}>
      <div className="lpc-principal">
        <span className="lpc-rotulo">{estourou ? tx('Passou do limite') : tx('Livre para gastar')}</span>
        <strong className="lpc-livre"><Numero valor={Math.abs(livre)} formato={fmtValor} /></strong>
        <span className="lpc-de">{tx('de {0} de limite', fmtValor(total))} · <b>{tx('{0}% usado', Math.round(uso * 100))}</b></span>

        <div className="lpc-regua" role="img" aria-label={tx('{0} usados de {1}', fmtValor(usado), fmtValor(total))}>
          <i className="lpc-usado" style={{ width: `${uso * 100}%` }} />
          {[25, 50, 75].map((m) => <span key={m} className="lpc-marca" style={{ left: `${m}%` }} />)}
        </div>
        <div className="lpc-regua-legenda">
          <span><i className="usado" />{tx('Usado')} <b>{fmtValor(usado)}</b></span>
          <span><i className="livre" />{tx('Livre')} <b>{fmtValor(Math.max(0, livre))}</b></span>
        </div>

        {tom === 'ruim' && (
          <p className="lpc-aviso"><Icone nome="alerta" tamanho={15} /> {estourou
            ? tx('As compras passaram do limite. O banco pode recusar as próximas até a fatura ser paga.')
            : tx('Quase no limite: uma compra maior pode ser recusada.')}</p>
        )}

        <h4 className="lpc-sub">{tx('De onde vem o limite')}</h4>
        <div className="lpc-fontes">
          <i className="banco" style={{ flexGrow: doBanco || 0.0001 }} />
          {s.garantido > 0 && <i className="caixinha" style={{ flexGrow: s.garantido }} />}
        </div>
        <ul className="lpc-fontes-legenda">
          <li><i className="banco" />{tx('Do banco')}<b>{fmtValor(doBanco)}</b></li>
          {s.garantido > 0 && <li><i className="caixinha" />{s.cartao.garantia_caixinha ? tx('Da caixinha do banco') : tx('Da caixinha')}<b>{fmtValor(s.garantido)}</b></li>}
        </ul>
      </div>

      <div className="lpc-lado">
        <h4 className="lpc-sub">{tx('O que está usando o limite')}</h4>
        <ul className="lpc-ocupa">
          {ocupa.map((x) => (
            <li key={x.rotulo}>
              <span className="lpc-ocupa-icone"><Icone nome={x.icone} tamanho={15} /></span>
              <span className="lpc-ocupa-texto">{x.rotulo}<span className="lpc-ocupa-barra"><i style={{ width: `${(x.valor / maior) * 100}%` }} /></span></span>
              <b>{fmtValor(x.valor)}</b>
            </li>
          ))}
        </ul>
        <p className="lpc-nota">{tx('O limite volta a ficar livre conforme você paga as faturas.')}</p>
        {!c.cartoes.semExtras && (
          <button type="button" className="lpc-caixinha" onClick={aoEditar}>
            <span className="lpc-caixinha-icone"><Icone nome="cofre" tamanho={18} /></span>
            <span>
              {s.garantido > 0
                ? <><b>{tx('{0} da caixinha viram limite', fmtValor(s.garantido))}</b><small>{s.cartao.garantia_caixinha ? tx('Acompanha a caixinha do banco: guardou mais, o limite cresce.') : tx('Valor fixo que você informou.')}</small></>
                : <><b>{tx('Tem dinheiro numa caixinha que vira limite?')}</b><small>{tx('Some ao limite do cartão.')}</small></>}
            </span>
            <span className="lpc-caixinha-acao">{s.garantido > 0 ? tx('Mudar') : tx('Somar')}</span>
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * O que a busca do topo achou nas compras no cartão, em todos os cartões e meses. As compras no cartão não aparecem em
 * Lançamentos, então a busca de lá avisa e traz para cá.
 */
export function ResultadoDaBusca({ c }: { c: Ctx }) {
  const hoje = hojeLocal()
  const casa = useMemo(() => criarBusca(c.busca, hoje, hojeLocal(new Date(Date.parse(`${hoje}T12:00:00`) - 86400000))), [c.busca, hoje])
  const achadas = useMemo(() => {
    if (!casa) return []
    const ativos = new Set(c.cartoes.cartoes.filter((k) => k.ativo).map((k) => k.id))
    return c.cartoes.compras
      .filter((l) => ehCompraNoCartao(l) && ativos.has(l.cartao_id!)
        && casaCompraNoCartao(casa, l, c.categoriaDe(l)?.nome, c.cartoes.cartoes.find((k) => k.id === l.cartao_id)?.nome))
      .sort((a, b) => (b.data_compra ?? b.data ?? '').localeCompare(a.data_compra ?? a.data ?? ''))
  }, [casa, c.cartoes.compras, c.cartoes.cartoes, c.categorias]) // eslint-disable-line react-hooks/exhaustive-deps
  const compras = new Set(achadas.map(chaveDaCompra)).size
  const total = centavos(achadas.reduce((a, l) => a + l.valor, 0))
  const mostradas = achadas.slice(0, 40)
  return (
    <section className="cartao cc-busca" aria-label={tx('Resultado da busca nos cartões')}>
      <h3 className="ccd-titulo ccd-compras-cab">
        <span>{tx('Resultado da busca nos cartões')} <small>{compras || ''}</small></span>
        <button className="link" onClick={() => c.setBusca('')}><Icone nome="fechar" tamanho={13} /> {tx('Limpar busca')}</button>
      </h3>
      {achadas.length ? (
        <>
          <ul className="lista-lanc">
            {mostradas.map((l) => {
              const k = c.categoriaDe(l) ?? SEM_CATEGORIA
              const cartao = c.cartoes.cartoes.find((x) => x.id === l.cartao_id)
              return (
                <li key={l.id}>
                  <button className="item-lanc" onClick={() => c.editarLancamento(l)}>
                    <Selo c={k} tamanho={34} />
                    <span className="item-texto">
                      <span className="item-desc">{l.descricao || tx('Compra')}</span>
                      <span className="item-meta">
                        {cartao?.nome} · {tx('fatura de {0}', sufixoMes(l.ano, l.mes))}
                        {fmtDataCurta(l.data_compra ?? null) && <> · {fmtDataCurta(l.data_compra ?? null)}</>}
                        {(l.parcelas ?? 1) > 1 && <> · {l.parcela}/{l.parcelas}</>}
                      </span>
                    </span>
                    <span className="item-valor">{fmtValor(l.valor)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="campo-ajuda">
            {achadas.length > mostradas.length ? tx('Mostrando {0} de {1}. Total: {2}', mostradas.length, achadas.length, fmtValor(total)) : tx('Total: {0}', fmtValor(total))}
          </p>
        </>
      ) : (
        <p className="quadro-vazio">{tx('Nenhuma compra no cartão combina com essa busca.')}</p>
      )}
    </section>
  )
}

/** Conta sem cartões: uma pilha de cartões desenhados e o convite para adicionar o primeiro. */
export function SemCartoes({ aoCriar }: { aoCriar: () => void }) {
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

/** As compras da fatura do mês aberto, com o total ao lado e o destaque da compra que acabou de ser lançada. */
export function ComprasDaFatura({ s, c, destacada }: { s: SituacaoCartao; c: Ctx; destacada: string | null }) {
  return (
    <section className="cartao ccd-compras">
      <h3 className="ccd-titulo ccd-compras-cab">
        <span>{tx('Compras desta fatura')} <small>{s.compras.length || ''}</small></span>
        {s.compras.length > 0 && <b>{fmtValor(s.valor)}</b>}
      </h3>
      {s.compras.length ? (
        <ul className="lista-lanc">
          {s.compras.map((l, i) => {
            const k = c.categoriaDe(l) ?? SEM_CATEGORIA
            return (
              <li key={l.id} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <button className={`item-lanc ${l.compra_id && l.compra_id === destacada ? 'compra-nova' : ''} ${estornoTotal(l) ? 'estornado' : ''}`} onClick={() => c.editarLancamento(l)}>
                  <Selo c={k} tamanho={34} />
                  <span className="item-texto">
                    <span className="item-desc">{l.descricao || tx('Compra')}</span>
                    <span className="item-meta">
                      {fmtDataCurta(l.data_compra ?? null) && <>{fmtDataCurta(l.data_compra ?? null)} · </>}{k.nome}
                      {(l.parcelas ?? 1) > 1 && <> · {l.parcela}/{l.parcelas}</>}
                      {puladaDe(l, c.ano) && <> · <em className="cc-pulada">{puladaDe(l, c.ano)}</em></>}
                      {l.pago_por?.trim() && <> · <em className="cc-de-outro">{tx('paga por {0}', l.pago_por.trim())}</em></>}
                      {foiEstornado(l) && <> · <em className="cc-estorno">{estornoTotal(l) ? tx('estornada') : tx('estorno de {0}', fmtValor(l.estorno_valor!))}</em></>}
                    </span>
                  </span>
                  <span className="item-valor">
                    {estornoTotal(l) ? <s>{fmtValor(valorAntesDoEstorno(l))}</s> : fmtValor(l.valor)}
                    {foiEstornado(l) && !estornoTotal(l) && <small><s>{fmtValor(valorAntesDoEstorno(l))}</s></small>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="quadro-vazio">{tx('Nenhuma compra nesta fatura. Toque em “Nova compra” e escolha este cartão.')}</p>
      )}
    </section>
  )
}

/**
 * O cartão fora da carteira: o plástico grande flutuando, o nome e as ações principais, e embaixo as abas (cada função
 * no seu lugar). O jeito de ver decide as abas: o simples fica só com a fatura e as compras.
 */
const DetalheEmAbas = forwardRef<HTMLDivElement, {
  s: SituacaoCartao; c: Ctx; aba: Aba; aoAba: (a: Aba) => void; destacada: string | null; nivel: Nivel
  aoGuardar: () => void; aoEditar: () => void
  aoPagar: (f: Fatura, pagamento?: FaturaPaga, parcial?: FaturaParcial) => void
  aoRenegociar: (f: Fatura) => void
}>(function DetalheEmAbas({ s, c, aba, aoAba, destacada, nivel, aoGuardar, aoEditar, aoPagar, aoRenegociar }, ref) {
  const { cartao } = s
  const banco = c.d.bancos.find((b) => b.id === cartao.banco_id)
  const resolvidas = c.cartoes.faturasPagas.filter((p) => p.cartao_id === cartao.id).length
  const atrasado = s.atrasadas.length > 0 || s.status === 'atrasada'
  const podePagar = s.valor > 0 && s.status !== 'futura' && !s.paga
  /** Abre uma parcela da compra para editar ou excluir, esteja ela na fatura que está na tela ou não. */
  const abrirCompra = (p: CompraParcelada) => {
    const ps = c.cartoes.compras.filter((l) => l.compra_id === p.compra_id)
    const l = ps.find((x) => (x.parcela ?? 1) === p.atual) ?? ps[0]
    if (l) c.editarLancamento(l)
  }
  const abas: { id: Aba; rotulo: string; icone: string; conta?: number | string; alerta?: boolean }[] = [
    { id: 'fatura', rotulo: tx('Fatura'), icone: 'cartao', alerta: atrasado },
    { id: 'compras', rotulo: tx('Compras'), icone: 'lista', conta: s.compras.length || undefined },
    ...(nivel !== 'simples' ? [
      { id: 'resolvidas' as const, rotulo: tx('Pagas e renegociadas'), icone: 'check', conta: resolvidas || undefined },
      { id: 'proximas' as const, rotulo: tx('Próximas e parceladas'), icone: 'calendario', conta: s.parceladas.length || undefined },
      { id: 'limite' as const, rotulo: tx('Limite e caixinha'), icone: 'escudo' },
    ] : []),
  ]
  const atual = abas.some((a) => a.id === aba) ? aba : 'fatura'

  // o risquinho embaixo da aba escolhida desliza até ela
  const lista = useRef<HTMLDivElement>(null)
  const [risco, setRisco] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const b = lista.current?.querySelector<HTMLElement>(`[data-aba="${atual}"]`)
    if (b) setRisco({ x: b.offsetLeft, w: b.offsetWidth })
  }, [atual, abas.length])
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = abas.findIndex((a) => a.id === atual)
    const prox = abas[(i + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length]
    aoAba(prox.id)
    lista.current?.querySelector<HTMLElement>(`[data-aba="${prox.id}"]`)?.focus()
  }

  return (
    <div ref={ref} className="ccx-detalhe" style={{ '--c': cartao.cor } as React.CSSProperties}>
      <header className="ccx-cab">
        <div className="ccx-voo">
          <div className="ccx-flutua">
            <CartaoIlustrado nome={cartao.nome} cor={cartao.cor} banco={banco?.nome} ativo titular={c.perfil.nome}
              conteudo={<span className="cc-plastico-fatura"><small>{tx('fatura de {0}', nomeDaFatura(s.ano, s.mes, c.ano))}</small><b>{fmtValor(s.valor)}</b></span>}
              rodape={<>{tx('fecha dia {0} · vence dia {1}', cartao.dia_fechamento, cartao.dia_vencimento)}</>} />
          </div>
          <span className="ccx-sombra" aria-hidden="true" />
        </div>
        <div className="ccx-info">
          <span className={`chip-estado cc ${s.status}`}>{textoStatus(s)}</span>
          <h2>{cartao.nome}</h2>
          <small>{banco ? `${banco.nome} · ` : ''}{tx('fecha dia {0}, vence dia {1}', cartao.dia_fechamento, cartao.dia_vencimento)}</small>
          <dl className="ccx-numeros">
            <div><dt>{tx('Fatura de {0}', nomeDaFatura(s.ano, s.mes, c.ano))}</dt><dd><Numero valor={s.valor} formato={fmtValor} /></dd></div>
            {s.limiteDisponivel !== null && <div><dt>{tx('Limite livre')}</dt><dd className={s.limiteDisponivel < 0 ? 'ruim' : ''}><Numero valor={s.limiteDisponivel} formato={fmtValor} /></dd></div>}
          </dl>
          <div className="ccx-acoes">
            {podePagar && <button className="btn primario" onClick={() => aoPagar(s)}><Icone nome="check" tamanho={16} /> {s.pagoEmParte > 0 ? tx('Pagar o resto') : tx('Paguei a fatura')}</button>}
            <button className={`btn ${podePagar ? '' : 'primario'}`} onClick={() => c.novaCompraNoCartao(cartao.id)}><Icone nome="mais" tamanho={16} /> {tx('Nova compra')}</button>
            <button className="btn" onClick={aoEditar}><Icone nome="lapis" tamanho={16} /> {tx('Editar')}</button>
            <button className="btn ccx-guardar" onClick={aoGuardar}><Icone nome="desfazer" tamanho={16} /> {tx('Guardar na carteira')}</button>
          </div>
        </div>
      </header>

      <div ref={lista} className="ccx-abas" role="tablist" aria-label={tx('O que ver deste cartão')} onKeyDown={teclas}>
        {risco && <span className="ccx-risco" aria-hidden="true" style={{ transform: `translateX(${risco.x}px)`, width: risco.w }} />}
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" data-aba={a.id} id={`ccx-aba-${a.id}`} aria-selected={atual === a.id}
            aria-controls="ccx-painel" tabIndex={atual === a.id ? 0 : -1} className={atual === a.id ? 'ativa' : ''} onClick={() => aoAba(a.id)}>
            <Icone nome={a.icone} tamanho={15} /> {a.rotulo}
            {a.conta !== undefined && <small>{a.conta}</small>}
            {a.alerta && <i className="ccx-ponto" aria-label={tx('atrasada')} />}
          </button>
        ))}
      </div>

      <div key={atual} id="ccx-painel" role="tabpanel" aria-labelledby={`ccx-aba-${atual}`} className={`ccx-painel aba-${atual}`}>
        {atual === 'fatura' && <>
          <FaturasAtrasadas s={s} c={c} aoPagar={aoPagar} aoRenegociar={aoRenegociar} />
          <FaturaDoMes s={s} c={c} aoPagar={aoPagar} aoRenegociar={aoRenegociar} />
        </>}
        {atual === 'compras' && <ComprasDaFatura s={s} c={c} destacada={destacada} />}
        {atual === 'resolvidas' && <FaturasResolvidas s={s} c={c} aoPagar={aoPagar} aoRenegociar={aoRenegociar} />}
        {atual === 'proximas' && <div className="ccx-duas">
          <Proximas s={s} c={c} />
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
        </div>}
        {atual === 'limite' && <LimitePC s={s} c={c} aoEditar={aoEditar} />}
      </div>

      {nivel === 'simples' && (
        <button className="vt-mais-detalhe" onClick={c.personalizar}>
          <Icone nome="ano" tamanho={16} /> {tx('Quer ver limite, parcelas e faturas pagas? Mudar o jeito de ver')}
        </button>
      )}
    </div>
  )
})

/** As faturas de meses anteriores que venceram sem pagar, cada uma com "Paguei" e "Renegociei" (e "Já paguei todas"). */
export function FaturasAtrasadas({ s, c, aoPagar, aoRenegociar }: {
  s: SituacaoCartao; c: Ctx; aoPagar: (f: Fatura) => void; aoRenegociar: (f: Fatura) => void
}) {
  if (!s.atrasadas.length) return null
  const { cartao } = s
  return (
    <section className="cartao ccd-atrasadas">
      <header className="ccd-atrasadas-cab">
        <h3 className="ccd-titulo"><Icone nome="sino" tamanho={18} /> {s.atrasadas.length === 1 ? tx('Uma fatura venceu sem pagar') : tx('{0} faturas venceram sem pagar', s.atrasadas.length)}</h3>
        {s.atrasadas.length > 1 && (
          <button className="link" onClick={async () => {
            if (!(await confirmar(tx('Marcar as {0} faturas como pagas no dia do vencimento de cada uma?', s.atrasadas.length), { botao: tx('Marcar como pagas') }))) return
            for (const f of s.atrasadas) void c.cartoes.pagarFatura({ cartao_id: cartao.id, ano: f.ano, mes: f.mes, valor: f.falta, pago_em: f.vencimento, banco_id: cartao.banco_id, tipo: 'paga', juros: 0 })
          }}>{tx('Já paguei todas')}</button>
        )}
      </header>
      <ul>
        {s.atrasadas.map((f) => (
          <li key={`${f.ano}-${f.mes}`}>
            <span className="ccd-atrasada-mes">{sufixoMes(f.ano, f.mes)}</span>
            <span className="ccd-atrasada-texto">
              <strong>{fmtValor(f.falta)}</strong>
              <small>{f.pagoEmParte > 0 && <>{tx('pagou {0} de {1}', fmtValor(f.pagoEmParte), fmtValor(f.valor))} · </>}{dias(f.vencimento, hojeLocal()) === 1 ? tx('venceu há 1 dia, em {0}', fmtDataLonga(f.vencimento)) : tx('venceu há {0} dias, em {1}', dias(f.vencimento, hojeLocal()), fmtDataLonga(f.vencimento))}</small>
            </span>
            <span className="ccd-atrasada-acoes">
              <button className="btn" onClick={() => aoPagar(f)}><Icone nome="check" tamanho={15} /> {tx('Paguei')}</button>
              <button className="btn" onClick={() => aoRenegociar(f)} disabled={c.cartoes.semExtras}><Icone nome="acordo" tamanho={15} /> {tx('Renegociei')}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** As faturas já pagas ou renegociadas deste cartão (toque para ajeitar). */
export function FaturasResolvidas({ s, c, aoPagar, aoRenegociar }: {
  s: SituacaoCartao; c: Ctx; aoPagar: (f: Fatura, pagamento?: FaturaPaga, parcial?: FaturaParcial) => void; aoRenegociar: (f: Fatura) => void
}) {
  const { cartao } = s
  const historico = c.cartoes.faturasPagas
    .filter((p) => p.cartao_id === cartao.id)
    .sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))
  const [verTodas, setVerTodas] = useState(false)
  const faturaDe = (p: FaturaPaga) => faturaDoMes(cartao, c.cartoes.compras, c.cartoes.faturasPagas, p.ano, p.mes, undefined, c.cartoes.parciais)
  return (
    <section className="cartao">
      <h3 className="ccd-titulo">{tx('Faturas resolvidas')} <small>{tx('toque para ajeitar')}</small></h3>
      {historico.length ? (
        <ul className="ccd-historico">
          {historico.slice(0, verTodas ? undefined : 8).map((p) => {
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
                      {atraso && ` · ${dias(f.vencimento, p.pago_em) === 1 ? tx('1 dia de atraso') : tx('{0} dias de atraso', dias(f.vencimento, p.pago_em))}`}
                      {(p.juros ?? 0) > 0 && ` · ${reneg ? tx('acréscimo') : tx('juros')} ${fmtValor(p.juros!)}`}
                      {f.parciais.length > 0 && ` · ${tx('em {0} pagamentos', f.parciais.length + 1)}`}
                    </small>
                  </span>
                  <span className="ccd-hist-valor">{fmtValor(centavos(p.valor + f.pagoEmParte))}</span>
                  <Icone nome="lapis" tamanho={15} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="quadro-vazio">{tx('Quando você marcar uma fatura como paga ou renegociada, ela aparece aqui.')}</p>
      )}
      {historico.length > 8 && (
        <button type="button" className="link" onClick={() => setVerTodas(!verTodas)}>{verTodas ? tx('Ver menos') : tx('Ver todas ({0})', historico.length)}</button>
      )}
    </section>
  )
}

/** A fatura do mês aberto: valor, situação, a linha do tempo (abriu → fecha → vence) e o que dá para fazer com ela. */
export function FaturaDoMes({ s, c, aoPagar, aoRenegociar }: {
  s: SituacaoCartao; c: Ctx; aoPagar: (f: Fatura, p?: FaturaPaga, parcial?: FaturaParcial) => void; aoRenegociar: (f: Fatura) => void
}) {
  const [pulando, setPulando] = useState(false)
  const hoje = hojeLocal()
  const ant = somaMeses({ ano: s.ano, mes: s.mes }, -1)
  const abriu = datasDaFatura(s.cartao, ant.ano, ant.mes).fechamento
  const total = Math.max(1, dias(abriu, s.vencimento))
  const pos = (d: string) => Math.min(100, Math.max(0, (dias(abriu, d) / total) * 100))
  const p = s.paga
  const atraso = pagaComAtraso(p, s.vencimento)
  const pagoAoTodo = centavos((p?.valor ?? 0) + s.pagoEmParte)
  const mudou = p && !renegociada(p) && Math.abs(pagoAoTodo - s.valor) >= 0.01
  const podeResolver = s.valor > 0 && s.status !== 'futura' && !p
  // pular compra (migração 38): só de fatura ainda sem pagar, que já abriu e tem compras
  const podePular = !c.cartoes.sem38 && !p && s.compras.length > 0 && s.status !== 'futura'
  const pulou = centavos(s.puladas.reduce((a, l) => a + l.valor, 0))

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
          {hoje >= abriu && hoje <= s.vencimento && <i className="ccd-tempo-hoje" style={{ left: `${pos(hoje)}%` }} title={tx('hoje')} />}
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
            {mudou && <small className="cc-aviso"> {tx('Você pagou {0}; depois disso a fatura mudou.', fmtValor(pagoAoTodo))}</small>}
          </span>
        </div>
      ) : s.valor > 0 && s.status !== 'futura' ? (
        <p className="ccd-quando">{s.status === 'atrasada' ? tx('Atrasada') : tx('Para pagar')}: <b>{quandoVence(s)}</b></p>
      ) : null}

      {s.parciais.length > 0 && (
        <div className="ccd-parte">
          {!p && (
            <>
              <span className="ccd-parte-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, s.valor > 0 ? (s.pagoEmParte / s.valor) * 100 : 100)}%` }} /></span>
              <p>{s.falta > 0
                ? <>{tx('Você já pagou {0} desta fatura.', fmtValor(s.pagoEmParte))} <b>{tx('Faltam {0}.', fmtValor(s.falta))}</b></>
                : tx('O que você pagou já cobre esta fatura. Marque como paga para fechar.')}</p>
            </>
          )}
          <ul>
            {s.parciais.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => aoPagar(s, undefined, x)}>
                  <Icone nome={x.da_caixinha ? 'cofre' : 'check'} tamanho={15} />
                  <span>{fmtDataCurta(x.pago_em)}<small>{x.da_caixinha ? tx('do cofrinho') : tx('pagamento de parte')}</small></span>
                  <b>{fmtValor(x.valor)}</b>
                  <Icone nome="lapis" tamanho={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.puladas.length > 0 && (
        <button type="button" className="ccd-puladas" onClick={() => setPulando(true)} disabled={Boolean(p) || c.cartoes.sem38}>
          <Icone nome="dir" tamanho={16} />
          <span>
            {s.puladas.length === 1
              ? tx('“{0}” foi pulada para a fatura de {1}', s.puladas[0].descricao || tx('Compra'), nomeDaFatura(s.puladas[0].ano, s.puladas[0].mes, c.ano))
              : tx('{0} compras puladas para as próximas faturas', s.puladas.length)}
          </span>
          <b>{fmtValor(pulou)}</b>
        </button>
      )}

      {s.deOutros.length > 0 && (
        <p className="ccd-outros">
          <Icone nome="pessoa" tamanho={16} />
          <span>
            {s.deOutros.length === 1
              ? tx('{0} paga {1} desta fatura.', s.deOutros[0].nome, fmtValor(s.deOutros[0].valor))
              : tx('Outras pessoas pagam {0} desta fatura ({1}).', fmtValor(centavos(s.deOutros.reduce((a, x) => a + x.valor, 0))), s.deOutros.map((x) => x.nome).join(', '))}
            {' '}<b>{tx('Seu gasto: {0}', fmtValor(centavos(s.valor - s.deOutros.reduce((a, x) => a + x.valor, 0))))}</b>
          </span>
        </p>
      )}

      <PorCategoria s={s} c={c} />

      <div className="ccd-acoes">
        {podeResolver && <button className="btn primario" onClick={() => aoPagar(s)}><Icone nome="check" tamanho={16} /> {s.pagoEmParte > 0 ? tx('Pagar o resto') : tx('Paguei a fatura')}</button>}
        {podePular && (
          <button className="btn" onClick={() => setPulando(true)} title={tx('Passar uma compra para a próxima fatura')}>
            <Icone nome="dir" tamanho={16} /> {tx('Pular compra')}
          </button>
        )}
        {/* só fatura fechada ou vencida: renegociada ainda aberta, as compras que caíssem nela depois sumiriam das saídas */}
        {podeResolver && s.status !== 'aberta' && (
          <button className="btn" onClick={() => aoRenegociar(s)} disabled={c.cartoes.semExtras}
            title={c.cartoes.semExtras ? tx('Falta rodar a migração 9') : tx('O banco parcelou a fatura')}>
            <Icone nome="acordo" tamanho={16} /> {tx('Renegociar')}
          </button>
        )}
        {p && !renegociada(p) && <button className="btn" onClick={() => aoPagar(s, p)}><Icone nome="lapis" tamanho={16} /> {tx('Ajeitar pagamento')}</button>}
        {p && renegociada(p) && <button className="btn" onClick={() => aoRenegociar(s)}><Icone nome="acordo" tamanho={16} /> {tx('Ver renegociação')}</button>}
      </div>
      {/* fora da seção: a animação do cartão prenderia a janela dentro dele (no celular, principalmente) */}
      {pulando && createPortal(<FormPularCompra c={c} cartao={s.cartao} f={s} aoFechar={() => setPulando(false)} />, document.body)}
    </section>
  )
}

/**
 * Pular compra ("pula compra" do PicPay e de outros bancos): as parcelas escolhidas passam para a fatura seguinte. Se o banco
 * cobrou uma taxa para isso, ela entra como uma compra à vista na fatura seguinte. As que já foram puladas desta fatura
 * podem voltar.
 */
export function FormPularCompra({ c, cartao, f, aoFechar }: { c: Ctx; cartao: CartaoCredito; f: Fatura; aoFechar: () => void }) {
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set())
  const [taxa, setTaxa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const prox = somaMeses({ ano: f.ano, mes: f.mes }, 1)
  const nomeProx = nomeDaFatura(prox.ano, prox.mes, c.ano)
  const proxPaga = c.cartoes.faturasPagas.some((p) => p.cartao_id === cartao.id && p.ano === prox.ano && p.mes === prox.mes)
  const total = centavos(f.compras.filter((l) => escolhidas.has(l.id)).reduce((a, l) => a + l.valor, 0))
  const ficaNesta = centavos(f.valor - total)
  const alternar = (id: string) => {
    setErro(null)
    setEscolhidas((xs) => {
      const novo = new Set(xs)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const salvar = async () => {
    if (salvando) return
    if (!escolhidas.size) return setErro(tx('Escolha pelo menos uma compra para pular.'))
    if (proxPaga) return setErro(tx('A fatura de {0} já está marcada como paga. Desfaça o pagamento dela antes de pular uma compra para lá.', nomeProx))
    const t = taxa.trim() ? parseNumero(taxa) : 0
    if (t == null || t < 0) return setErro(tx('Taxa inválida.'))
    setSalvando(true)
    const ok = await c.cartoes.moverParcelas(f.compras.filter((l) => escolhidas.has(l.id)).map((l) => ({ id: l.id, patch: pularParcela(l, cartao) })))
    if (!ok) { setSalvando(false); return setErro(tx('Não deu certo. Tente de novo.')) }
    if (t > 0) {
      const gravou = await c.cartoes.addCompra([{
        ...taxaParaPular(cartao, f, t), compra_id: crypto.randomUUID(), categoria_id: c.categorias.find((k) => k.papel === 'divida')?.id ?? null,
      }])
      if (!gravou) { setSalvando(false); return setErro(tx('A compra foi pulada, mas não consegui lançar a taxa. Lance a taxa como uma compra no cartão.')) }
    }
    aoFechar()
  }

  const voltar = async (l: Lancamento) => {
    const patch = voltarParcela(l)
    if (!patch || salvando) return
    setSalvando(true)
    const ok = await c.cartoes.moverParcelas([{ id: l.id, patch }])
    setSalvando(false)
    if (!ok) setErro(tx('Não deu certo. Tente de novo.'))
  }

  return (
    <Modal titulo={tx('Pular compra')} aoFechar={aoFechar} tamanho="tela" cor={cartao.cor} palco={
      <div className="cc-confirma palco-fatura">
        <span className="cc-confirma-quem"><BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={34} /><span>{tx('Fatura de {0}', nomeDaFatura(f.ano, f.mes, c.ano))}<small>{total > 0 ? tx('{0} vão para {1}', fmtValor(total), nomeProx) : tx('vence em {0}', fmtDataLonga(f.vencimento))}</small></span></span>
        <strong>{fmtValor(total > 0 ? ficaNesta : f.valor)}</strong>
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <span className="campo-ajuda">{tx('Usou o “pular compra” do app do banco? Escolha as compras que passaram para a fatura de {0}. De parcelada, só a parcela desta fatura muda de mês.', nomeProx)}</span>
        {!f.compras.length && <p className="quadro-vazio">{tx('Nenhuma compra ficou nesta fatura.')}</p>}
        <ul className="cc-pular-lista">
          {f.compras.map((l) => {
            const k = c.categoriaDe(l) ?? SEM_CATEGORIA
            const marcada = escolhidas.has(l.id)
            return (
              <li key={l.id}>
                <button type="button" className={`cc-pular-item ${marcada ? 'ativo' : ''}`} role="checkbox" aria-checked={marcada} onClick={() => alternar(l.id)}>
                  <span className="cc-pular-marca" aria-hidden="true">{marcada && <Icone nome="check" tamanho={14} />}</span>
                  <Selo c={k} tamanho={30} />
                  <span className="item-texto">
                    <span className="item-desc">{l.descricao || tx('Compra')}</span>
                    <span className="item-meta">
                      {fmtDataCurta(l.data_compra ?? null) || k.nome}
                      {(l.parcelas ?? 1) > 1 && <> · {tx('parcela {0}/{1}', l.parcela ?? 1, l.parcelas ?? 1)}</>}
                      {puladaDe(l, c.ano) && <> · {puladaDe(l, c.ano)}</>}
                    </span>
                  </span>
                  <span className="item-valor">{fmtValor(l.valor)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {total > 0 && <AvisoDoConsultor fala={naHoraDePular(c.analise, total, nomeProx, f.puladas.length)} />}
        {total > 0 && (
          <div className="cc-acordo-resumo">
            <span><small>{tx('nesta fatura')}</small><b>{fmtValor(ficaNesta)}</b></span>
            <span><small>{tx('vai para {0}', nomeProx)}</small><b>{fmtValor(total)}</b></span>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">{tx('Taxa para pular')} <small>(opcional)</small></span>
          <span className="campo-caixa">
            <span className="prefixo">{simbolo()}</span>
            <input inputMode="decimal" value={taxa} onChange={(e) => { setTaxa(mascarar(e.target.value, casasDaMoeda(moedaAtual()))); setErro(null) }} placeholder="0,00" />
          </span>
          <span className="campo-ajuda">{tx('Se o banco cobrou alguma coisa para pular, ela entra na fatura de {0}.', nomeProx)}</span>
        </label>
        {f.puladas.length > 0 && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Já puladas desta fatura')}</span>
            <ul className="cc-pular-lista">
              {f.puladas.map((l) => (
                <li key={l.id} className="cc-pular-feita">
                  <span className="item-texto">
                    <span className="item-desc">{l.descricao || tx('Compra')}</span>
                    <span className="item-meta">{tx('na fatura de {0}', nomeDaFatura(l.ano, l.mes, c.ano))} · {fmtValor(l.valor)}</span>
                  </span>
                  <button type="button" className="btn" disabled={salvando} onClick={() => void voltar(l)}><Icone nome="desfazer" tamanho={15} /> {tx('Voltar para esta fatura')}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario" disabled={salvando || !escolhidas.size}>
            {escolhidas.size > 1 ? tx('Pular {0} compras', escolhidas.size) : tx('Pular para {0}', nomeProx)}
          </button>
        </div>
      </form>
    </Modal>
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
export function Limite({ s, c, aoEditar }: { s: SituacaoCartao; c: Ctx; aoEditar: () => void }) {
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
export function Proximas({ s, c }: { s: SituacaoCartao; c: Ctx }) {
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

export function Parcelada({ p, aoAbrir }: { p: CompraParcelada; aoAbrir: () => void }) {
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

export function FormCartao({ c, cartao, aoFechar }: { c: Ctx; cartao?: CartaoCredito; aoFechar: () => void }) {
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
  const [salvando, setSalvando] = useState(false)
  const bancos = c.d.bancos
  const sugestoes = CATALOGO_BANCOS.filter((b) => !b.nome.startsWith(tx('Carteira'))).slice(0, 12)
  // a caixinha que vale no limite é a de hoje (como no Painel), não a do mês aberto na tela
  const hojeIso = hojeLocal()
  const caixaHoje = mesEfetivo(c.d.meses, Number(hojeIso.slice(0, 4)), Number(hojeIso.slice(5, 7))).caixa
  const caixinha = bancoId ? caixaHoje[bancoId]?.caixinha ?? 0 : 0
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
    // o campo "Quanto está na caixinha" aparece quando o valor é fixo ou não dá para ligar à caixinha do banco
    const ligadoAoBanco = daCaixinha && podeCaixinha
    const gar = comGarantia && !ligadoAoBanco && garantido.trim() ? parseNumero(garantido) : 0
    if (gar == null || gar < 0) return setErro(tx('Valor da caixinha inválido.'))
    const dados = {
      nome: nome.trim(), cor, banco_id: bancoId || null, limite: lim,
      dia_fechamento: Number(fecha), dia_vencimento: Number(vence), ativo,
      limite_garantido: gar, garantia_caixinha: comGarantia && ligadoAoBanco,
    }
    setSalvando(true)
    const gravou = cartao ? await c.cartoes.updCartao(cartao.id, dados) : Boolean(await c.cartoes.addCartao(dados))
    setSalvando(false)
    // se não gravou (nome repetido, internet), o formulário fica aberto para a pessoa ajeitar sem perder o que digitou
    if (gravou) aoFechar()
    else setErro(tx('Não deu para salvar o cartão. Veja o aviso na tela, ajuste e tente de novo.'))
  }

  return (
    <Modal titulo={cartao ? tx('Editar cartão') : tx('Novo cartão')} aoFechar={aoFechar} tamanho="tela" cor={cor} palco={
      <div className="cc-form-previa">
        <CartaoIlustrado nome={nome.trim() || tx('Seu cartão')} cor={cor} banco={bancos.find((b) => b.id === bancoId)?.nome} titular={c.perfil.nome}
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
            <Seletor valor={String(fecha)} aoMudar={(v) => { setFecha(v); setErro(null) }} rotulo={tx('Dia que fecha')} grade placeholder={tx('Escolher…')}
              opcoes={DIAS.map((d) => ({ valor: String(d), rotulo: tx('dia {0}', d), curto: String(d) }))} />
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Dia que vence')}</span>
            <Seletor valor={String(vence)} aoMudar={(v) => { setVence(v); setErro(null) }} rotulo={tx('Dia que vence')} grade placeholder={tx('Escolher…')}
              opcoes={DIAS.map((d) => ({ valor: String(d), rotulo: tx('dia {0}', d), curto: String(d) }))} />
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
            <Seletor valor={bancoId} aoMudar={setBancoId} rotulo={tx('Banco')}
              opcoes={[{ valor: '', rotulo: tx('Nenhum') }, ...bancos.map((b) => ({ valor: b.id, rotulo: b.nome, cor: b.cor }))]} />
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
              : <button type="button" className="btn perigo" onClick={() => {
                // fatura renegociada virou dívida: excluir o cartão faria as compras dela contarem de novo nas saídas
                if (c.cartoes.temRenegociada(cartao.id)) setErro(tx('Este cartão tem uma fatura renegociada. Desfaça a renegociação antes de excluir, ou desligue "Ainda uso este cartão".'))
                else setConfirmar(true)
              }}>{tx('Excluir')}</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario" disabled={salvando}>{cartao ? tx('Salvar') : tx('Adicionar cartão')}</button>
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

/**
 * Pagar a fatura (ou ajeitar um pagamento já feito): dia, valor, banco, de onde saiu o dinheiro (a conta ou o cofrinho) e
 * juros/multa quando pagou com atraso. Com a migração 38, pagar menos do que falta é um pagamento de parte: a fatura continua
 * em aberto pelo resto. Pagar com o cofrinho tira o valor da caixinha do banco em Dinheiro guardado.
 */
export function FormPagarFatura({ c, alvo, aoFechar }: { c: Ctx; alvo: Alvo; aoFechar: () => void }) {
  const { cartao, f, pagamento, parcial } = alvo
  const antigo = pagamento ?? parcial
  const [data, setData] = useState(antigo?.pago_em ?? hojeLocal())
  const [valor, setValor] = useState(paraCampo(antigo?.valor ?? f.falta))
  const [juros, setJuros] = useState(pagamento?.juros ? paraCampo(pagamento.juros) : '')
  const [bancoId, setBancoId] = useState(antigo?.banco_id ?? cartao.banco_id ?? '')
  const [daCaixinha, setDaCaixinha] = useState(Boolean(antigo?.da_caixinha))
  const [erro, setErro] = useState<string | null>(null)
  const [desfazer, setDesfazer] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const bancos = c.v.bancos ? c.d.bancos : []
  const atraso = data > f.vencimento ? dias(f.vencimento, data) : 0
  const semExtras = c.cartoes.semExtras
  const sem38 = c.cartoes.sem38
  const v = parseNumero(valor) ?? 0
  // o que falta sem contar este pagamento (ajeitando uma parte, ela volta para a conta)
  const faltaAntes = parcial ? centavos(f.falta + parcial.valor) : f.falta
  // pagar menos do que falta deixa a fatura em aberto pelo resto (ajeitar o pagamento que quitou continua quitando)
  const emParte = !sem38 && !pagamento && v > 0 && v < faltaAntes - 0.005
  // o cofrinho é a caixinha de um banco (no PicPay ela vira limite do cartão): só com bancos na tela e a migração 38
  const podeCofrinho = !sem38 && bancos.length > 0
  const usaCaixinha = podeCofrinho && daCaixinha
  const pagoEm = data || hojeLocal()
  const caixinhaNoMes = bancoId ? mesEfetivo(c.d.meses, Number(pagoEm.slice(0, 4)), Number(pagoEm.slice(5, 7))).caixa[bancoId]?.caixinha ?? 0 : 0
  // o que este pagamento já tinha tirado da caixinha volta para ela antes de tirar o novo valor
  const caixinhaLivre = centavos(caixinhaNoMes + (antigo && efeitoNaCaixinha(antigo).length && antigo.banco_id === bancoId ? antigo.valor : 0))
  const ligadoAoLimite = cartao.garantia_caixinha && cartao.banco_id === bancoId
  // o campo de juros só aparece com atraso (ou se já havia juros), e não num pagamento de parte; escondido, o que foi digitado antes não vale
  const mostraJuros = !semExtras && !emParte && !parcial && (atraso > 0 || (pagamento?.juros ?? 0) > 0)

  /**
   * Depois de gravar: desfaz o que o pagamento antigo tinha tirado da caixinha e tira o do novo. Devolve se o app mexeu no
   * saldo do novo (vai para `saldo_mexido`, para desfazer só o que foi feito de verdade).
   */
  const acertarCaixinha = async (novo: { valor: number; pago_em: string; banco_id: string | null; da_caixinha: boolean } | null) => {
    const mexer = Boolean(novo?.da_caixinha && novo.banco_id && mesJaChegou(Number(novo.pago_em.slice(0, 4)), Number(novo.pago_em.slice(5, 7))))
    const efeitos = [...efeitoNaCaixinha(antigo, -1), ...(novo && mexer ? efeitoNaCaixinha({ ...novo, saldo_mexido: true }) : [])]
    if (!efeitos.length) return mexer
    return (await c.ajustarCaixinha(efeitos)) && mexer
  }

  const salvar = async () => {
    // fatura já coberta pelos pagamentos de parte (uma compra foi pulada depois): marcar como paga com 0 fecha a conta
    const zeroQueFecha = v === 0 && faltaAntes === 0 && !parcial && !pagamento
    const j = mostraJuros && juros.trim() ? parseNumero(juros) : 0
    if (parseNumero(valor) == null || (v <= 0 && !zeroQueFecha)) return setErro(tx('Valor inválido.'))
    if (j == null || j < 0) return setErro(tx('Juros inválidos.'))
    if (usaCaixinha && !bancoId) return setErro(tx('Escolha o banco do cofrinho.'))
    if (salvando) return
    const dados = { valor: v, pago_em: pagoEm, banco_id: bancoId || null, da_caixinha: usaCaixinha && Boolean(bancoId) }
    setSalvando(true)

    // ---------- pagamento de parte: novo, ou ajeitando um que continua sendo parte ----------
    if (emParte) {
      const mexeu = dados.da_caixinha && mesJaChegou(Number(pagoEm.slice(0, 4)), Number(pagoEm.slice(5, 7)))
      let id = parcial?.id
      if (parcial) {
        if (!(await c.cartoes.editarParte(parcial.id, { ...dados, saldo_mexido: mexeu }))) { setSalvando(false); return setErro(tx('Não deu certo. Tente de novo.')) }
      } else {
        id = (await c.cartoes.pagarParte({ ...dados, saldo_mexido: mexeu, cartao_id: cartao.id, ano: f.ano, mes: f.mes }))?.id
        if (!id) { setSalvando(false); return setErro(tx('Não consegui salvar o pagamento. Nada foi gravado: tente de novo.')) }
      }
      aoFechar()
      const ok = await acertarCaixinha(dados)
      if (mexeu && !ok && id) await c.cartoes.editarParte(id, { saldo_mexido: false })
      return
    }

    // ---------- quita a fatura (novo pagamento, ou um pagamento de parte que passou a cobrir o que faltava) ----------
    if (!pagamento) {
      // Grava com a janela aberta: a saída dos juros e o pagamento andam juntos. Se o pagamento não grava, a saída dos juros
      // é desfeita (senão sobrava um gasto de juros sem fatura paga) e a janela fica, com o aviso.
      const comJuros = j > 0 && !semExtras
      const lanc = comJuros ? await c.d.addLanc(lancamentoDosJuros(c, cartao, f, j, pagoEm, bancoId || null)) : undefined
      if (comJuros && !lanc) { setSalvando(false); return setErro(tx('Não consegui salvar os juros. Nada foi gravado: tente de novo.')) }
      const mexeu = dados.da_caixinha && mesJaChegou(Number(pagoEm.slice(0, 4)), Number(pagoEm.slice(5, 7)))
      const nova = await c.cartoes.pagarFatura({
        cartao_id: cartao.id, ano: f.ano, mes: f.mes, ...dados, saldo_mexido: mexeu,
        tipo: 'paga', juros: j, juros_lanc_id: lanc?.id ?? null,
      })
      if (!nova) {
        if (lanc) await c.d.delLanc(lanc.id)
        setSalvando(false)
        return setErro(tx('Não consegui marcar a fatura como paga. Nada foi gravado: tente de novo.'))
      }
      // o pagamento de parte que virou quitação sai da lista (o valor dele passa a ser o da quitação)
      if (parcial) await c.cartoes.apagarParte(parcial.id)
      aoFechar()
      const ok = await acertarCaixinha(dados)
      if (mexeu && !ok) await c.cartoes.editarPagamento(nova.id, { saldo_mexido: false })
      return
    }
    aoFechar()
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
    const mexeu = dados.da_caixinha && mesJaChegou(Number(pagoEm.slice(0, 4)), Number(pagoEm.slice(5, 7)))
    if (await c.cartoes.editarPagamento(pagamento.id, { ...dados, saldo_mexido: mexeu, juros: j, juros_lanc_id: jurosLanc })) {
      const ok = await acertarCaixinha(dados)
      if (mexeu && !ok) await c.cartoes.editarPagamento(pagamento.id, { saldo_mexido: false })
    }
  }

  const desfazerPagamento = async () => {
    if (!antigo) return
    aoFechar()
    if (pagamento?.juros_lanc_id) await c.d.delLanc(pagamento.juros_lanc_id)
    const apagou = parcial ? await c.cartoes.apagarParte(parcial.id) : await c.cartoes.desfazerPagamento(antigo.id)
    // o que tinha saído do cofrinho volta para a caixinha
    if (apagou) await acertarCaixinha(null)
  }

  return (
    <Modal titulo={antigo ? tx('Ajeitar pagamento') : tx('Pagar fatura {0}', cartao.nome)} aoFechar={aoFechar} tamanho="tela" cor={cartao.cor} palco={
      <div className="cc-confirma palco-fatura">
        <span className="cc-confirma-quem"><BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={34} /><span>{tx('Fatura de {0}', nomeDaFatura(f.ano, f.mes, c.ano))}<small>{f.pagoEmParte > 0 && !f.paga ? tx('já pagou {0} · faltam {1}', fmtValor(f.pagoEmParte), fmtValor(f.falta)) : tx('{0} em {1}', f.vencimento < hojeLocal() ? tx('venceu') : tx('vence'), fmtDataLonga(f.vencimento))}</small></span></span>
        <strong>{fmtValor(f.valor)}</strong>
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Dia do pagamento')}</span>
            <CampoData valor={data} aoMudar={setData} rotulo={tx('Dia do pagamento')} obrigatorio />
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
        {mostraJuros && (
          <label className="campo">
            <span className="campo-rotulo">{tx('Juros e multa')} <small>(opcional)</small></span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo()}</span>
              <input inputMode="decimal" value={juros} onChange={(e) => { setJuros(mascarar(e.target.value, casasDaMoeda(moedaAtual()))); setErro(null) }} placeholder="0,00" />
            </span>
          </label>
        )}
        {podeCofrinho && (
          <div className="campo">
            <span className="campo-rotulo">{tx('De onde saiu o dinheiro?')}</span>
            <div className="chips" role="radiogroup" aria-label={tx('De onde saiu o dinheiro?')}>
              <button type="button" role="radio" aria-checked={!daCaixinha} className={`chip cc-origem ${!daCaixinha ? 'ativo' : ''}`} onClick={() => { setDaCaixinha(false); setErro(null) }}>
                <Icone nome="banco" tamanho={15} /> {tx('Da conta')}
              </button>
              <button type="button" role="radio" aria-checked={daCaixinha} className={`chip cc-origem ${daCaixinha ? 'ativo' : ''}`} onClick={() => { setDaCaixinha(true); setErro(null) }}>
                <Icone nome="cofre" tamanho={15} /> {tx('Do cofrinho (caixinha)')}
              </button>
            </div>
          </div>
        )}
        {bancos.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">{usaCaixinha ? tx('Cofrinho de qual banco?') : tx('De qual banco saiu?')} {!usaCaixinha && <small>(opcional)</small>}</span>
            <Seletor valor={bancoId} aoMudar={(x) => { setBancoId(x); setErro(null) }} rotulo={tx('Banco')}
              opcoes={[...(usaCaixinha ? [] : [{ valor: '', rotulo: tx('Não sei / não importa') }]), ...bancos.map((b) => ({ valor: b.id, rotulo: b.nome, cor: b.cor }))]}
              placeholder={tx('Escolher…')} />
          </label>
        )}
        {usaCaixinha && bancoId && (
          <div className={`cc-caixinha ${v > caixinhaLivre ? 'pouco' : ''}`}>
            <Icone nome="cofre" tamanho={18} />
            <span>
              {tx('Na caixinha: {0}.', fmtValor(caixinhaLivre))}{' '}
              {mesJaChegou(Number(pagoEm.slice(0, 4)), Number(pagoEm.slice(5, 7)))
                ? tx('O valor pago sai dela em Dinheiro guardado.')
                : tx('Num mês que ainda não chegou, a caixinha não muda.')}
              {ligadoAoLimite && (' ' + tx('O limite garantido do cartão diminui junto, como no banco.'))}
              {v > caixinhaLivre && <b> {tx('É mais do que tem na caixinha.')}</b>}
            </span>
          </div>
        )}
        {emParte && !parcial && <AvisoDoConsultor fala={naHoraDePagarParte(c.analise, centavos(faltaAntes - v))} />}
        <span className="campo-ajuda">
          {emParte
            ? tx('Fica faltando {0} nesta fatura. Ela continua em aberto até você pagar o resto.', fmtValor(centavos(faltaAntes - v)))
            : tx('Isso marca a fatura como paga. O gasto de cada compra já está nas suas saídas de {0}, então nada é contado duas vezes.', noMeioDaFrase(MESES_NOME[f.mes - 1]))}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {antigo && (desfazer
            ? <button type="button" className="btn perigo" onClick={() => void desfazerPagamento()}>{tx('Desfazer mesmo')}</button>
            : <button type="button" className="btn perigo" onClick={() => setDesfazer(true)}><Icone nome="desfazer" tamanho={15} /> {tx('Desfazer')}</button>)}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario" disabled={salvando}>{antigo ? tx('Salvar') : emParte ? tx('Pagar esta parte') : tx('Marcar como paga')}</button>
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
export function FormRenegociar({ c, alvo, aoFechar }: { c: Ctx; alvo: Alvo; aoFechar: () => void }) {
  const { cartao, f } = alvo
  const feita = f.paga && renegociada(f.paga) ? f.paga : null
  const divida = feita?.divida_id ? c.d.dividas.find((x) => x.id === feita.divida_id) : undefined
  const [n, setN] = useState('6')
  const [total, setTotal] = useState(paraCampo(f.valor))
  const [data, setData] = useState(hojeLocal())
  const [erro, setErro] = useState<string | null>(null)
  const [desfazer, setDesfazer] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const tot = parseNumero(total) ?? 0
  const parcelas = Math.max(1, Math.min(120, Number(n) || 1))
  const parcela = centavos(tot / parcelas)
  const acrescimo = centavos(Math.max(0, tot - f.valor))

  const salvar = async () => {
    if (!tot || tot <= 0) return setErro(tx('Valor total inválido.'))
    if (salvando) return
    // Grava com a janela aberta: dívida criada sem a fatura marcada contaria as compras e a dívida em dobro, então se a
    // fatura não grava a dívida é apagada e a janela fica, com o aviso.
    setSalvando(true)
    if (!c.v.dividas) c.ligarModulo('dividas')
    const d = await c.d.addDivida({
      descricao: tx('Fatura {0} de {1} (renegociada)', cartao.nome, nomeDaFatura(f.ano, f.mes)),
      valor_parcela: parcela, saldo: tot, data: data || hojeLocal(),
      // a 1ª parcela do acordo vence no mês seguinte, no dia do vencimento do cartão
      sentido: 'devo', pessoa: cartao.nome, total_parcelas: parcelas,
      inicio: somaMesesData(`${(data || hojeLocal()).slice(0, 8)}${String(Math.min(cartao.dia_vencimento, 28)).padStart(2, '0')}`, 1),
    })
    if (!d) { setSalvando(false); return setErro(tx('Não consegui criar a dívida do acordo. Nada foi gravado: tente de novo.')) }
    const nova = await c.cartoes.pagarFatura({
      cartao_id: cartao.id, ano: f.ano, mes: f.mes, valor: f.valor, pago_em: data || hojeLocal(),
      tipo: 'renegociada', divida_id: d.id, juros: acrescimo,
    })
    if (!nova) {
      await c.d.delDivida(d.id)
      setSalvando(false)
      return setErro(tx('Não consegui marcar a fatura como renegociada. Nada foi gravado: tente de novo.'))
    }
    aoFechar()
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
          <CampoData valor={data} aoMudar={setData} rotulo={tx('Dia do acordo')} obrigatorio />
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
          <button type="submit" className="btn primario" disabled={salvando}><Icone nome="acordo" tamanho={16} /> {tx('Renegociar')}</button>
        </div>
      </form>
    </Modal>
  )
}
