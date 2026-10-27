import { useState } from 'react'
import { COR } from '../lib/charts'
import { fmtDataCurta, fmtMoeda, fmtValor, MESES_NOME, parseNumero, paraCampo, simbolo } from '../lib/format'
import { situacaoMeta, MODELOS, type SituacaoMeta } from '../lib/metas'
import { converter, MOEDAS } from '../lib/moedas'
import type { Meta } from '../lib/types'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Modal, Progresso, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

const ICONES_META = ['🎯', '🛟', '✈️', '🚗', '🏠', '🎓', '🌴', '💍', '👶', '💻', '📱', '🎸', '🐶', '🏍️', '🎁', '💵', '🏖️', '⛺', '🏋️', '❤️']
const CORES_META = ['#9d6bff', '#30d158', '#64d2ff', '#0a84ff', '#ff9f0a', '#ffd60a', '#ff375f', '#ff79c6', '#bf5af2', '#63e6e2']
const quando = ([a, m]: [number, number]) => `${MESES_NOME[m - 1].toLowerCase()} de ${a}`
const hoje = () => new Date().toISOString().slice(0, 10)

/** Metas para qualquer objetivo: quanto falta, quanto guardar por mês e quando a pessoa chega lá. */
export function Metas(c: Ctx) {
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [modelo, setModelo] = useState<Partial<Meta> | undefined>()
  const [movendo, setMovendo] = useState<{ meta: Meta; retirar: boolean } | null>(null)
  const sits = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const ativas = sits.filter((s) => !s.batida)
  const batidas = sits.filter((s) => s.batida)
  const naPrincipal = (valor: number, moeda: string) => converter(valor, moeda, c.taxas) ?? 0
  const guardado = sits.reduce((a, s) => a + naPrincipal(s.guardado, s.meta.moeda), 0)
  const falta = ativas.reduce((a, s) => a + naPrincipal(s.falta, s.meta.moeda), 0)
  const porMes = ativas.reduce((a, s) => a + naPrincipal(s.porMesNoPrazo ?? 0, s.meta.moeda), 0)
  // Para a reserva de emergência: média do que saiu nos meses com dados.
  const comDados = c.porMes.filter((r) => r && r.saidas > 0)
  const gastoMedio = comDados.length ? comDados.reduce((a, r) => a + r!.saidas, 0) / comDados.length : 0
  const novaDoModelo = (m: (typeof MODELOS)[number]) => {
    setModelo({ nome: m.nome, icone: m.icone, cor: m.cor, alvo: m.reserva && gastoMedio ? Math.round(gastoMedio * 6) : undefined })
    setEditando('nova')
  }

  if (c.d.metasSemTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>Metas</h1></div></header>
        <Cartao><Vazio>Para usar metas, falta atualizar o banco de dados: rode <code>supabase/migracao-06-metas.sql</code> no SQL Editor do Supabase.</Vazio></Cartao>
      </div>
    )
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Metas</h1>
          <p className="sub">Junte dinheiro para o que importa. Cada meta mostra quanto guardar por mês e quando você chega lá.</p>
        </div>
        {sits.length > 0 && <button className="btn primario" onClick={() => { setModelo(undefined); setEditando('nova') }}><Icone nome="mais" tamanho={16} /> Criar meta</button>}
      </header>

      {sits.length > 0 && (
        <div className="kpis">
          <Kpi rotulo="Guardado nas metas" valor={fmtValor(guardado)} cor={COR.entradas} />
          <Kpi rotulo="Falta juntar" valor={fmtValor(falta)} cor={COR.divida} />
          {porMes > 0 && <Kpi rotulo="Guardar por mês" valor={fmtValor(porMes)} cor={COR.caixa} />}
          <Kpi rotulo="Metas batidas" valor={`${batidas.length} de ${sits.length}`} cor={COR.investimentos} />
        </div>
      )}

      {!sits.length && (
        <Cartao titulo="Comece por um objetivo">
          <div className="opcoes grade">
            {MODELOS.map((m) => (
              <button key={m.nome} type="button" className="opcao" onClick={() => novaDoModelo(m)}>
                <span className="opcao-icone">{m.icone}</span>
                <span className="opcao-texto">
                  <strong>{m.nome}</strong>
                  <small>{m.reserva && gastoMedio ? `Sugestão: ${fmtValor(Math.round(gastoMedio * 6))} (6 meses de gastos)` : m.dica}</small>
                </span>
                <span />
              </button>
            ))}
            <button type="button" className="opcao" onClick={() => { setModelo(undefined); setEditando('nova') }}>
              <span className="opcao-icone">🎯</span>
              <span className="opcao-texto"><strong>Outro objetivo</strong><small>do seu jeito</small></span>
              <span />
            </button>
          </div>
        </Cartao>
      )}

      {ativas.length > 0 && (
        <div className="grade-cartoes">
          {ativas.map((s) => (
            <CartaoMeta key={s.meta.id} s={s} c={c} aoEditar={() => setEditando(s.meta)}
              aoGuardar={() => setMovendo({ meta: s.meta, retirar: false })} aoRetirar={() => setMovendo({ meta: s.meta, retirar: true })} />
          ))}
        </div>
      )}

      {batidas.length > 0 && (
        <>
          <h2 className="secao-titulo">Metas batidas 🎉</h2>
          <div className="grade-cartoes">
            {batidas.map((s) => (
              <CartaoMeta key={s.meta.id} s={s} c={c} aoEditar={() => setEditando(s.meta)}
                aoGuardar={() => setMovendo({ meta: s.meta, retirar: false })} aoRetirar={() => setMovendo({ meta: s.meta, retirar: true })} />
            ))}
          </div>
        </>
      )}

      {editando && (
        <FormMeta c={c} meta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />
      )}
      {movendo && <FormMovimento c={c} meta={movendo.meta} retirar={movendo.retirar} aoFechar={() => setMovendo(null)} />}
    </div>
  )
}

