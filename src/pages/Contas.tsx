import { useState } from 'react'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { COR } from '../lib/charts'
import {
  agruparContas, dataDaBaixa, fraseDaSituacao, inicioDoMes, mesesComAtraso, totaisDoMes, type SituacaoConta,
} from '../lib/contasFixas'
import { fmtValor, MESES_NOME, paraCampo, parseNumero, simbolo } from '../lib/format'
import { mesmoNome } from '../lib/rotulos'
import type { ContaFixa, Tipo } from '../lib/types'
import { EscolhaCategoria, Selo } from '../components/Categorias'
import { EscolhaBanco } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Modal, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'
import '../components/contas.css'

/** Pontos de partida para quem não sabe por onde começar. */
const EXEMPLOS: { nome: string; tipo: Tipo; icone: string; dica: string; categoria: string }[] = [
  { nome: 'Aluguel', tipo: 'saida', icone: '🏠', dica: 'ou prestação da casa', categoria: 'Moradia' },
  { nome: 'Luz', tipo: 'saida', icone: '💡', dica: 'o valor muda, você acerta na hora de pagar', categoria: 'Moradia' },
  { nome: 'Internet', tipo: 'saida', icone: '📶', dica: 'casa ou celular', categoria: 'Moradia' },
  { nome: 'Celular', tipo: 'saida', icone: '📱', dica: 'plano ou aparelho', categoria: 'Assinaturas' },
  { nome: 'Academia', tipo: 'saida', icone: '🏋️', dica: 'mensalidade', categoria: 'Saúde' },
  { nome: 'Streaming', tipo: 'saida', icone: '📺', dica: 'Netflix, Spotify, Disney…', categoria: 'Assinaturas' },
  { nome: 'Salário', tipo: 'entrada', icone: '💼', dica: 'o dia em que cai na conta', categoria: 'Salário' },
]

type Modelo = Pick<(typeof EXEMPLOS)[number], 'nome' | 'tipo' | 'categoria'>

const mesDe = (iso: string | null) => (iso ? iso.slice(0, 7) : '')
const quando = (iso: string) => `${MESES_NOME[Number(iso.slice(5, 7)) - 1].toLowerCase()}/${iso.slice(0, 4)}`

