import { useState } from 'react'
import { COR } from '../lib/charts'
import { casasDaMoeda, dataPlausivel, erroDataFora, erroValorGrande, mascarar, paraCampoMoeda, valorGrandeDemais } from '../lib/dinheiro'
import { fmtDataLonga, fmtMoeda, fmtValor, MESES_NOME, parseNumero, paraCampo, simbolo, noMeioDaFrase, mesEAno } from '../lib/format'
import { situacaoMeta, MODELOS, type SituacaoMeta } from '../lib/metas'
import { hojeLocal } from '../lib/cartoes'
import { converter, MOEDAS } from '../lib/moedas'
import type { Meta } from '../lib/types'
import { EscolhaMoeda } from '../components/EscolhaMoeda'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { PoteMeta } from '../components/PoteMeta'
import { CartaoModelo } from '../components/CenaMeta'
import { Anel, Cartao, Modal, Segmentado, Vazio } from '../components/ui'
import { confirmar } from '../components/Avisos'
import { CampoData, CampoMes } from '../components/Escolhas'
import type { Ctx } from './contexto'
import { IconeCategoria } from '../components/IconeCategoria'
import { tx } from '../lib/textos'

const ICONES_META = ['🎯', '🛟', '✈️', '🚗', '🏠', '🎓', '🌴', '💍', '👶', '💻', '📱', '🎸', '🐶', '🏍️', '🎁', '💵', '🏖️', '⛺', '🏋️', '❤️']
const CORES_META = ['#9d6bff', '#30d158', '#64d2ff', '#0a84ff', '#ff9f0a', '#ffd60a', '#ff375f', '#ff79c6', '#bf5af2', '#63e6e2']
const quando = ([a, m]: [number, number]) => mesEAno(a, m)
const hoje = () => hojeLocal()

const mesAno = (iso: string) => quando([Number(iso.slice(0, 4)), Number(iso.slice(5, 7))])

/** Situação da meta em uma palavra, para o selo do cartão. */
function estadoMeta(s: SituacaoMeta) {
  if (s.batida) return { id: 'batida', texto: tx('Batida 🎉') }
  if (s.atrasada) return { id: 'atrasada', texto: tx('Prazo passou') }
  if (s.porMesNoPrazo !== null && s.ritmo !== null) return s.ritmo >= s.porMesNoPrazo - 0.01 ? { id: 'em_dia', texto: tx('No ritmo') } : { id: 'devagar', texto: tx('Abaixo do ritmo') }
  if (!s.guardado) return { id: 'nova', texto: tx('Começando') }
  return { id: 'livre', texto: tx('Sem prazo') }
}

/**
 * Metas para qualquer objetivo: cada uma é um pote que enche conforme você guarda, com quanto guardar por mês para
 * chegar no prazo e quando chega no ritmo atual. A sobra do mês aberto vira um atalho para guardar numa meta.
 */