function CartaoMeta({ s, c, aoEditar, aoGuardar, aoRetirar }: {
  s: SituacaoMeta; c: Ctx; aoEditar: () => void; aoGuardar: () => void; aoRetirar: () => void
}) {
  const { meta } = s
  const moeda = meta.moeda
  const estrangeira = moeda !== c.perfil.moeda
  const conv = estrangeira ? converter(s.guardado, moeda, c.taxas) : null
  return (
    <Cartao className={`meta-cartao ${s.batida ? 'batida' : ''}`}>
      <div className="divida" style={{ '--c': meta.cor } as React.CSSProperties}>
        <div className="divida-topo">
          <h3><span className="meta-icone">{meta.icone}</span>{meta.nome}</h3>
          <button className="link" onClick={aoEditar}>Editar</button>
        </div>
        <div>
          <strong className="divida-total">{fmtMoeda(s.guardado, moeda)}</strong>
          <span className="meta-de"> de {fmtMoeda(meta.alvo, moeda)}</span>
          {conv !== null && <span className="meta-de"> · ≈ {fmtValor(conv)}</span>}
        </div>
        <Progresso valor={s.guardado} total={meta.alvo} cor={meta.cor} />
        <div className="divida-info">
          <span>{Math.round(s.progresso * 100)}%</span>
          <span>{s.batida ? 'Meta batida! 🎉' : `Faltam ${fmtMoeda(s.falta, moeda)}`}</span>
        </div>
        {!s.batida && (
          <ul className="meta-dicas">
            {s.porMesNoPrazo !== null && meta.prazo && (
              s.atrasada
                ? <li className="atrasada">O prazo ({quando([Number(meta.prazo.slice(0, 4)), Number(meta.prazo.slice(5, 7))])}) passou. Que tal um prazo novo?</li>
                : <li>Para chegar em <b>{quando([Number(meta.prazo.slice(0, 4)), Number(meta.prazo.slice(5, 7))])}</b>, guarde <b>{fmtMoeda(s.porMesNoPrazo, moeda)}</b> por mês.</li>
            )}
            {s.previsao
              ? <li>No seu ritmo ({fmtMoeda(s.ritmo!, moeda)}/mês), você chega em <b>{quando(s.previsao)}</b>.</li>
              : <li>Guarde a primeira parte para o app prever quando você chega lá.</li>}
          </ul>
        )}
        {s.movimentos.length > 0 && (
          <ul className="divida-pagamentos meta-movimentos">
            {s.movimentos.slice(0, 4).map((m) => (
              <li key={m.id}>
                <span>{fmtDataCurta(m.data)}{m.descricao && ` · ${m.descricao}`}</span>
                <span className={m.valor < 0 ? 'negativo' : ''}>
                  {m.valor < 0 ? '−' : '+'} {fmtMoeda(Math.abs(m.valor), moeda)}
                  <button className="desfazer" aria-label="Excluir este registro" title="Excluir este registro"
                    onClick={() => { if (confirm('Excluir este registro da meta?')) void c.d.delMovimentoMeta(m.id) }}>×</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="meta-acoes">
          <button className="btn primario" onClick={aoGuardar}><Icone nome="mais" tamanho={16} /> Guardar</button>
          {s.guardado > 0 && <button className="btn" onClick={aoRetirar}>Retirar</button>}
        </div>
      </div>
    </Cartao>
  )
}

function FormMeta({ c, meta, modelo, aoFechar }: { c: Ctx; meta?: Meta; modelo?: Partial<Meta>; aoFechar: () => void }) {
  const ini = meta ?? modelo
  const [nome, setNome] = useState(ini?.nome ?? '')
  const [icone, setIcone] = useState(ini?.icone ?? '🎯')
  const [cor, setCor] = useState(ini?.cor ?? CORES_META[0])
  const [moeda, setMoeda] = useState(meta?.moeda ?? c.perfil.moeda)
  const [alvo, setAlvo] = useState(ini?.alvo ? paraCampo(ini.alvo) : '')
  const [prazo, setPrazo] = useState(meta?.prazo?.slice(0, 7) ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  // As moedas da pessoa primeiro; as outras continuam disponíveis.
  const minhas = [c.perfil.moeda, ...c.perfil.moedas]
  const opcoesMoeda = [...MOEDAS.filter((m) => minhas.includes(m.codigo)), ...MOEDAS.filter((m) => !minhas.includes(m.codigo))]

  const salvar = () => {
    if (!nome.trim()) return setErro('Dê um nome para a meta.')
    const n = parseNumero(alvo)
    if (!n || n <= 0) return setErro('Digite quanto você quer juntar.')
    const dados = { nome: nome.trim(), icone, cor, moeda, alvo: n, prazo: prazo ? `${prazo}-01` : null }
    if (meta) void c.d.updMeta(meta.id, dados)
    else void c.d.addMeta(dados)
    aoFechar()
  }

  return (
    <Modal titulo={meta ? 'Editar meta' : 'Nova meta'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <div className="editor-categoria-nome">
          <span className="selo" style={{ '--c': cor, width: 44, height: 44, fontSize: 23 } as React.CSSProperties}>{icone}</span>
          <input autoFocus={!meta} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40}
            placeholder="Ex.: Viagem pra praia, Notebook novo…" aria-label="Nome da meta" />
        </div>
        <div className="grade-icones" role="radiogroup" aria-label="Ícone">
          {ICONES_META.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icone === i} className={icone === i ? 'ativo' : ''} onClick={() => setIcone(i)}>{i}</button>
          ))}
        </div>
        <div className="chips" role="radiogroup" aria-label="Cor">
          {CORES_META.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
              style={{ background: k }} onClick={() => setCor(k)} />
          ))}
        </div>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">Quanto quer juntar</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo(moeda)}</span>
              <input inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="0,00" />
            </span>
          </label>
          <label className="campo">
            <span className="campo-rotulo">Moeda</span>
            <select value={moeda} onChange={(e) => setMoeda(e.target.value)} disabled={Boolean(meta && c.d.movimentosMeta.some((m) => m.meta_id === meta.id))}>
              {opcoesMoeda.map((m) => <option key={m.codigo} value={m.codigo}>{m.bandeira} {m.codigo}</option>)}
            </select>
          </label>
        </div>
        <label className="campo">
          <span className="campo-rotulo">Até quando? <small>(opcional)</small></span>
          <input type="month" value={prazo} onChange={(e) => setPrazo(e.target.value)} min={hoje().slice(0, 7)} />
          <span className="campo-ajuda">Com um prazo, o app calcula quanto guardar por mês.</span>
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {meta && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.d.delMeta(meta.id); aoFechar() }}>Sim, excluir</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{meta ? 'Salvar' : 'Criar meta'}</button>
        </div>
        {confirmar && <span className="campo-ajuda">A meta e todo o histórico dela serão excluídos.</span>}
      </form>
    </Modal>
  )
}

