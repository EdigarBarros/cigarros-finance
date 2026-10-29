import { CenaCofre } from '../components/Vazios'
import { useState } from 'react'
import { caixaDoBanco, somaCaixa } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtValor, MESES_CURTO, MESES_NOME, simbolo } from '../lib/format'
import { converter, infoMoeda } from '../lib/moedas'
import { CATALOGO_BANCOS, PALETA_BANCOS } from '../lib/bancos'
import { mesmoNome, NOME_TIPO_CAIXA } from '../lib/rotulos'
import { TIPOS_CAIXA, type Banco, type TipoCaixa } from '../lib/types'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { BancoIcone } from '../components/BancoIcone'
import { Bandeira } from '../components/Bandeira'
import { CartaoIlustrado } from '../components/CartaoIlustrado'
import { Numero } from '../components/Numero'
import { Anel, CampoValor, Cartao, Faisca, Kpi, Modal, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

const SEM_BANCO = 'sem'
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const contem = (nome: string, busca: string) => semAcento(nome).includes(semAcento(busca.trim()))

const ICONE_TIPO: Record<TipoCaixa, string> = { cc: 'carteira', caixinha: 'cofre', reserva: 'escudo' }
const COR_TIPO: Record<TipoCaixa, string> = { cc: COR.caixa, caixinha: COR.entradas, reserva: COR.divida }
const TEXTO_TIPO: Record<TipoCaixa, string> = {
  cc: 'para o dia a dia', caixinha: 'rendendo, pode tirar quando quiser', reserva: 'só para imprevistos',
}

/**
 * Dinheiro guardado: o patrimônio do mês (bancos, investimentos e outras moedas) com a composição e a evolução, quantos
 * meses a reserva cobre, cada banco com o selo e a divisão conta/caixinha/reserva (toque para ver só ele) e os campos
 * para atualizar os saldos. Caixinha ligada a um cartão mostra o limite que ela garante.
 */
export function Patrimonio(c: Ctx) {
  const { v } = c
  const [aberto, setAberto] = useState<string | null>(c.bancoAberto)
  const [gerenciar, setGerenciar] = useState<Banco | 'novo' | null>(null)
  const bancos = c.d.bancos
  const caixa = c.mesEf.caixa
  const herdado = c.mesEf.herdadoDe
  // Ao gravar o mês, o que ele herdou (caixa e moedas) passa a ser dele.
  const salvarCaixa = (id: string, t: TipoCaixa, valor: number) =>
    c.d.salvarMes(c.ano, c.mes, { caixa: { ...caixa, [id]: { ...caixa[id], [t]: valor } }, moedas: c.mesEf.moedas })
  const salvarMoeda = (m: string, valor: number) =>
    c.d.salvarMes(c.ano, c.mes, { caixa, moedas: { ...c.mesEf.moedas, [m]: valor } })
  const confirmar = () => c.d.salvarMes(c.ano, c.mes, { caixa, moedas: c.mesEf.moedas })

  const lancsDe = (id: string) =>
    c.lancsMes.filter((l) => (id === SEM_BANCO ? !l.banco_id || !bancos.some((b) => b.id === l.banco_id) : l.banco_id === id))
  const soma = (ls: typeof c.lancsMes, t: 'entrada' | 'saida') => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)
  // Caixinha que vira limite de cartão (limite garantido ligado à caixinha do banco).
  const garantias = (bancoId: string) => c.cartoes.cartoes.filter((k) => k.ativo && k.garantia_caixinha && k.banco_id === bancoId)

  const faixaHerdado = herdado && (
    <div className="faixa-herdado">
      <span>Os saldos vêm de <b>{MESES_NOME[herdado[1] - 1].toLowerCase()} de {herdado[0]}</b>. Se nada mudou, confirme; se mudou, edite.</span>
      <button className="btn" onClick={confirmar}><Icone nome="check" tamanho={16} /> Continua igual</button>
    </div>
  )

  // ---------- detalhe de um banco ----------
  if (aberto) {
    const banco = bancos.find((b) => b.id === aberto)
    const ls = lancsDe(aberto).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
    const ent = soma(ls, 'entrada')
    const sai = soma(ls, 'saida')
    const nome = banco?.nome ?? 'Sem banco'
    const cor = banco?.cor ?? '#55555f'
    const cartoesDoBanco = banco ? c.cartoes.cartoes.filter((k) => k.ativo && k.banco_id === banco.id) : []
    return (
      <div className="pagina pg-guardado" style={{ '--c': cor } as React.CSSProperties}>
        <header className="pagina-topo">
          <div>
            <button className="link voltar" onClick={() => setAberto(null)}><Icone nome="esq" tamanho={16} /> Todos os bancos</button>
            <h1 className="gd-titulo-banco">{banco ? <BancoIcone nome={banco.nome} cor={banco.cor} tamanho={40} /> : <span className="gd-sem-banco"><Icone nome="carteira" tamanho={22} /></span>}{nome}</h1>
            <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano}</p>
          </div>
          {banco && <button className="btn" onClick={() => setGerenciar(banco)}><Icone nome="lapis" tamanho={15} /> Editar banco</button>}
        </header>
        <div className="kpis">
          {banco && <Kpi rotulo="Guardado" valor={caixaDoBanco(caixa, banco.id)} cor={cor} icone="carteira" />}
          <Kpi rotulo="Entrou" valor={ent} cor={COR.entradas} icone="receber" />
          <Kpi rotulo="Saiu" valor={sai} cor={COR.saidas} icone="enviar" />
          <Kpi rotulo="Sobrou no mês" valor={ent - sai} cor={COR.fluxo} icone="investir" />
        </div>
        {banco && (
          <>
            {faixaHerdado}
            <section className="gd-tipos">
              {TIPOS_CAIXA.map((t, i) => (
                <div key={t} className="cartao gd-tipo" style={{ '--t': COR_TIPO[t], animationDelay: `${i * 70}ms` } as React.CSSProperties}>
                  <span className="gd-tipo-icone"><Icone nome={ICONE_TIPO[t]} tamanho={22} /></span>
                  <span className="gd-tipo-texto"><strong>{NOME_TIPO_CAIXA[t]}</strong><small>{TEXTO_TIPO[t]}</small></span>
                  <CampoValor rotulo={`Quanto tem em ${NOME_TIPO_CAIXA[t].toLowerCase()}`} valor={caixa[banco.id]?.[t] ?? 0} prefixo={simbolo()}
                    aoSalvar={(n) => salvarCaixa(banco.id, t, n)} />
                  {t === 'caixinha' && garantias(banco.id).map((k) => (
                    <span key={k.id} className="chip-info bom"><Icone nome="escudo" tamanho={12} /> vira limite no {k.nome}</span>
                  ))}
                </div>
              ))}
            </section>
            {cartoesDoBanco.length > 0 && (
              <section className="cartao gd-cartoes-banco">
                <h3 className="ccd-titulo">Cartões deste banco</h3>
                <div className="gd-cartoes-lista">
                  {cartoesDoBanco.map((k) => {
                    const f = c.faturas.find((x) => x.cartao.id === k.id)
                    return (
                      <button key={k.id} className="gd-cartao-mini" onClick={() => c.irPara('cartoes')}>
                        <CartaoIlustrado nome={k.nome} cor={k.cor} banco={banco.nome} compacto
                          conteudo={f ? <span className="cc-plastico-fatura"><small>fatura</small><b>{fmtValor(f.valor)}</b></span> : undefined} />
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
        <Cartao titulo={`Lançamentos (${ls.length})`}>
          {ls.length ? (
            <ul className="lista-lanc">
              {ls.map((l) => <ItemLancamento key={l.id} l={l} categoria={c.categoriaDe(l)} aoClicar={() => c.editarLancamento(l)} />)}
            </ul>
          ) : (
            <Vazio>Nenhum lançamento {banco ? `no ${nome}` : 'sem banco'} neste mês.</Vazio>
          )}
        </Cartao>
        {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} aoExcluir={() => setAberto(null)} />}
      </div>
    )
  }

  // ---------- visão geral ----------
  const semBanco = lancsDe(SEM_BANCO)
  const porTipo = Object.fromEntries(TIPOS_CAIXA.map((t) => [t, bancos.reduce((a, b) => a + (caixa[b.id]?.[t] ?? 0), 0)])) as Record<TipoCaixa, number>
  const investido = v.investimentos ? c.r.investimentos : 0
  const emMoedas = v.moedas ? c.r.moedasConvertido : 0
  const emBancos = v.bancos ? somaCaixa(caixa) : 0
  const total = emBancos + investido + emMoedas
  const valorDe = (x: NonNullable<Ctx['porMes'][number]>) => (v.bancos ? x.caixa : 0) + (v.investimentos ? x.investimentos : 0) + (v.moedas ? x.moedasConvertido : 0)
  const anterior = c.anterior ? valorDe(c.anterior) : 0
  const janela = Array.from({ length: Math.min(6, c.mes) }, (_, i) => c.mes - Math.min(6, c.mes) + i + 1)
  const tendencia = { valores: janela.map((m) => { const x = c.porMes[m - 1]; return x ? valorDe(x) : null }), meses: janela.map((m) => MESES_CURTO[m - 1]) }
  const partes = [
    ...(v.bancos ? TIPOS_CAIXA.map((t) => ({ id: t, nome: NOME_TIPO_CAIXA[t], valor: porTipo[t], cor: COR_TIPO[t] })) : []),
    ...(v.investimentos ? [{ id: 'inv', nome: 'Investimentos', valor: investido, cor: COR.investimentos }] : []),
    ...(v.moedas ? [{ id: 'moedas', nome: 'Outras moedas', valor: emMoedas, cor: COR.usd }] : []),
  ].filter((p) => p.valor > 0)
  // Reserva de emergência: quantos meses de gastos ela cobre (média das saídas dos meses com dados).
  const comDados = c.porMes.filter((r) => r && r.saidas > 0)
  const gastoMedio = comDados.length ? comDados.reduce((a, r) => a + r!.saidas, 0) / comDados.length : 0
  const reserva = porTipo.reserva
  const mesesReserva = gastoMedio > 0 ? reserva / gastoMedio : 0
  const cartoesBanco = [
    ...bancos.map((b) => ({ id: b.id, nome: b.nome, cor: b.cor, guardado: caixaDoBanco(caixa, b.id), ls: lancsDe(b.id) })),
    ...(semBanco.length ? [{ id: SEM_BANCO, nome: 'Sem banco', cor: '#6b7a99', guardado: null as number | null, ls: semBanco }] : []),
  ]

  return (
    <div className="pagina pg-guardado">
      <header className="pagina-topo">
        <div>
          <h1>Dinheiro guardado</h1>
          <p className="sub">Como está em {MESES_NOME[c.mes - 1].toLowerCase()} de {c.ano}.{v.bancos && ' Toque num banco para ver só ele.'}</p>
        </div>
        {v.bancos && <button className="btn primario" onClick={() => setGerenciar('novo')}><Icone nome="mais" tamanho={16} /> Adicionar banco</button>}
      </header>

      <section className="gd-topo">
        <div className="cartao gd-total">
          <span className="gd-total-cab">
            <span className="gd-total-icone"><Icone nome="carteira" tamanho={22} /></span>
            <span><small>tudo o que você tem</small><strong><Numero valor={total} formato={fmtValor} /></strong></span>
            {tendencia.valores.filter((x) => x !== null).length > 1 && <span className="gd-faisca"><Faisca {...tendencia} cor={COR.caixa} /></span>}
          </span>
          {anterior > 0 && Math.abs(total - anterior) < 0.01 && <span className="chip-info">igual a {MESES_CURTO[c.mes - 2].toLowerCase()}</span>}
          {anterior > 0 && Math.abs(total - anterior) >= 0.01 && (
            <span className={`chip-info ${total > anterior ? 'bom' : 'ruim'}`}>
              <Icone nome={total > anterior ? 'sobe' : 'desce'} tamanho={12} />
              {fmtValor(Math.abs(total - anterior))} {total > anterior ? 'a mais' : 'a menos'} que em {MESES_CURTO[c.mes - 2].toLowerCase()}
            </span>
          )}
          {partes.length > 0 ? (
            <>
              <span className="gd-composicao" aria-hidden="true">
                {partes.map((p, i) => <i key={p.id} style={{ flexGrow: p.valor, background: p.cor, animationDelay: `${200 + i * 90}ms` }} />)}
              </span>
              <ul className="gd-legenda">
                {partes.map((p) => (
                  <li key={p.id}><i style={{ background: p.cor }} />{p.nome}<b>{fmtValor(p.valor)}</b><small>{total ? Math.round((p.valor / total) * 100) : 0}%</small></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="quadro-vazio">Atualize os saldos abaixo para ver tudo junto aqui.</p>
          )}
        </div>
        {v.bancos && (
          <div className="cartao gd-reserva">
            <h3 className="ccd-titulo"><Icone nome="escudo" tamanho={18} /> Reserva de emergência</h3>
            <div className="gd-reserva-corpo">
              <Anel valor={Math.min(1, mesesReserva / 6)} cor={mesesReserva >= 6 ? COR.entradas : mesesReserva >= 3 ? COR.caixa : COR.divida} tamanho={104}>
                <span className="gd-reserva-meses"><b>{mesesReserva >= 10 ? Math.round(mesesReserva) : mesesReserva.toFixed(1).replace('.', ',')}</b><small>meses</small></span>
              </Anel>
              <span className="gd-reserva-texto">
                <span>{reserva > 0
                  ? <>Sua reserva de <b>{fmtValor(reserva)}</b> cobre {mesesReserva >= 6 ? 'mais de ' : ''}<b>{mesesReserva.toFixed(1).replace('.', ',')} meses</b> do que você gasta.</>
                  : <>Marque em cada banco quanto é <b>reserva</b>: o app mostra quantos meses de gastos ela cobre.</>}</span>
                <small>{gastoMedio > 0 ? `O ideal são 6 meses: ${fmtValor(gastoMedio * 6)}.` : 'Lance seus gastos para o app calcular.'}</small>
                {v.metas && reserva < gastoMedio * 6 && gastoMedio > 0 && (
                  <button className="link" onClick={() => c.irPara('metas')}>Criar meta para a reserva <Icone nome="seta" tamanho={14} /></button>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      {v.bancos && faixaHerdado}

      {v.bancos && !bancos.length && (
        <section className="cartao gd-vazio">
          <CenaCofre />
          <h2>Seu dinheiro guardado começa aqui</h2>
          <span className="gd-vazio-selos" aria-hidden="true">
            {['Nubank', 'Itaú', 'PicPay', 'Inter'].map((n, i) => <BancoIcone key={n} nome={n} tamanho={38 + (i % 2) * 6} />)}
          </span>
          <strong className="gd-vazio-sub">Separe por banco</strong>
          <p>Bancos são opcionais: servem para ver cada um separado e guardar quanto tem em conta, caixinha e reserva.</p>
          <button className="btn primario" onClick={() => setGerenciar('novo')}><Icone nome="mais" tamanho={16} /> Adicionar o primeiro banco</button>
        </section>
      )}

      {v.bancos && cartoesBanco.length > 0 && (
        <div className="gd-bancos">
          {cartoesBanco.map((x, i) => {
            const ent = soma(x.ls, 'entrada')
            const sai = soma(x.ls, 'saida')
            const gar = x.id !== SEM_BANCO ? garantias(x.id) : []
            return (
              <button key={x.id} className="cartao gd-banco" style={{ '--c': x.cor, animationDelay: `${Math.min(i, 8) * 60}ms` } as React.CSSProperties} onClick={() => setAberto(x.id)}>
                <span className="gd-banco-cab">
                  {x.id === SEM_BANCO ? <span className="gd-sem-banco"><Icone nome="carteira" tamanho={20} /></span> : <BancoIcone nome={x.nome} cor={x.cor} tamanho={38} />}
                  <strong>{x.nome}</strong>
                  <Icone nome="dir" tamanho={16} />
                </span>
                <span className="gd-banco-saldo">
                  <small>{x.guardado === null ? 'sem banco definido' : 'guardado'}</small>
                  <b>{x.guardado === null ? `${x.ls.length} lançamentos` : <Numero valor={x.guardado} formato={fmtValor} />}</b>
                </span>
                {x.guardado !== null && x.guardado > 0 && (
                  <span className="gd-banco-barra" aria-hidden="true">
                    {TIPOS_CAIXA.map((t) => (caixa[x.id]?.[t] ?? 0) > 0 && <i key={t} style={{ flexGrow: caixa[x.id]?.[t] ?? 0, background: COR_TIPO[t] }} title={NOME_TIPO_CAIXA[t]} />)}
                  </span>
                )}
                {gar.length > 0 && <span className="chip-info bom"><Icone nome="escudo" tamanho={12} /> caixinha vira limite no {gar.map((k) => k.nome).join(', ')}</span>}
                <span className="gd-banco-mov">
                  <span><Icone nome="receber" tamanho={14} /> {fmtValor(ent)}</span>
                  <span><Icone nome="enviar" tamanho={14} /> {fmtValor(sai)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {(v.investimentos || v.moedas) && (
        <div className="gd-extras">
          {v.investimentos && (
            <section className="cartao gd-extra" style={{ '--c': COR.investimentos } as React.CSSProperties}>
              <h3 className="ccd-titulo"><span className="gd-extra-icone"><Icone nome="investir" tamanho={18} /></span> Investimentos</h3>
              <CampoValor rotulo="Quanto você tem investido neste mês" prefixo={simbolo()} valor={c.r.investimentos}
                aoSalvar={(investimentos) => c.d.salvarMes(c.ano, c.mes, { investimentos })} />
              {(() => {
                const serie = { valores: janela.map((m) => c.porMes[m - 1]?.investimentos ?? null), meses: janela.map((m) => MESES_CURTO[m - 1]) }
                return serie.valores.filter((x) => x).length > 1 ? <span className="gd-extra-faisca"><Faisca {...serie} cor={COR.investimentos} /></span> : null
              })()}
              <p className="dica">Aceita contas: <code>=1500+320</code></p>
            </section>
          )}
          {v.moedas && (
            <section className="cartao gd-extra" style={{ '--c': COR.usd } as React.CSSProperties}>
              <h3 className="ccd-titulo"><span className="gd-extra-icone"><Icone nome="globo" tamanho={18} /></span> Outras moedas <small>≈ {fmtValor(c.r.moedasConvertido)}</small></h3>
              <ul className="gd-moedas">
                {c.perfil.moedas.map((m) => {
                  const conv = converter(c.mesEf.moedas[m] ?? 0, m, c.taxas)
                  return (
                    <li key={m}>
                      <Bandeira moeda={m} tamanho={34} />
                      <CampoValor rotulo={infoMoeda(m).nome} prefixo={simbolo(m)} moeda={m} valor={c.mesEf.moedas[m] ?? 0} aoSalvar={(valor) => salvarMoeda(m, valor)} />
                      <span className="gd-moeda-conv">
                        <b>{conv === null ? '—' : `≈ ${fmtValor(conv)}`}</b>
                        <small>{c.taxas[m] ? `1 ${m} = ${fmtValor(c.taxas[m])}` : 'sem cotação agora'}</small>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="dica">Cotação do dia por <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a>. Para mudar as moedas, use <button className="link" onClick={c.personalizar}>Configurações</button>.</p>
            </section>
          )}
        </div>
      )}

      {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} />}
    </div>
  )
}

function FormBanco({ c, banco, aoFechar, aoExcluir }: { c: Ctx; banco?: Banco; aoFechar: () => void; aoExcluir?: () => void }) {
  const [nome, setNome] = useState(banco?.nome ?? '')
  const [cor, setCor] = useState(banco?.cor ?? PALETA_BANCOS[c.d.bancos.length % PALETA_BANCOS.length])
  const [outro, setOutro] = useState(Boolean(banco))
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const outros = c.d.bancos.filter((b) => b.id !== banco?.id)
  const repetido = (n: string) => outros.some((b) => mesmoNome(b.nome, n))
  const lista = CATALOGO_BANCOS.filter((b) => contem(b.nome, busca))

  const salvar = async () => {
    const n = nome.trim()
    if (!n) { setErro(outro ? 'Digite o nome do banco.' : 'Escolha um banco da lista ou toque em "Outro banco".'); return }
    if (repetido(n)) { setErro(`Você já tem um banco chamado "${n}".`); return }
    if (banco) await c.d.updBanco(banco.id, { nome: n, cor })
    else await c.d.addBanco(n, cor)
    aoFechar()
  }

  return (
    <Modal titulo={banco ? 'Editar banco' : 'Adicionar banco'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {!banco && (
          <div className="campo">
            <span className="campo-rotulo">Qual é o banco?</span>
            <input type="search" value={busca} placeholder="Buscar banco…" onChange={(e) => setBusca(e.target.value)} />
            <div className="cc-sugestoes gd-escolha-banco">
              {lista.map((b) => {
                const tem = repetido(b.nome)
                return (
                  <button key={b.nome} type="button" disabled={tem} title={tem ? 'Você já cadastrou este banco' : undefined}
                    className={`cc-sugestao ${!outro && nome === b.nome ? 'ativo' : ''}`}
                    onClick={() => { setOutro(false); setNome(b.nome); setCor(b.cor); setErro('') }}>
                    <BancoIcone nome={b.nome} cor={b.cor} tamanho={30} />
                    <span>{b.nome}</span>
                  </button>
                )
              })}
              <button type="button" className={`cc-sugestao ${outro ? 'ativo' : ''}`}
                onClick={() => { setOutro(true); setNome(''); setErro('') }}>
                <span className="gd-sem-banco"><Icone nome="mais" tamanho={16} /></span><span>Outro banco</span>
              </button>
            </div>
          </div>
        )}
        {outro && (
          <label className="campo">
            <span className="campo-rotulo">Nome do banco</span>
            <input autoFocus value={nome} placeholder="Ex.: Cooperativa da cidade, Dinheiro…"
              onChange={(e) => { setNome(e.target.value); setErro('') }} />
          </label>
        )}
        {(outro || banco) && (
          <div className="campo">
            <span className="campo-rotulo">Cor</span>
            <div className="chips" style={{ alignItems: 'center' }}>
              {[...new Set([cor, ...PALETA_BANCOS])].map((k) => (
                <button key={k} type="button" className={`cor ${cor === k ? 'ativo' : ''}`} style={{ background: k }} aria-label={`Cor ${k}`}
                  onClick={() => setCor(k)} />
              ))}
              <input type="color" value={cor} aria-label="Escolher outra cor" onChange={(e) => setCor(e.target.value)}
                style={{ width: 30, height: 30, padding: 0, border: 0, background: 'none', borderRadius: '50%' }} />
            </div>
          </div>
        )}
        {erro && <p role="alert" style={{ margin: 0, color: '#ff6b6b', fontSize: 13 }}>{erro}</p>}
        <div className="form-acoes">
          {banco && (
            <button type="button" className="btn perigo" onClick={() => {
              if (confirm(`Excluir "${banco.nome}"? Os lançamentos dele continuam, só ficam sem banco.`)) {
                void c.d.delBanco(banco.id)
                aoExcluir?.()
                aoFechar()
              }
            }}>Excluir</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