export function Metas(c: Ctx) {
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [modelo, setModelo] = useState<Partial<Meta> | undefined>()
  const [movendo, setMovendo] = useState<{ meta: Meta; retirar: boolean; valor?: number } | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const sits = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const ativas = sits.filter((s) => !s.batida)
  const batidas = sits.filter((s) => s.batida)
  const naPrincipal = (valor: number, moeda: string) => converter(valor, moeda, c.taxas) ?? 0
  const guardado = sits.reduce((a, s) => a + naPrincipal(s.guardado, s.meta.moeda), 0)
  const alvoTotal = sits.reduce((a, s) => a + naPrincipal(s.meta.alvo, s.meta.moeda), 0)
  const falta = ativas.reduce((a, s) => a + naPrincipal(s.falta, s.meta.moeda), 0)
  const porMes = ativas.reduce((a, s) => a + naPrincipal(s.porMesNoPrazo ?? 0, s.meta.moeda), 0)
  // Para a reserva de emergência: média do que saiu nos meses com dados.
  // Só meses que já fecharam: o que ainda está correndo e os futuros (com contas fixas já lançadas) puxariam a média
  // para baixo. Sem nenhum mês fechado, vale o que houver.
  const [anoHoje, mesHoje] = hoje().split('-').map(Number)
  const meses = c.porMes.map((r, i) => (r && r.saidas > 0 ? { r, i } : null)).filter((x) => x !== null)
  const fechados = meses.filter((x) => c.ano < anoHoje || (c.ano === anoHoje && x.i < mesHoje - 1))
  const comDados = (fechados.length ? fechados : meses).map((x) => x.r)
  const gastoMedio = comDados.length ? comDados.reduce((a, r) => a + r.saidas, 0) / comDados.length : 0
  const sobra = Math.max(0, c.r.fluxo)
  const aberto = sits.find((s) => s.meta.id === aberta)
  const novaDoModelo = (m: (typeof MODELOS)[number]) => {
    setModelo({ nome: m.nome, icone: m.icone, cor: m.cor, alvo: m.reserva && gastoMedio ? Math.round(gastoMedio * 6) : undefined })
    setEditando('nova')
  }
  const guardar = (meta: Meta, valor?: number) => setMovendo({ meta, retirar: false, valor })

  if (c.d.metasSemTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>{tx('Metas')}</h1></div></header>
        <Cartao><Vazio>{tx('Para usar metas, falta atualizar o banco de dados: rode')} <code>supabase/migracao-06-metas.sql</code> {tx('no SQL Editor do Supabase.')}</Vazio></Cartao>
      </div>
    )
  }

  const modelos = (
    <div className="mt-modelos">
      {MODELOS.map((m, i) => (
        <CartaoModelo key={m.nome} cor={m.cor} icone={m.icone} nome={m.nome} indice={i} aoEscolher={() => novaDoModelo(m)}
          dica={m.reserva && gastoMedio ? tx('{0} = 6 meses de gastos', fmtValor(Math.round(gastoMedio * 6))) : m.dica}
          selo={m.reserva && gastoMedio ? <><small>{tx('6 meses')}</small>{fmtValor(Math.round(gastoMedio * 6))}</> : undefined} />
      ))}
      <CartaoModelo cor="#9d6bff" icone="🎯" nome={tx('Outro objetivo')} dica={tx('do seu jeito')} indice={MODELOS.length} largo
        aoEscolher={() => { setModelo(undefined); setEditando('nova') }} />
    </div>
  )

  return (
    <div className="pagina pg-metas">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Metas')}</h1>
          <p className="sub">{tx('Junte dinheiro para o que importa: cada pote enche conforme você guarda.')}</p>
        </div>
        {sits.length > 0 && <button className="btn primario" onClick={() => { setModelo(undefined); setEditando('nova') }}><Icone nome="mais" tamanho={16} /> {tx('Criar meta')}</button>}
      </header>

      {sits.length > 0 && (
        <section className="mt-topo">
          <div className="cartao mt-resumo">
            <Anel valor={alvoTotal ? guardado / alvoTotal : 0} cor={COR.entradas} tamanho={108}>
              <span className="mt-resumo-pct">{alvoTotal ? Math.round((guardado / alvoTotal) * 100) : 0}%</span>
            </Anel>
            <span className="mt-resumo-texto">
              <small>{tx('guardado nas metas')}</small>
              <strong><Numero valor={guardado} formato={fmtValor} /></strong>
              <small>{tx('de {0}', fmtValor(alvoTotal))}</small>
              <span className="chips-info">
                {falta > 0 && <span className="chip-info">{tx('faltam {0}', fmtValor(falta))}</span>}
                {porMes > 0 && <span className="chip-info"><Icone nome="calendario" tamanho={12} /> {tx('{0}/mês', fmtValor(porMes))}</span>}
                <span className="chip-info bom">{tx('{0} de {1} batidas', batidas.length, sits.length)}</span>
              </span>
            </span>
          </div>
          {sobra > 0 && ativas.length > 0 ? (
            <div className="cartao mt-sobra">
              <span className="mt-sobra-icone"><Icone nome="cofre" tamanho={26} /></span>
              <span className="mt-sobra-texto">
                <small>{tx('sobrou em {0}', noMeioDaFrase(MESES_NOME[c.mes - 1]))}</small>
                <strong>{fmtValor(sobra)}</strong>
                <span>{tx('Guardar numa meta?')}</span>
              </span>
              <span className="mt-sobra-metas">
                {ativas.slice(0, 4).map((s) => (
                  <button key={s.meta.id} className="mt-sobra-meta" style={{ '--c': s.meta.cor } as React.CSSProperties}
                    onClick={() => guardar(s.meta, Math.min(sobra, naPrincipal(s.falta, s.meta.moeda)))} disabled={s.meta.moeda !== c.perfil.moeda} title={s.meta.nome}>
                    <IconeCategoria emoji={s.meta.icone} tamanho={16} /><span>{s.meta.nome}</span>
                  </button>
                ))}
              </span>
            </div>
          ) : (
            <div className="cartao mt-sobra calma">
              <span className="mt-sobra-icone"><Icone nome="ideia" tamanho={24} /></span>
              <span className="mt-sobra-texto">
                <small>{tx('dica')}</small>
                <strong>{porMes > 0 ? tx('Guarde {0} por mês', fmtValor(porMes)) : tx('Guarde um pouco todo mês')}</strong>
                <span>{porMes > 0 ? tx('É o que falta, por mês, para bater todas as metas no prazo.') : tx('Pôr um prazo na meta mostra quanto guardar por mês.')}</span>
              </span>
            </div>
          )}
        </section>
      )}

      {!sits.length && (
        <section className="cartao mt-vazio">
          <div className="mt-vazio-potes" aria-hidden="true">
            <PoteMeta progresso={0.35} cor="#64d2ff" icone="✈️" tamanho={92} />
            <PoteMeta progresso={0.7} cor="#30d158" icone="🛟" tamanho={110} />
            <PoteMeta progresso={0.2} cor="#ff9f0a" icone="🏠" tamanho={92} />
          </div>
          <h2>{tx('Comece por um objetivo')}</h2>
          <p>{tx('Escolha um ponto de partida ou crie do seu jeito. O app mostra quanto guardar por mês e quando você chega lá.')}</p>
          {modelos}
        </section>
      )}

      {ativas.length > 0 && (
        <div className="mt-grade">
          {ativas.map((s, i) => (
            <CartaoMeta key={s.meta.id} s={s} c={c} indice={i} aoAbrir={() => setAberta(s.meta.id)}
              aoGuardar={() => guardar(s.meta)} aoRetirar={() => setMovendo({ meta: s.meta, retirar: true })} />
          ))}
        </div>
      )}

      {batidas.length > 0 && (
        <>
          <h2 className="secao-titulo">{tx('Metas batidas 🎉')}</h2>
          <div className="mt-grade">
            {batidas.map((s, i) => (
              <CartaoMeta key={s.meta.id} s={s} c={c} indice={i} aoAbrir={() => setAberta(s.meta.id)}
                aoGuardar={() => guardar(s.meta)} aoRetirar={() => setMovendo({ meta: s.meta, retirar: true })} />
            ))}
          </div>
        </>
      )}

      {aberto && (
        <FichaMeta s={aberto} c={c} aoFechar={() => setAberta(null)}
          aoEditar={() => { setAberta(null); setEditando(aberto.meta) }}
          aoGuardar={() => { setAberta(null); guardar(aberto.meta) }}
          aoRetirar={() => { setAberta(null); setMovendo({ meta: aberto.meta, retirar: true }) }} />
      )}
      {editando && (
        <FormMeta c={c} meta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />
      )}
      {movendo && <FormMovimento c={c} meta={movendo.meta} retirar={movendo.retirar} valorInicial={movendo.valor} aoFechar={() => setMovendo(null)} />}
    </div>
  )
}

