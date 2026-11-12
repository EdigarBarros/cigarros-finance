import { useState } from 'react'
import { fmtDiv, type EstadoPromessa, type Promessas, type SituacaoDivida, type SituacaoPromessa } from '../lib/dividas'
import { mascarar } from '../lib/dinheiro'
import { fmtDataCurta, fmtDataLonga, parseNumero } from '../lib/format'
import type { Dados } from '../lib/useDados'
import { CampoData } from './Escolhas'
import { Icone } from './Icone'
import { tx } from '../lib/textos'

const ROTULO: Record<EstadoPromessa, string> = {
  aguardando: tx('aguardando'), hoje: tx('é hoje'), cumprida: tx('cumprida'), em_parte: tx('cumprida em parte'),
  pagou_depois: tx('pagou depois do dia'), nao_cumprida: tx('não cumprida'), trocada: tx('trocada por outra'),
}

const diasAte = (iso: string, hoje: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000)

/** "hoje", "amanhã", "em 3 dias" ou a data. */
export function quandoPromessa(iso: string, hoje: string) {
  const n = diasAte(iso, hoje)
  return n === 0 ? tx('hoje') : n === 1 ? tx('amanhã') : n > 1 && n <= 6 ? tx('em {0} dias', n) : tx('em {0}', fmtDataCurta(iso))
}

/** A linha do cartão da dívida: "Prometeu pagar amanhã · 2ª promessa" (ou "Você combinou pagar…" numa dívida sua). */
export function LinhaDaPromessa({ s, p, recebe, hoje }: { s: SituacaoDivida; p: Promessas; recebe: boolean; hoje: string }) {
  if (!p.ativa) return null
  const quando = quandoPromessa(p.ativa.promessa.data, hoje)
  const valor = p.ativa.valor ? ` · ${fmtDiv(s, p.ativa.valor)}` : ''
  return (
    <p className="dv-promessa-linha">
      <Icone nome="acordo" tamanho={15} />
      <span>
        <b>{recebe ? tx('Prometeu pagar {0}', quando) : tx('Você combinou pagar {0}', quando)}</b>{valor}
        {p.lista.length > 1 && <small> · {tx('{0}ª promessa', p.ativa.n)}{p.quebradas > 0 && (p.quebradas === 1 ? tx(', 1 não cumprida') : tx(', {0} não cumpridas', p.quebradas))}</small>}
      </span>
    </p>
  )
}

/**
 * As promessas de pagamento de uma dívida, da mais nova para a mais antiga: o dia prometido e o que aconteceu (o app vê
 * pelos pagamentos). Dá para anotar uma nova ("agora paga amanhã") e apagar uma anotada errado.
 */
export function PromessasDaDivida({ s, p, d, recebe, hoje }: {
  s: SituacaoDivida; p: Promessas; d: Pick<Dados, 'promessasSemTabela' | 'addPromessa' | 'delPromessa'>; recebe: boolean; hoje: string
}) {
  const [nova, setNova] = useState(false)
  const quitada = s.restante <= 0
  if (d.promessasSemTabela) {
    return (
      <p className="cc-aviso-migracao">
        <Icone nome="ideia" tamanho={16} />
        <span>{tx('Para anotar promessas de pagamento, rode')} <code>supabase/migracao-25-promessas-de-pagamento.sql</code> {tx('no SQL Editor do Supabase.')}</span>
      </p>
    )
  }
  if (quitada && !p.lista.length) return null
  const lista = [...p.lista].reverse()
  return (
    <section className="dv-promessas">
      <h4 className="dv-ficha-titulo">
        {tx('Promessas de pagamento')} {p.lista.length > 0 && <small>{p.lista.length}</small>}
        {p.quebradas > 0 && <span className="chip-estado dv atrasada">{p.quebradas === 1 ? tx('1 não cumprida') : tx('{0} não cumpridas', p.quebradas)}</span>}
      </h4>
      {lista.length > 0 ? (
        <ol className="dv-promessas-lista">
          {lista.map((x, i) => <ItemPromessa key={x.promessa.id} x={x} s={s} ativa={x === p.ativa} indice={i} hoje={hoje} aoApagar={() => void d.delPromessa(x.promessa.id)} />)}
        </ol>
      ) : (
        <p className="campo-ajuda">{recebe
          ? tx('Ficou de te pagar num dia e não pagou? Anote cada promessa: o app mostra o dia prometido, avisa no cartão e diz se foi cumprida.')
          : tx('Combinou pagar num dia? Anote cada promessa: o app mostra o dia combinado, avisa no cartão e diz se foi cumprida.')}</p>
      )}
      {!quitada && (nova
        ? <NovaPromessa s={s} hoje={hoje} recebe={recebe} aoCancelar={() => setNova(false)}
            aoSalvar={async (n) => { if (await d.addPromessa(s.divida.id, n)) setNova(false) }} />
        : <button className="btn dp-adicionar" onClick={() => setNova(true)}><Icone nome="mais" tamanho={15} /> {p.lista.length ? tx('Anotar nova promessa') : tx('Anotar promessa')}</button>)}
    </section>
  )
}

