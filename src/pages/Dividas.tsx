import { CenaDividas } from '../components/Vazios'
import { useState } from 'react'
import { COR } from '../lib/charts'
import {
  aproxDiv, aumentaDivida, calendarioDe, fmtDiv, inicioPelaProxima, meDevem, parcelasDe, projecaoMensal, tomarLadoDividas, totalDeParcelas,
  type Calendario, type ParcelaDivida, type SituacaoDivida,
} from '../lib/dividas'
import { fmtConta } from '../lib/contasFixas'
import { estiloDoBanco } from '../lib/estiloBanco'
import { fmtDataCurta, fmtDataLonga, fmtMesAno, fmtMoeda, fmtTaxa, fmtValor, MESES_CURTO, noMeioDaFrase } from '../lib/format'
import { BancoIcone } from '../components/BancoIcone'
import { FormDivida } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { Anel, Kpi, Modal } from '../components/ui'
import { CampoData } from '../components/Escolhas'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

type Lado = 'devo' | 'me_devem'
const CORES_PESSOA = ['#4c8dff', '#e255a1', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#0ea5e9']
const hash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
const mesCurto = (iso: string) => `${noMeioDaFrase(MESES_CURTO[Number(iso.slice(5, 7)) - 1])}/${iso.slice(2, 4)}`

/** Situação resumida de uma dívida, para o selo e para ordenar a lista. */
function estadoDe(s: SituacaoDivida, cal: Calendario | null) {
  if (s.restante <= 0) return { id: 'quitada', texto: tx('Quitada'), ordem: 4 }
  if (cal?.atrasadas.length) return { id: 'atrasada', texto: cal.atrasadas.length === 1 ? tx('1 atrasada') : tx('{0} atrasadas', cal.atrasadas.length), ordem: 0 }
  if (cal?.parcelas.some((p) => p.estado === 'vence_hoje')) return { id: 'vence_hoje', texto: tx('Vence hoje'), ordem: 1 }
  if (cal) return { id: 'em_dia', texto: tx('Em dia'), ordem: 2 }
  return { id: 'sem_data', texto: tx('Sem data'), ordem: 3 }
}

/**
 * Dívidas dos dois lados: o que você deve e o que te devem (venda parcelada, empréstimo que você fez). Cada uma tem o
 * calendário das parcelas (paga, pela metade, atrasada, a vencer), sai do pagamento ou recebimento lançado e tem um
 * botão só, que já sugere o valor certo. O que se recebe todo mês (aluguel) vem das contas fixas de entrada.
 */
export function Dividas(c: Ctx) {
  const [lado, setLado] = useState<Lado>(tomarLadoDividas)
  const [editando, setEditando] = useState<SituacaoDivida | 'nova' | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const recebe = lado === 'me_devem'
  const lista = recebe ? c.aReceber : c.situacao
  const comCal = lista.map((s) => ({ s, cal: calendarioDe(s, c.diaRef) }))
  const itens = comCal
    .filter((x) => !x.s.quitadaNoMes)
    .map((x) => ({ ...x, estado: estadoDe(x.s, x.cal) }))
    .sort((a, b) => a.estado.ordem - b.estado.ordem || (b.cal?.emAtraso ?? 0) - (a.cal?.emAtraso ?? 0)
      || (a.cal?.proxima?.vencimento ?? '9').localeCompare(b.cal?.proxima?.vencimento ?? '9') || b.s.restante - a.s.restante)
  const quitadas = comCal.filter((x) => x.s.quitadaNoMes)
  const falta = lista.reduce((a, s) => a + s.restante, 0)
  const inicial = lista.reduce((a, s) => a + s.saldoInicial, 0)
  const emAtraso = comCal.reduce((a, x) => a + (x.cal?.emAtraso ?? 0), 0)
  const nAtraso = comCal.reduce((a, x) => a + (x.cal?.atrasadas.length ?? 0), 0)
  const noMes = lista.reduce((a, s) => a + s.pagoNoMes, 0)
  const porMes = lista.filter((s) => s.restante > 0).reduce((a, s) => a + (s.divida.valor_parcela ?? 0), 0)
  const projecao = projecaoMensal(lista, c.diaRef, 12)
  // dá para dizer quando acaba só se toda dívida em aberto tem parcela fixa
  const semParcela = lista.some((s) => s.restante > 0 && !s.quitacao && !calendarioDe(s, c.diaRef))
  const fim = semParcela ? null : lista
    .map((s) => { const cal = calendarioDe(s, c.diaRef); const u = cal?.parcelas.at(-1)?.vencimento; return u && s.restante > 0 ? [Number(u.slice(0, 4)), Number(u.slice(5, 7))] as [number, number] : s.quitacao })
    .filter((q): q is [number, number] => Boolean(q))
    .sort((a, b) => b[0] * 12 + b[1] - (a[0] * 12 + a[1]))[0] ?? null
  const aberto = comCal.find((x) => x.s.divida.id === aberta)
  const contasEntrada = c.situacoesContas.filter((s) => s.conta.tipo === 'entrada' && s.estado !== 'fora')
  const pct = inicial > 0 ? (inicial - falta) / inicial : 0

  return (
    <div className="pagina pg-dividas">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Dívidas')}</h1>
          <p className="sub">{recebe ? tx('Quem te deve, quanto falta receber e o que já venceu.') : tx('Quanto falta em cada uma, o que venceu e quando você fica livre.')}</p>
        </div>
        <div className="dv-topo-acoes">
          {!c.d.dividasSemExtras && (
            <div className="dv-lados" role="tablist" aria-label={tx('Lado')}>
              <span className="dv-lados-lente" style={{ transform: `translateX(${recebe ? 100 : 0}%)` }} aria-hidden="true" />
              <button role="tab" aria-selected={!recebe} className={!recebe ? 'ativo' : ''} onClick={() => setLado('devo')}>
                <Icone nome="enviar" tamanho={16} /> {tx('Eu devo')} {c.situacao.length > 0 && <small>{c.situacao.filter((s) => s.restante > 0).length}</small>}
              </button>
              <button role="tab" aria-selected={recebe} className={recebe ? 'ativo' : ''} onClick={() => setLado('me_devem')}>
                <Icone nome="receber" tamanho={16} /> {tx('Me devem')} {c.aReceber.length > 0 && <small>{c.aReceber.filter((s) => s.restante > 0).length}</small>}
              </button>
            </div>
          )}
          <button className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> {recebe ? tx('Alguém me deve') : tx('Adicionar dívida')}</button>
        </div>
      </header>

      {c.d.dividasSemExtras && (
        <p className="cc-aviso-migracao">
          <Icone nome="ideia" tamanho={16} />
          <span>{tx('Para registrar quem te deve e ver cada parcela como paga, pela metade ou atrasada, rode')} <code>supabase/migracao-10-dividas-e-a-receber.sql</code> {tx('no SQL Editor do Supabase.')}</span>
        </p>
      )}

      {lista.length > 0 && (
        <div className="kpis" key={lado}>
          <Kpi rotulo={recebe ? tx('Falta receber') : tx('Falta pagar')} valor={falta} cor={recebe ? COR.entradas : COR.divida} icone={recebe ? 'receber' : 'divida'}
            delta={!recebe && c.anterior?.divida ? (c.r.divida - c.anterior.divida) / c.anterior.divida : null} menorMelhor
            contra={c.mes > 1 ? tx('em {0}', noMeioDaFrase(MESES_CURTO[c.mes - 2])) : undefined} />
          <Kpi rotulo={recebe ? tx('Entra por mês') : tx('Parcelas por mês')} valor={porMes} cor={COR.caixa} icone="calendario" />
          <Kpi rotulo={nAtraso ? tx('Atrasado ({0} {1})', nAtraso, nAtraso === 1 ? tx('parcela') : tx('parcelas')) : tx('Atrasado')} valor={emAtraso}
            cor={emAtraso ? COR.saidas : COR.entradas} icone="relogio" />
          <Kpi rotulo={recebe ? tx('Recebido no mês') : tx('Pago no mês')} valor={noMes} cor={COR.entradas} icone="check" />
        </div>
      )}

      {!lista.length ? (
        <VazioLado recebe={recebe} aoNova={() => setEditando('nova')} />
      ) : (
        <section className="dv-visao" key={`v-${lado}`}>
          <div className="cartao dv-progresso">
            <Anel valor={pct} cor={recebe ? COR.entradas : COR.entradas} tamanho={112}>
              <span className="dv-progresso-pct">{Math.round(pct * 100)}%</span>
            </Anel>
            <span className="dv-progresso-texto">
              <small>{recebe ? tx('já recebido') : tx('já pago')}</small>
              <strong><Numero valor={inicial - falta} formato={fmtValor} /></strong>
              <small>{tx('de {0}', fmtValor(inicial))}</small>
              {falta > 0 && fim && <span className="chip-info"><Icone nome="calendario" tamanho={13} /> {recebe ? tx('tudo recebido em') : tx('livre em')} {fmtMesAno(fim[0], fim[1])}</span>}
              {falta <= 0 && <span className="chip-info bom"><Icone nome="check" tamanho={13} /> {recebe ? tx('tudo recebido') : tx('sem dívidas')}</span>}
            </span>
          </div>
          <div className="cartao dv-meses">
            <h3 className="ccd-titulo">{recebe ? tx('Quanto entra nos próximos meses') : tx('Quanto sai nos próximos meses')}</h3>
            <Barras valores={projecao} recebe={recebe} />
          </div>
        </section>
      )}

      {itens.length > 0 && (
        <div className="dv-grade" key={`g-${lado}`}>
          {itens.map((x, i) => (
            <CartaoDivida key={x.s.divida.id} s={x.s} cal={x.cal} estado={x.estado} recebe={recebe} indice={i}
              aoAbrir={() => setAberta(x.s.divida.id)} aoPagar={() => c.pagarDivida(x.s)} />
          ))}
        </div>
      )}

      {recebe && (
        <section className="cartao dv-todo-mes">
          <h3 className="ccd-titulo"><Icone nome="calendario" tamanho={18} /> {tx('Recebe todo mês')} <small>{tx('aluguel, mesada, salário')}</small></h3>
          {c.v.contas && contasEntrada.length ? (
            <ul>
              {contasEntrada.map((s) => (
                <li key={s.conta.id}>
                  <span className={`dv-todo-dia ${s.estado}`}><b>{String(s.dia).padStart(2, '0')}</b><small>{noMeioDaFrase(MESES_CURTO[c.mes - 1])}</small></span>
                  <span className="dv-todo-texto"><strong>{s.conta.descricao}</strong><small>{s.estado === 'paga' ? tx('recebido') : s.estado === 'atrasada' ? tx('atrasado {0} dias', s.diasAtraso) : s.estado === 'vence_hoje' ? tx('cai hoje') : tx('cai em {0} dias', s.diasRestantes)}</small></span>
                  <span className="dv-todo-valor">{fmtConta(s)}</span>
                  {s.estado === 'paga'
                    ? <span className="chip-estado paga">{tx('Recebido')}</span>
                    : <button className="btn" onClick={() => c.pagarConta(s)}><Icone nome="check" tamanho={15} /> {tx('Recebi')}</button>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Aluguel, mesada ou qualquer valor que cai todo mês fica em')} <b>{tx('Contas do mês')}</b>{tx(', como recebimento: o app lembra o dia e você dá baixa com “Recebi”.')}</p>
          )}
          <button className="link" onClick={() => { if (!c.v.contas) c.ligarModulo('contas'); c.irPara('contas') }}>
            {contasEntrada.length ? tx('Ver em Contas do mês') : tx('Cadastrar um recebimento mensal')} <Icone nome="seta" tamanho={14} />
          </button>
        </section>
      )}

      {quitadas.length > 0 && (
        <section className="dv-quitadas">
          <h2 className="secao-titulo">{recebe ? tx('Recebidas neste mês') : tx('Quitadas neste mês')} 🎉</h2>
          <div className="dv-grade">
            {quitadas.map((x, i) => (
              <CartaoDivida key={x.s.divida.id} s={x.s} cal={x.cal} estado={estadoDe(x.s, x.cal)} recebe={recebe} indice={i}
                aoAbrir={() => setAberta(x.s.divida.id)} aoPagar={() => c.pagarDivida(x.s)} />
            ))}
          </div>
        </section>
      )}

      {aberto && (
        <Ficha c={c} s={aberto.s} cal={aberto.cal} recebe={recebe} aoFechar={() => setAberta(null)}
          aoEditar={() => { setAberta(null); setEditando(aberto.s) }} />
      )}

      {editando && (
        <FormDivida
          ano={c.ano}
          mes={c.mes}
          situacao={editando === 'nova' ? undefined : editando}
          sentidoInicial={lado}
          semExtras={c.d.dividasSemExtras}
          perfil={c.perfil}
          semMoeda={c.d.dividasSemMoeda}
          semJuros={c.d.dividasSemJuros}
          aoCriar={async (d) => {
            if (d.sentido && d.sentido !== lado) setLado(d.sentido)
            return c.d.addDivida(d)
          }}
          aoEditar={c.d.updDivida}
          aoNovoSaldo={c.d.addSaldo}
          aoMudarValor={c.d.ajustarValorDivida}
          aoMoverInicio={c.d.moverInicioDivida}
          pagamentos={c.d.pagamentos}
          aoExcluir={c.d.delDivida}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function VazioLado({ recebe, aoNova }: { recebe: boolean; aoNova: () => void }) {
  return (
    <section className="cartao dv-vazio">
      <CenaDividas recebe={recebe} />
      <h2>{recebe ? tx('Ninguém te deve nada por aqui') : tx('Nenhuma dívida por aqui 🎉')}</h2>
      <p>{recebe
        ? tx('Vendeu algo parcelado ou emprestou dinheiro? Registre quem te deve: cada valor recebido entra como entrada e abate sozinho.')
        : tx('Tem empréstimo, parcelamento ou acordo? Adicione e acompanhe cada parcela até quitar.')}</p>
      <button className="btn primario" onClick={aoNova}><Icone nome="mais" tamanho={16} /> {recebe ? tx('Alguém me deve') : tx('Adicionar dívida')}</button>
    </section>
  )
}

/** Selo de quem: o do banco quando é um banco conhecido; senão as iniciais da pessoa num círculo colorido. */
function Quem({ s, tamanho = 42 }: { s: SituacaoDivida; tamanho?: number }) {
  const nome = s.divida.pessoa || s.divida.descricao
  if (estiloDoBanco(nome) || estiloDoBanco(s.divida.descricao)) {
    return <BancoIcone nome={nome} reserva={s.divida.descricao} tamanho={tamanho} />
  }
  const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')
  return (
    <span className="dv-quem" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36, '--c': CORES_PESSOA[hash(nome) % CORES_PESSOA.length] } as React.CSSProperties}>
      {iniciais || '?'}
    </span>
  )
}

/** "1,8% ao mês" quando a pessoa informou os juros de uma dívida que ela deve e ainda não quitou; senão null. */
const jurosDaDivida = (s: SituacaoDivida) => {
  const j = s.divida.juros_mes
  return !meDevem(s.divida) && s.restante > 0 && typeof j === 'number' && j > 0 ? tx('{0}% ao mês', fmtTaxa(j)) : null
}

function CartaoDivida({ s, cal, estado, recebe, indice, aoAbrir, aoPagar }: {
  s: SituacaoDivida; cal: Calendario | null; estado: ReturnType<typeof estadoDe>; recebe: boolean; indice: number
  aoAbrir: () => void; aoPagar: () => void
}) {
  const p = parcelasDe(s)
  const pct = s.saldoInicial > 0 ? (s.saldoInicial - s.restante) / s.saldoInicial : 1
  const quitada = s.restante <= 0
  // sem parcela nem data, não há valor certo a sugerir: a pessoa digita quanto pagou
  const sugerido = cal?.sugerido || (s.divida.valor_parcela ? Math.min(s.divida.valor_parcela, s.restante) : 0)
  const verbo = recebe ? tx('Receber') : tx('Pagar')
  return (
    <article className={`cartao dv-cartao ${estado.id}`} style={{ animationDelay: `${Math.min(indice, 8) * 60}ms` }}>
      <button className="dv-cartao-corpo" onClick={aoAbrir} aria-label={tx('Ver {0}', s.divida.descricao)}>
        <header className="dv-cartao-cab">
          <Quem s={s} />
          <span className="dv-cartao-nome">
            <strong>{s.divida.descricao}</strong>
            <small>{[s.divida.pessoa, p && !quitada ? tx('parcela {0} de {1}', p.proxima, totalDeParcelas(s)) : null, jurosDaDivida(s)].filter(Boolean).join(' · ') || (s.divida.valor_parcela ? tx('parcelado') : tx('valor único'))}</small>
          </span>
          <span className={`chip-estado dv ${estado.id}`}>{estado.texto}</span>
        </header>
        <div className="dv-cartao-meio">
          <span>
            <small>{quitada ? (recebe ? tx('recebido') : tx('quitada')) : recebe ? tx('falta receber') : tx('falta pagar')}</small>
            <strong>{quitada ? fmtDiv(s, s.saldoInicial) : <Numero valor={s.restante} formato={(n) => fmtDiv(s, n)} />}</strong>
            {s.moeda && !quitada && <small className="dv-aprox">{aproxDiv(s, s.restante)}</small>}
          </span>
          <Anel valor={pct} cor={quitada ? COR.entradas : recebe ? COR.entradas : COR.caixa} tamanho={54}>{Math.round(pct * 100)}%</Anel>
        </div>
        {cal && cal.parcelas.length > 1 ? (
          <Pips parcelas={cal.parcelas} />
        ) : (
          <span className="dv-barra" aria-hidden="true"><i style={{ width: `${pct * 100}%` }} /></span>
        )}
        <p className="dv-cartao-linha">
          {quitada ? <>{tx('Tudo {0}. 🎉', recebe ? tx('recebido') : tx('pago'))}</>
            : cal?.atrasadas.length ? <><b className="ruim">{fmtDiv(s, cal.emAtraso)}</b> {tx('vencido desde {0}', fmtDataCurta(cal.atrasadas[0].vencimento))}</>
              : cal?.proxima ? <>{tx('Próxima:')} <b>{fmtDataCurta(cal.proxima.vencimento)}</b> · {fmtDiv(s, cal.proxima.falta)}{cal.proxima.pago > 0 && ' (resto)'}</>
                : s.divida.valor_parcela ? <>{tx('{0} por mês', fmtDiv(s, s.divida.valor_parcela))}{s.quitacao && <> {tx('· até {0}', fmtMesAno(s.quitacao[0], s.quitacao[1]))}</>}</>
                  : <>{recebe ? tx('Recebe') : tx('Paga')} {tx('quanto e quando puder')}</>}
        </p>
      </button>
      {!quitada && (
        <button className={`btn ${estado.id === 'atrasada' ? 'perigo-forte' : 'primario'} dv-cartao-botao`} onClick={aoPagar}>
          <Icone nome={recebe ? 'receber' : 'check'} tamanho={16} /> {sugerido ? `${verbo} ${fmtDiv(s, sugerido)}` : recebe ? tx('Lançar recebimento') : tx('Lançar pagamento')}
        </button>
      )}
    </article>
  )
}

/** Um tracinho por parcela, pintado conforme a situação; a parcial enche até onde foi paga. */
function Pips({ parcelas }: { parcelas: ParcelaDivida[] }) {
  if (parcelas.length > 36) {
    const pagas = parcelas.filter((p) => p.estado === 'paga').length
    return <span className="dv-barra" aria-hidden="true"><i style={{ width: `${(pagas / parcelas.length) * 100}%` }} /></span>
  }
  return (
    <span className="dv-pips" aria-hidden="true">
      {parcelas.map((p, i) => (
        <i key={p.n} className={p.estado} style={{ '--p': `${(p.pago / p.valor) * 100}%`, animationDelay: `${150 + i * 22}ms` } as React.CSSProperties} />
      ))}
    </span>
  )
}

/** Barras dos próximos 12 meses (atrasados entram no mês atual). */
function Barras({ valores, recebe }: { valores: { ano: number; mes: number; valor: number }[]; recebe: boolean }) {
  const maior = Math.max(1, ...valores.map((v) => v.valor))
  if (!valores.some((v) => v.valor > 0)) return <p className="quadro-vazio">{tx('Nada com data marcada pela frente.')}</p>
  return (
    <div className={`dv-barras ${recebe ? 'recebe' : ''}`}>
      {valores.map((v, i) => (
        <div key={`${v.ano}-${v.mes}`} className={`ccd-barra ${i === 0 ? 'atual' : ''} ${v.valor ? '' : 'vazia'}`} title={`${fmtMesAno(v.ano, v.mes)}: ${fmtValor(v.valor)}`}>
          <span className="ccd-barra-valor">{v.valor ? fmtValor(v.valor).replace(/,\d\d$/, '') : '—'}</span>
          <span className="ccd-barra-trilho"><i style={{ height: `${Math.max(v.valor ? 6 : 0, (v.valor / maior) * 100)}%`, animationDelay: `${i * 45}ms` }} /></span>
          <span className="ccd-barra-mes">{noMeioDaFrase(MESES_CURTO[v.mes - 1])}</span>
        </div>
      ))}
    </div>
  )
}

const ROTULO_PARCELA: Record<ParcelaDivida['estado'], string> = {
  paga: tx('paga'), parcial: tx('pela metade'), atrasada: tx('atrasada'), vence_hoje: tx('vence hoje'), a_vencer: tx('a vencer'),
}

/**
 * Tudo de uma dívida: quanto falta, cada parcela com a situação, o que já foi pago ou recebido e o botão de pagar.
 * Dívida sem vencimento pede só "quando vence a próxima?" para montar o calendário.
 */
function Ficha({ c, s, cal, recebe, aoFechar, aoEditar }: {
  c: Ctx; s: SituacaoDivida; cal: Calendario | null; recebe: boolean; aoFechar: () => void; aoEditar: () => void
}) {
  const [proxima, setProxima] = useState('')
  const p = parcelasDe(s)
  const lancs = c.d.lancs.filter((l) => l.divida_id === s.divida.id)
  const outrosAnos = c.d.pagamentos.filter((x) => x.divida_id === s.divida.id && !lancs.some((l) => l.id === x.id))
  const movimentos = [
    ...lancs.map((l) => ({ id: l.id, data: l.data, texto: l.moeda_original && l.valor_original ? fmtMoeda(l.valor_original, l.moeda_original) : fmtValor(l.valor), descricao: l.descricao, lanc: l, aumenta: aumentaDivida(l.tipo, s.original), sinal: aumentaDivida(l.tipo, s.original) ? '+ ' : '' })),
    ...outrosAnos.map((x) => ({ id: x.id, data: x.data, texto: x.moeda_original && x.valor_original ? fmtMoeda(x.valor_original, x.moeda_original) : fmtValor(x.valor), descricao: '', lanc: null, aumenta: aumentaDivida(x.tipo, s.original), sinal: aumentaDivida(x.tipo, s.original) ? '+ ' : '' })),
    // juros, acordo, desconto: mudanças de saldo sem lançamento, para a linha do gráfico ter explicação
    ...s.ajustes.map((a) => ({ id: `aj-${a.data}-${a.valor}`, data: a.data, texto: fmtDiv(s, Math.abs(a.valor)), descricao: tx('ajuste de saldo'), lanc: null, aumenta: a.valor > 0, sinal: a.valor > 0 ? '+ ' : '− ' })),
  ].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
  const quitada = s.restante <= 0
  const sugerido = cal?.sugerido || (s.divida.valor_parcela ? Math.min(s.divida.valor_parcela, s.restante) : 0)
  const definirVencimento = () => {
    if (!proxima) return
    void c.d.updDivida(s.divida.id, {
      inicio: inicioPelaProxima(proxima, s.divida.valor_parcela ? p?.pagas ?? 0 : 0),
      total_parcelas: s.divida.valor_parcela ? totalDeParcelas(s) : null,
    })
  }

  return (
    <Modal titulo={recebe ? tx('A receber') : tx('Dívida')} aoFechar={aoFechar}>
      <div className="dv-ficha">
        <header className="dv-ficha-cab">
          <Quem s={s} tamanho={52} />
          <span className="dv-ficha-nome">
            <h3>{s.divida.descricao}</h3>
            <small>{[s.divida.pessoa ? `${recebe ? tx('quem deve') : tx('com')}: ${s.divida.pessoa}` : recebe ? tx('a receber') : tx('dívida'), jurosDaDivida(s)].filter(Boolean).join(' · ')}</small>
          </span>
          <button className="btn" onClick={aoEditar}><Icone nome="lapis" tamanho={15} /> {tx('Editar')}</button>
        </header>

        <div className="dv-ficha-numeros">
          <span><small>{recebe ? tx('falta receber') : tx('falta pagar')}</small><strong>{fmtDiv(s, s.restante)}</strong>{s.moeda && <small className="dv-aprox">{aproxDiv(s, s.restante)}</small>}</span>
          <span><small>{recebe ? tx('já recebido') : tx('já pago')}</small><strong className="bom">{fmtDiv(s, Math.max(0, s.saldoInicial - s.restante))}</strong></span>
          <span><small>{s.divida.valor_parcela ? tx('parcela') : tx('total')}</small><strong>{fmtDiv(s, s.divida.valor_parcela ?? s.saldoInicial)}</strong></span>
        </div>

        {cal ? (
          <section>
            <h4 className="dv-ficha-titulo">{cal.parcelas.length > 1 ? tx('Parcelas') : tx('Combinado')}
              {cal.atrasadas.length > 0 && <span className="chip-estado dv atrasada">{tx('{0} atrasado', fmtDiv(s, cal.emAtraso))}</span>}
            </h4>
            <ol className="dv-calendario">
              {cal.parcelas.map((x, i) => (
                <li key={x.n} className={x.estado} style={{ '--p': `${(x.pago / x.valor) * 100}%`, animationDelay: `${Math.min(i, 24) * 25}ms` } as React.CSSProperties}>
                  <span className="dv-cal-n">{cal.parcelas.length > 1 ? `${x.n}ª` : <Icone nome="calendario" tamanho={13} />}</span>
                  <span className="dv-cal-mes">{mesCurto(x.vencimento)}</span>
                  <span className="dv-cal-valor">{x.estado === 'paga' ? <Icone nome="check" tamanho={14} /> : fmtDiv(s, x.falta).replace(/,00$/, '')}</span>
                  <span className="dv-cal-estado">{x.pago > 0 && x.estado !== 'paga' ? (recebe ? tx('{0} recebido', fmtDiv(s, x.pago).replace(/,00$/, '')) : tx('{0} pago', fmtDiv(s, x.pago).replace(/,00$/, ''))) : ROTULO_PARCELA[x.estado]}</span>
                </li>
              ))}
            </ol>
            <p className="campo-ajuda">{(recebe ? tx('O que você recebe cobre as parcelas da mais antiga para a mais nova: pagou metade, a parcela fica pela metade; pagou a mais, adianta as próximas.') : tx('O que você paga cobre as parcelas da mais antiga para a mais nova: pagou metade, a parcela fica pela metade; pagou a mais, adianta as próximas.'))}</p>
          </section>
        ) : !c.d.dividasSemExtras && !quitada ? (
          <section className="dv-sem-data">
            <Icone nome="calendario" tamanho={20} />
            <span>
              <b>{s.divida.valor_parcela ? tx('Quando vence a próxima parcela?') : tx('Tem data combinada?')}</b>
              <small>{tx('Com a data, o app mostra o que está em dia e o que atrasou.')}</small>
            </span>
            <CampoData valor={proxima} aoMudar={setProxima} rotulo={tx('Vencimento')} />
            <button className="btn" onClick={definirVencimento} disabled={!proxima}>{tx('Salvar')}</button>
          </section>
        ) : null}

        <section>
          <h4 className="dv-ficha-titulo">{recebe ? tx('Recebimentos') : tx('Pagamentos')} <small>{movimentos.length || ''}</small></h4>
          {movimentos.length ? (
            <ul className="dv-movimentos">
              {movimentos.slice(0, 12).map((m) => (
                <li key={m.id}>
                  <button disabled={!m.lanc} onClick={() => { if (m.lanc) { aoFechar(); c.editarLancamento(m.lanc) } }}>
                    <span className="ccd-hist-icone ok"><Icone nome={m.aumenta ? 'receber' : recebe ? 'receber' : 'check'} tamanho={15} /></span>
                    <span className="ccd-hist-texto"><strong>{m.data ? fmtDataLonga(m.data) : tx('sem data')}</strong><small>{m.descricao || (m.aumenta ? tx('emprestado a mais') : recebe ? tx('recebido') : tx('pago'))}</small></span>
                    <span className="ccd-hist-valor">{m.sinal}{m.texto}</span>
                    {m.lanc && <Icone nome="lapis" tamanho={14} />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quadro-vazio">{tx('Nada {0} ainda. Use o botão abaixo: o valor já vem sugerido e dá para trocar (pagar parte ou mais de uma parcela).', recebe ? tx('recebido') : tx('pago'))}</p>
          )}
        </section>

        <div className="form-acoes">
          <span className="espaco" />
          {!quitada && (
            <button className="btn primario" onClick={() => { aoFechar(); c.pagarDivida(s) }}>
              <Icone nome={recebe ? 'receber' : 'check'} tamanho={16} /> {recebe ? tx('Receber') : tx('Pagar')}{sugerido ? ` ${fmtDiv(s, sugerido)}` : ''}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