function FormMovimento({ c, meta, retirar: inicial, aoFechar }: { c: Ctx; meta: Meta; retirar: boolean; aoFechar: () => void }) {
  const [retirar, setRetirar] = useState(inicial)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const guardado = c.d.movimentosMeta.filter((m) => m.meta_id === meta.id).reduce((a, m) => a + m.valor, 0)

  const salvar = () => {
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro('Digite um valor maior que zero.')
    if (retirar && n > guardado + 0.001) return setErro(`Na meta só tem ${fmtMoeda(guardado, meta.moeda)}.`)
    void c.d.addMovimentoMeta({ meta_id: meta.id, data, valor: retirar ? -n : n, descricao: descricao.trim() })
    aoFechar()
  }

  return (
    <Modal titulo={`${meta.icone} ${meta.nome}`} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <Segmentado rotulo="Movimento" valor={retirar ? 'retirar' : 'guardar'} aoMudar={(v) => setRetirar(v === 'retirar')}
          opcoes={[{ id: 'guardar', nome: 'Guardar', cor: COR.entradas }, { id: 'retirar', nome: 'Retirar', cor: COR.saidas }]} />
        <label className="valor-grande" style={{ '--c': retirar ? COR.saidas : COR.entradas } as React.CSSProperties}>
          <span>{simbolo(meta.moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(e.target.value); setErro(null) }} aria-label="Valor" />
        </label>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="campo-rotulo">Observação <small>(opcional)</small></span>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={retirar ? 'Ex.: paguei a passagem' : 'Ex.: sobra do mês'} maxLength={60} />
          </label>
        </div>
        <span className="campo-ajuda">
          {retirar ? 'Retirar diminui o guardado na meta.' : 'Registre quando separar dinheiro para esta meta (numa caixinha, poupança, conta…).'}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{retirar ? 'Retirar' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