function ItemPromessa({ x, s, ativa, indice, hoje, aoApagar }: {
  x: SituacaoPromessa; s: SituacaoDivida; ativa: boolean; indice: number; hoje: string; aoApagar: () => void
}) {
  const [apagar, setApagar] = useState(false)
  const futura = x.estado === 'aguardando' || x.estado === 'hoje'
  return (
    <li className={`dv-promessa ${x.estado} ${ativa ? 'ativa' : ''}`} style={{ animationDelay: `${Math.min(indice, 10) * 40}ms` }}>
      <span className="dv-promessa-marco" aria-hidden="true">
        <Icone nome={x.estado === 'cumprida' ? 'check' : x.estado === 'nao_cumprida' ? 'fechar' : x.estado === 'trocada' ? 'trocar' : 'relogio'} tamanho={14} />
      </span>
      <span className="dv-promessa-corpo">
        <span className="dv-promessa-topo">
          <strong>{fmtDataLonga(x.promessa.data)}</strong>
          <span className="dv-promessa-estado">{futura ? `${ROTULO[x.estado]} · ${quandoPromessa(x.promessa.data, hoje)}` : ROTULO[x.estado]}</span>
        </span>
        <small>
          {tx('{0}ª promessa', x.n)}
          {x.valor ? ` · ${tx('prometido {0}', fmtDiv(s, x.valor))}` : ''}
          {x.pagoAte > 0 && x.estado !== 'cumprida' ? ` · ${tx('veio {0}', fmtDiv(s, x.pagoAte))}` : ''}
        </small>
        {x.promessa.obs && <em>“{x.promessa.obs}”</em>}
      </span>
      {apagar ? (
        <span className="dv-promessa-apagar">
          <button className="btn" onClick={() => setApagar(false)}>{tx('Manter')}</button>
          <button className="btn perigo" onClick={aoApagar}>{tx('Excluir')}</button>
        </span>
      ) : (
        <button className="icone-btn" onClick={() => setApagar(true)} aria-label={tx('Excluir promessa')} title={tx('Excluir promessa')}><Icone nome="lixeira" tamanho={14} /></button>
      )}
    </li>
  )
}

function NovaPromessa({ s, hoje, recebe, aoSalvar, aoCancelar }: {
  s: SituacaoDivida; hoje: string; recebe: boolean
  aoSalvar: (n: { data: string; valor: number | null; obs: string | null }) => Promise<void>; aoCancelar: () => void
}) {
  const amanha = (() => { const d = new Date(`${hoje}T12:00:00`); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const [data, setData] = useState(amanha)
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const n = parseNumero(valor)
  const simbolo = s.moeda ? s.moeda : 'R$'
  return (
    <form className="dp-nova" onSubmit={async (e) => {
      e.preventDefault()
      if (!data || salvando) return
      setSalvando(true)
      await aoSalvar({ data, valor: n && n > 0 ? n : null, obs: obs.trim() || null })
      setSalvando(false)
    }}>
      <div className="form-linha">
        <div className="campo">
          <span className="campo-rotulo">{recebe ? tx('Prometeu pagar em') : tx('Combinou pagar em')}</span>
          <span className="dv-promessa-atalhos">
            <button type="button" className={`chip ${data === hoje ? 'ativo' : ''}`} onClick={() => setData(hoje)}>{tx('Hoje')}</button>
            <button type="button" className={`chip ${data === amanha ? 'ativo' : ''}`} onClick={() => setData(amanha)}>{tx('Amanhã')}</button>
          </span>
          <CampoData valor={data} aoMudar={setData} rotulo={tx('Dia prometido')} />
        </div>
        <label className="campo">
          <span className="campo-rotulo">{tx('Quanto')} <small>({tx('opcional')})</small></span>
          <span className="campo-caixa"><span className="prefixo">{simbolo}</span>
            <input inputMode="decimal" value={valor} onChange={(e) => setValor(mascarar(e.target.value))} placeholder="0,00" />
          </span>
        </label>
      </div>
      <label className="campo">
        <span className="campo-rotulo">{tx('Anotação')} <small>({tx('opcional')})</small></span>
        <input value={obs} maxLength={140} onChange={(e) => setObs(e.target.value)} placeholder={recebe ? tx('Ex.: disse que paga quando o cliente pagar ele') : tx('Ex.: combinei pelo WhatsApp')} />
      </label>
      <p className="campo-ajuda">{tx('Sem valor, vale o que estiver atrasado. Se foi cumprida o app vê sozinho, pelo que você lançar até o dia. Promessas antigas também podem ser anotadas.')}</p>
      <div className="form-acoes">
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoCancelar}>{tx('Cancelar')}</button>
        <button type="submit" className="btn primario" disabled={!data || salvando}><Icone nome="check" tamanho={15} /> {tx('Anotar')}</button>
      </div>
    </form>
  )
}
