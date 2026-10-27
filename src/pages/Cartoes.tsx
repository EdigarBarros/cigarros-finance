import { useState } from 'react'
import { hojeLocal, nomeDaFatura, quandoVence, ROTULO_STATUS, totalFaturasAPagar, totalFaturasDoMes, type CompraParcelada, type SituacaoCartao } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtDataCurta, fmtDataLonga, fmtValor, MESES_NOME, paraCampo, parseNumero, simbolo } from '../lib/format'
import { BANCOS_CONHECIDOS, CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import type { CartaoCredito } from '../lib/types'
import { Selo } from '../components/Categorias'
import { Icone } from '../components/Icone'
import { Cartao, Interruptor, Kpi, Modal, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const sufixoMes = (ano: number, mes: number) => `${MESES_NOME[mes - 1].slice(0, 3).toLowerCase()}/${String(ano).slice(2)}`

/** Cartões de crédito: a fatura de cada mês, o que entrou nela, o limite e as parcelas que ainda vêm. */
export function Cartoes(c: Ctx) {
  const [editando, setEditando] = useState<CartaoCredito | 'novo' | null>(null)
  const [pagando, setPagando] = useState<SituacaoCartao | null>(null)
  const { cartoes, faturas } = c
  const arquivados = cartoes.cartoes.filter((x) => !x.ativo)
  const comLimite = faturas.filter((s) => s.limiteDisponivel !== null)

  if (cartoes.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>Cartões</h1></div></header>
        <Cartao><Vazio>Para usar cartões de crédito, falta atualizar o banco de dados: rode <code>supabase/migracao-08-cartoes.sql</code> no SQL Editor do Supabase.</Vazio></Cartao>
      </div>
    )
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Cartões</h1>
          <p className="sub">Faturas de {MESES_NOME[c.mes - 1].toLowerCase()}/{c.ano}. Cada compra entra sozinha na fatura certa, e as parceladas se espalham pelos meses.</p>
        </div>
        {cartoes.cartoes.length > 0 && <button className="btn primario" onClick={() => setEditando('novo')}><Icone nome="mais" tamanho={16} /> Novo cartão</button>}
      </header>

      {cartoes.carregado && !cartoes.cartoes.length && (
        <Cartao>
          <Vazio>
            Cadastre seu cartão com o dia em que a fatura fecha e o dia em que vence. Daí é só lançar as compras escolhendo o cartão:
            o app põe cada parcela na fatura certa e mostra quanto você ainda pode gastar.<br />
            <button className="btn primario" style={{ marginTop: 14 }} onClick={() => setEditando('novo')}>
              <Icone nome="mais" tamanho={16} /> Cadastrar meu primeiro cartão
            </button>
          </Vazio>
        </Cartao>
      )}

      {faturas.length > 0 && (
        <div className="kpis">
          <Kpi rotulo={`Faturas de ${MESES_NOME[c.mes - 1].toLowerCase()}`} valor={fmtValor(totalFaturasDoMes(faturas))} cor={COR.saidas} />
          <Kpi rotulo="Falta pagar" valor={fmtValor(totalFaturasAPagar(faturas))} cor={COR.divida} />
          {comLimite.length > 0 && (
            <Kpi rotulo="Limite disponível" valor={fmtValor(comLimite.reduce((a, s) => a + Math.max(0, s.limiteDisponivel!), 0))} cor={COR.caixa} />
          )}
        </div>
      )}

      {faturas.map((s) => (
        <CartaoDeCredito key={s.cartao.id} s={s} c={c} aoEditar={() => setEditando(s.cartao)} aoPagar={() => setPagando(s)} />
      ))}

      {arquivados.length > 0 && (
        <Cartao titulo="Cartões que você não usa mais">
          <ul className="lista-lanc">
            {arquivados.map((x) => (
              <li key={x.id} className="cc-arquivado">
                <span><i className="marcador" style={{ background: x.cor }} />{x.nome}</span>
                <button className="link" onClick={() => setEditando(x)}>Editar</button>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {editando && <FormCartao c={c} cartao={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {pagando && <FormPagarFatura c={c} s={pagando} aoFechar={() => setPagando(null)} />}
    </div>
  )
}

function CartaoDeCredito({ s, c, aoEditar, aoPagar }: { s: SituacaoCartao; c: Ctx; aoEditar: () => void; aoPagar: () => void }) {
  const { cartao } = s
  const banco = c.v.bancos ? c.d.bancos.find((b) => b.id === cartao.banco_id) : undefined
  const hoje = hojeLocal()
  const fatura = nomeDaFatura(s.ano, s.mes, c.ano)
  const paga = s.paga
  const mudou = paga && Math.abs(paga.valor - s.valor) >= 0.01
  const usadoPct = cartao.limite ? s.limiteUsado / cartao.limite : 0

  return (
    <Cartao className="cc">
      <header className="cc-topo">
        <h2 className="cc-nome">
          <i className="marcador grande" style={{ background: cartao.cor }} />{cartao.nome}
          {banco && <small>{banco.nome}</small>}
        </h2>
        <div className="cc-acoes">
          <button className="link" onClick={aoEditar}>Editar</button>
          <button className="btn" onClick={() => c.novaCompraNoCartao(cartao.id)}><Icone nome="mais" tamanho={16} /> Nova compra</button>
        </div>
      </header>

      <div className="cc-corpo">
        <div className="cc-fatura" style={{ '--c': cartao.cor } as React.CSSProperties}>
          <div className="cc-fatura-topo">
            <span>Fatura de {fatura}</span>
            <span className={`cc-status ${s.status}`}>{ROTULO_STATUS[s.status]}</span>
          </div>
          <strong className="cc-valor">{fmtValor(s.valor)}</strong>
          <p className="cc-datas">
            {s.fechamento < hoje ? 'Fechou' : s.fechamento === hoje ? 'Fecha hoje' : 'Fecha'}{s.fechamento !== hoje && ` em ${fmtDataLonga(s.fechamento)}`}
            <br />
            {paga
              ? <>Paga em {fmtDataLonga(paga.pago_em)}</>
              : <>Vence em {fmtDataLonga(s.vencimento)} <b>({quandoVence(s)})</b></>}
          </p>
          {mudou && <p className="cc-aviso">Você pagou {fmtValor(paga.valor)}; depois disso a fatura mudou.</p>}
          {paga
            ? <button className="btn" onClick={() => void c.cartoes.desfazerPagamento(paga.id)}>Desfazer pagamento</button>
            : s.valor > 0 && s.status !== 'futura' && <button className="btn primario" onClick={aoPagar}><Icone nome="check" tamanho={16} /> Paguei a fatura</button>}

          {cartao.limite ? (
            <div className="cc-limite">
              <Progresso valor={s.limiteUsado} total={cartao.limite} cor={usadoPct > 0.9 ? COR.saidas : cartao.cor} />
              <div className="divida-info">
                <span>Usado {fmtValor(s.limiteUsado)}</span>
                <span>Disponível {fmtValor(Math.max(0, s.limiteDisponivel ?? 0))}</span>
              </div>
              <small>Limite de {fmtValor(cartao.limite)}. Conta o que ainda falta pagar, das faturas deste mês em diante.</small>
            </div>
          ) : (
            <button className="link cc-sem-limite" onClick={aoEditar}>Informe o limite para ver quanto ainda pode gastar</button>
          )}
        </div>

        <div className="cc-lado">
          <h3 className="cc-titulo">Compras desta fatura</h3>
          {s.compras.length ? (
            <ul className="lista-lanc">
              {s.compras.map((l) => {
                const k = c.categoriaDe(l) ?? SEM_CATEGORIA
                return (
                  <li key={l.id}>
                    <button className="item-lanc" onClick={() => c.editarLancamento(l)}>
                      <Selo c={k} tamanho={34} />
                      <span className="item-texto">
                        <span className="item-desc">{l.descricao || 'Compra'}</span>
                        <span className="item-meta">
                          {fmtDataCurta(l.data_compra ?? null) && <>{fmtDataCurta(l.data_compra ?? null)} · </>}{k.nome}
                          {(l.parcelas ?? 1) > 1 && <> · parcela {l.parcela}/{l.parcelas}</>}
                        </span>
                      </span>
                      <span className="item-valor">{fmtValor(l.valor)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="quadro-vazio">Nenhuma compra nesta fatura. Toque em “Nova compra” e escolha este cartão.</p>
          )}
        </div>
      </div>

      <div className="cc-baixo">
        <section>
          <h3 className="cc-titulo">Próximas faturas</h3>
          <ul className="cc-proximas">
            {s.proximas.map((f) => (
              <li key={`${f.ano}-${f.mes}`} className={f.valor ? '' : 'vazia'}>
                <span>{sufixoMes(f.ano, f.mes)}</span>
                <strong>{f.valor ? fmtValor(f.valor) : '—'}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="cc-titulo">Compras parceladas em andamento</h3>
          {s.parceladas.length ? (
            <ul className="cc-parceladas">
              {s.parceladas.map((p) => <Parcelada key={p.compra_id} p={p} cor={cartao.cor} />)}
            </ul>
          ) : (
            <p className="quadro-vazio">Nenhuma compra parcelada pela frente.</p>
          )}
        </section>
      </div>
    </Cartao>
  )
}

function Parcelada({ p, cor }: { p: CompraParcelada; cor: string }) {
  return (
    <li>
      <div className="cc-parcelada-linha">
        <span className="item-desc">{p.descricao || 'Compra'}</span>
        <b>{p.atual}/{p.parcelas}</b>
      </div>
      <Progresso valor={p.parcelas - p.restantes} total={p.parcelas} cor={cor} />
      <small>
        {fmtValor(p.valorParcela)} por mês · faltam {fmtValor(p.valorRestante)} · termina em {sufixoMes(p.termina.ano, p.termina.mes)}
      </small>
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
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const bancos = c.d.bancos
  const sugestoes = BANCOS_CONHECIDOS.filter((b) => b.nome !== 'Dinheiro').slice(0, 9)

  const escolherSugestao = (b: (typeof sugestoes)[number]) => {
    setNome(b.nome)
    setCor(b.cor)
    const meu = bancos.find((x) => mesmoNome(x.nome, b.nome))
    if (meu) setBancoId(meu.id)
  }

  const salvar = async () => {
    if (!nome.trim()) return setErro('Dê um nome para o cartão.')
    if (!fecha || !vence) return setErro('Escolha o dia em que a fatura fecha e o dia em que vence.')
    const lim = limite.trim() ? parseNumero(limite) : null
    if (limite.trim() && (!lim || lim <= 0)) return setErro('Limite inválido.')
    const dados = {
      nome: nome.trim(), cor, banco_id: bancoId || null, limite: lim,
      dia_fechamento: Number(fecha), dia_vencimento: Number(vence), ativo,
    }
    if (cartao) await c.cartoes.updCartao(cartao.id, dados)
    else await c.cartoes.addCartao(dados)
    aoFechar()
  }

  return (
    <Modal titulo={cartao ? 'Editar cartão' : 'Novo cartão'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {!cartao && (
          <div className="campo">
            <span className="campo-rotulo">Escolha rápida</span>
            <div className="chips">
              {sugestoes.map((b) => (
                <button key={b.nome} type="button" className={`chip ${nome === b.nome ? 'ativo' : ''}`} style={{ '--c': b.cor } as React.CSSProperties}
                  onClick={() => escolherSugestao(b)}>
                  <i className="marcador" />{b.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">Nome do cartão</span>
          <input autoFocus={Boolean(cartao)} value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} maxLength={40} placeholder="Ex.: Nubank, Itaú Platinum…" />
        </label>
        <div className="campo">
          <span className="campo-rotulo">Cor</span>
          <div className="chips" role="radiogroup" aria-label="Cor">
            {[...new Set([cor, ...CORES_LIVRES, ...BANCOS_CONHECIDOS.map((b) => b.cor)])].slice(0, 14).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
                style={{ background: k }} onClick={() => setCor(k)} />
            ))}
          </div>
        </div>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">Dia que a fatura fecha</span>
            <select value={fecha} onChange={(e) => { setFecha(e.target.value); setErro(null) }}>
              <option value="">Escolher…</option>
              {DIAS.map((d) => <option key={d} value={d}>dia {d}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="campo-rotulo">Dia que vence</span>
            <select value={vence} onChange={(e) => { setVence(e.target.value); setErro(null) }}>
              <option value="">Escolher…</option>
              {DIAS.map((d) => <option key={d} value={d}>dia {d}</option>)}
            </select>
          </label>
        </div>
        <span className="campo-ajuda">Os dois dias aparecem no app do seu banco. Compras feitas depois do dia que fecha entram na fatura do mês seguinte.{cartao && ' Mudar os dias vale para as próximas compras; as que você já lançou ficam onde estão.'}</span>
        <label className="campo">
          <span className="campo-rotulo">Limite <small>(opcional)</small></span>
          <span className="campo-caixa">
            <span className="prefixo">{simbolo()}</span>
            <input inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="0,00" />
          </span>
          <span className="campo-ajuda">Com o limite, o app mostra quanto ainda dá para gastar.</span>
        </label>
        {bancos.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">Banco do cartão <small>(opcional)</small></span>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">Nenhum</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </label>
        )}
        {cartao && (
          <div className="cc-uso">
            <span>Ainda uso este cartão<small>Se desligar, ele some das telas, mas o histórico fica.</small></span>
            <Interruptor ligado={ativo} aoMudar={setAtivo} rotulo="Ainda uso este cartão" />
          </div>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {cartao && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.cartoes.delCartao(cartao.id); aoFechar() }}>Excluir mesmo</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{cartao ? 'Salvar' : 'Criar cartão'}</button>
        </div>
        {confirmar && <span className="campo-ajuda">As compras continuam nas suas saídas, só deixam de ser ligadas a este cartão. As faturas marcadas como pagas são esquecidas.</span>}
      </form>
    </Modal>
  )
}

function FormPagarFatura({ c, s, aoFechar }: { c: Ctx; s: SituacaoCartao; aoFechar: () => void }) {
  const [data, setData] = useState(hojeLocal())
  const [bancoId, setBancoId] = useState(s.cartao.banco_id ?? '')
  const bancos = c.v.bancos ? c.d.bancos : []

  const salvar = () => {
    void c.cartoes.pagarFatura({ cartao_id: s.cartao.id, ano: s.ano, mes: s.mes, valor: s.valor, pago_em: data || hojeLocal(), banco_id: bancoId || null })
    aoFechar()
  }

  return (
    <Modal titulo={`Fatura ${s.cartao.nome}`} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <div className="cc-confirma">
          <span>Fatura de {nomeDaFatura(s.ano, s.mes, c.ano)}</span>
          <strong>{fmtValor(s.valor)}</strong>
        </div>
        <label className="campo">
          <span className="campo-rotulo">Dia do pagamento</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        {bancos.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">De qual banco saiu? <small>(opcional)</small></span>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">Não sei / não importa</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </label>
        )}
        <span className="campo-ajuda">
          Isso só marca a fatura como paga. O gasto de cada compra já está nas suas saídas de {MESES_NOME[s.mes - 1].toLowerCase()}, então nada é contado duas vezes.
        </span>
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Marcar como paga</button>
        </div>
      </form>
    </Modal>
  )
}