function CartaoMeta({ s, c, indice, aoAbrir, aoGuardar, aoRetirar }: {
  s: SituacaoMeta; c: Ctx; indice: number; aoAbrir: () => void; aoGuardar: () => void; aoRetirar: () => void
}) {
  const { meta } = s
  const moeda = meta.moeda
  const conv = moeda !== c.perfil.moeda ? converter(s.guardado, moeda, c.taxas) : null
  const estado = estadoMeta(s)
  return (
    <article className={`cartao mt-cartao ${estado.id}`} style={{ '--c': meta.cor, animationDelay: `${Math.min(indice, 8) * 70}ms` } as React.CSSProperties}>
      <button className="mt-cartao-corpo" onClick={aoAbrir} aria-label={tx('Ver {0}', meta.nome)}>
        <PoteMeta progresso={s.progresso} cor={meta.cor} icone={meta.icone} tamanho={104} />
        <span className="mt-info">
          <span className="mt-info-topo">
            <strong className="mt-nome">{meta.nome}</strong>
            <span className={`chip-estado mt ${estado.id}`}>{estado.texto}</span>
          </span>
          <span className="mt-valor">
            <b><Numero valor={s.guardado} formato={(n) => fmtMoeda(n, moeda)} /></b>
            <small>{tx('de {0}', fmtMoeda(meta.alvo, moeda))}{conv !== null && ` · ≈ ${fmtValor(conv)}`}</small>
          </span>
          <span className="mt-trilho" aria-hidden="true">
            <i style={{ width: `${s.progresso * 100}%` }} />
            {[25, 50, 75].map((m) => <em key={m} style={{ left: `${m}%` }} className={s.progresso * 100 >= m ? 'passou' : ''} />)}
          </span>
          <span className="mt-linha">
            {s.batida ? <>{tx('Você juntou tudo. 🎉')}</>
              : s.atrasada && meta.prazo ? <>{tx('O prazo ({0}) passou. Que tal um novo?', mesAno(meta.prazo))}</>
                : s.porMesNoPrazo !== null && meta.prazo ? <>{tx('Guarde')} <b>{tx('{0}/mês', fmtMoeda(s.porMesNoPrazo, moeda))}</b> {tx('até {0}', mesAno(meta.prazo))}</>
                  : s.previsao ? <>{tx('No seu ritmo, chega em')} <b>{quando(s.previsao)}</b></>
                    : <>{tx('Faltam')} <b>{fmtMoeda(s.falta, moeda)}</b></>}
          </span>
        </span>
      </button>
      <div className="mt-acoes">
        <button className="btn primario" onClick={aoGuardar}><Icone nome="mais" tamanho={16} /> {tx('Guardar')}</button>
        {s.guardado > 0 && <button className="btn" onClick={aoRetirar}>{tx('Retirar')}</button>}
      </div>
    </article>
  )
}