/** Contas que se repetem todo mês: o que vence, o que está atrasado e o que já foi pago, com "Paguei" a um toque. */
export function Contas(c: Ctx) {
  const [editando, setEditando] = useState<ContaFixa | 'nova' | null>(null)
  const [modelo, setModelo] = useState<Modelo | undefined>()
  const [outroValor, setOutroValor] = useState<SituacaoConta | null>(null)
  const { contas } = c.contas
  const sits = c.situacoesContas
  const t = totaisDoMes(sits)
  const g = agruparContas(sits)
  const nomeMes = MESES_NOME[c.mes - 1].toLowerCase()
  const anteriores = mesesComAtraso(contas, c.d.lancs, c.ano, c.mes)
  const nova = (m?: Modelo) => { setModelo(m); setEditando('nova') }
  const totalDe = (xs: SituacaoConta[]) => xs.reduce((a, s) => a + s.valor, 0)

  if (c.contas.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>Contas do mês</h1></div></header>
        <Cartao><Vazio>Para usar as contas do mês, falta atualizar o banco de dados: rode <code>supabase/migracao-07-contas-fixas.sql</code> no SQL Editor do Supabase.</Vazio></Cartao>
      </div>
    )
  }

  const grupo = (titulo: string, itens: SituacaoConta[], classe = '') => itens.length > 0 && (
    <Cartao className={`conta-grupo ${classe}`} titulo={titulo}
      acao={<span className="conta-grupo-total">{itens.length} {itens.length === 1 ? 'conta' : 'contas'} · {fmtValor(totalDe(itens))}</span>}>
      <ul className="conta-lista">
        {itens.map((s) => (
          <ItemConta key={s.conta.id} s={s} c={c} aoEditar={() => setEditando(s.conta)} aoOutroValor={() => setOutroValor(s)} />
        ))}
      </ul>
    </Cartao>
  )

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Contas do mês</h1>
          <p className="sub">O que vence, o que está atrasado e o que já foi pago em {nomeMes}. Toque em “Paguei” e o app lança por você.</p>
        </div>
        {contas.length > 0 && <button className="btn primario" onClick={() => nova()}><Icone nome="mais" tamanho={16} /> Nova conta fixa</button>}
      </header>

      {anteriores.length > 0 && (
        <div className="conta-aviso" role="status">
          <span>
            Ficou conta sem pagar em {anteriores.map((a) => `${MESES_NOME[a.mes - 1].toLowerCase()} (${a.qtd})`).join(', ')}.
          </span>
          <button className="link" onClick={() => c.irParaMes(anteriores[0].mes)}>Ver {MESES_NOME[anteriores[0].mes - 1].toLowerCase()}</button>
        </div>
      )}

      {sits.length > 0 && (
        <div className="kpis">
          {sits.some((s) => s.conta.tipo === 'saida') && <Kpi rotulo="Falta pagar no mês" valor={fmtValor(t.faltaPagar)} cor={COR.saidas} />}
          {t.jaPago > 0 && <Kpi rotulo="Já pago" valor={fmtValor(t.jaPago)} cor={COR.entradas} />}
          {t.atrasado > 0 && <Kpi rotulo="Atrasado" valor={fmtValor(t.atrasado)} cor={COR.divida} />}
          {t.temEntradas && (
            <Kpi rotulo="A receber" valor={fmtValor(t.aReceber)} cor={COR.caixa}>
              {t.jaRecebido > 0 && <span className="campo-ajuda">já recebeu {fmtValor(t.jaRecebido)}</span>}
            </Kpi>
          )}
        </div>
      )}

      {!contas.length && (
        <Cartao titulo="Comece pelas contas que se repetem todo mês">
          <div className="opcoes grade">
            {EXEMPLOS.map((e) => (
              <button key={e.nome} type="button" className="opcao" onClick={() => nova(e)}>
                <span className="opcao-icone">{e.icone}</span>
                <span className="opcao-texto"><strong>{e.nome}</strong><small>{e.dica}</small></span>
                <span />
              </button>
            ))}
            <button type="button" className="opcao" onClick={() => nova()}>
              <span className="opcao-icone">➕</span>
              <span className="opcao-texto"><strong>Outra conta</strong><small>do seu jeito</small></span>
              <span />
            </button>
          </div>
        </Cartao>
      )}

      {contas.length > 0 && !sits.length && (
        <Cartao><Vazio>Nenhuma conta fixa vale em {nomeMes} de {c.ano}. Confira abaixo o mês em que cada uma começa.</Vazio></Cartao>
      )}

      {grupo('Atrasadas', g.atrasadas, 'atrasadas')}
      {grupo('Vencem esta semana', g.estaSemana)}
      {grupo('Mais para frente', g.maisAFrente)}
      {grupo('Pagas', g.pagas)}

      {contas.length > 0 && (
        <Cartao titulo="Suas contas fixas">
          <p className="campo-ajuda">Toque numa conta para editar, pausar ou apagar.</p>
          <ul className="conta-gerenciar">
            {contas.map((x) => {
              const cat = c.categorias.find((k) => k.id === x.categoria_id)
              return (
                <li key={x.id} className={x.ativa ? '' : 'pausada'}>
                  <button type="button" onClick={() => setEditando(x)}>
                    <Selo c={cat ?? { icone: x.tipo === 'entrada' ? '💰' : '📅', cor: '#636366' }} />
                    <span className="conta-info">
                      <strong>{x.descricao}{!x.ativa && <span className="conta-etiqueta">pausada</span>}</strong>
                      <small>
                        {x.tipo === 'entrada' ? 'cai' : 'vence'} todo dia {x.dia}
                        {x.fim ? ` · até ${quando(x.fim)}` : ''}
                        {x.inicio > inicioDoMes(c.ano, c.mes) ? ` · começa em ${quando(x.inicio)}` : ''}
                      </small>
                    </span>
                    <span className="conta-valor">{fmtValor(x.valor)}</span>
                    <Icone nome="dir" tamanho={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}

      {editando && (
        <FormConta c={c} conta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />
      )}
      {outroValor && <FormBaixa c={c} s={outroValor} aoFechar={() => setOutroValor(null)} />}
    </div>
  )
}

function ItemConta({ s, c, aoEditar, aoOutroValor }: { s: SituacaoConta; c: Ctx; aoEditar: () => void; aoOutroValor: () => void }) {
  const { conta } = s
  const entrada = conta.tipo === 'entrada'
  const cat = c.categorias.find((k) => k.id === conta.categoria_id)
  return (
    <li className={`conta-item ${s.estado}`}>
      <Selo c={cat ?? { icone: entrada ? '💰' : '📅', cor: '#636366' }} tamanho={40} />
      <button type="button" className="conta-info" onClick={aoEditar}>
        <strong>{conta.descricao}</strong>
        <small>{cat ? `${cat.nome} · ` : ''}dia {s.dia} · <b>{fraseDaSituacao(s)}</b></small>
      </button>
      <span className="conta-valor">{fmtValor(s.valor)}</span>
      <div className="conta-acoes">
        {s.baixa ? (
          <>
            <button className="btn" onClick={() => c.editarLancamento(s.baixa!)}>Editar</button>
            <button className="btn" onClick={() => { if (confirm(`Desfazer? O lançamento de ${fmtValor(s.valor)} será apagado e a conta volta a ficar em aberto.`)) c.desfazerBaixa(s) }}>
              Desfazer
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={aoOutroValor}>Outro valor</button>
            <button className="btn primario conta-paguei" onClick={() => c.pagarConta(s)}>
              <Icone nome="check" tamanho={16} /> {entrada ? 'Recebi' : 'Paguei'}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** "Paguei" com outro valor ou outra data (a conta de luz muda todo mês). */
function FormBaixa({ c, s, aoFechar }: { c: Ctx; s: SituacaoConta; aoFechar: () => void }) {
  const entrada = s.conta.tipo === 'entrada'
  const [valor, setValor] = useState(paraCampo(s.valor))
  const [data, setData] = useState(dataDaBaixa(s.conta, c.ano, c.mes))
  const [erro, setErro] = useState<string | null>(null)
  const mm = String(c.mes).padStart(2, '0')
  const ultimo = new Date(c.ano, c.mes, 0).getDate()

  const salvar = () => {
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro('Informe um valor maior que zero.')
    if (!data || data.slice(0, 7) !== `${c.ano}-${mm}`) return setErro(`Escolha uma data dentro de ${MESES_NOME[c.mes - 1].toLowerCase()}.`)
    c.pagarConta(s, { valor: n, data })
    aoFechar()
  }

  return (
    <Modal titulo={s.conta.descricao} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="valor-grande" style={{ '--c': entrada ? COR.entradas : COR.saidas } as React.CSSProperties}>
          <span>{simbolo()}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(e.target.value); setErro(null) }} aria-label="Valor" />
        </label>
        <label className="campo">
          <span className="campo-rotulo">{entrada ? 'Dia em que recebeu' : 'Dia em que pagou'}</span>
          <input type="date" value={data} min={`${c.ano}-${mm}-01`} max={`${c.ano}-${mm}-${String(ultimo).padStart(2, '0')}`}
            onChange={(e) => setData(e.target.value)} required />
          <span className="campo-ajuda">O valor de costume é {fmtValor(s.conta.valor)}. Aqui você muda só para este mês.</span>
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{entrada ? 'Recebi' : 'Paguei'}</button>
        </div>
      </form>
    </Modal>
  )
}

function FormConta({ c, conta, modelo, aoFechar }: { c: Ctx; conta?: ContaFixa; modelo?: Modelo; aoFechar: () => void }) {
  const hint = (tipo: Tipo, nome: string) => {
    const pelaDica = modelo?.categoria ? c.categorias.find((k) => k.tipo === tipo && mesmoNome(k.nome, modelo.categoria)) : undefined
    return (pelaDica ?? categoriaPelaDescricao(nome, tipo, c.categorias))?.id ?? ''
  }
  const [tipo, setTipo] = useState<Tipo>(conta?.tipo ?? modelo?.tipo ?? 'saida')
  const [nome, setNome] = useState(conta?.descricao ?? modelo?.nome ?? '')
  const [valor, setValor] = useState(conta ? paraCampo(conta.valor) : '')
  const [dia, setDia] = useState(conta ? String(conta.dia) : '')
  const [categoriaId, setCategoriaId] = useState(conta ? conta.categoria_id ?? '' : hint(modelo?.tipo ?? 'saida', modelo?.nome ?? ''))
  const [mexeuCategoria, setMexeuCategoria] = useState(Boolean(conta))
  const [bancoId, setBancoId] = useState(conta?.banco_id ?? '')
  const [inicio, setInicio] = useState(mesDe(conta?.inicio ?? null) || `${c.ano}-${String(c.mes).padStart(2, '0')}`)
  const [fim, setFim] = useState(mesDe(conta?.fim ?? null))
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const entrada = tipo === 'entrada'

  const mudarTipo = (t: Tipo) => {
    setTipo(t)
    if (!c.categorias.some((k) => k.id === categoriaId && k.tipo === t)) {
      setCategoriaId(hint(t, nome))
      setMexeuCategoria(false)
    }
  }
  const aoDigitarNome = (texto: string) => {
    setNome(texto)
    if (mexeuCategoria) return
    const sugerida = categoriaPelaDescricao(texto, tipo, c.categorias)
    if (sugerida) setCategoriaId(sugerida.id)
  }

  const salvar = () => {
    if (!nome.trim()) return setErro('Dê um nome para a conta (ex.: Aluguel).')
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro('Informe o valor, mesmo que aproximado. Você pode mudar na hora de pagar.')
    if (!dia) return setErro(entrada ? 'Escolha o dia em que o dinheiro cai.' : 'Escolha o dia do vencimento.')
    if (!inicio) return setErro('Escolha a partir de qual mês vale.')
    if (fim && fim < inicio) return setErro('O último mês não pode ser antes do primeiro.')
    const dados = {
      tipo, descricao: nome.trim(), valor: n, dia: Number(dia),
      categoria_id: categoriaId || null, banco_id: bancoId || null,
      inicio: `${inicio}-01`, fim: fim ? `${fim}-01` : null, ativa: conta?.ativa ?? true,
    }
    if (conta) void c.contas.updConta(conta.id, dados)
    else void c.contas.addConta(dados)
    aoFechar()
  }

  return (
    <Modal titulo={conta ? 'Editar conta fixa' : 'Nova conta fixa'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <Segmentado rotulo="Tipo" valor={tipo} aoMudar={mudarTipo}
          opcoes={[{ id: 'saida', nome: 'Conta a pagar', cor: COR.saidas }, { id: 'entrada', nome: 'Entrada fixa', cor: COR.entradas }]} />
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus={!modelo && !conta} value={nome} onChange={(e) => aoDigitarNome(e.target.value)} maxLength={40}
            placeholder={entrada ? 'Ex.: Salário, Aluguel recebido…' : 'Ex.: Aluguel, Luz, Internet, Academia…'} />
        </label>
        <div className="form-linha">
          <label className="campo-valor">
            <span className="campo-rotulo">{entrada ? 'Quanto costuma cair' : 'Quanto costuma ser'}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo()}</span>
              <input autoFocus={Boolean(modelo) && !conta} inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(null) }} placeholder="0,00" />
            </span>
          </label>
          <label className="campo">
            <span className="campo-rotulo">{entrada ? 'Cai todo dia' : 'Vence todo dia'}</span>
            <select value={dia} onChange={(e) => { setDia(e.target.value); setErro(null) }}>
              <option value="">Escolha…</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
        {Number(dia) > 28 && <span className="campo-ajuda">Em meses mais curtos, vale o último dia do mês.</span>}
        <EscolhaCategoria
          key={tipo}
          tipo={tipo}
          opcoes={doTipo(c.categorias, tipo)}
          valor={categoriaId}
          aoMudar={(id) => { setCategoriaId(id); setMexeuCategoria(true) }}
          aoCriar={c.d.categoriasAntigas ? undefined : c.d.addCategoria}
        />
        {(c.v.bancos || bancoId) && <EscolhaBanco bancos={c.d.bancos} valor={bancoId} aoMudar={setBancoId} aoNovoBanco={c.d.addBanco} />}
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">A partir de</span>
            <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="campo-rotulo">Até quando? <small>(opcional)</small></span>
            <input type="month" value={fim} onChange={(e) => setFim(e.target.value)} min={inicio} />
          </label>
        </div>
        <span className="campo-ajuda">
          A conta aparece todo mês a partir daí. Se já {entrada ? 'recebeu' : 'pagou'} neste mês, é só tocar em “{entrada ? 'Recebi' : 'Paguei'}” depois.
          Deixe o “até quando” em branco se ela não tem data para acabar.
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {conta && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.contas.delConta(conta.id); aoFechar() }}>Apagar mesmo</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Apagar</button>
          )}
          {conta && (
            <button type="button" className="btn" onClick={() => { void c.contas.updConta(conta.id, { ativa: !conta.ativa }); aoFechar() }}>
              {conta.ativa ? 'Pausar' : 'Reativar'}
            </button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{conta ? 'Salvar' : 'Criar conta'}</button>
        </div>
        {confirmar && <span className="campo-ajuda">Os lançamentos já pagos não somem: só deixam de estar ligados a esta conta.</span>}
        {conta && !confirmar && <span className="campo-ajuda">Pausar esconde a conta dos meses que ainda não foram pagos, sem apagar o histórico.</span>}
      </form>
    </Modal>
  )
}