/** Linha do quanto foi guardado ao longo do tempo (soma dos movimentos, mês a mês). */
function Evolucao({ s }: { s: SituacaoMeta }) {
  const porMes = new Map<string, number>()
  for (const m of [...s.movimentos].reverse()) porMes.set(m.data.slice(0, 7), (porMes.get(m.data.slice(0, 7)) ?? 0) + m.valor)
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b))
  const pontos = meses.map(([mes], i) => ({ mes, total: meses.slice(0, i + 1).reduce((t, [, v]) => t + v, 0) }))
  if (pontos.length < 2) return null
  const maior = Math.max(s.meta.alvo, ...pontos.map((p) => p.total))
  const L = 300
  const A = 110
  const xy = pontos.map((p, i) => [(i / (pontos.length - 1)) * L, A - (p.total / maior) * (A - 10)] as const)
  const linha = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const alvoY = A - (s.meta.alvo / maior) * (A - 10)
  return (
    <figure className="mt-evolucao" style={{ '--c': s.meta.cor } as React.CSSProperties}>
      <svg viewBox={`0 0 ${L} ${A + 4}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`ev-${s.meta.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.meta.cor} stopOpacity=".35" />
            <stop offset="1" stopColor={s.meta.cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0 ${alvoY}H${L}`} className="mt-evolucao-alvo" />
        <path d={`${linha} L${L} ${A} L0 ${A}Z`} fill={`url(#ev-${s.meta.id})`} className="mt-evolucao-area" />
        <path d={linha} className="mt-evolucao-linha" pathLength={1} />
      </svg>
      <figcaption>
        <span>{mesAno(`${pontos[0].mes}-01`)}</span>
        <span>{tx('alvo {0}', fmtMoeda(s.meta.alvo, s.meta.moeda))}</span>
        <span>{mesAno(`${pontos.at(-1)!.mes}-01`)}</span>
      </figcaption>
    </figure>
  )
}

function FichaMeta({ s, c, aoFechar, aoEditar, aoGuardar, aoRetirar }: {
  s: SituacaoMeta; c: Ctx; aoFechar: () => void; aoEditar: () => void; aoGuardar: () => void; aoRetirar: () => void
}) {
  const { meta } = s
  const moeda = meta.moeda
  return (
    <Modal titulo={meta.nome} aoFechar={aoFechar}>
      <div className="mt-ficha" style={{ '--c': meta.cor } as React.CSSProperties}>
        <div className="mt-ficha-topo">
          <PoteMeta progresso={s.progresso} cor={meta.cor} icone={meta.icone} tamanho={124} />
          <span className="mt-ficha-numeros">
            <span><small>{tx('guardado')}</small><strong>{fmtMoeda(s.guardado, moeda)}</strong></span>
            <span><small>{s.batida ? tx('alvo') : tx('falta')}</small><strong>{fmtMoeda(s.batida ? meta.alvo : s.falta, moeda)}</strong></span>
            <span><small>{tx('{0}% do caminho', Math.round(s.progresso * 100))}</small>
              <strong>{meta.prazo ? tx('até {0}', mesAno(meta.prazo)) : tx('sem prazo')}</strong></span>
            {s.ritmo !== null && <span><small>{tx('seu ritmo')}</small><strong>{tx('{0}/mês', fmtMoeda(s.ritmo, moeda))}</strong></span>}
          </span>
        </div>
        {!s.batida && (
          <ul className="meta-dicas">
            {s.porMesNoPrazo !== null && meta.prazo && !s.atrasada && <li>{tx('Para chegar em')} <b>{mesAno(meta.prazo)}</b>{tx(', guarde')} <b>{fmtMoeda(s.porMesNoPrazo, moeda)}</b> {tx('por mês.')}</li>}
            {s.atrasada && meta.prazo && <li className="atrasada">{tx('O prazo ({0}) passou. Edite a meta para pôr um novo.', mesAno(meta.prazo))}</li>}
            {s.previsao ? <li>{tx('No seu ritmo, você chega em')} <b>{quando(s.previsao)}</b>.</li> : <li>{tx('Guarde a primeira parte para o app prever quando você chega lá.')}</li>}
          </ul>
        )}
        <Evolucao s={s} />
        <section>
          <h4 className="dv-ficha-titulo">{tx('Histórico')} <small>{s.movimentos.length || ''}</small></h4>
          {s.movimentos.length ? (
            <ul className="dv-movimentos">
              {s.movimentos.slice(0, 15).map((m) => (
                <li key={m.id}>
                  <div className="mt-mov">
                    <span className={`ccd-hist-icone ${m.valor < 0 ? 'reneg' : 'ok'}`}><Icone nome={m.valor < 0 ? 'enviar' : 'receber'} tamanho={15} /></span>
                    <span className="ccd-hist-texto"><strong>{fmtDataLonga(m.data)}</strong><small>{m.descricao || (m.valor < 0 ? tx('retirado') : tx('guardado'))}</small></span>
                    <span className={`ccd-hist-valor ${m.valor < 0 ? 'negativo' : ''}`}>{m.valor < 0 ? '−' : '+'} {fmtMoeda(Math.abs(m.valor), moeda)}</span>
                    <button className="icone-btn pequeno" aria-label={tx('Excluir este registro')} title={tx('Excluir este registro')}
                      onClick={async () => { if (await confirmar(tx('Excluir este registro da meta?'), { botao: tx('Excluir'), perigo: true })) void c.d.delMovimentoMeta(m.id) }}><Icone nome="lixeira" tamanho={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="quadro-vazio">{tx('Nada guardado ainda.')}</p>}
        </section>
        <div className="form-acoes">
          <button className="btn" onClick={aoEditar}><Icone nome="lapis" tamanho={15} /> {tx('Editar')}</button>
          <span className="espaco" />
          {s.guardado > 0 && <button className="btn" onClick={aoRetirar}>{tx('Retirar')}</button>}
          <button className="btn primario" onClick={aoGuardar}><Icone nome="mais" tamanho={16} /> {tx('Guardar')}</button>
        </div>
      </div>
    </Modal>
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
  // Meta com prazo que já passou: o campo não pode exigir um mês futuro, senão o navegador trava até um simples renomear.
  const prazoJaPassou = Boolean(meta?.prazo && meta.prazo.slice(0, 7) < hoje().slice(0, 7))
  // As moedas da pessoa primeiro; as outras continuam disponíveis.
  const minhas = [c.perfil.moeda, ...c.perfil.moedas]
  const opcoesMoeda = [...MOEDAS.filter((m) => minhas.includes(m.codigo)), ...MOEDAS.filter((m) => !minhas.includes(m.codigo))]

  const salvar = () => {
    if (!nome.trim()) return setErro(tx('Dê um nome para a meta.'))
    const n = parseNumero(alvo)
    if (!n || n <= 0) return setErro(tx('Digite quanto você quer juntar.'))
    if (valorGrandeDemais(n)) return setErro(erroValorGrande())
    if (prazo && !dataPlausivel(`${prazo}-01`)) return setErro(erroDataFora())
    const dados = { nome: nome.trim(), icone, cor, moeda, alvo: n, prazo: prazo ? `${prazo}-01` : null }
    if (meta) void c.d.updMeta(meta.id, dados)
    else void c.d.addMeta(dados)
    aoFechar()
  }

  return (
    <Modal titulo={meta ? tx('Editar meta') : tx('Nova meta')} aoFechar={aoFechar} tamanho="tela" cor={cor} palco={
      <div className="palco" style={{ '--c': cor } as React.CSSProperties}>
        <span className="palco-pote"><PoteMeta key={icone + cor} progresso={0.55} cor={cor} icone={icone} tamanho={150} /></span>
        {nome.trim() && <span className="palco-legenda">{nome.trim()}</span>}
        {parseNumero(alvo) ? <span className="palco-valor"><small>{tx('Quanto quer juntar')}</small><strong>{fmtMoeda(parseNumero(alvo)!, moeda)}</strong></span> : null}
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <div className="editor-categoria-nome">
          <input autoFocus={!meta} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40}
            placeholder={tx('Ex.: Viagem pra praia, Notebook novo…')} aria-label={tx('Nome da meta')} />
        </div>
        <div className="grade-icones" role="radiogroup" aria-label={tx('Ícone')}>
          {ICONES_META.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icone === i} aria-label={i} className={icone === i ? 'ativo' : ''} onClick={() => setIcone(i)}
              style={{ '--c': cor } as React.CSSProperties}><IconeCategoria emoji={i} tamanho={20} /></button>
          ))}
        </div>
        <div className="chips" role="radiogroup" aria-label={tx('Cor')}>
          {CORES_META.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
              style={{ background: k }} onClick={() => setCor(k)} />
          ))}
        </div>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Quanto quer juntar')}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo(moeda)}</span>
              <input inputMode="decimal" value={alvo} onChange={(e) => setAlvo(mascarar(e.target.value, casasDaMoeda(moeda)))} placeholder="0,00" />
            </span>
          </label>
        </div>
        <div className="campo">
          <span className="campo-rotulo">{tx('Moeda')}</span>
          <EscolhaMoeda moedas={opcoesMoeda.map((m) => m.codigo)} valor={moeda} travada={Boolean(meta && c.d.movimentosMeta.some((m) => m.meta_id === meta.id))}
            aoMudar={(m) => { setMoeda(m); setAlvo((t) => { const x = parseNumero(t); return x ? paraCampoMoeda(x, m) : t }) }} />
        </div>
        <label className="campo">
          <span className="campo-rotulo">{tx('Até quando?')} <small>(opcional)</small></span>
          <CampoMes valor={prazo} aoMudar={setPrazo} rotulo={tx('Até quando?')} min={prazoJaPassou ? undefined : hoje().slice(0, 7)} />
          <span className="campo-ajuda">{tx('Com um prazo, o app calcula quanto guardar por mês.')}</span>
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {meta && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.d.delMeta(meta.id); aoFechar() }}>{tx('Sim, excluir')}</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>{tx('Excluir')}</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{meta ? tx('Salvar') : tx('Criar meta')}</button>
        </div>
        {confirmar && <span className="campo-ajuda">{tx('A meta e todo o histórico dela serão excluídos.')}</span>}
      </form>
    </Modal>
  )
}

function FormMovimento({ c, meta, retirar: inicial, valorInicial, aoFechar }: { c: Ctx; meta: Meta; retirar: boolean; valorInicial?: number; aoFechar: () => void }) {
  const [retirar, setRetirar] = useState(inicial)
  const [valor, setValor] = useState(valorInicial ? paraCampo(valorInicial) : '')
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const guardado = c.d.movimentosMeta.filter((m) => m.meta_id === meta.id).reduce((a, m) => a + m.valor, 0)
  const s = situacaoMeta(meta, c.d.movimentosMeta)
  const sobra = meta.moeda === c.perfil.moeda ? Math.max(0, c.r.fluxo) : 0
  // atalhos: valores redondos, o que falta por mês para o prazo e a sobra do mês
  const atalhos = retirar
    ? [{ rotulo: tx('Tudo'), valor: guardado }]
    : [
        ...[50, 100, 200].map((v) => ({ rotulo: `+${fmtMoeda(v, meta.moeda).replace(/,00$/, '')}`, valor: v })),
        ...(s.porMesNoPrazo ? [{ rotulo: tx('Do mês'), valor: Math.round(s.porMesNoPrazo * 100) / 100 }] : []),
        ...(sobra > 0 ? [{ rotulo: tx('A sobra'), valor: Math.min(sobra, s.falta || sobra) }] : []),
        ...(s.falta > 0 ? [{ rotulo: tx('O que falta'), valor: s.falta }] : []),
      ]

  // o pote do palco já mostra como fica depois deste movimento
  const depois = Math.max(0, guardado + (retirar ? -1 : 1) * (parseNumero(valor) ?? 0))

  const salvar = () => {
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro(tx('Digite um valor maior que zero.'))
    if (valorGrandeDemais(n)) return setErro(erroValorGrande())
    if (!dataPlausivel(data)) return setErro(erroDataFora())
    if (retirar && n > guardado + 0.001) return setErro(tx('Na meta só tem {0}.', fmtMoeda(guardado, meta.moeda)))
    void c.d.addMovimentoMeta({ meta_id: meta.id, data, valor: retirar ? -n : n, descricao: descricao.trim() })
    aoFechar()
  }

  return (
    <Modal titulo={meta.nome} aoFechar={aoFechar} tamanho="tela" cor={meta.cor} palco={
      <div className="palco" style={{ '--c': meta.cor } as React.CSSProperties}>
        <span className="palco-pote"><PoteMeta progresso={depois / meta.alvo} cor={meta.cor} icone={meta.icone} tamanho={150} /></span>
        <span className="palco-valor">
          <small>{tx('guardado nas metas')}</small>
          <strong>{fmtMoeda(depois, meta.moeda)}</strong>
          <em>{tx('de {0}', fmtMoeda(meta.alvo, meta.moeda))} · {Math.round(Math.min(1, Math.max(0, depois / meta.alvo)) * 100)}%</em>
        </span>
      </div>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <Segmentado rotulo={tx('Movimento')} valor={retirar ? 'retirar' : 'guardar'} aoMudar={(v) => setRetirar(v === 'retirar')}
          opcoes={[{ id: 'guardar', nome: tx('Guardar'), cor: COR.entradas }, { id: 'retirar', nome: tx('Retirar'), cor: COR.saidas }]} />
        <label className="valor-grande" style={{ '--c': retirar ? COR.saidas : COR.entradas } as React.CSSProperties}>
          <span>{simbolo(meta.moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(meta.moeda))); setErro(null) }} aria-label={tx('Valor')} />
        </label>
        <div className="mt-atalhos">
          {atalhos.map((a) => (
            <button key={a.rotulo} type="button" className="chip" onClick={() => {
              // "+R$ 50" soma ao que já está digitado; os outros põem o valor
              const soma = a.rotulo.startsWith('+')
              setValor(paraCampo(soma ? (parseNumero(valor) ?? 0) + a.valor : a.valor))
              setErro(null)
            }}>
              {a.rotulo}{!a.rotulo.startsWith('+') && <small> {fmtMoeda(a.valor, meta.moeda)}</small>}
            </button>
          ))}
        </div>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Data')}</span>
            <CampoData valor={data} aoMudar={setData} rotulo={tx('Data')} obrigatorio />
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Observação')} <small>(opcional)</small></span>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={retirar ? tx('Ex.: paguei a passagem') : tx('Ex.: sobra do mês')} maxLength={60} />
          </label>
        </div>
        <span className="campo-ajuda">
          {retirar ? tx('Retirar diminui o guardado na meta.') : tx('Registre quando separar dinheiro para esta meta (numa caixinha, poupança, conta…).')}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{retirar ? tx('Retirar') : tx('Guardar')}</button>
        </div>
      </form>
    </Modal>
  )
}
